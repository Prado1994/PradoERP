import { describe, expect, it } from 'vitest';
import type { EventoEtapa } from '../src/dominio/tipos.js';
import { ETAPAS } from '../src/dominio/etapas.js';
import { atrasoDias, calcularIndicadores, diasProducao, situacao } from '../src/dominio/prazos.js';
import { reprogramar } from '../src/dominio/previsao.js';
import { HOJE, ordem } from './ajuda.js';

const eventos = (o: { id: string }, n: number, ultimo = HOJE): EventoEtapa[] =>
  ETAPAS.slice(0, n).map((e, k) => ({
    id: `${o.id}-${k}`, ordemId: o.id, sigla: e.sigla, em: k === n - 1 ? ultimo : new Date(HOJE.getTime() - (n - k) * 3600000),
    estacao: e.sigla, idLeitura: `${o.id}-${k}`, colado: false,
  }));

describe('prazos', () => {
  it('no prazo, em risco e atrasada (contra a previsão inicial)', () => {
    expect(situacao(ordem({ entradaHaDias: 2, prazoDias: 10 }), [], HOJE)).toBe('no_prazo');
    expect(situacao(ordem({ entradaHaDias: 9, prazoDias: 10 }), [], HOJE)).toBe('em_risco');
    const atrasada = ordem({ entradaHaDias: 15, prazoDias: 10 });
    expect(situacao(atrasada, [], HOJE)).toBe('atrasada');
    expect(atrasoDias(atrasada, [], HOJE)).toBe(5);
  });

  it('reprogramar NÃO esconde o atraso: ele segue medido pela previsão inicial', () => {
    const o = ordem({ entradaHaDias: 15, prazoDias: 10 });
    const nova = reprogramar(o, new Date('2026-10-20T00:00:00'), 'Falta de solado', HOJE);
    expect(nova.previsaoInicial).toEqual(o.previsaoInicial);
    expect(nova.historicoPrevisao).toHaveLength(1);
    expect(atrasoDias(nova, [], HOJE)).toBe(5);
  });

  it('reprogramar exige motivo', () => {
    expect(() => reprogramar(ordem(), new Date(), '  ')).toThrow(/Motivo/);
  });

  it('dias de produção: até hoje (aberta) ou até a expedição (concluída)', () => {
    const o = ordem({ entradaHaDias: 8 });
    expect(diasProducao(o, [], HOJE)).toBe(8);
    const fechada = eventos(o, 7, new Date('2026-10-05T10:00:00'));
    expect(diasProducao(o, fechada, HOJE)).toBe(5);
  });

  it('concluída: atraso é o da data da expedição', () => {
    const o = ordem({ entradaHaDias: 15, prazoDias: 10 }); // previsão inicial 03/10
    expect(atrasoDias(o, eventos(o, 7, new Date('2026-10-06T10:00:00')), HOJE)).toBe(3);
    expect(atrasoDias(o, eventos(o, 7, new Date('2026-10-02T10:00:00')), HOJE)).toBe(0);
  });

  it('indicadores consolidados', () => {
    const a = ordem({ op: '00101', entradaHaDias: 15, prazoDias: 10 });  // atrasada, 0 etapas
    const b = ordem({ op: '00102', entradaHaDias: 2, prazoDias: 10, pares: 10 }); // no prazo, 3 etapas
    const c = ordem({ op: '00103', entradaHaDias: 12, prazoDias: 10 }); // concluída
    const mapa = new Map([[a.id, []], [b.id, eventos(b, 3)], [c.id, eventos(c, 7, new Date('2026-10-06T10:00:00'))]]);
    const i = calcularIndicadores([a, b, c], mapa, HOJE);
    expect(i.ordensAbertas).toBe(2);
    expect(i.ordensConcluidas).toBe(1);
    expect(i.paresEmProducao).toBe(30);
    expect(i.atrasadas).toBe(1);
    expect(i.maiorAtrasoDias).toBe(5);
    expect(i.prazoMedioProducaoDias).toBe(10); // c: entrou em 26/09 e foi expedida em 06/10 = 10 dias reais
    expect(i.prazoMedioPlanejadoDias).toBe(10);
    expect(i.paresPorEtapa[3]).toMatchObject({ sigla: 'INJ', ordens: 1, pares: 10 });
  });
});
