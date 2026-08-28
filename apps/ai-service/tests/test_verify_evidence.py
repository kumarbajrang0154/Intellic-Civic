import base64
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import pytest

from main import app

client = TestClient(app)

# 1x1 transparent GIF base64 string
DUMMY_IMAGE_BASE64 = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

@patch("main.GEMINI_API_KEY", "mock_valid_key_for_tests")
@patch("main.analyze_with_gemini")
def test_verify_evidence_success_shape(mock_analyze):
    mock_analyze.return_value = {
        "is_relevant": True,
        "matches_category": True,
        "confidence_score": 0.92,
        "detected_objects": ["pothole", "asphalt"],
        "quality_flags": [],
        "reasoning": "Photo clearly shows a severe road pothole.",
    }

    payload = {
        "complaint_id": "test-complaint-101",
        "complaint_category": "POTHOLE",
        "complaint_description": "Large pothole in middle of road.",
        "image_url": DUMMY_IMAGE_BASE64,
    }

    response = client.post("/ai/verify-evidence", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_relevant"] is True
    assert data["matches_category"] is True
    assert data["confidence_score"] == 0.92
    assert data["recommendation"] == "AUTO_APPROVE"
    assert "pothole" in data["detected_objects"]

@patch("main.GEMINI_API_KEY", "mock_valid_key_for_tests")
@patch("google.generativeai.GenerativeModel")
@patch("google.generativeai.configure")
def test_verify_evidence_malformed_json_fallback(mock_configure, mock_model_class):
    mock_model_instance = MagicMock()
    mock_model_class.return_value = mock_model_instance
    # Return non-JSON response from Gemini
    mock_response = MagicMock()
    mock_response.text = "NOT_A_JSON_STRING"
    mock_model_instance.generate_content.return_value = mock_response

    payload = {
        "complaint_id": "test-complaint-102",
        "complaint_category": "GARBAGE",
        "complaint_description": "Overflowing trash bin.",
        "image_url": DUMMY_IMAGE_BASE64,
    }

    response = client.post("/ai/verify-evidence", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["recommendation"] == "MANUAL_REVIEW"
    assert "malformed_ai_response" in data["quality_flags"]

def test_verify_evidence_invalid_image_url():
    payload = {
        "complaint_id": "test-complaint-103",
        "complaint_category": "STREETLIGHT",
        "complaint_description": "Flickering light.",
        "image_url": "http://invalid-domain-that-does-not-exist-12345.com/nonexistent.jpg",
    }

    response = client.post("/ai/verify-evidence", json=payload)
    assert response.status_code == 422
    assert "Unable to fetch or decode image" in response.json()["detail"]
