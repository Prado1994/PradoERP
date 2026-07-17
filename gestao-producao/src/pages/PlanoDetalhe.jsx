import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BarraProgresso, rotuloStatusPlano } from './Planos'

const fmtData = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—')

export default function PlanoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [plano, setPlano] = useState(null)
  const [pedidos, setPedidos] = useState([])
  const [itens, setItens] = useState({}) // pedido_id -> itens com saldo
  const [avulsos, setAvulsos] = useState([])
  const [vincular, setVincular] = useState('')
  const [expandido, setExpandido] = useState(null)

  async function carregar() {
    const { data: pl } = await supabase.from('vw_planos_resumo').select('*').eq('id', id).maybeSingle()
    setPlano(pl)
    const { data: pd } = await supabase
      .from('vw_pedidos_resumo')
      .select('*')
      .eq('plano_id', id)
      .order('created_at')
    setPedidos(pd ?? [])
    const { data: av } = await supabase
      .from('vw_pedidos_resumo')
      .select('*')
      .is('plano_id', null)
      .eq('status', 'aberto')
    setAvulsos(av ?? [])
    if (pd?.length) {
      const { data: it } = await supabase
        .from('vw_pedido_itens_saldo')
        .select('*')
        .in('pedido_id', pd.map((x) => x.id))
      const porPedido = {}
      for (const i of it ?? []) (porPedido[i.pedido_id] ??= []).push(i)
      setItens(porPedido)
    } else {
      setItens({})
    }
  }

  useEffect(() => {
    carregar()
  }, [id])

  async function vincularPedido(e) {
    e.preventDefault()
    if (!vincular) return
    await supabase.from('pedidos').update({ plano_id: id }).eq('id', vincular)
    setVincular('')
    carregar()
  }

  async function desvincular(pedidoId) {
    await supabase.from('pedidos').update({ plano_id: null }).eq('id', pedidoId)
    carregar()
  }

  async function mudarStatus(status) {
    await supabase.from('planos_producao').update({ status }).eq('id', id)
    carregar()
  }

  if (!plano) return <p className="text-[--text-muted]">Carregando…</p>

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">{plano.numero} · {plano.nome}</h1>
        <span className={`badge ${plano.status === 'concluido' ? 'badge-estrategico' : plano.status === 'em_producao' ? 'badge-operacional' : 'badge-tatico'}`}>
          {rotuloStatusPlano[plano.status]}
        </span>
        <Link to="/planos" className="ml-auto text-sm text-blue underline-offset-2 hover:underline">← Voltar</Link>
      </div>
      <p className="mb-4 text-sm text-[--text-muted]">
        {fmtData(plano.data_inicio)} — {fmtData(plano.data_fim)}
        {plano.observacao ? ` · ${plano.observacao}` : ''}
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-[--text-muted]">Pedidos no plano</div>
          <div className="mt-1 text-2xl font-semibold">{plano.total_pedidos}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-[--text-muted]">Pares em OP</div>
          <div className="mt-1 text-2xl font-semibold">
            {plano.pares_em_op}
            <span className="text-sm font-normal text-[--text-faint]"> / {plano.pares_pedidos} pedidos</span>
          </div>
        </div>
        <div className="card p-4">
          <div className="mb-1 text-xs uppercase tracking-wide text-[--text-muted]">Produção concluída</div>
          <BarraProgresso valor={plano.pares_concluidos} total={plano.pares_pedidos} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="flex-1 font-semibold">Pedidos do plano</h2>
        <button className="btn-primary" onClick={() => navigate(`/pedidos?plano=${id}`)}>
          + Novo pedido neste plano
        </button>
        {plano.status === 'aberto' && (
          <button className="btn-secondary" onClick={() => mudarStatus('em_producao')}>Iniciar produção</button>
        )}
        {plano.status === 'em_producao' && (
          <button className="btn-secondary" onClick={() => mudarStatus('concluido')}>Concluir plano</button>
        )}
      </div>

      {avulsos.length > 0 && (
        <form onSubmit={vincularPedido} className="card mb-4 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-56 flex-1">
            <label className="mb-1 block text-sm font-medium">Vincular pedido avulso existente</label>
            <select className="input" value={vincular} onChange={(e) => setVincular(e.target.value)}>
              <option value="">— selecionar pedido —</option>
              {avulsos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numero} · {p.cliente} ({p.pares_pedidos} pares)
                </option>
              ))}
            </select>
          </div>
          <button className="btn-secondary" disabled={!vincular}>Vincular</button>
        </form>
      )}

      <div className="space-y-3">
        {pedidos.map((p) => (
          <div key={p.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="text-left font-semibold text-blue underline-offset-2 hover:underline"
                onClick={() => setExpandido(expandido === p.id ? null : p.id)}
              >
                {p.numero} · {p.cliente}
              </button>
              {p.canal && <span className="rounded bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-medium text-[#2A62B0]">{p.canal}</span>}
              {p.atrasado && (
                <span className="rounded bg-terra px-1.5 py-0.5 text-[10px] font-semibold text-white">ATRASADO</span>
              )}
              <span className="text-xs text-[--text-muted]">prazo {fmtData(p.prazo)}</span>
              <div className="ml-auto w-44">
                <BarraProgresso valor={p.pares_concluidos} total={p.pares_pedidos} />
              </div>
              <button
                className="text-xs text-[--text-faint] underline-offset-2 hover:underline"
                onClick={() => desvincular(p.id)}
              >
                desvincular
              </button>
            </div>

            {expandido === p.id && (
              <div className="mt-3 overflow-x-auto border-t border-black/5 pt-3">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-[--text-muted]">
                      <th className="py-1.5 pr-3 font-medium">Modelo</th>
                      <th className="py-1.5 pr-3 font-medium text-right">Pedido</th>
                      <th className="py-1.5 pr-3 font-medium text-right">Em OP</th>
                      <th className="py-1.5 pr-3 font-medium text-right">Saldo</th>
                      <th className="py-1.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {(itens[p.id] ?? []).map((i) => {
                      const saldo = i.quantidade - i.pares_em_op
                      return (
                        <tr key={i.id} className="border-t border-black/5">
                          <td className="py-2 pr-3">
                            <span className="font-medium">{i.modelo_codigo}</span>{' '}
                            <span className="text-[--text-muted]">{i.modelo_nome}</span>
                          </td>
                          <td className="py-2 pr-3 text-right">{i.quantidade}</td>
                          <td className="py-2 pr-3 text-right">{i.pares_em_op}</td>
                          <td className={`py-2 pr-3 text-right font-semibold ${saldo > 0 ? 'text-terra' : 'text-green-700'}`}>
                            {saldo}
                          </td>
                          <td className="py-2 text-right">
                            {saldo > 0 && (
                              <button
                                className="rounded-[7px] bg-navy px-3 py-1 text-xs font-semibold text-yellow hover:opacity-90"
                                onClick={() =>
                                  navigate(`/ops?nova=1&pedido=${p.id}&modelo=${i.modelo_id}&qtd=${saldo}`)
                                }
                              >
                                Gerar OP ({saldo})
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
        {pedidos.length === 0 && (
          <div className="card p-8 text-center text-[--text-muted]">
            Nenhum pedido vinculado a este plano ainda.
          </div>
        )}
      </div>
    </div>
  )
}
