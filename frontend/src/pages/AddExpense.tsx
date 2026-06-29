import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check } from 'lucide-react'
import { addExpense } from '../api/client'
import { useStore } from '../store/useStore'

const CATEGORIES = [
  { value: 'mercado', label: 'Mercado', icon: '🛒' },
  { value: 'aluguel', label: 'Aluguel', icon: '🏠' },
  { value: 'gasolina', label: 'Gasolina', icon: '⛽' },
  { value: 'restaurante', label: 'Restaurante', icon: '🍽️' },
  { value: 'transporte', label: 'Transporte', icon: '🚗' },
  { value: 'internet', label: 'Internet', icon: '📶' },
  { value: 'saude', label: 'Saúde', icon: '💊' },
  { value: 'pet', label: 'Pet', icon: '🐾' },
  { value: 'streaming', label: 'Streaming', icon: '🎬' },
  { value: 'lazer', label: 'Lazer', icon: '🎉' },
  { value: 'casa', label: 'Casa', icon: '🛋️' },
  { value: 'pessoal', label: 'Pessoal', icon: '👤' },
  { value: 'outros', label: 'Outros', icon: '📦' },
]

const SPLIT_TYPES = [
  { value: 'couple', label: 'Do casal', desc: 'Dividir conforme configurado' },
  { value: 'mine', label: 'Só meu', desc: 'Não divide com parceiro(a)' },
  { value: 'partners', label: 'Só do(a) parceiro(a)', desc: 'Tudo para o outro' },
]

export default function AddExpense() {
  const navigate = useNavigate()
  const { couple, profile: currentUser } = useStore()
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('mercado')
  const [description, setDescription] = useState('')
  const [splitType, setSplitType] = useState('couple')
  const [paidById, setPaidById] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const partner = currentUser?.id === couple?.user1_id ? couple?.user2 : couple?.user1

  const handleSave = async () => {
    if (!amount || !couple || !currentUser) return
    const paid = paidById ?? currentUser.id
    setLoading(true)
    setError('')
    try {
      await addExpense(couple.id, {
        paid_by_id: paid,
        amount: parseFloat(amount),
        category,
        description,
        split_type: splitType,
      })
      navigate('/dashboard')
    } catch {
      setError('Erro ao salvar gasto.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center px-4 pt-12 pb-4 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="text-gray-500 mr-3">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Adicionar Gasto</h1>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Valor</label>
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-gray-400 font-semibold text-lg">R$</span>
            <input
              className="input pl-12 text-2xl font-bold text-gray-900"
              placeholder="0,00"
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Descrição (opcional)</label>
          <input
            className="input"
            placeholder="Ex: Compras da semana"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-2">Categoria</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                  category === cat.value
                    ? 'border-pink-500 bg-pink-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <span className="text-xl">{cat.icon}</span>
                <span className="text-xs font-medium text-gray-700">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Who paid */}
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-2">Quem pagou?</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: currentUser?.id, name: `Eu (${currentUser?.name})` },
              { id: partner?.id, name: partner?.name || 'Parceiro(a)' },
            ].map(u => (
              <button
                key={u.id}
                onClick={() => setPaidById(u.id ?? null as string | null)}
                className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  (paidById ?? currentUser?.id) === u.id
                    ? 'border-pink-500 bg-pink-50 text-pink-700'
                    : 'border-gray-200 text-gray-700'
                }`}
              >
                {u.name}
              </button>
            ))}
          </div>
        </div>

        {/* Split type */}
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-2">Esse gasto é:</label>
          <div className="space-y-2">
            {SPLIT_TYPES.map(s => (
              <button
                key={s.value}
                onClick={() => setSplitType(s.value)}
                className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                  splitType === s.value ? 'border-pink-500 bg-pink-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {splitType === s.value && <Check size={16} className="text-pink-500" />}
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{s.label}</div>
                    <div className="text-xs text-gray-500">{s.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      <div className="px-4 pb-8 pt-4 border-t border-gray-100">
        <button className="btn-primary" onClick={handleSave} disabled={loading || !amount}>
          {loading ? 'Salvando...' : 'Salvar Gasto'}
        </button>
      </div>
    </div>
  )
}
