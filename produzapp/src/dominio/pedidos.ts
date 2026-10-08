/**
 * Caixa de entrada de pedidos: o pedido de venda chega de fora (hoje, Bling) e fica "a programar"
 * até o PCP decidir quando e como produzir. O núcleo não sabe de onde o pedido veio: só guarda `origem`.
 */

export interface ItemPedido {
  idExterno: string;
  produtoIdExterno?: string;
  /** Código do cadastro de origem. Vazio em cadastros antigos: nesse caso o modelo é lido da descrição. */
  codigo?: string;
  descricao: string;
  quantidade: number;
}

export type StatusPedido = 'a_programar' | 'programado' | 'cancelado_na_origem';

export interface LinhaProgramada {
  modelo: string;
  op: string;
  caixas: number;
  pares: number;
  paresPorCaixa: number;
  previsaoInicial: Date;
}

export interface PedidoEntrada {
  id: string;
  origem: string; // ex.: "bling"
  idExterno: string;
  numero: string;
  cliente: string;
  documentoCliente?: string;
  dataPedido?: Date;
  /** Data prevista que veio do pedido. Quase sempre vazia: a previsão inicial é preenchida pelo PCP. */
  previsaoExterna?: Date;
  situacaoExterna?: string;
  total?: number;
  itens: ItemPedido[];
  status: StatusPedido;
  observacaoPcp?: string;
  programadoEm?: Date;
  programacao?: LinhaProgramada[];
  /** Aviso para o PCP (ex.: pedido cancelado ou alterado depois de programado). */
  alerta?: string;
  recebidoEm: Date;
  atualizadoEm: Date;
}

export interface LinhaConsolidada {
  /** Ex.: "45501". "SEM-CODIGO" quando não foi possível identificar o modelo. */
  modelo: string;
  descricao: string;
  pares: number;
  /** Tamanho -> pares. */
  grade: Record<string, number>;
  /** O modelo foi deduzido da descrição (cadastro sem código): confira antes de programar. */
  modeloPelaDescricao: boolean;
  semCodigo: boolean;
}

export const SEM_CODIGO = 'SEM-CODIGO';

const RE_MODELO = /^\s*([A-Z]{0,3}\d{4,6}[A-Z]{0,2})\b/;
const RE_MODELO_DESCRICAO = /^\s*([A-Z]{0,3}\d{4,6}[A-Z]{0,2})\s*[-–:]/;
const RE_TAMANHO = /tamanho\s*[:=]?\s*(\d{2}(?:[.,]5)?)\s*$/i;

export function tamanhoDoItem(i: ItemPedido): string | undefined {
  const m = i.descricao.match(RE_TAMANHO);
  if (m) return m[1]!.replace(',', '.');
  const c = i.codigo?.match(/[-./_ ](\d{2})$/);
  return c?.[1];
}

/** Descrição sem o sufixo "Tamanho:NN", para agrupar as linhas da grade. */
export const descricaoBase = (d: string) => d.replace(/\s*tamanho\s*[:=]?\s*\d{2}(?:[.,]5)?\s*$/i, '').trim();

export function modeloDoItem(i: ItemPedido): { modelo: string; pelaDescricao: boolean } {
  const c = i.codigo?.trim().toUpperCase().match(RE_MODELO);
  if (c) return { modelo: c[1]!, pelaDescricao: false };
  const d = i.descricao.toUpperCase().match(RE_MODELO_DESCRICAO);
  if (d) return { modelo: d[1]!, pelaDescricao: true };
  return { modelo: SEM_CODIGO, pelaDescricao: false };
}

/** Soma as linhas da grade (um item por tamanho) em uma linha por modelo. */
export function consolidar(p: Pick<PedidoEntrada, 'itens'>): LinhaConsolidada[] {
  const mapa = new Map<string, LinhaConsolidada>();
  for (const i of p.itens) {
    const { modelo, pelaDescricao } = modeloDoItem(i);
    let l = mapa.get(modelo);
    if (!l) {
      l = { modelo, descricao: descricaoBase(i.descricao).replace(/^\s*[A-Z]{0,3}\d{4,6}[A-Z]{0,2}\s*[-–:]\s*/i, ''), pares: 0, grade: {}, modeloPelaDescricao: false, semCodigo: modelo === SEM_CODIGO };
      mapa.set(modelo, l);
    }
    l.pares += i.quantidade;
    l.modeloPelaDescricao ||= pelaDescricao;
    const t = tamanhoDoItem(i);
    if (t) l.grade[t] = (l.grade[t] ?? 0) + i.quantidade;
  }
  return [...mapa.values()];
}

const assinatura = (itens: ItemPedido[]) =>
  JSON.stringify([...itens].map((i) => [i.idExterno, i.codigo ?? '', i.descricao, i.quantidade]).sort());

/**
 * Atualiza um pedido já conhecido com a versão nova vinda da origem, sem perder o que o PCP já decidiu.
 * `cancelado` indica que a origem passou o pedido para cancelado.
 */
export function mesclarPedido(atual: PedidoEntrada, novo: Omit<PedidoEntrada, 'id' | 'status' | 'recebidoEm' | 'atualizadoEm'>, cancelado: boolean, agora: Date): PedidoEntrada {
  const base: PedidoEntrada = { ...atual, ...novo, id: atual.id, status: atual.status, recebidoEm: atual.recebidoEm, atualizadoEm: agora,
    observacaoPcp: atual.observacaoPcp, programadoEm: atual.programadoEm, programacao: atual.programacao, alerta: atual.alerta };
  if (cancelado) {
    if (atual.status === 'a_programar') return { ...base, status: 'cancelado_na_origem', alerta: 'Pedido cancelado na origem.' };
    if (atual.status === 'programado') return { ...base, alerta: 'Pedido CANCELADO na origem depois de programado: confira as OPs e decida o que fazer.' };
    return base;
  }
  if (atual.status === 'cancelado_na_origem') return { ...base, status: 'a_programar', alerta: 'Pedido reaberto na origem.' };
  if (atual.status === 'programado' && assinatura(atual.itens) !== assinatura(novo.itens)) {
    return { ...base, alerta: 'Pedido ALTERADO na origem depois de programado: confira quantidades e as OPs.' };
  }
  return base;
}
