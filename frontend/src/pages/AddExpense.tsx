import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Banknote, CalendarDays, ChevronLeft, Check, CreditCard, Pencil, Smartphone, Trash2, Plus, Wallet } from 'lucide-react'
import {
  addExpense, getCategories, createCategory, updateCategory, deleteCategory, type ExpenseCategory,
} from '../api/client'
import { useStore } from '../store/useStore'
import {
  getCategoryCostTypeLabel,
  getCategoryDueDayLabel,
  getCategoryDueDayOptions,
  normalizeCategoryCostType,
  normalizeCategoryDueDay,
  type CategoryCostType,
} from '../utils/category'
import { getDateInputValue } from '../utils/date'
import { formatCentsToBRL, getMoneyCents, onlyMoneyDigits, parseCentsToCurrency } from '../utils/money'
import {
  getCreditCardDueDate,
  getPaymentMethodOptions,
  isCreditCardCategory,
  type PaymentMethod,
} from '../utils/creditCard'

const SPLIT_TYPES = [
  { value: 'couple', label: 'Do casal', desc: 'Dividir conforme configurado' },
  { value: 'mine', label: 'Só meu', desc: 'Não divide com parceiro(a)' },
  { value: 'partners', label: 'Só do(a) parceiro(a)', desc: 'Tudo para o outro' },
]

const PAYMENT_METHOD_ICONS = {
  pix: Smartphone,
  cash: Banknote,
  debit: Wallet,
  credit_card: CreditCard,
}

export default function AddExpense() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { couple, profile: currentUser } = useStore()
  const [entryType, setEntryType] = useState<'income' | 'expense'>(
    searchParams.get('type') === 'income' ? 'income' : 'expense'
  )
  const isIncome = entryType === 'income'
  const [amount, setAmount] = useState('')
  const [transactionDate, setTransactionDate] = useState(() => getDateInputValue(new Date()))
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
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
  const [catCostType, setCatCostType] = useState<CategoryCostType>('variable')
  const [catDueDay, setCatDueDay] = useState('')
  const [catSaving, setCatSaving] = useState(false)

  const partner = currentUser?.id === couple?.user1_id ? couple?.user2 : couple?.user1

  const loadCategories = useCallback(() => {
    if (!couple) return
    getCategories(couple.id).then(setCategories).finally(() => setCatLoading(false))
  }, [couple])

  useEffect(() => { loadCategories() }, [loadCategories])

  const entryCategories = categories.filter(c => c.type === entryType)
  const creditCardConfig = categories.find(c => c.type === 'expense' && isCreditCardCategory(c.value))
  const visibleCategories = entryCategories.filter(c => !isCreditCardCategory(c.value))
  const manageableCategories = isIncome || !creditCardConfig
    ? visibleCategories
    : [creditCardConfig, ...visibleCategories]
  const defaultCategory = visibleCategories[0]?.value ?? 'outros'
  const selectedCategory = visibleCategories.find(c => c.value === category)?.value
    ?? defaultCategory
  const selectedCreditCard = !isIncome && paymentMethod === 'credit_card'
  const selectedCreditCardDueDay = normalizeCategoryDueDay(creditCardConfig?.due_day)
  const selectedCreditCardPostingDate = selectedCreditCard && selectedCreditCardDueDay
    ? getCreditCardDueDate(transactionDate, selectedCreditCardDueDay)
    : ''
  const editingCreditCard = editingCat ? isCreditCardCategory(editingCat.value) : false

  const openAddCategory = () => {
    setEditingCat(null)
    setCatName('')
    setCatEmoji('📦')
    setCatCostType('variable')
    setCatDueDay('')
    setShowManage(true)
  }

  const openEditCategory = (cat: ExpenseCategory) => {
    setEditingCat(cat)
    setCatName(cat.name)
    setCatEmoji(cat.emoji)
    setCatCostType(normalizeCategoryCostType(cat.cost_type))
    setCatDueDay(cat.due_day ? String(cat.due_day) : '')
  }

  const resetCatForm = () => {
    setEditingCat(null)
    setCatName('')
    setCatEmoji('📦')
    setCatCostType('variable')
    setCatDueDay('')
  }

  const handleSaveCategory = async () => {
    if (!couple || !catName.trim()) return
    const dueDay = catCostType === 'fixed' ? normalizeCategoryDueDay(catDueDay) : null
    if (catCostType === 'fixed' && !dueDay) return

    setCatSaving(true)
    try {
      if (editingCat) {
        await updateCategory(couple.id, editingCat.id, { name: catName, emoji: catEmoji, cost_type: catCostType, due_day: dueDay })
      } else {
        await createCategory(couple.id, { name: catName, emoji: catEmoji, type: entryType, cost_type: catCostType, due_day: dueDay })
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
    const nextValue = onlyMoneyDigits(value)
    setMyAmount(nextValue)

    const totalCents = getMoneyCents(amount)
    const mineCents = getMoneyCents(nextValue)
    setPartnerAmount(String(Math.max(0, totalCents - mineCents)))
  }

  const handlePartnerAmountChange = (value: string) => {
    const nextValue = onlyMoneyDigits(value)
    setPartnerAmount(nextValue)

    const totalCents = getMoneyCents(amount)
    const theirsCents = getMoneyCents(nextValue)
    setMyAmount(String(Math.max(0, totalCents - theirsCents)))
  }

  const handleSave = async () => {
    const totalCents = getMoneyCents(amount)
    if (!totalCents || !couple || !currentUser) return
    if (selectedCreditCard && !selectedCreditCardDueDay) {
      setError('Configure o vencimento do cartão de crédito em Gerenciar antes de salvar.')
      return
    }
    if (bothPaid) {
      const mineCents = getMoneyCents(myAmount)
      const theirsCents = getMoneyCents(partnerAmount)
      if (Math.abs(mineCents + theirsCents - totalCents) > 1) {
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
        amount: parseCentsToCurrency(amount),
        category: selectedCategory,
        description,
        date: transactionDate,
        split_type: bothPaid ? 'both' : (isIncome ? 'mine' : splitType),
        type: entryType,
        payment_method: isIncome ? 'cash' : paymentMethod,
        ...(bothPaid && partner ? {
          payer_amounts: {
            [currentUser.id]: parseCentsToCurrency(myAmount),
            [partner.id]: parseCentsToCurrency(partnerAmount),
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
              type="text"
              inputMode="numeric"
              value={formatCentsToBRL(amount)}
              onChange={e => setAmount(onlyMoneyDigits(e.target.value))}
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

        {/* Date */}
        <div>
          <label htmlFor="transaction-date" className="block text-sm font-medium text-gray-500 mb-1">
            Data
          </label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              id="transaction-date"
              className="input pl-11 font-semibold text-gray-800"
              type="date"
              value={transactionDate}
              onChange={e => setTransactionDate(e.target.value)}
            />
          </div>
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
                    selectedCategory === cat.value
                      ? (isIncome ? 'border-green-500 bg-green-50' : 'border-pink-500 bg-pink-50')
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-xs font-medium text-gray-700">{cat.name}</span>
                  {!isIncome && isCreditCardCategory(cat.value) && normalizeCategoryDueDay(cat.due_day) && (
                    <span className="text-[10px] font-semibold text-pink-500">
                      Vence dia {normalizeCategoryDueDay(cat.due_day)}
                    </span>
                  )}
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

        {!isIncome && (
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-2">Forma de pagamento</label>
            <div className="grid grid-cols-4 gap-2">
              {getPaymentMethodOptions().map(method => {
                const active = paymentMethod === method.value
                const Icon = PAYMENT_METHOD_ICONS[method.value]

                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setPaymentMethod(method.value)}
                    className={`min-h-[72px] rounded-xl border-2 px-2 py-3 text-center transition-all ${
                      active ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600'
                    }`}
                    aria-pressed={active}
                  >
                    <Icon className="mx-auto mb-1" size={18} />
                    <span className="block text-xs font-semibold">{method.label}</span>
                    <span className="block text-[10px] leading-tight text-gray-400">{method.description}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {selectedCreditCard && (
          <div className={`rounded-xl border p-3 text-sm ${
            selectedCreditCardPostingDate
              ? 'border-blue-100 bg-blue-50 text-blue-700'
              : 'border-amber-100 bg-amber-50 text-amber-700'
          }`}>
            {selectedCreditCardPostingDate
              ? `No cartão de crédito, esse gasto será descontado do saldo em ${selectedCreditCardPostingDate.split('-').reverse().join('/')}.`
              : 'Defina o dia de vencimento do cartão de crédito em Gerenciar para lançar gastos no crédito.'}
          </div>
        )}

        {/* Who paid / received */}
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-2">{isIncome ? 'Quem recebeu?' : 'Quem pagou?'}</label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[
              { id: currentUser?.id, name: `Eu (${currentUser?.name})` },
              { id: partner?.id, name: partner?.name || 'Parceiro(a)' },
            ].map((u, index) => (
              <button
                key={u.id ?? `payer-${index}`}
                onClick={() => { setBothPaid(false); setPaidById(u.id ?? null) }}
                disabled={!u.id}
                className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  !bothPaid && (paidById ?? currentUser?.id) === u.id
                    ? 'border-pink-500 bg-pink-50 text-pink-700'
                    : 'border-gray-200 text-gray-700 disabled:opacity-50'
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
                    type="text"
                    inputMode="numeric"
                    value={formatCentsToBRL(myAmount)}
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
                    type="text"
                    inputMode="numeric"
                    value={formatCentsToBRL(partnerAmount)}
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
          disabled={loading || !getMoneyCents(amount)}
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
              {manageableCategories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50">
                  <span className="text-xl w-7 text-center">{cat.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">{cat.name}</span>
                  {cat.is_system && (
                    <span className="flex-shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                      Sistema
                    </span>
                  )}
                  <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                    {getCategoryCostTypeLabel(normalizeCategoryCostType(cat.cost_type))}
                  </span>
                  {normalizeCategoryCostType(cat.cost_type) === 'fixed' && getCategoryDueDayLabel(cat.due_day) && (
                    <span className="flex-shrink-0 rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-semibold text-pink-600">
                      {getCategoryDueDayLabel(cat.due_day)}
                    </span>
                  )}
                  <button onClick={() => openEditCategory(cat)} className="text-gray-300 hover:text-pink-500 p-1">
                    <Pencil size={16} />
                  </button>
                  {!cat.is_system && (
                    <button onClick={() => handleDeleteCategory(cat)} className="text-gray-300 hover:text-red-400 p-1">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              {manageableCategories.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Nenhuma categoria ainda</p>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 mb-2">
                {editingCreditCard ? 'Configurar cartão de crédito' : editingCat ? 'Editar categoria' : 'Nova categoria'}
              </p>
              <div className="flex gap-2 mb-3">
                <input
                  className="input w-16 text-center text-xl"
                  maxLength={4}
                  value={catEmoji}
                  disabled={editingCreditCard}
                  onChange={e => setCatEmoji(e.target.value)}
                />
                <input
                  className="input flex-1"
                  placeholder="Nome da categoria"
                  value={catName}
                  disabled={editingCreditCard}
                  onChange={e => setCatName(e.target.value)}
                />
              </div>
              {!editingCreditCard && (
                <div className="mb-3">
                  <span className="mb-2 block text-xs font-medium text-gray-500">
                    {isIncome ? 'Tipo de entrada' : 'Tipo de gasto'}
                  </span>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                    {(['variable', 'fixed'] as CategoryCostType[]).map(option => {
                      const active = catCostType === option
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setCatCostType(option)}
                          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                            active ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500'
                          }`}
                          aria-pressed={active}
                        >
                          {getCategoryCostTypeLabel(option)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {catCostType === 'fixed' && (
                <div className="mb-3">
                  <span className="mb-2 block text-xs font-medium text-gray-500">
                    {editingCreditCard ? 'Dia de vencimento' : 'Dia da conta'}
                  </span>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-2">
                    <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold text-gray-400">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((weekday, index) => (
                        <span key={`${weekday}-${index}`}>{weekday}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {getCategoryDueDayOptions().map(day => {
                        const active = normalizeCategoryDueDay(catDueDay) === day

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => setCatDueDay(String(day))}
                            className={`aspect-square rounded-full text-xs font-semibold transition-all ${
                              active
                                ? 'bg-pink-500 text-white shadow-sm'
                                : 'bg-white text-gray-600 hover:bg-pink-50 hover:text-pink-600'
                            }`}
                            aria-label={`Dia ${day}`}
                            aria-pressed={active}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {editingCat && (
                  <button className="btn-secondary py-2" onClick={resetCatForm}>Cancelar</button>
                )}
                <button
                  className={`btn-primary py-2 ${editingCat ? '' : 'col-span-2'}`}
                  onClick={handleSaveCategory}
                  disabled={catSaving || !catName.trim() || (catCostType === 'fixed' && !normalizeCategoryDueDay(catDueDay))}
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
