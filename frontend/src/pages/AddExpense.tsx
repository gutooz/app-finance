import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Check, Pencil, Trash2, Plus } from 'lucide-react'
import {
  addExpense, getCategories, createCategory, updateCategory, deleteCategory, type ExpenseCategory,
} from '../api/client'
import { useStore } from '../store/useStore'

const SPLIT_TYPES = [
  { value: 'couple', label: 'Do casal', desc: 'Dividir conforme configurado' },
  { value: 'mine', label: 'Só meu', desc: 'Não divide com parceiro(a)' },
  { value: 'partners', label: 'Só do(a) parceiro(a)', desc: 'Tudo para o outro' },
]

export default function AddExpense() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { couple, profile: currentUser } = useStore()
  const [entryType, setEntryType] = useState<'income' | 'expense'>(
    searchParams.get('type') === 'income' ? 'income' : 'expense'
  )
  const isIncome = entryType === 'income'
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [splitType, setSplitType] = useState('couple')
  const [paidById, setPaidById] = useState<string | null>(null)
  const [bothPaid, setBothPaid] = useState(false)
  const [myAmount, setMyAmount] = useState('')
  const [partnerAmount, setPartnerAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [catLoading, setCatLoading] = useState(true)
  const [showManage, setShowManage] = useState(false)
  const [editingCat, setEditingCat] = useState<ExpenseCategory | null>(null)
  const [catName, setCatName] = useState('')
  const [catEmoji, setCatEmoji] = useState('📦')
  const [catSaving, setCatSaving] = useState(false)

  const partner = currentUser?.id === couple?.user1_id ? couple?.user2 : couple?.user1

  const loadCategories = () => {
    if (!couple) return
    getCategories(couple.id).then(setCategories).finally(() => setCatLoading(false))
  }

  useEffect(() => { loadCategories() }, [couple])

  const visibleCategories = categories.filter(c => c.type === entryType)

  useEffect(() => {
    if (visibleCategories.length && !visibleCategories.find(c => c.value === category)) {
      setCategory(visibleCategories[0].value)
    }
  }, [categories, entryType]) // eslint-disable-line react-hooks/exhaustive-deps

  const openAddCategory = () => {
    setEditingCat(null)
    setCatName('')
    setCatEmoji('📦')
    setShowManage(true)
  }

  const openEditCategory = (cat: ExpenseCategory) => {
    setEditingCat(cat)
    setCatName(cat.name)
    setCatEmoji(cat.emoji)
  }

  const resetCatForm = () => {
    setEditingCat(null)
    setCatName('')
    setCatEmoji('📦')
  }

  const handleSaveCategory = async () => {
    if (!couple || !catName.trim()) return
    setCatSaving(true)
    try {
      if (editingCat) {
        await updateCategory(couple.id, editingCat.id, { name: catName, emoji: catEmoji })
      } else {
        await createCategory(couple.id, { name: catName, emoji: catEmoji, type: entryType })
      }
      resetCatForm()
      loadCategories()
    } finally {
      setCatSaving(false)
    }
  }

  const handleDeleteCategory = async (cat: ExpenseCategory) => {
    if (!couple) return
    await deleteCategory(couple.id, cat.id)
    if (editingCat?.id === cat.id) resetCatForm()
    loadCategories()
  }

  const handleMyAmountChange = (value: string) => {
    setMyAmount(value)
    const total = parseFloat(amount)
    const mine = parseFloat(value)
    if (!isNaN(total) && !isNaN(mine)) {
      setPartnerAmount(Math.max(0, total - mine).toFixed(2))
    }
  }

  const handlePartnerAmountChange = (value: string) => {
    setPartnerAmount(value)
    const total = parseFloat(amount)
    const theirs = parseFloat(value)
    if (!isNaN(total) && !isNaN(theirs)) {
      setMyAmount(Math.max(0, total - theirs).toFixed(2))
    }
  }

  const handleSave = async () => {
    if (!amount || !couple || !currentUser) return
    if (bothPaid) {
      const total = parseFloat(amount)
      const mine = parseFloat(myAmount) || 0
      const theirs = parseFloat(partnerAmount) || 0
      if (Math.abs(mine + theirs - total) > 0.01) {
        setError('A soma dos valores de cada um deve ser igual ao valor total.')
        return
      }
    }
    const paid = paidById ?? currentUser.id
    setLoading(true)
    setError('')
    try {
      await addExpense(couple.id, {
        paid_by_id: paid,
        amount: parseFloat(amount),
        category,
        description,
        split_type: bothPaid ? 'both' : (isIncome ? 'mine' : splitType),
        type: entryType,
        ...(bothPaid && partner ? {
          payer_amounts: {
            [currentUser.id]: parseFloat(myAmount) || 0,
            [partner.id]: parseFloat(partnerAmount) || 0,
          },
        } : {}),
      })
      navigate('/dashboard')
    } catch {
      setError(isIncome ? 'Erro ao salvar entrada.' : 'Erro ao salvar gasto.')
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
        <h1 className="text-xl font-bold text-gray-900">{isIncome ? 'Adicionar Entrada' : 'Adicionar Saída'}</h1>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
        {/* Entry type toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => setEntryType('expense')}
            className={`py-2 rounded-lg text-sm font-semibold transition-all ${
              !isIncome ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            Saída
          </button>
          <button
            onClick={() => setEntryType('income')}
            className={`py-2 rounded-lg text-sm font-semibold transition-all ${
              isIncome ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            Entrada
          </button>
        </div>

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
            placeholder={isIncome ? 'Ex: Salário de julho' : 'Ex: Compras da semana'}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Category */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-500">Categoria</label>
            <button
              onClick={() => setShowManage(true)}
              className="flex items-center gap-1 text-xs font-medium text-pink-500"
            >
              <Pencil size={12} /> Gerenciar
            </button>
          </div>
          {catLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-[68px] bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {visibleCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.value)}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                    category === cat.value
                      ? (isIncome ? 'border-green-500 bg-green-50' : 'border-pink-500 bg-pink-50')
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-xs font-medium text-gray-700">{cat.name}</span>
                </button>
              ))}
              <button
                onClick={openAddCategory}
                className="p-3 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center gap-1 text-gray-400 hover:border-pink-300 hover:text-pink-400 transition-all"
              >
                <Plus size={20} />
                <span className="text-xs font-medium">Nova</span>
              </button>
            </div>
          )}
        </div>

        {/* Who paid / received */}
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-2">{isIncome ? 'Quem recebeu?' : 'Quem pagou?'}</label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[
              { id: currentUser?.id, name: `Eu (${currentUser?.name})` },
              { id: partner?.id, name: partner?.name || 'Parceiro(a)' },
            ].map(u => (
              <button
                key={u.id}
                onClick={() => { setBothPaid(false); setPaidById(u.id ?? null as string | null) }}
                className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  !bothPaid && (paidById ?? currentUser?.id) === u.id
                    ? 'border-pink-500 bg-pink-50 text-pink-700'
                    : 'border-gray-200 text-gray-700'
                }`}
              >
                {u.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setBothPaid(v => !v)}
            className={`w-full p-3 rounded-xl border-2 text-sm font-medium transition-all ${
              bothPaid ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-700'
            }`}
          >
            {isIncome ? 'Os dois receberam' : 'Os dois pagaram'}
          </button>

          {bothPaid && (
            <div className="mt-3 space-y-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Eu ({currentUser?.name})</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-gray-400 text-sm">R$</span>
                  <input
                    className="input pl-10"
                    placeholder="0,00"
                    type="number"
                    step="0.01"
                    value={myAmount}
                    onChange={e => handleMyAmountChange(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{partner?.name || 'Parceiro(a)'}</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-gray-400 text-sm">R$</span>
                  <input
                    className="input pl-10"
                    placeholder="0,00"
                    type="number"
                    step="0.01"
                    value={partnerAmount}
                    onChange={e => handlePartnerAmountChange(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Split type */}
        {!bothPaid && !isIncome && (
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
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      <div className="px-4 pb-8 pt-4 border-t border-gray-100">
        <button
          className={isIncome
            ? 'w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold py-3 px-4 rounded-2xl transition-colors cursor-pointer disabled:opacity-60'
            : 'btn-primary'}
          onClick={handleSave}
          disabled={loading || !amount}
        >
          {loading ? 'Salvando...' : (isIncome ? 'Salvar Entrada' : 'Salvar Gasto')}
        </button>
      </div>

      {/* Manage categories */}
      {showManage && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end z-50"
          onClick={() => { setShowManage(false); resetCatForm() }}
        >
          <div
            className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-gray-900 mb-4">Gerenciar categorias</h3>

            <div className="space-y-2 mb-4">
              {visibleCategories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50">
                  <span className="text-xl w-7 text-center">{cat.emoji}</span>
                  <span className="flex-1 text-sm font-medium text-gray-700">{cat.name}</span>
                  <button onClick={() => openEditCategory(cat)} className="text-gray-300 hover:text-pink-500 p-1">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDeleteCategory(cat)} className="text-gray-300 hover:text-red-400 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {visibleCategories.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Nenhuma categoria ainda</p>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 mb-2">{editingCat ? 'Editar categoria' : 'Nova categoria'}</p>
              <div className="flex gap-2 mb-3">
                <input
                  className="input w-16 text-center text-xl"
                  maxLength={4}
                  value={catEmoji}
                  onChange={e => setCatEmoji(e.target.value)}
                />
                <input
                  className="input flex-1"
                  placeholder="Nome da categoria"
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {editingCat && (
                  <button className="btn-secondary py-2" onClick={resetCatForm}>Cancelar</button>
                )}
                <button
                  className={`btn-primary py-2 ${editingCat ? '' : 'col-span-2'}`}
                  onClick={handleSaveCategory}
                  disabled={catSaving || !catName.trim()}
                >
                  {catSaving ? 'Salvando...' : editingCat ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </div>

            <button
              className="btn-ghost w-full mt-4"
              onClick={() => { setShowManage(false); resetCatForm() }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
