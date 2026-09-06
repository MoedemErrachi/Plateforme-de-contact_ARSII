from __future__ import annotations

from app.providers.base import ToolCall
from app.services.validation import (
    FAILURE_COUNTER,
    FAILURE_EVENTS,
    GENERIC_FALLBACK,
    ToolValidationError,
    build_final_text_messages,
    record_failure,
    validate_final_response,
    validate_tool_call,
)


class _NoOptToolCall(ToolCall):
    pass


def _tool_call(name: str, arguments: dict | None = None, tool_id: str = "t1") -> ToolCall:
    return ToolCall(id=tool_id, name=name, arguments=arguments or {})


class TestRecordFailure:
    def test_records_counter_and_event(self, monkeypatch):
        import app.services.validation as validation

        monkeypatch.setattr(validation, "FAILURE_COUNTER", {})
        monkeypatch.setattr(validation, "FAILURE_EVENTS", [])
        record_failure("mistral", "provider_transport_error")
        assert validation.FAILURE_COUNTER == {"mistral|provider_transport_error": 1}
        assert len(validation.FAILURE_EVENTS) == 1
        assert validation.FAILURE_EVENTS[0]["provider"] == "mistral"
        record_failure("mistral", "provider_transport_error", note="timeout")
        assert validation.FAILURE_COUNTER["mistral|provider_transport_error"] == 2
        assert validation.FAILURE_EVENTS[-1]["note"] == "timeout"


class TestValidateToolCall:
    def test_valid_tool_call_passes_through(self):
        call = _tool_call("search_contacts", {"filters": {}, "limit": 5})
        assert validate_tool_call(call) is call

    def test_unknown_tool_raises(self):
        call = _tool_call("does_not_exist")
        with raise_exc(call, "outil inconnu"):
            validate_tool_call(call)

    def test_invalid_arguments_raise(self):
        call = _tool_call("search_contacts", {"limit": 9999})
        with raise_exc(call, "arguments invalides"):
            validate_tool_call(call)

    def test_error_summary(self):
        call = _tool_call("nope")
        try:
            validate_tool_call(call)
        except ToolValidationError as exc:
            assert "outil inconnu" in exc.reason
            assert "nope" in str(exc)


class TestValidateFinalResponse:
    def test_empty_content_returns_fallback(self):
        response = validate_final_response(None)
        assert response.message == GENERIC_FALLBACK
        assert response.actions == []

    def test_plain_text_preserved(self):
        response = validate_final_response("  Bonjour monde  ")
        assert response.message == "Bonjour monde"
        assert response.actions == []

    def test_valid_payload(self):
        response = validate_final_response('{"message": "ok", "actions": []}')
        assert response.message == "ok"
        assert response.actions == []

    def test_valid_payload_with_actions_and_filter_cleaning(self):
        payload = (
            '{"message": "m", "actions": [{"type": "view_filtered_list", '
            '"filters": {"countryOfOrigin": "Sénégal", "gender": null}}]}'
        )
        response = validate_final_response(payload)
        assert response.actions[0].filters.countryOfOrigin == "Sénégal"
        assert response.actions[0].filters.gender is None

    def test_payload_non_conform_with_message(self, monkeypatch):
        import app.services.validation as validation

        monkeypatch.setattr(validation, "FAILURE_COUNTER", {})
        response = validate_final_response('{"message": "partiel", "actions": [{"type": "not-valid"}]}')
        assert response.message == "partiel"
        assert response.actions == []
        assert validation.FAILURE_COUNTER.get("final|final_schema_degraded", 0) == 1

    def test_payload_non_conform_without_message(self, monkeypatch):
        import app.services.validation as validation

        monkeypatch.setattr(validation, "FAILURE_COUNTER", {})
        response = validate_final_response('{"notes": "x"}')
        assert response.message == GENERIC_FALLBACK
        assert validation.FAILURE_COUNTER.get("final|final_schema_degraded", 0) == 1

    def test_broken_json_with_extractable_message(self, monkeypatch):
        import app.services.validation as validation

        monkeypatch.setattr(validation, "FAILURE_COUNTER", {})
        response = validate_final_response('{"message": "Hello')
        assert response.message == "Hello"
        assert validation.FAILURE_COUNTER.get("final|final_schema_degraded", 0) == 1

    def test_broken_json_with_escaped_message(self, monkeypatch):
        import app.services.validation as validation

        response = validate_final_response('{"message": "Salut \\"ami\\"", "rest": ')
        assert response.message == 'Salut "ami"'
        assert response.actions == []

    def test_broken_json_no_message(self, monkeypatch):
        import app.services.validation as validation

        monkeypatch.setattr(validation, "FAILURE_COUNTER", {})
        response = validate_final_response('{"x": [1,')
        assert response.message == GENERIC_FALLBACK

    def test_non_dict_json_walks_all_candidates(self, monkeypatch):
        import app.services.validation as validation

        monkeypatch.setattr(validation, "FAILURE_COUNTER", {})
        response = validate_final_response("```json\n[1, 2, 3]\n```")
        assert response.message == GENERIC_FALLBACK

    def test_broken_json_with_invalid_escape(self, monkeypatch):
        import app.services.validation as validation

        monkeypatch.setattr(validation, "FAILURE_COUNTER", {})
        response = validate_final_response('{"message": "\\q"}')
        assert response.message == GENERIC_FALLBACK
        assert validation.FAILURE_COUNTER.get("final|final_schema_degraded", 0) == 1

    def test_action_without_filters_preserved(self):
        response = validate_final_response('{"message": "m", "actions": [{"type": "view_filtered_list"}]}')
        assert response.actions[0].type == "view_filtered_list"
        assert response.actions[0].filters is None

    def test_empty_system_content_skipped(self):
        flattened = build_final_text_messages([{"role": "system", "content": ""}])
        assert flattened == []


class TestBuildFinalTextMessages:
    def test_system_user_assistant_flow(self):
        messages = [
            {"role": "system", "content": "SYSTEM"},
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi"},
        ]
        assert build_final_text_messages(messages) == [
            {"role": "system", "content": "SYSTEM"},
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi"},
        ]

    def test_consecutive_roles_merged(self):
        messages = [
            {"role": "user", "content": "one"},
            {"role": "user", "content": "two"},
        ]
        assert build_final_text_messages(messages) == [
            {"role": "user", "content": "one\n\ntwo"}
        ]

    def test_empty_assistant_content_dropped_without_tool_calls(self):
        messages = [{"role": "assistant", "content": ""}, {"role": "user", "content": "u"}]
        assert build_final_text_messages(messages) == [{"role": "user", "content": "u"}]

    def test_tool_round_flattened_to_user_with_results(self):
        messages = [
            {"role": "user", "content": "Q"},
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "c1",
                        "function": {"name": "search_contacts", "arguments": '{"limit": 1}'},
                    }
                ],
            },
            {"role": "tool", "tool_call_id": "c1", "name": "search_contacts", "content": '{"total_count": 1}'},
        ]
        flattened = build_final_text_messages(messages)
        assert len(flattened) == 1
        assert flattened[0]["role"] == "user"
        assert "Q" in flattened[0]["content"]
        assert '[Outil: search_contacts({"limit": 1})]' in flattened[0]["content"]
        assert '{"total_count": 1}' in flattened[0]["content"]

    def test_tool_results_by_name_when_no_id(self):
        messages = [
            {"role": "tool", "name": "count_temp_emails", "content": '{"count": 5}'},
            {"role": "assistant", "tool_calls": [{"function": {"name": "count_temp_emails", "arguments": "{}"}}]},
        ]
        flattened = build_final_text_messages(messages)
        assert '{"count": 5}' in flattened[0]["content"]

    def test_tool_result_missing_produces_empty_result(self):
        messages = [
            {"role": "assistant", "tool_calls": [{"id": "c9", "function": {"name": "x", "arguments": "{}"}}]},
        ]
        flattened = build_final_text_messages(messages)
        assert "Résultat:" in flattened[0]["content"]

    def test_multiple_tool_calls_in_one_round(self):
        messages = [
            {
                "role": "assistant",
                "tool_calls": [
                    {"id": "a", "function": {"name": "t1", "arguments": "{}"}},
                    {"id": "b", "function": {"name": "t2", "arguments": '{"k": 1}'}},
                ],
            },
            {"role": "tool", "tool_call_id": "a", "content": "A"},
            {"role": "tool", "tool_call_id": "b", "content": "B"},
        ]
        flattened = build_final_text_messages(messages)
        assert "[Outil: t1({})" in flattened[0]["content"]
        assert "[Outil: t2({\"k\": 1})" in flattened[0]["content"]

    def test_duplicate_tool_ids_deduplicated(self):
        messages = [
            {"role": "tool", "tool_call_id": "a", "content": "A"},
            {"role": "tool", "tool_call_id": "a", "content": "A2"},
            {"role": "assistant", "tool_calls": [{"id": "a", "function": {"name": "t", "arguments": "{}"}}]},
        ]
        flattened = build_final_text_messages(messages)
        assert "A\n\n" not in flattened[0]["content"]


def raise_exc(call: ToolCall, needle: str):
    import contextlib

    @contextlib.contextmanager
    def _inner():
        try:
            yield
        except ToolValidationError as exc:
            assert exc.tool_call is call
            assert needle in exc.reason
            return
        raise AssertionError("ToolValidationError not raised")

    return _inner()