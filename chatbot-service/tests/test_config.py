from __future__ import annotations

import dotenv

import app.config as config


def _reload_config(monkeypatch, env) -> None:
    import importlib

    monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: None)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    importlib.reload(config)


class TestConfigDefaults:
    def test_defaults_when_env_unset(self, monkeypatch):
        for key in (
            "HOST",
            "PORT",
            "MAIN_API_BASE_URL",
            "MISTRAL_API_KEY",
            "GROQ_API_KEY",
            "GEMINI_API_KEY",
            "MISTRAL_MODEL",
            "GROQ_MODEL",
            "GEMINI_MODEL",
            "GEMINI_FALLBACK_MODEL",
            "SESSION_TTL_SECONDS",
            "SESSION_MAX_MESSAGES",
            "CHATBOT_RATE_LIMIT",
            "MAX_TOOL_ROUNDS",
            "FRONTEND_ORIGINS",
        ):
            monkeypatch.delenv(key, raising=False)
        _reload_config(monkeypatch, {})
        assert config.HOST == "0.0.0.0"
        assert config.PORT == 8000
        assert config.MAIN_API_BASE_URL == "http://localhost:5000"
        assert config.MISTRAL_API_KEY == ""
        assert config.GROQ_API_KEY == ""
        assert config.GEMINI_API_KEY == ""
        assert config.MISTRAL_MODEL == "mistral-small-latest"
        assert config.GROQ_MODEL == "llama-3.3-70b-versatile"
        assert config.GEMINI_MODEL == "gemini-3.5-flash"
        assert config.GEMINI_FALLBACK_MODEL == "gemini-3.5-flash-lite"
        assert config.SESSION_TTL_SECONDS == 3600
        assert config.SESSION_MAX_MESSAGES == 10
        assert config.CHATBOT_RATE_LIMIT == "20/minute"
        assert config.MAX_TOOL_ROUNDS == 3
        assert config.FRONTEND_ORIGINS == []


class TestConfigCustomValues:
    def test_values_from_env(self, monkeypatch):
        _reload_config(
            monkeypatch,
            {
                "HOST": "127.0.0.1",
                "PORT": "9000",
                "MAIN_API_BASE_URL": "http://api.example.com/",
                "MISTRAL_API_KEY": "mistral-key",
                "GROQ_API_KEY": "groq-key",
                "GEMINI_API_KEY": "gemini-key",
                "MISTRAL_MODEL": "custom-mistral",
                "GROQ_MODEL": "custom-groq",
                "GEMINI_MODEL": "custom-gemini",
                "GEMINI_FALLBACK_MODEL": "custom-fallback",
                "SESSION_TTL_SECONDS": "120",
                "SESSION_MAX_MESSAGES": "5",
                "CHATBOT_RATE_LIMIT": "100/minute",
                "MAX_TOOL_ROUNDS": "7",
                "FRONTEND_ORIGINS": " http://a.example , http://b.example ,, ,http://c.example ",
            },
        )
        assert config.HOST == "127.0.0.1"
        assert config.PORT == 9000
        assert config.MAIN_API_BASE_URL == "http://api.example.com"
        assert config.MISTRAL_API_KEY == "mistral-key"
        assert config.GROQ_API_KEY == "groq-key"
        assert config.GEMINI_API_KEY == "gemini-key"
        assert config.MISTRAL_MODEL == "custom-mistral"
        assert config.GROQ_MODEL == "custom-groq"
        assert config.GEMINI_MODEL == "custom-gemini"
        assert config.GEMINI_FALLBACK_MODEL == "custom-fallback"
        assert config.SESSION_TTL_SECONDS == 120
        assert config.SESSION_MAX_MESSAGES == 5
        assert config.CHATBOT_RATE_LIMIT == "100/minute"
        assert config.MAX_TOOL_ROUNDS == 7
        assert config.FRONTEND_ORIGINS == ["http://a.example", "http://b.example", "http://c.example"]