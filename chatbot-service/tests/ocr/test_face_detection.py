from __future__ import annotations

import sys
import types

import pytest

from app.ocr.face_detection import detect_and_crop_face


def _png_bytes() -> bytes:
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (8, 8), color="blue").save(buf, format="PNG")
    return buf.getvalue()


class TestFaceDetection:
    def test_mediapipe_missing_returns_none(self, monkeypatch):
        monkeypatch.setitem(sys.modules, "mediapipe", None)
        assert detect_and_crop_face(_png_bytes()) is None

    def test_no_detections_returns_none(self, monkeypatch):
        mp_fake = _mediapipe_fake(detections=[])
        monkeypatch.setitem(sys.modules, "mediapipe", mp_fake)
        assert detect_and_crop_face(_png_bytes()) is None

    def test_detection_saves_photo(self, monkeypatch, tmp_path):
        bbox = types.SimpleNamespace(xmin=0.2, ymin=0.2, width=0.5, height=0.5)
        mp_fake = _mediapipe_fake(
            detections=[types.SimpleNamespace(location_data=types.SimpleNamespace(relative_bounding_box=bbox))]
        )
        monkeypatch.setitem(sys.modules, "mediapipe", mp_fake)
        url = detect_and_crop_face(_png_bytes(), upload_dir=str(tmp_path))
        assert url.startswith("/uploads/contact-photos/")
        saved = list(tmp_path.glob("*.jpg"))
        assert len(saved) == 1
        assert saved[0].stat().st_size > 0

    def test_crop_out_of_bounds_clamped(self, monkeypatch, tmp_path):
        bbox = types.SimpleNamespace(xmin=-0.5, ymin=-0.5, width=2.0, height=2.0)
        mp_fake = _mediapipe_fake(
            detections=[types.SimpleNamespace(location_data=types.SimpleNamespace(relative_bounding_box=bbox))]
        )
        monkeypatch.setitem(sys.modules, "mediapipe", mp_fake)
        url = detect_and_crop_face(_png_bytes(), upload_dir=str(tmp_path))
        assert url is not None

    def test_processing_exception_returns_none(self, monkeypatch, tmp_path):
        class _BoomFaceDetection:
            def __init__(self, *args, **kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def process(self, array):
                raise RuntimeError("mediapipe failed")

        mp_fake = types.SimpleNamespace(
            solutions=types.SimpleNamespace(face_detection=types.SimpleNamespace(FaceDetection=_BoomFaceDetection))
        )
        monkeypatch.setitem(sys.modules, "mediapipe", mp_fake)
        assert detect_and_crop_face(_png_bytes(), upload_dir=str(tmp_path)) is None


def _mediapipe_fake(detections):
    class _FaceDetection:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def process(self, array):
            return types.SimpleNamespace(detections=detections)

    return types.SimpleNamespace(
        solutions=types.SimpleNamespace(face_detection=types.SimpleNamespace(FaceDetection=_FaceDetection))
    )