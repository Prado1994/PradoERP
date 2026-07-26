import { useState } from 'react'
import { supabase, SUPABASE_URL } from './supabase'
import { Botao, Card } from './ui'

/**
 * Login. Dois caminhos, porque os usuários do v6.1 estão divididos:
 *
 * - **Google**: 6 dos 9 usuários. Exige o provedor configurado no projeto v6.1
 *   com o mesmo Client ID/Secret do projeto antigo. Sem isso o Supabase
 *   responde erro de provider, e a mensagem abaixo diz exatamente o que fazer.
 * - **Link por e-mail**: funciona sem configurar provedor. Serve para entrar
 *   agora, inclusive para quem só tem identidade Google, porque o Supabase casa
 *   pelo e-mail em auth.users.
 *
 * Nenhuma senha foi migrada (encrypted_password é NULL), então login por senha
 * não existe aqui de propósito.
 */
export function Auth() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado'>('parado')
  const [erro, setErro] = useState<string | null>(null)

  const redirectTo = window.location.origin

  async function comGoogle() {
    setErro(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) setErro(traduzir(error.message))
  }

  async function comLink() {
    if (!email.includes('@')) {
      setErro('Digite um e-mail válido.')
      return
    }
    setErro(null)
    setEstado('enviando')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    })
    if (error) {
      setErro(traduzir(error.message))
      setEstado('parado')
    } else {
      setEstado('enviado')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 22,
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Card style={{ width: '100%', maxWidth: 420, padding: 30 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            background: 'var(--brand-gradient)',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: 18,
            marginBottom: 18,
          }}
        >
          S
        </div>

        <h1 style={{ margin: 0, fontSize: 23, fontWeight: 750, letterSpacing: -0.5 }}>SouCrum</h1>
        <p style={{ margin: '7px 0 22px', fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Projetos, foco e rotinas. Ambiente <strong>v6.1</strong>.
        </p>

        <Botao variante="principal" onClick={comGoogle} style={{ width: '100%', padding: '12px 16px' }}>
          Entrar com Google
        </Botao>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: '18px 0',
            color: 'var(--text-3)',
            fontSize: 11.5,
          }}
        >
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          ou link por e-mail
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {estado === 'enviado' ? (
          <div
            style={{
              padding: 14,
              borderRadius: 14,
              background: 'rgba(46,224,154,.14)',
              color: '#4FE0A6',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Link enviado para <strong>{email}</strong>. Abra o e-mail neste mesmo navegador.
          </div>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void comLink()}
              placeholder="seu@email.com"
              autoComplete="email"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                marginBottom: 10,
                fontSize: 14,
              }}
            />
            <Botao
              onClick={comLink}
              disabled={estado === 'enviando'}
              style={{ width: '100%', padding: '11px 16px' }}
            >
              {estado === 'enviando' ? 'Enviando…' : 'Receber link'}
            </Botao>
          </>
        )}

        {erro && (
          <div
            style={{
              marginTop: 16,
              padding: 13,
              borderRadius: 13,
              background: 'var(--accent-soft)',
              color: 'var(--accent-strong)',
              fontSize: 12.5,
              lineHeight: 1.65,
            }}
          >
            {erro}
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
          Banco: <code>{SUPABASE_URL.replace('https://', '').split('.')[0]}</code>
          <br />
          Se o login falhar, esta URL precisa estar em Authentication → URL Configuration →
          Redirect URLs: <code>{redirectTo}</code>
        </div>
      </Card>
    </div>
  )
}

/** Erros do Supabase são em inglês e vagos; aqui viram instrução. */
function traduzir(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('provider') && (m.includes('not enabled') || m.includes('unsupported'))) {
    return 'O provedor Google ainda não está ligado neste projeto. No painel do Supabase: Authentication → Providers → Google, com o mesmo Client ID e Secret do projeto antigo.'
  }
  if (m.includes('redirect') || m.includes('not allowed')) {
    return `Esta URL não está autorizada. Adicione ${window.location.origin} em Authentication → URL Configuration → Redirect URLs.`
  }
  if (m.includes('signups not allowed') || m.includes('user not found')) {
    return 'Não existe usuário com esse e-mail neste banco. Use o mesmo e-mail que você usa no SouCrum.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Muitas tentativas seguidas. O envio de e-mail do plano gratuito é limitado — espere alguns minutos.'
  }
  return msg
}
