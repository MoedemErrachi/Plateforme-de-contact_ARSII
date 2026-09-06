from __future__ import annotations

import json
import types

import httpx
import pytest
from pydantic import ValidationError

from app.models.filters import ContactFilters
from app.tools import tools as tools_module
from app.tools.tools import (
    AggregationArgs,
    ContactSummaryArgs,
    CountTempEmailsArgs,
    ImportAuditArgs,
    SearchContactsArgs,
    TOOLS_BY_NAME,
    TOOL_SPECS,
    ToolRunner,
    ToolSpec,
    _api_get,
    _clean_contact,
    _count_temp_emails,
    _dereference_json_schema,
    _error_payload,
    _extract_contacts_list,
    _filters_params,
    _get_aggregation,
    _get_contact_summary,
    _get_import_audit,
    _is_error,
    _search_contacts,
    _total_count,
)
from app.tests._fakes import FakeAsyncClient, FakeResponse


class TestArgsModels:
    def test_search_contacts_defaults(self):
        args = SearchContactsArgs()
        assert args.limit == 50
        assert isinstance(args.filters, ContactFilters)

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

    def test_count_temp_emails(self):
        assert CountTempEmailsArgs().model_dump() == {}


class TestSmallHelpers:
    def test_filters_params(self):
        filters = ContactFilters(countryOfOrigin="Sénégal", gender=None)
        assert _filters_params(filters) == {"countryOfOrigin": "Sénégal"}

    def test_error_payload(self):
        payload = _error_payload(404, {"detail": "nope"})
        assert payload["error"] is True
        assert payload["error_type"] == "api_error"
        assert payload["status_code"] == 404
        assert "hint" in payload

    def test_is_error(self):
        assert _is_error({"error": True}) is True
        assert _is_error({"error": False}) is False
        assert _is_error([]) is False
        assert _is_error("x") is False

    def test_clean_contact(self):
        contact = {"id": "1", "created_at": "x", "updatedAt": "y", "name": "A"}
        assert _clean_contact(contact) == {"id": "1", "name": "A"}
        assert _clean_contact("not-a-dict") == {}

    def test_extract_contacts_list(self):
        assert _extract_contacts_list([{"id": "1"}]) == [{"id": "1"}]
        assert _extract_contacts_list({"contacts": [{"id": "1"}]}) == [{"id": "1"}]
        assert _extract_contacts_list({"data": [{"id": "1"}]}) == [{"id": "1"}]
        assert _extract_contacts_list({"data": {"contacts": [{"id": "1"}]}}) == [{"id": "1"}]
        assert _extract_contacts_list({"data": {"other": []}}) == []
        assert _extract_contacts_list("x") == []
        assert _extract_contacts_list({}) == []

    def test_total_count(self):
        assert _total_count({"total_count": 7}, 0) == 7
        assert _total_count({"total": 8}, 0) == 8
        assert _total_count({"pagination": {"totalRecords": 9}}, 0) == 9
        assert _total_count({"total_count": "x"}, 5) == 5
        assert _total_count({"pagination": {}}, 5) == 5
        assert _total_count([], 5) == 5
        assert _total_count({"pagination": "x"}, 5) == 5
        assert _total_count({"total_count": None, "pagination": None}, 5) == 5


class TestApiGet:
    async def test_success_with_token(self):
        client = FakeAsyncClient(results=[FakeResponse(json_data={"ok": True})])
        data = await _api_get(client, "tok", "/api/contacts", {"limit": 1})
        assert data == {"ok": True}
        args, kwargs = client.calls[0]
        assert args[0] == "/api/contacts"
        assert kwargs["headers"]["Authorization"] == "Bearer tok"
        assert kwargs["params"] == {"limit": 1}

    async def test_success_without_token(self):
        client = FakeAsyncClient(results=[FakeResponse(json_data={})])
        await _api_get(client, None, "/api/contacts")
        _, kwargs = client.calls[0]
        assert "Authorization" not in kwargs["headers"]

    async def test_http_status_error_with_json(self):
        client = FakeAsyncClient(results=[FakeResponse(status_code=422, json_data={"detail": "bad"})])
        payload = await _api_get(client, None, "/x")
        assert payload["error"] is True
        assert payload["status_code"] == 422
        assert payload["detail"] == {"detail": "bad"}

    async def test_http_status_error_with_text_fallback(self):
        response = FakeResponse(status_code=500, text="internal boom")
        response._json_data = None

        def _bad_json():
            raise ValueError("no JSON payload")

        response.json = _bad_json
        client = FakeAsyncClient(results=[response])
        payload = await _api_get(client, None, "/x")
        assert payload["status_code"] == 500
        assert payload["detail"] == "internal boom"

    async def test_network_error(self):
        client = FakeAsyncClient(results=[httpx.ConnectError("unreachable")])
        payload = await _api_get(client, None, "/x")
        assert payload["error_type"] == "network_error"
        assert payload["status_code"] is None


class TestHandlers:
    async def test_search_contacts_success(self):
        client = FakeAsyncClient(
            results=[
                FakeResponse(
                    json_data={
                        "total_count": 3,
                        "contacts": [
                            {"id": "1", "created_at": "z", "name": "A"},
                            {"id": "2", "name": "B"},
                        ],
                    }
                )
            ]
        )
        args = SearchContactsArgs(filters={"countryOfOrigin": "Sénégal"}, limit=5)
        result = await _search_contacts(client, "tok", args)
        assert result["total_count"] == 3
        assert result["limit"] == 5
        assert result["returned"] == 2
        assert "created_at" not in result["contacts"][0]

    async def test_search_contacts_error_passthrough(self):
        client = FakeAsyncClient(results=[FakeResponse(status_code=500, json_data={"detail": "x"})])
        result = await _search_contacts(client, None, SearchContactsArgs())
        assert result["error"] is True

    async def test_get_contact_summary_success(self):
        client = FakeAsyncClient(
            results=[FakeResponse(json_data={"contact": {"firstName": "A", "lastName": "B", "researchCareerStage": "R4"}})]
        )
        result = await _get_contact_summary(client, None, ContactSummaryArgs(contact_id="c1"))
        assert result["contact_id"] == "c1"
        assert "A B —" in result["summary"]

    async def test_get_contact_summary_missing_fields(self):
        client = FakeAsyncClient(results=[FakeResponse(json_data={"contact": {}})])
        result = await _get_contact_summary(client, None, ContactSummaryArgs(contact_id="c1"))
        assert "Inconnu" in result["summary"]
        assert "fonction non renseignée" in result["summary"]

    async def test_get_contact_summary_wrong_shape(self):
        client = FakeAsyncClient(results=[FakeResponse(json_data={"contact": "not-a-dict"})])
        result = await _get_contact_summary(client, None, ContactSummaryArgs(contact_id="c1"))
        assert result["error"] is True

    async def test_get_contact_summary_direct_data(self):
        client = FakeAsyncClient(results=[FakeResponse(json_data={"firstName": "X"})])
        result = await _get_contact_summary(client, None, ContactSummaryArgs(contact_id="c1"))
        assert result["contact"] == {"firstName": "X"}

    async def test_get_contact_summary_error(self):
        client = FakeAsyncClient(results=[FakeResponse(status_code=404, json_data={"detail": "nf"})])
        result = await _get_contact_summary(client, None, ContactSummaryArgs(contact_id="c1"))
        assert result["error"] is True

    async def test_get_aggregation(self):
        client = FakeAsyncClient(results=[FakeResponse(json_data={"Senegal": 1})])
        result = await _get_aggregation(client, None, AggregationArgs(group_by="countryOfOrigin"))
        assert result == {"group_by": "countryOfOrigin", "aggregation": {"Senegal": 1}}

    async def test_get_aggregation_error(self):
        client = FakeAsyncClient(results=[FakeResponse(status_code=503, json_data={})])
        result = await _get_aggregation(client, None, AggregationArgs(group_by="gender"))
        assert result["error"] is True

    async def test_get_import_audit(self):
        client = FakeAsyncClient(results=[FakeResponse(json_data={"count": 1})])
        result = await _get_import_audit(client, None, ImportAuditArgs(period="month"))
        assert result == {"period": "month", "audit": {"count": 1}}

    async def test_get_import_audit_error(self):
        client = FakeAsyncClient(results=[FakeResponse(status_code=500, json_data={})])
        result = await _get_import_audit(client, None, ImportAuditArgs(period="day"))
        assert result["error"] is True

    async def test_count_temp_emails(self):
        client = FakeAsyncClient(results=[FakeResponse(json_data={"count": 4})])
        result = await _count_temp_emails(client, None, CountTempEmailsArgs())
        assert result == {"email_pattern": "import_null_", "count": {"count": 4}}

    async def test_count_temp_emails_error(self):
        client = FakeAsyncClient(results=[FakeResponse(status_code=500, json_data={})])
        result = await _count_temp_emails(client, None, CountTempEmailsArgs())
        assert result["error"] is True


class TestDereferenceJsonSchema:
    def test_plain_schema(self):
        schema = {"type": "object", "properties": {"a": {"type": "string"}}}
        assert _dereference_json_schema(schema) == schema

    def test_nested_ref_inlined(self):
        schema = {
            "type": "object",
            "$defs": {
                "ContactFilters": {
                    "type": "object",
                    "properties": {"countryOfOrigin": {"type": "string"}},
                }
            },
            "properties": {"filters": {"$ref": "#/$defs/ContactFilters"}},
        }
        result = _dereference_json_schema(schema)
        properties = result["properties"]["filters"]
        assert "countryOfOrigin" in properties["properties"]
        assert "$defs" not in result

    def test_cyclic_ref_stripped(self):
        schema = {
            "type": "object",
            "$defs": {"A": {"type": "object", "properties": {"self": {"$ref": "#/$defs/A"}}}},
            "properties": {"a": {"$ref": "#/$defs/A"}},
        }
        result = _dereference_json_schema(schema)
        assert "self" in result["properties"]["a"]["properties"]
        assert "$ref" not in result["properties"]["a"]["properties"]["self"]

    def test_missing_ref_kept_without_ref_key(self):
        schema = {"type": "object", "properties": {"x": {"$ref": "#/$defs/Unknown"}}}
        result = _dereference_json_schema(schema)
        assert result["properties"]["x"] == {}

    def test_list_nodes_processed(self):
        schema = {"type": "object", "properties": {"items": [{"$ref": "#/$defs/Unknown"}]}}
        result = _dereference_json_schema(schema)
        assert result["properties"]["items"] == [{}]


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

    def test_specs_registry(self):
        assert {spec.name for spec in TOOL_SPECS} == {
            "search_contacts",
            "get_contact_summary",
            "get_aggregation",
            "get_import_audit",
            "count_temp_emails",
        }
        assert TOOLS_BY_NAME["search_contacts"].description


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