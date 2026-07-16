"""
Servidor de transcrição de áudio para a Fin — roda na mesma VPS que hospeda o Ollama.

Serviço deployável separado do backend principal (que roda serverless na Vercel):
faster-whisper precisa manter o modelo carregado em memória entre requisições, o que
uma função serverless não garante.

Rodar localmente:
    uvicorn whisper_server.app:app --port 8090

Variáveis de ambiente:
    WHISPER_MODEL         tamanho/nome do modelo faster-whisper (default "small")
    WHISPER_DEVICE        "cpu" ou "cuda" (default "cpu")
    WHISPER_COMPUTE_TYPE  precisão do cálculo, ex. "int8" para CPU (default "int8")
"""

import io
import os

from fastapi import FastAPI, HTTPException, UploadFile
from faster_whisper import WhisperModel

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

app = FastAPI(title="Fin — Whisper transcription server")

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(WHISPER_MODEL, device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE_TYPE)
    return _model


@app.get("/health")
def health():
    return {"ok": True, "model": WHISPER_MODEL, "device": WHISPER_DEVICE, "loaded": _model is not None}


@app.post("/transcribe")
async def transcribe(file: UploadFile):
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(400, "Arquivo de áudio vazio.")

    model = _get_model()
    segments, _info = model.transcribe(io.BytesIO(audio_bytes), language="pt", vad_filter=True)
    text = " ".join(segment.text.strip() for segment in segments).strip()
    return {"text": text}
