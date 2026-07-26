import { useState } from 'react'
import { Botao, Card, Pill, Progresso } from './ui'
import {
  diasDeAtraso,
  formatarData,
  hoje,
  isAtrasada,
  isRotina,
  labelRecorrencia,
  progressoChecklist,
} from './domain'
import { EISENHOWER_LABEL, STATUS_LABEL, type Eisenhower, type Project, type SObject, type Status } from './types'

interface Props {
  o: SObject
  projeto?: Project
  onStatus: (id: string, s: string) => void
  onConcluirHoje: (id: string) => void
  onReabrirHoje: (id: string) => void
  onItem: (id: string, itemId: string) => void
  onAgenda: (id: string) => void
  onPomodoro: (id: string, delta: number) => void
}

export function Cartao({
  o,
  projeto,
  onStatus,
  onConcluirHoje,
  onReabrirHoje,
  onItem,
  onAgenda,
  onPomodoro,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const ref = hoje()
  const atrasada = isAtrasada(o, ref)
  const rotina = isRotina(o)
  const fechadaHoje = rotina && o.last_done === ref
  const { feitos, total } = progressoChecklist(o)
  const comentarios = o.comments ?? []

  return (
    <Card style={{ padding: 16 }}>
      {/* Faixa de projeto: liga o cartão ao projeto sem gastar linha de texto. */}
      {projeto && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 14,
            bottom: 14,
            width: 3,
            borderRadius: 99,
            background: projeto.color,
          }}
        />
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <button
          onClick={() => setAberto((v) => !v)}
          style={{ flex: 1, textAlign: 'left', padding: 0 }}
        >
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              lineHeight: 1.4,
              textDecoration: fechadaHoje ? 'line-through' : undefined,
              opacity: fechadaHoje ? 0.55 : 1,
            }}
          >
            {o.title}
          </div>
        </button>

        {rotina &&
          (fechadaHoje ? (
            <Botao variante="texto" onClick={() => onReabrirHoje(o.id)} style={{ fontSize: 12 }}>
              desfazer
            </Botao>
          ) : (
            <Botao variante="principal" onClick={() => onConcluirHoje(o.id)} style={{ padding: '6px 12px', fontSize: 12 }}>
              Concluir hoje
            </Botao>
          ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {projeto && <Pill tone="violet">{projeto.name}</Pill>}
        {o.area && !projeto && <Pill>{o.area}</Pill>}

        {rotina && (
          <Pill tone={fechadaHoje ? 'ok' : 'accent'}>
            {labelRecorrencia(o.recurrence)}
            {fechadaHoje ? ' · feita hoje' : ''}
          </Pill>
        )}

        {atrasada && (
          <Pill tone="alerta" title={`Vencia em ${formatarData(o.due_date)}`}>
            {diasDeAtraso(o, ref)}d de atraso
          </Pill>
        )}

        {!atrasada && o.due_date && (
          <Pill tone={o.due_date === ref ? 'accent' : 'neutro'}>
            {o.due_date === ref ? 'hoje' : formatarData(o.due_date)}
          </Pill>
        )}

        {o.eisenhower && <Pill>{EISENHOWER_LABEL[o.eisenhower as Eisenhower] ?? o.eisenhower}</Pill>}

        {(o.pom_est ?? 0) > 0 && (
          <Pill title="Pomodoros feitos de estimados">
            {o.pom_done ?? 0}/{o.pom_est} foco
          </Pill>
        )}

        {o.assignee && <Pill>{o.assignee.split('@')[0]}</Pill>}
        {comentarios.length > 0 && <Pill>{comentarios.length} coment.</Pill>}
      </div>

      {total > 0 && (
        <div style={{ marginTop: 12 }}>
          <Progresso feitos={feitos} total={total} />
        </div>
      )}

      {aberto && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {o.body && (
            <p
              style={{
                margin: '0 0 12px',
                fontSize: 13,
                lineHeight: 1.65,
                color: 'var(--text-2)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {o.body}
            </p>
          )}

          {total > 0 && (
            <div style={{ display: 'grid', gap: 7, marginBottom: 12 }}>
              {(o.checklist ?? []).map((i) => (
                <label
                  key={i.id}
                  style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: 'pointer', fontSize: 13 }}
                >
                  <input
                    type="checkbox"
                    checked={i.done}
                    onChange={() => onItem(o.id, i.id)}
                    style={{ marginTop: 2, accentColor: 'var(--accent)' }}
                  />
                  <span
                    style={{
                      color: i.done ? 'var(--text-3)' : 'var(--text-1)',
                      textDecoration: i.done ? 'line-through' : undefined,
                      lineHeight: 1.5,
                    }}
                  >
                    {i.text}
                    {i.due && (
                      <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}> · {formatarData(i.due)}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}

          {comentarios.length > 0 && (
            <div style={{ display: 'grid', gap: 9, marginBottom: 12 }}>
              {comentarios.map((c) => (
                <div key={c.id} style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                  <strong style={{ color: 'var(--accent-strong)' }}>{c.author.split('@')[0]}</strong>
                  <span style={{ color: 'var(--text-2)' }}> · {c.text}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {/* Sem 'done': mover status é o que o modelo real permite. */}
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <Botao
                key={s}
                variante={o.status === s ? 'principal' : 'suave'}
                onClick={() => onStatus(o.id, s)}
                style={{ padding: '5px 11px', fontSize: 12 }}
              >
                {STATUS_LABEL[s]}
              </Botao>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <Botao variante="texto" onClick={() => onAgenda(o.id)} style={{ fontSize: 12 }}>
              {o.show_in_agenda ? '− tirar da agenda' : '+ pôr na agenda'}
            </Botao>
            {(o.pom_est ?? 0) > 0 && (
              <>
                <Botao variante="texto" onClick={() => onPomodoro(o.id, 1)} style={{ fontSize: 12 }}>
                  +1 foco
                </Botao>
                {(o.pom_done ?? 0) > 0 && (
                  <Botao variante="texto" onClick={() => onPomodoro(o.id, -1)} style={{ fontSize: 12 }}>
                    −1
                  </Botao>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
