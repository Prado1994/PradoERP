import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { hoje } from './domain'
import type { Page, Project, SObject, Workspace } from './types'

/**
 * Carrega e altera os dados do usuário logado.
 *
 * Não filtra por owner_id em nenhuma query: a RLS já entrega só o que a pessoa
 * pode ver — o próprio material mais o dos projetos cujo workspace ela integra.
 * Filtrar aqui esconderia justamente o trabalho compartilhado.
 */
export function useDados(userId: string | null) {
  const [objetos, setObjetos] = useState<SObject[]>([])
  const [projetos, setProjetos] = useState<Project[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [paginas, setPaginas] = useState<Page[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!userId) return
    setCarregando(true)
    setErro(null)
    const [o, p, w, g] = await Promise.all([
      supabase.from('objects').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('created_at'),
      supabase.from('workspaces').select('*').order('created_at'),
      supabase.from('pages').select('*').order('updated_at', { ascending: false }),
    ])
    const falha = o.error ?? p.error ?? w.error ?? g.error
    if (falha) setErro(falha.message)
    setObjetos((o.data as SObject[]) ?? [])
    setProjetos((p.data as Project[]) ?? [])
    setWorkspaces((w.data as Workspace[]) ?? [])
    setPaginas((g.data as Page[]) ?? [])
    setCarregando(false)
  }, [userId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /** Aplica a mudança na tela antes da resposta e desfaz se o banco recusar. */
  const patch = useCallback(
    async (id: string, campos: Partial<SObject>) => {
      const antes = objetos
      setObjetos((atual) => atual.map((o) => (o.id === id ? { ...o, ...campos } : o)))
      const { error } = await supabase
        .from('objects')
        .update({ ...campos, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) {
        setObjetos(antes)
        setErro(error.message)
      }
    },
    [objetos],
  )

  const mudarStatus = useCallback((id: string, status: string) => patch(id, { status }), [patch])

  /** Fecha o ciclo da rotina de hoje. Escreve em last_done — nunca em status. */
  const concluirHoje = useCallback((id: string) => patch(id, { last_done: hoje() }), [patch])

  const reabrirHoje = useCallback((id: string) => patch(id, { last_done: null }), [patch])

  const somarPomodoro = useCallback(
    (id: string, delta: number) => {
      const o = objetos.find((x) => x.id === id)
      if (!o) return
      const novo = Math.max(0, (o.pom_done ?? 0) + delta)
      return patch(id, { pom_done: novo })
    },
    [objetos, patch],
  )

  const alternarItem = useCallback(
    (id: string, itemId: string) => {
      const o = objetos.find((x) => x.id === id)
      if (!o?.checklist) return
      const checklist = o.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i))
      return patch(id, { checklist })
    },
    [objetos, patch],
  )

  const alternarAgenda = useCallback(
    (id: string) => {
      const o = objetos.find((x) => x.id === id)
      if (!o) return
      return patch(id, { show_in_agenda: !o.show_in_agenda })
    },
    [objetos, patch],
  )

  return {
    objetos,
    projetos,
    workspaces,
    paginas,
    carregando,
    erro,
    recarregar: carregar,
    mudarStatus,
    concluirHoje,
    reabrirHoje,
    somarPomodoro,
    alternarItem,
    alternarAgenda,
    limparErro: () => setErro(null),
  }
}
