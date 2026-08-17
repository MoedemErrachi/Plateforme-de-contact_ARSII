from __future__ import annotations

import logging

from app.ocr.models import ExtractedContactInfo
from app.ocr.providers.base import (
    VisionProvider,
    VisionProviderError,
    VisionServiceUnavailableError,
)

logger = logging.getLogger(__name__)

VISION_PIVOT_EXCEPTIONS = (VisionProviderError,)


class VisionRouter:
    def __init__(self, providers: list[VisionProvider]):
        self.providers = providers

    async def extract(self, image_bytes: bytes) -> tuple[ExtractedContactInfo, str]:
        failures: list[str] = []
        for provider in self.providers:
            try:
                result = await provider.extract_contact_info(image_bytes)
                return result, provider.name
            except VisionProviderError as exc:
                logger.warning(
                    "OCR: provider '%s' failed, pivoting to next: %s",
                    provider.name,
                    exc,
                )
                failures.append(f"{provider.name}: {exc}")
                continue
        if not failures:
            raise VisionServiceUnavailableError("Aucun fournisseur vision n'est configuré.")
        raise VisionServiceUnavailableError(
            "Tous les fournisseurs vision ont échoué: " + "; ".join(failures)
        )
