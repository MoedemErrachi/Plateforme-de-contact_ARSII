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


def extract_fence_content(text: str) -> str | None:
    """Renvoie le contenu du premier bloc ```...``` (éventuellement taggé `json`), dépouillé."""
    start = text.find("```")
    if start == -1:
        return None
    inner = text[start + 3 :].lstrip()
    if inner.startswith("json"):
        inner = inner[4:].lstrip()
    end = inner.find("```")
    if end == -1:
        return None
    return inner[:end].strip()


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
    fence_text = extract_fence_content(text)
    if fence_text is not None:
        text = fence_text
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


_EMAIL_LOCAL_CHARS = frozenset(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._%+-"
)
_EMAIL_DOMAIN_CHARS = frozenset(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"
)
_EMAIL_TLD_CHARS = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")


def _scan_domain(text: str, start: int) -> tuple[list[str], int] | None:
    """Scanne les labels séparés par des points depuis `start`; returns (labels, end)."""
    pos = start
    labels: list[str] = []
    while pos < len(text):
        if text[pos] not in _EMAIL_DOMAIN_CHARS:
            break
        label_start = pos
        while pos < len(text) and text[pos] in _EMAIL_DOMAIN_CHARS:
            pos += 1
        labels.append(text[label_start:pos])
        if (
            pos < len(text)
            and text[pos] == "."
            and pos + 1 < len(text)
            and text[pos + 1] in _EMAIL_DOMAIN_CHARS
        ):
            pos += 1
            continue
        break
    return (labels, pos) if labels else None


def extract_email_from_text(text: str) -> str | None:
    """Renvoie la première adresse `local@domaine.tld` (TLD >= 2 lettres) trouvée."""
    for at in (i for i, ch in enumerate(text) if ch == "@"):
        local_end = at
        while local_end > 0 and text[local_end - 1] in _EMAIL_LOCAL_CHARS:
            local_end -= 1
        if local_end == at:
            continue
        scanned = _scan_domain(text, at + 1)
        if scanned is None:
            continue
        labels, domain_end = scanned
        if len(labels) < 2:
            continue
        tld = labels[-1]
        if len(tld) < 2 or not all(ch in _EMAIL_TLD_CHARS for ch in tld):
            continue
        return text[local_end:domain_end]
    return None


def extract_phone_from_text(text: str) -> str | None:
    match = re.search(r"(?:\+?\d{1,4}\s??)?(?:\(\d{2,4}\))?[\d\s-]{5,}", text)
    return match.group(0).strip() if match else None
