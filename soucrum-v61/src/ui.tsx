import type { CSSProperties, ReactNode } from 'react'

/** Peças visuais reaproveitadas. Estilo inline lendo as CSS vars do tema. */

export function Card({
  children,
  style,
  onClick,
}: {
  children: ReactNode
  style?: CSSProperties
  onClick?: () => void
}) {
  return (
    <div
      className={onClick ? 'glass lift' : 'glass'}
      onClick={onClick}
      style={{ padding: 18, position: 'relative', cursor: onClick ? 'pointer' : undefined, ...style }}
    >
      {children}
    </div>
  )
}

export function Pill({
  children,
  tone = 'neutro',
  title,
}: {
  children: ReactNode
  tone?: 'neutro' | 'accent' | 'violet' | 'alerta' | 'ok'
  title?: string
}) {
  const tons: Record<string, CSSProperties> = {
    neutro: { background: 'var(--bg-hover)', color: 'var(--text-2)' },
    accent: { background: 'var(--accent-soft)', color: 'var(--accent-strong)' },
    violet: { background: 'var(--violet-soft)', color: 'var(--violet)' },
    alerta: { background: 'rgba(255,140,0,.18)', color: '#FFB55C' },
    ok: { background: 'rgba(46,224,154,.16)', color: '#4FE0A6' },
  }
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        ...tons[tone],
      }}
    >
      {children}
    </span>
  )
}

export function Botao({
  children,
  onClick,
  variante = 'suave',
  disabled,
  style,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  variante?: 'principal' | 'suave' | 'texto'
  disabled?: boolean
  style?: CSSProperties
  title?: string
}) {
  const base: CSSProperties = {
    padding: '9px 16px',
    borderRadius: 999,
    fontSize: 13.5,
    fontWeight: 600,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'default' : 'pointer',
  }
  const v: Record<string, CSSProperties> = {
    principal: {
      background: 'var(--brand-gradient)',
      color: '#fff',
      boxShadow: '0 10px 24px -12px var(--accent-shadow)',
    },
    suave: { background: 'var(--bg-hover)', color: 'var(--text-1)' },
    texto: { padding: '6px 8px', color: 'var(--text-2)' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{ ...base, ...v[variante], ...style }}
    >
      {children}
    </button>
  )
}

export function TituloSecao({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 14,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>{children}</h2>
      {extra}
    </div>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '36px 20px',
        textAlign: 'center',
        color: 'var(--text-3)',
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  )
}

/** Barra fina de progresso — usada no checklist e no pomodoro. */
export function Progresso({ feitos, total }: { feitos: number; total: number }) {
  if (total === 0) return null
  const pct = Math.round((feitos / total) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 5,
          borderRadius: 99,
          background: 'var(--bg-hover)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: pct === 100 ? '#4FE0A6' : 'var(--brand-gradient)',
          }}
        />
      </div>
      <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>
        {feitos}/{total}
      </span>
    </div>
  )
}
