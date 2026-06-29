import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Check, Send } from 'lucide-react'
import { completeTelegramProfile, getTelegramCompletionProfile } from '../api/client'

export default function CompleteProfile() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''

  const [name, setName] = useState('')
  const [income, setIncome] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('female')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (!token) {
      setMessage({ type: 'err', text: 'Link invalido.' })
      setLoading(false)
      return
    }
    getTelegramCompletionProfile(token)
      .then(profile => {
        setName(profile.name || '')
        setIncome(String(profile.monthly_income || ''))
        setGender(profile.gender || 'female')
      })
      .catch(() => setMessage({ type: 'err', text: 'Link invalido ou expirado.' }))
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      setMessage({ type: 'err', text: 'Preencha nome, email e uma senha com pelo menos 6 caracteres.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      await completeTelegramProfile({
        token,
        name,
        email,
        password,
        monthly_income: parseFloat(income) || 0,
        gender,
      })
      setMessage({ type: 'ok', text: 'Perfil concluido. Entre com seu email e senha.' })
      setTimeout(() => navigate('/auth'), 900)
    } catch (e: any) {
      setMessage({ type: 'err', text: e.response?.data?.detail || 'Erro ao concluir perfil.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <div className="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center mb-4">
          <Send className="text-sky-500" size={22} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Complete seu perfil</h1>
        <p className="text-sm text-gray-500 mb-6">Use um email e senha para acessar o painel Web.</p>

        {loading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : (
          <div className="space-y-3">
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Nome" />
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" />
            <input className="input" type="number" value={income} onChange={e => setIncome(e.target.value)} placeholder="Renda mensal" />
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'female' as const, label: 'Mulher' },
                { value: 'male' as const, label: 'Homem' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGender(opt.value)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                    gender === opt.value ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {message && (
              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${
                message.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}>
                {message.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
                {message.text}
              </div>
            )}

            <button className="btn-primary" onClick={handleSubmit} disabled={saving || message?.text === 'Link invalido ou expirado.'}>
              {saving ? 'Salvando...' : 'Concluir cadastro'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
