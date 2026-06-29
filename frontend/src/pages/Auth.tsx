import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Eye, EyeOff } from 'lucide-react'
import { useStore } from '../store/useStore'
import { loginUser, registerUser } from '../api/client'

type Mode = 'login' | 'register'

export default function Auth() {
  const navigate = useNavigate()
  const { setSession, setProfile, setCouple } = useStore()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [income, setIncome] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('female')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true); setError('')
    try {
      const data = await loginUser({ email, password })
      setSession({ access_token: data.session.access_token, user: data.user })
      if (data.profile) setProfile(data.profile)
      if (data.couple) setCouple(data.couple)
      navigate(data.couple ? '/dashboard' : '/setup')
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Email ou senha incorretos')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!name.trim()) { setError('Digite seu nome'); return }
    if (password.length < 6) { setError('Senha deve ter ao menos 6 caracteres'); return }
    setLoading(true); setError('')
    try {
      const data = await registerUser({
        email,
        password,
        name,
        monthly_income: parseFloat(income) || 0,
        gender,
      })
      setSession({ access_token: data.session.access_token, user: data.user })
      navigate('/setup')
    } catch (e: any) {
      const detail = e.response?.data?.detail || e.message
      setError(detail?.includes('ja cadastrado') ? 'Este email ja esta cadastrado. Faca login.' : detail)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = () => mode === 'login' ? handleLogin() : handleRegister()

  const authThemeClass = mode === 'register' && gender === 'male' ? 'theme-male' : ''

  return (
    <div className={`${authThemeClass} min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex flex-col items-center justify-center px-6`}>
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <Heart className="text-white" size={32} fill="white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">FinCouple</h1>
        <p className="text-gray-500 text-sm">Financas para casais, sem complicacao</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Seu nome</label>
                <input className="input" placeholder="Ex: Isabella" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Perfil</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ value: 'female' as const, label: 'Mulher' }, { value: 'male' as const, label: 'Homem' }].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setGender(opt.value)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                        gender === opt.value ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 text-gray-500 hover:border-pink-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              className="input"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Senha</label>
            <div className="relative">
              <input
                className="input pr-12"
                type={showPass ? 'text' : 'password'}
                placeholder="Minimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-3 text-gray-400">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sua renda mensal (opcional)</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-400 text-sm font-medium">R$</span>
                <input className="input pl-10" placeholder="0,00" type="number" value={income} onChange={e => setIncome(e.target.value)} />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl">{error}</div>
          )}

          <button
            className="btn-primary mt-2"
            onClick={handleSubmit}
            disabled={loading || !email || !password}
          >
            {loading ? '...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-6">Seus dados sao privados e seguros</p>
    </div>
  )
}
