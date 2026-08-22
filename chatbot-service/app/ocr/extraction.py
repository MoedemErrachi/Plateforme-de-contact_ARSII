from __future__ import annotations

import json
import logging
import re

from app.ocr.models import ExtractedContactInfo, ExtractedField, FieldConfidence

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """Extract the following fields from this business card image. Return ONLY a JSON object with this exact structure (no markdown, no code fences):

{
  "firstName": {"value": "...", "confidence": "high|medium|low"},
  "lastName": {"value": "...", "confidence": "high|medium|low"},
  "email": {"value": "...", "confidence": "high|medium|low"},
  "phone": {"value": "...", "confidence": "high|medium|low"},
  "affiliation": {"value": "...", "confidence": "high|medium|low"},
  "function": {"value": "...", "confidence": "high|medium|low"},
  "city": {"value": "...", "confidence": "high|medium|low"},
  "countryOfOrigin": {"value": "...", "confidence": "high|medium|low"}
}

Rules:
- If a field is not visible or unreadable, set value to null.
- confidence "high" = clearly legible text, "medium" = partially legible, "low" = guessed or OCR artifact.
- Return ONLY the JSON object, nothing else.
- Do not include a "photoUrl" field."""

CONFIDENCE_MAP = {
    "high": FieldConfidence.HIGH,
    "medium": FieldConfidence.MEDIUM,
    "low": FieldConfidence.LOW,
}


def _make_field(raw: dict | None) -> ExtractedField | None:
    if not raw or not isinstance(raw, dict):
        return None
    value = raw.get("value")
    if value is None:
        return None
    conf_str = raw.get("confidence", "low")
    confidence = CONFIDENCE_MAP.get(conf_str, FieldConfidence.LOW)
    return ExtractedField(value=str(value), confidence=confidence)


def parse_extraction_response(raw_text: str) -> ExtractedContactInfo:
    """Parse LLM JSON output into ExtractedContactInfo. Handles markdown code fences."""
    if not raw_text:
        raise ValueError("Empty extraction response")
    text = raw_text.strip()
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in extraction response: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("Extraction response is not a JSON object")
    fields = {}
    for key in ("firstName", "lastName", "email", "phone", "affiliation", "function", "city", "countryOfOrigin"):
        fields[key] = _make_field(data.get(key))
    return ExtractedContactInfo(**fields)


def extract_email_from_text(text: str) -> str | None:
    match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
    return match.group(0) if match else None


def extract_phone_from_text(text: str) -> str | None:
    match = re.search(r"(?:\+?[0-9]{1,4}[\s\-]?)?(?:\(?\d{2,4}\)?[\s\-]?)?\d[\d\s\-]{5,}", text)
    return match.group(0).strip() if match else None
