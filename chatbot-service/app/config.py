import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MAIN_API_BASE_URL = os.getenv("MAIN_API_BASE_URL", "http://localhost:4000").rstrip("/")

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

MISTRAL_MODEL = os.getenv("MISTRAL_MODEL", "mistral-small-latest")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "3600"))
SESSION_MAX_MESSAGES = int(os.getenv("SESSION_MAX_MESSAGES", "10"))
CHATBOT_RATE_LIMIT = os.getenv("CHATBOT_RATE_LIMIT", "20/minute")
MAX_TOOL_ROUNDS = int(os.getenv("MAX_TOOL_ROUNDS", "3"))
FRONTEND_ORIGINS = [o.strip() for o in os.getenv("FRONTEND_ORIGINS", "").split(",") if o.strip()]
