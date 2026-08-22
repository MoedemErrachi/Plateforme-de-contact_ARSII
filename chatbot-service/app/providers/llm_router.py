from __future__ import annotations

import logging
import time

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
_FALLBACK_MSG = "Je rencontre une difficulté technique, veuillez réessayer dans un instant."

_MAX_CONSECUTIVE_FAILURES = 3
_COOLDOWN_SECONDS = 300


class LLMRouter:
    def __init__(self, providers: list[LLMProvider] | None = None):
        self.providers = providers if providers is not None else build_default_providers()
        self._failures: dict[str, int] = {}
        self._cooldown_until: dict[str, float] = {}

    def _is_healthy(self, provider_name: str) -> bool:
        until = self._cooldown_until.get(provider_name, 0)
        if until and time.time() < until:
            return False
        if until and time.time() >= until:
            self._failures.pop(provider_name, None)
            self._cooldown_until.pop(provider_name, None)
        return True

    def _record_provider_failure(self, provider_name: str) -> None:
        self._failures[provider_name] = self._failures.get(provider_name, 0) + 1
        if self._failures[provider_name] >= _MAX_CONSECUTIVE_FAILURES:
            self._cooldown_until[provider_name] = time.time() + _COOLDOWN_SECONDS
            logger.warning("Provider '%s' entered %ds cooldown after %d consecutive failures.",
                           provider_name, _COOLDOWN_SECONDS, _MAX_CONSECUTIVE_FAILURES)

    def _record_provider_success(self, provider_name: str) -> None:
        self._failures.pop(provider_name, None)
        self._cooldown_until.pop(provider_name, None)

    async def chat(self, messages: list[dict], tools: list[dict], timeout: int = 15) -> ToolCallResponse:
        failures: list[str] = []
        for provider in self.providers:
            if not self._is_healthy(provider.name):
                logger.info("Skipping provider '%s' (cooldown active)", provider.name)
                continue
            try:
                response = await provider.chat_with_tools(messages, tools, timeout)
            except PIVOT_EXCEPTIONS as exc:
                logger.warning("LLM provider '%s' failed, pivoting to next provider: %s", provider.name, exc)
                record_failure(provider.name, FAILURE_TRANSPORT, note=str(exc))
                self._record_provider_failure(provider.name)
                failures.append(f"{provider.name}: {exc}")
                continue
            except Exception as exc:
                logger.warning("LLM provider '%s' failed with unexpected error, pivoting: %s", provider.name, exc)
                record_failure(provider.name, FAILURE_TRANSPORT, note=f"unexpected: {exc}")
                self._record_provider_failure(provider.name)
                failures.append(f"{provider.name}: {exc}")
                continue
            try:
                for tool_call in response.tool_calls:
                    validate_tool_call(tool_call)
            except ToolValidationError as exc:
                logger.warning("LLM provider '%s' returned an invalid tool call, pivoting: %s", provider.name, exc)
                record_failure(provider.name, FAILURE_TOOL_CALL_INVALID, note=exc.reason)
                self._record_provider_failure(provider.name)
                failures.append(f"{provider.name}: {exc}")
                continue
            self._record_provider_success(provider.name)
            return response
        if not failures:
            raise ServiceUnavailableError(_NO_PROVIDERS_MSG)
        record_failure("all", FAILURE_FINAL_ALL_FAILED, note="; ".join(failures))
        logger.error("All LLM providers failed: %s", "; ".join(failures))
        return ToolCallResponse(content=_FALLBACK_MSG, tool_calls=[])

    async def chat_final(self, messages: list[dict], timeout: int = 15) -> str:
        failures: list[str] = []
        for provider in self.providers:
            if not self._is_healthy(provider.name):
                logger.info("Skipping provider '%s' in chat_final (cooldown active)", provider.name)
                continue
            try:
                result = await provider.chat_final(messages, timeout)
                self._record_provider_success(provider.name)
                return result
            except PIVOT_EXCEPTIONS as exc:
                logger.warning(
                    "LLM provider '%s' failed in chat_final, pivoting to next provider: %s",
                    provider.name,
                    exc,
                )
                record_failure(provider.name, FAILURE_TRANSPORT, note=f"chat_final: {exc}")
                self._record_provider_failure(provider.name)
                failures.append(f"{provider.name}: {exc}")
                continue
            except Exception as exc:
                logger.warning(
                    "LLM provider '%s' failed in chat_final with unexpected error, pivoting: %s",
                    provider.name,
                    exc,
                )
                record_failure(provider.name, FAILURE_TRANSPORT, note=f"chat_final unexpected: {exc}")
                self._record_provider_failure(provider.name)
                failures.append(f"{provider.name}: {exc}")
                continue
        if not failures:
            raise ServiceUnavailableError(_NO_PROVIDERS_MSG)
        record_failure("all", FAILURE_FINAL_ALL_FAILED, note="; ".join(failures))
        logger.error("All LLM providers failed in chat_final: %s", "; ".join(failures))
        return _FALLBACK_MSG


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
