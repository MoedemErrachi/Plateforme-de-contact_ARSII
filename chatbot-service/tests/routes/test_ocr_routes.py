from __future__ import annotations

import uuid

import jwt as pyjwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.ocr.models import ExtractedContactInfo, ExtractedField
from app.ocr.providers import gemini_vision_provider, mistral_vision_provider
from app.ocr.providers.base import VisionServiceUnavailableError
from app.routes import ocr_routes
from app.routes.ocr_routes import get_vision_router, router as ocr_router

SECRET = "test-secret"


def _token() -> str:
    return pyjwt.encode({"sub": "u1"}, SECRET, algorithm="HS256")


def _png_bytes() -> bytes:
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (4, 4), color="green").save(buf, format="PNG")
    return buf.getvalue()


class _FakeVisionRouter:
    def __init__(self, result=None, error=None):
        self.result = result or (ExtractedContactInfo(), "tesseract")
        self.error = error

    async def extract(self, image_bytes):
        if self.error is not None:
            raise self.error
        return self.result


def _make_client():
    app = FastAPI()
    app.include_router(ocr_router)
    return TestClient(app)


def _post_image(content_type="image/png", data=None, headers=None):
    client = _make_client()
    return client.post(
        "/api/ocr/extract",
        files={"image": ("test.png", data if data is not None else _png_bytes(), content_type)},
        headers=headers,
    )


class TestGetVisionRouter:
    def test_caches_instance(self, monkeypatch):
        monkeypatch.setattr(ocr_routes, "_vision_router", None)
        monkeypatch.setattr("app.config.MISTRAL_API_KEY", "")
        monkeypatch.setattr("app.config.GEMINI_API_KEY", "")
        router = get_vision_router()
        assert get_vision_router() is router
        assert [p.name for p in router.providers] == ["tesseract"]

    def test_registers_mistral_and_gemini(self, monkeypatch):
        monkeypatch.setattr(ocr_routes, "_vision_router", None)
        monkeypatch.setattr("app.config.MISTRAL_API_KEY", "k")
        monkeypatch.setattr("app.config.GEMINI_API_KEY", "k2")
        monkeypatch.setattr(mistral_vision_provider, "MISTRAL_API_KEY", "k")
        monkeypatch.setattr(gemini_vision_provider, "GEMINI_API_KEY", "k2")
        router = get_vision_router()
        assert [p.name for p in router.providers] == ["mistral_vision", "gemini_vision", "tesseract"]

    def test_mistral_failure_continues(self, monkeypatch):
        import app.ocr.providers.mistral_vision_provider as mvp

        def _boom(self):
            raise RuntimeError("init failed")

        monkeypatch.setattr(ocr_routes, "_vision_router", None)
        monkeypatch.setattr("app.config.MISTRAL_API_KEY", "k")
        monkeypatch.setattr("app.config.GEMINI_API_KEY", "")
        monkeypatch.setattr(mvp.MistralVisionProvider, "__init__", _boom)
        router = get_vision_router()
        assert [p.name for p in router.providers] == ["tesseract"]

    def test_gemini_failure_continues(self, monkeypatch):
        import app.ocr.providers.gemini_vision_provider as gvp

        def _boom(self):
            raise RuntimeError("init failed")

        monkeypatch.setattr(ocr_routes, "_vision_router", None)
        monkeypatch.setattr("app.config.MISTRAL_API_KEY", "")
        monkeypatch.setattr("app.config.GEMINI_API_KEY", "k")
        monkeypatch.setattr(gvp.GeminiVisionProvider, "__init__", _boom)
        router = get_vision_router()
        assert [p.name for p in router.providers] == ["tesseract"]


class TestExtractEndpoint:
    def test_success(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        extracted = ExtractedContactInfo(email=ExtractedField(value="a@b.com", confidence="low"))
        monkeypatch.setattr(ocr_routes, "get_vision_router", lambda: _FakeVisionRouter(result=(extracted, "tesseract")))
        monkeypatch.setattr(ocr_routes, "detect_and_crop_face", lambda image: "/uploads/contact-photos/x.jpg")
        response = _post_image(headers={"Authorization": f"Bearer {_token()}"})
        assert response.status_code == 200
        body = response.json()
        assert body["extracted"]["email"]["value"] == "a@b.com"
        assert body["sourceProvider"] == "tesseract"
        assert body["photoUrl"] == "/uploads/contact-photos/x.jpg"

    def test_no_photo_url_excluded(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        monkeypatch.setattr(ocr_routes, "get_vision_router", lambda: _FakeVisionRouter())
        monkeypatch.setattr(ocr_routes, "detect_and_crop_face", lambda image: None)
        body = _post_image(headers={"Authorization": f"Bearer {_token()}"}).json()
        assert "photoUrl" not in body

    def test_unsupported_mime(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        response = _post_image(content_type="image/gif", headers={"Authorization": f"Bearer {_token()}"})
        assert response.status_code == 422
        assert "Unsupported file type" in response.json()["detail"]

    def test_empty_file(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        response = _post_image(data=b"", headers={"Authorization": f"Bearer {_token()}"})
        assert response.status_code == 422

    def test_too_large(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        monkeypatch.setattr(ocr_routes, "MAX_UPLOAD_BYTES", 4)
        response = _post_image(data=b"0123456789", headers={"Authorization": f"Bearer {_token()}"})
        assert response.status_code == 413
        assert "too large" in response.json()["detail"]

    def test_missing_authorization(self):
        response = _post_image()
        assert response.status_code == 401

    def test_missing_secret(self, monkeypatch):
        monkeypatch.delenv("JWT_SECRET", raising=False)
        response = _post_image(headers={"Authorization": f"Bearer {_token()}"})
        assert response.status_code == 503

    def test_service_unavailable(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        monkeypatch.setattr(
            ocr_routes, "get_vision_router", lambda: _FakeVisionRouter(error=VisionServiceUnavailableError("tout a échoué"))
        )
        response = _post_image(headers={"Authorization": f"Bearer {_token()}"})
        assert response.status_code == 503
        assert response.json()["detail"] == "tout a échoué"

    def test_internal_error(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        monkeypatch.setattr(ocr_routes, "get_vision_router", lambda: _FakeVisionRouter(error=RuntimeError("boom")))
        response = _post_image(headers={"Authorization": f"Bearer {_token()}"})
        assert response.status_code == 500