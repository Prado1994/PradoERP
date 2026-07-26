#!/usr/bin/env node
/**
 * SouCrum MCP Server
 *
 * Expõe o SouCrum (app de gestão de trabalho: workspaces, projetos,
 * tarefas/cartões, agenda, páginas e atividade) via Model Context Protocol,
 * permitindo que assistentes de IA consultem e operem os dados.
 *
 * Transporte: stdio. Backend: Supabase (Postgres + RLS).
 *
 * Config via variáveis de ambiente — ver .env.example.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Cliente Supabase
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SOUCRUM_SUPABASE_URL ?? 'https://sbyivwkcvjkropoforqx.supabase.co'
const SUPABASE_KEY = process.env.SOUCRUM_SUPABASE_KEY
const USER_JWT = process.env.SOUCRUM_USER_JWT
const READ_ONLY = (process.env.SOUCRUM_READ_ONLY ?? 'false').toLowerCase() === 'true'

if (!SUPABASE_KEY) {
  console.error('[soucrum-mcp] Defina SOUCRUM_SUPABASE_KEY (service_role ou anon). Veja .env.example.')
  process.exit(1)
}

function makeClient(): SupabaseClient {
  const options = USER_JWT
    ? { global: { headers: { Authorization: `Bearer ${USER_JWT}` } } }
    : undefined
  return createClient(SUPABASE_URL, SUPABASE_KEY as string, options)
}

const db = makeClient()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function fail(message: string): ToolResult {
  return { content: [{ type: 'text', text: `Erro: ${message}` }], isError: true }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Vocabulário real do SouCrum (verificado no banco — a coluna é texto livre,
 * sem CHECK constraint, então aceitamos qualquer string e apenas documentamos
 * os valores em uso para orientar o assistente).
 *
 * Fluxo dos cartões: jot (captura) → extracted → refined → scheduled.
 * Rotinas são cartões com `recurrence` (daily/weekly/monthly) e a conclusão
 * do ciclo é registrada em `last_done`.
 */
const KNOWN_STATUSES = ['jot', 'extracted', 'refined', 'scheduled'] as const
const KNOWN_EISENHOWER = ['do', 'schedule', 'delegate', 'delete'] as const

const statusSchema = z
  .string()
  .describe(`Status do cartão. Em uso: ${KNOWN_STATUSES.join(' → ')}`)
const eisenhowerSchema = z
  .string()
  .describe(`Quadrante de Eisenhower. Em uso: ${KNOWN_EISENHOWER.join(', ')}`)

// ---------------------------------------------------------------------------
// Servidor e ferramentas
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'soucrum',
  version: '0.1.0',
})

// -- Workspaces --------------------------------------------------------------

server.tool(
  'list_workspaces',
  'Lista os workspaces do SouCrum com seus membros.',
  {},
  async () => {
    const { data, error } = await db
      .from('workspaces')
      .select('id, name, created_at, workspace_members ( email, role )')
      .order('created_at')
    if (error) return fail(error.message)
    return ok(data)
  },
)

// -- Projetos ----------------------------------------------------------------

server.tool(
  'list_projects',
  'Lista projetos (nome, cor, prazo, workspace). Filtre opcionalmente por workspace_id.',
  { workspace_id: z.string().uuid().optional().describe('UUID do workspace para filtrar') },
  async ({ workspace_id }) => {
    let q = db
      .from('projects')
      .select('id, name, color, description, deadline, workspace_id, created_at, updated_at')
      .order('updated_at', { ascending: false })
    if (workspace_id) q = q.eq('workspace_id', workspace_id)
    const { data, error } = await q
    if (error) return fail(error.message)
    return ok(data)
  },
)

server.tool(
  'project_summary',
  'Resumo de um projeto: contagem de tarefas por status, atrasadas e próximas do prazo.',
  { project_id: z.string().uuid().describe('UUID do projeto') },
  async ({ project_id }) => {
    const { data: proj, error: e1 } = await db
      .from('projects')
      .select('id, name, deadline, description')
      .eq('id', project_id)
      .single()
    if (e1) return fail(e1.message)

    const { data: tasks, error: e2 } = await db
      .from('objects')
      .select('id, title, status, due_date, assignee, recurrence, last_done')
      .eq('project_id', project_id)
    if (e2) return fail(e2.message)

    const byStatus: Record<string, number> = {}
    const overdue: { id: string; title: string; due_date: string }[] = []
    const t = today()
    for (const task of tasks ?? []) {
      byStatus[task.status] = (byStatus[task.status] ?? 0) + 1
      // Uma rotina cujo ciclo já foi concluído hoje não conta como atrasada.
      const doneThisCycle = task.last_done === t
      if (task.due_date && task.due_date < t && !doneThisCycle) {
        overdue.push({ id: task.id, title: task.title, due_date: task.due_date })
      }
    }
    return ok({ project: proj, total_tasks: tasks?.length ?? 0, by_status: byStatus, overdue })
  },
)

// -- Tarefas / cartões (objects) ----------------------------------------------

server.tool(
  'search_tasks',
  'Busca tarefas/cartões por texto, status, projeto, tag, área ou responsável. Retorna no máximo `limit` resultados (padrão 25).',
  {
    query: z.string().optional().describe('Texto a procurar no título e corpo'),
    project_id: z.string().uuid().optional(),
    status: statusSchema.optional(),
    tag: z.string().optional(),
    area: z.string().optional(),
    assignee: z.string().optional(),
    due_before: z.string().optional().describe('Data ISO (YYYY-MM-DD): vencimento até'),
    limit: z.number().int().min(1).max(100).optional(),
  },
  async ({ query, project_id, status, tag, area, assignee, due_before, limit }) => {
    let q = db
      .from('objects')
      .select('id, title, status, type, project_id, tags, due_date, eisenhower, assignee, area, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit ?? 25)
    if (query) q = q.or(`title.ilike.%${query}%,body.ilike.%${query}%`)
    if (project_id) q = q.eq('project_id', project_id)
    if (status) q = q.eq('status', status)
    if (tag) q = q.contains('tags', [tag])
    if (area) q = q.eq('area', area)
    if (assignee) q = q.ilike('assignee', `%${assignee}%`)
    if (due_before) q = q.lte('due_date', due_before)
    const { data, error } = await q
    if (error) return fail(error.message)
    return ok(data)
  },
)

server.tool(
  'get_task',
  'Detalhe completo de uma tarefa/cartão: corpo, checklist, comentários, anexos, pomodoros e subtarefas.',
  { task_id: z.string().uuid().describe('UUID da tarefa') },
  async ({ task_id }) => {
    const { data, error } = await db.from('objects').select('*').eq('id', task_id).single()
    if (error) return fail(error.message)
    const { data: subtasks } = await db
      .from('objects')
      .select('id, title, status, due_date')
      .eq('parent_id', task_id)
    return ok({ ...data, subtasks: subtasks ?? [] })
  },
)

server.tool(
  'today_agenda',
  'Agenda de hoje: cartões com vencimento hoje, atrasados, fixados na agenda e rotinas pendentes do dia.',
  {},
  async () => {
    const t = today()
    const cols = 'id, title, status, project_id, due_date, eisenhower, assignee, recurrence, last_done'

    const { data: dueToday, error: e1 } = await db.from('objects').select(cols).eq('due_date', t)
    if (e1) return fail(e1.message)

    const { data: overdue, error: e2 } = await db
      .from('objects')
      .select(cols)
      .lt('due_date', t)
      .order('due_date')
      .limit(50)
    if (e2) return fail(e2.message)

    const { data: agenda, error: e3 } = await db.from('objects').select(cols).eq('show_in_agenda', true)
    if (e3) return fail(e3.message)

    // Rotinas diárias ainda não concluídas hoje.
    const { data: routines, error: e4 } = await db
      .from('objects')
      .select(cols)
      .eq('recurrence', 'daily')
      .or(`last_done.is.null,last_done.neq.${t}`)
    if (e4) return fail(e4.message)

    // Rotina já concluída no ciclo de hoje não precisa reaparecer como pendente.
    const pending = (rows: typeof dueToday) => (rows ?? []).filter((r) => r.last_done !== t)

    return ok({
      date: t,
      due_today: pending(dueToday),
      overdue: pending(overdue),
      in_agenda: pending(agenda),
      daily_routines_pending: routines,
    })
  },
)

server.tool(
  'list_routines',
  'Lista rotinas (cartões recorrentes) e indica se o ciclo atual já foi concluído.',
  {
    recurrence: z.string().optional().describe('Filtrar por periodicidade: daily, weekly, monthly'),
  },
  async ({ recurrence }) => {
    let q = db
      .from('objects')
      .select('id, title, status, project_id, recurrence, last_done, assignee, area')
      .not('recurrence', 'is', null)
      .order('title')
    if (recurrence) q = q.eq('recurrence', recurrence)
    const { data, error } = await q
    if (error) return fail(error.message)
    const t = today()
    return ok((data ?? []).map((r) => ({ ...r, done_today: r.last_done === t })))
  },
)

if (!READ_ONLY) {
  server.tool(
    'create_task',
    'Cria uma tarefa/cartão. owner_id é definido pela sessão (JWT) ou deve existir política que permita o insert.',
    {
      title: z.string().min(1),
      body: z.string().optional(),
      project_id: z.string().uuid().optional(),
      status: statusSchema.optional().describe('Padrão: jot (captura). Fluxo: jot → extracted → refined → scheduled'),
      type: z.string().optional().describe('task ou jot. Padrão: task'),
      due_date: z.string().optional().describe('YYYY-MM-DD'),
      tags: z.array(z.string()).optional(),
      area: z.string().optional().describe('Área, ex.: ERP Prado, Geral'),
      assignee: z.string().optional(),
      eisenhower: eisenhowerSchema.optional(),
      recurrence: z.string().optional().describe('Torna o cartão uma rotina: daily, weekly, monthly'),
    },
    async (input) => {
      const { data, error } = await db
        .from('objects')
        .insert({
          title: input.title,
          body: input.body ?? '',
          project_id: input.project_id ?? null,
          status: input.status ?? 'jot',
          type: input.type ?? 'task',
          due_date: input.due_date ?? null,
          tags: input.tags ?? [],
          area: input.area ?? null,
          assignee: input.assignee ?? null,
          eisenhower: input.eisenhower ?? null,
          recurrence: input.recurrence ?? null,
        })
        .select('id, title, status, type')
        .single()
      if (error) return fail(error.message)
      return ok({ created: data })
    },
  )

  server.tool(
    'update_task',
    'Atualiza campos de uma tarefa (mover de coluna = mudar status, definir prazo, responsável etc.).',
    {
      task_id: z.string().uuid(),
      title: z.string().optional(),
      body: z.string().optional(),
      status: statusSchema.optional(),
      due_date: z.string().nullable().optional(),
      project_id: z.string().uuid().nullable().optional(),
      tags: z.array(z.string()).optional(),
      assignee: z.string().nullable().optional(),
      eisenhower: eisenhowerSchema.nullable().optional(),
      show_in_agenda: z.boolean().optional().describe('Fixar/desafixar o cartão na agenda'),
    },
    async ({ task_id, ...patch }) => {
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      if (Object.keys(clean).length === 0) return fail('nenhum campo para atualizar')
      const { data, error } = await db
        .from('objects')
        .update({ ...clean, updated_at: new Date().toISOString() })
        .eq('id', task_id)
        .select('id, title, status, due_date')
        .single()
      if (error) return fail(error.message)
      return ok({ updated: data })
    },
  )

  server.tool(
    'complete_routine',
    'Marca o ciclo atual de uma rotina como concluído, registrando a data em last_done.',
    {
      task_id: z.string().uuid().describe('UUID do cartão de rotina'),
      date: z.string().optional().describe('YYYY-MM-DD. Padrão: hoje'),
    },
    async ({ task_id, date }) => {
      const when = date ?? today()
      const { data, error } = await db
        .from('objects')
        .update({ last_done: when, updated_at: new Date().toISOString() })
        .eq('id', task_id)
        .select('id, title, recurrence, last_done')
        .single()
      if (error) return fail(error.message)
      return ok({ completed: data })
    },
  )
}

// -- Interoperabilidade: Google Calendar / Notion ------------------------------
//
// Estas ferramentas NÃO chamam as APIs do Google ou do Notion. Elas preparam os
// dados no formato que os servidores MCP oficiais desses produtos esperam, e
// guardam de volta os IDs devolvidos por eles. Assim o assistente combina os
// servidores (SouCrum + Google Calendar + Notion) sem que este servidor precise
// de credenciais de terceiros.

server.tool(
  'export_agenda_for_calendar',
  'Exporta cartões com prazo como eventos prontos para criar no Google Calendar. Já indica quais ainda não foram sincronizados (gcal_event_id vazio). Depois de criar o evento, chame link_gcal_event para gravar o vínculo.',
  {
    from: z.string().optional().describe('Data inicial YYYY-MM-DD. Padrão: hoje'),
    to: z.string().optional().describe('Data final YYYY-MM-DD'),
    only_unsynced: z.boolean().optional().describe('Somente cartões sem evento no Calendar. Padrão: true'),
  },
  async ({ from, to, only_unsynced }) => {
    let q = db
      .from('objects')
      .select('id, title, body, due_date, status, project_id, assignee, gcal_event_id')
      .not('due_date', 'is', null)
      .gte('due_date', from ?? today())
      .order('due_date')
    if (to) q = q.lte('due_date', to)
    if (only_unsynced !== false) q = q.is('gcal_event_id', null)
    const { data, error } = await q
    if (error) return fail(error.message)

    const events = (data ?? []).map((c) => ({
      soucrum_task_id: c.id,
      summary: c.title,
      description: [c.body, `SouCrum · status: ${c.status}`].filter(Boolean).join('\n\n'),
      // Evento de dia inteiro: `end` é exclusivo no Google Calendar.
      start: { date: c.due_date },
      end: { date: c.due_date },
      already_synced: c.gcal_event_id !== null,
    }))
    return ok({ count: events.length, events })
  },
)

if (!READ_ONLY) {
  server.tool(
    'link_gcal_event',
    'Grava no cartão o ID do evento criado no Google Calendar, para não duplicar em sincronizações futuras.',
    {
      task_id: z.string().uuid(),
      gcal_event_id: z.string().min(1).describe('ID devolvido pela API do Google Calendar'),
    },
    async ({ task_id, gcal_event_id }) => {
      const { data, error } = await db
        .from('objects')
        .update({ gcal_event_id, updated_at: new Date().toISOString() })
        .eq('id', task_id)
        .select('id, title, due_date, gcal_event_id')
        .single()
      if (error) return fail(error.message)
      return ok({ linked: data })
    },
  )
}

// -- Interoperabilidade: Gmail -------------------------------------------------
//
// O vínculo com o e-mail fica em `objects.attachments` (jsonb, hoje não usado
// pelo app) no formato:
//   { type: 'email', source: 'gmail', message_id, thread_id, from, subject, link }
// A deduplicação usa containment jsonb (@>) por `message_id`, então reprocessar
// a mesma caixa de entrada não gera cartões repetidos.

/** Referência de e-mail gravada em attachments. */
interface EmailRef {
  type: 'email'
  source: 'gmail'
  message_id: string
  thread_id?: string
  from?: string
  subject?: string
  link?: string
  received_at?: string
}

/** Permalink do Gmail para a mensagem. */
function gmailLink(messageId: string): string {
  return `https://mail.google.com/mail/u/0/#all/${messageId}`
}

server.tool(
  'find_task_by_email',
  'Verifica se um e-mail do Gmail já virou cartão no SouCrum. Use antes de criar, para não duplicar.',
  { message_id: z.string().min(1).describe('ID da mensagem no Gmail') },
  async ({ message_id }) => {
    const { data, error } = await db
      .from('objects')
      .select('id, title, status, due_date, project_id, attachments')
      .contains('attachments', [{ message_id }])
      .limit(1)
    if (error) return fail(error.message)
    const found = data?.[0]
    return ok(found ? { exists: true, task: found } : { exists: false })
  },
)

server.tool(
  'list_email_tasks',
  'Lista os cartões que se originaram de e-mails, com o remetente e o link da mensagem.',
  { limit: z.number().int().min(1).max(100).optional() },
  async ({ limit }) => {
    const { data, error } = await db
      .from('objects')
      .select('id, title, status, due_date, project_id, attachments, created_at')
      .contains('attachments', [{ type: 'email' }])
      .order('created_at', { ascending: false })
      .limit(limit ?? 30)
    if (error) return fail(error.message)
    return ok(
      (data ?? []).map((t) => {
        const ref = ((t.attachments as EmailRef[] | null) ?? []).find((a) => a?.type === 'email')
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          due_date: t.due_date,
          from: ref?.from,
          message_id: ref?.message_id,
          link: ref?.link,
        }
      }),
    )
  },
)

if (!READ_ONLY) {
  server.tool(
    'create_task_from_email',
    'Transforma um e-mail do Gmail em cartão do SouCrum, guardando o vínculo com a mensagem. É idempotente: se o e-mail já virou cartão, devolve o existente em vez de duplicar.',
    {
      message_id: z.string().min(1).describe('ID da mensagem no Gmail'),
      subject: z.string().min(1).describe('Assunto — vira o título do cartão'),
      from: z.string().optional().describe('Remetente (nome e/ou e-mail)'),
      body: z.string().optional().describe('Corpo ou resumo do e-mail'),
      thread_id: z.string().optional(),
      received_at: z.string().optional().describe('Data ISO em que o e-mail chegou'),
      link: z.string().optional().describe('Permalink. Se omitido, é montado a partir do message_id'),
      project_id: z.string().uuid().optional(),
      status: statusSchema.optional().describe('Padrão: jot (cai na captura)'),
      due_date: z.string().optional().describe('YYYY-MM-DD'),
      tags: z.array(z.string()).optional(),
      checklist: z.array(z.string()).optional().describe('Passos a executar, extraídos do e-mail'),
    },
    async (input) => {
      // Idempotência: se já existe cartão para esta mensagem, devolve-o.
      const { data: existing, error: eFind } = await db
        .from('objects')
        .select('id, title, status, due_date')
        .contains('attachments', [{ message_id: input.message_id }])
        .limit(1)
      if (eFind) return fail(eFind.message)
      if (existing?.[0]) {
        return ok({ created: false, reason: 'e-mail já vinculado a um cartão', task: existing[0] })
      }

      const ref: EmailRef = {
        type: 'email',
        source: 'gmail',
        message_id: input.message_id,
        thread_id: input.thread_id,
        from: input.from,
        subject: input.subject,
        link: input.link ?? gmailLink(input.message_id),
        received_at: input.received_at,
      }

      const corpo = [
        input.from ? `**De:** ${input.from}` : null,
        `[Abrir e-mail no Gmail](${ref.link})`,
        input.body ? `\n---\n\n${input.body}` : null,
      ]
        .filter(Boolean)
        .join('\n')

      // checklist segue a convenção do app: { id, done, text }
      const checklist = (input.checklist ?? []).map((text, i) => ({
        id: String(i + 1),
        done: false,
        text,
      }))

      const { data, error } = await db
        .from('objects')
        .insert({
          title: input.subject,
          body: corpo,
          type: 'task',
          status: input.status ?? 'jot',
          project_id: input.project_id ?? null,
          due_date: input.due_date ?? null,
          tags: input.tags ?? [],
          checklist,
          attachments: [ref],
        })
        .select('id, title, status, due_date, project_id')
        .single()
      if (error) return fail(error.message)
      return ok({ created: true, task: data, email_link: ref.link })
    },
  )
}

server.tool(
  'export_project_markdown',
  'Exporta um projeto inteiro (dados + cartões agrupados por status) em Markdown, pronto para virar página no Notion, Google Docs ou Drive.',
  {
    project_id: z.string().uuid(),
    include_body: z.boolean().optional().describe('Incluir o corpo de cada cartão. Padrão: false'),
  },
  async ({ project_id, include_body }) => {
    const { data: proj, error: e1 } = await db
      .from('projects')
      .select('name, description, deadline')
      .eq('id', project_id)
      .single()
    if (e1) return fail(e1.message)

    const { data: tasks, error: e2 } = await db
      .from('objects')
      .select('title, body, status, due_date, assignee, tags, checklist')
      .eq('project_id', project_id)
      .order('status')
    if (e2) return fail(e2.message)

    const grupos = new Map<string, typeof tasks>()
    for (const t of tasks ?? []) {
      if (!grupos.has(t.status)) grupos.set(t.status, [])
      grupos.get(t.status)!.push(t)
    }

    const linhas: string[] = [`# ${proj.name}`, '']
    if (proj.description) linhas.push(proj.description, '')
    if (proj.deadline) linhas.push(`**Prazo:** ${proj.deadline}`, '')
    for (const [status, itens] of grupos) {
      linhas.push(`## ${status} (${itens!.length})`, '')
      for (const t of itens!) {
        const meta = [t.due_date && `prazo ${t.due_date}`, t.assignee && `resp. ${t.assignee}`]
          .filter(Boolean)
          .join(' · ')
        linhas.push(`- **${t.title}**${meta ? ` — ${meta}` : ''}`)
        if (include_body && t.body) linhas.push(`  ${t.body.replace(/\n/g, '\n  ')}`)
        for (const item of (t.checklist as { text?: string; done?: boolean }[] | null) ?? []) {
          if (item?.text) linhas.push(`  - [${item.done ? 'x' : ' '}] ${item.text}`)
        }
      }
      linhas.push('')
    }
    return ok({ project: proj.name, task_count: tasks?.length ?? 0, markdown: linhas.join('\n') })
  },
)

// -- Páginas (documentos) ------------------------------------------------------

server.tool(
  'list_pages',
  'Lista páginas/documentos, opcionalmente por projeto.',
  { project_id: z.string().uuid().optional() },
  async ({ project_id }) => {
    let q = db.from('pages').select('id, title, project_id, updated_at').order('updated_at', { ascending: false })
    if (project_id) q = q.eq('project_id', project_id)
    const { data, error } = await q
    if (error) return fail(error.message)
    return ok(data)
  },
)

server.tool(
  'read_page',
  'Lê o conteúdo de uma página/documento.',
  { page_id: z.string().uuid() },
  async ({ page_id }) => {
    const { data, error } = await db.from('pages').select('id, title, content, updated_at').eq('id', page_id).single()
    if (error) return fail(error.message)
    return ok(data)
  },
)

// -- Atividade e notificações --------------------------------------------------

server.tool(
  'recent_activity',
  'Feed de atividade recente (quem fez o quê). Padrão: 30 eventos.',
  {
    project_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  async ({ project_id, limit }) => {
    let q = db
      .from('activity')
      .select('actor_email, action, entity_type, entity_title, project_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit ?? 30)
    if (project_id) q = q.eq('project_id', project_id)
    const { data, error } = await q
    if (error) return fail(error.message)
    return ok(data)
  },
)

server.tool(
  'unread_notifications',
  'Notificações não lidas.',
  {},
  async () => {
    const { data, error } = await db
      .from('notifications')
      .select('id, actor_email, type, message, created_at')
      .eq('read', false)
      .order('created_at', { ascending: false })
    if (error) return fail(error.message)
    return ok(data)
  },
)

// -- Transações (financeiro por projeto) ----------------------------------------

server.tool(
  'project_transactions',
  'Lista transações (lançamentos) de um projeto, com soma total.',
  { project_id: z.string().uuid() },
  async ({ project_id }) => {
    const { data, error } = await db
      .from('transactions')
      .select('id, title, amount, unit, tx_date')
      .eq('project_id', project_id)
      .order('tx_date', { ascending: false })
    if (error) return fail(error.message)
    const total = (data ?? []).reduce((acc, r) => acc + Number(r.amount ?? 0), 0)
    return ok({ transactions: data, total })
  },
)

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport()
await server.connect(transport)
console.error(
  `[soucrum-mcp] pronto — url=${SUPABASE_URL} modo=${READ_ONLY ? 'somente-leitura' : 'leitura-escrita'} auth=${USER_JWT ? 'jwt-usuario' : 'chave-direta'}`,
)
