import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const META_DIARIA = 550 // pares/dia — meta consolidada do Grupo Prado

const hojeISO = () => new Date().toISOString().slice(0, 10)
const diasAtras = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function Barra({ rotulo, valor, max, cor = 'var(--terra)', sufixo = '' }) {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0
  return (
    <div className="mb-2">
      <div className="mb-0.5 flex justify-between text-xs">
        <span className="text-[--text-muted]">{rotulo}</span>
        <span className="font-semibold">{valor}{sufixo}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-black/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [producao, setProducao] = useState([])
  const [perdas, setPerdas] = useState([])
  const [etapas, setEtapas] = useState([])
  const [etapaMeta, setEtapaMeta] = useState(null) // etapa usada como "par produzido"

  useEffect(() => {
    supabase.from('etapas').select('*').order('ordem').then(({ data }) => {
      setEtapas(data ?? [])
      const montagem = (data ?? []).find((e) => e.nome === 'Montagem')
      if (montagem) setEtapaMeta(montagem.id)
    })
    supabase
      .from('vw_producao_diaria')
      .select('*')
      .gte('dia', diasAtras(30))
      .then(({ data }) => setProducao(data ?? []))
    supabase
      .from('vw_perdas_motivo')
      .select('*')
      .gte('dia', diasAtras(30))
      .then(({ data }) => setPerdas(data ?? []))
  }, [])

  const hoje = hojeISO()

  const { hojePorUnidade, hojeTotal, serie7dias, perdasPorEtapa, perdasPorMotivo } = useMemo(() => {
    const naEtapaMeta = producao.filter((p) => p.etapa_id === etapaMeta)

    const hojeLinhas = naEtapaMeta.filter((p) => p.dia === hoje)
    const hojePorUnidade = {}
    for (const l of hojeLinhas) {
      hojePorUnidade[l.unidade] = (hojePorUnidade[l.unidade] ?? 0) + l.produzido
    }
    const hojeTotal = Object.values(hojePorUnidade).reduce((a, b) => a + b, 0)

    const serie7dias = []
    for (let i = 6; i >= 0; i--) {
      const dia = diasAtras(i)
      const total = naEtapaMeta
        .filter((p) => p.dia === dia)
        .reduce((a, p) => a + p.produzido, 0)
      serie7dias.push({ dia, total })
    }

    const perdasPorEtapa = {}
    for (const p of producao) {
      if (p.perdido > 0) perdasPorEtapa[p.etapa] = (perdasPorEtapa[p.etapa] ?? 0) + p.perdido
    }
    const perdasPorMotivo = {}
    for (const p of perdas) {
      perdasPorMotivo[p.motivo] = (perdasPorMotivo[p.motivo] ?? 0) + p.perdido
    }

    return { hojePorUnidade, hojeTotal, serie7dias, perdasPorEtapa, perdasPorMotivo }
  }, [producao, perdas, etapaMeta, hoje])

  const pctMeta = Math.round((hojeTotal / META_DIARIA) * 100)
  const maxSerie = Math.max(META_DIARIA, ...serie7dias.map((s) => s.total))
  const maxPerdaEtapa = Math.max(1, ...Object.values(perdasPorEtapa))
  const maxPerdaMotivo = Math.max(1, ...Object.values(perdasPorMotivo))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-lg font-semibold">Dashboard de produção</h1>
        <label className="text-sm text-[--text-muted]">Par produzido = etapa</label>
        <select
          className="input !w-auto"
          value={etapaMeta ?? ''}
          onChange={(e) => setEtapaMeta(Number(e.target.value))}
        >
          {etapas.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-[--text-muted]">Hoje · consolidado</div>
          <div className="mt-1 text-3xl font-semibold">
            {hojeTotal}
            <span className="text-base font-normal text-[--text-faint]"> / {META_DIARIA} pares</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, pctMeta)}%`,
                background: pctMeta >= 100 ? 'var(--yellow)' : 'var(--terra)',
              }}
            />
          </div>
          <div className="mt-1 text-xs text-[--text-muted]">{pctMeta}% da meta diária</div>
        </div>

        {['Itanhandu', 'Guaxupé'].map((u) => (
          <div key={u} className="card p-5">
            <div className="text-xs uppercase tracking-wide text-[--text-muted]">Hoje · {u}</div>
            <div className="mt-1 text-3xl font-semibold">{hojePorUnidade[u] ?? 0}</div>
            <div className="mt-1 text-xs text-[--text-faint]">pares produzidos</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Últimos 7 dias vs meta ({META_DIARIA})</h2>
          <div className="flex h-40 items-end gap-2">
            {serie7dias.map((s) => (
              <div key={s.dia} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-[--text-muted]">{s.total || ''}</span>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${(s.total / maxSerie) * 100}%`,
                    minHeight: s.total > 0 ? 4 : 0,
                    background: s.total >= META_DIARIA ? 'var(--yellow)' : 'var(--blue)',
                  }}
                />
                <span className="text-[10px] text-[--text-faint]">
                  {new Date(s.dia + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Perdas por etapa · 30 dias</h2>
          {Object.keys(perdasPorEtapa).length === 0 ? (
            <p className="text-sm text-[--text-muted]">Nenhuma perda registrada no período.</p>
          ) : (
            Object.entries(perdasPorEtapa)
              .sort((a, b) => b[1] - a[1])
              .map(([etapa, v]) => (
                <Barra key={etapa} rotulo={etapa} valor={v} max={maxPerdaEtapa} sufixo=" pares" />
              ))
          )}
        </div>

        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Perdas por motivo · 30 dias (qualidade / ISO)</h2>
          {Object.keys(perdasPorMotivo).length === 0 ? (
            <p className="text-sm text-[--text-muted]">Nenhuma perda registrada no período.</p>
          ) : (
            Object.entries(perdasPorMotivo)
              .sort((a, b) => b[1] - a[1])
              .map(([motivo, v]) => (
                <Barra key={motivo} rotulo={motivo} valor={v} max={maxPerdaMotivo} cor="var(--blue)" sufixo=" pares" />
              ))
          )}
        </div>
      </div>
    </div>
  )
}
