# Fin — Assistente Financeiro do Casal (Ollama)

A **Fin** é a assistente de IA do FinCouple. Ela roda sobre um modelo **Ollama** (LLM local),
entende o contexto financeiro do casal e **executa ações reais** por comando de voz ou texto:
lançar gastos, pagar contas, criar metas, registrar aportes e explicar o resumo do mês.

## Como funciona (o "treino" do MVP)

Não é fine-tuning. O assistente é "treinado" de três formas combinadas:

1. **System prompt** com TODAS as funcionalidades do app + o retrato financeiro do casal
   (nomes, rendas, modo de divisão, total do mês, gastos por categoria, saldo, contas, metas).
2. **Function-calling (tools)**: o modelo chama funções ligadas aos serviços reais do backend,
   então ele consulta dados verdadeiros e executa ações — nunca inventa números.
3. **Contexto por mensagem**: a cada pergunta o retrato financeiro é reinjetado, então ele
   "entende" o que a pessoa está falando.

Ferramentas disponíveis: `get_financial_summary`, `list_expenses`, `add_expense`,
`delete_expense`, `list_bills`, `add_bill`, `pay_bill`, `unpay_bill`, `delete_bill`,
`list_goals`, `create_goal`, `contribute_goal`, `delete_goal`, `list_categories`,
`create_category`, `update_category`, `delete_category`.

## Canais — Web e Telegram

A mesma Fin (mesmas tools, mesmo `ai_assistant_service.chat()`) responde em dois lugares:

- **App web**: `POST /couples/{couple_id}/assistant/chat` (chamado pelo `ChatAssistant.tsx`).
- **Telegram**: qualquer mensagem de texto ou áudio mandada ao bot (depois de `/login` ou
  `/start`) vai direto pra Fin — não existe mais menu de botão pra gasto/contas/metas/resumo,
  é tudo conversa. Onboarding (`/start`) e login (`/login`) continuam sendo fluxos de estado
  determinísticos (envolvem senha/token, não é papel da IA autenticar). Ver
  `backend/bot/main.py` (`handle_ai_message`, `handle_voice_message`).

Cada canal mantém seu próprio histórico curto (últimos 10 turnos) — o do Telegram vive em
`context.user_data["_chat_history"]` por chat.

## Áudio 🎙️

Dois mecanismos diferentes, um por canal:

- **App web**: o microfone no chat usa a **Web Speech API** (reconhecimento de voz em
  `pt-BR`), on-device, sem custo. Funciona no app web/desktop (Chrome/Edge/Safari). Em app
  nativo (Capacitor) o botão de microfone é ocultado automaticamente.
- **Telegram**: mensagens de voz (🎙️) são baixadas pelo bot e transcritas no servidor por um
  **Whisper local** (`faster-whisper`), rodando como um microsserviço separado —
  `whisper_server/` — na mesma VPS que hospeda o Ollama (não dá pra rodar isso na função
  serverless da Vercel: precisa manter o modelo carregado em memória). O texto transcrito
  entra no mesmo fluxo de `handle_ai_message` de uma mensagem digitada.

## Setup (rodar localmente)

1. Instale o Ollama: https://ollama.com/download
2. Baixe um modelo **com suporte a tools** (obrigatório para as ações):
   ```bash
   ollama pull llama3.1        # recomendado
   # alternativas boas em português: qwen2.5, mistral-nemo
   ```
3. Deixe o servidor rodando:
   ```bash
   ollama serve                # expõe http://localhost:11434
   ```
4. Suba o servidor de transcrição (só necessário pra testar áudio no Telegram):
   ```bash
   pip install -r whisper_server/requirements.txt
   uvicorn whisper_server.app:app --port 8090
   ```
5. No `.env` do backend:
   ```
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.1
   OLLAMA_TIMEOUT=120
   WHISPER_BASE_URL=http://localhost:8090
   WHISPER_MODEL=small
   WHISPER_TIMEOUT=60
   ```
6. Suba o backend (`uvicorn backend.main:app --reload`) e o frontend (`npm run dev`).
   O botão flutuante ✨ aparece nas telas do casal.
7. Pra testar o bot sem depender do webhook da Vercel, rode em modo polling:
   ```bash
   python -m backend.bot.main
   ```

## Produção ⚠️

O **Vercel (serverless) não roda o Ollama nem o whisper_server** — não mantém processos/modelos
em memória entre requisições. Para produção, hospede ambos num servidor persistente (VPS/GPU:
Fly.io, Railway, RunPod, EC2, etc.) e aponte `OLLAMA_BASE_URL`/`WHISPER_BASE_URL` pra essa URL
(protegida por rede privada ou token no proxy). O backend principal (Vercel) e o webhook do
Telegram só fazem chamadas HTTP pra essa VPS — nenhum modelo pesado entra no bundle serverless.

Verifique a saúde a qualquer momento:
```
GET /couples/{couple_id}/assistant/health   # Ollama
GET {WHISPER_BASE_URL}/health               # Whisper
```

## Endpoint (web)

```
POST /couples/{couple_id}/assistant/chat
Authorization: Bearer <jwt>
{ "message": "gastei 80 no mercado", "history": [ {"role":"user","content":"..."}, ... ] }

-> {
     "reply": "Anotei R$ 80,00 em Mercado 🛒 ...",
     "actions": ["add_expense"],
     "action_results": [{"name": "add_expense", "args": {...}, "result": {...}}],
     "model": "llama3.1"
   }
```
