from __future__ import annotations

import asyncio
import logging

try:
    from google import genai
    from google.genai import types

    try:
        from google.genai import errors as genai_errors
    except ImportError:
        genai_errors = None
except ImportError:
    genai = None
    types = None
    genai_errors = None

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.ocr.extraction import EXTRACTION_PROMPT, parse_extraction_response
from app.ocr.models import ExtractedContactInfo
from app.ocr.providers.base import (
    VisionProvider,
    VisionRateLimitError,
    VisionTimeoutError,
    VisionTransportError,
)

logger = logging.getLogger(__name__)


class GeminiVisionProvider(VisionProvider):
    name = "gemini_vision"
    model = GEMINI_MODEL

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.model = model or GEMINI_MODEL
        if genai is None:
            raise ImportError("google-genai is required for GeminiVisionProvider")
        self._client = genai.Client(api_key=api_key or GEMINI_API_KEY)
        if self.model != GEMINI_MODEL:
            logger.info("OCR: Using custom Gemini vision model: %s (default: %s)", self.model, GEMINI_MODEL)

    def _map_exception(self, exc: Exception) -> None:
        if isinstance(exc, TimeoutError):
            raise VisionTimeoutError(str(exc)) from exc
        if genai_errors is not None:
            if isinstance(exc, getattr(genai_errors, "ServerError", ())):
                raise VisionTransportError(str(exc)) from exc
            if isinstance(exc, getattr(genai_errors, "ClientError", ())):
                code = getattr(exc, "code", None)
                if code == 429:
                    raise VisionRateLimitError(str(exc)) from exc
                raise VisionTransportError(str(exc)) from exc
        name = type(exc).__name__.lower()
        if "connection" in name or "timeout" in name:
            raise VisionTimeoutError(str(exc)) from exc
        raise VisionTransportError(str(exc)) from exc

    async def extract_contact_info(self, image_bytes: bytes, timeout: int = 20) -> ExtractedContactInfo:
        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
            EXTRACTION_PROMPT,
        ]
        try:
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=self.model,
                    contents=contents,
                ),
                timeout=timeout,
            )
        except Exception as exc:
            self._map_exception(exc)

        raw_text = response.text or ""
        return parse_extraction_response(raw_text)
