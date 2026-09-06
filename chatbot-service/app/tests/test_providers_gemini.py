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


class TestGeminiTypes:
    def test_types_stub_functional(self):
        stub = _TypeStubs
        parts = [stub.Part(text="hi")]
        content = stub.Content(role="model", parts=parts)
        assert content.parts[0].text == "hi"
        fc = stub.FunctionCall(name="n", args={}, id="i")
        assert fc.id == "i"
        tool = stub.Tool(function_declarations=[stub.FunctionDeclaration(name="n", parameters={})])
        assert tool.function_declarations[0].name == "n"
        config = stub.GenerateContentConfig(system_instruction="s")
        assert config.kwargs["system_instruction"] == "s"


class TestGeminiHelpers:
    def test_args_to_dict_empty(self):
        assert gemini_provider._args_to_dict(None) == {}
        assert gemini_provider._args_to_dict({}) == {}

    def test_args_to_dict_mapping(self):
        assert gemini_provider._args_to_dict({"a": 1}) == {"a": 1}
        assert gemini_provider._args_to_dict(pytypes.SimpleNamespace(a=1).__dict__) == {"a": 1}

    def test_args_to_dict_mapping_items_raises(self):
        class BadMapping:
            def items(self):
                raise RuntimeError("boom")

        result = gemini_provider._args_to_dict(BadMapping())
        assert set(result) == {"raw"}
        assert "BadMapping" in result["raw"]

    def test_normalize_thought_signature(self):
        raw = b"sig-bytes"
        assert gemini_provider._normalize_thought_signature(raw) == base64.b64encode(raw).decode("ascii")
        assert gemini_provider._normalize_thought_signature("text-sig") == "text-sig"
        assert gemini_provider._normalize_thought_signature(b"") is None
        assert gemini_provider._normalize_thought_signature("") is None
        assert gemini_provider._normalize_thought_signature(None) is None

    def test_flush_tool_parts(self):
        contents = []
        pending = [_TypeStubs.Part(text="p")]
        gemini_provider._flush_tool_parts(contents, pending)
        assert len(contents) == 1
        assert contents[0].role == "user"
        assert pending == []
        gemini_provider._flush_tool_parts(contents, pending)
        assert len(contents) == 1

    def test_build_full_system_instruction(self):
        strict = gemini_provider.GEMINI_STRICT_OUTPUT_INSTRUCTIONS
        joined = gemini_provider.GeminiProvider._build_full_system_instruction("Base")
        assert joined.startswith("Base")
        assert strict.strip() in joined
        only_strict = gemini_provider.GeminiProvider._build_full_system_instruction("")
        assert only_strict == strict.strip()
        whitespace_only = gemini_provider.GeminiProvider._build_full_system_instruction("   ")
        assert whitespace_only == strict.strip()

    def test_tool_response_content(self):
        assert gemini_provider._tool_response_content({}) == {"output": ""}
        assert gemini_provider._tool_response_content({"content": "not json"}) == {"output": "not json"}
        assert gemini_provider._tool_response_content({"content": '{"a": 1}'}) == {"a": 1}
        assert gemini_provider._tool_response_content({"content": "[1, 2]"}) == {"output": [1, 2]}


class TestGeminiAssistantParts:
    def test_content_text_only(self):
        message = {"role": "assistant", "content": "hello", "tool_calls": []}
        parts = gemini_provider._assistant_parts(message)
        assert parts[0].text == "hello"

    def test_foreign_tool_call_without_signature_becomes_text(self):
        message = {
            "role": "assistant",
            "tool_calls": [
                {"function": {"name": "search_contacts", "arguments": '{"limit": 1}'}},
            ],
        }
        parts = gemini_provider._assistant_parts(message)
        assert parts[0].text == '[Outil: search_contacts({"limit": 1})]'

    def test_tool_call_with_signature_and_valid_json(self, monkeypatch):
        _types_stub(monkeypatch)
        message = {
            "role": "assistant",
            "tool_calls": [
                {
                    "id": "c1",
                    "function": {
                        "name": "search_contacts",
                        "arguments": '{"limit": 1}',
                        "thought_signature": "c2ln",
                    },
                },
            ],
        }
        parts = gemini_provider._assistant_parts(message)
        part = parts[0]
        assert part.function_call.name == "search_contacts"
        assert part.function_call.args == {"limit": 1}
        assert part.function_call.id == "c1"
        assert part.thought_signature == "c2ln"

    def test_tool_call_with_invalid_json_and_no_id(self, monkeypatch):
        _types_stub(monkeypatch)
        message = {
            "role": "assistant",
            "tool_calls": [
                {
                    "function": {
                        "name": "n",
                        "arguments": "not-json",
                        "thought_signature": "s",
                    },
                },
            ],
        }
        part = gemini_provider._assistant_parts(message)[0]
        assert part.function_call.args == {"raw": "not-json"}
        assert getattr(part.function_call, "id", None) is None
        assert part.thought_signature == "s"

    def test_tool_call_with_dict_arguments(self, monkeypatch):
        _types_stub(monkeypatch)
        message = {
            "role": "assistant",
            "tool_calls": [
                {
                    "function": {
                        "name": "n",
                        "arguments": {"k": "v"},
                        "thought_signature": "s",
                    },
                },
            ],
        }
        part = gemini_provider._assistant_parts(message)[0]
        assert part.function_call.args == {"k": "v"}

    def test_tool_call_with_unsafe_dict_arguments(self, monkeypatch):
        _types_stub(monkeypatch)
        message = {
            "role": "assistant",
            "tool_calls": [{"function": {"name": "n", "arguments": {"k": object()}}}],
        }
        part = gemini_provider._assistant_parts(message)[0]
        assert part.text.startswith("[Outil: n(")

    def test_tool_call_with_empty_signature_becomes_text(self, monkeypatch):
        _types_stub(monkeypatch)
        message = {
            "role": "assistant",
            "tool_calls": [
                {
                    "function": {"name": "n", "arguments": '{"k": 1}', "thought_signature": ""},
                },
            ],
        }
        part = gemini_provider._assistant_parts(message)[0]
        assert part.text.startswith("[Outil: n(")


class TestToGeminiContents:
    def test_system_joined_and_content_built(self):
        messages = [
            {"role": "system", "content": "S1"},
            {"role": "system", "content": "S2"},
            {"role": "user", "content": "hi"},
        ]
        system_instruction, contents = gemini_provider.GeminiProvider._to_gemini_contents(messages)
        assert system_instruction == "S1\nS2"
        assert [content.role for content in contents] == ["user"]
        assert contents[0].parts[0].text == "hi"

    def test_tool_responses_grouped_after_assistant(self):
        messages = [
            {"role": "user", "content": "q"},
            {"role": "assistant", "content": "a", "tool_calls": []},
            {"role": "tool", "name": "t", "content": '{"ok": true}'},
        ]
        _, contents = gemini_provider.GeminiProvider._to_gemini_contents(messages)
        roles = [content.role for content in contents]
        assert roles == ["user", "model", "user"]
        assert contents[1].parts[0].text == "a"
        tool_part = contents[2].parts[0]
        assert tool_part.function_response.name == "t"
        assert tool_part.function_response.response == {"ok": True}

    def test_unknown_role_treated_as_user(self):
        messages = [{"role": "weird", "content": "x"}]
        _, contents = gemini_provider.GeminiProvider._to_gemini_contents(messages)
        assert contents[0].role == "user"
        assert contents[0].parts[0].text == "x"

    def test_assistant_without_parts_skipped(self, monkeypatch):
        _types_stub(monkeypatch)
        messages = [{"role": "assistant", "content": None}]
        _, contents = gemini_provider.GeminiProvider._to_gemini_contents(messages)
        assert contents == []


class TestExtractResponse:
    def test_empty_candidates(self):
        text_parts, tool_calls = gemini_provider._extract_response(_ns(candidates=[]))
        assert text_parts == []
        assert tool_calls == []

    def test_candidate_without_content(self):
        text_parts, tool_calls = gemini_provider._extract_response(_ns(candidates=[_ns(content=None)]))
        assert text_parts == []
        assert tool_calls == []

    def test_blank_part_skipped(self):
        text_parts, tool_calls = gemini_provider._extract_response(
            _ns(candidates=[_ns(content=_ns(parts=[_ns(function_call=None, text=None)]))])
        )
        assert text_parts == []
        assert tool_calls == []


class TestGeminiProvider:
    def test_init_uses_defaults(self, monkeypatch):
        _types_stub(monkeypatch)
        provider = gemini_provider.GeminiProvider(api_key="fake-key")
        assert provider.model == gemini_provider.GEMINI_MODEL
        assert provider._client is not None

    def test_init_custom_model(self):
        provider = gemini_provider.GeminiProvider(api_key="fake-key", model="custom-model")
        assert provider.model == "custom-model"

    def test_to_gemini_tools(self, monkeypatch):
        _types_stub(monkeypatch)
        tools = [{"function": {"name": "f", "description": "d", "parameters": {"type": "object"}}}]
        tools_out = gemini_provider.GeminiProvider._to_gemini_tools(tools)
        assert len(tools_out[0].function_declarations) == 1
        declaration = tools_out[0].function_declarations[0]
        assert declaration.name == "f"
        assert declaration.description == "d"
        assert declaration.parameters == {"type": "object"}

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