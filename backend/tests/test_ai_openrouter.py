from backend.services import ai_assistant_service


class _Response:
    status_code = 200

    def json(self):
        return {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "Resposta da Fin",
                    }
                }
            ]
        }


class _Client:
    last_request = None

    def __init__(self, timeout):
        self.timeout = timeout

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def post(self, url, headers, json):
        _Client.last_request = {"url": url, "headers": headers, "json": json, "timeout": self.timeout}
        return _Response()


def test_openrouter_chat_uses_configured_endpoint_and_secret(monkeypatch):
    monkeypatch.setattr(ai_assistant_service, "OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(ai_assistant_service, "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    monkeypatch.setattr(ai_assistant_service, "OPENROUTER_MODEL", "openai/gpt-5.2")
    monkeypatch.setattr(
        ai_assistant_service,
        "OPENROUTER_FALLBACK_MODELS",
        ["openai/gpt-5.6-sol", "google/gemini-3.8-flash", "anthropic/claude-sonnet-5"],
    )
    monkeypatch.setattr(ai_assistant_service.httpx, "Client", _Client)

    message = ai_assistant_service._openrouter_chat([{"role": "user", "content": "oi"}], use_tools=False)

    assert message == {"role": "assistant", "content": "Resposta da Fin"}
    assert _Client.last_request["url"] == "https://openrouter.ai/api/v1/chat/completions"
    assert _Client.last_request["headers"]["Authorization"] == "Bearer test-key"
    assert _Client.last_request["json"]["models"] == [
        "openai/gpt-5.2",
        "openai/gpt-5.6-sol",
        "google/gemini-3.8-flash",
    ]
    assert _Client.last_request["json"]["provider"] == {
        "data_collection": "deny",
        "require_parameters": True,
    }
    assert "tools" not in _Client.last_request["json"]
