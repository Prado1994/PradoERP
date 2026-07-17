import type { CrmStore } from '../hooks/useCrmStore'
import { viewTitles } from '../data'
import { BellIcon, PlusIcon, SearchIcon } from './icons'

export function Topbar({ store }: { store: CrmStore }) {
  const view = store.currentView
  const [title, subtitle] = viewTitles[view] ?? ['', '']

  const showSearch = view === 'contacts' || view === 'pipeline' || view === 'inbox'
  const showPrimary = view === 'pipeline' || view === 'contacts'

  let searchPlaceholder = ''
  let searchValue = ''
  let onSearchChange: (v: string) => void = () => {}
  if (view === 'contacts') {
    searchPlaceholder = 'Buscar contatos ou empresas...'
    searchValue = store.contactSearch
    onSearchChange = store.setContactSearch
  } else if (view === 'pipeline') {
    searchPlaceholder = 'Buscar negócios...'
    searchValue = store.dealSearch
    onSearchChange = store.setDealSearch
  } else if (view === 'inbox') {
    searchPlaceholder = 'Buscar e-mails...'
    searchValue = store.emailSearch
    onSearchChange = store.setEmailSearch
  }

  const primaryLabel = view === 'pipeline' ? 'Novo negócio' : 'Novo contato'
  const primaryFn = view === 'pipeline' ? store.addDeal : store.addContact

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '16px 28px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.3px' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 1 }}>{subtitle}</div>
      </div>

      {showSearch && (
        <div style={{ flex: 1, maxWidth: 420, position: 'relative', marginLeft: 8 }}>
          <SearchIcon style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            style={{
              width: '100%',
              padding: '9px 14px 9px 36px',
              borderRadius: 11,
              border: '1px solid var(--border)',
              background: 'var(--bg-app)',
              color: 'var(--text-1)',
              fontSize: 13.5,
              outline: 'none',
            }}
          />
        </div>
      )}

      <div style={{ flex: 1 }} />

      {showPrimary && (
        <button
          onClick={primaryFn}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 13.5,
            cursor: 'pointer',
            transition: 'opacity .15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <PlusIcon />
          {primaryLabel}
        </button>
      )}

      <button
        style={{
          background: 'none',
          border: '1px solid var(--border)',
          borderRadius: 11,
          padding: 9,
          cursor: 'pointer',
          color: 'var(--text-2)',
          position: 'relative',
        }}
      >
        <BellIcon />
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--accent)',
            border: '1.5px solid var(--bg-elevated)',
          }}
        />
      </button>
    </header>
  )
}
