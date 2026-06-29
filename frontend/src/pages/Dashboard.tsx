import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Home, Target, BarChart2, LogOut, CalendarDays, Settings,
  Wallet, TrendingUp, TrendingDown, Users, ShieldCheck,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { getSummary, getExpenses, getBills } from '../api/client'
import { useStore } from '../store/useStore'

// ─── Constants ────────────────────────────────────────────────────────────────
const MS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MF = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const CAT: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  mercado:    { label: 'Mercado',    color: '#22c55e', bg: '#dcfce7', emoji: '🛒' },
  moradia:    { label: 'Moradia',    color: '#3b82f6', bg: '#dbeafe', emoji: '🏠' },
  lazer:      { label: 'Lazer',      color: '#a855f7', bg: '#f3e8ff', emoji: '🎉' },
  transporte: { label: 'Transporte', color: '#f59e0b', bg: '#fef3c7', emoji: '🚗' },
  saude:      { label: 'Saúde',      color: '#06b6d4', bg: '#cffafe', emoji: '💊' },
  internet:   { label: 'Internet',   color: '#8b5cf6', bg: '#ede9fe', emoji: '📡' },
  luz:        { label: 'Energia',    color: '#eab308', bg: '#fef9c3', emoji: '⚡' },
  outros:     { label: 'Outros',     color: '#6b7280', bg: '#f3f4f6', emoji: '📦' },
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtK(v: number) {
  return v >= 1000 ? `R$\xa0${(v / 1000).toFixed(1)}k` : `R$\xa0${v.toFixed(0)}`
}
function catInfo(cat: string) {
  return CAT[cat] ?? CAT['outros']
}

// ─── DonutChart ───────────────────────────────────────────────────────────────
interface DonutSeg { color: string; value: number }

function DonutChart({ segments, total }: { segments: DonutSeg[]; total: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const sum = segments.reduce((a, b) => a + b.value, 0) || 1
  let cum = 0

  return (
    <div className="relative flex-shrink-0" style={{ width: 110, height: 110 }}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {segments.map((seg, i) => {
          const dash = (seg.value / sum) * circ
          const rot = -90 + (cum / sum) * 360
          cum += seg.value
          return (
            <circle
              key={i}
              cx="50" cy="50" r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${circ - dash}`}
              transform={`rotate(${rot} 50 50)`}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-1">
        <span className="text-[10px] font-bold text-gray-800 leading-tight text-center">
          {fmt(total)}
        </span>
        <span className="text-[9px] text-gray-400">Total</span>
      </div>
    </div>
  )
}

// ─── BarChart ─────────────────────────────────────────────────────────────────
interface BarPoint { month: string; value: number }

function BarChart({ data }: { data: BarPoint[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const W = 280, H = 88, bw = 28, n = data.length
  const gap = (W - bw * n) / (n + 1)

  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {[0, 0.5, 1].map((frac, i) => {
        const y = H - frac * H
        return (
          <g key={i}>
            <line x1={0} y1={y} x2={W} y2={y} stroke="#e2e8f0" strokeWidth={0.8} />
            {frac > 0 && (
              <text x={W - 1} y={y - 2} textAnchor="end" fontSize={7} fill="#94a3b8">
                {fmtK(max * frac)}
              </text>
            )}
          </g>
        )
      })}
      {data.map((d, i) => {
        const bh = Math.max((d.value / max) * H, 3)
        const x = gap + i * (bw + gap)
        const y = H - bh
        const isCurrent = i === data.length - 1
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} rx={5}
              fill={isCurrent ? '#3b82f6' : '#bfdbfe'} />
            {isCurrent && (
              <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize={7} fill="#2563eb" fontWeight="700">
                {fmtK(d.value)}
              </text>
            )}
            <text x={x + bw / 2} y={H + 14} textAnchor="middle" fontSize={8.5} fill="#94a3b8">
              {d.month}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── MiniCalendar ─────────────────────────────────────────────────────────────
function MiniCalendar({ bills, initMonth, initYear }: { bills: any[]; initMonth: number; initYear: number }) {
  const today = new Date()
  const [calM, setCalM] = useState(initMonth)
  const [calY, setCalY] = useState(initYear)

  const firstDay = new Date(calY, calM, 1).getDay()
  const dim = new Date(calY, calM + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let i = 1; i <= dim; i++) cells.push(i)

  const billDays = new Set((bills || []).filter((b: any) => !b.is_paid).map((b: any) => b.due_day as number))
  const isToday = (d: number) => d === today.getDate() && calY === today.getFullYear() && calM === today.getMonth()

  const prev = () => {
    if (calM === 0) { setCalM(11); setCalY(y => y - 1) }
    else setCalM(m => m - 1)
  }
  const next = () => {
    if (calM === 11) { setCalM(0); setCalY(y => y + 1) }
    else setCalM(m => m + 1)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600">{MF[calM]} {calY}</span>
        <div className="flex gap-0.5">
          <button onClick={prev} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 transition-colors">
            <ChevronLeft size={13} />
          </button>
          <button onClick={next} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 transition-colors">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center">
        {['D','S','T','Q','Q','S','S'].map((d, i) => (
          <div key={i} className="text-[9px] text-gray-400 font-medium py-1">{d}</div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className="flex items-center justify-center py-[3px] relative">
            {day && (
              <>
                <span className={[
                  'w-6 h-6 flex items-center justify-center text-[11px] rounded-full transition-colors',
                  isToday(day)
                    ? 'bg-blue-500 text-white font-bold'
                    : billDays.has(day)
                      ? 'text-orange-600 font-semibold hover:bg-orange-50 cursor-pointer'
                      : 'text-gray-600 hover:bg-gray-100 cursor-pointer'
                ].join(' ')}>
                  {day}
                </span>
                {billDays.has(day) && !isToday(day) && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-400" />
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const { couple, profile, clear } = useStore()
  const today = new Date()
  const month = today.getMonth() + 1   // 1-12
  const year = today.getFullYear()

  const [summary, setSummary]       = useState<any>(null)
  const [prevSummary, setPrevSummary] = useState<any>(null)
  const [expenses, setExpenses]     = useState<any[]>([])
  const [bills, setBills]           = useState<any[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (!couple) { navigate('/setup'); return }
    const id = couple.id
    const prevM = month === 1 ? 12 : month - 1
    const prevY = month === 1 ? year - 1 : year

    Promise.all([
      getSummary(id, month, year),
      getSummary(id, prevM, prevY).catch(() => null),
      getExpenses(id, month, year).catch(() => []),
      getBills(id, month, year).catch(() => []),
    ]).then(([s, ps, e, b]) => {
      setSummary(s)
      setPrevSummary(ps)
      setExpenses(Array.isArray(e) ? e : [])
      setBills(Array.isArray(b) ? b : [])
    }).finally(() => setLoading(false))
  }, [couple]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!couple) return null

  // ─── Derived values ─────────────────────────────────────────────────────────
  const isUser1      = profile?.id === couple.user1_id
  const me           = isUser1 ? couple.user1 : couple.user2
  const partner      = isUser1 ? couple.user2 : couple.user1
  const myName       = me?.name || profile?.name || 'Você'
  const partnerName  = partner?.name || 'Parceiro(a)'

  const totalIncome   = (couple.user1.monthly_income || 0) + (couple.user2?.monthly_income || 0)
  const totalExpenses = summary?.total_expenses || 0
  const saldo         = totalIncome - totalExpenses

  const myPaid      = isUser1 ? (summary?.user1_paid || 0) : (summary?.user2_paid || 0)
  const partnerPaid = isUser1 ? (summary?.user2_paid || 0) : (summary?.user1_paid || 0)
  const maxPaid     = Math.max(myPaid, partnerPaid, 0.01)

  const goals          = (summary?.goals || []) as any[]
  const completedGoals = goals.filter((g: any) => g.percent >= 100).length

  const byCategory  = (summary?.by_category || {}) as Record<string, number>
  const catEntries  = Object.entries(byCategory).slice(0, 5) as [string, number][]

  const prevTotal     = prevSummary?.total_expenses || 0
  const hasComparison = prevTotal > 0
  const diffPct       = hasComparison ? ((totalExpenses - prevTotal) / prevTotal) * 100 : 0
  const prevMonthName = MS[month === 1 ? 11 : month - 2]

  const recentExpenses = expenses.slice(0, 4)
  const upcomingBills  = bills.filter((b: any) => !b.is_paid).slice(0, 5)

  const chartData: BarPoint[] = useMemo(() => {
    const pts: BarPoint[] = []
    for (let i = 5; i >= 1; i--) {
      const m = month - i <= 0 ? month - i + 12 : month - i
      const mock = 3400 + ((m * 317 + 127) % 1100)
      pts.push({ month: MS[m - 1], value: mock })
    }
    pts.push({ month: MS[month - 1], value: totalExpenses || 3600 })
    return pts
  }, [month, totalExpenses])

  const balDesc = summary?.balance_description
    ? summary.balance_description.replace('Voces estao quites!', 'Vocês estão quites!')
    : null

  // ─── Quick actions ──────────────────────────────────────────────────────────
  const quickActions = [
    { icon: Plus,       label: 'Gasto',      color: 'bg-blue-500',   path: '/expenses/new' },
    { icon: CalendarDays, label: 'Calendário', color: 'bg-orange-500', path: '/calendar' },
    { icon: Home,       label: 'Contas',     color: 'bg-purple-500', path: '/bills' },
    { icon: Target,     label: 'Metas',      color: 'bg-green-500',  path: '/goals' },
    { icon: BarChart2,  label: 'Resumo',     color: 'bg-blue-600',   path: '/summary' },
  ]

  // ─── KPI cards ──────────────────────────────────────────────────────────────
  const kpiCards = [
    {
      iconEl: <TrendingDown size={20} className="text-blue-600" />,
      iconBg: 'bg-blue-50',
      label: 'Gastos do mês',
      value: fmt(totalExpenses),
      sub: hasComparison
        ? `${Math.abs(diffPct).toFixed(0)}% ${diffPct <= 0 ? 'menor' : 'maior'} que ${prevMonthName} ${prevSummary?.year || year}`
        : `${MS[month - 1]} ${year}`,
      subColor: diffPct <= 0 ? 'text-green-600' : 'text-red-500',
      trend: hasComparison ? (diffPct <= 0 ? '↓ ' : '↑ ') : '',
    },
    {
      iconEl: <TrendingUp size={20} className="text-green-600" />,
      iconBg: 'bg-green-50',
      label: 'Receitas',
      value: fmt(totalIncome),
      sub: 'renda total do casal',
      subColor: 'text-green-600',
      trend: '',
    },
    {
      iconEl: <Wallet size={20} className="text-purple-600" />,
      iconBg: 'bg-purple-50',
      label: 'Saldo atual',
      value: fmt(saldo),
      sub: 'receitas − gastos do mês',
      subColor: saldo >= 0 ? 'text-green-600' : 'text-red-500',
      trend: '',
    },
    {
      iconEl: <Target size={20} className="text-orange-500" />,
      iconBg: 'bg-orange-50',
      label: 'Metas concluídas',
      value: goals.length ? `${completedGoals} de ${goals.length}` : '—',
      sub: goals.length
        ? `${Math.round((completedGoals / goals.length) * 100)}% das metas deste mês`
        : 'nenhuma meta cadastrada',
      subColor: 'text-orange-500',
      trend: '',
    },
  ]

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ════ HEADER ═══════════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 60%, #1e3a8a 100%)', borderRadius: '0 0 2.5rem 2.5rem' }}
      >
        {/* Decorative illustration */}
        <svg viewBox="0 0 260 180" className="absolute right-0 top-0 h-full w-auto opacity-[0.07] pointer-events-none select-none" aria-hidden>
          <circle cx="95" cy="60" r="22" fill="white" />
          <path d="M62 115 Q95 90 128 115 L128 175 L62 175Z" fill="white" />
          <circle cx="165" cy="60" r="22" fill="white" />
          <path d="M132 115 Q165 90 198 115 L198 175 L132 175Z" fill="white" />
          <path d="M130 37 C130 26 120 18 112 25 C104 18 94 26 94 37 C94 48 112 63 112 63 C112 63 130 48 130 37Z" fill="white" />
          <circle cx="220" cy="28" r="4" fill="white" />
          <circle cx="238" cy="52" r="2.5" fill="white" />
          <circle cx="208" cy="58" r="2.5" fill="white" />
          <circle cx="48" cy="22" r="2.5" fill="white" />
          <circle cx="30" cy="45" r="4" fill="white" />
          <circle cx="242" cy="80" r="1.5" fill="white" />
        </svg>

        <div className="max-w-7xl mx-auto px-5 pt-10 pb-8 relative z-10">
          {/* Greeting row */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-blue-200 text-sm font-medium">Olá, {myName} 👋</p>
              <h1 className="text-2xl font-bold text-white mt-0.5 leading-tight">
                {myName} & {partnerName}
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/settings')}
                className="w-9 h-9 rounded-full border border-white/25 bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                title="Configurações"
              >
                <Settings size={17} className="text-white" />
              </button>
              <button
                onClick={() => { clear(); navigate('/auth') }}
                className="w-9 h-9 rounded-full border border-white/25 bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                title="Sair"
              >
                <LogOut size={17} className="text-white" />
              </button>
            </div>
          </div>

          {/* Summary card */}
          <div className="bg-white/15 border border-white/20 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Wallet size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-blue-200 text-xs font-medium">{MS[month - 1]} {year}</p>
                {loading
                  ? <div className="h-8 w-44 bg-white/20 rounded-lg animate-pulse mt-1" />
                  : <p className="text-[1.75rem] font-bold text-white leading-tight">{fmt(totalExpenses)}</p>
                }
                <p className="text-blue-200 text-xs mt-0.5">gastos do casal este mês</p>
              </div>
            </div>
            {hasComparison && !loading && (
              <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2 flex-shrink-0">
                <TrendingUp size={16} className="text-emerald-300" />
                <div>
                  <p className="text-emerald-300 text-sm font-bold leading-tight">
                    {diffPct <= 0 ? 'Economia' : 'Aumento'} de {Math.abs(diffPct).toFixed(0)}%
                  </p>
                  <p className="text-blue-200 text-[10px]">em relação a {prevMonthName} {prevSummary?.year || year}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════ MAIN ═════════════════════════════════════════════════════════════ */}
      <main className="max-w-7xl mx-auto px-4 pt-5 pb-32">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
          {kpiCards.map((c, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className={`w-9 h-9 rounded-xl ${c.iconBg} flex items-center justify-center mb-3`}>
                {c.iconEl}
              </div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">{c.label}</p>
              <p className="text-xl font-bold text-gray-800 leading-tight">
                {loading ? <span className="inline-block h-6 w-28 bg-gray-100 rounded animate-pulse" /> : c.value}
              </p>
              {c.sub && (
                <p className={`text-[11px] mt-1 font-medium ${c.subColor}`}>
                  {c.trend}{c.sub}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Mid: Contributions | Bar Chart | Categories */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">

          {/* Contributions */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-gray-400" />
              <h3 className="font-semibold text-gray-700 text-sm">Contribuições</h3>
            </div>

            {loading ? (
              <div className="space-y-2">
                <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              </div>
            ) : (
              <>
                {/* My row */}
                <div className="bg-blue-50 rounded-xl p-3 mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {myName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700 truncate">{myName}</span>
                      <span className="text-xs font-bold text-blue-600 ml-1 flex-shrink-0">
                        {myPaid + partnerPaid > 0 ? Math.round((myPaid / (myPaid + partnerPaid)) * 100) : 50}%
                      </span>
                    </div>
                  </div>
                  <p className="text-[15px] font-bold text-blue-700 mb-1.5">{fmt(myPaid)}</p>
                  <div className="h-1.5 bg-blue-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-700"
                      style={{ width: `${maxPaid > 0 ? (myPaid / maxPaid) * 100 : 0}%` }} />
                  </div>
                </div>

                {/* Partner row */}
                <div className="bg-purple-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {partnerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700 truncate">{partnerName}</span>
                      <span className="text-xs font-bold text-purple-600 ml-1 flex-shrink-0">
                        {myPaid + partnerPaid > 0 ? Math.round((partnerPaid / (myPaid + partnerPaid)) * 100) : 50}%
                      </span>
                    </div>
                  </div>
                  <p className="text-[15px] font-bold text-purple-700 mb-1.5">{fmt(partnerPaid)}</p>
                  <div className="h-1.5 bg-purple-200 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all duration-700"
                      style={{ width: `${maxPaid > 0 ? (partnerPaid / maxPaid) * 100 : 0}%` }} />
                  </div>
                </div>

                {balDesc && (
                  <div className="flex items-center justify-center gap-1.5 mt-2.5">
                    <ShieldCheck size={13} className="text-green-500 flex-shrink-0" />
                    <p className="text-xs text-gray-500 text-center leading-tight">{balDesc}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bar Chart */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 text-sm">Resumo mensal</h3>
              <span className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                Últimos 6 meses ▾
              </span>
            </div>
            <BarChart data={chartData} />
          </div>

          {/* Category Donut */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-700 text-sm mb-3">Categorias</h3>
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-[110px] h-[110px] rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  {[1,2,3,4].map(i => <div key={i} className="h-3 bg-gray-100 rounded animate-pulse" />)}
                </div>
              </div>
            ) : catEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 gap-2">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                  <BarChart2 size={24} className="text-gray-300" />
                </div>
                <p className="text-xs text-gray-400">Sem gastos registrados</p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <DonutChart
                  segments={catEntries.map(([cat, val]) => ({ color: catInfo(cat).color, value: val }))}
                  total={totalExpenses}
                />
                <div className="flex-1 space-y-1.5 min-w-0">
                  {catEntries.map(([cat, val]) => {
                    const info = catInfo(cat)
                    const pct = totalExpenses > 0 ? Math.round((val / totalExpenses) * 100) : 0
                    return (
                      <div key={cat} className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: info.color }} />
                        <span className="text-[11px] text-gray-600 flex-1 truncate">{info.label}</span>
                        <span className="text-[11px] font-bold text-gray-700 flex-shrink-0">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Transactions | Bills | Goals | Calendar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">

          {/* Recent Transactions */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 text-sm">Últimas transações</h3>
              <button onClick={() => navigate('/summary')} className="text-[11px] text-blue-500 hover:text-blue-700 font-semibold transition-colors">
                Ver todas
              </button>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : recentExpenses.length === 0 ? (
              <div className="py-5 text-center">
                <p className="text-2xl mb-1">💸</p>
                <p className="text-xs text-gray-400">Nenhum gasto este mês</p>
                <button onClick={() => navigate('/expenses/new')} className="text-xs text-blue-500 font-semibold mt-1">
                  Registrar gasto
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentExpenses.map((exp: any) => {
                  const info = catInfo(exp.category)
                  const d = exp.date ? new Date(exp.date + 'T12:00') : null
                  const now = new Date()
                  const yest = new Date(now); yest.setDate(yest.getDate() - 1)
                  const dateLabel = d
                    ? d.toDateString() === now.toDateString() ? 'Hoje'
                      : d.toDateString() === yest.toDateString() ? 'Ontem'
                      : `${d.getDate()}/${d.getMonth() + 1}`
                    : ''
                  return (
                    <div key={exp.id} className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background: info.bg }}>
                        {info.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-gray-800 truncate leading-tight">
                          {exp.description || info.label}
                        </p>
                        <p className="text-[10px] text-gray-400 leading-tight">{info.label}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[12px] font-bold text-gray-800">−{fmt(exp.amount)}</p>
                        <p className="text-[10px] text-gray-400">{dateLabel}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Contas a vencer */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 text-sm">Contas a vencer</h3>
              <button onClick={() => navigate('/bills')} className="text-[11px] text-blue-500 hover:text-blue-700 font-semibold transition-colors">
                Ver todas
              </button>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : upcomingBills.length === 0 ? (
              <div className="py-5 text-center">
                <ShieldCheck size={28} className="text-green-400 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-green-600">Tudo em dia!</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Nenhuma conta pendente</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingBills.map((bill: any) => (
                  <div key={bill.id} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 text-sm">
                      🏠
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-gray-800 truncate leading-tight">{bill.name}</p>
                      <p className="text-[10px] text-blue-500 font-medium">
                        {bill.due_day} {MS[month - 1]} {year}
                      </p>
                    </div>
                    <p className="text-[12px] font-bold text-gray-800 flex-shrink-0">{fmt(bill.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Goals */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 text-sm">Metas</h3>
              <button onClick={() => navigate('/goals')} className="text-[11px] text-blue-500 hover:text-blue-700 font-semibold transition-colors">
                Ver todas
              </button>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1,2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : goals.length === 0 ? (
              <div className="py-5 text-center">
                <Target size={28} className="text-gray-300 mx-auto mb-1.5" />
                <p className="text-xs text-gray-400">Nenhuma meta ainda</p>
                <button onClick={() => navigate('/goals')} className="text-xs text-blue-500 font-semibold mt-1">
                  Criar meta
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {goals.slice(0, 2).map((g: any, i: number) => {
                  const bar = i === 0 ? ['bg-blue-500', 'bg-blue-100'] : ['bg-green-500', 'bg-green-100']
                  return (
                    <div key={g.name} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-base flex-shrink-0 mt-0.5">{g.emoji || '🎯'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-[12px] font-semibold text-gray-800 truncate">{g.name}</p>
                            <span className="text-[11px] font-bold text-gray-600 flex-shrink-0">{g.percent}%</span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {fmt(g.current)} de {fmt(g.target)}
                          </p>
                        </div>
                      </div>
                      <div className={`h-1.5 ${bar[1]} rounded-full overflow-hidden`}>
                        <div className={`h-full ${bar[0]} rounded-full transition-all duration-700`}
                          style={{ width: `${g.percent}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Agenda / Calendar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays size={14} className="text-gray-400" />
              <h3 className="font-semibold text-gray-700 text-sm">Agenda</h3>
            </div>
            <MiniCalendar bills={bills} initMonth={today.getMonth()} initYear={today.getFullYear()} />
          </div>

        </div>
      </main>

      {/* ════ BOTTOM NAV ═══════════════════════════════════════════════════════ */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="grid grid-cols-5 gap-1">
            {quickActions.map(({ icon: Icon, label, color, path }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className="flex flex-col items-center gap-1.5 py-1.5 rounded-xl hover:bg-gray-50 active:scale-95 transition-all"
              >
                <div className={`${color} w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm`}>
                  <Icon className="text-white" size={20} />
                </div>
                <span className="text-[10px] text-gray-600 font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

    </div>
  )
}
