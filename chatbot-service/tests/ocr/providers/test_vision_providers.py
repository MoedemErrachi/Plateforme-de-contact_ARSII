from __future__ import annotations

import types as pytypes

import httpx
import pytest

from app.ocr.providers import gemini_vision_provider, mistral_vision_provider, tesseract_fallback
from app.ocr.providers.base import (
    VisionRateLimitError,
    VisionTimeoutError,
    VisionTransportError,
)


def _ns(**kwargs):
    return pytypes.SimpleNamespace(**kwargs)


class TestGeminiVisionProvider:
    def test_init_without_genai_sdk(self, monkeypatch):
        monkeypatch.setattr(gemini_vision_provider, "genai", None)
        with pytest.raises(ImportError):
            gemini_vision_provider.GeminiVisionProvider(api_key="fake-key")

    async def test_fallback_name_based_when_not_client_error(self, monkeypatch):
        _patch_genai_errors(monkeypatch, server=False, client=False)

        class ConnectionLike(Exception):
            pass

        provider = gemini_vision_provider.GeminiVisionProvider(api_key="fake-key")
        provider._client = _ns(aio=_ns(models=_FakeGeminiVisionModels(error=ConnectionLike("boom"))))
        with pytest.raises(VisionTimeoutError):
            await provider.extract_contact_info(b"image")

    async def test_extract_success(self, monkeypatch):
        response = _ns(text='{"email": {"value": "a@b.com", "confidence": "high"}}')
        models = _FakeGeminiVisionModels(result=response)
        provider = gemini_vision_provider.GeminiVisionProvider(api_key="fake-key")
        provider._client = _ns(aio=_ns(models=models))
        result = await provider.extract_contact_info(b"image")
        assert result.email is not None
        assert result.email.value == "a@b.com"

    async def test_extract_empty_text(self, monkeypatch):
        models = _FakeGeminiVisionModels(result=_ns(text=None))
        provider = gemini_vision_provider.GeminiVisionProvider(api_key="fake-key")
        provider._client = _ns(aio=_ns(models=models))
        with pytest.raises(ValueError):
            await provider.extract_contact_info(b"image")

    async def test_timeout_maps_to_vision_timeout(self):
        provider = gemini_vision_provider.GeminiVisionProvider(api_key="fake-key")
        provider._client = _ns(aio=_ns(models=_FakeGeminiVisionModels(error=TimeoutError("t"))))
        with pytest.raises(VisionTimeoutError):
            await provider.extract_contact_info(b"image")

    async def test_server_error_maps_to_transport(self, monkeypatch):
        _patch_genai_errors(monkeypatch, server=True, client=False)
        provider = gemini_vision_provider.GeminiVisionProvider(api_key="fake-key")
        provider._client = _ns(aio=_ns(models=_FakeGeminiVisionModels(error=_ServerError("500"))))
        with pytest.raises(VisionTransportError):
            await provider.extract_contact_info(b"image")

    async def test_client_error_429_maps_to_rate_limit(self, monkeypatch):
        _patch_genai_errors(monkeypatch, server=False, client=True)
        client_error = _ClientError("429")
        client_error.code = 429
        provider = gemini_vision_provider.GeminiVisionProvider(api_key="fake-key")
        provider._client = _ns(aio=_ns(models=_FakeGeminiVisionModels(error=client_error)))
        with pytest.raises(VisionRateLimitError):
            await provider.extract_contact_info(b"image")

    async def test_client_error_other_maps_to_transport(self, monkeypatch):
        _patch_genai_errors(monkeypatch, server=False, client=True)
        client_error = _ClientError("400")
        client_error.code = 400
        provider = gemini_vision_provider.GeminiVisionProvider(api_key="fake-key")
        provider._client = _ns(aio=_ns(models=_FakeGeminiVisionModels(error=client_error)))
        with pytest.raises(VisionTransportError):
            await provider.extract_contact_info(b"image")

    async def test_async_forbidden_name_based_timeout(self, monkeypatch):
        monkeypatch.setattr(gemini_vision_provider, "genai_errors", None)

        class ConnectionLike(Exception):
            pass

        provider = gemini_vision_provider.GeminiVisionProvider(api_key="fake-key")
        provider._client = _ns(aio=_ns(models=_FakeGeminiVisionModels(error=ConnectionLike("boom"))))
        with pytest.raises(VisionTimeoutError):
            await provider.extract_contact_info(b"image")

    async def test_unknown_exception_maps_to_transport(self, monkeypatch):
        monkeypatch.setattr(gemini_vision_provider, "genai_errors", None)

        class RandomError(Exception):
            pass

        provider = gemini_vision_provider.GeminiVisionProvider(api_key="fake-key")
        provider._client = _ns(aio=_ns(models=_FakeGeminiVisionModels(error=RandomError("boom"))))
        with pytest.raises(VisionTransportError):
            await provider.extract_contact_info(b"image")


class _FakeGeminiVisionModels:
    def __init__(self, result=None, error=None):
        self._result = result
        self._error = error

    async def generate_content(self, **kwargs):
        if self._error is not None:
            raise self._error
        return self._result


class _ServerError(Exception):
    pass


class _ClientError(Exception):
    pass


def _patch_genai_errors(monkeypatch, server: bool, client: bool):
    server_cls = _ServerError if server else None
    client_cls = _ClientError if client else None
    monkeypatch.setattr(
        gemini_vision_provider,
        "genai_errors",
        pytypes.SimpleNamespace(ServerError=server_cls, ClientError=client_cls),
    )


class TestMistralVisionProvider:
    async def test_extract_success(self):
        client = _FakeMistralVisionClient(
            result=_ns(choices=[_ns(message=_ns(content='{"phone": {"value": "+33 1", "confidence": "low"}}'))])
        )
        provider = mistral_vision_provider.MistralVisionProvider(api_key="fake-key")
        provider._client = client
        result = await provider.extract_contact_info(b"image")
        assert result.phone is not None
        assert result.phone.value == "+33 1"

    async def test_http_error_429(self):
        provider = mistral_vision_provider.MistralVisionProvider(api_key="fake-key")
        provider._client = _FakeMistralVisionClient(error=_mistral_vision_error(429))
        with pytest.raises(VisionRateLimitError):
            await provider.extract_contact_info(b"image")

    async def test_http_error_other(self):
        provider = mistral_vision_provider.MistralVisionProvider(api_key="fake-key")
        provider._client = _FakeMistralVisionClient(error=_mistral_vision_error(502))
        with pytest.raises(VisionTransportError):
            await provider.extract_contact_info(b"image")

    async def test_connection_and_timeout(self):
        for error in ("conn", TimeoutError("t")):
            client = _FakeMistralVisionClient(
                error=mistral_vision_provider.MistralConnectionError("nope") if error == "conn" else error
            )
            provider = mistral_vision_provider.MistralVisionProvider(api_key="fake-key")
            provider._client = client
            with pytest.raises(VisionTimeoutError):
                await provider.extract_contact_info(b"image")

    async def test_name_based_timeout(self):
        class ConnectionLike(Exception):
            pass

        provider = mistral_vision_provider.MistralVisionProvider(api_key="fake-key")
        provider._client = _FakeMistralVisionClient(error=ConnectionLike("boom"))
        with pytest.raises(VisionTimeoutError):
            await provider.extract_contact_info(b"image")

    async def test_unknown_maps_to_transport(self):
        class RandomError(Exception):
            pass

        provider = mistral_vision_provider.MistralVisionProvider(api_key="fake-key")
        provider._client = _FakeMistralVisionClient(error=RandomError("boom"))
        with pytest.raises(VisionTransportError):
            await provider.extract_contact_info(b"image")


class _FakeMistralVisionClient:
    def __init__(self, result=None, error=None):
        self._result = result
        self._error = error

    @property
    def chat(self):
        return self

    async def complete_async(self, **kwargs):
        if self._error is not None:
            raise self._error
        return self._result


def _mistral_vision_error(status):
    raw_response = httpx.Response(
        status,
        request=httpx.Request("POST", "https://api.mistral.ai/v1/chat/completions"),
        text="{}",
        headers={"content-type": "application/json"},
    )
    error = mistral_vision_provider.MistralHTTPError("boom", raw_response)
    return error


class TestTesseractFallbackProvider:
    def test_init_without_pytesseract(self, monkeypatch):
        import builtins

        real_import = builtins.__import__

        def fake_import(name, *args, **kwargs):
            if name == "pytesseract":
                raise ImportError("missing")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", fake_import)
        provider = tesseract_fallback.TesseractFallbackProvider()
        assert provider.name == "tesseract"

    async def test_extract_with_email_and_phone(self, monkeypatch):
        import pytesseract

        monkeypatch.setattr(pytesseract, "image_to_string", lambda img: "Contact: a@b.com +33 612 345 678")
        provider = tesseract_fallback.TesseractFallbackProvider()
        result = await provider.extract_contact_info(_png_bytes())
        assert result.email is not None
        assert result.email.value == "a@b.com"
        assert result.phone is not None
        assert result.phone.value == "+33 612 345 678"

    async def test_extract_no_fields(self, monkeypatch):
        import pytesseract

        monkeypatch.setattr(pytesseract, "image_to_string", lambda img: "random text")
        provider = tesseract_fallback.TesseractFallbackProvider()
        result = await provider.extract_contact_info(_png_bytes())
        assert result.email is None
        assert result.phone is None

    async def test_extract_ocr_failure_returns_empty(self, monkeypatch):
        import pytesseract

        def _boom(_):
            raise RuntimeError("tesseract binary missing")

        monkeypatch.setattr(pytesseract, "image_to_string", _boom)
        provider = tesseract_fallback.TesseractFallbackProvider()
        result = await provider.extract_contact_info(_png_bytes())
        assert result.email is None
        assert result.phone is None


def _png_bytes() -> bytes:
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (4, 4), color="white").save(buf, format="PNG")
    return buf.getvalue()