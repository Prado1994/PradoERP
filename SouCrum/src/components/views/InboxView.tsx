import { useState } from 'react'
import type { CrmStore } from '../../hooks/useCrmStore'
import { colorMap } from '../../theme'
import { ChevronLeftIcon, SendIcon } from '../icons'

export function InboxView({ store, isMobile = false }: { store: CrmStore; isMobile?: boolean }) {
  const dark = store.darkMode
  const [showThread, setShowThread] = useState(false)
  const q = store.emailSearch.toLowerCase()
  const filtered = store.emails.filter((e) =>
    (e.subject + e.contactName + e.preview).toLowerCase().includes(q),
  )
  const selected = store.emails.find((e) => e.id === store.selectedEmailId) ?? null

  // On mobile the list and the conversation are separate screens.
  const showList = !isMobile || !showThread
  const showConversation = !isMobile || showThread

  const openEmail = (id: string) => {
    store.selectEmail(id)
    setShowThread(true)
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        background: 'var(--bg-card)',
        border: 'var(--card-border)',
        boxShadow: 'var(--card-shadow)',
        borderRadius: 18,
        overflow: 'hidden',
        animation: 'fadeUp .25s ease',
      }}
    >
      {showList && (
        <div style={{ width: isMobile ? '100%' : 340, flexShrink: 0, borderRight: isMobile ? 'none' : '1px solid var(--border)', overflowY: 'auto' }}>
          {filtered.map((em) => {
            const [bg, fg] = colorMap(em.color, dark)
            const active = !isMobile && em.id === store.selectedEmailId
            const weight = em.unread ? 700 : 500
            return (
              <div
                key={em.id}
                onClick={() => openEmail(em.id)}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: active ? 'var(--bg-hover)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent'
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 11, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {em.initials}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 13.5, color: 'var(--text-1)', fontWeight: weight, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{em.contactName}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{em.time}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: weight, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{em.subject}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{em.preview}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showConversation && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {selected && (
            <>
              <div style={{ padding: isMobile ? '16px 18px' : '22px 26px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                {isMobile && (
                  <button
                    onClick={() => setShowThread(false)}
                    aria-label="Voltar"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-1)', padding: 2, display: 'flex', flexShrink: 0 }}
                  >
                    <ChevronLeftIcon size={20} />
                  </button>
                )}
                {(() => {
                  const [bg, fg] = colorMap(selected.color, dark)
                  return (
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                      {selected.initials}
                    </div>
                  )
                })()}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.subject}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selected.contactName} · {selected.company}
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 18px' : '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {selected.thread.map((msg, i) => (
                  <div key={i} style={{ maxWidth: isMobile ? '85%' : '72%', alignSelf: msg.fromMe ? 'flex-end' : 'flex-start' }}>
                    <div
                      style={{
                        background: msg.fromMe ? 'var(--accent)' : 'var(--bg-hover)',
                        color: msg.fromMe ? '#fff' : 'var(--text-1)',
                        padding: '13px 16px',
                        borderRadius: 15,
                        fontSize: 13.5,
                        lineHeight: 1.55,
                      }}
                    >
                      {msg.text}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5, textAlign: msg.fromMe ? 'right' : 'left' }}>
                      {msg.name} · {msg.time}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: isMobile ? '14px 18px' : '18px 26px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <textarea
                  value={store.composeText}
                  onChange={(e) => store.setComposeText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      store.sendReply()
                    }
                  }}
                  placeholder="Escreva uma resposta..."
                  rows={2}
                  style={{
                    flex: 1,
                    resize: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: '11px 14px',
                    fontSize: 13.5,
                    background: 'var(--bg-app)',
                    color: 'var(--text-1)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={store.sendReply}
                  aria-label="Enviar"
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  <SendIcon />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
