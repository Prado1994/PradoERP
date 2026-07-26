import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { rootVars } from './theme'
import { useDados } from './store'
import { Auth } from './Auth'
import { Botao, Pill } from './ui'
import { Foco, Hoje, Paginas, Projetos, Quadro, Rotinas } from './views'
import { hoje, isAtrasada, rotinaPendente } from './domain'
import type { ViewName } from './types'

const MENU: { id: ViewName; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'quadro', label: 'Quadro' },
  { id: 'rotinas', label: 'Rotinas' },
  { id: 'projetos', label: 'Projetos' },
  { id: 'paginas', label: 'Páginas' },
  { id: 'foco', label: 'Foco' },
]

export function App() {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [pronto, setPronto] = useState(false)
  const [escuro, setEscuro] = useState(true)
  const [view, setView] = useState<ViewName>('hoje')

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setPronto(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const vars = rootVars(escuro)

  if (!pronto) {
    return (
      <div style={{ minHeight: '100vh' }} className="glow-fixed">
        <style>{`:root{${vars}}`}</style>
      </div>
    )
  }

  return (
    <div className="glow-fixed" style={{ minHeight: '100vh' }}>
      <style>{`:root{${vars}}`}</style>
      {sessao ? (
        <Interno
          sessao={sessao}
          view={view}
          setView={setView}
          escuro={escuro}
          setEscuro={setEscuro}
        />
      ) : (
        <Auth />
      )}
    </div>
  )
}

function Interno({
  sessao,
  view,
  setView,
  escuro,
  setEscuro,
}: {
  sessao: Session
  view: ViewName
  setView: (v: ViewName) => void
  escuro: boolean
  setEscuro: (v: boolean) => void
}) {
  const d = useDados(sessao.user.id)
  const ref = hoje()

  const pendencias =
    d.objetos.filter((o) => isAtrasada(o, ref)).length +
    d.objetos.filter((o) => rotinaPendente(o, ref)).length

  const nomeWorkspace = (id: string | null) => d.workspaces.find((w) => w.id === id)?.name

  const acoes = {
    onStatus: d.mudarStatus,
    onConcluirHoje: d.concluirHoje,
    onReabrirHoje: d.reabrirHoje,
    onItem: d.alternarItem,
    onAgenda: d.alternarAgenda,
    onPomodoro: (id: string, delta: number) => void d.somarPomodoro(id, delta),
  }

  const nome =
    (sessao.user.user_metadata?.full_name as string | undefined) ??
    sessao.user.email?.split('@')[0] ??
    'você'

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
      {/* Topo */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--bg-elevated)',
          backdropFilter: 'var(--blur)',
          WebkitBackdropFilter: 'var(--blur)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              background: 'var(--brand-gradient)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            S
          </span>
          <strong style={{ fontSize: 15.5, letterSpacing: -0.3 }}>SouCrum</strong>
          <Pill tone="violet">v6.1</Pill>
          {pendencias > 0 && <Pill tone="alerta">{pendencias}</Pill>}
        </div>

        <nav
          className="scroll"
          style={{ display: 'flex', gap: 4, marginLeft: 'auto', overflowX: 'auto', maxWidth: '100%' }}
        >
          {MENU.map((m) => (
            <button
              key={m.id}
              onClick={() => setView(m.id)}
              style={{
                padding: '7px 13px',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                background: view === m.id ? 'var(--text-1)' : 'transparent',
                color: view === m.id ? 'var(--on-invert)' : 'var(--text-2)',
              }}
            >
              {m.label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Botao variante="texto" onClick={() => setEscuro(!escuro)} title="Alternar tema">
            {escuro ? '☀' : '☾'}
          </Botao>
          <Botao variante="texto" onClick={() => void d.recarregar()}>
            ↻
          </Botao>
          <span style={{ fontSize: 12.5, color: 'var(--text-2)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nome}
          </span>
          <Botao variante="texto" onClick={() => void supabase.auth.signOut()}>
            sair
          </Botao>
        </div>
      </header>

      <main style={{ padding: '24px 20px 60px', maxWidth: 1180, margin: '0 auto' }}>
        {d.erro && (
          <div
            style={{
              marginBottom: 18,
              padding: 14,
              borderRadius: 14,
              background: 'var(--accent-soft)',
              color: 'var(--accent-strong)',
              fontSize: 13,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <span>{d.erro}</span>
            <Botao variante="texto" onClick={d.limparErro}>
              ✕
            </Botao>
          </div>
        )}

        {d.carregando ? (
          <div style={{ padding: 50, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            Carregando…
          </div>
        ) : (
          <>
            {view === 'hoje' && <Hoje objetos={d.objetos} projetos={d.projetos} {...acoes} />}
            {view === 'quadro' && <Quadro objetos={d.objetos} projetos={d.projetos} {...acoes} />}
            {view === 'rotinas' && <Rotinas objetos={d.objetos} projetos={d.projetos} {...acoes} />}
            {view === 'projetos' && (
              <Projetos objetos={d.objetos} projetos={d.projetos} nomeWorkspace={nomeWorkspace} />
            )}
            {view === 'paginas' && <Paginas paginas={d.paginas} projetos={d.projetos} />}
            {view === 'foco' && (
              <Foco objetos={d.objetos} projetos={d.projetos} onPomodoro={acoes.onPomodoro} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
