from __future__ import annotations

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.filters import ContactFilters
from app.models.schemas import ChatAction, ChatRequest, ChatResponse


class TestChatRequest:
    def test_valid(self):
        req = ChatRequest(session_id=uuid4(), message="Bonjour")
        assert req.message == "Bonjour"

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
    def test_valid_types(self):
        assert ChatAction(type="view_filtered_list").type == "view_filtered_list"
        assert ChatAction(type="export_csv").type == "export_csv"
        assert ChatAction(type="view_contact_profile").type == "view_contact_profile"

    def test_invalid_type_rejected(self):
        with pytest.raises(ValidationError):
            ChatAction(type="nope")

    def test_extra_keys_ignored(self):
        action = ChatAction(type="export_csv", unknown="x")
        assert action.type == "export_csv"
        assert not hasattr(action, "unknown")

    def test_filters_and_contact_id(self):
        action = ChatAction(type="view_contact_profile", contact_id="c1")
        assert action.contact_id == "c1"


class TestChatResponse:
    def test_default_actions_empty(self):
        response = ChatResponse(message="hello")
        assert response.message == "hello"
        assert response.actions == []

    def test_actions_populated(self):
        response = ChatResponse(message="hello", actions=[ChatAction(type="export_csv")])
        assert len(response.actions) == 1

    def test_extra_keys_ignored(self):
        response = ChatResponse(message="hello", nope=1)
        assert not hasattr(response, "nope")


class TestContactFilters:
    def test_defaults(self):
        filters = ContactFilters()
        assert filters.countryOfOrigin is None
        assert filters.affiliation is None
        assert filters.facultyDepartment is None
        assert filters.researchCareerStage is None
        assert filters.gender is None

    def test_valid_values(self):
        filters = ContactFilters(
            countryOfOrigin="Sénégal",
            affiliation="UCAD",
            facultyDepartment="Biologie",
            researchCareerStage="R2_RECOGNIZED",
            gender="FEMALE",
        )
        assert filters.model_dump(exclude_none=True) == {
            "countryOfOrigin": "Sénégal",
            "affiliation": "UCAD",
            "facultyDepartment": "Biologie",
            "researchCareerStage": "R2_RECOGNIZED",
            "gender": "FEMALE",
        }

    def test_invalid_stage_rejected(self):
        with pytest.raises(ValidationError):
            ContactFilters(researchCareerStage="R9")

    def test_invalid_gender_rejected(self):
        with pytest.raises(ValidationError):
            ContactFilters(gender="UNKNOWN")