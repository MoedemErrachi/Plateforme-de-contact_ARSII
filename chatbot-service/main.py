from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.config import FRONTEND_ORIGINS
from app.dependencies import get_llm_router, limiter, session_store, tool_runner
from app.exceptions import ServiceUnavailableError
from app.routes.chatbot_routes import router as chatbot_router
from app.routes.ocr_routes import router as ocr_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await tool_runner.start()
    await session_store.start_cleanup(interval_seconds=300)
    providers = [provider.name for provider in get_llm_router().providers]
    logger.info("Chatbot CRM service started. Configured providers: %s", providers or "NONE")
    yield
    await session_store.stop_cleanup()
    await tool_runner.aclose()


app = FastAPI(title="Chatbot CRM Service", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
]
for origin in FRONTEND_ORIGINS:
    if origin and origin != "*" and origin not in origins:
        origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(_request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"error": "rate_limit_exceeded", "detail": str(exc)})


@app.exception_handler(ServiceUnavailableError)
async def service_unavailable_handler(_request: Request, exc: ServiceUnavailableError):
    return JSONResponse(status_code=503, content={"error": "service_unavailable", "detail": exc.detail})


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "chatbot-crm"}


app.include_router(chatbot_router)
app.include_router(ocr_router)
