from __future__ import annotations

import io

import pytest
from PIL import Image

from app.ocr.extraction import (
    extract_email_from_text,
    extract_phone_from_text,
    parse_extraction_response,
)
from app.ocr.models import ExtractedContactInfo, FieldConfidence
from app.ocr.preprocessing import preprocess_image


class TestParseExtractionResponse:
    def test_valid_json(self):
        raw = '{"firstName": {"value": "Alice", "confidence": "high"}, "email": {"value": "a@b.com", "confidence": "high"}}'
        result = parse_extraction_response(raw)
        assert result.firstName is not None
        assert result.firstName.value == "Alice"
        assert result.firstName.confidence == FieldConfidence.HIGH

    def test_json_in_code_fences(self):
        raw = '```json\n{"lastName": {"value": "Dupont", "confidence": "medium"}}\n```'
        result = parse_extraction_response(raw)
        assert result.lastName is not None
        assert result.lastName.value == "Dupont"

    def test_null_fields(self):
        raw = '{"firstName": {"value": null, "confidence": "low"}, "email": null}'
        result = parse_extraction_response(raw)
        assert result.firstName is None
        assert result.email is None

    def test_empty_response(self):
        with pytest.raises(ValueError, match="Empty"):
            parse_extraction_response("")

    def test_invalid_json(self):
        with pytest.raises(ValueError, match="Invalid JSON"):
            parse_extraction_response("not json at all")

    def test_non_object_json(self):
        with pytest.raises(ValueError, match="not a JSON object"):
            parse_extraction_response('["not", "an", "object"]')


class TestExtractEmail:
    def test_valid_email(self):
        assert extract_email_from_text("Contact: alice@test.com") == "alice@test.com"

    def test_no_email(self):
        assert extract_email_from_text("No email here") is None


class TestExtractPhone:
    def test_valid_phone(self):
        result = extract_phone_from_text("Tel: +33 612 345 678")
        assert result is not None
        assert "612" in result

    def test_valid_phone_dashes(self):
        result = extract_phone_from_text("Call: 06-12-34-56-78")
        assert result is not None

    def test_no_phone(self):
        assert extract_phone_from_text("No phone") is None


class TestPreprocessImage:
    def test_valid_jpeg(self):
        img = Image.new("RGB", (100, 100), color="red")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        result = preprocess_image(buf.getvalue())
        assert len(result) > 0
        reloaded = Image.open(io.BytesIO(result))
        assert reloaded.mode == "RGB"

    def test_rgba_converts_to_rgb(self):
        img = Image.new("RGBA", (100, 100), color=(255, 0, 0, 128))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        result = preprocess_image(buf.getvalue())
        reloaded = Image.open(io.BytesIO(result))
        assert reloaded.mode == "RGB"

    def test_large_image_resizes(self):
        img = Image.new("RGB", (4000, 3000), color="blue")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        result = preprocess_image(buf.getvalue(), max_size=2048)
        reloaded = Image.open(io.BytesIO(result))
        assert max(reloaded.size) <= 2048

    def test_garbage_returns_original(self):
        garbage = b"not an image at all"
        result = preprocess_image(garbage)
        assert result == garbage
