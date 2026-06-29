import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MessageCircle, PenLine } from 'lucide-react'
import { getExpenses, getBills } from '../api/client'
import { useStore } from '../store/useStore'

const MONTH_NAMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const CATEGORY_ICONS: Record<string, string> = {
  mercado: '🛒', aluguel: '🏠', gasolina: '⛽', restaurante: '🍽️',
  transporte: '🚗', internet: '📶', saude: '💊', pet: '🐾',
  streaming: '🎬', lazer: '🎉', casa: '🛋️', pessoal: '👤', outros: '📦',
}

export default function Calendar() {
  const navigate = useNavigate()
  const { couple } = useStore()
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())
  const [expenses, setExpenses] = useState<any[]>([])
  const [bills, setBills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!couple) return
    setLoading(true)
    setSelectedDay(null)
    Promise.all([
      getExpenses(couple.id, month, year),
      getBills(couple.id, month, year),
    ]).then(([e, b]) => {
      setExpenses(e)
      setBills(b)
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

  // Calendar grid
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // Index expenses and bills by day
  const expensesByDay: Record<number, any[]> = {}
  expenses.forEach(e => {
    const d = parseInt(e.date?.split('-')[2] || '0')
    if (!expensesByDay[d]) expensesByDay[d] = []
    expensesByDay[d].push(e)
  })

  const billsByDay: Record<number, any[]> = {}
  bills.forEach(b => {
    const d = b.due_day
    if (!billsByDay[d]) billsByDay[d] = []
    billsByDay[d].push(b)
  })

  const selectedExpenses = selectedDay ? (expensesByDay[selectedDay] || []) : []
  const selectedBills = selectedDay ? (billsByDay[selectedDay] || []) : []
  const totalSelectedDay = selectedExpenses.reduce((s: number, e: any) => s + e.amount, 0)

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="text-gray-500">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Calendário</h1>
      </div>

      {/* Month navigator */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <button onClick={prevMonth} className="text-gray-400 hover:text-gray-700 p-1">
          <ChevronLeft size={20} />
        </button>
        <span className="font-semibold text-gray-800">{MONTH_NAMES[month]} {year}</span>
        <button onClick={nextMonth} className="text-gray-400 hover:text-gray-700 p-1">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Legend */}
        <div className="flex items-center gap-4 px-4 pt-3 pb-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
            Conta a pagar
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-2.5 h-2.5 rounded-full bg-pink-500" />
            Gasto
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="px-3 pb-2">
          {/* Week days header */}
          <div className="grid grid-cols-7 mb-1">
            {WEEK_DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />
              const hasExpenses = (expensesByDay[day] || []).length > 0
              const hasBills = (billsByDay[day] || []).length > 0
              const isSelected = selectedDay === day
              const todayFlag = isToday(day)

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`relative flex flex-col items-center py-1.5 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-pink-500 text-white shadow-sm'
                      : todayFlag
                      ? 'bg-pink-50 text-pink-600 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-sm font-medium">{day}</span>
                  {/* Dots */}
                  {(hasExpenses || hasBills) && (
                    <div className="flex gap-0.5 mt-0.5">
                      {hasBills && (
                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-orange-200' : 'bg-orange-400'}`} />
                      )}
                      {hasExpenses && (
                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-pink-200' : 'bg-pink-500'}`} />
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day detail */}
        {selectedDay && (
          <div className="px-4 pb-6">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">
                  {selectedDay} de {MONTH_NAMES[month]}
                </h3>
                {totalSelectedDay > 0 && (
                  <span className="text-sm font-semibold text-pink-500">
                    R$ {totalSelectedDay.toFixed(2)}
                  </span>
                )}
              </div>

              {selectedBills.length === 0 && selectedExpenses.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Nenhum registro neste dia.</p>
              )}

              {/* Bills */}
              {selectedBills.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-2">Contas a pagar</p>
                  <div className="space-y-2">
                    {selectedBills.map((b: any) => (
                      <div key={b.id} className="flex items-center gap-3 p-2.5 bg-orange-50 rounded-xl">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${
                          b.is_paid ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-500'
                        }`}>
                          {b.is_paid ? '✅' : '📋'}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{b.name}</p>
                          <p className="text-xs text-gray-400">Vence dia {b.due_day} • {b.is_paid ? 'Pago' : 'Pendente'}</p>
                        </div>
                        <p className="font-semibold text-orange-600 text-sm">R$ {Number(b.amount).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expenses */}
              {selectedExpenses.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-pink-500 uppercase tracking-wide mb-2">Gastos do dia</p>
                  <div className="space-y-2">
                    {selectedExpenses.map((e: any) => {
                      const isTelegram = e.source === 'telegram'
                      return (
                        <div key={e.id} className="flex items-center gap-3 p-2.5 bg-pink-50 rounded-xl">
                          <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-lg shadow-sm">
                            {CATEGORY_ICONS[e.category] || '📦'}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800 capitalize">{e.category}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {isTelegram ? (
                                <MessageCircle size={11} className="text-blue-400" />
                              ) : (
                                <PenLine size={11} className="text-gray-400" />
                              )}
                              <span className="text-xs text-gray-400">
                                {isTelegram ? 'Telegram' : 'Manual'} • {e.paid_by?.name || 'Você'}
                              </span>
                            </div>
                          </div>
                          <p className="font-semibold text-pink-600 text-sm">R$ {Number(e.amount).toFixed(2)}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Month summary */}
        {!selectedDay && !loading && (
          <div className="px-4 pb-6">
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3">Resumo de {MONTH_NAMES[month]}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-pink-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Total gasto</p>
                  <p className="font-bold text-pink-600">
                    R$ {expenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Contas</p>
                  <p className="font-bold text-orange-500">
                    {bills.filter(b => !b.is_paid).length} pendentes
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Via Telegram</p>
                  <p className="font-bold text-blue-500">
                    {expenses.filter(e => e.source === 'telegram').length} gastos
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Manual</p>
                  <p className="font-bold text-gray-600">
                    {expenses.filter(e => e.source !== 'telegram').length} gastos
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
