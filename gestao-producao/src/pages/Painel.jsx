import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const fmtData = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—')

export default function Painel() {
  const [fichas, setFichas] = useState([])
  const [unidades, setUnidades] = useState([])
  const [etapas, setEtapas] = useState([])
  const [filtroUnidade, setFiltroUnidade] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('em_andamento')
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    const { data } = await supabase
      .from('vw_fichas_painel')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    setFichas(data ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    supabase.from('unidades').select('*').order('id').then(({ data }) => setUnidades(data ?? []))
    supabase.from('etapas').select('*').order('ordem').then(({ data }) => setEtapas(data ?? []))
    carregar()

    // painel ao vivo: recarrega quando chega apontamento ou a ficha muda de etapa
    const canal = supabase
      .channel('painel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'apontamentos' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fichas' }, carregar)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [])

  const visiveis = fichas.filter(
    (f) =>
      (!filtroUnidade || String(f.unidade_id) === filtroUnidade) &&
      (!filtroStatus || f.status === filtroStatus)
  )

  const porEtapa = etapas.map((e) => ({
    ...e,
    total: visiveis.filter((f) => f.etapa_atual_id === e.id).length,
  }))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-lg font-semibold">Painel de acompanhamento</h1>
        <select className="input !w-auto" value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}>
          <option value="">Todas as unidades</option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>{u.nome}</option>
          ))}
        </select>
        <select className="input !w-auto" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="em_andamento">Em andamento</option>
          <option value="concluida">Concluídas</option>
          <option value="">Todas</option>
        </select>
      </div>

      {filtroStatus === 'em_andamento' && (
        <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {porEtapa.map((e) => (
            <div key={e.id} className="card p-3 text-center">
              <div className="text-2xl font-semibold text-terra">{e.total}</div>
              <div className="text-[11px] uppercase tracking-wide text-[--text-muted]">{e.nome}</div>
            </div>
          ))}
        </div>
      )}

      {carregando ? (
        <p className="text-[--text-muted]">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <div className="card p-8 text-center text-[--text-muted]">Nenhuma ficha encontrada.</div>
      ) : (
        <div className="card overflow-x-auto !border-t-0 p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-navy text-left text-warm">
                <th className="px-4 py-3 font-medium">Ficha</th>
                <th className="px-4 py-3 font-medium">OP / Modelo</th>
                <th className="px-4 py-3 font-medium">Unidade</th>
                <th className="px-4 py-3 font-medium">Etapa atual</th>
                <th className="px-4 py-3 font-medium text-right">Pares</th>
                <th className="px-4 py-3 font-medium text-right">Na etapa</th>
                <th className="px-4 py-3 font-medium">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((f) => (
                <tr key={f.id} className="border-t border-black/5 hover:bg-black/[0.02]">
                  <td className="px-4 py-3">
                    <Link to={`/fichas/${f.id}/imprimir`} className="font-semibold text-blue underline-offset-2 hover:underline">
                      {f.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{f.op_numero}</div>
                    <div className="text-xs text-[--text-muted]">
                      {f.modelo_codigo} · {f.modelo_nome}
                    </div>
                  </td>
                  <td className="px-4 py-3">{f.unidade}</td>
                  <td className="px-4 py-3">
                    {f.status === 'concluida' ? (
                      <span className="badge badge-estrategico">Concluída</span>
                    ) : (
                      <span className="badge badge-operacional">{f.etapa_atual}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{f.quantidade}</td>
                  <td className="px-4 py-3 text-right text-[--text-muted]">
                    {f.status === 'em_andamento' ? `${f.produzido_etapa_atual}/${f.quantidade}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {fmtData(f.prazo)}
                    {f.atrasada && (
                      <span className="ml-2 rounded bg-terra px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        ATRASADA
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
