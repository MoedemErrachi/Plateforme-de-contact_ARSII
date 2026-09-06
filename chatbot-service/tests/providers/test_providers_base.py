from __future__ import annotations

from app.providers.base import (
    ToolCall,
    ToolCallResponse,
    build_assistant_message,
    extract_text,
    strip_internal_fields,
)


class TestExtractText:
    def test_none_returns_none(self):
        assert extract_text(None) is None

    def test_string_stripped(self):
        assert extract_text("  hello  ") == "hello"
        assert extract_text("   ") is None

    def test_list_of_strings(self):
        assert extract_text(["a", "b"]) == "a b"

    def test_list_with_dict_text_chunks(self):
        assert extract_text([{"type": "text", "text": "a"}, {"type": "text", "text": "b"}]) == "a b"

    def test_list_with_non_text_dict_skipped(self):
        assert extract_text([{"type": "image_url", "image_url": "x"}, "c"]) == "c"

    def test_empty_list_members_stripped(self):
        assert extract_text(["", "  "]) is None

    def test_other_types_return_none(self):
        assert extract_text(123) is None


class TestStripInternalFields:
    def test_tool_messages_drop_name(self):
        messages = [
            {"role": "tool", "name": "n", "tool_call_id": "c", "content": "{}"},
            {"role": "user", "content": "hi"},
        ]
        cleaned = strip_internal_fields(messages)
        assert cleaned[0] == {"role": "tool", "tool_call_id": "c", "content": "{}"}
        assert cleaned[1] == {"role": "user", "content": "hi"}

    def test_other_messages_copied(self):
        messages = [{"role": "user", "content": "hi"}]
        cleaned = strip_internal_fields(messages)
        assert cleaned == [{"role": "user", "content": "hi"}]
        assert cleaned[0] is not messages[0]


class TestBuildAssistantMessage:
    def test_builds_full_message(self):
        response = ToolCallResponse(
            content="text",
            tool_calls=[
                ToolCall(id="c1", name="search_contacts", arguments={"limit": 3}, thought_signature="sig")
            ],
        )
        message = build_assistant_message(response)
        assert message["role"] == "assistant"
        assert message["content"] == "text"
        assert message["tool_calls"][0] == {
            "id": "c1",
            "type": "function",
            "function": {
                "name": "search_contacts",
                "arguments": '{"limit": 3}',
                "thought_signature": "sig",
            },
        }

    def test_no_tool_calls(self):
        message = build_assistant_message(ToolCallResponse(content="plain"))
        assert message["tool_calls"] == []