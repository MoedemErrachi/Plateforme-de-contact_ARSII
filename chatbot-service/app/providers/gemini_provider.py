"""
Provider Gemini — function calling.

Séquence type (2 tours) — comportement SPÉCIFIQUE à l'API Gemini (absent chez
Mistral et Groq) :

  Tour 1
  - messages: [user "Liste les chercheurs du Sénégal"]
  - Gemini renvoie: content.parts = [
        Part(function_call={name: "search_contacts", args: {...}},
             thought_signature=b"<opaque base64>"),      # signature au niveau PART
    ]
  - chat_with_tools capture la signature SUR LE PART (part.thought_signature, bytes que le
    SDK a déjà base64-décodés) puis la ré-encode en base64 pour la transporter via
    ToolCall(thought_signature=...) -> build_assistant_message ->
    dict assistant: tool_calls[].function.thought_signature = "<opaque base64>"
  - Le tool s'exécute ; messages += [{"role": "tool", "name": "search_contacts", "content": ...}]

  Tour 2
  - _to_gemini_contents réinjecte le functionCall TEL QUEL (name/args/id) avec sa
    thought_signature (base64) au niveau PART — pydantic la base64-décode à l'identique —,
    PUIS groupe toutes les functionResponse du tour dans le même message user
    (format imposé par l'API) :
        content(model) : Part(function_call=..., thought_signature="<opaque base64>")
        content(user)  : Part(function_response=...)
  - Gemini produit la réponse finale.

  Sans la réinjection de la signature, Gemini 3 (dont gemini-3.5-flash) répond :
  400 INVALID_ARGUMENT: "Function call is missing a thought_signature in functionCall parts."
  Ne pas "réunifier" ce traitement dans un refactor commun du LLMRouter / des providers.
  Référence: https://ai.google.dev/gemini-api/docs/thought-signatures
"""

from __future__ import annotations

import asyncio
import base64
import json

from google import genai
from google.genai import types

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.models.schemas import ChatResponse
from app.providers.base import (
    APIConnectionError,
    LLMProvider,
    ProviderHTTPError,
    RateLimitError,
    ToolCall,
    ToolCallResponse,
)

try:
    from google.genai import errors as genai_errors
except ImportError:  # pragma: no cover
    genai_errors = None


def _args_to_dict(args: object) -> dict:
    if not args:
        return {}
    if isinstance(args, dict):
        return args
    try:
        return dict(args.items())
    except Exception:
        return {"raw": str(args)}


# GEMINI-SPECIFIC — renforce l'exactitude de l'extraction et le format des liens.
# Concaténée à l'instruction système existante (les règles ci-dessous priment donc sur
# "sans markdown lourd" du SYSTEM_PROMPT pour la présentation des listes).
GEMINI_STRICT_OUTPUT_INSTRUCTIONS = """
Règles STRICTES pour les réponses avec données:
- Lorsqu'un outil renvoie un tableau (ex. "contacts"), liste TOUS les éléments du tableau dans le message. N'en omets jamais aucun, ne raccourcis jamais la liste, même si elle est longue (le nombre exact est indiqué par le champ "returned").
- Présente chaque liste de façon structurée et aérée: un tableau markdown ou une liste à puces, avec les informations essentielles (nom, pays, affiliation). Évite l'écriture compacte et les paragraphes noyaux.
- Pour chaque contact listé, ajoute un lien au format EXACT suivant, sans aucune modification du motif: [Voir le contact](/contacts/{id}) — remplace uniquement {id} par l'identifiant réel du contact (champ "id" de l'outil).
- Si la demande visait UN contact précis et que l'outil ne renvoie qu'un seul résultat, renvoie l'action "view_contact_profile" avec ce contact_id; si plusieurs résultats, renvoie "view_filtered_list" avec les filtres de la demande.
- Ne cite jamais un contact, un nombre ou un identifiant absent de la sortie réelle de l'outil. Ne recopie que les éléments réellement renvoyés.
"""


class GeminiProvider(LLMProvider):
    name = "gemini"
    model = GEMINI_MODEL

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.model = model or GEMINI_MODEL
        self._client = genai.Client(api_key=api_key or GEMINI_API_KEY)

    @staticmethod
    def _to_gemini_tools(tools: list[dict]) -> list[types.Tool]:
        declarations: list[types.FunctionDeclaration] = []
        for tool in tools:
            function = tool["function"]
            declarations.append(
                types.FunctionDeclaration(
                    name=function["name"],
                    description=function.get("description", ""),
                    parameters=function.get("parameters", {"type": "object", "properties": {}}),
                )
            )
        return [types.Tool(function_declarations=declarations)]

    @staticmethod
    def _to_gemini_contents(messages: list[dict]) -> tuple[str, list[types.Content]]:
        # GEMINI-SPECIFIC — Thought Signatures API. Gemini (famille 3, dont
        # gemini-3.5-flash) exige que chaque `functionCall` renvoyé par le modèle soit
        # réinjecté au tour suivant AVEC son champ `thought_signature` intact, sinon
        # 400 INVALID_ARGUMENT: "Function call is missing a thought_signature in
        # functionCall parts." Ce comportement n'existe PAS chez Mistral/Groq : ne pas
        # réunifier ce traitement dans un refactor commun du LLMRouter.
        # ⚠ La signature vit au NIVEAU du Part (`Part.thought_signature`, bytes/base64),
        # PAS dans l'objet `FunctionCall` (extra='forbid' -> ValidationError).
        system_parts = [str(message.get("content", "")) for message in messages if message.get("role") == "system"]
        system_instruction = "\n".join(system_parts).strip()

        contents: list[types.Content] = []
        pending_tool_parts: list[types.Part] = []

        def flush_tool_parts() -> None:
            if pending_tool_parts:
                contents.append(types.Content(role="user", parts=list(pending_tool_parts)))
                pending_tool_parts.clear()

        for message in messages:
            role = message.get("role")
            if role == "system":
                continue
            if role == "assistant":
                # L'API Gemini impose un unique message user contenant TOUTES les
                # functionResponse du tour, placé APRÈS le message model des functionCall.
                flush_tool_parts()
                parts: list[types.Part] = []
                if message.get("content"):
                    parts.append(types.Part(text=str(message["content"])))
                for tool_call in message.get("tool_calls") or []:
                    function = tool_call.get("function", {})
                    arguments = function.get("arguments", "{}")
                    thought_signature = function.get("thought_signature")

                    # GEMINI-SPECIFIC — les appels d'outils provenant d'autres providers
                    # (Mistral, Groq) n'ont pas de thought_signature. Gemini 3.x exige
                    # cette signature pour chaque functionCall dans l'historique, sinon
                    # 400 INVALID_ARGUMENT. On convertit ces appels étrangers en texte
                    # brut pour éviter le crash.
                    if not thought_signature:
                        name = function.get("name", "unknown")
                        try:
                            args_str = json.dumps(arguments, ensure_ascii=False) if isinstance(arguments, dict) else str(arguments)
                        except (ValueError, TypeError):
                            args_str = str(arguments)
                        parts.append(types.Part(text=f"[Outil: {name}({args_str})]"))
                        continue

                    try:
                        arguments_dict = json.loads(arguments) if isinstance(arguments, str) else (arguments or {})
                    except (ValueError, TypeError):
                        arguments_dict = {"raw": arguments}

                    # Réinjection du functionCall (name/args/id) avec sa thought_signature
                    # au niveau PART — jamais dans FunctionCall(). La valeur du dict est du
                    # base64 (ASCII) que pydantic base64-décode (val_json_bytes) à l'identique.
                    fc_kwargs: dict = {
                        "name": function.get("name", ""),
                        "args": arguments_dict,
                    }
                    if tool_call.get("id"):
                        fc_kwargs["id"] = tool_call.get("id")
                    part_kwargs: dict = {"function_call": types.FunctionCall(**fc_kwargs)}
                    if thought_signature:
                        part_kwargs["thought_signature"] = thought_signature
                    parts.append(types.Part(**part_kwargs))
                if parts:
                    contents.append(types.Content(role="model", parts=parts))
            elif role == "tool":
                # Toutes les functionResponse d'un même tour sont groupées dans le même
                # message user (format imposé par l'API Gemini).
                response: dict = {"output": str(message.get("content", ""))}
                try:
                    response = json.loads(message.get("content", "")) if message.get("content") else response
                except (ValueError, TypeError):
                    response = {"output": message.get("content", "")}
                pending_tool_parts.append(
                    types.Part(
                        function_response=types.FunctionResponse(
                            name=str(message.get("name", "")),
                            response=response if isinstance(response, dict) else {"output": response},
                        )
                    )
                )
            else:
                flush_tool_parts()
                contents.append(types.Content(role="user", parts=[types.Part(text=str(message.get("content", "")))]))

        flush_tool_parts()
        return system_instruction, contents

    @staticmethod
    def _map_exception(exc: Exception) -> None:
        if isinstance(exc, TimeoutError):
            raise APIConnectionError(str(exc)) from exc
        if genai_errors is not None:
            if isinstance(exc, getattr(genai_errors, "ServerError", ())):
                raise ProviderHTTPError(500, str(exc)) from exc
            if isinstance(exc, getattr(genai_errors, "ClientError", ())):
                code = getattr(exc, "code", None)
                if code == 429:
                    raise RateLimitError(str(exc)) from exc
                if isinstance(code, int) and code >= 500:
                    raise ProviderHTTPError(code, str(exc)) from exc
                raise
        name = type(exc).__name__.lower()
        if "connection" in name or "timeout" in name:
            raise APIConnectionError(str(exc)) from exc
        raise

    async def chat_with_tools(self, messages: list[dict], tools: list[dict], timeout: int = 15) -> ToolCallResponse:
        system_instruction, contents = self._to_gemini_contents(messages)
        full_system_instruction = "\n".join(
            part for part in (system_instruction, GEMINI_STRICT_OUTPUT_INSTRUCTIONS) if part and part.strip()
        ).strip()
        try:
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=self.model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=full_system_instruction or None,
                        tools=self._to_gemini_tools(tools),
                        temperature=0,
                    ),
                ),
                timeout=timeout,
            )
        except Exception as exc:
            self._map_exception(exc)

        text_parts: list[str] = []
        tool_calls: list[ToolCall] = []
        if response.candidates:
            candidate = response.candidates[0]
            if candidate.content:
                for part in candidate.content.parts:
                    if getattr(part, "function_call", None) is not None:
                        function_call = part.function_call
                        # GEMINI-SPECIFIC — la thought_signature est portée par le PART
                        # (champ bytes), pas par l'objet FunctionCall : le SDK google-genai
                        # la perd à la désérialisation (python-genai#2406), donc on la
                        # capture ici. Le SDK l'a déjà base64-décodée (val_json_bytes),
                        # on la ré-encode donc en base64 (texte) pour la transporter via
                        # ToolCall -> dict `tool_calls[].function.thought_signature`, puis
                        # _to_gemini_contents la repassera à Part(thought_signature=...) où
                        # pydantic la base64-décodera à l'identique (round-trip sans perte).
                        # Voir le docstring de module et https://ai.google.dev/gemini-api/docs/thought-signatures
                        raw_thought = getattr(part, "thought_signature", None)
                        if isinstance(raw_thought, bytes) and raw_thought:
                            thought_signature = base64.b64encode(raw_thought).decode("ascii")
                        elif isinstance(raw_thought, str) and raw_thought:
                            thought_signature = raw_thought
                        else:
                            thought_signature = None
                        tool_calls.append(
                            ToolCall(
                                id=function_call.id or f"gemini-{len(tool_calls)}",
                                name=function_call.name,
                                arguments=_args_to_dict(function_call.args),
                                thought_signature=thought_signature,
                            )
                        )
                    elif part.text:
                        text_parts.append(part.text)

        content = " ".join(text_parts).strip() or None
        return ToolCallResponse(content=content, tool_calls=tool_calls)

    async def chat_final(self, messages: list[dict], timeout: int = 15) -> str:
        """Phase finale: sortie structurée native via response_schema, sans tools.

        Gemini rejette response_mime_type="application/json" EN PRÉSENCE de tools
        (incompatibilité API, issue python-genai #867) : cette phase est donc
        toujours appelée SANS tools, après la boucle d'outils.
        """
        system_instruction, contents = self._to_gemini_contents(messages)
        full_system_instruction = "\n".join(
            part for part in (system_instruction, GEMINI_STRICT_OUTPUT_INSTRUCTIONS) if part and part.strip()
        ).strip()
        try:
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=self.model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=full_system_instruction or None,
                        response_mime_type="application/json",
                        response_schema=ChatResponse,
                        temperature=0,
                    ),
                ),
                timeout=timeout,
            )
        except Exception as exc:
            self._map_exception(exc)

        text_parts: list[str] = []
        if response.candidates:
            candidate = response.candidates[0]
            if candidate.content:
                for part in candidate.content.parts:
                    if part.text:
                        text_parts.append(part.text)
        return " ".join(text_parts).strip()
