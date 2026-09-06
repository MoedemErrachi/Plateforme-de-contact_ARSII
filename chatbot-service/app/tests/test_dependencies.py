from __future__ import annotations

import pytest

from app.dependencies import get_llm_router
from app.providers import llm_router


class _StubProvider:
    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.name = "stub"


class _MistralStub(_StubProvider):
    pass


class _GroqStub(_StubProvider):
    pass


class _GeminiStub(_StubProvider):
    pass


class TestGetLLMRouter:
    def test_builds_and_caches_singleton(self, monkeypatch):
        monkeypatch.setattr("app.dependencies._llm_router", None)
        stub = _StubProvider()
        monkeypatch.setattr("app.dependencies.build_default_providers", lambda: [stub])
        first = get_llm_router()
        second = get_llm_router()
        assert first is second
        assert first.providers == [stub]

    def test_rebuild_after_reset(self, monkeypatch):
        monkeypatch.setattr("app.dependencies._llm_router", None)
        monkeypatch.setattr("app.dependencies.build_default_providers", lambda: [_StubProvider()])
        first = get_llm_router()
        monkeypatch.setattr("app.dependencies._llm_router", None)
        monkeypatch.setattr("app.dependencies.build_default_providers", lambda: [_StubProvider()])
        second = get_llm_router()
        assert first is not second


class TestLLMRouterDefaultProviders:
    def test_llm_router_uses_build_default_providers_when_none(self, monkeypatch):
        stub = _StubProvider()
        monkeypatch.setattr(llm_router, "build_default_providers", lambda: [stub])
        router = llm_router.LLMRouter(providers=None)
        assert router.providers == [stub]

    def test_mistral_only(self, monkeypatch):
        self._patch(monkeypatch, mistral="k", groq="", gemini="", gemini_model="", fallback="")
        providers = llm_router.build_default_providers()
        assert len(providers) == 1
        assert isinstance(providers[0], _MistralStub)

    def test_groq_only(self, monkeypatch):
        monkeypatch.setattr(llm_router, "MistralProvider", _MistralStub)
        monkeypatch.setattr(llm_router, "GroqProvider", _GroqStub)
        monkeypatch.setattr(llm_router, "GeminiProvider", _GeminiStub)
        monkeypatch.setattr(llm_router, "MISTRAL_API_KEY", "")
        monkeypatch.setattr(llm_router, "GROQ_API_KEY", "k")
        monkeypatch.setattr(llm_router, "GEMINI_API_KEY", "")
        monkeypatch.setattr(llm_router, "GEMINI_MODEL", "")
        monkeypatch.setattr(llm_router, "GEMINI_FALLBACK_MODEL", "")
        providers = llm_router.build_default_providers()
        assert len(providers) == 1
        assert isinstance(providers[0], _GroqStub)

    def test_gemini_two_models(self, monkeypatch):
        self._patch(monkeypatch, mistral="", groq="", gemini="k", gemini_model="A", fallback="B")
        providers = llm_router.build_default_providers()
        assert len(providers) == 2
        assert providers[0].kwargs == {"model": "A"}
        assert providers[1].kwargs == {"model": "B"}

    def test_gemini_same_model_deduped(self, monkeypatch):
        self._patch(monkeypatch, mistral="", groq="", gemini="k", gemini_model="A", fallback="A")
        providers = llm_router.build_default_providers()
        assert len(providers) == 1
        assert providers[0].kwargs == {"model": "A"}

    def test_gemini_empty_primary_uses_fallback(self, monkeypatch):
        self._patch(monkeypatch, mistral="", groq="", gemini="k", gemini_model="", fallback="B")
        providers = llm_router.build_default_providers()
        assert len(providers) == 1
        assert providers[0].kwargs == {"model": "B"}

    def test_gemini_missing_fallback(self, monkeypatch):
        self._patch(monkeypatch, mistral="", groq="", gemini="k", gemini_model="A", fallback="")
        providers = llm_router.build_default_providers()
        assert len(providers) == 1
        assert providers[0].kwargs == {"model": "A"}

    def test_no_keys_produces_empty(self, monkeypatch):
        self._patch(monkeypatch, mistral="", groq="", gemini="", gemini_model="", fallback="")
        assert llm_router.build_default_providers() == []

    @staticmethod
    def _patch(monkeypatch: pytest.MonkeyPatch, mistral, groq, gemini, gemini_model, fallback) -> None:
        monkeypatch.setattr(llm_router, "MistralProvider", _MistralStub)
        monkeypatch.setattr(llm_router, "GroqProvider", _GroqStub)
        monkeypatch.setattr(llm_router, "GeminiProvider", _GeminiStub)
        monkeypatch.setattr(llm_router, "MISTRAL_API_KEY", mistral)
        monkeypatch.setattr(llm_router, "GROQ_API_KEY", groq)
        monkeypatch.setattr(llm_router, "GEMINI_API_KEY", gemini)
        monkeypatch.setattr(llm_router, "GEMINI_MODEL", gemini_model)
        monkeypatch.setattr(llm_router, "GEMINI_FALLBACK_MODEL", fallback)