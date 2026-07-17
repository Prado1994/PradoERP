import type { CSSProperties, ReactNode } from 'react'
import type { CrmStore } from '../hooks/useCrmStore'
import type { ViewId } from '../types'
import {
  BoardIcon,
  CalendarIcon,
  ChartIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ClockIcon,
  CubeIcon,
  DocIcon,
  FolderIcon,
  GearIcon,
  InboxIcon,
  MoonIcon,
  RefreshIcon,
  SunIcon,
  TargetIcon,
  TrendUpIcon,
  UsersIcon,
} from './icons'

interface NavItem {
  id: ViewId
  label: string
  icon: (p: { size?: number; style?: CSSProperties }) => ReactNode
  badge?: boolean
}

const navItems: NavItem[] = [
  { id: 'inbox', label: 'Caixa de Entrada', icon: InboxIcon, badge: true },
  { id: 'hoje', label: 'Hoje', icon: ClockIcon },
  { id: 'pipeline', label: 'Quadro', icon: BoardIcon },
  { id: 'contacts', label: 'Contatos', icon: UsersIcon },
  { id: 'projetos', label: 'Projetos', icon: FolderIcon },
  { id: 'documentos', label: 'Documentos', icon: DocIcon },
  { id: 'materiais', label: 'Materiais', icon: CubeIcon },
  { id: 'dashboard', label: 'Meu Painel', icon: ChartIcon },
  { id: 'calendario', label: 'Calendário', icon: CalendarIcon },
  { id: 'foco', label: 'Foco', icon: TargetIcon },
  { id: 'relatorios', label: 'Relatórios', icon: TrendUpIcon },
  { id: 'rotinas', label: 'Rotinas', icon: RefreshIcon },
  { id: 'settings', label: 'Configurações', icon: GearIcon },
]

function navStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    margin: '1px 12px',
    borderRadius: 11,
    cursor: 'pointer',
    fontSize: 13.5,
    fontWeight: active ? 700 : 500,
    background: active ? 'var(--text-1)' : 'transparent',
    color: active ? 'var(--bg-card)' : 'var(--text-2)',
    transition: 'background .15s ease',
  }
}

export function Sidebar({ store }: { store: CrmStore }) {
  const collapsed = store.sidebarCollapsed
  const showLabels = !collapsed
  const unreadCount = store.emails.filter((e) => e.unread).length

  return (
    <aside
      style={{
        width: collapsed ? 76 : 244,
        flexShrink: 0,
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 0 16px',
        height: '100vh',
        overflow: 'hidden',
        transition: 'width .18s ease',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, padding: '0 16px', marginBottom: 20 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'var(--violet)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          S
        </div>
        {showLabels && (
          <span style={{ fontWeight: 800, fontSize: 16.5, letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', color: 'var(--text-1)' }}>
            SouCrum
          </span>
        )}
      </div>

      {/* Workspace switcher */}
      <div
        style={{
          margin: '0 16px 14px',
          padding: '9px 12px',
          border: '1px solid var(--border)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          cursor: 'pointer',
          background: 'var(--bg-app)',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--violet)', flexShrink: 0 }} />
        {showLabels && (
          <>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Minha Empresa
            </span>
            <ChevronDownIcon style={{ color: 'var(--text-3)' }} />
          </>
        )}
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {navItems.map((item) => {
          const active = store.currentView === item.id
          const Icon = item.icon
          return (
            <div
              key={item.id}
              onClick={() => store.goTo(item.id)}
              style={navStyle(active)}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent'
              }}
            >
              <Icon />
              {showLabels && <span style={{ whiteSpace: 'nowrap', flex: 1 }}>{item.label}</span>}
              {item.badge && unreadCount > 0 && showLabels && (
                <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>
                  {unreadCount}
                </span>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '14px 16px 0', borderTop: '1px solid var(--border)', marginTop: 10 }}>
        <div
          onClick={store.toggleDark}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 10, cursor: 'pointer', color: 'var(--text-2)' }}
        >
          {store.darkMode ? <SunIcon /> : <MoonIcon />}
          {showLabels && (
            <span style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap' }}>
              {store.darkMode ? 'Modo escuro' : 'Modo claro'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px' }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: 'var(--violet-soft)',
              color: 'var(--violet)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 12.5,
              flexShrink: 0,
            }}
          >
            VC
          </div>
          {showLabels && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Você</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Admin</div>
            </div>
          )}
        </div>

        <div
          onClick={store.toggleSidebar}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 10, cursor: 'pointer', color: 'var(--text-3)', marginTop: 2 }}
        >
          <ChevronLeftIcon style={{ transform: collapsed ? 'rotate(180deg)' : undefined }} />
          {showLabels && <span style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap' }}>Recolher</span>}
        </div>
      </div>
    </aside>
  )
}
