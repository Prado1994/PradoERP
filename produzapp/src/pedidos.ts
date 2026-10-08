import { randomUUID } from 'node:crypto';
import type { Repositorio } from './repositorio/repositorio.js';
import type { OrdemProducao } from './dominio/tipos.js';
import { consolidar, mesclarPedido, SEM_CODIGO, type LinhaProgramada, type PedidoEntrada } from './dominio/pedidos.js';
import { inicioDoDia } from './dominio/prazos.js';
import { pad } from './dominio/codigo.js';

/** Pedido como chega de uma origem, já traduzido para o formato do produzapp. */
export interface PedidoRecebido extends Omit<PedidoEntrada, 'id' | 'status' | 'recebidoEm' | 'atualizadoEm'> {
  /** A origem marcou o pedido como cancelado. */
  cancelado: boolean;
}

export type ResultadoRecebimento = 'novo' | 'atualizado' | 'ignorado';

/**
 * Entrada de pedido na caixa. Reenviar o mesmo pedido nunca duplica nem desfaz o que o PCP já decidiu.
 * Pedido novo e já cancelado não entra na caixa.
 */
export async function receberPedido(repo: Repositorio, r: PedidoRecebido, agora = new Date()): Promise<{ resultado: ResultadoRecebimento; pedido?: PedidoEntrada }> {
  const { cancelado, ...dados } = r;
  const atual = await repo.buscarPedidoPorOrigem(r.origem, r.idExterno);
  if (!atual) {
    if (cancelado) return { resultado: 'ignorado' };
    const novo: PedidoEntrada = { ...dados, id: randomUUID(), status: 'a_programar', recebidoEm: agora, atualizadoEm: agora };
    await repo.salvarPedido(novo);
    return { resultado: 'novo', pedido: novo };
  }
  const mesclado = mesclarPedido(atual, dados, cancelado, agora);
  await repo.salvarPedido(mesclado);
  return { resultado: 'atualizado', pedido: mesclado };
}

export interface LinhaProgramacao {
  modelo: string;
  /** Pares por caixa (1 a 20). A última caixa leva o resto. */
  paresPorCaixa: number;
  /** Se omitida, vale a previsão geral. */
  previsaoInicial?: Date;
  /** Número da OP; se omitido, usa o próximo livre. */
  op?: string;
}

export interface EntradaProgramacao {
  linhas: LinhaProgramacao[];
  previsaoInicial?: Date;
  observacaoPcp?: string;
  entrada?: Date;
}

export class ErroProgramacao extends Error {
  constructor(readonly status: 404 | 409 | 422, mensagem: string) { super(mensagem); }
}

/** Transforma um pedido "a programar" em OPs (uma por caixa), com a previsão inicial definida pelo PCP. */
export async function programarPedido(repo: Repositorio, pedidoId: string, e: EntradaProgramacao, agora = new Date()) {
  const pedido = await repo.buscarPedido(pedidoId);
  if (!pedido) throw new ErroProgramacao(404, 'Pedido não encontrado.');
  if (pedido.status === 'programado') throw new ErroProgramacao(409, 'Este pedido já foi programado.');
  if (pedido.status === 'cancelado_na_origem') throw new ErroProgramacao(409, 'Pedido cancelado na origem: não pode ser programado.');

  const consolidado = consolidar(pedido);
  const entrada = inicioDoDia(e.entrada ?? agora);

  // ---- valida tudo antes de criar qualquer OP ----
  const porModelo = new Map(e.linhas.map((l) => [l.modelo, l]));
  if (porModelo.size !== e.linhas.length) throw new ErroProgramacao(422, 'Modelo repetido na programação.');
  for (const c of consolidado) {
    if (c.modelo === SEM_CODIGO) throw new ErroProgramacao(422, 'Há itens sem código de modelo. Corrija o cadastro no Bling e sincronize de novo.');
    if (!porModelo.has(c.modelo)) throw new ErroProgramacao(422, `Falta programar o modelo ${c.modelo}.`);
  }
  for (const l of e.linhas) {
    if (!consolidado.some((c) => c.modelo === l.modelo)) throw new ErroProgramacao(422, `Modelo ${l.modelo} não está no pedido.`);
    if (!Number.isInteger(l.paresPorCaixa) || l.paresPorCaixa < 1 || l.paresPorCaixa > 20) {
      throw new ErroProgramacao(422, `Modelo ${l.modelo}: pares por caixa deve ser de 1 a 20.`);
    }
    const prev = l.previsaoInicial ?? e.previsaoInicial;
    if (!prev) throw new ErroProgramacao(422, `Modelo ${l.modelo}: informe a previsão inicial.`);
    if (inicioDoDia(prev) < entrada) throw new ErroProgramacao(422, `Modelo ${l.modelo}: a previsão inicial não pode ser antes da entrada.`);
  }

  // ---- numeração das OPs ----
  const existentes = await repo.listarOrdens();
  let proximo = existentes.reduce((m, o) => Math.max(m, Number(o.op) || 0), 0) + 1;
  const ordens: OrdemProducao[] = [];
  const programacao: LinhaProgramada[] = [];
  for (const c of consolidado) {
    const l = porModelo.get(c.modelo)!;
    const op = l.op ? pad(l.op, 5) : pad(String(proximo++), 5);
    const previsao = inicioDoDia(l.previsaoInicial ?? e.previsaoInicial!);
    const caixas = Math.ceil(c.pares / l.paresPorCaixa);
    for (let n = 1; n <= caixas; n++) {
      ordens.push({
        id: randomUUID(), op, caixa: pad(String(n), 2), plano: `Pedido ${pedido.numero}`, pedidoId: pedido.id,
        cliente: pedido.cliente, produto: `${c.modelo} · ${c.descricao}`,
        pares: n < caixas ? l.paresPorCaixa : c.pares - l.paresPorCaixa * (caixas - 1),
        entrada, previsaoInicial: previsao, previsaoAtual: previsao, historicoPrevisao: [], criadaEm: agora,
      });
    }
    programacao.push({ modelo: c.modelo, op, caixas, pares: c.pares, paresPorCaixa: l.paresPorCaixa, previsaoInicial: previsao });
  }
  for (const o of ordens) {
    if (await repo.buscarOrdemPorCodigo(o.op, o.caixa)) throw new ErroProgramacao(409, `OP ${o.op} caixa ${o.caixa} já existe.`);
  }

  for (const o of ordens) await repo.salvarOrdem(o);
  const atualizado: PedidoEntrada = {
    ...pedido, status: 'programado', programadoEm: agora, programacao, atualizadoEm: agora,
    observacaoPcp: e.observacaoPcp?.trim() || undefined, alerta: undefined,
  };
  await repo.salvarPedido(atualizado);
  return { pedido: atualizado, ordens };
}
