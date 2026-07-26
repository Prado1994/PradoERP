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

const SERVER_NAME = 'soucrum'
const SERVER_VERSION = '0.1.0'

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
})

/** Ferramentas que alteram dados — usado para rotular o /health. */
const WRITE_TOOLS = new Set([
  'create_task',
  'update_task',
  'complete_routine',
  'link_gcal_event',
  'create_task_from_email',
])

/** Catálogo das ferramentas registradas, exposto pelo endpoint /health. */
const registeredTools: { name: string; description: string; write: boolean }[] = []

/**
 * Registra a ferramenta no servidor MCP e no catálogo, para que o endpoint
 * /health possa listar exatamente o que está ativo.
 */
function reg<S extends z.ZodRawShape>(
  name: string,
  description: string,
  schema: S,
  handler: (args: z.infer<z.ZodObject<S>>) => ToolResult | Promise<ToolResult>,
): void {
  registeredTools.push({ name, description, write: WRITE_TOOLS.has(name) })
  // server.tool é sobrecarregado; o cast preserva a inferência feita acima.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(server.tool as any)(name, description, schema, handler)
}

// -- Workspaces --------------------------------------------------------------

reg(
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

reg(
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

reg(
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

reg(
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

reg(
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

reg(
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

reg(
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
  reg(
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

  reg(
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

  reg(
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

reg(
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
  reg(
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

reg(
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

reg(
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
  reg(
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

reg(
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

reg(
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

reg(
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

reg(
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

reg(
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

reg(
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
// Endpoint de health (opcional)
// ---------------------------------------------------------------------------
//
// Ativado com SOUCRUM_HTTP_PORT. Serve GET /health para a tela de
// Configurações do SouCrum mostrar o estado real da conexão: versão, modo,
// ferramentas ativas e se o Supabase responde.
//
// NÃO expõe a chave nem dado de negócio — só metadados do servidor.

const HTTP_PORT = Number(process.env.SOUCRUM_HTTP_PORT ?? 0)

/** Origens remotas liberadas. Localhost é aceito em qualquer porta (ver abaixo). */
const ALLOWED_ORIGINS = (process.env.SOUCRUM_HTTP_ALLOWED_ORIGINS ?? 'https://soucrum.vercel.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

/**
 * Aceita qualquer porta de localhost/127.0.0.1 — o app pode rodar em 5173, 4173
 * ou qualquer porta de dev, e tudo isso é a própria máquina do usuário. Sites da
 * internet continuam bloqueados, a menos que listados em
 * SOUCRUM_HTTP_ALLOWED_ORIGINS.
 */
function originPermitida(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  try {
    const { hostname, protocol } = new URL(origin)
    return protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')
  } catch {
    return false
  }
}

/**
 * Em falha de rede o supabase-js devolve `message` vazio e joga o motivo em
 * `details`/`code`. Sem isso a tela mostraria "não conecta" sem explicar por quê.
 */
function describeError(error: { message?: string; details?: string; hint?: string; code?: string }): string {
  const parts = [error.message, error.details, error.hint].filter((p) => p && p.trim() !== '')
  const texto = parts.join(' · ')
  if (texto) return error.code ? `${texto} (${error.code})` : texto
  return error.code ? `falha na requisição (${error.code})` : 'falha ao conectar no Supabase'
}

/** Confere se o Supabase responde, sem trazer dados. */
async function checkSupabase(): Promise<{ reachable: boolean; latency_ms: number; error?: string }> {
  const started = Date.now()
  try {
    const { error } = await db.from('projects').select('id', { count: 'exact', head: true }).limit(1)
    const latency_ms = Date.now() - started
    if (error) return { reachable: false, latency_ms, error: describeError(error) }
    return { reachable: true, latency_ms }
  } catch (e) {
    return {
      reachable: false,
      latency_ms: Date.now() - started,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    }
  }
}

function startHealthServer(port: number): void {
  // Import dinâmico: quem não usa o health não carrega o módulo http.
  import('node:http')
    .then(({ createServer }) => {
      const httpServer = createServer(async (req, res) => {
        const origin = req.headers.origin
        // Só devolve CORS para origens conhecidas — evita que qualquer site
        // sonde a porta e descubra que o servidor está rodando aqui.
        if (origin && originPermitida(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin)
          res.setHeader('Vary', 'Origin')
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.writeHead(204).end()
          return
        }
        if (req.method !== 'GET' || !req.url?.startsWith('/health')) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'not found' }))
          return
        }

        const supabase = await checkSupabase()
        const body = {
          ok: supabase.reachable,
          name: SERVER_NAME,
          version: SERVER_VERSION,
          mode: READ_ONLY ? 'read-only' : 'read-write',
          auth: USER_JWT ? 'user-jwt' : 'direct-key',
          supabase: { url: SUPABASE_URL, ...supabase },
          tool_count: registeredTools.length,
          write_tool_count: registeredTools.filter((t) => t.write).length,
          tools: registeredTools,
          checked_at: new Date().toISOString(),
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(body))
      })

      httpServer.on('error', (err) => {
        console.error(`[soucrum-mcp] health indisponível na porta ${port}: ${err.message}`)
      })
      // Escuta apenas em loopback: nada exposto na rede local.
      httpServer.listen(port, '127.0.0.1', () => {
        console.error(`[soucrum-mcp] health em http://127.0.0.1:${port}/health`)
      })
    })
    .catch((err) => {
      console.error(`[soucrum-mcp] falha ao iniciar health: ${String(err)}`)
    })
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport()
await server.connect(transport)

if (HTTP_PORT > 0) startHealthServer(HTTP_PORT)

console.error(
  `[soucrum-mcp] pronto — url=${SUPABASE_URL} modo=${READ_ONLY ? 'somente-leitura' : 'leitura-escrita'} auth=${USER_JWT ? 'jwt-usuario' : 'chave-direta'} ferramentas=${registeredTools.length}`,
)
