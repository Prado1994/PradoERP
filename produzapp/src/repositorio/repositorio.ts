import type { EventoEtapa, ItemFila, OrdemProducao, Parada, ResultadoLeitura, TokenIntegracao } from '../dominio/tipos.js';
import type { PedidoEntrada } from '../dominio/pedidos.js';
import type { Sigla } from '../dominio/etapas.js';

/**
 * Contrato de persistência. Tudo assíncrono para que a versão PostgreSQL
 * (fase seguinte) entre sem mudar o domínio.
 */
export interface Repositorio {
  // Ordens
  salvarOrdem(o: OrdemProducao): Promise<void>;
  buscarOrdem(id: string): Promise<OrdemProducao | undefined>;
  buscarOrdemPorCodigo(op: string, caixa: string): Promise<OrdemProducao | undefined>;
  buscarOrdensPorOp(op: string): Promise<OrdemProducao[]>;
  listarOrdens(): Promise<OrdemProducao[]>;

  // Eventos (somente inclusão)
  adicionarEvento(e: EventoEtapa): Promise<void>;
  eventosDaOrdem(ordemId: string): Promise<EventoEtapa[]>;
  todosEventos(): Promise<EventoEtapa[]>;

  // Idempotência de leituras
  buscarLeitura(idLeitura: string): Promise<ResultadoLeitura | undefined>;
  guardarLeitura(r: ResultadoLeitura): Promise<void>;

  // Paradas
  abrirParada(p: Parada): Promise<void>;
  paradaAberta(sigla: Sigla): Promise<Parada | undefined>;
  fecharParada(id: string, fim: Date): Promise<void>;
  listarParadas(): Promise<Parada[]>;

  // Fila de sincronização
  enfileirar(item: ItemFila): Promise<void>;
  filaPronta(agora: Date): Promise<ItemFila[]>;
  atualizarItemFila(item: ItemFila): Promise<void>;
  listarFila(): Promise<ItemFila[]>;

  // Caixa de entrada de pedidos
  salvarPedido(p: PedidoEntrada): Promise<void>;
  buscarPedido(id: string): Promise<PedidoEntrada | undefined>;
  buscarPedidoPorOrigem(origem: string, idExterno: string): Promise<PedidoEntrada | undefined>;
  listarPedidos(): Promise<PedidoEntrada[]>;

  // Credenciais das integrações
  lerToken(nome: string): Promise<TokenIntegracao | undefined>;
  gravarToken(t: TokenIntegracao): Promise<void>;
}
