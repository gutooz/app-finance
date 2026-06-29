import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeDollarSign,
  Eye,
  EyeOff,
  Heart,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { loginUser, registerUser } from '../api/client'

type Mode = 'login' | 'register'

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response
    if (response?.data?.detail) return response.data.detail
  }
  if (error instanceof Error) return error.message
  return fallback
}

function CoupleIllustration() {
  return (
    <svg
      className="pointer-events-none absolute bottom-0 left-0 hidden h-[420px] w-[520px] text-pink-300 opacity-70 lg:block"
      viewBox="0 0 520 420"
      fill="none"
      aria-hidden="true"
    >
      <path d="M0 350H520V420H0V350Z" fill="#FCE8F2" />
      <path d="M20 260H45V350H20V260Z" fill="#F9D8EA" opacity=".45" />
      <path d="M62 238H92V350H62V238Z" fill="#F9D8EA" opacity=".42" />
      <path d="M118 225H160V350H118V225Z" fill="#F7CBE4" opacity=".36" />
      <path d="M186 202H230V350H186V202Z" fill="#F2BADA" opacity=".34" />
      <path d="M260 244H300V350H260V244Z" fill="#F8D8EA" opacity=".38" />
      <path d="M330 270H370V350H330V270Z" fill="#F8D8EA" opacity=".35" />
      <path d="M120 349C137 302 163 281 199 286C236 292 260 317 274 349H120Z" fill="#F3B5D7" />
      <path d="M216 349C224 304 244 280 277 281C314 282 338 310 354 349H216Z" fill="#F7C3DE" />
      <circle cx="205" cy="244" r="32" fill="#D95C9A" />
      <path d="M178 245C186 217 206 204 231 212C238 238 226 259 197 270C188 264 181 256 178 245Z" fill="#C94788" />
      <circle cx="281" cy="253" r="34" fill="#F09BC6" />
      <path d="M250 253C258 222 280 209 307 219C320 244 310 272 275 290C261 282 253 270 250 253Z" fill="#EA82B8" />
      <path d="M222 297C254 296 283 313 305 348H190C195 318 205 302 222 297Z" fill="#FFE4F1" />
      <path d="M287 302C322 308 344 325 361 349H242C247 322 262 306 287 302Z" fill="#FFD4EA" />
      <path d="M228 295C248 310 275 314 308 307" stroke="#C94788" strokeWidth="18" strokeLinecap="round" />
      <path d="M74 350C73 316 83 291 105 274" stroke="#F3A7CD" strokeWidth="8" strokeLinecap="round" />
      <path d="M75 324C45 317 31 299 31 271C58 276 73 294 75 324Z" fill="#F4B4D5" opacity=".8" />
      <path d="M81 306C98 280 116 270 136 275C129 300 111 312 81 306Z" fill="#F4B4D5" opacity=".75" />
      <path d="M66 292C47 271 42 250 51 230C73 244 78 265 66 292Z" fill="#F4B4D5" opacity=".7" />
      <path d="M48 350H112L105 395H56L48 350Z" fill="#FFEAF4" />
      <path d="M55 350H105" stroke="#F2A9CC" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

export default function Auth({ initialMode = 'login' }: { initialMode?: Mode }) {
  const navigate = useNavigate()
  const { setSession, setProfile, setCouple } = useStore()

  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [income, setIncome] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('female')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await loginUser({ email, password })
      setSession({ access_token: data.session.access_token, user: data.user })
      setProfile(data.profile || null)
      setCouple(data.couple || null)
      navigate(data.couple ? '/dashboard' : '/setup')
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Email ou senha incorretos'))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!name.trim()) {
      setError('Digite seu nome')
      return
    }
    if (password.length < 6) {
      setError('Senha deve ter ao menos 6 caracteres')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await registerUser({
        email,
        password,
        name,
        monthly_income: parseFloat(income) || 0,
        gender,
      })
      setSession({ access_token: data.session.access_token, user: data.user })
      setProfile({
        id: data.user.id,
        email: data.user.email,
        name,
        monthly_income: parseFloat(income) || 0,
        gender,
        couple_id: null,
      })
      setCouple(null)
      navigate('/setup')
    } catch (error: unknown) {
      const detail = getErrorMessage(error, 'Não foi possível criar sua conta')
      setError(detail?.includes('ja cadastrado') ? 'Este email ja está cadastrado. Faça login.' : detail)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = () => (mode === 'login' ? handleLogin() : handleRegister())

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#FFF8FC] px-3 py-5 text-[#101828] sm:px-6 sm:py-8 lg:px-8">
      <div className="absolute -left-32 -top-44 h-[430px] w-[560px] rounded-[48%] bg-pink-200/45 blur-sm" />
      <div className="absolute -right-32 bottom-0 h-[420px] w-[600px] rounded-[52%_48%_0_0] bg-[#F4E9FF]/90" />
      <div className="absolute right-0 top-[42%] hidden h-56 w-[44vw] rounded-l-full bg-white/45 lg:block" />
      <div className="absolute right-[14%] top-24 hidden text-[#EC3E92]/25 md:block">
        <Heart size={54} fill="currentColor" />
      </div>
      <div className="absolute right-[20%] top-36 hidden text-[#EC3E92]/30 md:block">
        <Heart size={34} fill="currentColor" />
      </div>

      <CoupleIllustration />

      <section className="relative z-10 mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-5xl flex-col items-center justify-center">
        <header className="mb-5 text-center sm:mb-7">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[1.55rem] bg-gradient-to-br from-[#FF3C9A] to-[#D92D7D] shadow-[0_18px_35px_rgba(217,45,125,0.24)] sm:h-24 sm:w-24">
            <Heart className="h-10 w-10 text-white sm:h-12 sm:w-12" fill="white" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-extrabold leading-none tracking-normal text-[#101828] sm:text-6xl">
            FinCouple
          </h1>
          <p className="mt-3 text-base font-medium text-[#667085] sm:mt-4 sm:text-xl">
            Finanças para <span className="font-bold text-[#EC3E92]">casais</span>, sem complicação
          </p>
        </header>

        <div className="w-full max-w-[680px] rounded-[1.5rem] border border-white/80 bg-white/95 p-4 shadow-[0_24px_80px_rgba(16,24,40,0.10)] backdrop-blur sm:rounded-[2rem] sm:p-8 md:p-10">
          <div className="mb-6 grid grid-cols-2 rounded-[1.15rem] bg-[#F3F4F7] p-1.5 sm:mb-8 sm:rounded-[1.35rem]">
            {(['login', 'register'] as Mode[]).map((item) => {
              const active = mode === item
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setMode(item)
                    setError('')
                  }}
                  className={`h-12 rounded-[1rem] text-sm font-bold transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 sm:h-14 sm:rounded-[1.1rem] sm:text-lg ${
                    active
                      ? 'border border-pink-200 bg-white text-[#D92D7D] shadow-[0_10px_24px_rgba(236,62,146,0.10)]'
                      : 'text-[#667085] hover:text-[#101828]'
                  }`}
                  aria-pressed={active}
                >
                  {item === 'login' ? 'Entrar' : 'Criar conta'}
                </button>
              )
            })}
          </div>

          <form
            className="space-y-5 sm:space-y-6"
            onSubmit={(event) => {
              event.preventDefault()
              handleSubmit()
            }}
          >
            {mode === 'register' && (
              <>
                <div>
                  <label htmlFor="name" className="mb-2 block text-base font-bold text-[#101828]">
                    Seu nome
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#EC3E92] sm:left-6 sm:h-6 sm:w-6" />
                    <input
                      id="name"
                      className="min-h-[52px] w-full rounded-[1rem] border border-[#DDE1E8] bg-white py-3 pl-12 pr-4 text-base text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#EC3E92] focus:ring-4 focus:ring-pink-100 sm:min-h-[58px] sm:rounded-[1.15rem] sm:pl-16 sm:pr-5 sm:text-lg"
                      placeholder="Ex: Isabella"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div>
                  <span className="mb-2 block text-base font-bold text-[#101828]">Perfil</span>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ value: 'female' as const, label: 'Mulher' }, { value: 'male' as const, label: 'Homem' }].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setGender(option.value)}
                        className={`h-12 rounded-2xl border px-4 text-sm font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 ${
                          gender === option.value
                            ? 'border-[#EC3E92] bg-[#FCE8F2] text-[#D92D7D]'
                            : 'border-[#DDE1E8] bg-white text-[#667085] hover:border-pink-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-base font-bold text-[#101828]">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#EC3E92] sm:left-6 sm:h-6 sm:w-6" />
                <input
                  id="email"
                  className="min-h-[52px] w-full rounded-[1rem] border border-[#DDE1E8] bg-white py-3 pl-12 pr-4 text-base text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#EC3E92] focus:ring-4 focus:ring-pink-100 sm:min-h-[58px] sm:rounded-[1.15rem] sm:pl-16 sm:pr-5 sm:text-lg"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-base font-bold text-[#101828]">
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#EC3E92] sm:left-6 sm:h-6 sm:w-6" />
                <input
                  id="password"
                  className="min-h-[52px] w-full rounded-[1rem] border border-[#DDE1E8] bg-white py-3 pl-12 pr-14 text-base text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#EC3E92] focus:ring-4 focus:ring-pink-100 sm:min-h-[58px] sm:rounded-[1.15rem] sm:pl-16 sm:pr-16 sm:text-lg"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'register' ? 6 : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((value) => !value)}
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[#98A2B3] transition hover:bg-pink-50 hover:text-[#EC3E92] focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 sm:right-5"
                  aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPass ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label htmlFor="income" className="mb-2 block text-base font-bold text-[#101828]">
                  Sua renda mensal <span className="font-medium text-[#667085]">(opcional)</span>
                </label>
                <div className="relative">
                  <BadgeDollarSign className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#EC3E92] sm:left-6 sm:h-6 sm:w-6" />
                  <input
                    id="income"
                    className="min-h-[52px] w-full rounded-[1rem] border border-[#DDE1E8] bg-white py-3 pl-12 pr-4 text-base text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#EC3E92] focus:ring-4 focus:ring-pink-100 sm:min-h-[58px] sm:rounded-[1.15rem] sm:pl-16 sm:pr-5 sm:text-lg"
                    placeholder="0,00"
                    type="number"
                    value={income}
                    onChange={(event) => setIncome(event.target.value)}
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              className="mt-2 flex min-h-[52px] w-full items-center justify-center rounded-[1rem] bg-gradient-to-r from-[#FF2F92] to-[#D92D7D] py-3 text-lg font-extrabold text-white shadow-[0_16px_30px_rgba(236,62,146,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_36px_rgba(236,62,146,0.30)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none sm:min-h-[58px] sm:rounded-[1.15rem] sm:text-xl"
              type="submit"
              disabled={loading || !email || !password}
              aria-busy={loading}
            >
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        </div>

        <p className="mt-6 flex items-center justify-center gap-3 text-center text-base font-medium text-[#667085]">
          <ShieldCheck className="h-7 w-7 text-[#EC3E92]" />
          Seus dados são privados e seguros
        </p>
      </section>
    </main>
  )
}
