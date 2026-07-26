import type { SObject } from './types'

/**
 * Regras de domínio do SouCrum. Ficam juntas aqui porque são fáceis de errar
 * de um jeito que só aparece depois — e já erraram antes.
 */

/** Data local em YYYY-MM-DD. `new Date().toISOString()` daria UTC e viraria o
 *  dia errado à noite no Brasil (UTC-3), marcando tarefa de hoje como atrasada. */
export function hoje(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

export function isRotina(o: SObject): boolean {
  return !!o.recurrence
}

/** Rotina cujo ciclo de hoje ainda não foi fechado. */
export function rotinaPendente(o: SObject, ref = hoje()): boolean {
  return isRotina(o) && o.last_done !== ref
}

/**
 * Atrasada = tinha prazo antes de hoje e não foi concluída hoje.
 *
 * A segunda metade importa: sem ela, uma rotina diária com prazo antigo
 * apareceria como atrasada para sempre, mesmo fechada hoje.
 */
export function isAtrasada(o: SObject, ref = hoje()): boolean {
  if (!o.due_date) return false
  if (o.last_done === ref) return false
  return o.due_date < ref
}

export function diasDeAtraso(o: SObject, ref = hoje()): number {
  if (!o.due_date) return 0
  const ms = Date.parse(ref) - Date.parse(o.due_date)
  return Math.max(0, Math.round(ms / 86_400_000))
}

/** Entra na agenda de hoje: marcada à mão, vence hoje, atrasada, ou rotina do dia. */
export function naAgendaDeHoje(o: SObject, ref = hoje()): boolean {
  if (o.show_in_agenda) return true
  if (o.due_date === ref) return true
  if (isAtrasada(o, ref)) return true
  return rotinaPendente(o, ref)
}

export function progressoChecklist(o: SObject): { feitos: number; total: number } {
  const itens = o.checklist ?? []
  return { feitos: itens.filter((i) => i.done).length, total: itens.length }
}

export function formatarData(iso: string | null): string {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a.slice(2)}`
}

export const RECORRENCIA_LABEL: Record<string, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  weekdays: 'Dias úteis',
}

export function labelRecorrencia(r: string | null): string {
  if (!r) return ''
  return RECORRENCIA_LABEL[r] ?? r
}
