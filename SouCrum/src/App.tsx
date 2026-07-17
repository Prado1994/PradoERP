import { useCrmStore } from './hooks/useCrmStore'
import { useIsMobile } from './hooks/useIsMobile'
import { rootVars } from './theme'
import { placeholderContent } from './data'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { DashboardView } from './components/views/DashboardView'
import { InboxView } from './components/views/InboxView'
import { PipelineView } from './components/views/PipelineView'
import { ContactsView } from './components/views/ContactsView'
import { SettingsView } from './components/views/SettingsView'
import { PlaceholderView } from './components/views/PlaceholderView'

export function App() {
  const store = useCrmStore()
  const isMobile = useIsMobile()
  const view = store.currentView
  const placeholder = placeholderContent[view]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-app)', ...cssVars(store.darkMode) }}>
      {isMobile ? (
        <>
          {store.mobileNavOpen && (
            <div
              onClick={store.closeMobileNav}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 40 }}
            />
          )}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              zIndex: 50,
              transform: store.mobileNavOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform .2s ease',
            }}
          >
            <Sidebar store={store} isMobile />
          </div>
        </>
      ) : (
        <Sidebar store={store} />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
        <Topbar store={store} isMobile={isMobile} />

        <main style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px 14px' : '26px 30px', background: 'var(--bg-app)' }}>
          {view === 'dashboard' && <DashboardView store={store} isMobile={isMobile} />}
          {view === 'inbox' && <InboxView store={store} isMobile={isMobile} />}
          {view === 'pipeline' && <PipelineView store={store} />}
          {view === 'contacts' && <ContactsView store={store} isMobile={isMobile} />}
          {view === 'settings' && <SettingsView store={store} />}
          {placeholder && <PlaceholderView emoji={placeholder[0]} title={placeholder[1]} subtitle={placeholder[2]} />}
        </main>
      </div>
    </div>
  )
}

/** Parses the CSS-variable string into a style object so it applies to the root. */
function cssVars(dark: boolean): React.CSSProperties {
  const style: Record<string, string> = {}
  for (const decl of rootVars(dark).split(';')) {
    const [k, v] = decl.split(':')
    if (k?.startsWith('--')) style[k] = v
  }
  return style as React.CSSProperties
}
