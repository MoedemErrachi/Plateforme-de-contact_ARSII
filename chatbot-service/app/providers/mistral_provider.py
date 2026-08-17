from __future__ import annotations

import asyncio
import json

try:
    from mistralai.client import Mistral
    from mistralai.client.errors import SDKError as MistralHTTPError
    from mistralai.client.errors import NoResponseError as MistralConnectionError
except ImportError:  # pragma: no cover
    from mistralai import Mistral

    try:
        from mistralai.exceptions import MistralAPIStatusException as MistralHTTPError
        from mistralai.exceptions import MistralConnectionError
    except ImportError:
        from mistralai.exceptions import MistralAPIException as MistralHTTPError

        class MistralConnectionError(ConnectionError):
            pass

from app.config import MISTRAL_API_KEY, MISTRAL_MODEL
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


class MistralProvider(LLMProvider):
    name = "mistral"
    model = MISTRAL_MODEL

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.model = model or MISTRAL_MODEL
        self._client = Mistral(api_key=api_key or MISTRAL_API_KEY)

    async def chat_with_tools(self, messages: list[dict], tools: list[dict], timeout: int = 15) -> ToolCallResponse:
        try:
            response = await asyncio.wait_for(
                self._client.chat.complete_async(
                    model=self.model,
                    messages=strip_internal_fields(messages),
                    tools=tools,
                    tool_choice="auto",
                    temperature=0,
                ),
                timeout=timeout,
            )
        except MistralHTTPError as exc:
            raw = getattr(exc, "raw_response", None)
            status = getattr(raw, "status_code", None) or getattr(exc, "status_code", None)
            if status == 429:
                raise RateLimitError(str(exc)) from exc
            if status is not None and status >= 500:
                raise ProviderHTTPError(status, str(exc)) from exc
            raise
        except (MistralConnectionError, TimeoutError) as exc:
            raise APIConnectionError(str(exc)) from exc
        except Exception as exc:
            name = type(exc).__name__.lower()
            if "connection" in name or "timeout" in name:
                raise APIConnectionError(str(exc)) from exc
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

        Le SYSTEM_PROMPT contient le mot "JSON", condition requise par Mistral
        pour le mode json_object (le modèle doit être instruit de produire du JSON).
        """
        try:
            response = await asyncio.wait_for(
                self._client.chat.complete_async(
                    model=self.model,
                    messages=strip_internal_fields(messages),
                    temperature=0,
                    response_format={"type": "json_object"},
                ),
                timeout=timeout,
            )
        except MistralHTTPError as exc:
            raw = getattr(exc, "raw_response", None)
            status = getattr(raw, "status_code", None) or getattr(exc, "status_code", None)
            if status == 429:
                raise RateLimitError(str(exc)) from exc
            if status is not None and status >= 500:
                raise ProviderHTTPError(status, str(exc)) from exc
            raise
        except (MistralConnectionError, TimeoutError) as exc:
            raise APIConnectionError(str(exc)) from exc
        except Exception as exc:
            name = type(exc).__name__.lower()
            if "connection" in name or "timeout" in name:
                raise APIConnectionError(str(exc)) from exc
            raise

        message = response.choices[0].message
        return extract_text(message.content) or ""
