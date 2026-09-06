from __future__ import annotations

import time

import pytest

from app.exceptions import ServiceUnavailableError
from app.providers.base import LLMProvider, RateLimitError, ToolCall, ToolCallResponse
from app.providers.llm_router import LLMRouter


class _OkProvider(LLMProvider):
    name = "ok"

    def __init__(self, response: ToolCallResponse | None = None):
        self._response = response or ToolCallResponse(content="ok")
        self._final = "{"
        self.calls = 0

    async def chat_with_tools(self, messages, tools):
        self.calls += 1
        return self._response

    async def chat_final(self, messages):
        return self._final


class _FailingProvider(LLMProvider):
    name = "failing"

    def __init__(self, error: Exception):
        self._error = error

    async def chat_with_tools(self, messages, tools):
        raise self._error

    async def chat_final(self, messages):
        raise self._error


class _InvalidCallProvider(LLMProvider):
    name = "invalid_call"

    async def chat_with_tools(self, messages, tools):
        return ToolCallResponse(content="x", tool_calls=[ToolCall(id="i", name="unknown_tool")])

    async def chat_final(self, messages):
        return "{}"


class TestLLMRouterHelpers:
    def test_is_healthy_fresh(self):
        router = LLMRouter(providers=[])
        assert router._is_healthy("p") is True

    def test_is_healthy_in_cooldown(self, monkeypatch):
        router = LLMRouter(providers=[])
        router._cooldown_until["p"] = time.time() + 100
        assert router._is_healthy("p") is False

    def test_is_healthy_cooldown_elapsed(self, monkeypatch):
        router = LLMRouter(providers=[])
        router._failures["p"] = 1
        router._cooldown_until["p"] = time.time() - 1
        assert router._is_healthy("p") is True
        assert "p" not in router._failures
        assert "p" not in router._cooldown_until

    def test_record_failure_below_threshold(self):
        router = LLMRouter(providers=[])
        router._record_provider_failure("p")
        assert router._failures == {"p": 1}
        assert "p" not in router._cooldown_until

    def test_record_failure_triggers_cooldown(self):
        router = LLMRouter(providers=[])
        for _ in range(3):
            router._record_provider_failure("p")
        assert "p" in router._cooldown_until

    def test_record_success_clears(self):
        router = LLMRouter(providers=[])
        router._failures["p"] = 5
        router._cooldown_until["p"] = time.time() + 100
        router._record_provider_success("p")
        assert "p" not in router._failures
        assert "p" not in router._cooldown_until


class TestLLMRouterChat:
    async def test_returns_first_success(self):
        router = LLMRouter(providers=[_OkProvider()])
        result = await router.chat([{"role": "user", "content": "u"}], [])
        assert result.content == "ok"

    async def test_pivots_on_pivot_exception(self):
        ok = _OkProvider()
        failing = _FailingProvider(error=TimeoutError("boom"))
        router = LLMRouter(providers=[failing, ok])
        result = await router.chat([{"role": "user", "content": "u"}], [])
        assert result.content == "ok"
        assert failing.name in router._failures

    async def test_pivots_on_unexpected_exception(self):
        class WeirdError(Exception):
            pass

        failing = _FailingProvider(error=WeirdError("boom"))
        ok = _OkProvider()
        router = LLMRouter(providers=[failing, ok])
        result = await router.chat([{"role": "user", "content": "u"}], [])
        assert result.content == "ok"

    async def test_pivots_on_invalid_tool_call(self):
        ok = _OkProvider()
        invalid = _InvalidCallProvider()
        router = LLMRouter(providers=[invalid, ok])
        result = await router.chat([{"role": "user", "content": "u"}], [])
        assert result.content == "ok"

    async def test_skips_provider_in_cooldown(self):
        ok = _OkProvider()
        router = LLMRouter(providers=[ok])
        router._cooldown_until["ok"] = time.time() + 100
        with pytest.raises(ServiceUnavailableError):
            await router.chat([{"role": "user", "content": "u"}], [])
        assert ok.calls == 0

    async def test_no_providers_raises(self):
        router = LLMRouter(providers=[])
        with pytest.raises(ServiceUnavailableError) as exc_info:
            await router.chat([{"role": "user", "content": "u"}], [])
        assert "Aucun fournisseur" in str(exc_info.value)

    async def test_all_providers_fail_returns_fallback(self):
        router = LLMRouter(providers=[_FailingProvider(error=TimeoutError("boom"))])
        result = await router.chat([{"role": "user", "content": "u"}], [])
        assert result.content == "Je rencontre une difficulté technique, veuillez réessayer dans un instant."
        assert result.tool_calls == []

    async def test_success_records_success(self):
        ok = _OkProvider()
        router = LLMRouter(providers=[ok])
        router._failures["ok"] = 1
        await router.chat([{"role": "user", "content": "u"}], [])
        assert "ok" not in router._failures


class TestLLMRouterChatFinal:
    async def test_success(self):
        ok = _OkProvider()
        router = LLMRouter(providers=[ok])
        assert await router.chat_final([{"role": "user", "content": "u"}]) == "{"

    async def test_pivots_on_rate_limit(self):
        failing = _FailingProvider(error=RateLimitError("429"))
        ok = _OkProvider()
        router = LLMRouter(providers=[failing, ok])
        assert await router.chat_final([{"role": "user", "content": "u"}]) == "{"

    async def test_pivots_on_unexpected(self):
        class SurpriseError(Exception):
            pass

        failing = _FailingProvider(error=SurpriseError("boom"))
        ok = _OkProvider()
        router = LLMRouter(providers=[failing, ok])
        assert await router.chat_final([{"role": "user", "content": "u"}]) == "{"

    async def test_skips_cooldown_provider(self):
        ok = _OkProvider()
        router = LLMRouter(providers=[ok])
        router._cooldown_until["ok"] = time.time() + 100
        with pytest.raises(ServiceUnavailableError):
            await router.chat_final([{"role": "user", "content": "u"}])

    async def test_no_providers_raises(self):
        router = LLMRouter(providers=[])
        with pytest.raises(ServiceUnavailableError):
            await router.chat_final([{"role": "user", "content": "u"}])

    async def test_all_failed_returns_fallback(self):
        router = LLMRouter(providers=[_FailingProvider(error=TimeoutError("boom"))])
        assert await router.chat_final([{"role": "user", "content": "u"}]) == "Je rencontre une difficulté technique, veuillez réessayer dans un instant."