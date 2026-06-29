import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { getAdminStats } from '../api/client'

const ADMIN_EMAILS = ['gustavosantiago2912@gmail.com', 'snyderisabellaalves@gmail.com']

const CATEGORY_COLORS: Record<string, string> = {
  mercado: '#3b82f6',
  alimentacao: '#10b981',
  transporte: '#f59e0b',
  saude: '#ef4444',
  lazer: '#8b5cf6',
  moradia: '#06b6d4',
  educacao: '#f97316',
  outros: '#6b7280',
}

interface AdminStats {
  users: {
    total: number
    male: number
    female: number
    telegram_linked: number
    total_monthly_income: number
    avg_monthly_income: number
  }
  couples: { total: number; active: number; pending: number }
  expenses: { total_transactions: number; total_amount: number }
  peak_hours: { hour: number; count: number }[]
  categories: { name: string; count: number; total: number }[]
  monthly_growth: { label: string; count: number }[]
  recent_users: {
    id: string
    name: string
    email: string
    gender: string
    has_couple: boolean
    created_at: string
  }[]
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtR(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

/* ── SVG Donut ── */
function DonutChart({ male, female }: { male: number; female: number }) {
  const total = male + female || 1
  const r = 52
  const circ = 2 * Math.PI * r
  const femaleArc = (female / total) * circ
  const maleArc = (male / total) * circ
  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      <circle cx={70} cy={70} r={r} fill="none" stroke="#e5e7eb" strokeWidth={20} />
      {/* female segment */}
      <circle
        cx={70} cy={70} r={r} fill="none"
        stroke="#ec4899" strokeWidth={20}
        strokeDasharray={`${femaleArc} ${circ - femaleArc}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="butt"
      />
      {/* male segment */}
      <circle
        cx={70} cy={70} r={r} fill="none"
        stroke="#3b82f6" strokeWidth={20}
        strokeDasharray={`${maleArc} ${circ - maleArc}`}
        strokeDashoffset={circ * 0.25 - femaleArc}
        strokeLinecap="butt"
      />
      <text x={70} y={66} textAnchor="middle" fontSize={14} fontWeight={700} fill="#1e293b">{total}</text>
      <text x={70} y={82} textAnchor="middle" fontSize={10} fill="#64748b">usuários</text>
    </svg>
  )
}

/* ── SVG Bar Chart (peak hours) ── */
function PeakHoursChart({ data }: { data: { hour: number; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const W = 600; const H = 100; const barW = W / 24 - 2
  // business hours highlight
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 30}`} preserveAspectRatio="none">
      {data.map((d, i) => {
        const bh = (d.count / max) * H
        const x = i * (W / 24) + 1
        const isPeak = d.count === max
        return (
          <g key={d.hour}>
            <rect
              x={x} y={H - bh} width={barW} height={bh}
              rx={3}
              fill={isPeak ? '#f59e0b' : d.hour >= 7 && d.hour <= 22 ? '#3b82f6' : '#94a3b8'}
              opacity={0.85}
            />
            {i % 3 === 0 && (
              <text x={x + barW / 2} y={H + 18} textAnchor="middle" fontSize={9} fill="#94a3b8">
                {d.hour}h
              </text>
            )}
            {isPeak && (
              <text x={x + barW / 2} y={H - bh - 4} textAnchor="middle" fontSize={9} fill="#f59e0b" fontWeight={700}>
                ★
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/* ── SVG Bar Chart (monthly growth) ── */
function MonthlyChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const W = 600; const H = 110
  const bw = data.length > 0 ? (W / data.length) - 4 : 60
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 28}`} preserveAspectRatio="none">
      {data.map((d, i) => {
        const bh = (d.count / max) * H
        const x = i * (W / data.length) + 2
        return (
          <g key={d.label}>
            <rect x={x} y={H - bh} width={bw} height={bh} rx={4} fill="#3b82f6" opacity={0.8} />
            <text x={x + bw / 2} y={H - bh - 5} textAnchor="middle" fontSize={9} fill="#3b82f6" fontWeight={700}>
              {d.count}
            </text>
            <text x={x + bw / 2} y={H + 18} textAnchor="middle" fontSize={9} fill="#94a3b8">
              {d.label.slice(5)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function Admin() {
  const { session, profile } = useStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isAdmin = ADMIN_EMAILS.includes(profile?.email ?? session?.user?.email ?? '')

  useEffect(() => {
    if (!session) { navigate('/auth'); return }
    if (!isAdmin) { navigate('/dashboard'); return }
    getAdminStats()
      .then(setStats)
      .catch(e => setError(e?.response?.data?.detail ?? 'Erro ao carregar stats'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session || !isAdmin) return null

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-white text-lg animate-pulse">Carregando painel admin...</div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-red-400 text-lg">{error}</div>
    </div>
  )

  if (!stats) return null

  const { users, couples, expenses, peak_hours, categories, monthly_growth, recent_users } = stats
  const peakHour = peak_hours.reduce((a, b) => b.count > a.count ? b : a, { hour: 0, count: 0 })
  const genderTotal = users.male + users.female || 1

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ── Header ─────────────────────────────────── */}
      <div
        className="w-full px-8 py-6"
        style={{ background: 'linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 60%,#0ea5e9 100%)' }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium tracking-widest uppercase">FinCouple</p>
            <h1 className="text-3xl font-bold mt-1">Painel Administrativo</h1>
            <p className="text-blue-200 text-sm mt-1">Visão geral da plataforma em tempo real</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            ← Voltar ao App
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── KPI Row ──────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Usuários cadastrados', value: fmt(users.total), sub: `${users.telegram_linked} via Telegram`, color: '#3b82f6', icon: '👥' },
            { label: 'Casais ativos', value: fmt(couples.active), sub: `${couples.pending} aguardando parceiro`, color: '#10b981', icon: '💑' },
            { label: 'Transações registradas', value: fmt(expenses.total_transactions), sub: fmtR(expenses.total_amount) + ' total', color: '#8b5cf6', icon: '💸' },
            { label: 'Renda mensal declarada', value: fmtR(users.total_monthly_income), sub: `Média: ${fmtR(users.avg_monthly_income)}/pessoa`, color: '#f59e0b', icon: '💰' },
          ].map(c => (
            <div key={c.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-600 transition">
              <div className="text-2xl mb-2">{c.icon}</div>
              <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
              <div className="text-slate-300 text-sm font-medium mt-1">{c.label}</div>
              <div className="text-slate-500 text-xs mt-1">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Gender + Categories ──────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Gender */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-slate-200 mb-4">Distribuição por gênero</h2>
            <div className="flex items-center gap-8">
              <DonutChart male={users.male} female={users.female} />
              <div className="space-y-3 flex-1">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-pink-500 inline-block" /> Feminino</span>
                    <span className="font-semibold text-pink-400">{Math.round((users.female / genderTotal) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${(users.female / genderTotal) * 100}%` }} />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{users.female} usuárias</div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Masculino</span>
                    <span className="font-semibold text-blue-400">{Math.round((users.male / genderTotal) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(users.male / genderTotal) * 100}%` }} />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{users.male} usuários</div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500">
                  {users.female > users.male
                    ? `Mulheres representam a maioria (${Math.round((users.female / genderTotal) * 100)}%)`
                    : users.male > users.female
                      ? `Homens representam a maioria (${Math.round((users.male / genderTotal) * 100)}%)`
                      : 'Distribuição igual entre os gêneros'}
                </div>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-slate-200 mb-4">Categorias mais usadas</h2>
            {categories.length === 0 ? (
              <p className="text-slate-500 text-sm">Nenhuma transação ainda</p>
            ) : (
              <div className="space-y-2">
                {categories.map(cat => {
                  const maxTotal = categories[0]?.total || 1
                  const color = CATEGORY_COLORS[cat.name] ?? '#6b7280'
                  return (
                    <div key={cat.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300 capitalize">{cat.name}</span>
                        <span className="text-slate-400">{fmtR(cat.total)} <span className="text-slate-600">({cat.count}x)</span></span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(cat.total / maxTotal) * 100}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Peak Hours ───────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-200">Horários de pico</h2>
              <p className="text-slate-500 text-xs mt-1">Baseado no horário de registro de gastos (horário de Brasília)</p>
            </div>
            {peakHour.count > 0 && (
              <div className="text-right">
                <div className="text-amber-400 font-bold text-lg">{peakHour.hour}h</div>
                <div className="text-slate-500 text-xs">hora de pico</div>
              </div>
            )}
          </div>
          {expenses.total_transactions === 0 ? (
            <p className="text-slate-500 text-sm">Nenhuma transação ainda</p>
          ) : (
            <div className="h-32">
              <PeakHoursChart data={peak_hours} />
            </div>
          )}
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-sm inline-block" /> Horário comercial</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-500 rounded-sm inline-block" /> Madrugada</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-400 rounded-sm inline-block" /> Pico máximo</span>
          </div>
        </div>

        {/* ── Monthly Growth ───────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-slate-200 mb-1">Crescimento de usuários</h2>
          <p className="text-slate-500 text-xs mb-4">Novos cadastros por mês (últimos 12 meses)</p>
          {monthly_growth.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum dado disponível</p>
          ) : (
            <div className="h-36">
              <MonthlyChart data={monthly_growth} />
            </div>
          )}
        </div>

        {/* ── Engagement Cards ────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="text-3xl mb-2">📱</div>
            <div className="text-2xl font-bold text-emerald-400">{users.telegram_linked}</div>
            <div className="text-slate-300 text-sm font-medium mt-1">Usuários no Telegram</div>
            <div className="text-slate-500 text-xs mt-1">
              {users.total > 0 ? Math.round((users.telegram_linked / users.total) * 100) : 0}% do total de usuários
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="text-3xl mb-2">💑</div>
            <div className="text-2xl font-bold text-blue-400">
              {couples.total > 0 ? Math.round((couples.active / couples.total) * 100) : 0}%
            </div>
            <div className="text-slate-300 text-sm font-medium mt-1">Taxa de conversão</div>
            <div className="text-slate-500 text-xs mt-1">{couples.active} de {couples.total} casais completos</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="text-3xl mb-2">💸</div>
            <div className="text-2xl font-bold text-purple-400">
              {users.total > 0 ? fmt(Math.round(expenses.total_transactions / users.total)) : 0}
            </div>
            <div className="text-slate-300 text-sm font-medium mt-1">Transações por usuário</div>
            <div className="text-slate-500 text-xs mt-1">{fmt(expenses.total_transactions)} transações no total</div>
          </div>
        </div>

        {/* ── Recent Users Table ───────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-slate-200 mb-4">Últimos usuários cadastrados</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-slate-500 font-medium pb-3 pr-4">Nome</th>
                  <th className="text-left text-slate-500 font-medium pb-3 pr-4">Email</th>
                  <th className="text-left text-slate-500 font-medium pb-3 pr-4">Gênero</th>
                  <th className="text-left text-slate-500 font-medium pb-3 pr-4">Casal</th>
                  <th className="text-left text-slate-500 font-medium pb-3">Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {recent_users.map(u => (
                  <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                    <td className="py-3 pr-4 text-slate-200 font-medium">{u.name || '—'}</td>
                    <td className="py-3 pr-4 text-slate-400">{u.email}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.gender === 'male' ? 'bg-blue-900/50 text-blue-300' : 'bg-pink-900/50 text-pink-300'}`}>
                        {u.gender === 'male' ? 'Masc.' : 'Fem.'}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.has_couple ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                        {u.has_couple ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-500 text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
                {recent_users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">Nenhum usuário ainda</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
