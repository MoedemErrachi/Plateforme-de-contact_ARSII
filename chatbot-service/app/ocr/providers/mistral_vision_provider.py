from __future__ import annotations

import asyncio
import base64
import logging

try:
    from mistralai.client import Mistral
    from mistralai.client.errors import SDKError as MistralHTTPError
    from mistralai.client.errors import NoResponseError as MistralConnectionError
except ImportError:
    from mistralai import Mistral

    try:
        from mistralai.exceptions import MistralAPIStatusException as MistralHTTPError
        from mistralai.exceptions import MistralConnectionError
    except ImportError:
        from mistralai.exceptions import MistralAPIException as MistralHTTPError

        class MistralConnectionError(ConnectionError):
            pass

from app.config import MISTRAL_API_KEY
from app.ocr.extraction import EXTRACTION_PROMPT, parse_extraction_response
from app.ocr.models import ExtractedContactInfo
from app.ocr.providers.base import (
    VisionProvider,
    VisionRateLimitError,
    VisionTimeoutError,
    VisionTransportError,
)

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "mistral-small-latest"


class MistralVisionProvider(VisionProvider):
    name = "mistral_vision"
    model = DEFAULT_MODEL

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.model = model or DEFAULT_MODEL
        self._client = Mistral(api_key=api_key or MISTRAL_API_KEY)
        if self.model != DEFAULT_MODEL:
            logger.info("OCR: Using custom Mistral vision model: %s (default: %s)", self.model, DEFAULT_MODEL)

    async def extract_contact_info(self, image_bytes: bytes, timeout: int = 20) -> ExtractedContactInfo:
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": EXTRACTION_PROMPT},
                    {"type": "image_url", "image_url": f"data:image/jpeg;base64,{b64}"},
                ],
            }
        ]
        try:
            response = await asyncio.wait_for(
                self._client.chat.complete_async(
                    model=self.model,
                    messages=messages,
                    temperature=0,
                ),
                timeout=timeout,
            )
        except MistralHTTPError as exc:
            raw = getattr(exc, "raw_response", None)
            status = getattr(raw, "status_code", None) or getattr(exc, "status_code", None)
            if status == 429:
                raise VisionRateLimitError(str(exc)) from exc
            raise VisionTransportError(str(exc)) from exc
        except (MistralConnectionError, TimeoutError) as exc:
            raise VisionTimeoutError(str(exc)) from exc
        except Exception as exc:
            name = type(exc).__name__.lower()
            if "connection" in name or "timeout" in name:
                raise VisionTimeoutError(str(exc)) from exc
            raise VisionTransportError(str(exc)) from exc

        raw_text = response.choices[0].message.content or ""
        return parse_extraction_response(raw_text)
