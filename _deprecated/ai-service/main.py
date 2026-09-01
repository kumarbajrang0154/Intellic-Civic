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
    AUTO_ROUTE_CONFIDENCE_THRESHOLD,
    SUGGEST_ONLY_CONFIDENCE_THRESHOLD,
    check_gemini_api_key,
)
from models import (
    VerifyEvidenceRequest,
    VerifyEvidenceResponse,
    RouteComplaintRequest,
    RouteComplaintResponse,
)

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai_service")

app = FastAPI(
    title="IntelliCivic AI Service",
    description="Microservice for AI-powered photo evidence verification and complaint routing",
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
    """Determine evidence recommendation status based on defined threshold constants."""
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

            if text_resp.startswith("```json"):
                text_resp = text_resp.replace("```json", "", 1).rsplit("```", 1)[0].strip()
            elif text_resp.startswith("```"):
                text_resp = text_resp.replace("```", "", 1).rsplit("```", 1)[0].strip()

            parsed = json.loads(text_resp)
            return parsed
        except json.JSONDecodeError as err:
            logger.warning(f"Gemini output JSON parse error on attempt {attempt + 1}: {str(err)}")
            if attempt == 1:
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

def route_with_gemini(
    title: str,
    description: str,
    available_categories: list[dict],
    available_departments: list[dict],
) -> Dict[str, Any]:
    """Call Gemini to predict category, department, and priority."""
    if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GEMINI_API_KEY is not configured on AI service",
        )

    categories_formatted = json.dumps(available_categories, indent=2)
    departments_formatted = json.dumps(available_departments, indent=2)

    prompt = f"""You are an AI Civic Complaint Routing Engine for a Smart City Platform.
Analyze the complaint title and description, then select the best matching category and department.

Complaint Title: {title}
Complaint Description: {description}

AVAILABLE CATEGORIES:
{categories_formatted}

AVAILABLE DEPARTMENTS:
{departments_formatted}

STRICT CONSTRAINTS:
1. "suggested_category_id": MUST be one of the category IDs listed in AVAILABLE CATEGORIES.
2. "suggested_department_id": MUST be one of the department IDs listed in AVAILABLE DEPARTMENTS.
3. "suggested_priority": Choose from "LOW", "MEDIUM", "HIGH", or "CRITICAL".
4. "confidence_score": float between 0.0 and 1.0.
5. "reasoning": 1-2 sentence explanation of your decision.

Output ONLY valid JSON with no markdown markers."""

    for attempt in range(2):
        try:
            import google.generativeai as genai

            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-2.0-flash")

            response = model.generate_content(prompt)
            text_resp = response.text.strip()

            if text_resp.startswith("```json"):
                text_resp = text_resp.replace("```json", "", 1).rsplit("```", 1)[0].strip()
            elif text_resp.startswith("```"):
                text_resp = text_resp.replace("```", "", 1).rsplit("```", 1)[0].strip()

            parsed = json.loads(text_resp)
            return parsed
        except json.JSONDecodeError as err:
            logger.warning(f"Gemini routing JSON parse error on attempt {attempt + 1}: {str(err)}")
            if attempt == 1:
                return {
                    "suggested_category_id": "INVALID",
                    "suggested_department_id": "INVALID",
                    "suggested_priority": "MEDIUM",
                    "confidence_score": 0.0,
                    "reasoning": "AI service received malformed response; flagged for manual triage.",
                }
        except Exception as e:
            logger.error(f"Gemini API routing call error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"AI Routing service error: {str(e)}",
            )

@app.post(
    "/ai/route-complaint",
    response_model=RouteComplaintResponse,
    status_code=status.HTTP_200_OK,
)
def route_complaint(payload: RouteComplaintRequest):
    start_time = time.time()
    logger.info(
        f"Received route-complaint request for complaint_id={payload.complaint_id}, "
        f"title='{payload.title}'"
    )

    valid_cat_ids = {c.id for c in payload.available_categories}
    valid_dept_ids = {d.id for d in payload.available_departments}

    categories_list = [{"id": c.id, "name": c.name} for c in payload.available_categories]
    departments_list = [
        {"id": d.id, "name": d.name, "handledCategories": d.handled_categories}
        for d in payload.available_departments
    ]

    analysis = route_with_gemini(
        title=payload.title,
        description=payload.description,
        available_categories=categories_list,
        available_departments=departments_list,
    )

    sug_cat_id = str(analysis.get("suggested_category_id", ""))
    sug_dept_id = str(analysis.get("suggested_department_id", ""))
    sug_priority = str(analysis.get("suggested_priority", "MEDIUM")).upper()
    if sug_priority not in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        sug_priority = "MEDIUM"

    confidence = float(analysis.get("confidence_score", 0.0))
    reasoning = str(analysis.get("reasoning", "Complaint analyzed."))

    # HARD SAFETY CHECK: Validate Gemini's suggested IDs against requested whitelist
    is_cat_valid = sug_cat_id in valid_cat_ids
    is_dept_valid = sug_dept_id in valid_dept_ids

    if not is_cat_valid or not is_dept_valid:
        logger.warning(
            f"SAFETY VIOLATION: Gemini suggested hallucinated ID(s): "
            f"cat_id='{sug_cat_id}' (valid={is_cat_valid}), dept_id='{sug_dept_id}' (valid={is_dept_valid}). "
            f"Rejecting suggestion and falling back to MANUAL_TRIAGE."
        )
        sug_cat_id = payload.available_categories[0].id if payload.available_categories else ""
        sug_dept_id = payload.available_departments[0].id if payload.available_departments else ""
        confidence = 0.0
        reasoning = "AI suggested an unlisted department or category ID; rejected by safety filter for manual admin triage."
        routing_decision = "MANUAL_TRIAGE"
    else:
        # Determine routing decision threshold
        if confidence >= AUTO_ROUTE_CONFIDENCE_THRESHOLD:
            routing_decision = "AUTO_ROUTE"
        elif confidence >= SUGGEST_ONLY_CONFIDENCE_THRESHOLD:
            routing_decision = "SUGGEST_ONLY"
        else:
            routing_decision = "MANUAL_TRIAGE"

    cat_changed = False
    if payload.citizen_selected_category:
        cat_changed = sug_cat_id != payload.citizen_selected_category

    duration = round((time.time() - start_time) * 1000, 2)
    logger.info(
        f"Completed route-complaint for complaint_id={payload.complaint_id} in {duration}ms. "
        f"Decision={routing_decision}, Confidence={confidence}"
    )

    return RouteComplaintResponse(
        suggested_category_id=sug_cat_id,
        suggested_department_id=sug_dept_id,
        suggested_priority=sug_priority,
        confidence_score=confidence,
        category_changed_from_citizen=cat_changed,
        reasoning=reasoning,
        routing_decision=routing_decision,
    )
