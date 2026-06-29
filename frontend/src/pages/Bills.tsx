import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, Check, Trash2 } from 'lucide-react'
import { getBills, addBill, toggleBill as toggleBillPaid, deleteBill } from '../api/client'
import { useStore } from '../store/useStore'

interface Bill {
  id: number
  name: string
  amount: number
  due_day: number
  is_paid: boolean
}

export default function Bills() {
  const navigate = useNavigate()
  const { couple, profile: currentUser } = useStore()
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    if (!couple) return
    getBills(couple.id).then(setBills).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [couple])

  const handleToggle = async (bill: Bill) => {
    if (!couple || !currentUser) return
    await toggleBillPaid(couple.id, bill.id)
    load()
  }

  const handleDelete = async (billId: number) => {
    if (!couple) return
    await deleteBill(couple.id, billId)
    load()
  }

  const handleAdd = async () => {
    if (!couple || !name || !amount || !dueDay) return
    setSaving(true)
    try {
      await addBill(couple.id, { name, amount: parseFloat(amount), due_day: parseInt(dueDay) })
      setName(''); setAmount(''); setDueDay(''); setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const total = bills.reduce((s, b) => s + b.amount, 0)
  const paid = bills.filter(b => b.is_paid).reduce((s, b) => s + b.amount, 0)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="text-gray-500">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Contas Fixas</h1>
        <button onClick={() => setShowForm(v => !v)} className="text-pink-500">
          <Plus size={24} />
        </button>
      </div>

      <div className="page pt-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Total', value: total, color: 'text-gray-900' },
            { label: 'Pago', value: paid, color: 'text-green-600' },
            { label: 'Pendente', value: total - paid, color: 'text-orange-500' },
          ].map(item => (
            <div key={item.label} className="card text-center">
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className={`font-bold ${item.color}`}>R$ {item.value.toFixed(2)}</p>
            </div>
          ))}
        </div>

        {/* Add Bill Form */}
        {showForm && (
          <div className="card mb-4 border-pink-100">
            <h3 className="font-semibold text-gray-700 mb-3">Nova Conta Fixa</h3>
            <div className="space-y-3">
              <input className="input" placeholder="Nome (ex: Aluguel)" value={name} onChange={e => setName(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="Valor" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
                <input className="input" placeholder="Dia venc." type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-secondary py-2" onClick={() => setShowForm(false)}>Cancelar</button>
                <button className="btn-primary py-2" onClick={handleAdd} disabled={saving}>
                  {saving ? '...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bills List */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p>Nenhuma conta fixa ainda</p>
            <button className="btn-ghost mt-4" onClick={() => setShowForm(true)}>Adicionar conta</button>
          </div>
        ) : (
          <div className="space-y-2">
            {bills.map(bill => (
              <div key={bill.id} className={`card flex items-center gap-3 ${bill.is_paid ? 'opacity-60' : ''}`}>
                <button
                  onClick={() => handleToggle(bill)}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    bill.is_paid ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                  }`}
                >
                  {bill.is_paid && <Check size={16} />}
                </button>
                <div className="flex-1">
                  <p className={`font-medium ${bill.is_paid ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {bill.name}
                  </p>
                  <p className="text-sm text-gray-400">Vence dia {bill.due_day}</p>
                </div>
                <p className="font-semibold text-gray-700">R$ {bill.amount.toFixed(2)}</p>
                <button onClick={() => handleDelete(bill.id)} className="text-gray-300 hover:text-red-400 ml-1">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
