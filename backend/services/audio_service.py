"""
Cliente para o whisper_server — transcrição de áudio (mensagens de voz do Telegram).

Requisitos de execução:
  - Um whisper_server acessível (local: `uvicorn whisper_server.app:app --port 8090`;
    produção: mesma VPS que hospeda o Ollama).
  - Variável de ambiente: WHISPER_BASE_URL (default http://localhost:8090)
"""

import os

import httpx

WHISPER_BASE_URL = os.getenv("WHISPER_BASE_URL", "http://localhost:8090").rstrip("/")
WHISPER_TIMEOUT = float(os.getenv("WHISPER_TIMEOUT", "60"))


class TranscriptionUnavailable(Exception):
    """O serviço de transcrição não está acessível ou falhou."""


def transcribe(audio_bytes: bytes, filename: str = "audio.ogg") -> str:
    """Envia o áudio para o whisper_server e devolve o texto transcrito."""
    try:
        with httpx.Client(timeout=WHISPER_TIMEOUT) as client:
            resp = client.post(
                f"{WHISPER_BASE_URL}/transcribe",
                files={"file": (filename, audio_bytes)},
            )
    except httpx.HTTPError as exc:
        raise TranscriptionUnavailable(
            f"Não consegui falar com o serviço de transcrição em {WHISPER_BASE_URL}. Detalhe: {exc}"
        ) from exc

    if resp.status_code >= 400:
        raise TranscriptionUnavailable(f"Whisper retornou erro {resp.status_code}: {resp.text[:300]}")

    text = (resp.json().get("text") or "").strip()
    if not text:
        raise TranscriptionUnavailable("Não consegui entender o áudio, tente falar de novo.")
    return text
