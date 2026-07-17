import type { CrmStore } from '../../hooks/useCrmStore'
import { stageDefs } from '../../data'

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: 'var(--card-border)',
  boxShadow: 'var(--card-shadow)',
  borderRadius: 18,
}

export function DashboardView({ store }: { store: CrmStore }) {
  const dark = store.darkMode
  const green = dark ? '#5FD9A6' : '#2F8F63'
  const red = dark ? '#FF8FA3' : '#E0345A'

  const kpis = [
    { label: 'Receita do mês', value: 'R$ 148.200', up: true, trendLabel: '+12%', trendColor: green },
    { label: 'Negócios fechados', value: '27', up: true, trendLabel: '+4', trendColor: green },
    { label: 'Taxa de conversão', value: '34%', up: true, trendLabel: '+2%', trendColor: green },
    { label: 'Novos leads', value: '63', up: false, trendLabel: '-3', trendColor: red },
  ]

  const monthlyRaw = [
    { month: 'Fev', value: 38 },
    { month: 'Mar', value: 52 },
    { month: 'Abr', value: 41 },
    { month: 'Mai', value: 60 },
    { month: 'Jun', value: 55 },
    { month: 'Jul', value: 71 },
  ]
  const maxM = Math.max(...monthlyRaw.map((m) => m.value))

  const stages = stageDefs(dark)
  const totalDeals = store.deals.length
  const stageSummary = stages.map((s) => {
    const count = store.deals.filter((d) => d.stageId === s.id).length
    return { ...s, count, pct: totalDeals ? Math.round((count / totalDeals) * 100) : 0 }
  })

  const activity = [
    { color: 'var(--accent-strong)', text: 'Negócio criado: TechNova · Add-on de API', time: 'há 20min' },
    { color: 'var(--violet)', text: 'Você respondeu Camila Rocha (Órbita Digital)', time: 'há 1h' },
    { color: green, text: 'Negócio movido para Fechado: Vértice Software', time: 'ontem' },
    { color: dark ? '#5FD1CE' : '#2E9D9A', text: 'Novo contato adicionado: Pedro Lima (Cursor Data)', time: 'ontem' },
    { color: dark ? '#FFC469' : '#C98315', text: 'Proposta enviada para NimbusCloud', time: '2 dias' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeUp .25s ease' }}>
      {/* KPI row */}
      <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
        {kpis.map((kpi, i) => (
          <div key={kpi.label} style={{ padding: '20px 22px', borderRight: i === kpis.length - 1 ? 'none' : '1px solid var(--border)' }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>{kpi.label}</div>
            <div style={{ fontSize: 25, fontWeight: 800, color: 'var(--text-1)', marginTop: 8, letterSpacing: '-0.5px' }}>{kpi.value}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 12.5, fontWeight: 700, color: kpi.trendColor }}>
              <svg width="9" height="10" viewBox="0 0 10 10">
                <path d={kpi.up ? 'M5 1l4 8H1z' : 'M5 9L1 1h8z'} fill="currentColor" />
              </svg>
              <span>{kpi.trendLabel}</span>
              <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>vs. mês ant.</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + pipeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18 }}>
        <div style={{ ...cardStyle, padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>Negócios fechados por mês</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 20 }}>Últimos 6 meses</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 170, flex: 1 }}>
            {monthlyRaw.map((m, i) => (
              <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)' }}>{m.value}</div>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 38,
                    height: `${Math.round((m.value / maxM) * 100)}%`,
                    background: i === monthlyRaw.length - 1 ? 'var(--accent)' : 'var(--bg-hover)',
                    borderRadius: '8px 8px 4px 4px',
                  }}
                />
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>{m.month}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>Pipeline por estágio</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {stageSummary.map((s) => (
              <div key={s.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</span>
                  <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>{s.count}</span>
                </div>
                <div style={{ height: 7, borderRadius: 5, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 5 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ ...cardStyle, padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 18 }}>Atividade recente</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {activity.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, marginTop: 4, flexShrink: 0 }} />
                {i !== activity.length - 1 && <span style={{ width: 1.5, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: 18, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{a.text}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', flexShrink: 0 }}>{a.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
