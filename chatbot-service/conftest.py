import pytest


@pytest.fixture(autouse=True)
def _hide_external_calls(monkeypatch):
    """Ensure no real external API/network calls happen during tests."""
    import httpx
    import sys

    captured = []

    def _no_http_request(method, url, *args, **kwargs):
        raise AssertionError(f"Disallowed external HTTP request in tests: {method.upper()} {url}")

    monkeypatch.setattr(httpx.Client, "post", _no_http_request)
    monkeypatch.setattr(httpx.Client, "get", _no_http_request)

    yield captured
