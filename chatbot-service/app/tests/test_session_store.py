from __future__ import annotations

import asyncio
import time

from app.services.session_store import SessionRecord, SessionStore


class TestSessionStore:
    def test_push_creates_and_updates_record(self):
        store = SessionStore(max_messages=10, ttl_seconds=3600)
        store.push("s1", "user1", "assistant1")
        assert len(store._sessions) == 1
        record = store._sessions["s1"]
        assert record.messages == [
            {"role": "user", "content": "user1"},
            {"role": "assistant", "content": "assistant1"},
        ]
        store.push("s1", "user2", "assistant2")
        assert len(store._sessions["s1"].messages) == 4

    def test_push_respects_max_messages(self):
        store = SessionStore(max_messages=2, ttl_seconds=3600)
        for i in range(3):
            store.push("s1", f"u{i}", f"a{i}")
        assert store._sessions["s1"].messages == [
            {"role": "user", "content": "u2"},
            {"role": "assistant", "content": "a2"},
        ]

    def test_push_expired_record_creates_new_one(self, monkeypatch):
        store = SessionStore(max_messages=10, ttl_seconds=3600)
        store.push("s1", "old-user", "old-answer")
        old = store._sessions["s1"]
        monkeypatch.setattr(old, "updated_at", time.time() - 7200)
        store.push("s1", "new-user", "new-answer")
        assert store._sessions["s1"] is not old
        assert store._sessions["s1"].messages == [
            {"role": "user", "content": "new-user"},
            {"role": "assistant", "content": "new-answer"},
        ]

    def test_push_evicts_expired_then_oldest_when_full(self, monkeypatch):
        monkeypatch.setattr(SessionStore, "MAX_SESSIONS", 2)
        store = SessionStore(max_messages=1, ttl_seconds=3600)
        for sid in ("a", "b"):
            store.push(sid, f"u-{sid}", f"a-{sid}")
        record_a = store._sessions["a"]
        monkeypatch.setattr(record_a, "updated_at", time.time() - 7200)
        store.push("c", "u-c", "a-c")
        assert "a" not in store._sessions
        assert "b" in store._sessions
        assert store._sessions["c"].messages[-1] == {"role": "assistant", "content": "a-c"}
        store.push("d", "u-d", "a-d")
        assert "b" not in store._sessions
        assert len(store._sessions) == 2

    def test_push_evicts_oldest_when_at_capacity(self, monkeypatch):
        monkeypatch.setattr(SessionStore, "MAX_SESSIONS", 3)
        store = SessionStore(max_messages=1, ttl_seconds=3600)
        for sid in range(3):
            store.push(str(sid), f"u{sid}", f"a{sid}")
        assert len(store._sessions) == 3
        store.push("3", "u3", "a3")
        assert "0" not in store._sessions
        assert "1" in store._sessions
        assert "3" in store._sessions

    def test_get_messages_returns_slice_and_updates_timestamp(self):
        store = SessionStore(max_messages=2, ttl_seconds=3600)
        store.push("s1", "u1", "a1")
        store.push("s1", "u2", "a2")
        messages = store.get_messages("s1")
        assert messages == [
            {"role": "user", "content": "u1"},
            {"role": "assistant", "content": "a1"},
            {"role": "user", "content": "u2"},
            {"role": "assistant", "content": "a2"},
        ][-2:]
        assert "u2" in messages[0]["content"]

    def test_get_messages_unknown_session_returns_empty(self):
        store = SessionStore(max_messages=10, ttl_seconds=3600)
        assert store.get_messages("missing") == []

    def test_get_messages_prunes_leading_non_user(self):
        store = SessionStore(max_messages=10, ttl_seconds=3600)
        store.push("s1", "u1", "a1")
        record = store._sessions["s1"]
        record.messages.insert(0, {"role": "assistant", "content": "stray"})
        messages = store.get_messages("s1")
        assert messages[0]["role"] == "user"

    def test_clear_removes_session(self):
        store = SessionStore(max_messages=10, ttl_seconds=3600)
        store.push("s1", "u", "a")
        store.clear("s1")
        assert "s1" not in store._sessions
        store.clear("s1")

    def test_prune_expired(self, monkeypatch):
        store = SessionStore(max_messages=10, ttl_seconds=3600)
        store.push("fresh", "u", "a")
        store.push("stale", "u", "a")
        monkeypatch.setattr(store._sessions["stale"], "updated_at", time.time() - 7200)
        store._prune_expired()
        assert "stale" not in store._sessions
        assert "fresh" in store._sessions


class TestSessionStoreCleanupLoop:
    async def test_start_and_stop_cleanup(self):
        store = SessionStore(max_messages=10, ttl_seconds=3600)
        store.start_cleanup(interval_seconds=0.01)
        assert store._cleanup_task is not None
        store.start_cleanup(interval_seconds=0.01)
        store.push("stale", "u", "a")
        store._sessions["stale"].updated_at = time.time() - 7200
        await asyncio.sleep(0.05)
        assert "stale" not in store._sessions
        await store.stop_cleanup()
        assert store._cleanup_task is None

    async def test_stop_cleanup_noop_when_no_task(self):
        store = SessionStore(max_messages=10, ttl_seconds=3600)
        await store.stop_cleanup()
        assert store._cleanup_task is None


class TestSessionRecord:
    def test_defaults(self):
        record = SessionRecord()
        assert record.messages == []
        assert record.created_at > 0
        assert record.updated_at >= record.created_at