from __future__ import annotations

import pytest

from app.ocr.models import ExtractedContactInfo, ExtractedField, FieldConfidence
from app.ocr.providers.base import (
    VisionProvider,
    VisionRateLimitError,
    VisionTimeoutError,
    VisionTransportError,
    VisionServiceUnavailableError,
)
from app.ocr.vision_router import VisionRouter


class MockVisionProvider(VisionProvider):
    name = "mock"
    model = "mock-v1"

    def __init__(self, result: ExtractedContactInfo | None = None, error: Exception | None = None):
        self._result = result
        self._error = error

    async def extract_contact_info(self, image_bytes: bytes, timeout: int = 20) -> ExtractedContactInfo:
        if self._error:
            raise self._error
        return self._result  # type: ignore[return-value]


def _dummy_extracted() -> ExtractedContactInfo:
    return ExtractedContactInfo(
        firstName=ExtractedField(value="Alice", confidence=FieldConfidence.HIGH),
        email=ExtractedField(value="alice@test.com", confidence=FieldConfidence.HIGH),
    )


class TestVisionRouterPivot:
    @pytest.mark.asyncio
    async def test_first_provider_succeeds(self):
        ok = MockVisionProvider(result=_dummy_extracted())
        router = VisionRouter(providers=[ok])
        result, name = await router.extract(b"fake-image")
        assert name == "mock"
        assert result.firstName is not None
        assert result.firstName.value == "Alice"

    @pytest.mark.asyncio
    async def test_pivots_on_transport_error(self):
        fail = MockVisionProvider(error=VisionTransportError("server down"))
        ok = MockVisionProvider(result=_dummy_extracted())
        router = VisionRouter(providers=[fail, ok])
        result, name = await router.extract(b"fake-image")
        assert name == "mock"
        assert result.email is not None

    @pytest.mark.asyncio
    async def test_pivots_on_rate_limit(self):
        fail = MockVisionProvider(error=VisionRateLimitError("429 too many"))
        ok = MockVisionProvider(result=_dummy_extracted())
        router = VisionRouter(providers=[fail, ok])
        result, name = await router.extract(b"fake-image")
        assert name == "mock"

    @pytest.mark.asyncio
    async def test_pivots_on_timeout(self):
        fail = MockVisionProvider(error=VisionTimeoutError("timed out"))
        ok = MockVisionProvider(result=_dummy_extracted())
        router = VisionRouter(providers=[fail, ok])
        result, name = await router.extract(b"fake-image")
        assert name == "mock"

    @pytest.mark.asyncio
    async def test_all_fail_raises_service_unavailable(self):
        fail1 = MockVisionProvider(error=VisionTransportError("err1"))
        fail2 = MockVisionProvider(error=VisionRateLimitError("err2"))
        router = VisionRouter(providers=[fail1, fail2])
        with pytest.raises(VisionServiceUnavailableError) as exc_info:
            await router.extract(b"fake-image")
        assert "err1" in exc_info.value.detail
        assert "err2" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_no_providers_raises_service_unavailable(self):
        router = VisionRouter(providers=[])
        with pytest.raises(VisionServiceUnavailableError):
            await router.extract(b"fake-image")

    @pytest.mark.asyncio
    async def test_non_vision_error_not_caught(self):
        class RandomError(Exception):
            pass

        fail = MockVisionProvider(error=RandomError("unexpected"))
        ok = MockVisionProvider(result=_dummy_extracted())
        router = VisionRouter(providers=[fail, ok])
        with pytest.raises(RandomError):
            await router.extract(b"fake-image")
