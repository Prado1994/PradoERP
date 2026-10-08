import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Repositorio } from '../src/repositorio/repositorio.js';
import { RepositorioMemoria } from '../src/repositorio/memoria.js';
import { RepositorioPostgres, migrar } from '../src/repositorio/postgres.js';
import type { EventoEtapa, ItemFila, Parada } from '../src/dominio/tipos.js';
import { ordem } from './ajuda.js';

/**
 * Mesma suíte contra a memória e (se DATABASE_URL_TESTE existir) contra o PostgreSQL.
 * ATENÇÃO: o banco de teste é esvaziado a cada teste. Nunca aponte para um banco com dados reais.
 */
const URL_PG = process.env.DATABASE_URL_TESTE;

interface Fabrica { nome: string; ativo: boolean; criar: () => Promise<Repositorio>; encerrar?: () => Promise<void> }

let pool: pg.Pool | undefined;
const fabricas: Fabrica[] = [
  { nome: 'memória', ativo: true, criar: async () => new RepositorioMemoria() },
  {
    nome: 'PostgreSQL',
    ativo: !!URL_PG,
    criar: async () => {
      pool ??= new pg.Pool({ connectionString: URL_PG, max: 3 });
      await migrar(pool);
      await pool.query(
        'TRUNCATE ordens, previsoes, eventos_etapa, leituras, paradas, fila_sincronizacao RESTART IDENTITY CASCADE',
      );
      return new RepositorioPostgres(pool);
    },
    encerrar: async () => { await pool?.end(); },
  },
];

const evento = (ordemId: string, extra: Partial<EventoEtapa> = {}): EventoEtapa => ({
  id: randomUUID(), ordemId, sigla: 'COR', em: new Date('2026-10-08T10:00:00Z'), estacao: 'COR',
  idLeitura: randomUUID(), colado: false, ...extra,
});

for (const f of fabricas) {
  describe.skipIf(!f.ativo)(`Repositório · ${f.nome}`, () => {
    let repo: Repositorio;
    beforeEach(async () => { repo = await f.criar(); });
    afterAll(async () => { await f.encerrar?.(); });

    it('salva e busca OP por id e por OP+caixa, com datas intactas', async () => {
      const o = ordem({ op: '00101', caixa: '02', plano: 'P-77' });
      await repo.salvarOrdem(o);
      expect(await repo.buscarOrdem(o.id)).toEqual(o);
      expect(await repo.buscarOrdemPorCodigo('00101', '02')).toEqual(o);
      expect(await repo.buscarOrdemPorCodigo('00101', '03')).toBeUndefined();
      expect(await repo.buscarOrdem(randomUUID())).toBeUndefined();
    });

    it('lista por OP e todas as ordens', async () => {
      await repo.salvarOrdem(ordem({ op: '00101', caixa: '01' }));
      await repo.salvarOrdem(ordem({ op: '00101', caixa: '02' }));
      await repo.salvarOrdem(ordem({ op: '00102', caixa: '01' }));
      expect(await repo.buscarOrdensPorOp('00101')).toHaveLength(2);
      expect(await repo.listarOrdens()).toHaveLength(3);
    });

    it('reprogramação: guarda histórico, só acrescenta e mantém a previsão inicial', async () => {
      const o = ordem();
      await repo.salvarOrdem(o);
      const nova = new Date(o.previsaoAtual.getTime() + 2 * 86_400_000);
      o.historicoPrevisao.push({ em: new Date('2026-10-08T09:00:00Z'), de: o.previsaoAtual, para: nova, motivo: 'falta de material' });
      o.previsaoAtual = nova;
      await repo.salvarOrdem(o);
      await repo.salvarOrdem(o); // salvar de novo não duplica o histórico
      const lida = (await repo.buscarOrdem(o.id))!;
      expect(lida.historicoPrevisao).toHaveLength(1);
      expect(lida.historicoPrevisao[0]!.motivo).toBe('falta de material');
      expect(lida.previsaoAtual).toEqual(nova);
      expect(lida.previsaoInicial).toEqual(o.previsaoInicial);
    });

    it('eventos: guarda em ordem de horário e filtra por OP', async () => {
      const a = ordem(); const b = ordem({ op: '00102' });
      await repo.salvarOrdem(a); await repo.salvarOrdem(b);
      await repo.adicionarEvento(evento(a.id, { sigla: 'PES', estacao: 'PES', em: new Date('2026-10-08T12:00:00Z') }));
      await repo.adicionarEvento(evento(a.id, { sigla: 'COR', em: new Date('2026-10-08T10:00:00Z'), operador: 'maria', colado: true }));
      await repo.adicionarEvento(evento(b.id));
      const doA = await repo.eventosDaOrdem(a.id);
      expect(doA.map((e) => e.sigla)).toEqual(['COR', 'PES']);
      expect(doA[0]).toMatchObject({ operador: 'maria', colado: true });
      expect(await repo.todosEventos()).toHaveLength(3);
    });

    it('leituras: idempotência por idLeitura', async () => {
      const r = { idLeitura: 'L-1', status: 'ok' as const, mensagem: 'OK · 20 PARES', ordemId: randomUUID(), pares: 20, concluida: false };
      expect(await repo.buscarLeitura('L-1')).toBeUndefined();
      await repo.guardarLeitura(r);
      expect(await repo.buscarLeitura('L-1')).toEqual(r);
    });

    it('paradas: abre, encontra a aberta, fecha e lista', async () => {
      const p: Parada = { id: randomUUID(), sigla: 'INJ', motivo: 'falta de pvc', inicio: new Date('2026-10-08T08:00:00Z'), operador: 'jose' };
      await repo.abrirParada(p);
      expect(await repo.paradaAberta('INJ')).toEqual(p);
      expect(await repo.paradaAberta('COR')).toBeUndefined();
      const fim = new Date('2026-10-08T09:30:00Z');
      await repo.fecharParada(p.id, fim);
      expect(await repo.paradaAberta('INJ')).toBeUndefined();
      expect(await repo.listarParadas()).toEqual([{ ...p, fim }]);
    });

    it('fila: devolve só pendentes já vencidos e guarda a atualização', async () => {
      const agora = new Date('2026-10-08T12:00:00Z');
      const item = (extra: Partial<ItemFila> = {}): ItemFila => ({
        id: randomUUID(), destino: 'bling', tipo: 'op.concluida', payload: { op: '00101', pares: 20 },
        criadoEm: agora, tentativas: 0, proximaTentativa: agora, status: 'pendente', ...extra,
      });
      const pronto = item(); const futuro = item({ proximaTentativa: new Date(agora.getTime() + 60_000) });
      const enviado = item({ status: 'enviado' });
      for (const i of [pronto, futuro, enviado]) await repo.enfileirar(i);
      expect((await repo.filaPronta(agora)).map((i) => i.id)).toEqual([pronto.id]);
      await repo.atualizarItemFila({ ...pronto, tentativas: 1, status: 'falha', ultimoErro: 'timeout' });
      expect(await repo.filaPronta(agora)).toEqual([]);
      const lido = (await repo.listarFila()).find((i) => i.id === pronto.id)!;
      expect(lido).toMatchObject({ tentativas: 1, status: 'falha', ultimoErro: 'timeout', payload: { op: '00101', pares: 20 } });
    });
  });
}

// Garantias que só o banco dá: regras duras no esquema.
describe.skipIf(!URL_PG)('PostgreSQL · garantias do esquema', () => {
  let repo: RepositorioPostgres; let p: pg.Pool;
  beforeAll(async () => { p = new pg.Pool({ connectionString: URL_PG, max: 2 }); await migrar(p); });
  beforeEach(async () => {
    await p.query('TRUNCATE ordens, previsoes, eventos_etapa, leituras, paradas, fila_sincronizacao CASCADE');
    repo = new RepositorioPostgres(p);
  });
  afterAll(async () => { await p.end(); });

  it('recusa a mesma etapa duas vezes na mesma caixa', async () => {
    const o = ordem(); await repo.salvarOrdem(o);
    await repo.adicionarEvento(evento(o.id));
    await expect(repo.adicionarEvento(evento(o.id))).rejects.toThrow();
  });

  it('recusa o mesmo idLeitura em dois eventos', async () => {
    const o = ordem(); await repo.salvarOrdem(o);
    await repo.adicionarEvento(evento(o.id, { idLeitura: 'X' }));
    await expect(repo.adicionarEvento(evento(o.id, { sigla: 'PES', idLeitura: 'X' }))).rejects.toThrow();
  });

  it('eventos são imutáveis (sem UPDATE nem DELETE)', async () => {
    const o = ordem(); await repo.salvarOrdem(o);
    await repo.adicionarEvento(evento(o.id));
    await expect(p.query("UPDATE eventos_etapa SET estacao = 'PES'")).rejects.toThrow(/somente inclusao/);
    await expect(p.query('DELETE FROM eventos_etapa')).rejects.toThrow(/somente inclusao/);
  });

  it('a previsão inicial não pode ser alterada nem por salvarOrdem', async () => {
    const o = ordem(); await repo.salvarOrdem(o);
    await expect(repo.salvarOrdem({ ...o, previsaoInicial: new Date(o.previsaoInicial.getTime() + 86_400_000) }))
      .rejects.toThrow(/previsao_inicial/);
  });

  it('só uma parada aberta por etapa', async () => {
    const mk = (): Parada => ({ id: randomUUID(), sigla: 'EST', motivo: 'm', inicio: new Date() });
    await repo.abrirParada(mk());
    await expect(repo.abrirParada(mk())).rejects.toThrow();
  });

  it('OP + caixa é única', async () => {
    await repo.salvarOrdem(ordem());
    await expect(repo.salvarOrdem(ordem())).rejects.toThrow();
  });
});
