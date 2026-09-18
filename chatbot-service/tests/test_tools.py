from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from app.tools import tools as tools_module
from app.tools.tools import (
    AggregationArgs,
    ContactSummaryArgs,
    ImportAuditArgs,
    SearchContactsArgs,
    ToolRunner,
    ToolSpec,
)
from _fakes import FakeAsyncClient, FakeResponse


class TestArgsModels:
    def test_search_contacts_validation(self):
        with pytest.raises(ValidationError):
            SearchContactsArgs(limit=0)
        with pytest.raises(ValidationError):
            SearchContactsArgs(limit=101)

    def test_contact_summary_required(self):
        with pytest.raises(ValidationError):
            ContactSummaryArgs()
        assert ContactSummaryArgs(contact_id="abc").contact_id == "abc"

    def test_aggregation_validation(self):
        assert AggregationArgs(group_by="gender").group_by == "gender"
        with pytest.raises(ValidationError):
            AggregationArgs(group_by="nope")

    def test_import_audit_validation(self):
        assert ImportAuditArgs(period="week").period == "week"
        with pytest.raises(ValidationError):
            ImportAuditArgs(period="year")


class TestToolSpec:
    def test_to_openai_tool(self):
        spec = ToolSpec(
            name="t",
            description="d",
            args_model=SearchContactsArgs,
            handler=lambda *a: None,
        )
        tool = spec.to_openai_tool()
        assert tool["type"] == "function"
        assert tool["function"]["name"] == "t"
        assert tool["function"]["description"] == "d"
        assert "$ref" not in json.dumps(tool)


class TestToolRunner:
    async def test_start_and_aclose(self):
        runner = ToolRunner(base_url="http://localhost:1")
        runner.start()
        assert runner._client is not None
        await runner.aclose()
        assert runner._client is None

    async def test_start_idempotent(self):
        runner = ToolRunner(base_url="http://localhost:1")
        runner.start()
        first = runner._client
        runner.start()
        assert runner._client is first
        await runner.aclose()

    async def test_aclose_without_client(self):
        runner = ToolRunner(base_url="http://localhost:1")
        await runner.aclose()
        assert runner._client is None

    async def test_execute_unknown_tool(self):
        runner = ToolRunner()
        output = await runner.execute("nope", {}, None)
        payload = json.loads(output)
        assert payload["error"] is True
        assert payload["error_type"] == "unknown_tool"

    async def test_execute_validation_error(self):
        runner = ToolRunner()
        output = await runner.execute("search_contacts", {"limit": 999}, None)
        payload = json.loads(output)
        assert payload["error"] is True
        assert payload["error_type"] == "validation_error"
        assert "details" in payload

    async def test_execute_success(self):
        client = FakeAsyncClient(results=[FakeResponse(json_data={"total_count": 1})])
        runner = ToolRunner()
        runner._client = client
        output = await runner.execute("search_contacts", {"limit": 1}, "tok")
        payload = json.loads(output)
        assert payload["total_count"] == 1

    async def test_execute_lazily_creates_client(self, monkeypatch):
        client = FakeAsyncClient(results=[FakeResponse(json_data={"count": 2})])
        monkeypatch.setattr(tools_module.httpx, "AsyncClient", lambda **kw: client)
        runner = ToolRunner()
        output = await runner.execute("count_temp_emails", {}, None)
        assert json.loads(output) == {"email_pattern": "import_null_", "count": {"count": 2}}