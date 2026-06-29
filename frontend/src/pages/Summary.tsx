import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getSummary, getExpenses } from '../api/client'
import { useStore } from '../store/useStore'

const MONTH_NAMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const CATEGORY_ICONS: Record<string, string> = {
  mercado: '🛒', aluguel: '🏠', gasolina: '⛽', restaurante: '🍽️',
  transporte: '🚗', internet: '📶', saude: '💊', pet: '🐾',
  streaming: '🎬', lazer: '🎉', casa: '🛋️', pessoal: '👤', outros: '📦',
}

export default function Summary() {
  const navigate = useNavigate()
  const { couple } = useStore()
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [summary, setSummary] = useState<any>(null)
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!couple) return
    setLoading(true)
    Promise.all([
      getSummary(couple.id, month, year),
      getExpenses(couple.id, month, year),
    ]).then(([s, e]) => {
      setSummary(s)
      setExpenses(e)
    }).finally(() => setLoading(false))
  }, [couple, month, year])

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="text-gray-500">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Resumo</h1>
      </div>

      {/* Month selector */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <button onClick={prevMonth} className="text-gray-400 hover:text-gray-700">
          <ChevronLeft size={20} />
        </button>
        <span className="font-semibold text-gray-700">{MONTH_NAMES[month]} {year}</span>
        <button onClick={nextMonth} className="text-gray-400 hover:text-gray-700" disabled={month === today.getMonth() + 1 && year === today.getFullYear()}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="page pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : !summary ? (
          <p className="text-center text-gray-400 py-12">Sem dados para este mês</p>
        ) : (
          <>
            {/* Total */}
            <div className="card mb-4 text-center bg-gradient-to-br from-pink-500 to-purple-600 text-white border-0">
              <p className="text-pink-100 text-sm mb-1">Total gasto</p>
              <p className="text-3xl font-bold">R$ {summary.total_expenses.toFixed(2)}</p>
            </div>

            {/* Balance */}
            <div className="card mb-4">
              <h3 className="font-semibold text-gray-700 mb-3">Quem pagou mais?</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-pink-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">{summary.user1_name}</p>
                  <p className="text-lg font-bold text-pink-600">R$ {summary.user1_paid.toFixed(2)}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">{summary.user2_name}</p>
                  <p className="text-lg font-bold text-purple-600">R$ {summary.user2_paid.toFixed(2)}</p>
                </div>
              </div>
              <div className={`p-3 rounded-xl text-center text-sm font-medium ${
                Math.abs(summary.balance) < 0.01 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
              }`}>
                {summary.balance_description}
              </div>
            </div>

            {/* By category */}
            {Object.keys(summary.by_category).length > 0 && (
              <div className="card mb-4">
                <h3 className="font-semibold text-gray-700 mb-3">Por categoria</h3>
                <div className="space-y-2">
                  {Object.entries(summary.by_category as Record<string, number>).map(([cat, val]) => {
                    const pct = summary.total_expenses > 0 ? (val / summary.total_expenses) * 100 : 0
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700">{CATEGORY_ICONS[cat] || '📦'} {cat}</span>
                          <span className="font-medium text-gray-900">R$ {val.toFixed(2)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-pink-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Bills */}
            {summary.bills_total > 0 && (
              <div className="card mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">Contas Fixas</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-400">Total</p>
                    <p className="font-semibold text-gray-700">R$ {summary.bills_total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Pago</p>
                    <p className="font-semibold text-green-600">R$ {summary.bills_paid.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Pendente</p>
                    <p className="font-semibold text-orange-500">R$ {summary.bills_pending.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent expenses */}
            {expenses.length > 0 && (
              <div className="card mb-4">
                <h3 className="font-semibold text-gray-700 mb-3">Gastos do mês</h3>
                <div className="space-y-2">
                  {expenses.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-3">
                      <span className="text-xl">{CATEGORY_ICONS[e.category] || '📦'}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800 capitalize">{e.category}</p>
                        <p className="text-xs text-gray-400">{e.paid_by?.name} · {e.date}</p>
                      </div>
                      <p className="font-semibold text-gray-700">R$ {e.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
