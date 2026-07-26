import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Notificações por e-mail do SouCrum. Apenas dois tipos:
 *   kind="overdue"  → tarefas vencidas
 *   kind="mentions" → marcações (notifications.type = 'mention')
 *
 * Segurança:
 * - Exige JWT válido. O usuário vem do token, nunca do corpo.
 * - Destinatário é sempre o e-mail do usuário autenticado, o que impede usar
 *   esta função (e a conta da Resend) como relé de spam.
 * - Só envia com consentimento (email_enabled + consent_at) e se a preferência
 *   daquele tipo estiver ligada.
 * - Marcação já avisada não é reenviada (last_mention_email_at).
 * - A chave da Resend fica em secret do projeto.
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

type Kind = 'overdue' | 'mentions' | 'test'

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

  const db = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userErr } = await db.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'token inválido' }, 401)
  const user = userData.user

  let payload: { kind?: Kind; dry_run?: boolean } = {}
  try {
    payload = await req.json()
  } catch {
    // corpo vazio: trata como teste
  }
  const kind: Kind = payload.kind ?? 'test'
  if (!['overdue', 'mentions', 'test'].includes(kind)) {
    return json({ error: 'kind deve ser overdue, mentions ou test' }, 400)
  }

  // 1. Consentimento e preferência do tipo
  const { data: prefs, error: prefsErr } = await db
    .from('notification_prefs')
    .select('email, email_enabled, consent_at, overdue_enabled, mentions_enabled, last_mention_email_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (prefsErr) return json({ error: `falha ao ler preferências: ${prefsErr.message}` }, 500)
  if (!prefs || !prefs.email_enabled || !prefs.consent_at) {
    return json({ sent: false, reason: 'usuário não autorizou notificações por e-mail' }, 403)
  }
  if (kind === 'overdue' && !prefs.overdue_enabled) {
    return json({ sent: false, reason: 'avisos de tarefas vencidas desligados' })
  }
  if (kind === 'mentions' && !prefs.mentions_enabled) {
    return json({ sent: false, reason: 'avisos de marcações desligados' })
  }

  const destino = user.email ?? prefs.email
  if (!destino) return json({ error: 'usuário sem e-mail' }, 400)

  // 2. Conteúdo
  let title = 'SouCrum'
  let body = ''
  let marcadorNovo: string | null = null

  if (kind === 'overdue') {
    const hoje = new Date().toISOString().slice(0, 10)
    const { data: tarefas, error } = await db
      .from('objects')
      .select('title, due_date, assignee, last_done')
      .lt('due_date', hoje)
      .order('due_date')
      .limit(20)
    if (error) return json({ error: `falha ao buscar tarefas: ${error.message}` }, 500)
    // Rotina cujo ciclo foi concluido hoje nao e atraso.
    const lista = (tarefas ?? []).filter((t) => t.last_done !== hoje)
    if (lista.length === 0) return json({ sent: false, reason: 'nenhuma tarefa vencida' })
    title = `SouCrum: ${lista.length} ${lista.length === 1 ? 'tarefa vencida' : 'tarefas vencidas'}`
    body = lista
      .map((t) => {
        const dias = Math.round((Date.parse(hoje) - Date.parse(t.due_date as string)) / 86400000)
        const quem = t.assignee ? ` · ${t.assignee}` : ''
        return `• ${t.title} — ${dias} ${dias === 1 ? 'dia' : 'dias'} de atraso${quem}`
      })
      .join('\n')
  } else if (kind === 'mentions') {
    // Só marcações não lidas e mais novas que a última já enviada por e-mail.
    let q = db
      .from('notifications')
      .select('message, actor_email, created_at, type')
      .eq('user_id', user.id)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(20)
    if (prefs.last_mention_email_at) q = q.gt('created_at', prefs.last_mention_email_at)
    const { data: marcacoes, error } = await q
    if (error) return json({ error: `falha ao buscar marcações: ${error.message}` }, 500)
    if (!marcacoes || marcacoes.length === 0) {
      return json({ sent: false, reason: 'nenhuma marcação nova' })
    }
    marcadorNovo = marcacoes[0].created_at as string
    title =
      marcacoes.length === 1
        ? 'SouCrum: você foi marcado'
        : `SouCrum: ${marcacoes.length} marcações novas`
    body = marcacoes
      .map((m) => `• ${m.actor_email ?? 'Alguém'}: ${m.message}`)
      .join('\n')
  } else {
    title = 'SouCrum: teste de notificação'
    body = 'Se você recebeu este e-mail, as notificações do SouCrum estão funcionando.'
  }

  if (payload.dry_run) {
    return json({ sent: false, dry_run: true, to: destino, kind, title, body })
  }
  if (!resendKey) return json({ error: 'RESEND_API_KEY não configurada no projeto' }, 500)

  // 3. Envia
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
    if (r.ok) status = 'enviado'
    else erro = `${r.status}: ${texto.slice(0, 300)}`
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e)
  }

  // 4. Auditoria e marcador anti-reenvio
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
    // Só avança o marcador se realmente enviou, para não perder marcação.
    if (status === 'enviado' && marcadorNovo) {
      await admin
        .from('notification_prefs')
        .update({ last_mention_email_at: marcadorNovo })
        .eq('user_id', user.id)
    }
  }

  return status === 'enviado'
    ? json({ sent: true, to: destino, kind, title })
    : json({ sent: false, error: erro }, 502)
})
