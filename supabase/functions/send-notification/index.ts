import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Envia notificação por e-mail para o usuário autenticado.
 *
 * Regras de segurança:
 * - Exige JWT válido (verify_jwt). O usuário é identificado pelo token.
 * - O destinatário NUNCA vem do cliente: usamos o e-mail do próprio usuário
 *   autenticado. Isso impede que alguém com login use esta função (e a conta
 *   da Resend) como relé de spam.
 * - Só envia se o usuário tiver dado consentimento (email_enabled + consent_at).
 * - A chave da Resend fica no secret RESEND_API_KEY, nunca no navegador.
 *
 * Secrets necessários (Dashboard > Edge Functions > Secrets):
 *   RESEND_API_KEY, NOTIFY_EMAIL_FROM, NOTIFY_APP_URL (opcional)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'use POST' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'sem Authorization' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const emailFrom = Deno.env.get('NOTIFY_EMAIL_FROM') ?? 'onboarding@resend.dev'
  const appUrl = Deno.env.get('NOTIFY_APP_URL') ?? 'https://soucrum.vercel.app'

  // Cliente com o token do usuário: RLS vale, e cada um só vê o que é seu.
  const db = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userErr } = await db.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'token inválido' }, 401)
  const user = userData.user

  let payload: { kind?: string; title?: string; body?: string; dry_run?: boolean } = {}
  try {
    payload = await req.json()
  } catch {
    // corpo vazio é aceitável para o resumo padrão
  }
  const kind = payload.kind ?? 'test'

  // 1. Consentimento
  const { data: prefs, error: prefsErr } = await db
    .from('notification_prefs')
    .select('email, email_enabled, consent_at, overdue_daily')
    .eq('user_id', user.id)
    .maybeSingle()
  if (prefsErr) return json({ error: `falha ao ler preferências: ${prefsErr.message}` }, 500)
  if (!prefs || !prefs.email_enabled || !prefs.consent_at) {
    return json({ sent: false, reason: 'usuário não autorizou notificações por e-mail' }, 403)
  }

  // 2. Destinatário: sempre o e-mail do usuário autenticado.
  const destino = user.email ?? prefs.email
  if (!destino) return json({ error: 'usuário sem e-mail' }, 400)

  // 3. Monta o conteúdo
  let title = payload.title ?? 'SouCrum'
  let body = payload.body ?? ''

  if (kind === 'overdue') {
    const hoje = new Date().toISOString().slice(0, 10)
    const { data: atrasadas, error: e } = await db
      .from('objects')
      .select('title, due_date, assignee, last_done')
      .lt('due_date', hoje)
      .order('due_date')
      .limit(20)
    if (e) return json({ error: `falha ao buscar tarefas: ${e.message}` }, 500)
    const lista = (atrasadas ?? []).filter((t) => t.last_done !== hoje)
    if (lista.length === 0) return json({ sent: false, reason: 'nenhuma tarefa atrasada' })
    title = `SouCrum: ${lista.length} ${lista.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}`
    body = lista
      .map((t) => {
        const dias = Math.round((Date.parse(hoje) - Date.parse(t.due_date as string)) / 86400000)
        return `• ${t.title} — ${dias} ${dias === 1 ? 'dia' : 'dias'} de atraso`
      })
      .join('\n')
  } else if (kind === 'test') {
    title = 'SouCrum: teste de notificação'
    body = 'Se você recebeu este e-mail, as notificações do SouCrum estão funcionando.'
  }

  if (payload.dry_run) {
    return json({ sent: false, dry_run: true, to: destino, title, body })
  }

  if (!resendKey) {
    return json({ error: 'RESEND_API_KEY não configurada no projeto' }, 500)
  }

  // 4. Envia
  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#171717">',
    `<h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(title)}</h2>`,
    `<div style="font-size:14px;line-height:1.6">${body.split('\n').map(escapeHtml).join('<br>')}</div>`,
    `<p style="margin-top:20px"><a href="${escapeHtml(appUrl)}" style="background:#FF4D6D;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Abrir no SouCrum</a></p>`,
    '<p style="margin-top:24px;font-size:11.5px;color:#A0A0A6">Você recebe este aviso porque ativou notificações no SouCrum. Para parar, desligue em Configurações.</p>',
    '</div>',
  ].join('')

  let status = 'erro'
  let erro: string | null = null
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: emailFrom, to: [destino], subject: title, text: body, html }),
    })
    const texto = await r.text()
    if (r.ok) {
      status = 'enviado'
    } else {
      erro = `${r.status}: ${texto.slice(0, 300)}`
    }
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e)
  }

  // 5. Audita (service role para gravar mesmo com RLS de select)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (serviceKey) {
    const admin = createClient(supabaseUrl, serviceKey)
    await admin.from('notification_log').insert({
      user_id: user.id,
      channel: 'email',
      kind,
      subject: title,
      status,
      error: erro,
    })
  }

  return status === 'enviado'
    ? json({ sent: true, to: destino, title })
    : json({ sent: false, error: erro }, 502)
})
