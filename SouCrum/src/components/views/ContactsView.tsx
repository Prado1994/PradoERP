import type { CSSProperties } from 'react'
import type { CrmStore } from '../../hooks/useCrmStore'
import type { Contact } from '../../types'
import { colorMap } from '../../theme'
import { fmt } from '../../utils'
import { CloseIcon, MailIcon, PhoneIcon } from '../icons'

function tagStyle(contact: Contact, dark: boolean): CSSProperties {
  const [bg, fg] = colorMap(contact.tag === 'Cliente' ? 'success' : 'warn', dark)
  return { fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: bg, color: fg }
}

export function ContactsView({ store, isMobile = false }: { store: CrmStore; isMobile?: boolean }) {
  const dark = store.darkMode
  const gridCols = isMobile ? '1fr auto' : '2fr 1.4fr 1fr 0.9fr 0.9fr'
  const q = store.contactSearch.toLowerCase()
  const filtered = store.contacts.filter((c) => (c.name + c.company).toLowerCase().includes(q))
  const selected = store.contacts.find((c) => c.id === store.selectedContactId) ?? null
  const dealsCount = (id: string) => store.deals.filter((d) => d.contactId === id).length

  return (
    <div style={{ position: 'relative', height: '100%', animation: 'fadeUp .25s ease' }}>
      <div style={{ background: 'var(--bg-card)', border: 'var(--card-border)', boxShadow: 'var(--card-shadow)', borderRadius: 18, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: gridCols,
            padding: '14px 22px',
            borderBottom: '1px solid var(--border)',
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--text-3)',
            textTransform: 'uppercase',
            letterSpacing: '.04em',
          }}
        >
          <span>Nome</span>
          {!isMobile && <span>Empresa</span>}
          <span>Tag</span>
          {!isMobile && (
            <>
              <span>Status</span>
              <span>Negócios</span>
            </>
          )}
        </div>

        {filtered.map((c) => {
          const [bg, fg] = colorMap(c.color, dark)
          return (
            <div
              key={c.id}
              onClick={() => store.selectContact(c.id)}
              style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', padding: '14px 22px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .1s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {c.initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  {isMobile && <div style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.company}</div>}
                </div>
              </div>
              {!isMobile && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{c.company}</span>}
              <span>
                <span style={tagStyle(c, dark)}>{c.tag}</span>
              </span>
              {!isMobile && (
                <>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{c.status}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{dealsCount(c.id)}</span>
                </>
              )}
            </div>
          )
        })}
      </div>

      {selected && (
        <div
          style={{
            position: isMobile ? 'fixed' : 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: isMobile ? 0 : undefined,
            width: isMobile ? '100%' : 380,
            zIndex: isMobile ? 60 : 1,
            background: 'var(--bg-card)',
            borderRadius: isMobile ? 0 : 18,
            boxShadow: '-12px 0 32px -12px var(--shadow)',
            padding: 26,
            overflowY: 'auto',
            animation: 'slideIn .2s ease',
          }}
        >
          {(() => {
            const [bg, fg] = colorMap(selected.color, dark)
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>
                  {selected.initials}
                </div>
                <button onClick={() => store.selectContact(null)} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
                  <CloseIcon />
                </button>
              </div>
            )
          })()}

          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginTop: 14 }}>{selected.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{selected.company}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <span style={tagStyle(selected, dark)}>{selected.tag}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', background: 'var(--bg-hover)', padding: '4px 10px', borderRadius: 20 }}>{selected.status}</span>
          </div>

          <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-2)' }}>
              <MailIcon />
              {selected.email}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-2)' }}>
              <PhoneIcon />
              {selected.phone}
            </div>
          </div>

          <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 10 }}>Negócios associados</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {store.deals
                .filter((d) => d.contactId === selected.id)
                .map((d) => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 11 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-1)', fontWeight: 600 }}>{d.title}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--accent-strong)', fontWeight: 700 }}>{fmt(d.value)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
