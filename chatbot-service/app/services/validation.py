from __future__ import annotations

import json
import logging
import re
from collections import deque
from datetime import datetime, timezone
from typing import Any, Match

from app.models.filters import ContactFilters
from app.models.schemas import ChatAction, ChatResponse
from app.providers.base import ToolCall
from app.tools.tools import TOOLS_BY_NAME

logger = logging.getLogger(__name__)

GENERIC_FALLBACK = (
    "Voici ce que j'ai trouvé, mais je n'ai pas pu formater la réponse correctement. "
    "Veuillez reformuler votre demande."
)

FAILURE_TRANSPORT = "provider_transport_error"
FAILURE_TOOL_CALL_INVALID = "tool_call_invalid"
FAILURE_FINAL_SCHEMA = "final_schema_degraded"
FAILURE_FINAL_ALL_FAILED = "chat_final_all_failed"

# Télémétrie des pivots et dégradations (en mémoire) — utile pour décider
# objectivement si un mode de sortie strict (ex. gpt-oss) se justifie.
FAILURE_COUNTER: dict[str, int] = {}
FAILURE_EVENTS: deque[dict] = deque(maxlen=500)

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)
# Accepte une valeur de "message" fermée ou tronquée (fin d'entrée sans guillemet fermant).
_MESSAGE_FIELD_RE = re.compile(r'"message"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)', re.DOTALL)


class ToolValidationError(ValueError):
    def __init__(self, tool_call: ToolCall, reason: str):
        self.tool_call = tool_call
        self.reason = reason
        super().__init__(f"Tool call invalide '{tool_call.name}': {reason}")


def record_failure(provider: str, failure_type: str, note: str | None = None) -> None:
    """Compte et journalise un échec (pivot de provider ou dégradation de sortie)."""
    key = f"{provider}|{failure_type}"
    FAILURE_COUNTER[key] = FAILURE_COUNTER.get(key, 0) + 1
    event: dict[str, Any] = {
        "provider": provider,
        "failure_type": failure_type,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    if note:
        event["note"] = note
    FAILURE_EVENTS.append(event)
    logger.warning("LLM failure telemetry: %s", event)


def validate_tool_call(tool_call: ToolCall) -> ToolCall:
    """Valide qu'un tool_call est exécutable (outil connu + arguments conformes)."""
    spec = TOOLS_BY_NAME.get(tool_call.name)
    if spec is None:
        raise ToolValidationError(
            tool_call,
            f"outil inconnu (disponibles: {', '.join(sorted(TOOLS_BY_NAME))})",
        )
    try:
        spec.args_model.model_validate(tool_call.arguments)
    except Exception as exc:
        raise ToolValidationError(tool_call, f"arguments invalides: {exc}") from exc
    return tool_call


def _looks_like_json(text: str) -> bool:
    candidate = text.strip()
    fence = _FENCE_RE.search(candidate)
    if fence:
        candidate = fence.group(1).strip()
    return candidate.startswith("{") or candidate.startswith("[")


def _extract_json_payload(text: str) -> dict | None:
    candidates: list[str] = [text.strip()]
    fence = _FENCE_RE.search(text)
    if fence:
        candidates.insert(0, fence.group(1).strip())
    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except (ValueError, TypeError):
            continue
        if isinstance(parsed, dict):
            return parsed
    return None


def _decode_message_field(match: Match[str] | None) -> str | None:
    if match is None:
        return None
    try:
        decoded = json.loads(f'"{match.group(1)}"')
    except (ValueError, TypeError):
        return None
    return decoded if isinstance(decoded, str) else None


def _clean_actions(response: ChatResponse) -> ChatResponse:
    """Retire les clés à valeur None des filtres d'actions (filtres plus propres)."""
    cleaned: list[ChatAction] = []
    for action in response.actions:
        if action.filters is not None:
            kept = {k: v for k, v in action.filters.model_dump().items() if v is not None}
            action.filters = ContactFilters.model_validate(kept)
        cleaned.append(action)
    response.actions = cleaned
    return response


def validate_final_response(content: str | None) -> ChatResponse:
    """Valide la sortie finale d'un LLM (phase 2) et produit toujours un ChatResponse.

    Échelle de dégradation (aucun JSON brut n'est jamais affiché à l'utilisateur):
    1. Validation stricte du payload JSON contre ChatResponse.
    2. Extraction partielle du champ "message" (payload parseable non conforme, ou
       JSON cassé) -> message seul, actions vides.
    3. Message de secours générique fixe (GENERIC_FALLBACK).
    Un texte libre non JSON est conservé tel quel comme message.
    """
    text = (content or "").strip()
    if not text:
        return ChatResponse(message=GENERIC_FALLBACK, actions=[])

    payload = _extract_json_payload(text)
    if payload is not None:
        try:
            return _clean_actions(ChatResponse.model_validate(payload))
        except Exception:
            message_value = payload.get("message")
            if isinstance(message_value, str) and message_value.strip():
                record_failure("final", FAILURE_FINAL_SCHEMA, note="payload non conforme, message seul conservé")
                return ChatResponse(message=message_value.strip(), actions=[])
            record_failure("final", FAILURE_FINAL_SCHEMA, note="payload non conforme, message absent")
            return ChatResponse(message=GENERIC_FALLBACK, actions=[])

    if _looks_like_json(text):
        message = _decode_message_field(_MESSAGE_FIELD_RE.search(text))
        if message and message.strip():
            record_failure("final", FAILURE_FINAL_SCHEMA, note="JSON cassé, champ message extrait par regex")
            return ChatResponse(message=message.strip(), actions=[])
        record_failure("final", FAILURE_FINAL_SCHEMA, note="JSON cassé, message non extractible")
        return ChatResponse(message=GENERIC_FALLBACK, actions=[])

    return ChatResponse(message=text, actions=[])


def build_final_text_messages(messages: list[dict]) -> list[dict]:
    """Aplatie la conversation (résultats d'outils inclus) en messages texte pour
    l'appel final sans tools (phase 2).

    Les tours assistant qui portaient des appels d'outils deviennent des messages
    user (l'appel d'outil + ses résultats sont embarqués) : l'API Gemini interdit
    les requêtes se terminant par un tour model, et l'appel final est sans tools.
    """

    def _append(flattened: list[dict], role: str, content: str) -> None:
        content = content.strip()
        if not content:
            return
        if flattened and flattened[-1]["role"] == role:
            flattened[-1]["content"] = f"{flattened[-1]['content']}\n\n{content}"
        else:
            flattened.append({"role": role, "content": content})

    tool_results: dict[str, str] = {}
    for message in messages:
        if message.get("role") == "tool":
            tool_call_id = str(message.get("tool_call_id", ""))
            content = str(message.get("content", ""))
            if tool_call_id:
                tool_results[tool_call_id] = content
            else:
                tool_results.setdefault(str(message.get("name", "")), content)

    flattened: list[dict] = []
    for message in messages:
        role = message.get("role")
        if role == "system":
            _append(flattened, "system", str(message.get("content", "")))
        elif role == "user":
            _append(flattened, "user", str(message.get("content", "")))
        elif role == "assistant":
            tool_calls = message.get("tool_calls") or []
            if not tool_calls:
                if message.get("content"):
                    _append(flattened, "assistant", str(message["content"]))
                continue
            blocks: list[str] = []
            for call in tool_calls:
                function = call.get("function", {})
                name = str(function.get("name", ""))
                arguments = function.get("arguments", "{}")
                call_id = str(call.get("id", ""))
                result = tool_results.get(call_id) or tool_results.get(name) or ""
                blocks.append(f"[Outil: {name}({arguments})]\nRésultat: {result}")
            _append(flattened, "user", "\n".join(blocks))
    return flattened
