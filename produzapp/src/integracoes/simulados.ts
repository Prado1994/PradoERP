import type { Destino } from './destino.js';
import type { ItemFila } from '../dominio/tipos.js';

/** Destino de desenvolvimento/testes: guarda o que recebeu e pode falhar sob comando. */
export class DestinoSimulado implements Destino {
  readonly enviados: ItemFila[] = [];
  private falhasRestantes = 0;

  constructor(public readonly nome: string) {}

  /** As próximas N chamadas lançam erro (simula Bling/Odoo fora do ar). */
  falharProximas(n: number) { this.falhasRestantes = n; }

  async enviar(item: ItemFila) {
    if (this.falhasRestantes > 0) {
      this.falhasRestantes--;
      throw new Error(`${this.nome} indisponível (simulado)`);
    }
    this.enviados.push(item);
  }
}

// Conectores reais (fases 3 e 4): src/integracoes/bling.ts e odoo.ts implementando Destino.
// Ver docs/INTEGRACAO-BLING.md e docs/INTEGRACAO-ODOO.md.
