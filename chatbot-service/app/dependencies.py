from slowapi import Limiter
from slowapi.util import get_remote_address

from app.providers.llm_router import LLMRouter, build_default_providers
from app.services.session_store import SessionStore
from app.tools.tools import ToolRunner

limiter = Limiter(key_func=get_remote_address)

session_store = SessionStore()
tool_runner = ToolRunner()

_llm_router: LLMRouter | None = None


def get_llm_router() -> LLMRouter:
    global _llm_router
    if _llm_router is None:
        _llm_router = LLMRouter(providers=build_default_providers())
    return _llm_router
