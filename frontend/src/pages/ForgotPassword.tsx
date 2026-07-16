import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Heart, Mail, ShieldCheck } from 'lucide-react'
import { forgotPassword } from '../api/client'

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response
    if (response?.data?.detail) return response.data.detail
  }
  if (error instanceof Error) return error.message
  return fallback
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      await forgotPassword(email.trim().toLowerCase())
      setSent(true)
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Não foi possível enviar o e-mail. Tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#FFF8FC] px-3 py-5 text-[#101828] sm:px-6 sm:py-8 lg:px-8">
      <div className="absolute -left-32 -top-44 h-[430px] w-[560px] rounded-[48%] bg-pink-200/45 blur-sm" />
      <div className="absolute -right-32 bottom-0 h-[420px] w-[600px] rounded-[52%_48%_0_0] bg-[#F4E9FF]/90" />

      <section className="relative z-10 mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-5xl flex-col items-center justify-center">
        <header className="mb-5 text-center sm:mb-7">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[1.55rem] bg-gradient-to-br from-[#FF3C9A] to-[#D92D7D] shadow-[0_18px_35px_rgba(217,45,125,0.24)] sm:h-24 sm:w-24">
            <Heart className="h-10 w-10 text-white sm:h-12 sm:w-12" fill="white" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-extrabold leading-none tracking-normal text-[#101828] sm:text-5xl">
            Esqueceu a senha?
          </h1>
          <p className="mt-3 text-base font-medium text-[#667085] sm:mt-4 sm:text-xl">
            Sem problema, vamos te enviar um link de redefinição
          </p>
        </header>

        <div className="w-full max-w-[520px] rounded-[1.5rem] border border-white/80 bg-white/95 p-4 shadow-[0_24px_80px_rgba(16,24,40,0.10)] backdrop-blur sm:rounded-[2rem] sm:p-8 md:p-10">
          {sent ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FCE8F2] text-[#D92D7D]">
                <Mail size={26} />
              </div>
              <p className="text-base font-semibold text-[#101828] sm:text-lg">
                Se o e-mail <span className="text-[#D92D7D]">{email.trim().toLowerCase()}</span> estiver
                cadastrado, você vai receber um link para redefinir sua senha em instantes.
              </p>
              <p className="text-sm text-[#667085]">Confira também a caixa de spam.</p>
              <Link
                to="/login"
                className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[#D92D7D] hover:underline"
              >
                <ArrowLeft size={16} /> Voltar para o login
              </Link>
            </div>
          ) : (
            <form
              className="space-y-5 sm:space-y-6"
              onSubmit={(event) => {
                event.preventDefault()
                handleSubmit()
              }}
            >
              <div>
                <label htmlFor="email" className="mb-2 block text-base font-bold text-[#101828]">
                  Email cadastrado
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

              {error && (
                <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600" role="alert">
                  {error}
                </p>
              )}

              <button
                className="mt-2 flex min-h-[52px] w-full items-center justify-center rounded-[1rem] bg-gradient-to-r from-[#FF2F92] to-[#D92D7D] py-3 text-lg font-extrabold text-white shadow-[0_16px_30px_rgba(236,62,146,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_36px_rgba(236,62,146,0.30)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none sm:min-h-[58px] sm:rounded-[1.15rem] sm:text-xl"
                type="submit"
                disabled={loading || !email}
                aria-busy={loading}
              >
                {loading ? 'Enviando...' : 'Enviar link de redefinição'}
              </button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-sm font-bold text-[#667085] hover:text-[#D92D7D]"
              >
                <ArrowLeft size={16} /> Voltar para o login
              </Link>
            </form>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-3 text-center text-base font-medium text-[#667085]">
          <ShieldCheck className="h-7 w-7 text-[#EC3E92]" />
          Seus dados são privados e seguros
        </p>
      </section>
    </main>
  )
}
