import { useEffect, useRef, useState } from 'react'
import { X, Send, Mic, Square, Sparkles, Loader2 } from 'lucide-react'
import { askAssistant, type ChatTurn } from '../api/client'
import { useStore } from '../store/useStore'

interface Message extends ChatTurn {
  error?: boolean
}

const SUGGESTIONS = [
  'Como está nosso mês?',
  'Gastei 50 no mercado',
  'Quanto eu devo pro/pra meu amor?',
  'Quero juntar 5 mil pra viagem',
]

// --- Web Speech API (reconhecimento de voz em pt-BR) ---
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

function getSpeechRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) return null
  const rec = new Ctor()
  rec.lang = 'pt-BR'
  rec.continuous = false
  rec.interimResults = true
  return rec
}

export default function ChatAssistant() {
  const { couple, profile } = useStore()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const speechSupported = typeof window !== 'undefined' && !!getSpeechRecognition()

  const firstName = profile?.name?.split(' ')[0] || ''

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, open])

  // Encerra o reconhecimento de voz ao desmontar
  useEffect(() => () => recognitionRef.current?.stop(), [])

  if (!couple) return null

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || loading) return
    const history: ChatTurn[] = messages
      .filter(m => !m.error)
      .map(({ role, content }) => ({ role, content }))
    const next: Message[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await askAssistant(couple.id, content, history)
      setMessages([...next, { role: 'assistant', content: res.reply }])
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: string } } }
      const detail =
        e.response?.status === 503
          ? (e.response?.data?.detail ||
            'A IA (Ollama) não está acessível agora. Confira se o servidor está rodando.')
          : 'Ops, não consegui responder agora. Tente de novo em instantes.'
      setMessages([...next, { role: 'assistant', content: detail, error: true }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const rec = getSpeechRecognition()
    if (!rec) return
    recognitionRef.current = rec
    let finalText = ''
    rec.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript
      }
      finalText = text
      setInput(text)
    }
    rec.onend = () => {
      setListening(false)
      const t = finalText.trim()
      if (t) send(t)
    }
    rec.onerror = () => setListening(false)
    setListening(true)
    rec.start()
  }

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir assistente financeiro"
          className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30 transition-transform hover:scale-105 active:scale-95"
        >
          <Sparkles size={24} />
        </button>
      )}

      {/* Painel de chat */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-white shadow-2xl sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:rounded-3xl"
          style={{ height: 'min(80vh, 620px)' }}>
          {/* Cabeçalho */}
          <div className="flex items-center gap-3 rounded-t-3xl bg-gradient-to-br from-violet-600 to-fuchsia-500 px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <Sparkles size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold leading-tight">Fin • assistente do casal</p>
              <p className="text-[11px] text-white/80 leading-tight">Sua parceira financeira</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-full p-1 hover:bg-white/20">
              <X size={20} />
            </button>
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-3 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
                  Oi{firstName ? `, ${firstName}` : ''}! 👋 Sou a <b>Fin</b>. Posso lançar gastos,
                  pagar contas, criar metas e explicar seu resumo. É só falar ou escrever.
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 shadow-sm hover:bg-violet-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    m.role === 'user'
                      ? 'rounded-tr-sm bg-violet-600 text-white'
                      : m.error
                        ? 'rounded-tl-sm bg-red-50 text-red-700'
                        : 'rounded-tl-sm bg-white text-gray-800'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-500 shadow-sm">
                  <Loader2 size={14} className="animate-spin" /> pensando…
                </div>
              </div>
            )}
          </div>

          {/* Entrada */}
          <div className="flex items-center gap-2 border-t border-gray-100 bg-white px-3 py-2.5">
            {speechSupported && (
              <button
                onClick={toggleMic}
                aria-label={listening ? 'Parar gravação' : 'Falar'}
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                  listening ? 'animate-pulse bg-red-500 text-white' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                }`}
              >
                {listening ? <Square size={16} /> : <Mic size={18} />}
              </button>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(input) }}
              placeholder={listening ? 'Ouvindo…' : 'Fale ou escreva…'}
              className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm outline-none focus:border-violet-400 focus:bg-white"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              aria-label="Enviar"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-white disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
