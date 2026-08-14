from __future__ import annotations

import json
import logging
from typing import Any, Literal, Optional

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.config import MAIN_API_BASE_URL
from app.models.filters import ContactFilters

logger = logging.getLogger(__name__)


class SearchContactsArgs(BaseModel):
    filters: ContactFilters = Field(default_factory=ContactFilters)
    limit: int = Field(50, ge=1, le=100)


class ContactSummaryArgs(BaseModel):
    contact_id: str = Field(..., description="Database id of the contact")


class AggregationArgs(BaseModel):
    group_by: Literal["gender", "countryOfOrigin", "facultyDepartment", "researchCareerStage"]
    filters: ContactFilters = Field(default_factory=ContactFilters)


class ImportAuditArgs(BaseModel):
    period: Literal["month", "week", "day"]


class CountTempEmailsArgs(BaseModel):
    pass


def _filters_params(filters: ContactFilters) -> dict:
    return filters.model_dump(exclude_none=True)


def _error_payload(status_code: Optional[int], detail: Any) -> dict:
    return {
        "error": True,
        "error_type": "api_error",
        "status_code": status_code,
        "detail": detail,
        "hint": "L'API principale a retourné une erreur. Reformulez la demande ou vérifiez les filtres.",
    }


async def _api_get(client: httpx.AsyncClient, token: Optional[str], path: str, params: Optional[dict] = None) -> Any:
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        response = await client.get(path, params=params, headers=headers)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        detail: Any = "HTTP error"
        try:
            detail = exc.response.json()
        except Exception:
            detail = exc.response.text[:500]
        return _error_payload(exc.response.status_code, detail)
    except httpx.RequestError as exc:
        return {
            "error": True,
            "error_type": "network_error",
            "status_code": None,
            "detail": str(exc),
            "hint": "L'API principale est injoignable.",
        }


def _is_error(data: Any) -> bool:
    return isinstance(data, dict) and bool(data.get("error"))


def _extract_contacts_list(data: Any) -> list[dict]:
    """Extraie le tableau de contacts, quelle que soit l'enveloppe de l'API.

    L'API principale renvoie `{status, data: {contacts: [...]}, pagination}`
    (contactController.getContacts) — le tableau est donc doublement imbriqué.
    On gère aussi les formes plates `[...]`, `{contacts: [...]}` et `{data: [...]}`.
    """
    if isinstance(data, list):
        return data
    if not isinstance(data, dict):
        return []
    direct = data.get("contacts")
    if isinstance(direct, list):
        return direct
    nested = data.get("data")
    if isinstance(nested, list):
        return nested
    if isinstance(nested, dict):
        contacts = nested.get("contacts")
        if isinstance(contacts, list):
            return contacts
    return []


def _total_count(data: Any, fallback: int) -> int:
    if isinstance(data, dict):
        explicit = data.get("total_count", data.get("total"))
        if isinstance(explicit, int):
            return explicit
        pagination = data.get("pagination") or {}
        if isinstance(pagination, dict):
            total = pagination.get("totalRecords")
            if isinstance(total, int):
                return total
    return fallback


# Champs internes de la base exclus du payload envoyé au LLM (bruit non sémantique).
_DB_INTERNAL_FIELDS = frozenset({"created_at", "updated_at", "createdAt", "updatedAt"})


def _clean_contact(contact: Any) -> dict:
    """Conserve toutes les informations du contact, hormis les artefacts internes DB."""
    if not isinstance(contact, dict):
        return {}
    return {key: value for key, value in contact.items() if key not in _DB_INTERNAL_FIELDS}


async def _search_contacts(client: httpx.AsyncClient, token: Optional[str], args: SearchContactsArgs) -> dict:
    params = {**_filters_params(args.filters), "limit": args.limit}
    data = await _api_get(client, token, "/api/contacts", params)
    if _is_error(data):
        return data
    items = _extract_contacts_list(data)
    clean_items = [_clean_contact(contact) for contact in items]
    returned = len(items)
    total = _total_count(data, returned)
    logger.info(
        "search_contacts: total=%s limit=%s raw_count=%d sent_count=%d",
        total,
        args.limit,
        returned,
        len(clean_items),
    )
    return {"total_count": total, "limit": args.limit, "returned": returned, "contacts": clean_items}


async def _get_contact_summary(client: httpx.AsyncClient, token: Optional[str], args: ContactSummaryArgs) -> dict:
    data = await _api_get(client, token, f"/api/contacts/{args.contact_id}")
    if _is_error(data):
        return data
    contact = data.get("contact", data) if isinstance(data, dict) else data
    if not isinstance(contact, dict):
        return {"error": True, "message": "Profil du contact introuvable."}
    first_name = contact.get("firstName") or ""
    last_name = contact.get("lastName") or ""
    name = f"{first_name} {last_name}".strip() or contact.get("name") or "Inconnu"
    stage = contact.get("researchCareerStage") or "Non renseigné"
    summary = (
        f"{name} — {contact.get('function') or 'fonction non renseignée'} "
        f"à {contact.get('affiliation') or 'affiliation non renseignée'} "
        f"({contact.get('countryOfOrigin') or 'pays non renseigné'}). "
        f"Département/faculté: {contact.get('facultyDepartment') or 'non renseigné'}. "
        f"Stade de carrière: {stage}. Email: {contact.get('email') or 'non renseigné'}."
    )
    return {"contact_id": args.contact_id, "summary": summary, "contact": contact}


async def _get_aggregation(client: httpx.AsyncClient, token: Optional[str], args: AggregationArgs) -> dict:
    params = {**_filters_params(args.filters), "group_by": args.group_by}
    data = await _api_get(client, token, "/api/stats/aggregation", params)
    if _is_error(data):
        return data
    return {"group_by": args.group_by, "aggregation": data}


async def _get_import_audit(client: httpx.AsyncClient, token: Optional[str], args: ImportAuditArgs) -> dict:
    data = await _api_get(client, token, "/api/export/log", {"period": args.period})
    if _is_error(data):
        return data
    return {"period": args.period, "audit": data}


async def _count_temp_emails(client: httpx.AsyncClient, token: Optional[str], args: CountTempEmailsArgs) -> dict:
    data = await _api_get(client, token, "/api/contacts/count", {"email_pattern": "import_null_"})
    if _is_error(data):
        return data
    return {"email_pattern": "import_null_", "count": data}


class ToolSpec:
    def __init__(self, name: str, description: str, args_model: type[BaseModel], handler: Any):
        self.name = name
        self.description = description
        self.args_model = args_model
        self.handler = handler

    def to_openai_tool(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": _dereference_json_schema(self.args_model.model_json_schema()),
            },
        }


def _dereference_json_schema(schema: dict[str, Any]) -> dict[str, Any]:
    definitions = dict(schema.get("$defs", {}))
    definitions.update(schema.get("definitions", {}))

    def inline(node: Any, visiting: frozenset[str] = frozenset()) -> Any:
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str) and ref.startswith("#/$defs/"):
                name = ref[len("#/$defs/"):]
                target = definitions.get(name)
                if target is not None and name not in visiting:
                    base = inline(target, visiting | {name})
                    merged = {**base, **{k: v for k, v in node.items() if k != "$ref"}}
                    return merged
                return {k: v for k, v in node.items() if k != "$ref"}
            return {k: inline(v, visiting) for k, v in node.items() if k not in ("$defs", "definitions")}
        if isinstance(node, list):
            return [inline(item, visiting) for item in node]
        return node

    return inline(schema)


TOOL_SPECS: list[ToolSpec] = [
    ToolSpec(
        name="search_contacts",
        description=(
            "Recherche des contacts (chercheurs) dans le CRM selon des filtres optionnels: countryOfOrigin, "
            "affiliation, facultyDepartment, researchCareerStage, gender. Retourne total_count, limit, returned et contacts."
        ),
        args_model=SearchContactsArgs,
        handler=_search_contacts,
    ),
    ToolSpec(
        name="get_contact_summary",
        description="Récupère le profil complet d'un chercheur par son id (contact_id) et en produit une synthèse lisible.",
        args_model=ContactSummaryArgs,
        handler=_get_contact_summary,
    ),
    ToolSpec(
        name="get_aggregation",
        description=(
            "Récupère des statistiques agrégées de la base, groupées par gender, countryOfOrigin, "
            "facultyDepartment ou researchCareerStage, avec filtres optionnels."
        ),
        args_model=AggregationArgs,
        handler=_get_aggregation,
    ),
    ToolSpec(
        name="get_import_audit",
        description="Récupère le journal des importations de contacts pour une période donnée (month, week ou day).",
        args_model=ImportAuditArgs,
        handler=_get_import_audit,
    ),
    ToolSpec(
        name="count_temp_emails",
        description="Compte les contacts créés automatiquement lors des importations (emails temporaires import_null_).",
        args_model=CountTempEmailsArgs,
        handler=_count_temp_emails,
    ),
]

TOOLS_BY_NAME: dict[str, ToolSpec] = {spec.name: spec for spec in TOOL_SPECS}
TOOL_DEFINITIONS: list[dict] = [spec.to_openai_tool() for spec in TOOL_SPECS]


class ToolRunner:
    def __init__(self, base_url: str = MAIN_API_BASE_URL):
        self.base_url = base_url
        self._client: httpx.AsyncClient | None = None

    async def start(self) -> None:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(30.0),
                follow_redirects=True,
            )

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def execute(self, name: str, arguments: dict, token: Optional[str]) -> str:
        spec = TOOLS_BY_NAME.get(name)
        if spec is None:
            return json.dumps({"error": True, "error_type": "unknown_tool", "message": f"Outil inconnu: {name}"}, ensure_ascii=False)
        try:
            args = spec.args_model.model_validate(arguments)
        except ValidationError as exc:
            payload = {"error": True, "error_type": "validation_error", "message": "Arguments d'outil invalides.", "details": exc.errors()}
            return json.dumps(payload, ensure_ascii=False, default=str)
        if self._client is None:
            await self.start()
        result = await spec.handler(self._client, token, args)
        return json.dumps(result, ensure_ascii=False, default=str)
