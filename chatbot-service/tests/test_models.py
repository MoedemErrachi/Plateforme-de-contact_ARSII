from __future__ import annotations

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.filters import ContactFilters
from app.models.schemas import ChatAction, ChatRequest


class TestChatRequest:
    def test_empty_message_rejected(self):
        with pytest.raises(ValidationError):
            ChatRequest(session_id=uuid4(), message="")

    def test_too_long_message_rejected(self):
        with pytest.raises(ValidationError):
            ChatRequest(session_id=uuid4(), message="x" * 4001)

    def test_invalid_session_id_rejected(self):
        with pytest.raises(ValidationError):
            ChatRequest(session_id="not-a-uuid", message="Bonjour")


class TestChatAction:
    def test_invalid_type_rejected(self):
        with pytest.raises(ValidationError):
            ChatAction(type="nope")


class TestContactFilters:
    def test_invalid_stage_rejected(self):
        with pytest.raises(ValidationError):
            ContactFilters(researchCareerStage="R9")

    def test_invalid_gender_rejected(self):
        with pytest.raises(ValidationError):
            ContactFilters(gender="UNKNOWN")