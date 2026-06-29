import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CreditCard,
  Heart,
  Landmark,
  LockKeyhole,
  Menu,
  PieChart,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Target,
  User,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import { useStore } from '../store/useStore'

const navItems = [
  { label: 'Início', href: '#inicio' },
  { label: 'Recursos', href: '#recursos' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Segurança', href: '#seguranca' },
  { label: 'Para casais', href: '#casais' },
]

const features = [
  {
    title: 'Gastos compartilhados',
    text: 'Registrem despesas e acompanhem onde o dinheiro está sendo utilizado.',
    icon: ReceiptText,
  },
  {
    title: 'Divisão entre o casal',
    text: 'Visualizem quanto cada pessoa contribuiu e mantenham o equilíbrio financeiro.',
    icon: Users,
  },
  {
    title: 'Contas e vencimentos',
    text: 'Organizem contas futuras e evitem atrasos com uma agenda clara.',
    icon: CalendarDays,
  },
  {
    title: 'Metas em conjunto',
    text: 'Criem planos para viagens, reservas e grandes conquistas.',
    icon: Target,
  },
  {
    title: 'Resumos inteligentes',
    text: 'Entendam os gastos por período e categoria com gráficos claros.',
    icon: BarChart3,
  },
  {
    title: 'Segurança e privacidade',
    text: 'Informações protegidas e acesso exclusivo para o casal.',
    icon: ShieldCheck,
  },
]

const presentationTestimonials = [
  {
    names: 'Ana e Lucas',
    text: 'Finalmente conseguimos visualizar nossos gastos sem depender de várias planilhas.',
  },
  {
    names: 'Marina e Rafael',
    text: 'As metas deixaram nossos planos de viagem muito mais organizados.',
  },
  {
    names: 'Camila e João',
    text: 'Agora sabemos exatamente o que está vencendo e quanto cada um contribuiu.',
  },
]

function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const classes = {
    sm: 'h-10 w-10 rounded-2xl',
    md: 'h-12 w-12 rounded-[1.25rem]',
    lg: 'h-20 w-20 rounded-[1.6rem]',
  }

  return (
    <span className={`${classes[size]} flex items-center justify-center bg-gradient-to-br from-[#FF3C9A] to-[#D92D7D] shadow-[0_18px_38px_rgba(217,45,125,0.24)]`}>
      <Heart className={size === 'lg' ? 'h-10 w-10 text-white' : 'h-6 w-6 text-white'} fill="white" strokeWidth={1.6} />
    </span>
  )
}

function PrimaryLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#EC3E92] px-6 py-3 text-sm font-bold text-white shadow-[0_16px_30px_rgba(236,62,146,0.25)] transition hover:-translate-y-0.5 hover:bg-[#D92D7D] focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-200"
    >
      {children}
    </Link>
  )
}

function SecondaryLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#EAECF0] bg-white/55 px-6 py-3 text-sm font-bold text-[#101828] backdrop-blur transition hover:bg-[#FCE8F2] focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-100"
    >
      {children}
    </Link>
  )
}

function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { session, couple } = useStore()
  const navigate = useNavigate()
  const loginTarget = session ? (couple ? '/dashboard' : '/setup') : '/login'
  const registerTarget = session ? (couple ? '/dashboard' : '/setup') : '/cadastro'

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const closeAndGo = (href: string) => {
    setMenuOpen(false)
    window.setTimeout(() => {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/60 bg-white/72 backdrop-blur-2xl transition">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 font-extrabold text-[#101828] focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-200">
          <LogoMark size="sm" />
          <span className="text-lg">FinCouple</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegação principal">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="text-sm font-semibold text-[#667085] transition hover:text-[#101828]">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <SecondaryLink to={loginTarget}>Entrar</SecondaryLink>
          <PrimaryLink to={registerTarget}>Criar conta</PrimaryLink>
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#EAECF0] bg-white/70 text-[#101828] lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
        >
          <Menu size={22} />
        </button>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 top-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu de navegação">
          <button className="absolute inset-0 bg-[#101828]/20 backdrop-blur-sm" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-4 top-4 w-[min(360px,calc(100vw-2rem))] rounded-[2rem] border border-white/70 bg-white/86 p-5 shadow-[0_24px_70px_rgba(16,24,40,0.18)] backdrop-blur-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3 font-extrabold">
                <LogoMark size="sm" />
                FinCouple
              </div>
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FCE8F2] text-[#D92D7D]" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {navItems.map((item) => (
                <button key={item.href} type="button" onClick={() => closeAndGo(item.href)} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left font-bold text-[#101828] hover:bg-[#FCE8F2]">
                  {item.label}
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-3">
              <button type="button" onClick={() => navigate(loginTarget)} className="min-h-12 rounded-full border border-[#EAECF0] bg-white/70 font-bold text-[#101828]">
                Entrar
              </button>
              <button type="button" onClick={() => navigate(registerTarget)} className="min-h-12 rounded-full bg-[#EC3E92] font-bold text-white shadow-[0_14px_26px_rgba(236,62,146,0.22)]">
                Criar conta
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

function PhonePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[420px] animate-float-soft">
      <div className="absolute -left-8 top-20 z-20 hidden rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_18px_50px_rgba(16,24,40,0.12)] backdrop-blur-xl sm:block">
        <p className="text-xs font-bold text-[#667085]">Economia</p>
        <p className="mt-1 text-lg font-extrabold text-[#101828]">12% este mês</p>
      </div>
      <div className="absolute -right-8 bottom-28 z-20 hidden rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_18px_50px_rgba(16,24,40,0.12)] backdrop-blur-xl sm:block">
        <p className="text-xs font-bold text-[#667085]">Meta da viagem</p>
        <div className="mt-2 h-2 w-32 rounded-full bg-[#FCE8F2]">
          <div className="h-full w-[68%] rounded-full bg-[#EC3E92]" />
        </div>
        <p className="mt-2 text-sm font-extrabold text-[#D92D7D]">68%</p>
      </div>
      <div className="rounded-[3rem] border border-[#101828]/10 bg-[#101828] p-3 shadow-[0_36px_90px_rgba(16,24,40,0.24)]">
        <div className="overflow-hidden rounded-[2.4rem] bg-[#FFF9FC]">
          <div className="mx-auto mt-3 h-6 w-28 rounded-full bg-[#101828]" />
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#667085]">Junho</p>
                <h3 className="text-xl font-extrabold text-[#101828]">Resumo do casal</h3>
              </div>
              <LogoMark size="sm" />
            </div>
            <div className="mt-5 rounded-3xl bg-gradient-to-br from-[#EC3E92] to-[#9B5CFF] p-5 text-white shadow-[0_18px_40px_rgba(236,62,146,0.20)]">
              <p className="text-sm font-semibold text-white/80">Saldo atual</p>
              <p className="mt-2 text-3xl font-extrabold">R$ 4.820</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-bold">
                <span className="rounded-2xl bg-white/18 p-3">Receitas R$ 8.400</span>
                <span className="rounded-2xl bg-white/18 p-3">Gastos R$ 3.580</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-white p-4 shadow-sm">
                <p className="text-xs font-bold text-[#667085]">Guto</p>
                <p className="mt-1 text-lg font-extrabold text-[#101828]">52%</p>
              </div>
              <div className="rounded-3xl bg-white p-4 shadow-sm">
                <p className="text-xs font-bold text-[#667085]">Bia</p>
                <p className="mt-1 text-lg font-extrabold text-[#101828]">48%</p>
              </div>
            </div>
            <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-extrabold">Categorias</p>
                <PieChart className="text-[#EC3E92]" size={20} />
              </div>
              <div className="mt-4 flex h-24 items-end gap-2">
                {[42, 70, 54, 88, 64, 36].map((height, index) => (
                  <span key={index} className="flex-1 rounded-full bg-gradient-to-t from-[#EC3E92] to-[#F4E9FF]" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
              <p className="text-sm font-extrabold">Próxima conta</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FCE8F2] text-[#D92D7D]">
                  <Landmark size={19} />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#101828]">Conta de luz</p>
                  <p className="text-xs font-semibold text-[#667085]">Vence em 3 dias</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HeroSection() {
  return (
    <section id="inicio" className="relative overflow-hidden pt-32 sm:pt-36">
      <div className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-[#FCE8F2] blur-3xl" />
      <div className="absolute right-0 top-28 h-96 w-96 rounded-full bg-[#F4E9FF] blur-3xl" />
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:pb-28">
        <div className="relative z-10 text-center lg:text-left">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-bold text-[#D92D7D] shadow-sm backdrop-blur-xl lg:mx-0">
            <Sparkles size={16} />
            Finanças a dois, sem complicação
          </div>
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.02] tracking-normal text-[#101828] sm:text-6xl lg:text-7xl">
            Organizem a vida financeira do casal em um <span className="bg-gradient-to-r from-[#EC3E92] to-[#9B5CFF] bg-clip-text text-transparent">só lugar.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-8 text-[#667085] lg:mx-0">
            Controle gastos, divida responsabilidades, acompanhe metas e construa planos juntos com clareza e tranquilidade.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <PrimaryLink to="/cadastro">
              Começar gratuitamente
              <ArrowRight size={18} />
            </PrimaryLink>
            <SecondaryLink to="/login">Já tenho uma conta</SecondaryLink>
          </div>
          <p className="mt-4 text-sm font-semibold text-[#667085]">Sem cartão de crédito. Configuração rápida e segura.</p>
        </div>
        <PhonePreview />
      </div>
    </section>
  )
}

function QuickProof() {
  const items = [
    ['Gastos organizados', 'Tudo em uma visão simples.', WalletCards],
    ['Metas em conjunto', 'Acompanhem o progresso.', Target],
    ['Divisão clara', 'Contribuições transparentes.', Users],
    ['Dados privados', 'Acesso para o casal.', ShieldCheck],
  ] as const

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid gap-3 rounded-[2rem] border border-white/70 bg-white/62 p-3 shadow-[0_24px_80px_rgba(16,24,40,0.08)] backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([title, text, Icon]) => (
          <div key={title} className="flex items-center gap-4 rounded-[1.5rem] p-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FCE8F2] text-[#D92D7D]">
              <Icon size={22} />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-[#101828]">{title}</h2>
              <p className="text-sm font-medium text-[#667085]">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function FeatureGrid() {
  return (
    <section id="recursos" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-4xl font-extrabold text-[#101828] sm:text-5xl">Tudo o que vocês precisam para cuidar melhor do dinheiro</h2>
        <p className="mt-5 text-lg font-medium leading-8 text-[#667085]">Uma visão simples, compartilhada e organizada da vida financeira do casal.</p>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {features.map(({ title, text, icon: Icon }) => (
          <article key={title} className="group rounded-[2rem] border border-white/80 bg-white/78 p-7 shadow-[0_18px_60px_rgba(16,24,40,0.07)] backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_24px_80px_rgba(16,24,40,0.10)]">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FCE8F2] to-[#F4E9FF] text-[#D92D7D]">
              <Icon size={25} />
            </span>
            <h3 className="mt-6 text-xl font-extrabold text-[#101828]">{title}</h3>
            <p className="mt-3 text-base font-medium leading-7 text-[#667085]">{text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function DashboardMockup() {
  return (
    <div className="relative rounded-[2.5rem] border border-white/80 bg-white/80 p-4 shadow-[0_30px_100px_rgba(16,24,40,0.12)] backdrop-blur-xl">
      <div className="rounded-[2rem] bg-[#F8FAFC] p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#667085]">Dashboard FinCouple</p>
            <h3 className="text-2xl font-extrabold text-[#101828]">Junho de 2026</h3>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#667085]">Guto</span>
            <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#667085]">Bia</span>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ['Total de gastos', 'R$ 3.580', ReceiptText],
            ['Receitas', 'R$ 8.400', CreditCard],
            ['Saldo atual', 'R$ 4.820', WalletCards],
          ].map(([label, value, Icon]) => (
            <div key={label as string} className="rounded-3xl bg-white p-5 shadow-sm">
              <Icon className="text-[#EC3E92]" size={22} />
              <p className="mt-4 text-sm font-bold text-[#667085]">{label as string}</p>
              <p className="mt-1 text-2xl font-extrabold text-[#101828]">{value as string}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-[#101828]">Gráfico mensal</h4>
              <BarChart3 className="text-[#EC3E92]" />
            </div>
            <div className="mt-6 flex h-48 items-end gap-3">
              {[38, 52, 44, 78, 66, 90, 58, 72, 62, 84].map((height, index) => (
                <span key={index} className="flex-1 rounded-t-2xl bg-gradient-to-t from-[#EC3E92] to-[#F4E9FF]" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="grid gap-4">
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h4 className="font-extrabold text-[#101828]">Contribuições</h4>
              <div className="mt-4 space-y-3">
                {[
                  ['Guto', '52%'],
                  ['Bia', '48%'],
                ].map(([name, value]) => (
                  <div key={name}>
                    <div className="flex justify-between text-sm font-bold text-[#667085]"><span>{name}</span><span>{value}</span></div>
                    <div className="mt-2 h-2 rounded-full bg-[#FCE8F2]"><div className="h-full rounded-full bg-[#EC3E92]" style={{ width: value }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h4 className="font-extrabold text-[#101828]">Contas a vencer</h4>
              <p className="mt-3 rounded-2xl bg-[#FCE8F2] px-4 py-3 text-sm font-bold text-[#D92D7D]">Luz vence em 3 dias</p>
              <p className="mt-2 rounded-2xl bg-[#F4E9FF] px-4 py-3 text-sm font-bold text-[#667085]">Internet vence dia 12</p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {['Mercado R$ 420', 'Restaurante R$ 180', 'Viagem 68%'].map((item) => (
            <span key={item} className="rounded-3xl bg-white p-4 text-sm font-extrabold text-[#101828] shadow-sm">{item}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function DashboardShowcase() {
  return (
    <section className="relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-16 mx-auto h-96 max-w-5xl rounded-full bg-[#F4E9FF]/70 blur-3xl" />
      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-extrabold text-[#101828] sm:text-5xl">Toda a vida financeira em uma única visão</h2>
          <p className="mt-5 text-lg font-medium leading-8 text-[#667085]">Acompanhem gastos, receitas, metas, contas e contribuições sem planilhas complicadas.</p>
        </div>
        <div className="relative mt-12">
          <DashboardMockup />
          <div className="pointer-events-none absolute -left-4 top-10 hidden rounded-3xl border border-white/80 bg-white/75 p-4 text-sm font-extrabold text-[#101828] shadow-xl backdrop-blur-xl lg:block">Visão completa do mês</div>
          <div className="pointer-events-none absolute -right-3 bottom-16 hidden rounded-3xl border border-white/80 bg-white/75 p-4 text-sm font-extrabold text-[#101828] shadow-xl backdrop-blur-xl lg:block">Metas em progresso</div>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    ['Crie sua conta', 'Cadastre-se em poucos segundos e configure seu perfil.', User],
    ['Convide seu parceiro ou parceira', 'Conectem os perfis para compartilhar a mesma organização financeira.', Heart],
    ['Organizem tudo juntos', 'Adicionem gastos, contas, metas e acompanhem a evolução do casal.', Check],
  ] as const

  return (
    <section id="como-funciona" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="text-center">
        <h2 className="text-4xl font-extrabold text-[#101828] sm:text-5xl">Começar é simples</h2>
      </div>
      <div className="relative mt-12 grid gap-5 lg:grid-cols-3">
        <div className="absolute left-[16%] right-[16%] top-14 hidden h-px bg-gradient-to-r from-transparent via-pink-200 to-transparent lg:block" />
        {steps.map(([title, text, Icon], index) => (
          <article key={title} className="relative rounded-[2rem] border border-white/80 bg-white/74 p-7 text-center shadow-[0_18px_60px_rgba(16,24,40,0.07)] backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#FCE8F2] text-[#D92D7D]">
              <Icon size={26} />
            </div>
            <span className="mt-5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#EC3E92] text-sm font-extrabold text-white">{index + 1}</span>
            <h3 className="mt-5 text-xl font-extrabold text-[#101828]">{title}</h3>
            <p className="mt-3 text-base font-medium leading-7 text-[#667085]">{text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function CoupleArt() {
  return (
    <svg className="mx-auto h-72 w-full max-w-md" viewBox="0 0 420 300" fill="none" aria-label="Ilustração de casal planejando juntos" role="img">
      <path d="M28 245C45 184 91 154 166 156C243 159 292 190 322 245H28Z" fill="#FCE8F2" />
      <circle cx="169" cy="115" r="38" fill="#D95C9A" />
      <circle cx="239" cy="119" r="40" fill="#F09BC6" />
      <path d="M116 245C128 190 157 162 203 162C245 164 280 194 307 245H116Z" fill="#FFE4F1" />
      <path d="M191 245C205 196 235 170 279 168C314 180 339 205 357 245H191Z" fill="#FFD4EA" />
      <path d="M194 171C222 191 254 194 289 180" stroke="#C94788" strokeWidth="18" strokeLinecap="round" />
      <rect x="62" y="214" width="296" height="54" rx="27" fill="white" opacity=".82" />
      <path d="M88 241H333" stroke="#F2A9CC" strokeWidth="10" strokeLinecap="round" opacity=".55" />
    </svg>
  )
}

function CoupleBenefits() {
  const checks = ['visualização compartilhada', 'responsabilidades bem definidas', 'menos esquecimentos', 'planejamento de curto e longo prazo', 'acompanhamento de objetivos', 'histórico organizado']
  return (
    <section id="casais" className="bg-gradient-to-br from-[#FFF1F8] to-[#F4E9FF] px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        <div className="rounded-[2.5rem] border border-white/70 bg-white/38 p-8 backdrop-blur-xl">
          <CoupleArt />
        </div>
        <div>
          <h2 className="text-4xl font-extrabold leading-tight text-[#101828] sm:text-5xl">Mais transparência. Menos discussões. Mais planos juntos.</h2>
          <p className="mt-5 text-lg font-medium leading-8 text-[#667085]">O FinCouple ajuda o casal a conversar sobre dinheiro com mais clareza, organização e parceria.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {checks.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/62 px-4 py-3 font-bold text-[#101828]">
                <Check className="shrink-0 text-[#EC3E92]" size={19} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function SecuritySection() {
  const cards = [
    ['Dados protegidos', 'As informações financeiras ficam vinculadas apenas aos usuários autorizados.'],
    ['Acesso individual', 'Cada pessoa utiliza sua própria conta e suas próprias credenciais.'],
    ['Sessões seguras', 'O sistema protege rotas privadas e encerra sessões conforme as regras de segurança existentes.'],
    ['Controle do casal', 'Somente os participantes vinculados podem visualizar as informações compartilhadas.'],
  ]
  return (
    <section id="seguranca" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-4xl font-extrabold text-[#101828] sm:text-5xl">Privacidade e segurança em primeiro lugar</h2>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(([title, text]) => (
          <article key={title} className="rounded-[2rem] border border-white/80 bg-white/76 p-6 shadow-[0_18px_60px_rgba(16,24,40,0.07)] backdrop-blur-xl">
            <LockKeyhole className="text-[#EC3E92]" size={26} />
            <h3 className="mt-5 text-lg font-extrabold text-[#101828]">{title}</h3>
            <p className="mt-3 text-sm font-medium leading-6 text-[#667085]">{text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8" aria-label="Depoimentos demonstrativos">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#EC3E92]">Dados de apresentação</p>
        <h2 className="mt-3 text-4xl font-extrabold text-[#101828] sm:text-5xl">Casais organizando planos com mais clareza</h2>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {presentationTestimonials.map((testimonial) => (
          <article key={testimonial.names} className="rounded-[2rem] border border-white/80 bg-white/76 p-7 shadow-[0_18px_60px_rgba(16,24,40,0.07)] backdrop-blur-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FCE8F2] text-sm font-extrabold text-[#D92D7D]">
              {testimonial.names.split(' ').map((part) => part[0]).join('').slice(0, 2)}
            </div>
            <p className="mt-6 text-lg font-semibold leading-8 text-[#101828]">“{testimonial.text}”</p>
            <p className="mt-5 text-sm font-bold text-[#667085]">{testimonial.names}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[3rem] bg-gradient-to-br from-[#EC3E92] via-[#E95AA4] to-[#B98BFF] px-6 py-16 text-center text-white shadow-[0_30px_100px_rgba(236,62,146,0.24)] sm:px-12">
        <Heart className="absolute left-10 top-10 text-white/20" size={70} fill="currentColor" />
        <Sparkles className="absolute bottom-12 right-16 text-white/30" size={54} />
        <h2 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">Comecem hoje a organizar a vida financeira de vocês</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg font-medium leading-8 text-white/82">Criem a conta, conectem o casal e acompanhem tudo em um único lugar.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/cadastro" className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-extrabold text-[#D92D7D] transition hover:-translate-y-0.5">
            Criar conta gratuitamente
          </Link>
          <Link to="/login" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/40 bg-white/12 px-6 py-3 text-sm font-extrabold text-white backdrop-blur transition hover:bg-white/20">
            Entrar
          </Link>
        </div>
      </div>
    </section>
  )
}

function PublicFooter() {
  return (
    <footer className="border-t border-[#EAECF0] bg-white/72 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <div className="flex items-center gap-3 font-extrabold text-[#101828]">
            <LogoMark size="sm" />
            FinCouple
          </div>
          <p className="mt-4 max-w-md text-sm font-medium leading-6 text-[#667085]">Finanças para casais, sem complicação. Organizem gastos, contas, contribuições e metas em um único lugar.</p>
        </div>
        <nav aria-label="Links do rodapé">
          <h3 className="font-extrabold text-[#101828]">Navegação</h3>
          <div className="mt-4 grid gap-3 text-sm font-bold text-[#667085]">
            {navItems.map((item) => <a key={item.href} href={item.href} className="hover:text-[#EC3E92]">{item.label}</a>)}
          </div>
        </nav>
        <div>
          <h3 className="font-extrabold text-[#101828]">Conta</h3>
          <div className="mt-4 grid gap-3 text-sm font-bold text-[#667085]">
            <Link to="/login" className="hover:text-[#EC3E92]">Login</Link>
            <Link to="/cadastro" className="hover:text-[#EC3E92]">Criação de conta</Link>
            <a href="mailto:contato@fincouple.app" className="hover:text-[#EC3E92]">Contato</a>
            <span aria-disabled="true" className="text-[#98A2B3]">Política de privacidade em breve</span>
            <span aria-disabled="true" className="text-[#98A2B3]">Termos de uso em breve</span>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-7xl text-sm font-medium text-[#667085]">© 2026 FinCouple. Todos os direitos reservados.</p>
    </footer>
  )
}

export default function Landing() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#FFF9FC] text-[#101828]">
      <PublicHeader />
      <HeroSection />
      <QuickProof />
      <FeatureGrid />
      <DashboardShowcase />
      <HowItWorks />
      <CoupleBenefits />
      <SecuritySection />
      <Testimonials />
      <FinalCTA />
      <PublicFooter />
    </main>
  )
}
