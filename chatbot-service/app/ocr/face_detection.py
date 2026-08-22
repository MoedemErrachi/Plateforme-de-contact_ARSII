from __future__ import annotations

import io
import logging
import uuid
from pathlib import Path

from PIL import Image

logger = logging.getLogger(__name__)


def detect_and_crop_face(image_bytes: bytes, upload_dir: str | None = None) -> str | None:
    """Detect face using mediapipe, crop, save to upload_dir. Returns relative URL or None."""
    if upload_dir is None:
        upload_dir = str(Path(__file__).resolve().parents[3] / "uploads" / "contact-photos")
    try:
        import mediapipe as mp
    except ImportError:
        logger.debug("OCR: mediapipe not installed, skipping face detection")
        return None

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        w, h = img.size

        with mp.solutions.face_detection.FaceDetection(
            model_selection=1, min_detection_confidence=0.5
        ) as face_detection:
            import numpy as np

            results = face_detection.process(np.array(img))
            if not results.detections:
                return None

            detection = results.detections[0]
            bbox = detection.location_data.relative_bounding_box
            x1 = max(0, int(bbox.xmin * w))
            y1 = max(0, int(bbox.ymin * h))
            x2 = min(w, int((bbox.xmin + bbox.width) * w))
            y2 = min(h, int((bbox.ymin + bbox.height) * h))

            padding_x = int((x2 - x1) * 0.15)
            padding_y = int((y2 - y1) * 0.15)
            x1 = max(0, x1 - padding_x)
            y1 = max(0, y1 - padding_y)
            x2 = min(w, x2 + padding_x)
            y2 = min(h, y2 + padding_y)

            face_img = img.crop((x1, y1, x2, y2))

            path = Path(upload_dir)
            path.mkdir(parents=True, exist_ok=True)
            filename = f"{uuid.uuid4().hex}.jpg"
            face_img.save(path / filename, format="JPEG", quality=90)
            return f"/uploads/contact-photos/{filename}"
    except Exception:
        logger.debug("OCR: Face detection failed", exc_info=True)
        return None
