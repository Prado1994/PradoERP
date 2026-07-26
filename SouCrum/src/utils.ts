/** Formats a number as Brazilian Real currency. */
export function fmt(v: number): string {
  return 'R$ ' + Math.round(v).toLocaleString('pt-BR')
}
