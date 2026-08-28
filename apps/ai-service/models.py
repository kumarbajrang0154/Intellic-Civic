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

class CategoryItem(BaseModel):
    id: str = Field(..., description="Category UUID")
    name: str = Field(..., description="Category name e.g. Pothole Repair")

class DepartmentItem(BaseModel):
    id: str = Field(..., description="Department UUID")
    name: str = Field(..., description="Department name e.g. Public Works Department")
    handled_categories: List[str] = Field(default_factory=list, description="Category IDs handled by this department")

class RouteComplaintRequest(BaseModel):
    complaint_id: str = Field(..., description="Unique ID of the complaint")
    title: str = Field(..., description="Complaint title")
    description: str = Field(..., description="Complaint description")
    citizen_selected_category: Optional[str] = Field(None, description="Category ID selected by citizen at creation, if any")
    available_categories: List[CategoryItem] = Field(..., description="List of valid categories available in database")
    available_departments: List[DepartmentItem] = Field(..., description="List of valid departments available in database")

class RouteComplaintResponse(BaseModel):
    suggested_category_id: str = Field(..., description="Suggested category ID from available_categories")
    suggested_department_id: str = Field(..., description="Suggested department ID from available_departments")
    suggested_priority: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = Field(..., description="Suggested priority level")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Routing confidence score")
    category_changed_from_citizen: bool = Field(..., description="True if AI suggested category differs from citizen selection")
    reasoning: str = Field(..., description="Concise explanation for staff visibility")
    routing_decision: Literal["AUTO_ROUTE", "SUGGEST_ONLY", "MANUAL_TRIAGE"] = Field(..., description="Final routing decision")
