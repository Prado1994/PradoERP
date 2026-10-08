import { randomUUID } from 'node:crypto';
import type { OrdemProducao } from '../src/dominio/tipos.js';

export const HOJE = new Date('2026-10-08T12:00:00');
const DIA = 86_400_000;
const dia0 = new Date('2026-10-08T00:00:00').getTime();

export function ordem(extra: Partial<OrdemProducao> & { entradaHaDias?: number; prazoDias?: number } = {}): OrdemProducao {
  const entrada = new Date(dia0 - (extra.entradaHaDias ?? 2) * DIA);
  const previsao = new Date(entrada.getTime() + (extra.prazoDias ?? 10) * DIA);
  return {
    id: randomUUID(), op: '00101', caixa: '01', cliente: 'Estoque Prado', produto: '40501 · Bota elástica ECO PVC',
    pares: 20, entrada, previsaoInicial: previsao, previsaoAtual: previsao, historicoPrevisao: [], criadaEm: entrada,
    ...extra,
  };
}
