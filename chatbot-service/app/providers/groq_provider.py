from __future__ import annotations

import asyncio
import json

from groq import AsyncGroq
from groq import (
    APIConnectionError as GroqAPIConnectionError,
    APIStatusError as GroqAPIStatusError,
    APITimeoutError as GroqAPITimeoutError,
    RateLimitError as GroqRateLimitError,
)

from app.config import GROQ_API_KEY, GROQ_MODEL
from app.providers.base import (
    APIConnectionError,
    LLMProvider,
    ProviderHTTPError,
    RateLimitError,
    ToolCall,
    ToolCallResponse,
    extract_text,
    strip_internal_fields,
)


class GroqProvider(LLMProvider):
    name = "groq"
    model = GROQ_MODEL

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.model = model or GROQ_MODEL
        self._client = AsyncGroq(api_key=api_key or GROQ_API_KEY)

    async def chat_with_tools(self, messages: list[dict], tools: list[dict], timeout: int = 15) -> ToolCallResponse:
        try:
            response = await asyncio.wait_for(
                self._client.chat.completions.create(
                    model=self.model,
                    messages=strip_internal_fields(messages),
                    tools=tools,
                    tool_choice="auto",
                    temperature=0,
                ),
                timeout=timeout,
            )
        except GroqRateLimitError as exc:
            raise RateLimitError(str(exc)) from exc
        except (GroqAPIConnectionError, GroqAPITimeoutError, TimeoutError) as exc:
            raise APIConnectionError(str(exc)) from exc
        except GroqAPIStatusError as exc:
            status = getattr(exc, "status_code", None)
            if status is not None and status >= 500:
                raise ProviderHTTPError(status, str(exc)) from exc
            raise

        message = response.choices[0].message
        tool_calls: list[ToolCall] = []
        for call in message.tool_calls or []:
            raw_arguments = call.function.arguments or "{}"
            try:
                arguments = json.loads(raw_arguments)
            except (ValueError, TypeError):
                arguments = None
            if not isinstance(arguments, dict):
                arguments = {"raw": raw_arguments}
            tool_calls.append(ToolCall(id=call.id, name=call.function.name, arguments=arguments))

        return ToolCallResponse(content=extract_text(message.content), tool_calls=tool_calls)

    async def chat_final(self, messages: list[dict], timeout: int = 15) -> str:
        """Phase finale: sortie JSON native (mode json_object), sans tools.

        Le modèle configuré (llama-3.3-70b-versatile) ne supporte PAS le mode
        json_schema strict (400 sinon) : on utilise json_object + validation
        Pydantic post-réponse. Le SYSTEM_PROMPT contient le mot "JSON", condition
        requise par Groq pour le mode json_object.
        """
        try:
            response = await asyncio.wait_for(
                self._client.chat.completions.create(
                    model=self.model,
                    messages=strip_internal_fields(messages),
                    temperature=0,
                    response_format={"type": "json_object"},
                ),
                timeout=timeout,
            )
        except GroqRateLimitError as exc:
            raise RateLimitError(str(exc)) from exc
        except (GroqAPIConnectionError, GroqAPITimeoutError, TimeoutError) as exc:
            raise APIConnectionError(str(exc)) from exc
        except GroqAPIStatusError as exc:
            status = getattr(exc, "status_code", None)
            if status is not None and status >= 500:
                raise ProviderHTTPError(status, str(exc)) from exc
            raise

        content = response.choices[0].message.content
        return content or ""
