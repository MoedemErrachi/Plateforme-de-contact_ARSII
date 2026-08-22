from __future__ import annotations

import logging
import os
import re
import traceback
import unicodedata

import jwt as pyjwt
from fastapi import APIRouter, Header, HTTPException, Request, status

from app.config import CHATBOT_RATE_LIMIT, MAX_TOOL_ROUNDS
from app.dependencies import get_llm_router, limiter, session_store, tool_runner
from app.exceptions import ServiceUnavailableError
from app.models.schemas import ChatRequest, ChatResponse
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.providers.base import build_assistant_message
from app.services.validation import build_final_text_messages, validate_final_response
from app.tools.tools import TOOL_DEFINITIONS

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])

GREETINGS = {"bonjour", "salut", "bonsoir", "bonne journee", "hello", "hi", "hey", "coucou", "yo", "bonjour!"}
HELP_MARKERS = (
    "aide",
    "que peux-tu faire",
    "que puis-je faire",
    "help",
    "fonctionnalites",
    "peux-tu m'aider",
    "comment ca marche",
    "comment tu marches",
    "menu",
)


def normalize_text(text: str) -> str:
    ascii_text = unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", ascii_text.lower()).strip()


def should_short_circuit(message: str) -> bool:
    text = normalize_text(message)
    if text in GREETINGS or text.rstrip("?!.") in GREETINGS:
        return True
    return any(marker in text for marker in HELP_MARKERS)


def help_response() -> ChatResponse:
    message = (
        "Bonjour ! Je suis l'assistant du CRM EURAXESS Africa. Voici ce que je peux faire pour vous :\n"
        "- Rechercher des chercheurs par pays, université, département/faculté, stade de carrière ou genre ;\n"
        "- Afficher le profil détaillé d'un chercheur ;\n"
        "- Fournir des statistiques agrégées de la base (par genre, pays, département ou stade) ;\n"
        "- Vérifier le journal des importations ou le nombre de contacts créés par import.\n"
        "Essayez par exemple : « Liste les chercheurs du Sénégal », « Combien de contacts sont en R2 ? » "
        "ou « Statistiques par pays »."
    )
    return ChatResponse(message=message, actions=[])


@router.post("/message", response_model=ChatResponse, response_model_exclude_none=True)
@limiter.limit(CHATBOT_RATE_LIMIT)
async def chatbot_message(
    request: Request,
    payload: ChatRequest,
    authorization: str = Header(None),
) -> ChatResponse:
    try:
        if not authorization:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing Authorization header",
            )
        if not authorization.lower().startswith("bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Authorization header. Expected 'Bearer <token>'",
            )
        token = authorization[7:].strip()
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Empty Bearer token",
            )

        jwt_secret = os.getenv("JWT_SECRET")
        if not jwt_secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service temporairement indisponible.",
            )
        try:
            pyjwt.decode(token, jwt_secret, algorithms=["HS256"])
        except pyjwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired",
            )
        except pyjwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )

        session_id = str(payload.session_id)

        if should_short_circuit(payload.message):
            response = help_response()
            session_store.push(session_id, payload.message, response.message)
            return response

        messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(session_store.get_messages(session_id))
        messages.append({"role": "user", "content": payload.message})

        final_content: str | None = None
        for _ in range(MAX_TOOL_ROUNDS):
            result = await get_llm_router().chat(messages, TOOL_DEFINITIONS, timeout=15)
            if not result.has_tool_calls:
                final_content = result.content
                break
            messages.append(build_assistant_message(result))
            for tool_call in result.tool_calls:
                tool_output = await tool_runner.execute(tool_call.name, tool_call.arguments, token)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": tool_call.name,
                        "content": tool_output,
                    }
                )

        if final_content is None:
            final_content = "Je n'ai pas pu terminer ma réponse. Merci de reformuler votre demande."

        # Phase 2 — formattage structuré natif (toujours exécuté, sans tools).
        # En cas d'échec (transport ou autre), dégradation sur le contenu de phase 1.
        try:
            phase2_content = await get_llm_router().chat_final(build_final_text_messages(messages), timeout=15)
            response = validate_final_response(phase2_content)
        except ServiceUnavailableError:
            logger.warning("chat_final indisponible, dégradation sur le contenu de phase 1")
            response = validate_final_response(final_content)
        except Exception as exc:
            logger.warning("chat_final en erreur, dégradation sur le contenu de phase 1: %s", exc)
            response = validate_final_response(final_content)

        session_store.push(session_id, payload.message, response.message)
        return response
    except (HTTPException, ServiceUnavailableError):
        raise
    except Exception as exc:
        logger.error(
            f"Unhandled error in chatbot route: {str(exc)}\n{traceback.format_exc()}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur interne est survenue lors du traitement.",
        )
