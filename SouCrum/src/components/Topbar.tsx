import type { CrmStore } from '../hooks/useCrmStore'
import { viewTitles } from '../data'
import { BellIcon, PlusIcon, SearchIcon } from './icons'

/**
 * Título com peso misto: a primeira palavra leve e apagada, o resto forte.
 * É o mesmo recurso tipográfico do visual de referência ("Professional **Match
 * Insights**"). Título de uma palavra só fica forte, sem inventar contraste.
 */
function DisplayTitle({ text }: { text: string }) {
  const espaco = text.indexOf(' ')
  const base = { fontSize: 21, letterSpacing: '-0.5px', color: 'var(--text-1)', lineHeight: 1.15 }
  if (espaco < 0) return <div style={{ ...base, fontWeight: 800 }}>{text}</div>
  return (
    <div style={base}>
      <span style={{ fontWeight: 300, color: 'var(--text-2)' }}>{text.slice(0, espaco)} </span>
      <span style={{ fontWeight: 800 }}>{text.slice(espaco + 1)}</span>
    </div>
  )
}

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
        backdropFilter: 'var(--blur)',
        WebkitBackdropFilter: 'var(--blur)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <DisplayTitle text={title} />
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
              padding: '10px 16px 10px 38px',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
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
            background: 'var(--brand-gradient)',
            color: '#fff',
            border: 'none',
            padding: '11px 20px',
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 13.5,
            cursor: 'pointer',
            boxShadow: '0 12px 28px -12px var(--accent-shadow)',
            transition: 'transform .15s ease, box-shadow .15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 16px 34px -12px var(--accent-shadow)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 12px 28px -12px var(--accent-shadow)'
          }}
        >
          <PlusIcon />
          {primaryLabel}
        </button>
      )}

      <button
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '50%',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-2)',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <BellIcon />
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 8px var(--accent-shadow)',
          }}
        />
      </button>
    </header>
  )
}
