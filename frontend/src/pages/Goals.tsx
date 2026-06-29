import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { getGoals, createGoal, contributeGoal as contributeToGoal, deleteGoal } from '../api/client'
import { useStore } from '../store/useStore'

interface Goal {
  id: number
  name: string
  emoji: string
  target_amount: number
  current_amount: number
  deadline: string | null
  is_completed: boolean
}

const EMOJIS = ['✈️', '🏠', '💒', '🚗', '🌴', '💍', '📱', '🎓', '🛡️', '']

export default function Goals() {
  const navigate = useNavigate()
  const { couple, profile: currentUser } = useStore()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [contribGoal, setContribGoal] = useState<Goal | null>(null)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [emoji, setEmoji] = useState('')
  const [contribAmount, setContribAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    if (!couple) return
    getGoals(couple.id).then(setGoals).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [couple])

  const handleCreate = async () => {
    if (!couple || !name || !target) return
    setSaving(true)
    try {
      await createGoal(couple.id, { name, target_amount: parseFloat(target), emoji })
      setName(''); setTarget(''); setEmoji(''); setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleContrib = async () => {
    if (!couple || !currentUser || !contribGoal || !contribAmount) return
    setSaving(true)
    try {
      await contributeToGoal(couple.id, contribGoal.id, { amount: parseFloat(contribAmount) })
      setContribGoal(null); setContribAmount('')
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (goalId: number) => {
    if (!couple) return
    await deleteGoal(couple.id, goalId)
    load()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="text-gray-500">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Metas do Casal</h1>
        <button onClick={() => setShowForm(v => !v)} className="text-pink-500">
          <Plus size={24} />
        </button>
      </div>

      <div className="page pt-4">
        {/* Create form */}
        {showForm && (
          <div className="card mb-4 border-pink-100">
            <h3 className="font-semibold text-gray-700 mb-3">Nova Meta</h3>
            <div className="space-y-3">
              <input className="input" placeholder="Nome (ex: Viagem para o Nordeste)" value={name} onChange={e => setName(e.target.value)} />
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-400">R$</span>
                <input className="input pl-10" placeholder="Valor total" type="number" value={target} onChange={e => setTarget(e.target.value)} />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2">Emoji (opcional)</p>
                <div className="flex gap-2 flex-wrap">
                  {EMOJIS.map(e => (
                    <button
                      key={e || 'none'}
                      onClick={() => setEmoji(e)}
                      className={`w-9 h-9 rounded-lg border-2 text-lg ${emoji === e ? 'border-pink-500' : 'border-gray-200'}`}
                    >
                      {e || '—'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-secondary py-2" onClick={() => setShowForm(false)}>Cancelar</button>
                <button className="btn-primary py-2" onClick={handleCreate} disabled={saving}>
                  {saving ? '...' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contribute modal */}
        {contribGoal && (
          <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={() => setContribGoal(null)}>
            <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-gray-900 mb-1">{contribGoal.emoji} {contribGoal.name}</h3>
              <p className="text-gray-400 text-sm mb-4">
                R$ {contribGoal.current_amount.toFixed(2)} / R$ {contribGoal.target_amount.toFixed(2)}
              </p>
              <div className="relative mb-4">
                <span className="absolute left-4 top-3 text-gray-400">R$</span>
                <input
                  className="input pl-10"
                  placeholder="Quanto adicionar?"
                  type="number"
                  autoFocus
                  value={contribAmount}
                  onChange={e => setContribAmount(e.target.value)}
                />
              </div>
              <button className="btn-primary" onClick={handleContrib} disabled={saving || !contribAmount}>
                {saving ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        )}

        {/* Goals list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🎯</p>
            <p>Nenhuma meta ainda</p>
            <button className="btn-ghost mt-4" onClick={() => setShowForm(true)}>Criar primeira meta</button>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map(goal => {
              const pct = Math.min(100, goal.target_amount > 0 ? Math.round((goal.current_amount / goal.target_amount) * 100) : 0)
              const remaining = goal.target_amount - goal.current_amount
              return (
                <div key={goal.id} className="card">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{goal.emoji} {goal.name}</h3>
                      <p className="text-xs text-gray-400">Falta R$ {remaining.toFixed(2)}</p>
                    </div>
                    <button onClick={() => handleDelete(goal.id)} className="text-gray-200 hover:text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-gradient-to-r from-pink-400 to-purple-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      R$ {goal.current_amount.toFixed(2)} / R$ {goal.target_amount.toFixed(2)}
                    </span>
                    <span className="text-sm font-semibold text-pink-500">{pct}%</span>
                  </div>
                  <button
                    className="mt-3 w-full py-2 text-sm font-medium text-pink-500 bg-pink-50 hover:bg-pink-100 rounded-xl transition-colors"
                    onClick={() => setContribGoal(goal)}
                  >
                    + Adicionar
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
