from __future__ import annotations

import json
from typing import Any

import httpx


class FakeResponse:
    def __init__(self, status_code: int = 200, json_data: Any = None, text: str | None = None):
        self.status_code = status_code
        self._json_data = json_data
        self.text = text if text is not None else (json.dumps(json_data) if json_data is not None else "")

    def json(self) -> Any:
        return self._json_data

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"HTTP {self.status_code}",
                request=httpx.Request("GET", "http://fake"),
                response=self,
            )


class FakeAsyncClient:
    def __init__(self, results: list[Any] | None = None):
        self._results = list(results or [])
        self.calls: list[tuple] = []
        self.closed = False

    async def get(self, *args, **kwargs) -> FakeResponse:
        self.calls.append((args, kwargs))
        if self._results:
            item = self._results.pop(0)
            if isinstance(item, BaseException):
                raise item
            return item
        return FakeResponse()

    async def aclose(self) -> None:
        self.closed = True