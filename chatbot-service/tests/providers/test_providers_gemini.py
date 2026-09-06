from __future__ import annotations

import base64
import types as pytypes

import pytest

from app.providers import gemini_provider
from app.providers.base import (
    APIConnectionError,
    ProviderHTTPError,
    RateLimitError,
    ToolCallResponse,
)


class _TypeStubs:
    class Content:
        def __init__(self, role, parts=None):
            self.role = role
            self.parts = parts or []

    class Part:
        def __init__(self, **kwargs):
            for key, value in kwargs.items():
                setattr(self, key, value)

    class FunctionCall:
        def __init__(self, name, args, id=None):
            self.name = name
            self.args = args
            self.id = id

    class FunctionResponse:
        def __init__(self, name, response):
            self.name = name
            self.response = response

    class Tool:
        def __init__(self, function_declarations=None):
            self.function_declarations = function_declarations or []

    class FunctionDeclaration:
        def __init__(self, name, description="", parameters=None):
            self.name = name
            self.description = description
            self.parameters = parameters

    class GenerateContentConfig:
        def __init__(self, **kwargs):
            self.kwargs = kwargs


class _ServerError(Exception):
    pass


class _ClientError(Exception):
    pass


class _Unserializable:
    pass


def _ns(**kwargs):
    return pytypes.SimpleNamespace(**kwargs)


def _types_stub(monkeypatch):
    monkeypatch.setattr(gemini_provider, "types", _TypeStubs)


def _attach_client(provider, result=None, error=None):
    models = _FakeGeminiModels(result=result, error=error)
    provider._client = _ns(aio=_ns(models=models))
    return models


class _FakeGeminiModels:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls = []

    async def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.result


class TestGeminiProvider:
    async def test_history_foreign_call_reinjected_as_text(self, monkeypatch):
        _types_stub(monkeypatch)
        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        models = _attach_client(provider, result=_ns(candidates=[_ns(content=_ns(parts=[_ns(function_call=None, text="final")]))]))
        messages = [
            {"role": "user", "content": "u"},
            {
                "role": "assistant",
                "tool_calls": [
                    {"function": {"name": "search_contacts", "arguments": '{"limit": 1}'}},
                    {"function": {"name": "other", "arguments": {"k": "v"}}},
                    {"function": {"name": "other", "arguments": {"k": _Unserializable()}}},
                ],
            },
        ]
        result = await provider.chat_with_tools(messages, [])
        assert result.content == "final"
        model_parts = [part for content in models.calls[0]["contents"] if content.role == "model" for part in content.parts]
        assert model_parts[0].text == '[Outil: search_contacts({"limit": 1})]'
        assert model_parts[1].text == '[Outil: other({"k": "v"})]'
        assert model_parts[2].text.startswith("[Outil: other(")

    async def test_history_tool_call_with_signature_reinjected(self, monkeypatch):
        _types_stub(monkeypatch)
        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        models = _attach_client(provider, result=_ns(candidates=[_ns(content=_ns(parts=[_ns(function_call=None, text="done")]))]))
        messages = [
            {"role": "user", "content": "u"},
            {
                "role": "assistant",
                "content": "using tools",
                "tool_calls": [
                    {
                        "id": "c1",
                        "function": {
                            "name": "search_contacts",
                            "arguments": '{"limit": 1}',
                            "thought_signature": "c2ln",
                        },
                    },
                    {
                        "id": "c2",
                        "function": {
                            "name": "get_affiliation",
                            "arguments": {"limit": 2},
                            "thought_signature": "c2ln",
                        },
                    },
                    {"function": {"name": "lookup", "arguments": "not-json", "thought_signature": "c2ln"}},
                ],
            },
            {"role": "tool", "tool_call_id": "c1", "name": "search_contacts", "content": '{"total_count": 1}'},
        ]
        result = await provider.chat_with_tools(messages, [])
        assert result.content == "done"
        model_parts = [part for content in models.calls[0]["contents"] if content.role == "model" for part in content.parts]
        assert model_parts[0].text == "using tools"
        first = model_parts[1]
        assert first.function_call.name == "search_contacts"
        assert first.function_call.id == "c1"
        assert first.function_call.args == {"limit": 1}
        assert first.thought_signature == "c2ln"
        second = model_parts[2]
        assert second.function_call.name == "get_affiliation"
        assert second.function_call.id == "c2"
        assert second.function_call.args == {"limit": 2}
        third = model_parts[3]
        assert third.function_call.name == "lookup"
        assert third.function_call.id is None
        assert third.function_call.args == {"raw": "not-json"}
        user_others = [content for content in models.calls[0]["contents"] if content.role == "user"]
        function_response = user_others[-1].parts[0].function_response
        assert function_response.name == "search_contacts"
        assert function_response.response == {"total_count": 1}

    async def test_chat_final_extracts_text_and_empty_candidates(self, monkeypatch):
        _types_stub(monkeypatch)
        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        models = _attach_client(provider, result=_ns(candidates=[_ns(content=_ns(parts=[_ns(text="final")]))]))
        result = await provider.chat_final([{"role": "user", "content": "u"}])
        assert result == "final"
        assert "system_instruction" in models.calls[0]["config"].kwargs
        models = _attach_client(provider, result=_ns(candidates=[]))
        result = await provider.chat_final([{"role": "user", "content": "u"}])
        assert result == ""

    async def test_chat_final_candidate_without_content(self, monkeypatch):
        _types_stub(monkeypatch)
        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        _attach_client(provider, result=_ns(candidates=[_ns(content=None)]))
        assert await provider.chat_final([{"role": "user", "content": "u"}]) == ""

    async def test_chat_final_part_without_text_skipped(self, monkeypatch):
        _types_stub(monkeypatch)
        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        _attach_client(provider, result=_ns(candidates=[_ns(content=_ns(parts=[_ns(text=None)]))]))
        assert await provider.chat_final([{"role": "user", "content": "u"}]) == ""

    async def test_chat_with_tools_text_only(self, monkeypatch):
        _types_stub(monkeypatch)
        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        _attach_client(provider, result=_ns(candidates=[_ns(content=_ns(parts=[_ns(text="hello")]))]))
        result = await provider.chat_with_tools([{"role": "user", "content": "u"}], [])
        assert result.content == "hello"
        assert result.tool_calls == []

    async def test_chat_with_tools_function_call_with_bytes_signature(self, monkeypatch):
        _types_stub(monkeypatch)
        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        part = _ns(
            function_call=_ns(id="fc1", name="search_contacts", args={"limit": 1}),
            thought_signature=b"raw-sig",
            text=None,
        )
        _attach_client(provider, result=_ns(candidates=[_ns(content=_ns(parts=[part]))]))
        result = await provider.chat_with_tools([{"role": "user", "content": "u"}], [])
        call = result.tool_calls[0]
        assert call.id == "fc1"
        assert call.name == "search_contacts"
        assert call.arguments == {"limit": 1}
        assert call.thought_signature == base64.b64encode(b"raw-sig").decode("ascii")

    async def test_chat_with_tools_id_fallback_and_text_part(self, monkeypatch):
        _types_stub(monkeypatch)
        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        part = _ns(function_call=_ns(id=None, name="f", args={}), thought_signature="str-sig")
        text_part = _ns(function_call=None, text="hello")
        _attach_client(provider, result=_ns(candidates=[_ns(content=_ns(parts=[part, text_part]))]))
        result = await provider.chat_with_tools([{"role": "user", "content": "u"}], [])
        assert result.tool_calls[0].id.startswith("gemini-")
        assert result.tool_calls[0].thought_signature == "str-sig"
        assert result.content == "hello"

    async def test_chat_with_tools_candidate_without_parts(self, monkeypatch):
        _types_stub(monkeypatch)
        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        _attach_client(provider, result=_ns(candidates=[_ns(content=None)]))
        result = await provider.chat_with_tools([{"role": "user", "content": "u"}], [])
        assert result.content is None
        assert result.tool_calls == []

    async def test_error_mapping_timeout(self, monkeypatch):
        _types_stub(monkeypatch)
        monkeypatch.setattr(gemini_provider, "genai_errors", None)
        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        _attach_client(provider, error=TimeoutError("boom"))
        with pytest.raises(APIConnectionError):
            await provider.chat_with_tools([{"role": "user", "content": "u"}], [])

    async def test_error_mapping_name_based_connection(self, monkeypatch):
        _types_stub(monkeypatch)
        monkeypatch.setattr(gemini_provider, "genai_errors", None)

        class ConnectionLike(Exception):
            pass

        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        _attach_client(provider, error=ConnectionLike("boom"))
        with pytest.raises(APIConnectionError):
            await provider.chat_final([{"role": "user", "content": "u"}])

    async def test_error_mapping_unknown_reraised(self, monkeypatch):
        _types_stub(monkeypatch)
        monkeypatch.setattr(gemini_provider, "genai_errors", None)

        class PlainError(Exception):
            pass

        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        _attach_client(provider, error=PlainError("boom"))
        with pytest.raises(PlainError):
            await provider.chat_with_tools([{"role": "user", "content": "u"}], [])

    async def test_error_mapping_server_error(self, monkeypatch):
        _types_stub(monkeypatch)
        monkeypatch.setattr(gemini_provider, "genai_errors", pytypes.SimpleNamespace(ServerError=_ServerError, ClientError=_ClientError))
        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        _attach_client(provider, error=_ServerError("500"))
        with pytest.raises(ProviderHTTPError) as exc_info:
            await provider.chat_final([{"role": "user", "content": "u"}])
        assert exc_info.value.status_code == 500

    async def test_error_mapping_not_client_error_then_name_based(self, monkeypatch):
        _types_stub(monkeypatch)
        monkeypatch.setattr(gemini_provider, "genai_errors", pytypes.SimpleNamespace(ServerError=_ServerError, ClientError=_ClientError))

        class ConnectionLike(Exception):
            pass

        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        _attach_client(provider, error=ConnectionLike("boom"))
        with pytest.raises(APIConnectionError):
            await provider.chat_with_tools([{"role": "user", "content": "u"}], [])

    async def test_error_mapping_client_error_codes(self, monkeypatch):
        _types_stub(monkeypatch)
        monkeypatch.setattr(gemini_provider, "genai_errors", pytypes.SimpleNamespace(ServerError=_ServerError, ClientError=_ClientError))

        def _client_with_code(code):
            error = _ClientError("client")
            error.code = code
            return error

        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        _attach_client(provider, error=_client_with_code(429))
        with pytest.raises(RateLimitError):
            await provider.chat_final([{"role": "user", "content": "u"}])

        _attach_client(provider, error=_client_with_code(503))
        with pytest.raises(ProviderHTTPError) as exc_info:
            await provider.chat_with_tools([{"role": "user", "content": "u"}], [])
        assert exc_info.value.status_code == 503

        _attach_client(provider, error=_client_with_code(400))
        with pytest.raises(_ClientError):
            await provider.chat_final([{"role": "user", "content": "u"}])

        _attach_client(provider, error=_client_with_code(None))
        with pytest.raises(_ClientError):
            await provider.chat_with_tools([{"role": "user", "content": "u"}], [])