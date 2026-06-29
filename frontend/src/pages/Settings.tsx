import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Clipboard,
  ExternalLink,
  Lock,
  Mail,
  MessageCircle,
  Send,
  User,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { createTelegramLink, createWhatsAppLink, updateProfile, updateEmail, updatePassword } from '../api/client'

export default function Settings() {
  const navigate = useNavigate()
  const { profile, setProfile, session } = useStore()

  const [name, setName] = useState(profile?.name || '')
  const [income, setIncome] = useState(String(profile?.monthly_income || ''))
  const [gender, setGender] = useState<'male' | 'female'>(profile?.gender || 'female')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [passMsg, setPassMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [telegramMsg, setTelegramMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [whatsappMsg, setWhatsappMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [copyMsg, setCopyMsg] = useState('')
  const [telegramUrl, setTelegramUrl] = useState('')
  const [whatsappMessage, setWhatsappMessage] = useState('')
  const [whatsappUrl, setWhatsappUrl] = useState('')

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [connectingTelegram, setConnectingTelegram] = useState(false)
  const [connectingWhatsapp, setConnectingWhatsapp] = useState(false)

  const handleSaveProfile = async () => {
    if (!name.trim()) return
    setSavingProfile(true); setProfileMsg(null)
    try {
      const updated = await updateProfile({ name, monthly_income: parseFloat(income) || 0, gender })
      setProfile(updated)
      setProfileMsg({ type: 'ok', text: 'Perfil atualizado!' })
    } catch {
      setProfileMsg({ type: 'err', text: 'Erro ao salvar perfil.' })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveEmail = async () => {
    if (!newEmail) return
    setSavingEmail(true); setEmailMsg(null)
    try {
      await updateEmail(newEmail)
      setEmailMsg({ type: 'ok', text: 'Email atualizado com sucesso!' })
      setNewEmail('')
    } catch (e: any) {
      setEmailMsg({ type: 'err', text: e.response?.data?.detail || 'Erro ao atualizar email.' })
    } finally {
      setSavingEmail(false)
    }
  }

  const handleSavePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      setPassMsg({ type: 'err', text: 'As senhas nao coincidem.' }); return
    }
    if (newPassword.length < 6) {
      setPassMsg({ type: 'err', text: 'Senha deve ter ao menos 6 caracteres.' }); return
    }
    setSavingPass(true); setPassMsg(null)
    try {
      await updatePassword(newPassword)
      setPassMsg({ type: 'ok', text: 'Senha alterada com sucesso!' })
      setNewPassword(''); setConfirmPassword('')
    } catch (e: any) {
      setPassMsg({ type: 'err', text: e.response?.data?.detail || 'Erro ao alterar senha.' })
    } finally {
      setSavingPass(false)
    }
  }

  const handleConnectTelegram = async () => {
    setConnectingTelegram(true); setTelegramMsg(null)
    try {
      const data = await createTelegramLink()
      setTelegramUrl(data.bot_url)
      setTelegramMsg({ type: 'ok', text: `Link criado. Expira em ${data.expires_in_minutes} minutos.` })
      window.open(data.bot_url, '_blank', 'noopener,noreferrer')
    } catch {
      setTelegramMsg({ type: 'err', text: 'Erro ao gerar link do Telegram.' })
    } finally {
      setConnectingTelegram(false)
    }
  }

  const handleConnectWhatsapp = async () => {
    setConnectingWhatsapp(true); setWhatsappMsg(null)
    try {
      const data = await createWhatsAppLink()
      setWhatsappMessage(data.message)
      setWhatsappUrl(data.whatsapp_url || '')
      setWhatsappMsg({ type: 'ok', text: `Link criado. Expira em ${data.expires_in_minutes} minutos.` })
      if (data.whatsapp_url) {
        window.open(data.whatsapp_url, '_blank', 'noopener,noreferrer')
      }
    } catch {
      setWhatsappMsg({ type: 'err', text: 'Erro ao gerar link do WhatsApp.' })
    } finally {
      setConnectingWhatsapp(false)
    }
  }

  const copyValue = async (value: string, label: string) => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopyMsg(`${label} copiado`)
    window.setTimeout(() => setCopyMsg(''), 1800)
  }

  const Msg = ({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) => {
    if (!msg) return null
    return (
      <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl mt-2 ${
        msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
      }`}>
        {msg.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
        {msg.text}
      </div>
    )
  }

  const ResultBox = ({ label, value, href }: { label: string; value: string; href?: string }) => {
    if (!value) return null
    return (
      <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => copyValue(value, label)}
              className="h-8 w-8 rounded-lg text-gray-500 hover:bg-white hover:text-gray-800 flex items-center justify-center"
              aria-label={`Copiar ${label}`}
              title={`Copiar ${label}`}
            >
              <Clipboard size={15} />
            </button>
            {href && (
              <button
                type="button"
                onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
                className="h-8 w-8 rounded-lg text-gray-500 hover:bg-white hover:text-gray-800 flex items-center justify-center"
                aria-label={`Abrir ${label}`}
                title={`Abrir ${label}`}
              >
                <ExternalLink size={15} />
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 break-all font-mono text-xs leading-5 text-gray-700">{value}</p>
      </div>
    )
  }

  const ChannelCard = ({
    title,
    icon,
    accent,
    badges,
    msg,
    loading,
    buttonText,
    loadingText,
    onClick,
    children,
  }: {
    title: string
    icon: React.ReactNode
    accent: 'sky' | 'green'
    badges: string[]
    msg: { type: 'ok' | 'err'; text: string } | null
    loading: boolean
    buttonText: string
    loadingText: string
    onClick: () => void
    children?: React.ReactNode
  }) => {
    const color = accent === 'green'
      ? {
          bg: 'bg-green-50',
          border: 'border-green-100',
          icon: 'bg-green-500 text-white',
          chip: 'bg-green-50 text-green-700 border-green-100',
          button: 'bg-green-500 hover:bg-green-600 active:bg-green-700',
        }
      : {
          bg: 'bg-sky-50',
          border: 'border-sky-100',
          icon: 'bg-sky-500 text-white',
          chip: 'bg-sky-50 text-sky-700 border-sky-100',
          button: 'bg-sky-500 hover:bg-sky-600 active:bg-sky-700',
        }

    return (
      <div className={`rounded-2xl border ${color.border} bg-white p-4 shadow-sm`}>
        <div className={`-m-4 mb-4 rounded-t-2xl ${color.bg} px-4 py-4`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-2xl ${color.icon} flex items-center justify-center shadow-sm`}>
                {icon}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{title}</h2>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {badges.map(badge => (
                    <span key={badge} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${color.chip}`}>
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          </div>
        </div>
        <Msg msg={msg} />
        {children}
        <button
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors ${color.button}`}
          onClick={onClick}
          disabled={loading}
        >
          {loading ? loadingText : buttonText}
          {!loading && <ExternalLink size={16} />}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="text-gray-500">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Configuracoes</h1>
      </div>

      <div className="page pt-4 space-y-4">
        <div className="card bg-gradient-to-r from-pink-50 to-purple-50 border-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center text-white font-bold text-xl">
              {profile?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{profile?.name || 'Sem nome'}</p>
              <p className="text-sm text-gray-400">{session?.user?.email}</p>
            </div>
          </div>
        </div>

        {/* Perfil */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <User size={18} className="text-pink-500" />
            <h2 className="font-semibold text-gray-800">Perfil</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Renda mensal</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-400 text-sm">R$</span>
                <input className="input pl-10" type="number" value={income} onChange={e => setIncome(e.target.value)} placeholder="0,00" />
              </div>
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
                      gender === opt.value ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <Msg msg={profileMsg} />
            <button className="btn-primary py-2.5" onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? 'Salvando...' : 'Salvar perfil'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Canais</p>
              <h2 className="text-lg font-bold text-gray-900">Bots conectados</h2>
            </div>
            {copyMsg && <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white">{copyMsg}</span>}
          </div>

          <ChannelCard
            title="WhatsApp"
            icon={<MessageCircle size={21} />}
            accent="green"
            badges={['Gastos', 'Receitas', 'Casal']}
            msg={whatsappMsg}
            loading={connectingWhatsapp}
            buttonText="Conectar WhatsApp"
            loadingText="Gerando link..."
            onClick={handleConnectWhatsapp}
          >
            <ResultBox label="Mensagem" value={whatsappMessage} />
            <ResultBox label="Link" value={whatsappUrl} href={whatsappUrl} />
          </ChannelCard>

          <ChannelCard
            title="Telegram"
            icon={<Send size={20} />}
            accent="sky"
            badges={['Bot', 'Gastos', 'Alertas']}
            msg={telegramMsg}
            loading={connectingTelegram}
            buttonText="Conectar Telegram"
            loadingText="Gerando link..."
            onClick={handleConnectTelegram}
          >
            <ResultBox label="Link" value={telegramUrl} href={telegramUrl} />
          </ChannelCard>
        </div>

        {/* Email */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Mail size={18} className="text-purple-500" />
            <h2 className="font-semibold text-gray-800">Alterar email</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email atual</label>
              <input className="input bg-gray-50 text-gray-400" value={session?.user?.email || ''} disabled />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Novo email</label>
              <input className="input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="novo@email.com" />
            </div>
            <Msg msg={emailMsg} />
            <button className="btn-primary py-2.5" onClick={handleSaveEmail} disabled={savingEmail || !newEmail}>
              {savingEmail ? 'Salvando...' : 'Alterar email'}
            </button>
          </div>
        </div>

        {/* Senha */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={18} className="text-green-500" />
            <h2 className="font-semibold text-gray-800">Alterar senha</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nova senha</label>
              <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimo 6 caracteres" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar nova senha</label>
              <input className="input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" />
            </div>
            <Msg msg={passMsg} />
            <button className="btn-primary py-2.5" onClick={handleSavePassword} disabled={savingPass || !newPassword}>
              {savingPass ? 'Salvando...' : 'Alterar senha'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
