import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '—')

export default function OpDetalhe() {
  const { id } = useParams()
  const [op, setOp] = useState(null)
  const [fichas, setFichas] = useState([])
  const [apontamentos, setApontamentos] = useState([])

  useEffect(() => {
    supabase
      .from('ordens_producao')
      .select('*, modelos(codigo, nome, marca), unidades(nome)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setOp(data))
  }, [id])

  useEffect(() => {
    if (!op) return
    supabase
      .from('vw_fichas_painel')
      .select('*')
      .eq('op_numero', op.numero)
      .order('numero')
      .then(({ data }) => setFichas(data ?? []))
    supabase
      .from('apontamentos')
      .select('*, etapas(nome), colaboradores(nome), fichas!inner(numero, op_id)')
      .eq('fichas.op_id', id)
      .order('fim', { ascending: false })
      .limit(100)
      .then(({ data }) => setApontamentos(data ?? []))
  }, [op, id])

  if (!op) return <p className="text-[--text-muted]">Carregando…</p>

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">{op.numero}</h1>
        <span className="badge badge-tatico">{op.unidades?.nome}</span>
        <span className="text-sm text-[--text-muted]">
          {op.modelos?.codigo} · {op.modelos?.nome} · {op.quantidade_total} pares
        </span>
        <Link to="/ops" className="ml-auto text-sm text-blue underline-offset-2 hover:underline">
          ← Voltar
        </Link>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fichas.map((f) => (
          <div key={f.id} className="card p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold">{f.numero}</span>
              {f.status === 'concluida' ? (
                <span className="badge badge-estrategico">Concluída</span>
              ) : (
                <span className="badge badge-operacional">{f.etapa_atual}</span>
              )}
            </div>
            <p className="text-sm text-[--text-muted]">
              {f.quantidade} pares{f.lote ? ` · lote ${f.lote}` : ''}
            </p>
            <Link
              to={`/fichas/${f.id}/imprimir`}
              className="mt-3 inline-block rounded-[7px] bg-navy px-3 py-1.5 text-xs font-semibold text-yellow hover:opacity-90"
            >
              Imprimir ficha / QR Code
            </Link>
          </div>
        ))}
      </div>

      <h2 className="mb-2 font-semibold">Apontamentos da OP</h2>
      <div className="card overflow-x-auto !border-t-0 p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-navy text-left text-warm">
              <th className="px-4 py-2.5 font-medium">Data/hora</th>
              <th className="px-4 py-2.5 font-medium">Ficha</th>
              <th className="px-4 py-2.5 font-medium">Etapa</th>
              <th className="px-4 py-2.5 font-medium">Colaborador</th>
              <th className="px-4 py-2.5 font-medium text-right">Produzido</th>
              <th className="px-4 py-2.5 font-medium text-right">Perdas</th>
              <th className="px-4 py-2.5 font-medium">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {apontamentos.map((a) => (
              <tr key={a.id} className="border-t border-black/5">
                <td className="px-4 py-2.5">{fmtDataHora(a.fim)}</td>
                <td className="px-4 py-2.5 font-medium">{a.fichas?.numero}</td>
                <td className="px-4 py-2.5">{a.etapas?.nome}</td>
                <td className="px-4 py-2.5">{a.colaboradores?.nome ?? '—'}</td>
                <td className="px-4 py-2.5 text-right">{a.qtd_produzida}</td>
                <td className="px-4 py-2.5 text-right">{a.qtd_perdida || '—'}</td>
                <td className="px-4 py-2.5 text-xs text-[--text-muted]">{a.motivo_perda ?? ''}</td>
              </tr>
            ))}
            {apontamentos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[--text-muted]">
                  Nenhum apontamento ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
