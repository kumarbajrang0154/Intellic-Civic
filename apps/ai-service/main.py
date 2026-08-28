import base64
import json
import logging
import time
from typing import Dict, Any, Tuple
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import requests

from config import (
    GEMINI_API_KEY,
    AUTO_APPROVE_CONFIDENCE_THRESHOLD,
    AUTO_FLAG_CONFIDENCE_THRESHOLD,
    check_gemini_api_key,
)
from models import VerifyEvidenceRequest, VerifyEvidenceResponse

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai_service")

app = FastAPI(
    title="IntelliCivic AI Service",
    description="Microservice for AI-powered photo evidence verification and complaint processing",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    logger.info("Initializing IntelliCivic AI Service...")
    if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
        logger.warning(
            "GEMINI_API_KEY is not configured or using placeholder value. "
            "Real Gemini API calls will be disabled until valid key is provided."
        )

@app.get("/health", status_code=200)
def health_check():
    return {
        "status": "ok",
        "service": "intellicivic-ai-service",
        "gemini_configured": bool(GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here"),
    }

def fetch_image_bytes(image_url: str) -> Tuple[bytes, str]:
    """Fetch image bytes from URL or decode base64 string."""
    try:
        if image_url.startswith("data:image/"):
            # Handle base64 data URI e.g. data:image/jpeg;base64,...
            header, encoded = image_url.split(",", 1)
            mime_type = header.split(";")[0].replace("data:", "")
            image_bytes = base64.b64decode(encoded)
            return image_bytes, mime_type
        elif image_url.startswith("http://") or image_url.startswith("https://"):
            resp = requests.get(image_url, timeout=10)
            if resp.status_code != 200:
                raise ValueError(f"HTTP fetch failed with status {resp.status_code}")
            content_type = resp.headers.get("Content-Type", "image/jpeg").split(";")[0]
            return resp.content, content_type
        else:
            # Assume raw base64 string
            image_bytes = base64.b64decode(image_url)
            return image_bytes, "image/jpeg"
    except Exception as e:
        logger.error(f"Image fetch/decode error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unable to fetch or decode image from provided image_url: {str(e)}",
        )

def compute_recommendation(
    is_relevant: bool | None,
    matches_category: bool | None,
    confidence_score: float,
    quality_flags: list[str],
) -> str:
    """Determine recommendation status based on defined threshold constants."""
    if (
        confidence_score >= AUTO_APPROVE_CONFIDENCE_THRESHOLD
        and is_relevant is True
        and matches_category is True
        and len(quality_flags) == 0
    ):
        return "AUTO_APPROVE"
    elif (
        confidence_score < AUTO_FLAG_CONFIDENCE_THRESHOLD
        or is_relevant is False
        or "no_civic_issue_visible" in quality_flags
    ):
        return "AUTO_FLAG"
    else:
        return "MANUAL_REVIEW"

def analyze_with_gemini(
    image_bytes: bytes,
    mime_type: str,
    complaint_category: str,
    complaint_description: str,
) -> Dict[str, Any]:
    """Call Google Gemini Vision API to analyze photo evidence."""
    if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GEMINI_API_KEY is not configured on the AI service. Please set valid key in .env",
        )

    prompt = f"""You are an expert AI urban infrastructure inspector for a Smart City Platform.
Analyze this evidence photo submitted for a civic complaint.

Complaint Details:
- Category: {complaint_category}
- Citizen Description: {complaint_description}

Instructions:
Evaluate the photo and return a STRICT JSON object containing exactly these fields:
- "is_relevant": boolean (does the photo plausibly show the described civic issue?)
- "matches_category": boolean (does the issue match the claimed category '{complaint_category}'?)
- "confidence_score": float between 0.0 and 1.0
- "detected_objects": array of strings (e.g. ["pothole", "asphalt", "vehicle"])
- "quality_flags": array of strings (choose from: "blurry", "too_dark", "duplicate_suspected", "screenshot_detected", "no_civic_issue_visible")
- "reasoning": string (concise 1-2 sentence explanation)

Output ONLY valid raw JSON with no markdown block markers."""

    # Try SDK call with retry on JSON parse failure
    for attempt in range(2):
        try:
            import google.generativeai as genai

            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-2.0-flash")

            image_part = {
                "mime_type": mime_type if "/" in mime_type else "image/jpeg",
                "data": image_bytes,
            }

            response = model.generate_content([prompt, image_part])
            text_resp = response.text.strip()

            # Clean markdown formatting if present
            if text_resp.startswith("```json"):
                text_resp = text_resp.replace("```json", "", 1).rsplit("```", 1)[0].strip()
            elif text_resp.startswith("```"):
                text_resp = text_resp.replace("```", "", 1).rsplit("```", 1)[0].strip()

            parsed = json.loads(text_resp)
            return parsed
        except json.JSONDecodeError as err:
            logger.warning(f"Gemini output JSON parse error on attempt {attempt + 1}: {str(err)}")
            if attempt == 1:
                # Return safe default fallback on persistent JSON decode failure
                return {
                    "is_relevant": None,
                    "matches_category": None,
                    "confidence_score": 0.50,
                    "detected_objects": [],
                    "quality_flags": ["malformed_ai_response"],
                    "reasoning": "AI service received non-JSON response from vision model; flagged for manual review.",
                }
        except Exception as e:
            logger.error(f"Gemini API invocation error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"AI Vision service encountered API error: {str(e)}",
            )

@app.post(
    "/ai/verify-evidence",
    response_model=VerifyEvidenceResponse,
    status_code=status.HTTP_200_OK,
)
def verify_evidence(payload: VerifyEvidenceRequest):
    start_time = time.time()
    logger.info(
        f"Received verify-evidence request for complaint_id={payload.complaint_id}, "
        f"category={payload.complaint_category}"
    )

    image_bytes, mime_type = fetch_image_bytes(payload.image_url)

    analysis = analyze_with_gemini(
        image_bytes=image_bytes,
        mime_type=mime_type,
        complaint_category=payload.complaint_category,
        complaint_description=payload.complaint_description,
    )

    confidence = float(analysis.get("confidence_score", 0.5))
    is_relevant = analysis.get("is_relevant")
    matches_cat = analysis.get("matches_category")
    flags = list(analysis.get("quality_flags", []))
    objects = list(analysis.get("detected_objects", []))
    reasoning = str(analysis.get("reasoning", "Evidence analyzed."))

    rec = compute_recommendation(
        is_relevant=is_relevant,
        matches_category=matches_cat,
        confidence_score=confidence,
        quality_flags=flags,
    )

    duration = round((time.time() - start_time) * 1000, 2)
    logger.info(
        f"Completed verify-evidence for complaint_id={payload.complaint_id} "
        f"in {duration}ms. Recommendation={rec}, Confidence={confidence}"
    )

    return VerifyEvidenceResponse(
        is_relevant=is_relevant,
        matches_category=matches_cat,
        confidence_score=confidence,
        detected_objects=objects,
        quality_flags=flags,
        reasoning=reasoning,
        recommendation=rec,
    )
