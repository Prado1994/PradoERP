import type { CrmStore } from '../../hooks/useCrmStore'
import type { NotifSettings } from '../../hooks/useCrmStore'
import { colorMap } from '../../theme'
import { McpSettings } from './McpSettings'

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: 'var(--card-border)',
  boxShadow: 'var(--card-shadow)',
  borderRadius: 18,
  padding: 24,
}

const fieldStyle: React.CSSProperties = {
  padding: '10px 13px',
  border: '1px solid var(--border)',
  borderRadius: 11,
  fontSize: 13.5,
  color: 'var(--text-1)',
  background: 'var(--bg-app)',
}

export function SettingsView({ store }: { store: CrmStore }) {
  const dark = store.darkMode

  const notifRows: { key: keyof NotifSettings; label: string; desc: string }[] = [
    { key: 'email', label: 'E-mails de novas mensagens', desc: 'Receba um e-mail quando um contato responder' },
    { key: 'deals', label: 'Atualizações de negócios', desc: 'Avisos quando um negócio muda de estágio' },
    { key: 'weekly', label: 'Resumo semanal', desc: 'Relatório de desempenho toda segunda-feira' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760, animation: 'fadeUp .25s ease' }}>
      {/* Profile */}
      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>Perfil</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Nome</div>
            <div style={fieldStyle}>Você</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>E-mail</div>
            <div style={fieldStyle}>voce@soucrum.com</div>
          </div>
          <div style={{ gridColumn: '1/3' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Empresa</div>
            <div style={fieldStyle}>SouCrum</div>
          </div>
        </div>
      </div>

      {/* Team */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Equipe</div>
          <button
            onClick={store.addMember}
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)', border: 'none', padding: '8px 16px', borderRadius: 999, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(0.95)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
          >
            + Convidar
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {store.team.map((m) => {
            const [bg, fg] = colorMap(m.color, dark)
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 4px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>
                  {m.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)' }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.email}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', background: 'var(--bg-hover)', padding: '4px 12px', borderRadius: 20 }}>{m.role}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Notifications */}
      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>Notificações</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {notifRows.map((n) => {
            const on = store.notif[n.key]
            return (
              <div key={n.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 4px', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)' }}>{n.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{n.desc}</div>
                </div>
                <div
                  onClick={() => store.toggleNotif(n.key)}
                  style={{ width: 40, height: 23, borderRadius: 20, background: on ? 'var(--accent)' : 'var(--bg-hover)', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background .15s ease' }}
                >
                  <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 20 : 3, transition: 'left .15s ease', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Plan */}
      {/* MCP — integração com assistentes de IA */}
      <McpSettings />

      <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Plano Pro</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>1.240 de 2.000 contatos utilizados</div>
          <div style={{ width: 220, height: 7, borderRadius: 5, background: 'var(--bg-hover)', marginTop: 10, overflow: 'hidden' }}>
            <div style={{ width: '62%', height: '100%', background: 'var(--accent)', borderRadius: 5 }} />
          </div>
        </div>
        <button
          style={{ background: 'var(--text-1)', color: 'var(--bg-card)', border: 'none', padding: '11px 20px', borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Gerenciar plano
        </button>
      </div>
    </div>
  )
}
