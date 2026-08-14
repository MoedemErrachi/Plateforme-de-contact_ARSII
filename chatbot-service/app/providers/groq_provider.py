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
            arguments: dict = {}
            try:
                arguments = json.loads(call.function.arguments or "{}")
            except (ValueError, TypeError):
                arguments = {"raw": call.function.arguments}
            tool_calls.append(ToolCall(id=call.id, name=call.function.name, arguments=arguments))

        return ToolCallResponse(content=extract_text(message.content), tool_calls=tool_calls)
