import { useEffect, useMemo, useRef, useState } from 'react'
import { Cartao } from './Cartao'
import { Botao, Card, Pill, Progresso, TituloSecao, Vazio } from './ui'
import {
  diasDeAtraso,
  formatarData,
  hoje,
  isAtrasada,
  isRotina,
  labelRecorrencia,
  naAgendaDeHoje,
  progressoChecklist,
  rotinaPendente,
} from './domain'
import { STATUSES, STATUS_LABEL, type Page, type Project, type SObject } from './types'

export interface AcoesCartao {
  onStatus: (id: string, s: string) => void
  onConcluirHoje: (id: string) => void
  onReabrirHoje: (id: string) => void
  onItem: (id: string, itemId: string) => void
  onAgenda: (id: string) => void
  onPomodoro: (id: string, delta: number) => void
}

interface BaseProps extends AcoesCartao {
  objetos: SObject[]
  projetos: Project[]
}

function porId(projetos: Project[]) {
  return (id: string | null) => projetos.find((p) => p.id === id)
}

const grade: React.CSSProperties = { display: 'grid', gap: 12 }

// ---------------------------------------------------------------- Hoje

export function Hoje({ objetos, projetos, ...acoes }: BaseProps) {
  const ref = hoje()
  const proj = porId(projetos)

  const atrasadas = objetos.filter((o) => isAtrasada(o, ref))
  const rotinas = objetos.filter((o) => rotinaPendente(o, ref))
  const doDia = objetos.filter(
    (o) => naAgendaDeHoje(o, ref) && !isAtrasada(o, ref) && !rotinaPendente(o, ref),
  )
  const feitasHoje = objetos.filter((o) => isRotina(o) && o.last_done === ref)

  const data = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div style={{ display: 'grid', gap: 26 }}>
      <div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', textTransform: 'capitalize' }}>{data}</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 750, letterSpacing: -0.6 }}>
          {atrasadas.length + rotinas.length + doDia.length === 0
            ? 'Nada exigindo você hoje'
            : `${atrasadas.length + rotinas.length + doDia.length} para hoje`}
        </h1>
      </div>

      {atrasadas.length > 0 && (
        <section>
          <TituloSecao extra={<Pill tone="alerta">{atrasadas.length}</Pill>}>Atrasadas</TituloSecao>
          <div style={grade}>
            {atrasadas
              .sort((a, b) => diasDeAtraso(b, ref) - diasDeAtraso(a, ref))
              .map((o) => (
                <Cartao key={o.id} o={o} projeto={proj(o.project_id)} {...acoes} />
              ))}
          </div>
        </section>
      )}

      {rotinas.length > 0 && (
        <section>
          <TituloSecao extra={<Pill tone="accent">{rotinas.length}</Pill>}>Rotinas de hoje</TituloSecao>
          <div style={grade}>
            {rotinas.map((o) => (
              <Cartao key={o.id} o={o} projeto={proj(o.project_id)} {...acoes} />
            ))}
          </div>
        </section>
      )}

      {doDia.length > 0 && (
        <section>
          <TituloSecao>Na agenda</TituloSecao>
          <div style={grade}>
            {doDia.map((o) => (
              <Cartao key={o.id} o={o} projeto={proj(o.project_id)} {...acoes} />
            ))}
          </div>
        </section>
      )}

      {feitasHoje.length > 0 && (
        <section>
          <TituloSecao extra={<Pill tone="ok">{feitasHoje.length}</Pill>}>Fechadas hoje</TituloSecao>
          <div style={grade}>
            {feitasHoje.map((o) => (
              <Cartao key={o.id} o={o} projeto={proj(o.project_id)} {...acoes} />
            ))}
          </div>
        </section>
      )}

      {atrasadas.length + rotinas.length + doDia.length + feitasHoje.length === 0 && (
        <Card>
          <Vazio>
            Nenhuma tarefa com prazo, rotina pendente ou item marcado para a agenda.
            <br />
            Veja o <strong>Quadro</strong> para o resto do material.
          </Vazio>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Quadro

export function Quadro({ objetos, projetos, ...acoes }: BaseProps) {
  const proj = porId(projetos)
  const [filtro, setFiltro] = useState<string>('todos')

  const visiveis = useMemo(
    () => (filtro === 'todos' ? objetos : objetos.filter((o) => o.project_id === filtro)),
    [objetos, filtro],
  )

  return (
    <div>
      <TituloSecao
        extra={
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-1)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              padding: '7px 12px',
              fontSize: 13,
            }}
          >
            <option value="todos">Todos os projetos</option>
            {projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        }
      >
        Quadro
      </TituloSecao>

      {/* Quatro colunas do fluxo real. Não existe coluna "concluído". */}
      <div
        className="scroll"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(255px, 1fr))',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {STATUSES.map((s) => {
          const doStatus = visiveis.filter((o) => o.status === s)
          return (
            <div key={s} style={{ display: 'grid', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '2px 4px',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>{STATUS_LABEL[s]}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                  {doStatus.length}
                </span>
              </div>
              {doStatus.length === 0 ? (
                <Card style={{ padding: 14 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>vazio</span>
                </Card>
              ) : (
                doStatus.map((o) => (
                  <Cartao key={o.id} o={o} projeto={proj(o.project_id)} {...acoes} />
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Rotinas

export function Rotinas({ objetos, projetos, ...acoes }: BaseProps) {
  const ref = hoje()
  const proj = porId(projetos)
  const rotinas = objetos.filter(isRotina)

  const grupos = useMemo(() => {
    const m = new Map<string, SObject[]>()
    for (const o of rotinas) {
      const k = o.recurrence ?? 'outras'
      m.set(k, [...(m.get(k) ?? []), o])
    }
    return [...m.entries()]
  }, [rotinas])

  const pendentes = rotinas.filter((o) => rotinaPendente(o, ref)).length

  if (rotinas.length === 0) {
    return (
      <Card>
        <Vazio>Nenhuma rotina cadastrada. Rotina é um cartão com recorrência.</Vazio>
      </Card>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TituloSecao
        extra={
          pendentes > 0 ? (
            <Pill tone="accent">{pendentes} pendentes hoje</Pill>
          ) : (
            <Pill tone="ok">tudo fechado hoje</Pill>
          )
        }
      >
        Rotinas
      </TituloSecao>

      {grupos.map(([rec, itens]) => (
        <section key={rec}>
          <h3
            style={{
              margin: '0 0 10px',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-2)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {labelRecorrencia(rec)}
          </h3>
          <div style={grade}>
            {itens.map((o) => (
              <Cartao key={o.id} o={o} projeto={proj(o.project_id)} {...acoes} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- Projetos

export function Projetos({
  objetos,
  projetos,
  nomeWorkspace,
}: {
  objetos: SObject[]
  projetos: Project[]
  nomeWorkspace: (id: string | null) => string | undefined
}) {
  const ref = hoje()

  return (
    <div>
      <TituloSecao extra={<Pill>{projetos.length}</Pill>}>Projetos</TituloSecao>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14,
        }}
      >
        {projetos.map((p) => {
          const doProjeto = objetos.filter((o) => o.project_id === p.id)
          const atrasadas = doProjeto.filter((o) => isAtrasada(o, ref)).length
          const itens = doProjeto.reduce(
            (acc, o) => {
              const { feitos, total } = progressoChecklist(o)
              return { feitos: acc.feitos + feitos, total: acc.total + total }
            },
            { feitos: 0, total: 0 },
          )
          const ws = nomeWorkspace(p.workspace_id)

          return (
            <Card key={p.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 99,
                    background: p.color,
                    flexShrink: 0,
                  }}
                />
                <strong style={{ fontSize: 15, lineHeight: 1.35 }}>{p.name}</strong>
              </div>

              {p.description && (
                <p
                  style={{
                    margin: '0 0 12px',
                    fontSize: 12.5,
                    lineHeight: 1.6,
                    color: 'var(--text-2)',
                  }}
                >
                  {p.description}
                </p>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                <Pill>{doProjeto.length} cartões</Pill>
                {atrasadas > 0 && <Pill tone="alerta">{atrasadas} atrasados</Pill>}
                {ws && <Pill tone="violet">{ws}</Pill>}
                {p.deadline && <Pill>prazo {formatarData(p.deadline)}</Pill>}
              </div>

              <Progresso feitos={itens.feitos} total={itens.total} />
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Páginas

export function Paginas({ paginas, projetos }: { paginas: Page[]; projetos: Project[] }) {
  const [abertaId, setAbertaId] = useState<string | null>(null)
  const proj = porId(projetos)

  if (paginas.length === 0) {
    return (
      <Card>
        <Vazio>Nenhuma página.</Vazio>
      </Card>
    )
  }

  return (
    <div>
      <TituloSecao extra={<Pill>{paginas.length}</Pill>}>Páginas</TituloSecao>
      <div style={grade}>
        {paginas.map((g) => {
          const p = proj(g.project_id)
          const aberta = abertaId === g.id
          return (
            <Card key={g.id} onClick={() => setAbertaId(aberta ? null : g.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <strong style={{ fontSize: 14.5 }}>{g.title}</strong>
                {p && <Pill tone="violet">{p.name}</Pill>}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>
                atualizada {formatarData(g.updated_at.slice(0, 10))}
              </div>
              {aberta && (
                <p
                  style={{
                    margin: '12px 0 0',
                    paddingTop: 12,
                    borderTop: '1px solid var(--border)',
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: 'var(--text-2)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {g.content?.trim() ? g.content : 'Página em branco.'}
                </p>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Foco

const DURACAO = 25 * 60

export function Foco({
  objetos,
  projetos,
  onPomodoro,
}: {
  objetos: SObject[]
  projetos: Project[]
  onPomodoro: (id: string, delta: number) => void
}) {
  const proj = porId(projetos)
  const candidatos = objetos.filter((o) => (o.pom_est ?? 0) > 0 || o.eisenhower === 'do')

  const [alvo, setAlvo] = useState<string | null>(candidatos[0]?.id ?? null)
  const [restante, setRestante] = useState(DURACAO)
  const [rodando, setRodando] = useState(false)
  const jaContou = useRef(false)

  useEffect(() => {
    if (!rodando) return
    const t = setInterval(() => setRestante((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(t)
  }, [rodando])

  // Ao chegar a zero, credita um pomodoro — uma vez só, mesmo com re-render.
  useEffect(() => {
    if (restante === 0 && rodando && alvo && !jaContou.current) {
      jaContou.current = true
      setRodando(false)
      onPomodoro(alvo, 1)
    }
  }, [restante, rodando, alvo, onPomodoro])

  const mm = String(Math.floor(restante / 60)).padStart(2, '0')
  const ss = String(restante % 60).padStart(2, '0')
  const escolhido = objetos.find((o) => o.id === alvo)

  function reiniciar() {
    jaContou.current = false
    setRestante(DURACAO)
    setRodando(false)
  }

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 620 }}>
      <TituloSecao>Foco</TituloSecao>

      <Card style={{ textAlign: 'center', padding: 30 }}>
        <div
          style={{
            fontSize: 62,
            fontWeight: 750,
            letterSpacing: -2,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {mm}:{ss}
        </div>
        {escolhido && (
          <div style={{ marginTop: 10, fontSize: 13.5, color: 'var(--text-2)' }}>
            {escolhido.title}
            {(escolhido.pom_est ?? 0) > 0 && (
              <span style={{ color: 'var(--text-3)' }}>
                {' '}
                · {escolhido.pom_done ?? 0}/{escolhido.pom_est}
              </span>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
          <Botao
            variante="principal"
            disabled={!alvo}
            onClick={() => {
              jaContou.current = false
              setRodando((v) => !v)
            }}
          >
            {rodando ? 'Pausar' : restante === DURACAO ? 'Começar' : 'Continuar'}
          </Botao>
          <Botao onClick={reiniciar}>Reiniciar</Botao>
        </div>
        {!alvo && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text-3)' }}>
            Escolha um cartão abaixo para creditar o foco.
          </div>
        )}
      </Card>

      <div>
        <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
          No que focar
        </h3>
        {candidatos.length === 0 ? (
          <Card>
            <Vazio>Nenhum cartão com estimativa de foco ou marcado como “faça agora”.</Vazio>
          </Card>
        ) : (
          <div style={grade}>
            {candidatos.map((o) => {
              const p = proj(o.project_id)
              const ativo = o.id === alvo
              return (
                <Card
                  key={o.id}
                  onClick={() => {
                    setAlvo(o.id)
                    reiniciar()
                  }}
                  style={{
                    padding: 14,
                    outline: ativo ? '2px solid var(--accent)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{o.title}</span>
                    {(o.pom_est ?? 0) > 0 && (
                      <Pill>
                        {o.pom_done ?? 0}/{o.pom_est}
                      </Pill>
                    )}
                  </div>
                  {p && (
                    <div style={{ marginTop: 8 }}>
                      <Pill tone="violet">{p.name}</Pill>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
