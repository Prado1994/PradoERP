/** As 7 etapas do fluxo de produção, na ordem. Definição oficial (out/2026). */
export const ETAPAS = [
  { sigla: 'COR', nome: 'Corte' },
  { sigla: 'PES', nome: 'Pesponto' },
  { sigla: 'EST', nome: 'Esteira de Montagem' },
  { sigla: 'INJ', nome: 'Injetora' },
  { sigla: 'ACA', nome: 'Esteira de Acabamento' },
  { sigla: 'EMB', nome: 'Embalagem' },
  { sigla: 'EXP', nome: 'Expedição' },
] as const;

export type Sigla = (typeof ETAPAS)[number]['sigla'];
export const TOTAL_ETAPAS = ETAPAS.length;

export function indiceEtapa(sigla: string): number {
  return ETAPAS.findIndex((e) => e.sigla === sigla);
}

export function ehSigla(valor: string): valor is Sigla {
  return indiceEtapa(valor) >= 0;
}

export function nomeEtapa(sigla: string): string {
  return ETAPAS.find((e) => e.sigla === sigla)?.nome ?? sigla;
}
