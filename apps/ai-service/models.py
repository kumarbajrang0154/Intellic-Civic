from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class VerifyEvidenceRequest(BaseModel):
    complaint_id: str = Field(..., description="Unique ID of the complaint")
    complaint_category: str = Field(..., description="Category of the complaint e.g. POTHOLE, GARBAGE")
    complaint_description: str = Field(..., description="Citizen's description of the civic issue")
    image_url: str = Field(..., description="Publicly accessible URL or base64 data string of the evidence image")

class VerifyEvidenceResponse(BaseModel):
    is_relevant: Optional[bool] = Field(None, description="Does photo plausibly show described civic issue?")
    matches_category: Optional[bool] = Field(None, description="Does photo visually match claimed category?")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
    detected_objects: List[str] = Field(default_factory=list, description="List of objects detected in image")
    quality_flags: List[str] = Field(default_factory=list, description="Quality flags e.g. blurry, dark, no_issue")
    reasoning: str = Field(..., description="1-2 sentence explanation of AI assessment")
    recommendation: Literal["AUTO_APPROVE", "MANUAL_REVIEW", "AUTO_FLAG"] = Field(
        ..., description="Final recommendation decision"
    )
