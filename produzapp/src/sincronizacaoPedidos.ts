import type { Repositorio } from './repositorio/repositorio.js';
import type { FontePedidos } from './integracoes/bling-pedidos.js';
import { receberPedido } from './pedidos.js';

export interface ResumoPedidos { novos: number; atualizados: number; ignorados: number }

/** Traz da origem os pedidos alterados desde `desde` e atualiza a caixa de entrada. Pode rodar quantas vezes quiser. */
export async function sincronizarPedidos(repo: Repositorio, fonte: FontePedidos, desde: Date, agora = new Date()): Promise<ResumoPedidos> {
  const resumo: ResumoPedidos = { novos: 0, atualizados: 0, ignorados: 0 };
  const lista = await fonte.listarAlterados(desde, async (id) => !!(await repo.buscarPedidoPorOrigem(fonte.origem, id)));
  for (const p of lista) {
    const { resultado } = await receberPedido(repo, p, agora);
    resultado === 'novo' ? resumo.novos++ : resultado === 'atualizado' ? resumo.atualizados++ : resumo.ignorados++;
  }
  return resumo;
}
