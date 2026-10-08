import type { Repositorio } from './repositorio.js';
import type { EventoEtapa, ItemFila, OrdemProducao, Parada, ResultadoLeitura } from '../dominio/tipos.js';
import type { Sigla } from '../dominio/etapas.js';

/** Implementação em memória: desenvolvimento e testes. */
export class RepositorioMemoria implements Repositorio {
  private ordens = new Map<string, OrdemProducao>();
  private eventos: EventoEtapa[] = [];
  private leituras = new Map<string, ResultadoLeitura>();
  private paradas = new Map<string, Parada>();
  private fila = new Map<string, ItemFila>();

  async salvarOrdem(o: OrdemProducao) { this.ordens.set(o.id, o); }
  async buscarOrdem(id: string) { return this.ordens.get(id); }
  async buscarOrdemPorCodigo(op: string, caixa: string) {
    return [...this.ordens.values()].find((o) => o.op === op && o.caixa === caixa);
  }
  async buscarOrdensPorOp(op: string) { return [...this.ordens.values()].filter((o) => o.op === op); }
  async listarOrdens() { return [...this.ordens.values()]; }

  async adicionarEvento(e: EventoEtapa) { this.eventos.push(e); }
  async eventosDaOrdem(ordemId: string) {
    return this.eventos.filter((e) => e.ordemId === ordemId).sort((a, b) => a.em.getTime() - b.em.getTime());
  }
  async todosEventos() { return [...this.eventos]; }

  async buscarLeitura(idLeitura: string) { return this.leituras.get(idLeitura); }
  async guardarLeitura(r: ResultadoLeitura) { this.leituras.set(r.idLeitura, r); }

  async abrirParada(p: Parada) { this.paradas.set(p.id, p); }
  async paradaAberta(sigla: Sigla) {
    return [...this.paradas.values()].find((p) => p.sigla === sigla && !p.fim);
  }
  async fecharParada(id: string, fim: Date) {
    const p = this.paradas.get(id);
    if (p) p.fim = fim;
  }
  async listarParadas() { return [...this.paradas.values()]; }

  async enfileirar(item: ItemFila) { this.fila.set(item.id, item); }
  async filaPronta(agora: Date) {
    return [...this.fila.values()].filter((i) => i.status === 'pendente' && i.proximaTentativa <= agora);
  }
  async atualizarItemFila(item: ItemFila) { this.fila.set(item.id, item); }
  async listarFila() { return [...this.fila.values()]; }
}
