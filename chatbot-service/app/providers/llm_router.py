from __future__ import annotations

import logging

from app.config import GEMINI_API_KEY, GEMINI_FALLBACK_MODEL, GEMINI_MODEL, GROQ_API_KEY, MISTRAL_API_KEY
from app.exceptions import ServiceUnavailableError
from app.providers.base import APIConnectionError, LLMProvider, ProviderHTTPError, RateLimitError, ToolCallResponse
from app.providers.gemini_provider import GeminiProvider
from app.providers.groq_provider import GroqProvider
from app.providers.mistral_provider import MistralProvider
from app.services.validation import (
    FAILURE_FINAL_ALL_FAILED,
    FAILURE_TOOL_CALL_INVALID,
    FAILURE_TRANSPORT,
    ToolValidationError,
    record_failure,
    validate_tool_call,
)

logger = logging.getLogger(__name__)

PIVOT_EXCEPTIONS = (RateLimitError, TimeoutError, APIConnectionError, ProviderHTTPError)

_NO_PROVIDERS_MSG = "Aucun fournisseur LLM n'est configuré (MISTRAL_API_KEY, GROQ_API_KEY ou GEMINI_API_KEY requis)."


class LLMRouter:
    def __init__(self, providers: list[LLMProvider] | None = None):
        self.providers = providers if providers is not None else build_default_providers()

    async def chat(self, messages: list[dict], tools: list[dict], timeout: int = 15) -> ToolCallResponse:
        failures: list[str] = []
        for provider in self.providers:
            try:
                response = await provider.chat_with_tools(messages, tools, timeout)
            except PIVOT_EXCEPTIONS as exc:
                logger.warning("LLM provider '%s' failed, pivoting to next provider: %s", provider.name, exc)
                record_failure(provider.name, FAILURE_TRANSPORT, note=str(exc))
                failures.append(f"{provider.name}: {exc}")
                continue
            try:
                for tool_call in response.tool_calls:
                    validate_tool_call(tool_call)
            except ToolValidationError as exc:
                logger.warning("LLM provider '%s' returned an invalid tool call, pivoting: %s", provider.name, exc)
                record_failure(provider.name, FAILURE_TOOL_CALL_INVALID, note=exc.reason)
                failures.append(f"{provider.name}: {exc}")
                continue
            return response
        if not failures:
            raise ServiceUnavailableError(_NO_PROVIDERS_MSG)
        raise ServiceUnavailableError("Tous les fournisseurs LLM ont échoué: " + "; ".join(failures))

    async def chat_final(self, messages: list[dict], timeout: int = 15) -> str:
        failures: list[str] = []
        for provider in self.providers:
            try:
                return await provider.chat_final(messages, timeout)
            except PIVOT_EXCEPTIONS as exc:
                logger.warning(
                    "LLM provider '%s' failed in chat_final, pivoting to next provider: %s",
                    provider.name,
                    exc,
                )
                record_failure(provider.name, FAILURE_TRANSPORT, note=f"chat_final: {exc}")
                failures.append(f"{provider.name}: {exc}")
                continue
        if not failures:
            raise ServiceUnavailableError(_NO_PROVIDERS_MSG)
        record_failure("all", FAILURE_FINAL_ALL_FAILED, note="; ".join(failures))
        raise ServiceUnavailableError("Tous les fournisseurs LLM ont échoué en phase finale: " + "; ".join(failures))


def build_default_providers() -> list[LLMProvider]:
    """Chaîne de secours documentée, dans l'ordre d'itération du LLMRouter:

    Mistral -> Groq -> Gemini(GEMINI_MODEL) -> Gemini(GEMINI_FALLBACK_MODEL) [dernier recours].

    Le dernier provider est TOUJOURS gemini-3.5-flash-lite (GEMINI_FALLBACK_MODEL),
    indépendamment de GEMINI_MODEL. Si GEMINI_MODEL == GEMINI_FALLBACK_MODEL, le
    fallback est dédupliqué (un seul provider Gemini dans la chaîne).
    """
    providers: list[LLMProvider] = []
    if MISTRAL_API_KEY:
        providers.append(MistralProvider())
    if GROQ_API_KEY:
        providers.append(GroqProvider())
    if GEMINI_API_KEY:
        if GEMINI_MODEL:
            providers.append(GeminiProvider(model=GEMINI_MODEL))
        if GEMINI_FALLBACK_MODEL and GEMINI_FALLBACK_MODEL != GEMINI_MODEL:
            providers.append(GeminiProvider(model=GEMINI_FALLBACK_MODEL))
    return providers
