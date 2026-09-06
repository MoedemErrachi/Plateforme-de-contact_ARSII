from __future__ import annotations

from app.exceptions import ServiceUnavailableError


class TestServiceUnavailableError:
    def test_default_detail(self):
        exc = ServiceUnavailableError()
        assert exc.status_code == 503
        assert exc.detail == "Tous les fournisseurs LLM sont indisponibles. Veuillez réessayer plus tard."
        assert str(exc) == exc.detail

    def test_custom_detail(self):
        exc = ServiceUnavailableError("boom")
        assert exc.status_code == 503
        assert exc.detail == "boom"
        assert str(exc) == "boom"