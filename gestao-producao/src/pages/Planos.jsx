import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const fmtData = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—')
export const rotuloStatusPlano = {
  aberto: 'Aberto',
  em_producao: 'Em produção',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export function BarraProgresso({ valor, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((valor / total) * 100)) : 0
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--yellow)' : 'var(--terra)' }}
        />
      </div>
      <div className="mt-0.5 text-[11px] text-[--text-muted]">
        {valor} / {total} pares ({pct}%)
      </div>
    </div>
  )
}

export default function Planos() {
  const [planos, setPlanos] = useState([])
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState(null)
  const [form, setForm] = useState({ nome: '', data_inicio: '', data_fim: '', observacao: '' })

  const carregar = () =>
    supabase
      .from('vw_planos_resumo')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPlanos(data ?? []))

  useEffect(() => {
    carregar()
  }, [])

  async function salvar(e) {
    e.preventDefault()
    setErro(null)
    const { error } = await supabase.from('planos_producao').insert({
      nome: form.nome,
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      observacao: form.observacao || null,
    })
    if (error) {
      setErro(error.message)
      return
    }
    setForm({ nome: '', data_inicio: '', data_fim: '', observacao: '' })
    setAberto(false)
    carregar()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Planos de Produção</h1>
        <button className="btn-primary" onClick={() => setAberto(!aberto)}>
          {aberto ? 'Fechar' : '+ Novo plano'}
        </button>
      </div>

      {aberto && (
        <form onSubmit={salvar} className="card mb-6 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">Nome do plano</label>
            <input
              className="input"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex.: Semana 30 · Julho/2026"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Início</label>
            <input className="input" type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Fim</label>
            <input className="input" type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="mb-1 block text-sm font-medium">Observação</label>
            <input className="input" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          {erro && <p className="text-sm font-medium text-terra sm:col-span-2 lg:col-span-4">{erro}</p>}
          <div className="sm:col-span-2 lg:col-span-4">
            <button className="btn-primary">Criar plano</button>
          </div>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {planos.map((p) => (
          <Link key={p.id} to={`/planos/${p.id}`} className="card block p-4 transition hover:shadow-md">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold">{p.numero}</span>
              <span className={`badge ${p.status === 'concluido' ? 'badge-estrategico' : p.status === 'em_producao' ? 'badge-operacional' : 'badge-tatico'}`}>
                {rotuloStatusPlano[p.status]}
              </span>
            </div>
            <p className="mb-1 text-sm font-medium">{p.nome}</p>
            <p className="mb-3 text-xs text-[--text-muted]">
              {fmtData(p.data_inicio)} — {fmtData(p.data_fim)} · {p.total_pedidos} pedido{p.total_pedidos === 1 ? '' : 's'}
            </p>
            <BarraProgresso valor={p.pares_concluidos} total={p.pares_pedidos} />
          </Link>
        ))}
        {planos.length === 0 && (
          <div className="card p-8 text-center text-[--text-muted] sm:col-span-2 lg:col-span-3">
            Nenhum plano de produção criado ainda.
          </div>
        )}
      </div>
    </div>
  )
}
