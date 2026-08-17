from __future__ import annotations

import logging
import os
import traceback

from fastapi import APIRouter, File, Header, HTTPException, Request, UploadFile, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.dependencies import limiter
from app.exceptions import ServiceUnavailableError
from app.ocr.face_detection import detect_and_crop_face
from app.ocr.models import OcrExtractionResponse
from app.ocr.preprocessing import preprocess_image
from app.ocr.providers.base import VisionServiceUnavailableError
from app.ocr.vision_router import VisionRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ocr", tags=["ocr"])

ocr_limiter = Limiter(key_func=get_remote_address)

OCR_RATE_LIMIT = os.getenv("OCR_RATE_LIMIT", "10/minute")
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/tiff", "application/pdf"}

_vision_router: VisionRouter | None = None


def get_vision_router() -> VisionRouter:
    global _vision_router
    if _vision_router is not None:
        return _vision_router
    from app.ocr.providers.gemini_vision_provider import GeminiVisionProvider
    from app.ocr.providers.mistral_vision_provider import MistralVisionProvider
    from app.ocr.providers.tesseract_fallback import TesseractFallbackProvider
    from app.config import GEMINI_API_KEY, MISTRAL_API_KEY

    providers = []
    if MISTRAL_API_KEY:
        try:
            providers.append(MistralVisionProvider())
            logger.info("OCR: MistralVisionProvider registered")
        except Exception:
            logger.warning("OCR: Failed to init MistralVisionProvider", exc_info=True)
    if GEMINI_API_KEY:
        try:
            providers.append(GeminiVisionProvider())
            logger.info("OCR: GeminiVisionProvider registered")
        except Exception:
            logger.warning("OCR: Failed to init GeminiVisionProvider", exc_info=True)
    providers.append(TesseractFallbackProvider())
    _vision_router = VisionRouter(providers)
    logger.info(
        "OCR: VisionRouter ready with %d providers: %s",
        len(providers),
        [p.name for p in providers],
    )
    return _vision_router


@router.post("/extract", response_model=OcrExtractionResponse, response_model_exclude_none=True)
@ocr_limiter.limit(OCR_RATE_LIMIT)
async def extract_from_image(
    request: Request,
    image: UploadFile = File(...),
    authorization: str = Header(None),
) -> OcrExtractionResponse:
    try:
        if not authorization:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing Authorization header",
            )
        if not authorization.lower().startswith("bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Authorization header. Expected 'Bearer <token>'",
            )
        token = authorization[7:].strip()
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Empty Bearer token",
            )

        if image.content_type and image.content_type not in ALLOWED_MIME:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported file type: {image.content_type}. Accepted: {', '.join(sorted(ALLOWED_MIME))}",
            )

        image_bytes = await image.read()
        if len(image_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large: {len(image_bytes)} bytes (max {MAX_UPLOAD_BYTES})",
            )
        if len(image_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Uploaded file is empty",
            )

        processed = preprocess_image(image_bytes)
        router_instance = get_vision_router()
        extracted, provider_name = await router_instance.extract(processed)

        photo_url = detect_and_crop_face(processed)

        return OcrExtractionResponse(
            extracted=extracted,
            photoUrl=photo_url,
            sourceProvider=provider_name,
        )
    except HTTPException:
        raise
    except VisionServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=exc.detail)
    except Exception as exc:
        logger.error("OCR extraction error: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR extraction failed: {str(exc)}",
        )
