import type { ItemFila } from '../dominio/tipos.js';

/**
 * Contrato de um sistema externo (Bling, Odoo). O núcleo só conhece esta interface:
 * trocar ou adicionar um sistema não mexe nas regras de produção.
 */
export interface Destino {
  readonly nome: string;
  enviar(item: ItemFila): Promise<void>;
}
