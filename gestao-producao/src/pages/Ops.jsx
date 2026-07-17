import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const fmtData = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—')
const rotuloStatus = {
  aberta: 'Aberta',
  em_producao: 'Em produção',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export default function Ops() {
  const [params, setParams] = useSearchParams()
  const [ops, setOps] = useState([])
  const [modelos, setModelos] = useState([])
  const [unidades, setUnidades] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [novaAberta, setNovaAberta] = useState(params.get('nova') === '1')
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const [modeloId, setModeloId] = useState(params.get('modelo') ?? '')
  const [pedidoId, setPedidoId] = useState(params.get('pedido') ?? '')
  const [unidadeId, setUnidadeId] = useState('')
  const [prazo, setPrazo] = useState('')
  const [numFichas, setNumFichas] = useState('1')
  const [quantidade, setQuantidade] = useState(params.get('qtd') ?? '')
  const [grade, setGrade] = useState({}) // {"38": "40", ...}

  const modelo = modelos.find((m) => m.id === modeloId)
  const usaGrade = Number(numFichas) === 1 && modelo
  const numeracoes = useMemo(() => {
    if (!modelo) return []
    const ns = []
    for (let n = modelo.grade_inicio; n <= modelo.grade_fim; n++) ns.push(n)
    return ns
  }, [modelo])
  const totalGrade = numeracoes.reduce((a, n) => a + (Number(grade[n]) || 0), 0)

  async function carregar() {
    const { data } = await supabase
      .from('ordens_producao')
      .select('*, modelos(codigo, nome, marca), unidades(nome), fichas(id), pedidos(numero, cliente)')
      .order('created_at', { ascending: false })
      .limit(200)
    setOps(data ?? [])
  }

  useEffect(() => {
    carregar()
    supabase.from('modelos').select('*').eq('ativo', true).order('codigo').then(({ data }) => setModelos(data ?? []))
    supabase.from('unidades').select('*').order('id').then(({ data }) => setUnidades(data ?? []))
    supabase
      .from('pedidos')
      .select('id, numero, cliente')
      .eq('status', 'aberto')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPedidos(data ?? []))
  }, [])

  async function criarOp(e) {
    e.preventDefault()
    setErro(null)
    setSalvando(true)

    const qtdTotal = usaGrade && totalGrade > 0 ? totalGrade : Number(quantidade)
    const n = Math.max(1, Number(numFichas) || 1)
    if (!qtdTotal || qtdTotal <= 0) {
      setErro('Informe a quantidade total (ou preencha a grade).')
      setSalvando(false)
      return
    }

    const { data: op, error } = await supabase
      .from('ordens_producao')
      .insert({
        modelo_id: modeloId,
        unidade_id: Number(unidadeId),
        quantidade_total: qtdTotal,
        prazo: prazo || null,
        pedido_id: pedidoId || null,
      })
      .select()
      .single()

    if (error) {
      setErro(error.message)
      setSalvando(false)
      return
    }

    // fichas: divide a quantidade em n lotes (o resto vai para a primeira)
    const base = Math.floor(qtdTotal / n)
    const fichas = Array.from({ length: n }, (_, i) => ({
      op_id: op.id,
      quantidade: i === 0 ? qtdTotal - base * (n - 1) : base,
      lote: n > 1 ? `${i + 1}/${n}` : null,
      grade:
        usaGrade && totalGrade > 0
          ? Object.fromEntries(numeracoes.filter((x) => Number(grade[x]) > 0).map((x) => [x, Number(grade[x])]))
          : {},
    }))

    const { error: e2 } = await supabase.from('fichas').insert(fichas)
    if (e2) {
      setErro(e2.message)
      setSalvando(false)
      return
    }

    setNovaAberta(false)
    setModeloId('')
    setPedidoId('')
    setQuantidade('')
    setGrade({})
    setNumFichas('1')
    setPrazo('')
    setSalvando(false)
    setParams({})
    carregar()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Ordens de Produção</h1>
        <button className="btn-primary" onClick={() => setNovaAberta(!novaAberta)}>
          {novaAberta ? 'Fechar' : '+ Nova OP'}
        </button>
      </div>

      {novaAberta && (
        <form onSubmit={criarOp} className="card mb-6 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Modelo</label>
              <select className="input" value={modeloId} onChange={(e) => setModeloId(e.target.value)} required>
                <option value="">— selecionar —</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codigo} · {m.nome} ({m.marca})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Unidade fabril</label>
              <select className="input" value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} required>
                <option value="">— selecionar —</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Pedido atendido <span className="font-normal text-[--text-faint]">(opcional)</span>
              </label>
              <select className="input" value={pedidoId} onChange={(e) => setPedidoId(e.target.value)}>
                <option value="">— sem pedido —</option>
                {pedidos.map((p) => (
                  <option key={p.id} value={p.id}>{p.numero} · {p.cliente}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Prazo</label>
              <input className="input" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nº de fichas (lotes)</label>
              <input
                className="input"
                type="number"
                min="1"
                max="20"
                value={numFichas}
                onChange={(e) => setNumFichas(e.target.value)}
              />
            </div>
          </div>

          {usaGrade ? (
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">
                Grade de numeração <span className="font-normal text-[--text-faint]">(total: {totalGrade} pares)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {numeracoes.map((n) => (
                  <div key={n} className="w-16">
                    <div className="text-center text-xs text-[--text-muted]">{n}</div>
                    <input
                      className="input !px-1 text-center"
                      type="number"
                      min="0"
                      value={grade[n] ?? ''}
                      onChange={(e) => setGrade({ ...grade, [n]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              {totalGrade === 0 && (
                <div className="mt-3 max-w-xs">
                  <label className="mb-1 block text-sm font-medium">ou quantidade total (sem grade)</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 max-w-xs">
              <label className="mb-1 block text-sm font-medium">Quantidade total (pares)</label>
              <input
                className="input"
                type="number"
                min="1"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-[--text-faint]">
                Com mais de uma ficha, a quantidade é dividida entre os lotes.
              </p>
            </div>
          )}

          {erro && <p className="mt-3 text-sm font-medium text-terra">{erro}</p>}
          <button className="btn-primary mt-4" disabled={salvando}>
            {salvando ? 'Criando…' : 'Abrir OP e gerar fichas'}
          </button>
        </form>
      )}

      <div className="card overflow-x-auto !border-t-0 p-0">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="bg-navy text-left text-warm">
              <th className="px-4 py-3 font-medium">OP</th>
              <th className="px-4 py-3 font-medium">Modelo</th>
              <th className="px-4 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Unidade</th>
              <th className="px-4 py-3 font-medium text-right">Pares</th>
              <th className="px-4 py-3 font-medium text-right">Fichas</th>
              <th className="px-4 py-3 font-medium">Prazo</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ops.map((op) => (
              <tr key={op.id} className="border-t border-black/5 hover:bg-black/[0.02]">
                <td className="px-4 py-3">
                  <Link to={`/ops/${op.id}`} className="font-semibold text-blue underline-offset-2 hover:underline">
                    {op.numero}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{op.modelos?.codigo}</div>
                  <div className="text-xs text-[--text-muted]">{op.modelos?.nome}</div>
                </td>
                <td className="px-4 py-3">
                  {op.pedidos ? (
                    <>
                      <div className="font-medium">{op.pedidos.numero}</div>
                      <div className="text-xs text-[--text-muted]">{op.pedidos.cliente}</div>
                    </>
                  ) : (
                    <span className="text-[--text-faint]">—</span>
                  )}
                </td>
                <td className="px-4 py-3">{op.unidades?.nome}</td>
                <td className="px-4 py-3 text-right">{op.quantidade_total}</td>
                <td className="px-4 py-3 text-right">{op.fichas?.length ?? 0}</td>
                <td className="px-4 py-3">{fmtData(op.prazo)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${op.status === 'concluida' ? 'badge-estrategico' : op.status === 'em_producao' ? 'badge-operacional' : 'badge-tatico'}`}>
                    {rotuloStatus[op.status]}
                  </span>
                </td>
              </tr>
            ))}
            {ops.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[--text-muted]">
                  Nenhuma OP aberta ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
