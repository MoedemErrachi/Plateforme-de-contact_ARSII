from __future__ import annotations

from abc import ABC, abstractmethod

from app.ocr.models import ExtractedContactInfo


class VisionProviderError(Exception):
    status_code: int | None = None


class VisionRateLimitError(VisionProviderError):
    status_code = 429


class VisionTimeoutError(VisionProviderError):
    status_code = None


class VisionTransportError(VisionProviderError):
    status_code = None


class VisionServiceUnavailableError(Exception):
    status_code = 503

    def __init__(self, detail: str = "Tous les fournisseurs vision sont indisponibles."):
        self.detail = detail
        super().__init__(detail)


VISION_TIMEOUT_SECONDS = 20


class VisionProvider(ABC):
    name: str = "base"
    model: str = ""

    @abstractmethod
    async def extract_contact_info(self, image_bytes: bytes) -> ExtractedContactInfo:  # pragma: no cover
        ...
