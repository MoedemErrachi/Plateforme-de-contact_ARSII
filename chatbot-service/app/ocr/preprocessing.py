from __future__ import annotations

import io
import logging

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

MAX_DIMENSION = 2048
JPEG_QUALITY = 85


def preprocess_image(image_bytes: bytes, max_size: int = MAX_DIMENSION) -> bytes:
    """Auto-orient, resize, convert to RGB JPEG. Returns original bytes on failure."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img) or img
        if img.mode not in ("RGB",):
            img = img.convert("RGB")
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=JPEG_QUALITY)
        return buf.getvalue()
    except Exception:
        logger.warning("OCR preprocessing failed, returning original bytes", exc_info=True)
        return image_bytes
