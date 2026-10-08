import type { OrdemProducao } from './tipos.js';

/**
 * Reprograma a previsão ATUAL. A previsão inicial nunca muda e cada mudança
 * fica no histórico, com motivo obrigatório.
 */
export function reprogramar(o: OrdemProducao, para: Date, motivo: string, agora = new Date()): OrdemProducao {
  if (!motivo.trim()) throw new Error('Motivo da reprogramação é obrigatório.');
  if (Number.isNaN(para.getTime())) throw new Error('Data inválida.');
  return {
    ...o,
    previsaoAtual: para,
    historicoPrevisao: [...o.historicoPrevisao, { em: agora, de: o.previsaoAtual, para, motivo: motivo.trim() }],
  };
}
