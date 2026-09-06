from __future__ import annotations

import types as pytypes

import httpx
import pytest

from app.providers import mistral_provider
from app.providers.base import (
    APIConnectionError,
    ProviderHTTPError,
    RateLimitError,
)


def _ns(**kwargs):
    return pytypes.SimpleNamespace(**kwargs)


def _tool_call(call_id="c1", name="search_contacts", arguments='{"limit": 1}'):
    return _ns(id=call_id, function=_ns(name=name, arguments=arguments))


def _chat_client(result=None, error=None):
    class _Complete:
        def __init__(self):
            self.calls = []

        async def __call__(self, **kwargs):
            self.calls.append(kwargs)
            if error is not None:
                raise error
            return result

    return _ns(chat=_ns(complete_async=_Complete()))


def _mistral_http_error(status):
    raw_response = httpx.Response(
        status,
        request=httpx.Request("POST", "https://api.mistral.ai/v1/chat/completions"),
        text="{}",
        headers={"content-type": "application/json"},
    )
    return mistral_provider.MistralHTTPError("boom", raw_response)


class TestMistralProvider:
    def test_init_uses_defaults(self):
        provider = mistral_provider.MistralProvider(api_key="fake-key")
        assert provider.model == mistral_provider.MISTRAL_MODEL

    def test_init_custom_model(self):
        provider = mistral_provider.MistralProvider(api_key="fake-key", model="custom")
        assert provider.model == "custom"

    async def test_chat_with_tools_text_response(self):
        client = _chat_client(result=_ns(choices=[_ns(message=_ns(content="hello", tool_calls=None))]))
        provider = mistral_provider.MistralProvider(api_key="fake-key")
        provider._client = client
        result = await provider.chat_with_tools([{"role": "user", "content": "u"}], [])
        assert result.content == "hello"
        assert result.tool_calls == []
        assert client.chat.complete_async.calls[0]["tool_choice"] == "auto"

    async def test_chat_with_tools_tool_calls(self):
        client = _chat_client(
            result=_ns(
                choices=[
                    _ns(
                        message=_ns(
                            content=None,
                            tool_calls=[
                                _tool_call(call_id="c1", arguments='{"k": "v"}'),
                                _tool_call(call_id="c2", arguments="bogus"),
                            ],
                        )
                    )
                ]
            )
        )
        provider = mistral_provider.MistralProvider(api_key="fake-key")
        provider._client = client
        result = await provider.chat_with_tools([{"role": "user", "content": "u"}], [])
        assert result.tool_calls[0].arguments == {"k": "v"}
        assert result.tool_calls[1].arguments == {"raw": "bogus"}

    async def test_chat_final(self):
        client = _chat_client(result=_ns(choices=[_ns(message=_ns(content=" final "))]))
        provider = mistral_provider.MistralProvider(api_key="fake-key")
        provider._client = client
        result = await provider.chat_final([{"role": "user", "content": "u"}])
        assert result == "final"
        assert client.chat.complete_async.calls[0]["response_format"] == {"type": "json_object"}

    async def test_chat_final_empty_content(self):
        client = _chat_client(result=_ns(choices=[_ns(message=_ns(content=None))]))
        provider = mistral_provider.MistralProvider(api_key="fake-key")
        provider._client = client
        assert await provider.chat_final([{"role": "user", "content": "u"}]) == ""

    async def test_http_error_429(self):
        provider = mistral_provider.MistralProvider(api_key="fake-key")
        provider._client = _chat_client(error=_mistral_http_error(429))
        with pytest.raises(RateLimitError):
            await provider.chat_with_tools([{"role": "user", "content": "u"}], [])

    async def test_http_error_500(self):
        provider = mistral_provider.MistralProvider(api_key="fake-key")
        provider._client = _chat_client(error=_mistral_http_error(500))
        with pytest.raises(ProviderHTTPError) as exc_info:
            await provider.chat_final([{"role": "user", "content": "u"}])
        assert exc_info.value.status_code == 500

    async def test_http_error_other_reraised(self):
        provider = mistral_provider.MistralProvider(api_key="fake-key")
        provider._client = _chat_client(error=_mistral_http_error(401))
        with pytest.raises(mistral_provider.MistralHTTPError):
            await provider.chat_with_tools([{"role": "user", "content": "u"}], [])

    async def test_connection_error(self):
        provider = mistral_provider.MistralProvider(api_key="fake-key")
        provider._client = _chat_client(error=mistral_provider.MistralConnectionError("conn"))
        with pytest.raises(APIConnectionError):
            await provider.chat_final([{"role": "user", "content": "u"}])

    async def test_timeout_error(self):
        provider = mistral_provider.MistralProvider(api_key="fake-key")
        provider._client = _chat_client(error=TimeoutError("t"))
        with pytest.raises(APIConnectionError):
            await provider.chat_with_tools([{"role": "user", "content": "u"}], [])

    async def test_name_based_connection_error(self):
        class ConnectionLike(Exception):
            pass

        provider = mistral_provider.MistralProvider(api_key="fake-key")
        provider._client = _chat_client(error=ConnectionLike("boom"))
        with pytest.raises(APIConnectionError):
            await provider.chat_final([{"role": "user", "content": "u"}])

    async def test_unknown_error_reraised(self):
        class PlainError(Exception):
            pass

        provider = mistral_provider.MistralProvider(api_key="fake-key")
        provider._client = _chat_client(error=PlainError("boom"))
        with pytest.raises(PlainError):
            await provider.chat_with_tools([{"role": "user", "content": "u"}], [])