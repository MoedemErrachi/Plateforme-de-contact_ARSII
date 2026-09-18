from __future__ import annotations

import types as pytypes

import httpx
import pytest

from app.providers import groq_provider
from app.providers.base import (
    APIConnectionError,
    ProviderHTTPError,
    RateLimitError,
)


def _ns(**kwargs):
    return pytypes.SimpleNamespace(**kwargs)


def _request() -> httpx.Request:
    return httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")


def _status_error(status: int):
    response = httpx.Response(status, request=_request())
    return groq_provider.GroqAPIStatusError(f"HTTP {status}", response=response, body=None)


def _message(tool_calls=None, content=None) -> _ns:
    return _ns(tool_calls=tool_calls, content=content)


def _tool_call(call_id="c1", name="search_contacts", arguments='{"limit": 1}') -> _ns:
    return _ns(id=call_id, function=_ns(name=name, arguments=arguments))


def _completions_client(result=None, error=None):
    class _Completions:
        def __init__(self):
            self.calls = []

        async def create(self, **kwargs):
            self.calls.append(kwargs)
            if error is not None:
                raise error
            return result

    return _ns(chat=_ns(completions=_Completions()))


class TestGroqProvider:
    async def test_chat_with_tools_text_response(self):
        client = _completions_client(result=_ns(choices=[_ns(message=_message(content="hello"))]))
        provider = groq_provider.GroqProvider(api_key="fake-key")
        provider._client = client
        result = await provider.chat_with_tools([{"role": "user", "content": "u"}], [])
        assert result.content == "hello"
        assert result.tool_calls == []
        assert client.chat.completions.calls[0]["tool_choice"] == "auto"

    async def test_chat_with_tools_tool_calls(self):
        client = _completions_client(
            result=_ns(
                choices=[
                    _ns(
                        message=_message(
                            tool_calls=[
                                _tool_call(call_id="c1", arguments='{"k": "v"}'),
                                _tool_call(call_id="c2", arguments="not-json"),
                            ]
                        )
                    )
                ]
            )
        )
        provider = groq_provider.GroqProvider(api_key="fake-key")
        provider._client = client
        result = await provider.chat_with_tools([{"role": "user", "content": "u"}], [])
        assert result.tool_calls[0].id == "c1"
        assert result.tool_calls[0].arguments == {"k": "v"}
        assert result.tool_calls[1].arguments == {"raw": "not-json"}

    async def test_chat_final(self):
        client = _completions_client(result=_ns(choices=[_ns(message=_message(content="  final  "))]))
        provider = groq_provider.GroqProvider(api_key="fake-key")
        provider._client = client
        result = await provider.chat_final([{"role": "user", "content": "u"}])
        assert result.strip() == "final"
        assert client.chat.completions.calls[0]["response_format"] == {"type": "json_object"}

    async def test_chat_final_empty_content(self):
        provider = groq_provider.GroqProvider(api_key="fake-key")
        provider._client = _completions_client(result=_ns(choices=[_ns(message=_message(content=None))]))
        assert await provider.chat_final([{"role": "user", "content": "u"}]) == ""

    async def test_rate_limit_error(self):
        provider = groq_provider.GroqProvider(api_key="fake-key")
        error = groq_provider.GroqRateLimitError("429", response=httpx.Response(429, request=_request()), body=None)
        provider._client = _completions_client(error=error)
        with pytest.raises(RateLimitError):
            await provider.chat_with_tools([{"role": "user", "content": "u"}], [])

    async def test_connection_and_timeout_errors(self):
        request = _request()
        errors = (groq_provider.GroqAPIConnectionError(request=request), groq_provider.GroqAPITimeoutError(request), TimeoutError("t"))
        for error in errors:
            provider = groq_provider.GroqProvider(api_key="fake-key")
            provider._client = _completions_client(error=error)
            with pytest.raises(APIConnectionError):
                await provider.chat_final([{"role": "user", "content": "u"}])

    async def test_status_error_500(self):
        error = _status_error(500)
        provider = groq_provider.GroqProvider(api_key="fake-key")
        provider._client = _completions_client(error=error)
        with pytest.raises(ProviderHTTPError) as exc_info:
            await provider.chat_with_tools([{"role": "user", "content": "u"}], [])
        assert exc_info.value.status_code == 500

    async def test_status_error_400_reraised(self):
        error = _status_error(400)
        provider = groq_provider.GroqProvider(api_key="fake-key")
        provider._client = _completions_client(error=error)
        with pytest.raises(groq_provider.GroqAPIStatusError):
            await provider.chat_final([{"role": "user", "content": "u"}])

    async def test_chat_with_tools_connection_error(self):
        error = groq_provider.GroqAPIConnectionError(request=_request())
        provider = groq_provider.GroqProvider(api_key="fake-key")
        provider._client = _completions_client(error=error)
        with pytest.raises(APIConnectionError):
            await provider.chat_with_tools([{"role": "user", "content": "u"}], [])

    async def test_chat_with_tools_status_400_reraised(self):
        error = _status_error(400)
        provider = groq_provider.GroqProvider(api_key="fake-key")
        provider._client = _completions_client(error=error)
        with pytest.raises(groq_provider.GroqAPIStatusError):
            await provider.chat_with_tools([{"role": "user", "content": "u"}], [])

    async def test_chat_final_rate_limit(self):
        error = groq_provider.GroqRateLimitError("429", response=httpx.Response(429, request=_request()), body=None)
        provider = groq_provider.GroqProvider(api_key="fake-key")
        provider._client = _completions_client(error=error)
        with pytest.raises(RateLimitError):
            await provider.chat_final([{"role": "user", "content": "u"}])

    async def test_chat_final_status_500(self):
        error = _status_error(500)
        provider = groq_provider.GroqProvider(api_key="fake-key")
        provider._client = _completions_client(error=error)
        with pytest.raises(ProviderHTTPError) as exc_info:
            await provider.chat_final([{"role": "user", "content": "u"}])
        assert exc_info.value.status_code == 500