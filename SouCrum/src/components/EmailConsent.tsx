import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

/**
 * Pedido de permissão para enviar notificações por e-mail.
 *
 * Aparece uma única vez, no primeiro acesso, e a decisão fica registrada.
 * No app real esse estado vive na tabela `notification_prefs` (com
 * `consent_at`); aqui usamos localStorage para o protótipo, com a mesma forma
 * de dados, para o componente ser portável.
 */

const STORAGE_KEY = 'soucrum.emailConsent'

export interface EmailConsentState {
  /** null = ainda não perguntamos */
  emailEnabled: boolean | null
  consentAt: string | null
}

function load(): EmailConsentState {
  if (typeof window === 'undefined') return { emailEnabled: null, consentAt: null }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { emailEnabled: null, consentAt: null }
    return JSON.parse(raw) as EmailConsentState
  } catch {
    return { emailEnabled: null, consentAt: null }
  }
}

export function useEmailConsent() {
  const [state, setState] = useState<EmailConsentState>(load)

  const decidir = (aceitou: boolean) => {
    const novo: EmailConsentState = {
      emailEnabled: aceitou,
      consentAt: aceitou ? new Date().toISOString() : null,
    }
    setState(novo)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(novo))
    } catch {
      // sem localStorage: mantém só em memória nesta sessão
    }
  }

  return { state, decidir, jaRespondeu: state.emailEnabled !== null }
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  zIndex: 200,
}

const modal: CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 20,
  padding: 28,
  maxWidth: 440,
  width: '100%',
  boxShadow: '0 24px 60px -12px rgba(0,0,0,.4)',
  animation: 'fadeUp .2s ease',
}

export function EmailConsentDialog({
  email,
  onDecide,
}: {
  email: string
  onDecide: (aceitou: boolean) => void
}) {
  // Fecha com Esc = recusar por ora (não marca consentimento).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDecide(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDecide])

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="consent-titulo">
      <div style={modal}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            background: 'var(--accent-soft)',
            color: 'var(--accent-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        </div>

        <h2 id="consent-titulo" style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text-1)' }}>
          Receber avisos por e-mail?
        </h2>

        <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6, marginTop: 10 }}>
          O SouCrum pode te avisar sobre tarefas atrasadas e prazos que estão chegando. Os e-mails vão
          apenas para <strong style={{ color: 'var(--text-1)' }}>{email}</strong>.
        </p>

        <ul style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.7, paddingLeft: 18, marginTop: 12 }}>
          <li>Um resumo por dia, no máximo — sem spam</li>
          <li>Você pode desligar quando quiser em Configurações</li>
          <li>Seu e-mail não é compartilhado com ninguém</li>
        </ul>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button
            onClick={() => onDecide(true)}
            style={{
              flex: 1,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              padding: '12px 18px',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            Permitir
          </button>
          <button
            onClick={() => onDecide(false)}
            style={{
              flex: 1,
              background: 'none',
              color: 'var(--text-2)',
              border: '1px solid var(--border)',
              padding: '12px 18px',
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  )
}
