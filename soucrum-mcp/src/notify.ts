/**
 * Envio de notificações do SouCrum para Slack, Google Chat, Microsoft Teams e
 * e-mail.
 *
 * Cada canal é configurado por variável de ambiente e só entra em ação se
 * estiver preenchido — nada é enviado para canal não configurado.
 *
 * Slack e Google Chat usam webhook simples. O Teams usa Adaptive Card, formato
 * esperado pelo gatilho "webhook" do Power Automate / Workflows (os conectores
 * antigos do Office 365 foram descontinuados). O e-mail sai pela API da Resend,
 * que é HTTP puro e não exige dependência extra.
 */

export type ChannelId = 'slack' | 'googleChat' | 'teams' | 'email'

export interface NotifyConfig {
  slackWebhook?: string
  googleChatWebhook?: string
  teamsWebhook?: string
  resendApiKey?: string
  emailFrom?: string
  emailTo?: string[]
  /** Endpoint da Resend. Configurável para proxy corporativo ou testes. */
  resendApiUrl?: string
}

export interface ChannelResult {
  channel: ChannelId
  sent: boolean
  skipped?: 'não configurado'
  status?: number
  error?: string
}

/** Uma notificação, independente do canal de destino. */
export interface Notification {
  /** Assunto/título curto. Vira o subject do e-mail e o título do cartão. */
  title: string
  /** Corpo em texto simples. Uma linha por item funciona bem em todos os canais. */
  body: string
  /** Link opcional de "abrir no SouCrum". */
  link?: string
}

export function loadNotifyConfig(env: NodeJS.ProcessEnv = process.env): NotifyConfig {
  const to = (env.SOUCRUM_EMAIL_TO ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
  return {
    slackWebhook: env.SOUCRUM_SLACK_WEBHOOK_URL?.trim() || undefined,
    googleChatWebhook: env.SOUCRUM_GOOGLE_CHAT_WEBHOOK_URL?.trim() || undefined,
    teamsWebhook: env.SOUCRUM_TEAMS_WEBHOOK_URL?.trim() || undefined,
    resendApiKey: env.SOUCRUM_RESEND_API_KEY?.trim() || undefined,
    emailFrom: env.SOUCRUM_EMAIL_FROM?.trim() || undefined,
    emailTo: to.length > 0 ? to : undefined,
    resendApiUrl: env.SOUCRUM_RESEND_API_URL?.trim() || 'https://api.resend.com/emails',
  }
}

/** Canais prontos para uso, sem revelar segredo — usado pelo /health e pela UI. */
export function configuredChannels(cfg: NotifyConfig): Record<ChannelId, boolean> {
  return {
    slack: Boolean(cfg.slackWebhook),
    googleChat: Boolean(cfg.googleChatWebhook),
    teams: Boolean(cfg.teamsWebhook),
    email: Boolean(cfg.resendApiKey && cfg.emailFrom && cfg.emailTo?.length),
  }
}

const TIMEOUT_MS = 10_000

async function postJson(url: string, payload: unknown, headers: Record<string, string> = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    // Webhooks costumam responder texto curto ("ok"); guardamos para diagnóstico.
    const texto = await res.text().catch(() => '')
    return { status: res.status, ok: res.ok, texto }
  } finally {
    clearTimeout(timer)
  }
}

function comLink(n: Notification): string {
  return n.link ? `${n.body}\n\n${n.link}` : n.body
}

// ---------------------------------------------------------------------------
// Formatação por canal
// ---------------------------------------------------------------------------

export function slackPayload(n: Notification) {
  return {
    text: `*${n.title}*\n${comLink(n)}`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: n.title, emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: n.body } },
      ...(n.link
        ? [
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'Abrir no SouCrum' },
                  url: n.link,
                },
              ],
            },
          ]
        : []),
    ],
  }
}

export function googleChatPayload(n: Notification) {
  // O Chat aceita markdown simples no texto: *negrito*, _itálico_.
  return { text: `*${n.title}*\n${comLink(n)}` }
}

export function teamsPayload(n: Notification) {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.4',
          body: [
            { type: 'TextBlock', size: 'Medium', weight: 'Bolder', text: n.title, wrap: true },
            { type: 'TextBlock', text: n.body, wrap: true },
          ],
          ...(n.link
            ? { actions: [{ type: 'Action.OpenUrl', title: 'Abrir no SouCrum', url: n.link }] }
            : {}),
        },
      },
    ],
  }
}

export function emailPayload(n: Notification, cfg: NotifyConfig) {
  const linhas = n.body.split('\n').map((l) => escapeHtml(l))
  return {
    from: cfg.emailFrom,
    to: cfg.emailTo,
    subject: n.title,
    text: comLink(n),
    html: [
      '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#171717">',
      `<h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(n.title)}</h2>`,
      `<div style="font-size:14px;line-height:1.6">${linhas.join('<br>')}</div>`,
      n.link
        ? `<p style="margin-top:20px"><a href="${escapeHtml(n.link)}" style="background:#FF4D6D;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Abrir no SouCrum</a></p>`
        : '',
      '</div>',
    ].join(''),
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

async function enviarCanal(
  channel: ChannelId,
  n: Notification,
  cfg: NotifyConfig,
): Promise<ChannelResult> {
  const alvo: Record<ChannelId, string | undefined> = {
    slack: cfg.slackWebhook,
    googleChat: cfg.googleChatWebhook,
    teams: cfg.teamsWebhook,
    email: cfg.resendApiKey && cfg.emailFrom && cfg.emailTo?.length ? 'resend' : undefined,
  }
  if (!alvo[channel]) return { channel, sent: false, skipped: 'não configurado' }

  try {
    if (channel === 'email') {
      const r = await postJson(cfg.resendApiUrl ?? 'https://api.resend.com/emails', emailPayload(n, cfg), {
        Authorization: `Bearer ${cfg.resendApiKey}`,
      })
      return r.ok
        ? { channel, sent: true, status: r.status }
        : { channel, sent: false, status: r.status, error: r.texto.slice(0, 300) }
    }

    const url = alvo[channel] as string
    const payload =
      channel === 'slack'
        ? slackPayload(n)
        : channel === 'googleChat'
          ? googleChatPayload(n)
          : teamsPayload(n)

    const r = await postJson(url, payload)
    return r.ok
      ? { channel, sent: true, status: r.status }
      : { channel, sent: false, status: r.status, error: r.texto.slice(0, 300) }
  } catch (e) {
    const abortado = e instanceof Error && e.name === 'AbortError'
    return {
      channel,
      sent: false,
      error: abortado ? `tempo esgotado (${TIMEOUT_MS / 1000}s)` : e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * Envia para os canais pedidos (ou todos os configurados).
 * Um canal que falha não impede os outros.
 */
export async function notify(
  n: Notification,
  cfg: NotifyConfig,
  canais?: ChannelId[],
): Promise<{ results: ChannelResult[]; sent_count: number }> {
  const todos: ChannelId[] = ['slack', 'googleChat', 'teams', 'email']
  const escolhidos = canais && canais.length > 0 ? canais : todos
  const results = await Promise.all(escolhidos.map((c) => enviarCanal(c, n, cfg)))
  return { results, sent_count: results.filter((r) => r.sent).length }
}
