# ==============================================================================
# PURPOSE: Unit tests for EVE AI Response Validation Layer.
# DATA FLOW: Passes text blocks to AIValidationService and verifies metrics,
#            citations, rejections, and confidence classifications.
# ==============================================================================

import pytest
from app.services.ai_validation_service import AIValidationService


def test_validation_verified_classification():
    """
    Verifies that responses containing metrics and citations are classified as "Verified".
    """
    text = "We have 10 items in stock for Product #123."
    keys = ["Product #123", "Supplier Alpha"]
    
    res = AIValidationService.validate_response(text, keys)
    assert res["valid"] is True
    assert res["confidence_classification"] == "Verified"
    assert "10 items" in res["metrics_found"]
    assert "Product #123" in res["citations_found"]


def test_validation_partially_verified_classification():
    """
    Verifies that responses containing metrics but lacking citation keys are "Partially Verified".
    """
    text = "We have 10 items in stock."
    keys = ["Product #123"]
    
    res = AIValidationService.validate_response(text, keys)
    assert res["valid"] is True
    assert res["confidence_classification"] == "Partially Verified"


def test_validation_ai_generated_classification():
    """
    Verifies that narrative text with no operational metrics is classified as "AI Generated".
    """
    text = "The warehouse operations look stable and standard today."
    keys = ["Product #123"]
    
    res = AIValidationService.validate_response(text, keys)
    assert res["valid"] is True
    assert res["confidence_classification"] == "AI Generated"


def test_validation_rejection_on_unavailable_data():
    """
    Verifies that referencing an unretrieved database ID triggers validation failure.
    """
    text = "Ordering 500 units of Product #999 from Supplier Alpha."
    keys = ["Product #123", "Supplier Alpha"]  # Product #999 is missing from retrieval list
    
    res = AIValidationService.validate_response(text, keys)
    assert res["valid"] is False
    assert "rejection_reason" in res
    assert "999" in res["rejection_reason"]
