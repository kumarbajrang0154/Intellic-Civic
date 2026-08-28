from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import pytest

from main import app

client = TestClient(app)

SAMPLE_CATEGORIES = [
    {"id": "cat-water-pipe", "name": "Water Pipe Damage"},
    {"id": "cat-pothole", "name": "Pothole Repair"},
]

SAMPLE_DEPARTMENTS = [
    {"id": "dept-water", "name": "Water & Sanitation", "handled_categories": ["cat-water-pipe"]},
    {"id": "dept-roads", "name": "Public Works & Roads", "handled_categories": ["cat-pothole"]},
]

@patch("main.GEMINI_API_KEY", "mock_valid_key_for_tests")
@patch("main.route_with_gemini")
def test_route_complaint_auto_route_success(mock_route):
    mock_route.return_value = {
        "suggested_category_id": "cat-water-pipe",
        "suggested_department_id": "dept-water",
        "suggested_priority": "HIGH",
        "confidence_score": 0.88,
        "reasoning": "Description matches water pipe burst.",
    }

    payload = {
        "complaint_id": "route-test-1",
        "title": "Burst Pipe Leaking Water",
        "description": "Clean water is flooding the street from a broken main pipe.",
        "citizen_selected_category": "cat-pothole",
        "available_categories": SAMPLE_CATEGORIES,
        "available_departments": SAMPLE_DEPARTMENTS,
    }

    response = client.post("/ai/route-complaint", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["routing_decision"] == "AUTO_ROUTE"
    assert data["suggested_category_id"] == "cat-water-pipe"
    assert data["suggested_department_id"] == "dept-water"
    assert data["suggested_priority"] == "HIGH"
    assert data["confidence_score"] == 0.88
    assert data["category_changed_from_citizen"] is True

@patch("main.GEMINI_API_KEY", "mock_valid_key_for_tests")
@patch("main.route_with_gemini")
def test_route_complaint_hallucinated_id_rejection(mock_route):
    # Gemini returns hallucinated non-existent IDs
    mock_route.return_value = {
        "suggested_category_id": "NON_EXISTENT_CAT_ID",
        "suggested_department_id": "NON_EXISTENT_DEPT_ID",
        "suggested_priority": "HIGH",
        "confidence_score": 0.99,
        "reasoning": "Hallucinated recommendation.",
    }

    payload = {
        "complaint_id": "route-test-2",
        "title": "Damaged Road",
        "description": "Pothole on asphalt.",
        "citizen_selected_category": None,
        "available_categories": SAMPLE_CATEGORIES,
        "available_departments": SAMPLE_DEPARTMENTS,
    }

    response = client.post("/ai/route-complaint", json=payload)
    assert response.status_code == 200
    data = response.json()
    # Hard safety check must reject hallucinated IDs and fall back to MANUAL_TRIAGE
    assert data["routing_decision"] == "MANUAL_TRIAGE"
    assert data["confidence_score"] == 0.0
    assert "rejected by safety filter" in data["reasoning"]

@patch("main.GEMINI_API_KEY", "mock_valid_key_for_tests")
@patch("main.route_with_gemini")
def test_route_complaint_suggest_only_threshold(mock_route):
    # Confidence 0.60 is between 0.40 and 0.75 -> SUGGEST_ONLY
    mock_route.return_value = {
        "suggested_category_id": "cat-pothole",
        "suggested_department_id": "dept-roads",
        "suggested_priority": "MEDIUM",
        "confidence_score": 0.60,
        "reasoning": "Plausible road issue, needs staff confirmation.",
    }

    payload = {
        "complaint_id": "route-test-3",
        "title": "Small crack on street",
        "description": "Small crack forming on street curb.",
        "citizen_selected_category": "cat-pothole",
        "available_categories": SAMPLE_CATEGORIES,
        "available_departments": SAMPLE_DEPARTMENTS,
    }

    response = client.post("/ai/route-complaint", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["routing_decision"] == "SUGGEST_ONLY"
    assert data["confidence_score"] == 0.60
    assert data["category_changed_from_citizen"] is False

@patch("main.GEMINI_API_KEY", "mock_valid_key_for_tests")
@patch("google.generativeai.GenerativeModel")
@patch("google.generativeai.configure")
def test_route_complaint_malformed_json_fallback(mock_configure, mock_model_class):
    mock_instance = MagicMock()
    mock_model_class.return_value = mock_instance
    mock_resp = MagicMock()
    mock_resp.text = "MALFORMED_NON_JSON_RESPONSE"
    mock_instance.generate_content.return_value = mock_resp

    payload = {
        "complaint_id": "route-test-4",
        "title": "Ambiguous complaint",
        "description": "Something is wrong somewhere.",
        "citizen_selected_category": None,
        "available_categories": SAMPLE_CATEGORIES,
        "available_departments": SAMPLE_DEPARTMENTS,
    }

    response = client.post("/ai/route-complaint", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["routing_decision"] == "MANUAL_TRIAGE"
    assert data["confidence_score"] == 0.0
