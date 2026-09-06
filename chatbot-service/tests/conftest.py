import pytest


# SlowAPI rate limiting is neutralized for the whole test session so route
# modules can be imported without registering real limit decorators.
import slowapi
from slowapi import Limiter


def _noop_limit(self, limit_value, *args, **kwargs):
    def decorator(func):
        return func

    return decorator


Limiter.limit = _noop_limit


@pytest.fixture(autouse=True)
def _hide_external_calls(monkeypatch):
    """Ensure no real external API/network calls happen during tests.

    Requests routed through an httpx.ASGITransport (FastAPI TestClient) are allowed;
    anything that would touch the network is blocked.
    """
    import httpx
    from httpx import ASGITransport
    from urllib.parse import urlsplit

    def _guard(original):
        def wrapper(self, *args, **kwargs):
            try:
                base_host = str(self.base_url.host)
            except AttributeError:
                base_host = None
            if base_host in {"testserver", "localhost", "127.0.0.1", "0.0.0.0"}:
                return original(self, *args, **kwargs)
            url = args[0] if args else kwargs.get("url", "")
            if isinstance(url, str):
                host = urlsplit(url).hostname
                if host in {"testserver", "localhost", "127.0.0.1", "0.0.0.0"}:
                    return original(self, *args, **kwargs)
            transport = getattr(self, "_transport", None)
            if isinstance(transport, ASGITransport):
                return original(self, *args, **kwargs)
            raise AssertionError(f"Disallowed external HTTP request in tests: {original.__name__.upper()} {url}")

        return wrapper

    monkeypatch.setattr(httpx.Client, "get", _guard(httpx.Client.get))
    monkeypatch.setattr(httpx.Client, "post", _guard(httpx.Client.post))
    monkeypatch.setattr(httpx.AsyncClient, "get", _guard(httpx.AsyncClient.get))
    monkeypatch.setattr(httpx.AsyncClient, "post", _guard(httpx.AsyncClient.post))

    def _block_module(method):
        def _raise(*args, **kwargs):
            raise AssertionError(f"Disallowed external HTTP request in tests: {method.upper()}")

        return _raise

    monkeypatch.setattr(httpx, "get", _block_module("get"))
    monkeypatch.setattr(httpx, "post", _block_module("post"))

    yield