from __future__ import annotations

import dotenv

import app.config as config


def _reload_config(monkeypatch, env) -> None:
    import importlib

    monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: None)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    importlib.reload(config)


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