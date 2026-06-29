import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Link, ArrowRight } from 'lucide-react'
import { createCouple, joinCouple } from '../api/client'
import { useStore } from '../store/useStore'

type Step = 'choice' | 'creating' | 'invite' | 'joining'

const SPLIT_OPTIONS = [
  { value: '50_50', label: '50/50', desc: 'Cada um paga metade' },
  { value: 'proportional', label: 'Proporcional', desc: 'Cada um paga conforme a renda' },
]

export default function CoupleSetup() {
  const navigate = useNavigate()
  const { profile, setCouple } = useStore()

  const [step, setStep] = useState<Step>('choice')
  const [splitMode, setSplitMode] = useState('50_50')
  const [inviteToken, setInviteToken] = useState('')
  const [createdToken, setCreatedToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    setLoading(true); setError('')
    try {
      const couple = await createCouple(splitMode)
      setCreatedToken(couple.invite_token)
      setCouple(couple)
      setStep('invite')
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao criar casal')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    setLoading(true); setError('')
    try {
      const couple = await joinCouple(inviteToken.trim(), splitMode)
      setCouple(couple)
      navigate('/dashboard')
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Código inválido')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'choice') return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-16">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Olá, {profile?.name || 'bem-vindo(a)'}!</h2>
      <p className="text-gray-500 mb-10">Vamos conectar você ao seu casal</p>

      <div className="space-y-4 flex-1">
        <button
          onClick={() => setStep('creating')}
          className="w-full p-5 rounded-2xl border-2 border-gray-200 hover:border-pink-300 text-left transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-pink-100 rounded-2xl flex items-center justify-center group-hover:bg-pink-200 transition-colors">
              <Users className="text-pink-500" size={24} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Criar novo casal</p>
              <p className="text-sm text-gray-400">Gere um código para convidar seu(sua) parceiro(a)</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStep('joining')}
          className="w-full p-5 rounded-2xl border-2 border-gray-200 hover:border-purple-300 text-left transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <Link className="text-purple-500" size={24} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Entrar com código</p>
              <p className="text-sm text-gray-400">Já tem um código de convite? Entre aqui</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  )

  if (step === 'creating') return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-16">
      <button className="btn-ghost text-left -ml-4 mb-6" onClick={() => setStep('choice')}>← Voltar</button>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Como dividir?</h2>
      <p className="text-gray-500 mb-8">Escolha como vocês vão dividir as despesas</p>

      <div className="space-y-3 flex-1">
        {SPLIT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSplitMode(opt.value)}
            className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
              splitMode === opt.value ? 'border-pink-500 bg-pink-50' : 'border-gray-200'
            }`}
          >
            <div className="font-semibold text-gray-900">{opt.label}</div>
            <div className="text-sm text-gray-500">{opt.desc}</div>
          </button>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm my-3">{error}</p>}
      <button className="btn-primary mt-8 mb-8" onClick={handleCreate} disabled={loading}>
        {loading ? 'Criando...' : 'Criar casal'} <ArrowRight className="inline ml-1" size={18} />
      </button>
    </div>
  )

  if (step === 'invite') return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-16 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-6">
        <span className="text-3xl">🎉</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Casal criado!</h2>
      <p className="text-gray-500 mb-8 max-w-xs">Envie este código para seu(sua) parceiro(a) criar a conta e entrar</p>

      <div className="card w-full max-w-sm text-left mb-6">
        <p className="text-xs text-gray-400 mb-2">Código de convite</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 bg-pink-50 px-4 py-3 rounded-xl text-pink-600 font-mono text-xl font-bold tracking-wider">
            {createdToken}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(createdToken)}
            className="text-pink-500 hover:text-pink-600 p-2"
          >
            <Link size={20} />
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-8 max-w-xs">
        Seu(sua) parceiro(a) deve criar uma conta e usar este código na tela de setup.
      </p>

      <button className="btn-primary max-w-sm w-full" onClick={() => navigate('/dashboard')}>
        Ir para o Dashboard
      </button>
    </div>
  )

  if (step === 'joining') return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-16">
      <button className="btn-ghost text-left -ml-4 mb-6" onClick={() => setStep('choice')}>← Voltar</button>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Entrar no casal</h2>
      <p className="text-gray-500 mb-8">Digite o código que seu(sua) parceiro(a) te enviou</p>

      <div className="space-y-4 flex-1">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Código de convite</label>
          <input
            className="input font-mono text-lg tracking-wider text-center"
            placeholder="Ex: abc12XYZ"
            value={inviteToken}
            onChange={e => setInviteToken(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Como dividir as despesas?</label>
          {SPLIT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSplitMode(opt.value)}
              className={`w-full p-3 rounded-xl border-2 text-left mb-2 transition-all ${
                splitMode === opt.value ? 'border-pink-500 bg-pink-50' : 'border-gray-200'
              }`}
            >
              <span className="font-medium text-sm">{opt.label}</span>
              <span className="text-gray-400 text-xs ml-2">— {opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm my-3">{error}</p>}
      <button
        className="btn-primary mt-6 mb-8"
        onClick={handleJoin}
        disabled={loading || !inviteToken}
      >
        {loading ? 'Entrando...' : 'Entrar no casal'}
      </button>
    </div>
  )

  return null
}
