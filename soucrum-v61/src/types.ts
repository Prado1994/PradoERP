/** Tipos espelhando o esquema real do v6.1. Ver supabase/v6.1/01_schema.sql. */

export type ColorName = 'accent' | 'info' | 'violet' | 'warn' | 'success'

/**
 * Fluxo de status. É texto livre no banco, sem enum e sem check.
 *
 * ATENÇÃO: **não existe 'done'.** Conclusão de rotina se registra em
 * `last_done`. Para tarefa comum, o progresso vive no checklist. Inventar um
 * status 'done' aqui sujaria os dados do app real.
 */
export const STATUSES = ['jot', 'extracted', 'refined', 'scheduled'] as const
export type Status = (typeof STATUSES)[number]

export const STATUS_LABEL: Record<Status, string> = {
  jot: 'Anotado',
  extracted: 'Extraído',
  refined: 'Refinado',
  scheduled: 'Agendado',
}

/** Quadrantes de Eisenhower, como gravados no banco. */
export type Eisenhower = 'do' | 'schedule' | 'delegate' | 'delete'

export const EISENHOWER_LABEL: Record<Eisenhower, string> = {
  do: 'Faça agora',
  schedule: 'Agende',
  delegate: 'Delegue',
  delete: 'Descarte',
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
  due?: string
}

export interface Comment {
  id: string
  text: string
  author: string
  at: string
}

export interface SObject {
  id: string
  owner_id: string
  project_id: string | null
  parent_id: string | null
  type: string
  title: string
  body: string | null
  tags: string[] | null
  status: string
  area: string | null
  due_date: string | null
  started_at: string | null
  eisenhower: string | null
  pom_est: number | null
  pom_done: number | null
  show_in_agenda: boolean | null
  recurrence: string | null
  last_done: string | null
  assignee: string | null
  checklist: ChecklistItem[] | null
  comments: Comment[] | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  owner_id: string
  name: string
  color: string
  workspace_id: string | null
  deadline: string | null
  description: string | null
  created_at: string
}

export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface Page {
  id: string
  project_id: string | null
  title: string
  content: string | null
  updated_at: string
}

export type ViewName = 'hoje' | 'quadro' | 'rotinas' | 'projetos' | 'paginas' | 'foco'
