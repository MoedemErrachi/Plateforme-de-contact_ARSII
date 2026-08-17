"""Suite d'évaluation du chatbot CRM.

Cas A-J : comportement général (greeting, pays, filtres combinés, statistiques,
imports, emails temporaires, profil, multi-tours, résultat vide, structure).
Cas K-P : recherche tolérante affiliation / facultyDepartment (casse et accents
ignorés, sous-chaîne) — validée en live contre l'API principale.

Le filtre « J » (structure) n'est pas un cas isolé : il est rapporté comme
agrégat de la validité structurelle de la réponse finale sur tous les cas
(message non vide, non dégradé vers GENERIC_FALLBACK, non brut JSON).

Les providers évalués sont le miroir de la chaîne de production
(build_default_providers) : Mistral, Groq, Gemini(GEMINI_MODEL) puis, si
configuré différemment, Gemini(GEMINI_FALLBACK_MODEL) en dernier recours.

Usage:
    python scripts/model_evaluation.py [--cases A,B,K-P] [--providers mistral,groq]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import re
import sys
import unicodedata
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import GEMINI_FALLBACK_MODEL, GEMINI_MODEL, MAIN_API_BASE_URL
from app.exceptions import ServiceUnavailableError
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.providers.base import build_assistant_message
from app.providers.gemini_provider import GeminiProvider
from app.providers.groq_provider import GroqProvider
from app.providers.llm_router import LLMRouter
from app.providers.mistral_provider import MistralProvider
from app.services.validation import GENERIC_FALLBACK, build_final_text_messages, validate_final_response
from app.tools.tools import TOOL_DEFINITIONS, ToolRunner

logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")

TIMEOUT = 20
MAX_ROUNDS = 4
MAX_RETRIES = 5
RETRY_BACKOFF = [2.0, 4.0, 8.0, 15.0, 25.0]
_RETRY_RE = re.compile(r"retry in ([\d.]+)s", re.IGNORECASE)
_RATE_LIMIT_MARKERS = (
    "429",
    "503",
    "rate limit",
    "rate_limit",
    "resource_exhausted",
    "high demand",
)
# Quota quotidienne (ex. free-tier Gemini "PerDayPerProject", Groq "tokens per day") :
# non transitoire, un retry/backoff ne sert à rien.
_DAY_QUOTA_MARKERS = ("perday", "tokens per day", "per day")

# Miroir de la chaîne de production (build_default_providers) :
# Mistral -> Groq -> Gemini(GEMINI_MODEL) -> Gemini(GEMINI_FALLBACK_MODEL) [dernier].
PROVIDERS: list[tuple[str, object]] = [
    ("mistral", MistralProvider()),
    ("groq", GroqProvider()),
    ("gemini", GeminiProvider(model=GEMINI_MODEL)),
]
if GEMINI_FALLBACK_MODEL and GEMINI_FALLBACK_MODEL != GEMINI_MODEL:
    PROVIDERS.append(("gemini-fallback", GeminiProvider(model=GEMINI_FALLBACK_MODEL)))


def fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text or "")
    return "".join(c for c in decomposed if not unicodedata.combining(c)).lower()


def _fetch_api_token() -> str | None:
    """Authentifie le harness auprès de l'API principale (JWT admin) pour que les
    outils protégés (stats/aggregation, export/log, contacts/count) répondent 200."""
    try:
        response = httpx.post(
            f"{MAIN_API_BASE_URL}/api/auth/login",
            json={"email": "admin@arsii.org", "password": "admin123"},
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
        token = (payload.get("token") or (payload.get("data") or {}).get("token")) if isinstance(payload, dict) else None
        if token:
            return str(token)
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).warning("Impossible de s'authentifier auprès de l'API principale: %s", exc)
    return None


def _looks_like_json(text: str) -> bool:
    candidate = text.strip()
    if candidate.startswith("```"):
        candidate = candidate.lstrip("`").strip()
    return candidate.startswith("{") or candidate.startswith("[")


async def _call_router(router: LLMRouter, kind: str, *args):
    """Appelle router.chat / router.chat_final avec retry + backoff adaptatif
    sur les erreurs transitoires de quota (429/503) rencontrées en évaluation
    (free-tier). Les autres erreurs remontent immédiatement."""
    last: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        if attempt:
            delay = RETRY_BACKOFF[min(attempt - 1, len(RETRY_BACKOFF) - 1)]
            match = _RETRY_RE.search(str(last))
            if match:
                try:
                    delay = max(delay, float(match.group(1)))
                except ValueError:
                    pass
            logging.getLogger(__name__).warning(
                "%s: retry %d/%d dans %.0fs (quota/503)",
                kind,
                attempt,
                MAX_RETRIES,
                delay,
            )
            await asyncio.sleep(delay)
        try:
            if kind == "chat":
                return await router.chat(*args)
            return await router.chat_final(*args)
        except ServiceUnavailableError as exc:
            message = str(exc).lower()
            if any(marker in message for marker in _DAY_QUOTA_MARKERS):
                raise ServiceUnavailableError(f"quota journalière atteinte (non réessayable): {exc}") from exc
            if not any(marker in message for marker in _RATE_LIMIT_MARKERS):
                raise
            last = exc
            continue
    assert last is not None
    raise ServiceUnavailableError(f"quota atteint après {MAX_RETRIES} retries: {last}") from last


async def run_conversation(runner: ToolRunner, router: LLMRouter, turns: list[str], token: str | None = None) -> list[dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    records: list[dict] = []
    for turn in turns:
        messages.append({"role": "user", "content": turn})
        record: dict = {
            "turn": turn,
            "tool_calls": [],
            "counts": [],
            "affiliations": [],
            "faculties": [],
            "final_content": None,
            "response": None,
            "struct_ok": False,
        }
        for _ in range(MAX_ROUNDS):
            result = await _call_router(router, "chat", messages, TOOL_DEFINITIONS, TIMEOUT)
            if not result.has_tool_calls:
                record["final_content"] = result.content
                break
            messages.append(build_assistant_message(result))
            for tool_call in result.tool_calls:
                record["tool_calls"].append({"name": tool_call.name, "arguments": dict(tool_call.arguments or {})})
                output = await runner.execute(tool_call.name, tool_call.arguments, token)
                try:
                    payload = json.loads(output)
                except (ValueError, TypeError):
                    payload = {"raw": output}
                if tool_call.name == "search_contacts" and not payload.get("error"):
                    record["counts"].append(int(payload.get("total_count") or 0))
                    for contact in payload.get("contacts") or []:
                        record["affiliations"].append(contact.get("affiliation"))
                        record["faculties"].append(contact.get("facultyDepartment"))
                if payload.get("error"):
                    record.setdefault("tool_errors", []).append(
                        {
                            "name": tool_call.name,
                            "status_code": payload.get("status_code"),
                            "error_type": payload.get("error_type"),
                        }
                    )
                messages.append({"role": "tool", "tool_call_id": tool_call.id, "name": tool_call.name, "content": output})
        else:
            record["final_content"] = record["final_content"] or "(limite de tours atteinte)"

        final_text = await _call_router(router, "chat_final", build_final_text_messages(messages), TIMEOUT)
        response = validate_final_response(final_text)
        record["response"] = response
        record["struct_ok"] = (
            bool(response.message.strip())
            and response.message != GENERIC_FALLBACK
            and not _looks_like_json(response.message)
        )
        messages.append({"role": "assistant", "content": response.message})
        records.append(record)
    return records


# ---------------------------------------------------------------- helpers

def _tool_args(rec: dict, name: str) -> dict | None:
    for call in rec["tool_calls"]:
        if call["name"] == name:
            return call["arguments"]
    return None


def _max_count(rec: dict) -> int | None:
    return max(rec["counts"]) if rec["counts"] else None


def _action_filter(rec: dict, action_type: str, key: str):
    for action in rec["response"].actions:
        if action.type == action_type and action.filters is not None:
            value = getattr(action.filters, key, None)
            if value is not None:
                return value
    return None


# ---------------------------------------------------------------- checks A-J

def check_greeting(rec: dict):
    if rec["tool_calls"]:
        return False, f"tool inattendu: {rec['tool_calls'][0]['name']}"
    if not rec["response"].message.strip():
        return False, "message vide"
    if rec["response"].actions:
        return False, "actions non vides"
    return True, "OK"


def check_country(rec: dict):
    args = _tool_args(rec, "search_contacts")
    if args is None:
        return False, "search_contacts non appelé"
    value = (args.get("filters") or {}).get("countryOfOrigin")
    if not value or fold(value) != "senegal":
        return False, f"countryOfOrigin inattendu: {value!r}"
    total = _max_count(rec)
    if total is None or total < 1:
        return False, f"total_count={total} (forme du pays rejetée par l'API)"
    return True, f"countryOfOrigin={value} total={total}"


def check_combined(rec: dict):
    args = _tool_args(rec, "search_contacts")
    if args is None:
        return False, "search_contacts non appelé"
    filters = args.get("filters") or {}
    if filters.get("gender") != "FEMALE":
        return False, f"gender={filters.get('gender')!r} (attendu FEMALE)"
    if filters.get("researchCareerStage") != "R2_RECOGNIZED":
        return False, f"researchCareerStage={filters.get('researchCareerStage')!r} (attendu R2_RECOGNIZED)"
    return True, "gender=FEMALE + R2_RECOGNIZED"


def check_aggregation(rec: dict):
    args = _tool_args(rec, "get_aggregation")
    if args is None:
        return False, "get_aggregation non appelé"
    group_by = args.get("group_by")
    if group_by != "countryOfOrigin":
        return False, f"group_by={group_by!r} (attendu countryOfOrigin)"
    errors = [e for e in rec.get("tool_errors", []) if e["name"] == "get_aggregation"]
    if errors:
        first = errors[0]
        return False, f"erreur API {first.get('status_code')} ({first.get('error_type')}) sur get_aggregation — endpoint absent côté serveur"
    return True, "get_aggregation countryOfOrigin (OK)"


def check_audit(rec: dict):
    args = _tool_args(rec, "get_import_audit")
    if args is None:
        return False, "get_import_audit non appelé"
    period = args.get("period")
    if period not in ("month", "week", "day"):
        return False, f"period={period!r}"
    return True, f"get_import_audit {period}"


def check_temp(rec: dict):
    if _tool_args(rec, "count_temp_emails") is None:
        return False, "count_temp_emails non appelé"
    return True, "count_temp_emails"


def check_profile(rec: dict, expected_id: str | None = None):
    args = _tool_args(rec, "get_contact_summary")
    if args is None:
        return False, "get_contact_summary non appelé"
    cid = args.get("contact_id")
    if expected_id is not None and cid != expected_id:
        return False, f"contact_id={cid!r} (attendu {expected_id!r})"
    return True, f"get_contact_summary {cid}"


def check_multi(recs: list[dict]):
    if len(recs) != 2:
        return False, f"{len(recs)} tours (attendu 2)"
    if _tool_args(recs[0], "search_contacts") is None:
        return False, "tour 1 sans search_contacts"
    args = _tool_args(recs[1], "search_contacts")
    if args is None:
        return False, "tour 2 sans search_contacts (filtre genre attendu)"
    filters = args.get("filters") or {}
    if filters.get("gender") != "MALE":
        return False, f"tour 2 gender={filters.get('gender')!r} (attendu MALE)"
    return True, "tour 1 pays, tour 2 genre=MALE"


def check_empty(rec: dict):
    args = _tool_args(rec, "search_contacts")
    if args is None:
        return False, "search_contacts non appelé"
    total = _max_count(rec)
    if total != 0:
        return False, f"total_count={total} (attendu 0)"
    message = (rec["response"].message or "").lower()
    if not any(token in message for token in ("aucun", "0", "antarctique")):
        return False, "message sans mention de l'absence de résultat"
    return True, "total=0, réponse honnête"


# ---------------------------------------------------------------- checks K-P

def check_affiliation_min(rec: dict, minimum: int, label: str):
    args = _tool_args(rec, "search_contacts")
    if args is None:
        return False, "search_contacts non appelé"
    value = (args.get("filters") or {}).get("affiliation")
    if not value:
        return False, "filtre affiliation absent"
    total = _max_count(rec)
    if total is None or total < minimum:
        return False, f"total_count={total} < {minimum} (affiliation={value!r})"
    return True, f"affiliation={value!r} total={total}"


def check_faculty_min(rec: dict, minimum: int):
    args = _tool_args(rec, "search_contacts")
    if args is None:
        return False, "search_contacts non appelé"
    value = (args.get("filters") or {}).get("facultyDepartment")
    if not value:
        return False, "filtre facultyDepartment absent"
    total = _max_count(rec)
    if total is None or total < minimum:
        return False, f"total_count={total} < {minimum} (facultyDepartment={value!r})"
    return True, f"facultyDepartment={value!r} total={total}"


# ---------------------------------------------------------------- cases

CASES: dict[str, dict] = {
    "A": {"prompt": "salut", "check": check_greeting},
    "B": {"prompt": "cherche des chercheurs originaires du Sénégal", "check": check_country},
    "C": {"prompt": "combien y a-t-il de femmes en post-doctorat (stade R2) ?", "check": check_combined},
    "D": {"prompt": "donne-moi les statistiques de la base par pays", "check": check_aggregation},
    "E": {"prompt": "combien d'importations ont eu lieu ce mois-ci ?", "check": check_audit},
    "F": {"prompt": "combien de contacts temporaires ont été créés par les importations ?", "check": check_temp},
    "G": {"prompt_template": "profil du contact avec l'id {id}", "check": check_profile, "needs_id": True},
    "H": {"multi": True, "check": check_multi},
    "I": {"prompt": "liste les chercheurs originaires de l'Antarctique", "check": check_empty},
    "K": {"prompt": "cherche des chercheurs de l'université Cheikh Anta Diop", "check": lambda r: check_affiliation_min(r, 1, "K")},
    "L": {"prompt": "cherche des chercheurs de l'UCAD", "check": lambda r: check_affiliation_min(r, 2, "L")},
    "M": {"prompt": "cherche des chercheurs de l'universite cheikh anta diop", "check": lambda r: check_affiliation_min(r, 1, "M")},
    "N": {"prompt": "des contacts du département informatique", "check": lambda r: check_faculty_min(r, 1)},
    "O": {"prompt": "des contacts en informatique", "check": lambda r: check_faculty_min(r, 1)},
    "P": {"prompt": "des chercheurs en faculte des sciences", "check": lambda r: check_faculty_min(r, 1)},
}
CASE_ORDER = list(CASES)
ALL_CASES = "".join(CASE_ORDER)


def parse_cases(spec: str) -> list[str]:
    if not spec:
        return list(CASE_ORDER)
    out: list[str] = []
    for part in spec.split(","):
        part = part.strip().upper()
        if not part:
            continue
        if "-" in part:
            start, _, end = part.partition("-")
            if start in ALL_CASES and end in ALL_CASES:
                si, ei = ALL_CASES.index(start), ALL_CASES.index(end)
                out.extend(ALL_CASES[si : ei + 1])
        elif part in ALL_CASES:
            out.append(part)
    return [c for c in CASE_ORDER if c in out]


def parse_providers(spec: str) -> list[str]:
    if not spec:
        return [name for name, _ in PROVIDERS]
    wanted = {p.strip().lower() for p in spec.split(",") if p.strip()}
    return [name for name, _ in PROVIDERS if name in wanted]


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", default="", help="ex: A,B,K-P (défaut: tous)")
    parser.add_argument("--providers", default="", help="ex: mistral,groq (défaut: tous)")
    parser.add_argument("--delay", type=float, default=1.0, help="pause entre cas (s), défaut 1.0")
    args = parser.parse_args()

    selected_cases = parse_cases(args.cases)
    selected_providers = parse_providers(args.providers)

    runner = ToolRunner()
    await runner.start()

    token = _fetch_api_token()

    first_id: str | None = None
    try:
        output = await runner.execute("search_contacts", {"filters": {}, "limit": 1}, token)
        payload = json.loads(output)
        contacts = payload.get("contacts") or []
        if contacts:
            first_id = contacts[0].get("id")
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).warning("Id de contact indisponible pour le cas G: %s", exc)

    summary: dict[str, dict[str, tuple[bool | None, str, bool]]] = {}
    shown_last = selected_cases[-1] if selected_cases else ""
    for provider_name, provider in PROVIDERS:
        if provider_name not in selected_providers:
            continue
        router = LLMRouter(providers=[provider])
        print(f"\n=== {provider_name} ({getattr(provider, 'model', '')}) ===")
        for case_id in CASE_ORDER:
            if case_id not in selected_cases:
                continue
            spec = CASES[case_id]
            try:
                if spec.get("multi"):
                    recs = await run_conversation(
                        runner, router, ["cherche des contacts au Maroc", "seulement les hommes cette fois"], token
                    )
                    ok, detail = spec["check"](recs)
                    struct_ok = all(r["struct_ok"] for r in recs)
                else:
                    prompt = spec.get("prompt_template", spec.get("prompt"))
                    if spec.get("needs_id"):
                        if not first_id:
                            ok, detail, struct_ok = None, "id de contact indisponible (API injoignable)", False
                            summary.setdefault(provider_name, {})[case_id] = (ok, detail, struct_ok)
                            print(f"  {case_id}: SKIP  {detail}")
                            continue
                        prompt = prompt.format(id=first_id)
                    recs = await run_conversation(runner, router, [prompt], token)
                    if spec.get("needs_id"):
                        ok, detail = spec["check"](recs[0], first_id)
                    else:
                        ok, detail = spec["check"](recs[0])
                    struct_ok = recs[0]["struct_ok"]
            except Exception as exc:  # noqa: BLE001
                ok, detail, struct_ok = False, f"EXCEPTION {type(exc).__name__}: {exc}", False
            summary.setdefault(provider_name, {})[case_id] = (ok, detail, struct_ok)
            status = "PASS" if ok else ("SKIP" if ok is None else "FAIL")
            print(f"  {case_id}: {status}  {detail}")
            if case_id != shown_last:
                await asyncio.sleep(args.delay)

    await runner.aclose()

    print("\n===== RÉCAPITULATIF =====")
    shown_cases = [c for c in CASE_ORDER if c in selected_cases]
    print(f"{'provider':<18}" + "  ".join(f"{c:<3}" for c in shown_cases))
    for provider_name, _ in PROVIDERS:
        if provider_name not in selected_providers:
            continue
        cells: list[str] = []
        struct_total = 0
        struct_ok_count = 0
        for case_id in shown_cases:
            entry = summary.get(provider_name, {}).get(case_id)
            if entry is None:
                cells.append("?")
                continue
            ok, _, struct_ok = entry
            cells.append("+" if ok else ("?" if ok is None else "x"))
            struct_total += 1
            if struct_ok:
                struct_ok_count += 1
        print(f"{provider_name:<18}" + "  ".join(f"{c:<3}" for c in cells) + f"   struct {struct_ok_count}/{struct_total}")


if __name__ == "__main__":
    asyncio.run(main())
