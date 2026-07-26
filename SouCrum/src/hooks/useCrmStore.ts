import { useMemo, useState } from 'react'
import {
  initialContacts,
  initialDeals,
  initialEmails,
  initialTeam,
} from '../data'
import type { Contact, Deal, Email, StageId, TeamMember, ViewId } from '../types'

export interface NotifSettings {
  email: boolean
  deals: boolean
  weekly: boolean
}

/**
 * Central store for the SouCrum prototype. Mirrors the state model of the
 * original design and exposes typed actions. All data lives in memory —
 * swap these actions for API/Supabase calls when wiring a real backend.
 */
export function useCrmStore() {
  const [currentView, setCurrentView] = useState<ViewId>('dashboard')
  // O visual é escuro por natureza; o modo claro é a variação, não o padrão.
  const [darkMode, setDarkMode] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [emails, setEmails] = useState<Email[]>(initialEmails)
  const [team, setTeam] = useState<TeamMember[]>(initialTeam)

  const [selectedEmailId, setSelectedEmailId] = useState<string | null>('e1')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)

  const [contactSearch, setContactSearch] = useState('')
  const [dealSearch, setDealSearch] = useState('')
  const [emailSearch, setEmailSearch] = useState('')
  const [composeText, setComposeText] = useState('')

  const [draggedDealId, setDraggedDealId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<StageId | null>(null)

  const [notif, setNotif] = useState<NotifSettings>({
    email: true,
    deals: true,
    weekly: false,
  })

  const actions = useMemo(
    () => ({
      goTo(view: ViewId) {
        setCurrentView(view)
        setSelectedContactId(null)
      },
      toggleSidebar() {
        setSidebarCollapsed((v) => !v)
      },
      toggleDark() {
        setDarkMode((v) => !v)
      },
      selectEmail(id: string) {
        setSelectedEmailId(id)
        setEmails((es) => es.map((e) => (e.id === id ? { ...e, unread: false } : e)))
      },
      sendReply() {
        const text = composeText.trim()
        if (!text || !selectedEmailId) return
        setEmails((es) =>
          es.map((e) =>
            e.id === selectedEmailId
              ? { ...e, thread: [...e.thread, { fromMe: true, name: 'Você', text, time: 'agora' }] }
              : e,
          ),
        )
        setComposeText('')
      },
      startDrag(id: string) {
        setDraggedDealId(id)
      },
      endDrag() {
        setDraggedDealId(null)
        setDragOverStage(null)
      },
      hoverStage(stageId: StageId) {
        setDragOverStage((cur) => (cur === stageId ? cur : stageId))
      },
      leaveStage() {
        setDragOverStage(null)
      },
      dropOnStage(stageId: StageId) {
        setDeals((ds) =>
          draggedDealId ? ds.map((d) => (d.id === draggedDealId ? { ...d, stageId } : d)) : ds,
        )
        setDraggedDealId(null)
        setDragOverStage(null)
      },
      addDeal() {
        const id = 'd' + Date.now()
        setDeals((ds) => [
          ...ds,
          { id, company: 'Nova empresa', title: 'Novo negócio', contactId: null, stageId: 'novo', value: 5000, initials: 'NE', color: 'accent' },
        ])
      },
      addContact() {
        const id = 'c' + Date.now()
        setContacts((cs) => [
          ...cs,
          { id, name: 'Novo contato', company: 'Empresa', email: 'novo@empresa.com', phone: '(00) 00000-0000', tag: 'Lead', status: 'Novo', initials: 'NC', color: 'info' },
        ])
        setSelectedContactId(id)
      },
      addMember() {
        const id = 't' + Date.now()
        setTeam((ts) => [
          ...ts,
          { id, name: 'Novo membro', email: 'novo@soucrum.com', role: 'Convidado', initials: 'NM', color: 'warn' },
        ])
      },
      selectContact(id: string | null) {
        setSelectedContactId(id)
      },
      toggleNotif(key: keyof NotifSettings) {
        setNotif((n) => ({ ...n, [key]: !n[key] }))
      },
    }),
    [composeText, selectedEmailId, draggedDealId],
  )

  return {
    // state
    currentView,
    darkMode,
    sidebarCollapsed,
    contacts,
    deals,
    emails,
    team,
    selectedEmailId,
    selectedContactId,
    contactSearch,
    dealSearch,
    emailSearch,
    composeText,
    draggedDealId,
    dragOverStage,
    notif,
    // setters used directly by controlled inputs
    setContactSearch,
    setDealSearch,
    setEmailSearch,
    setComposeText,
    // grouped actions
    ...actions,
  }
}

export type CrmStore = ReturnType<typeof useCrmStore>
