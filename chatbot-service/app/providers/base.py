from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field


class ToolCall(BaseModel):
    id: str
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    thought_signature: str | None = None


class ToolCallResponse(BaseModel):
    content: str | None = None
    tool_calls: list[ToolCall] = Field(default_factory=list)

    @property
    def has_tool_calls(self) -> bool:
        return bool(self.tool_calls)


class ProviderError(Exception):
    status_code: int | None = None


class RateLimitError(ProviderError):
    status_code = 429


class APIConnectionError(ProviderError):
    status_code = None


class ProviderHTTPError(ProviderError):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        super().__init__(message)


class LLMProvider(ABC):
    name: str = "base"
    model: str = ""

    @abstractmethod
    async def chat_with_tools(self, messages: list[dict], tools: list[dict], timeout: int = 15) -> ToolCallResponse:
        raise NotImplementedError

    @abstractmethod
    async def chat_final(self, messages: list[dict], timeout: int = 15) -> str:
        """Produit la réponse finale structurée (sortie JSON native, sans tools)."""
        raise NotImplementedError


def extract_text(content: Any) -> str | None:
    if content is None:
        return None
    if isinstance(content, str):
        return content.strip() or None
    if isinstance(content, list):
        parts: list[str] = []
        for chunk in content:
            if isinstance(chunk, str):
                parts.append(chunk)
            elif isinstance(chunk, dict) and chunk.get("type") == "text":
                parts.append(str(chunk.get("text", "")))
        joined = " ".join(p for p in parts if p).strip()
        return joined or None
    return None


def strip_internal_fields(messages: list[dict]) -> list[dict]:
    cleaned: list[dict] = []
    for message in messages:
        if message.get("role") == "tool":
            cleaned.append({key: value for key, value in message.items() if key != "name"})
        else:
            cleaned.append(dict(message))
    return cleaned


def build_assistant_message(response: ToolCallResponse) -> dict:
    return {
        "role": "assistant",
        "content": response.content,
        "tool_calls": [
            {
                "id": tool_call.id,
                "type": "function",
                "function": {
                    "name": tool_call.name,
                    "arguments": json.dumps(tool_call.arguments, ensure_ascii=False, default=str),
                    "thought_signature": tool_call.thought_signature,
                },
            }
            for tool_call in response.tool_calls
        ],
    }
