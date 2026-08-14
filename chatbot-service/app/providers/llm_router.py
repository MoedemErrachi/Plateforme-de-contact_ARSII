from __future__ import annotations

import logging

from app.config import GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY
from app.exceptions import ServiceUnavailableError
from app.providers.base import APIConnectionError, LLMProvider, ProviderHTTPError, RateLimitError, ToolCallResponse
from app.providers.gemini_provider import GeminiProvider
from app.providers.groq_provider import GroqProvider
from app.providers.mistral_provider import MistralProvider

logger = logging.getLogger(__name__)

PIVOT_EXCEPTIONS = (RateLimitError, TimeoutError, APIConnectionError, ProviderHTTPError)


class LLMRouter:
    def __init__(self, providers: list[LLMProvider] | None = None):
        self.providers = providers if providers is not None else build_default_providers()

    async def chat(self, messages: list[dict], tools: list[dict], timeout: int = 15) -> ToolCallResponse:
        failures: list[str] = []
        for provider in self.providers:
            try:
                return await provider.chat_with_tools(messages, tools, timeout)
            except PIVOT_EXCEPTIONS as exc:
                logger.warning("LLM provider '%s' failed, pivoting to next provider: %s", provider.name, exc)
                failures.append(f"{provider.name}: {exc}")
                continue
        if not failures:
            raise ServiceUnavailableError("Aucun fournisseur LLM n'est configuré (MISTRAL_API_KEY, GROQ_API_KEY ou GEMINI_API_KEY requis).")
        raise ServiceUnavailableError("Tous les fournisseurs LLM ont échoué: " + "; ".join(failures))


def build_default_providers() -> list[LLMProvider]:
    providers: list[LLMProvider] = []
    if MISTRAL_API_KEY:
        providers.append(MistralProvider())
    if GROQ_API_KEY:
        providers.append(GroqProvider())
    if GEMINI_API_KEY:
        providers.append(GeminiProvider())
    return providers
