import type { Sigla } from './etapas.js';

export interface MudancaPrevisao {
  em: Date;
  de: Date;
  para: Date;
  motivo: string;
}

/** Uma OP = uma caixa de 10 a 20 pares (decisão de piloto). */
export interface OrdemProducao {
  id: string;
  op: string; // 5 dígitos, ex.: "00101"
  caixa: string; // 2 dígitos, ex.: "01"
  plano?: string;
  /** Pedido de origem (caixa de entrada) que gerou esta OP. */
  pedidoId?: string;
  cliente: string;
  produto: string; // ex.: "40501 · Bota elástica ECO PVC"
  pares: number;
  entrada: Date;
  previsaoInicial: Date; // compromisso original: nunca é alterada
  previsaoAtual: Date; // última data vigente
  historicoPrevisao: MudancaPrevisao[];
  criadaEm: Date;
}

/** Evento imutável: nunca é alterado nem apagado. */
export interface EventoEtapa {
  id: string;
  ordemId: string;
  sigla: Sigla;
  em: Date;
  estacao: string;
  operador?: string;
  idLeitura: string;
  colado: boolean;
}

export interface Parada {
  id: string;
  sigla: Sigla;
  motivo: string;
  inicio: Date;
  fim?: Date;
  operador?: string;
}

export type StatusLeitura =
  | 'ok'
  | 'repetida'
  | 'fora_da_estacao'
  | 'fora_de_sequencia'
  | 'parada_aberta'
  | 'parada_encerrada'
  | 'erro';

export interface ResultadoLeitura {
  idLeitura: string;
  status: StatusLeitura;
  /** Texto pronto para mostrar na tela da estação. */
  mensagem: string;
  /** Aviso extra (ex.: leitor sem Enter configurado). */
  aviso?: string;
  ordemId?: string;
  pares?: number;
  concluida?: boolean;
}

export type DestinoSync = 'bling' | 'odoo';

export interface ItemFila {
  id: string;
  destino: DestinoSync;
  tipo: string; // ex.: "op.iniciada", "op.concluida"
  payload: Record<string, unknown>;
  criadoEm: Date;
  tentativas: number;
  proximaTentativa: Date;
  status: 'pendente' | 'enviado' | 'falha';
  ultimoErro?: string;
}

/** Credenciais de uma integração (ex.: OAuth). O refresh token costuma rotacionar: gravar sempre o novo. */
export interface TokenIntegracao {
  nome: string;
  accessToken: string;
  refreshToken: string;
  expiraEm: Date;
}
