import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PluggyConnect } from 'react-pluggy-connect'
import { ChevronLeft, Landmark, RefreshCw, Trash2, AlertCircle, Check } from 'lucide-react'
import {
  getPluggyConnectToken,
  getPluggyItems,
  linkPluggyItem,
  syncPluggyItem,
  deletePluggyItem,
  type PluggyItem,
} from '../api/client'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  UPDATED: { label: 'Conectado', className: 'bg-green-50 text-green-700 border-green-100' },
  UPDATING: { label: 'Atualizando...', className: 'bg-sky-50 text-sky-700 border-sky-100' },
  LOGIN_ERROR: { label: 'Login expirado', className: 'bg-red-50 text-red-600 border-red-100' },
  OUTDATED: { label: 'Desatualizado', className: 'bg-amber-50 text-amber-700 border-amber-100' },
}

export default function BankAccounts() {
  const navigate = useNavigate()
  const [items, setItems] = useState<PluggyItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const loadItems = () => {
    getPluggyItems()
      .then(setItems)
      .catch(() => setMsg({ type: 'err', text: 'Erro ao carregar contas conectadas.' }))
      .finally(() => setLoadingItems(false))
  }

  useEffect(() => { loadItems() }, [])

  const handleConnectClick = async () => {
    setConnecting(true); setMsg(null)
    try {
      const { connectToken } = await getPluggyConnectToken()
      setConnectToken(connectToken)
    } catch {
      setMsg({ type: 'err', text: 'Erro ao iniciar conexao com o banco.' })
      setConnecting(false)
    }
  }

  const handleSync = async (itemId: string) => {
    setSyncingId(itemId); setMsg(null)
    try {
      const result = await syncPluggyItem(itemId)
      setMsg({ type: 'ok', text: `${result.imported} gasto(s) novo(s) importado(s).` })
      loadItems()
    } catch {
      setMsg({ type: 'err', text: 'Erro ao sincronizar transacoes.' })
    } finally {
      setSyncingId(null)
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!window.confirm('Desconectar esta conta bancaria?')) return
    try {
      await deletePluggyItem(itemId)
      setItems(prev => prev.filter(i => i.item_id !== itemId))
    } catch {
      setMsg({ type: 'err', text: 'Erro ao desconectar conta.' })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={() => navigate('/settings')} className="text-gray-500">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Contas bancarias</h1>
      </div>

      <div className="page pt-4 space-y-4">
        <div className="card bg-gradient-to-r from-sky-50 to-blue-50 border-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-sky-500 rounded-2xl flex items-center justify-center text-white">
              <Landmark size={20} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Open Finance</p>
              <p className="text-sm text-gray-500">Conecte seu banco e importe gastos automaticamente</p>
            </div>
          </div>
        </div>

        {msg && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${
            msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}>
            {msg.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
            {msg.text}
          </div>
        )}

        <button className="btn-primary py-2.5" onClick={handleConnectClick} disabled={connecting}>
          {connecting ? 'Abrindo conexao...' : '+ Conectar banco'}
        </button>

        <div className="space-y-3">
          {loadingItems && <p className="text-sm text-gray-400 text-center py-4">Carregando contas...</p>}

          {!loadingItems && items.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Nenhum banco conectado ainda.</p>
          )}

          {items.map(item => {
            const status = STATUS_LABELS[item.status] || { label: item.status, className: 'bg-gray-50 text-gray-600 border-gray-100' }
            return (
              <div key={item.id} className="card flex items-center gap-3">
                {item.connector.imageUrl ? (
                  <img src={item.connector.imageUrl} alt="" className="w-11 h-11 rounded-2xl object-contain bg-gray-50" />
                ) : (
                  <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Landmark size={18} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{item.connector.name || 'Banco'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                    {item.last_synced_at && (
                      <span className="text-[11px] text-gray-400">
                        sincronizado {new Date(item.last_synced_at).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleSync(item.item_id)}
                  disabled={syncingId === item.item_id}
                  className="h-9 w-9 rounded-xl text-sky-600 hover:bg-sky-50 flex items-center justify-center disabled:opacity-50"
                  title="Sincronizar agora"
                >
                  <RefreshCw size={16} className={syncingId === item.item_id ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => handleDelete(item.item_id)}
                  className="h-9 w-9 rounded-xl text-red-500 hover:bg-red-50 flex items-center justify-center"
                  title="Desconectar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={import.meta.env.DEV}
          onSuccess={async (data) => {
            try {
              await linkPluggyItem(data.item.id)
              setMsg({ type: 'ok', text: 'Banco conectado! Sincronizando gastos...' })
              loadItems()
              await handleSync(data.item.id)
            } catch {
              setMsg({ type: 'err', text: 'Conta conectada, mas houve erro ao salvar. Tente sincronizar manualmente.' })
            } finally {
              setConnectToken(null)
              setConnecting(false)
            }
          }}
          onError={() => {
            setMsg({ type: 'err', text: 'Erro ao conectar com o banco.' })
            setConnectToken(null)
            setConnecting(false)
          }}
          onClose={() => {
            setConnectToken(null)
            setConnecting(false)
          }}
        />
      )}
    </div>
  )
}
