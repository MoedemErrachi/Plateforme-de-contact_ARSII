from __future__ import annotations

import time
import uuid

import jwt as pyjwt
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.providers.base import ToolCall, ToolCallResponse
from app.routes import chatbot_routes
from app.routes.chatbot_routes import (
    _final_response,
    _require_bearer_token,
    _run_tool_rounds,
    help_response,
    normalize_text,
    router as chatbot_router,
    should_short_circuit,
)

app = FastAPI()
app.include_router(chatbot_router)
client = TestClient(app)

SECRET = "test-secret"


def _token(exp=None) -> str:
    payload = {"sub": "u1"}
    if exp is not None:
        payload["exp"] = exp
    return pyjwt.encode(payload, SECRET, algorithm="HS256")


class _FakeRouter:
    def __init__(self, responses=None, final=None, chat_error=None, final_error=None):
        self._responses = list(responses or [])
        self._final = final if final is not None else None
        self.chat_error = chat_error
        self.final_error = final_error
        self.chat_calls = 0
        self.final_calls = 0

    async def chat(self, messages, tools):
        self.chat_calls += 1
        if self.chat_error is not None:
            raise self.chat_error
        if self._responses:
            return self._responses.pop(0)
        return ToolCallResponse(content="default")

    async def chat_final(self, messages):
        self.final_calls += 1
        if self.final_error is not None:
            raise self.final_error
        return self._final if self._final is not None else "{}"


class _FakeToolRunner:
    def __init__(self, output='{"ok": true}'):
        self.output = output
        self.calls = []

    async def execute(self, name, arguments, token):
        self.calls.append((name, arguments, token))
        return self.output


def _post_message(message, headers=None):
    return client.post(
        "/api/chatbot/message",
        json={"session_id": str(uuid.uuid4()), "message": message},
        headers=headers,
    )


class TestNormalizeText:
    def test_lowercase_strip_spaces(self):
        assert normalize_text("  Bonjour  MONDE ") == "bonjour monde"

    def test_accents_and_punctuation(self):
        assert normalize_text("Département, Sénégal ?") == "departement, senegal ?"


class TestShouldShortCircuit:
    def test_greeting(self):
        assert should_short_circuit("Bonjour")
        assert should_short_circuit("bonjour!")
        assert should_short_circuit("salut.")
        assert should_short_circuit("hello")

    def test_help_marker(self):
        assert should_short_circuit("Que puis-je faire ?")
        assert should_short_circuit("comment ça marche")
        assert should_short_circuit("j'ai besoin d'aide")

    def test_normal_question(self):
        assert not should_short_circuit("Quels sont les chercheurs du Sénégal ?")


class TestHelpResponse:
    def test_content(self):
        response = help_response()
        assert response.message.startswith("Bonjour")
        assert response.actions == []


class TestRequireBearerToken:
    def test_missing(self):
        with pytest.raises(HTTPException) as exc_info:
            _require_bearer_token(None)
        assert exc_info.value.status_code == 401

    def test_not_bearer(self):
        with pytest.raises(HTTPException) as exc_info:
            _require_bearer_token("Token abc")
        assert exc_info.value.status_code == 401

    def test_empty_token(self):
        with pytest.raises(HTTPException) as exc_info:
            _require_bearer_token("Bearer    ")
        assert exc_info.value.status_code == 401

    def test_missing_jwt_secret(self, monkeypatch):
        monkeypatch.delenv("JWT_SECRET", raising=False)
        with pytest.raises(HTTPException) as exc_info:
            _require_bearer_token(f"Bearer {_token()}")
        assert exc_info.value.status_code == 503

    def test_expired(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        with pytest.raises(HTTPException) as exc_info:
            _require_bearer_token(f"Bearer {_token(exp=int(time.time()) - 60)}")
        assert exc_info.value.status_code == 401

    def test_invalid_token(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        with pytest.raises(HTTPException) as exc_info:
            _require_bearer_token("Bearer not-a-jwt")
        assert exc_info.value.status_code == 401

    def test_valid(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        assert _require_bearer_token(f"Bearer {_token()}") == _token()


class TestRunToolRounds:
    async def test_no_tool_calls_returns_content(self, monkeypatch):
        router = _FakeRouter(responses=[ToolCallResponse(content="final")])
        monkeypatch.setattr(chatbot_routes, "get_llm_router", lambda: router)
        messages = [{"role": "user", "content": "u"}]
        result = await _run_tool_rounds(messages, "tok")
        assert result == "final"
        assert router.chat_calls == 1

    async def test_tool_round_then_final(self, monkeypatch):
        router = _FakeRouter(
            responses=[
                ToolCallResponse(
                    content=None,
                    tool_calls=[ToolCall(id="c1", name="search_contacts", arguments={"limit": 1})],
                ),
                ToolCallResponse(content="done"),
            ]
        )
        runner = _FakeToolRunner()
        monkeypatch.setattr(chatbot_routes, "get_llm_router", lambda: router)
        monkeypatch.setattr(chatbot_routes, "tool_runner", runner)
        messages = [{"role": "user", "content": "u"}]
        result = await _run_tool_rounds(messages, "tok")
        assert result == "done"
        assert runner.calls == [("search_contacts", {"limit": 1}, "tok")]
        assert messages[-2]["role"] == "assistant"
        assert messages[-1]["role"] == "tool"
        assert messages[-1]["content"] == '{"ok": true}'

    async def test_max_rounds_reached_returns_none(self, monkeypatch):
        router = _FakeRouter(
            responses=[
                ToolCallResponse(tool_calls=[ToolCall(id="c1", name="n", arguments={})]),
                ToolCallResponse(tool_calls=[ToolCall(id="c2", name="n", arguments={})]),
            ]
        )
        monkeypatch.setattr(chatbot_routes, "get_llm_router", lambda: router)
        monkeypatch.setattr(chatbot_routes, "tool_runner", _FakeToolRunner())
        monkeypatch.setattr(chatbot_routes, "MAX_TOOL_ROUNDS", 2)
        result = await _run_tool_rounds([{"role": "user", "content": "u"}], "tok")
        assert result is None


class TestFinalResponse:
    async def test_none_content_uses_fallback(self, monkeypatch):
        router = _FakeRouter(final='{"message": "final"}')
        monkeypatch.setattr(chatbot_routes, "get_llm_router", lambda: router)
        response = await _final_response(None, [])
        assert response.message == "final"

    async def test_service_unavailable_degrade(self, monkeypatch):
        from app.exceptions import ServiceUnavailableError

        router = _FakeRouter(final_error=ServiceUnavailableError("down"))
        monkeypatch.setattr(chatbot_routes, "get_llm_router", lambda: router)
        response = await _final_response("phase1", [])
        assert response.message == "phase1"

    async def test_unexpected_error_degrade(self, monkeypatch):
        router = _FakeRouter(final_error=RuntimeError("boom"))
        monkeypatch.setattr(chatbot_routes, "get_llm_router", lambda: router)
        response = await _final_response("phase1", [])
        assert response.message == "phase1"


class TestEndpoints:
    def test_short_circuit_endpoint(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        response = _post_message("Bonjour", headers={"Authorization": f"Bearer {_token()}"})
        assert response.status_code == 200
        assert response.json()["message"].startswith("Bonjour ! Je suis l'assistant")
        assert response.json()["actions"] == []

    def test_missing_authorization(self):
        response = _post_message("Bonjour")
        assert response.status_code == 401

    def test_invalid_authorization(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        response = _post_message("Bonjour", headers={"Authorization": "Bearer garbage"})
        assert response.status_code == 401

    def test_missing_secret(self, monkeypatch):
        monkeypatch.delenv("JWT_SECRET", raising=False)
        response = _post_message("Bonjour", headers={"Authorization": f"Bearer {_token()}"})
        assert response.status_code == 503

    def test_full_flow(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        router = _FakeRouter(responses=[ToolCallResponse(content="interim")], final='{"message": "done", "actions": []}')
        monkeypatch.setattr(chatbot_routes, "get_llm_router", lambda: router)
        response = _post_message("Liste les chercheurs du Sénégal", headers={"Authorization": f"Bearer {_token()}"})
        assert response.status_code == 200
        assert response.json()["message"] == "done"
        assert router.chat_calls == 1
        assert router.final_calls == 1

    def test_tool_rounds_endpoint(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        router = _FakeRouter(
            responses=[
                ToolCallResponse(tool_calls=[ToolCall(id="c1", name="search_contacts", arguments={"limit": 1})]),
                ToolCallResponse(content="after tool"),
            ],
            final='{"message": "validated"}',
        )
        runner = _FakeToolRunner()
        monkeypatch.setattr(chatbot_routes, "get_llm_router", lambda: router)
        monkeypatch.setattr(chatbot_routes, "tool_runner", runner)
        response = _post_message(
            "Combien de chercheurs ont un email temporaire ?", headers={"Authorization": f"Bearer {_token()}"}
        )
        assert response.status_code == 200
        assert response.json()["message"] == "validated"
        assert runner.calls == [("search_contacts", {"limit": 1}, _token())]

    def test_tool_rounds_exhausted_fallback_message(self, monkeypatch):
        from app.exceptions import ServiceUnavailableError

        monkeypatch.setenv("JWT_SECRET", SECRET)
        router = _FakeRouter(
            responses=[
                ToolCallResponse(tool_calls=[ToolCall(id="c1", name="search_contacts", arguments={})]),
                ToolCallResponse(tool_calls=[ToolCall(id="c2", name="search_contacts", arguments={})]),
            ],
            final_error=ServiceUnavailableError("down"),
        )
        monkeypatch.setattr(chatbot_routes, "get_llm_router", lambda: router)
        monkeypatch.setattr(chatbot_routes, "tool_runner", _FakeToolRunner())
        monkeypatch.setattr(chatbot_routes, "MAX_TOOL_ROUNDS", 2)
        response = _post_message("Test", headers={"Authorization": f"Bearer {_token()}"})
        assert response.status_code == 200
        assert "Je n'ai pas pu terminer" in response.json()["message"]

    def test_unexpected_error_returns_500(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        router = _FakeRouter(chat_error=RuntimeError("boom"))
        monkeypatch.setattr(chatbot_routes, "get_llm_router", lambda: router)
        response = _post_message("Test", headers={"Authorization": f"Bearer {_token()}"})
        assert response.status_code == 500
        assert "interne" in response.json()["detail"]

    async def test_require_bearer_token_jwt_roundtrip(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", SECRET)
        returned = _require_bearer_token(f"Bearer {_token()}")
        assert returned == _token()