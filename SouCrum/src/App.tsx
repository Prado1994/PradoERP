import { useCrmStore } from './hooks/useCrmStore'
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
  const view = store.currentView
  const placeholder = placeholderContent[view]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', minWidth: 1024, background: 'var(--bg-app)', ...cssVars(store.darkMode) }}>
      <Sidebar store={store} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
        <Topbar store={store} />

        <main style={{ flex: 1, overflow: 'auto', padding: '26px 30px', background: 'var(--bg-app)' }}>
          {view === 'dashboard' && <DashboardView store={store} />}
          {view === 'inbox' && <InboxView store={store} />}
          {view === 'pipeline' && <PipelineView store={store} />}
          {view === 'contacts' && <ContactsView store={store} />}
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
