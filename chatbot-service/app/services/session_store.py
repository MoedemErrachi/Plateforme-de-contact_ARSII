from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field


@dataclass
class SessionRecord:
    messages: list[dict] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)


class SessionStore:
    MAX_SESSIONS = 1000

    def __init__(self, max_messages: int = 10, ttl_seconds: int = 3600):
        self.max_messages = max_messages
        self.ttl_seconds = ttl_seconds
        self._sessions: dict[str, SessionRecord] = {}
        self._cleanup_task: asyncio.Task | None = None

    def push(self, session_id: str, user_message: str, assistant_message: str) -> None:
        now = time.time()
        record = self._sessions.get(session_id)
        if record is None or now - record.updated_at > self.ttl_seconds:
            record = SessionRecord()
            if len(self._sessions) >= self.MAX_SESSIONS:
                self._prune_expired()
            if len(self._sessions) >= self.MAX_SESSIONS:
                oldest_sid = min(self._sessions, key=lambda k: self._sessions[k].updated_at)
                del self._sessions[oldest_sid]
            self._sessions[session_id] = record
        record.messages.append({"role": "user", "content": user_message})
        record.messages.append({"role": "assistant", "content": assistant_message})
        record.messages = record.messages[-self.max_messages:]
        record.updated_at = now

    def get_messages(self, session_id: str) -> list[dict]:
        self._prune_expired()
        record = self._sessions.get(session_id)
        if record is None:
            return []
        record.updated_at = time.time()
        messages = record.messages[-self.max_messages:]
        while messages and messages[0].get("role") != "user":
            messages.pop(0)
        return list(messages)

    def clear(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    def _prune_expired(self) -> None:
        now = time.time()
        expired = [sid for sid, record in self._sessions.items() if now - record.updated_at > self.ttl_seconds]
        for sid in expired:
            del self._sessions[sid]

    async def start_cleanup(self, interval_seconds: int = 300) -> None:
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop(interval_seconds))

    async def stop_cleanup(self) -> None:
        if self._cleanup_task is not None:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None

    async def _cleanup_loop(self, interval_seconds: int) -> None:
        while True:
            await asyncio.sleep(interval_seconds)
            self._prune_expired()
