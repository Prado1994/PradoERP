import type { Repositorio } from './repositorio/repositorio.js';
import type { Destino } from './integracoes/destino.js';
import type { DestinoSync } from './dominio/tipos.js';

/** Espera antes de cada nova tentativa (segundos): 30 s, 2 min, 10 min, 30 min. */
export const ESPERAS_SEGUNDOS = [30, 120, 600, 1800];
export const MAX_TENTATIVAS = ESPERAS_SEGUNDOS.length + 1;

export interface ResumoSincronizacao { enviados: number; reagendados: number; falhas: number }

/**
 * Esvazia a fila de envio. Chamada periodicamente (ex.: a cada 10 s).
 * Um erro de rede ou do Bling nunca afeta a leitura do operador: o item só espera e tenta de novo.
 */
export async function processarFila(
  repo: Repositorio,
  destinos: Partial<Record<DestinoSync, Destino>>,
  agora: Date = new Date(),
): Promise<ResumoSincronizacao> {
  const resumo: ResumoSincronizacao = { enviados: 0, reagendados: 0, falhas: 0 };

  for (const item of await repo.filaPronta(agora)) {
    const destino = destinos[item.destino];
    if (!destino) continue; // destino ainda não configurado: o item espera na fila

    try {
      await destino.enviar(item);
      await repo.atualizarItemFila({ ...item, status: 'enviado', tentativas: item.tentativas + 1, ultimoErro: undefined });
      resumo.enviados++;
    } catch (e) {
      const tentativas = item.tentativas + 1;
      const erro = e instanceof Error ? e.message : String(e);
      if (tentativas >= MAX_TENTATIVAS) {
        await repo.atualizarItemFila({ ...item, tentativas, status: 'falha', ultimoErro: erro });
        resumo.falhas++;
      } else {
        const espera = ESPERAS_SEGUNDOS[tentativas - 1]!;
        await repo.atualizarItemFila({
          ...item, tentativas, ultimoErro: erro, proximaTentativa: new Date(agora.getTime() + espera * 1000),
        });
        resumo.reagendados++;
      }
    }
  }
  return resumo;
}
