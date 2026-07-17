export type ColorName = 'accent' | 'info' | 'violet' | 'warn' | 'success'

export type StageId = 'novo' | 'contato' | 'proposta' | 'negociacao' | 'fechado'

export type ViewId =
  | 'dashboard'
  | 'inbox'
  | 'pipeline'
  | 'contacts'
  | 'settings'
  | 'hoje'
  | 'projetos'
  | 'documentos'
  | 'materiais'
  | 'calendario'
  | 'foco'
  | 'relatorios'
  | 'rotinas'

export interface Contact {
  id: string
  name: string
  company: string
  email: string
  phone: string
  tag: 'Cliente' | 'Lead'
  status: string
  initials: string
  color: ColorName
}

export interface Deal {
  id: string
  company: string
  title: string
  contactId: string | null
  stageId: StageId
  value: number
  initials: string
  color: ColorName
}

export interface ThreadMessage {
  fromMe: boolean
  name: string
  text: string
  time: string
}

export interface Email {
  id: string
  contactId: string
  contactName: string
  company: string
  subject: string
  preview: string
  time: string
  unread: boolean
  initials: string
  color: ColorName
  thread: ThreadMessage[]
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  initials: string
  color: ColorName
}

export interface StageDef {
  id: StageId
  name: string
  color: string
}
