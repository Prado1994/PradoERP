import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BarraProgresso } from './Planos'

const fmtData = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—')
const rotuloStatus = { aberto: 'Aberto', concluido: 'Concluído', cancelado: 'Cancelado' }
const ITEM_VAZIO = { modelo_id: '', quantidade: '' }

export default function Pedidos() {
  const [params, setParams] = useSearchParams()
  const planoPrefill = params.get('plano') ?? ''

  const [pedidos, setPedidos] = useState([])
  const [planos, setPlanos] = useState([])
  const [modelos, setModelos] = useState([])
  const [aberto, setAberto] = useState(Boolean(planoPrefill))
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({ cliente: '', canal: '', prazo: '', plano_id: planoPrefill, observacao: '' })
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }])

  const carregar = () =>
    supabase
      .from('vw_pedidos_resumo')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setPedidos(data ?? []))

  useEffect(() => {
    carregar()
    supabase
      .from('planos_producao')
      .select('id, numero, nome')
      .in('status', ['aberto', 'em_producao'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setPlanos(data ?? []))
    supabase.from('modelos').select('id, codigo, nome, marca').eq('ativo', true).order('codigo').then(({ data }) => setModelos(data ?? []))
  }, [])

  async function salvar(e) {
    e.preventDefault()
    setErro(null)
    const validos = itens.filter((i) => i.modelo_id && Number(i.quantidade) > 0)
    if (validos.length === 0) {
      setErro('Adicione pelo menos um item (modelo + quantidade).')
      return
    }
    setSalvando(true)
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .insert({
        cliente: form.cliente,
        canal: form.canal || null,
        prazo: form.prazo || null,
        plano_id: form.plano_id || null,
        observacao: form.observacao || null,
      })
      .select()
      .single()
    if (error) {
      setErro(error.message)
      setSalvando(false)
      return
    }
    const { error: e2 } = await supabase.from('pedido_itens').insert(
      validos.map((i) => ({ pedido_id: pedido.id, modelo_id: i.modelo_id, quantidade: Number(i.quantidade) }))
    )
    setSalvando(false)
    if (e2) {
      setErro(e2.message)
      return
    }
    setForm({ cliente: '', canal: '', prazo: '', plano_id: '', observacao: '' })
    setItens([{ ...ITEM_VAZIO }])
    setAberto(false)
    if (planoPrefill) setParams({})
    carregar()
  }

  function setItem(idx, campo, valor) {
    setItens(itens.map((i, j) => (j === idx ? { ...i, [campo]: valor } : i)))
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pedidos</h1>
        <button className="btn-primary" onClick={() => setAberto(!aberto)}>
          {aberto ? 'Fechar' : '+ Novo pedido'}
        </button>
      </div>

      {aberto && (
        <form onSubmit={salvar} className="card mb-6 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Cliente</label>
              <input className="input" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Canal</label>
              <select className="input" value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })}>
                <option value="">—</option>
                <option>B2B</option>
                <option>Representante</option>
                <option>Marketplace</option>
                <option>Outro</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Prazo</label>
              <input className="input" type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Plano de produção</label>
              <select className="input" value={form.plano_id} onChange={(e) => setForm({ ...form, plano_id: e.target.value })}>
                <option value="">— sem plano (avulso) —</option>
                {planos.map((p) => (
                  <option key={p.id} value={p.id}>{p.numero} · {p.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">Itens do pedido</label>
            {itens.map((item, idx) => (
              <div key={idx} className="mb-2 flex gap-2">
                <select
                  className="input flex-1"
                  value={item.modelo_id}
                  onChange={(e) => setItem(idx, 'modelo_id', e.target.value)}
                >
                  <option value="">— modelo —</option>
                  {modelos.map((m) => (
                    <option key={m.id} value={m.id}>{m.codigo} · {m.nome} ({m.marca})</option>
                  ))}
                </select>
                <input
                  className="input !w-28"
                  type="number"
                  min="1"
                  placeholder="pares"
                  value={item.quantidade}
                  onChange={(e) => setItem(idx, 'quantidade', e.target.value)}
                />
                {itens.length > 1 && (
                  <button
                    type="button"
                    className="rounded-[7px] px-2 text-terra hover:bg-black/5"
                    onClick={() => setItens(itens.filter((_, j) => j !== idx))}
                    aria-label="Remover item"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="text-sm font-medium text-blue underline-offset-2 hover:underline"
              onClick={() => setItens([...itens, { ...ITEM_VAZIO }])}
            >
              + adicionar item
            </button>
          </div>

          {erro && <p className="mt-3 text-sm font-medium text-terra">{erro}</p>}
          <button className="btn-primary mt-4" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Criar pedido'}
          </button>
        </form>
      )}

      <div className="card overflow-x-auto !border-t-0 p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-navy text-left text-warm">
              <th className="px-4 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Canal</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Prazo</th>
              <th className="px-4 py-3 font-medium">Progresso</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id} className="border-t border-black/5 hover:bg-black/[0.02]">
                <td className="px-4 py-3 font-semibold">{p.numero}</td>
                <td className="px-4 py-3">{p.cliente}</td>
                <td className="px-4 py-3">{p.canal ?? '—'}</td>
                <td className="px-4 py-3">
                  {p.plano_id ? (
                    <Link to={`/planos/${p.plano_id}`} className="text-blue underline-offset-2 hover:underline">
                      {p.plano_numero}
                    </Link>
                  ) : (
                    <span className="text-[--text-faint]">avulso</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {fmtData(p.prazo)}
                  {p.atrasado && (
                    <span className="ml-2 rounded bg-terra px-1.5 py-0.5 text-[10px] font-semibold text-white">ATRASADO</span>
                  )}
                </td>
                <td className="w-48 px-4 py-3">
                  <BarraProgresso valor={p.pares_concluidos} total={p.pares_pedidos} />
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${p.status === 'concluido' ? 'badge-estrategico' : 'badge-tatico'}`}>
                    {rotuloStatus[p.status]}
                  </span>
                </td>
              </tr>
            ))}
            {pedidos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[--text-muted]">Nenhum pedido cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
