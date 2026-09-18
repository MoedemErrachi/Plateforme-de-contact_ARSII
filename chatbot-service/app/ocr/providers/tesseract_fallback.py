from __future__ import annotations

import asyncio
import logging

from app.ocr.extraction import (
    extract_email_from_text,
    extract_phone_from_text,
)
from app.ocr.models import ExtractedContactInfo, ExtractedField, FieldConfidence
from app.ocr.providers.base import VISION_TIMEOUT_SECONDS, VisionProvider

logger = logging.getLogger(__name__)


class TesseractFallbackProvider(VisionProvider):
    name = "tesseract"
    model = "local"

    def __init__(self) -> None:
        try:
            import pytesseract  # noqa: F401
        except ImportError:
            logger.warning(
                "OCR: pytesseract not installed — TesseractFallbackProvider will fail. "
                "Install with: pip install pytesseract"
            )

    async def extract_contact_info(self, image_bytes: bytes) -> ExtractedContactInfo:
        loop = asyncio.get_event_loop()
        async with asyncio.timeout(VISION_TIMEOUT_SECONDS):
            raw_text = await loop.run_in_executor(None, self._extract_text, image_bytes)
        email = extract_email_from_text(raw_text)
        phone = extract_phone_from_text(raw_text)
        return ExtractedContactInfo(
            email=ExtractedField(value=email, confidence=FieldConfidence.LOW) if email else None,
            phone=ExtractedField(value=phone, confidence=FieldConfidence.LOW) if phone else None,
        )

    @staticmethod
    def _extract_text(image_bytes: bytes) -> str:
        try:
            from io import BytesIO

            import pytesseract
            from PIL import Image

            img = Image.open(BytesIO(image_bytes))
            return pytesseract.image_to_string(img)
        except Exception:
            logger.warning("OCR: Tesseract extraction failed", exc_info=True)
            return ""
