import type { EventoEtapa, OrdemProducao } from './tipos.js';
import { ETAPAS, TOTAL_ETAPAS } from './etapas.js';

const DIA = 86_400_000;

export type SituacaoPrazo = 'atrasada' | 'em_risco' | 'no_prazo' | 'concluida';

export const inicioDoDia = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dias = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DIA);

export const etapasConcluidas = (eventos: EventoEtapa[]) => eventos.length;
export const estaConcluida = (eventos: EventoEtapa[]) => eventos.length >= TOTAL_ETAPAS;
export const fimReal = (eventos: EventoEtapa[]) => (estaConcluida(eventos) ? eventos[eventos.length - 1]!.em : undefined);

/** Etapa em que a caixa está agora (a próxima a ser lida). */
export function etapaAtual(eventos: EventoEtapa[]): string {
  return estaConcluida(eventos) ? 'Expedida' : ETAPAS[eventos.length]!.nome;
}

/** Dias até a previsão INICIAL (negativo = já passou). */
export const diasParaPrevisaoInicial = (o: OrdemProducao, hoje: Date) =>
  dias(o.previsaoInicial, inicioDoDia(hoje));

export const prazoPlanejado = (o: OrdemProducao) => dias(o.previsaoInicial, inicioDoDia(o.entrada));

/** Dias reais desde a entrada: até hoje (aberta) ou até a expedição (concluída). */
export function diasProducao(o: OrdemProducao, eventos: EventoEtapa[], hoje: Date): number {
  const fim = fimReal(eventos) ?? hoje;
  return Math.max(0, dias(inicioDoDia(fim), inicioDoDia(o.entrada)));
}

/**
 * Atraso SEMPRE contra a previsão inicial: reprogramar não esconde que o compromisso
 * original foi perdido. Concluída: atraso na data da expedição.
 */
export function atrasoDias(o: OrdemProducao, eventos: EventoEtapa[], hoje: Date): number {
  const fim = fimReal(eventos);
  if (fim) return Math.max(0, dias(inicioDoDia(fim), inicioDoDia(o.previsaoInicial)));
  return Math.max(0, -diasParaPrevisaoInicial(o, hoje));
}

export function situacao(o: OrdemProducao, eventos: EventoEtapa[], hoje: Date): SituacaoPrazo {
  if (estaConcluida(eventos)) return 'concluida';
  const d = diasParaPrevisaoInicial(o, hoje);
  if (d < 0) return 'atrasada';
  if (d <= 2 && eventos.length < 5) return 'em_risco';
  return 'no_prazo';
}

const media = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
const arred = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export interface Indicadores {
  geradoEm: string;
  ordensAbertas: number;
  ordensConcluidas: number;
  paresEmProducao: number;
  diasDeMeta: number | null;
  atrasadas: number;
  paresAtrasados: number;
  atrasoMedioDias: number | null;
  maiorAtrasoDias: number;
  emRisco: number;
  entregamEm7Dias: number;
  avancoMedioPct: number | null;
  prazoMedioProducaoDias: number | null;
  prazoMedioPlanejadoDias: number | null;
  idadeMediaAbertasDias: number | null;
  paresPorEtapa: { sigla: string; nome: string; ordens: number; pares: number }[];
}

export function calcularIndicadores(
  ordens: OrdemProducao[],
  eventosPorOrdem: Map<string, EventoEtapa[]>,
  hoje: Date,
  metaDiaria = 550,
): Indicadores {
  const ev = (o: OrdemProducao) => eventosPorOrdem.get(o.id) ?? [];
  const abertas = ordens.filter((o) => !estaConcluida(ev(o)));
  const fechadas = ordens.filter((o) => estaConcluida(ev(o)));
  const atrasadas = abertas.filter((o) => situacao(o, ev(o), hoje) === 'atrasada');
  const pares = (a: OrdemProducao[]) => a.reduce((s, o) => s + o.pares, 0);
  const paresAbertos = pares(abertas);

  return {
    geradoEm: hoje.toISOString(),
    ordensAbertas: abertas.length,
    ordensConcluidas: fechadas.length,
    paresEmProducao: paresAbertos,
    diasDeMeta: metaDiaria > 0 ? arred(paresAbertos / metaDiaria) : null,
    atrasadas: atrasadas.length,
    paresAtrasados: pares(atrasadas),
    atrasoMedioDias: arred(media(atrasadas.map((o) => atrasoDias(o, ev(o), hoje)))),
    maiorAtrasoDias: Math.max(0, ...atrasadas.map((o) => atrasoDias(o, ev(o), hoje))),
    emRisco: abertas.filter((o) => situacao(o, ev(o), hoje) === 'em_risco').length,
    entregamEm7Dias: abertas.filter((o) => { const d = diasParaPrevisaoInicial(o, hoje); return d >= 0 && d <= 7; }).length,
    avancoMedioPct: abertas.length ? Math.round(media(abertas.map((o) => (etapasConcluidas(ev(o)) / TOTAL_ETAPAS) * 100))!) : null,
    prazoMedioProducaoDias: arred(media(fechadas.map((o) => diasProducao(o, ev(o), hoje)))),
    prazoMedioPlanejadoDias: arred(media(fechadas.map(prazoPlanejado))),
    idadeMediaAbertasDias: arred(media(abertas.map((o) => diasProducao(o, ev(o), hoje)))),
    paresPorEtapa: ETAPAS.map((e, k) => {
      const naEtapa = abertas.filter((o) => ev(o).length === k);
      return { sigla: e.sigla, nome: e.nome, ordens: naEtapa.length, pares: pares(naEtapa) };
    }),
  };
}
