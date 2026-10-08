import { beforeEach, describe, expect, it } from 'vitest';
import { criarServidor } from '../src/api/servidor.js';
import { RepositorioMemoria } from '../src/repositorio/memoria.js';
import { HOJE } from './ajuda.js';

const H = { 'x-api-key': 'chave-teste' };
let app: ReturnType<typeof criarServidor>;

beforeEach(() => { app = criarServidor({ repo: new RepositorioMemoria(), apiKeys: ['chave-teste'], agora: () => HOJE }); });

const criar = (extra: object = {}) => app.inject({
  method: 'POST', url: '/ordens', headers: H,
  payload: { op: '101', caixa: '1', cliente: 'Estoque Prado', produto: '40501 · Bota', pares: 20,
    entrada: '2026-10-06', previsaoInicial: '2026-10-16', ...extra },
});

describe('API', () => {
  it('/saude é público; o resto exige chave', async () => {
    expect((await app.inject({ url: '/saude' })).statusCode).toBe(200);
    expect((await app.inject({ url: '/ordens' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/ordens', headers: { 'x-api-key': 'errada' } })).statusCode).toBe(401);
  });

  it('cria OP, recusa duplicada (409) e dados incompletos (400)', async () => {
    const r = await criar();
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ op: '00101', caixa: '01', situacao: 'no_prazo', etapaAtual: 'Corte' });
    expect((await criar()).statusCode).toBe(409);
    expect((await criar({ pares: 0, op: '102' })).statusCode).toBe(400);
  });

  it('fluxo completo: leituras, acompanhamento e indicadores', async () => {
    const { id } = (await criar()).json();
    const ler = (codigo: string, estacao: string) =>
      app.inject({ method: 'POST', url: '/leituras', headers: H, payload: { codigo, estacao } });

    expect((await ler('00101-01-COR', 'cor')).json().status).toBe('ok');
    expect((await ler('00101-01-EST', 'EST')).json().status).toBe('fora_de_sequencia');
    expect((await ler('00101-01-PES', 'PES')).json().status).toBe('ok');

    const det = (await app.inject({ url: `/ordens/${id}`, headers: H })).json();
    expect(det.etapasConcluidas).toBe(2);
    expect(det.etapaAtual).toBe('Esteira de Montagem');
    expect(det.eventos).toHaveLength(2);

    const ind = (await app.inject({ url: '/indicadores', headers: H })).json();
    expect(ind.ordensAbertas).toBe(1);
    expect(ind.paresPorEtapa[2]).toMatchObject({ sigla: 'EST', pares: 20 });

    const pend = (await app.inject({ url: '/sincronizacao/pendentes', headers: H })).json();
    expect(pend.pendentes).toHaveLength(1); // op.iniciada ainda não enviada
  });

  it('reprogramação exige motivo e guarda histórico sem mexer na previsão inicial', async () => {
    const { id, previsaoInicial } = (await criar()).json();
    const sem = await app.inject({ method: 'PATCH', url: `/ordens/${id}/previsao`, headers: H, payload: { para: '2026-10-22' } });
    expect(sem.statusCode).toBe(422);
    const ok = await app.inject({ method: 'PATCH', url: `/ordens/${id}/previsao`, headers: H,
      payload: { para: '2026-10-22', motivo: 'Falta de solado' } });
    expect(ok.json().previsaoInicial).toBe(previsaoInicial);
    expect(ok.json().reprogramadaDias).toBe(6);
    expect(ok.json().historicoPrevisao).toHaveLength(1);
  });

  it('filtra ordens por situação', async () => {
    await criar();
    await criar({ op: '102', entrada: '2026-09-20', previsaoInicial: '2026-09-30' });
    const atrasadas = (await app.inject({ url: '/ordens?situacao=atrasada', headers: H })).json();
    expect(atrasadas).toHaveLength(1);
    expect(atrasadas[0].op).toBe('00102');
  });
  it('leitura offline preserva a hora do bipe (lidoEm) e recusa hora no futuro', async () => {
    const { id } = (await criar()).json();
    const ler = (payload: object) => app.inject({ method: 'POST', url: '/leituras', headers: H, payload });
    const bipe = '2026-10-08T09:15:00.000Z'; // HOJE = 12:00 local
    expect((await ler({ codigo: '00101-01-COR', estacao: 'COR', lidoEm: bipe })).json().status).toBe('ok');
    expect((await ler({ codigo: '00101-01-PES', estacao: 'PES', lidoEm: '2099-01-01T00:00:00Z' })).json().status).toBe('ok');
    const ev = (await app.inject({ url: `/ordens/${id}`, headers: H })).json().eventos;
    expect(ev[0].em).toBe(bipe);
    expect(new Date(ev[1].em).getFullYear()).toBe(2026); // futuro ignorado: usa a hora do servidor
  });

  it('serve as telas sem chave e mantém a API protegida', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const pasta = mkdtempSync(join(tmpdir(), 'web-'));
    writeFileSync(join(pasta, 'estacao.html'), '<h1>ok</h1>');
    const a = criarServidor({ repo: new RepositorioMemoria(), apiKeys: ['k'], agora: () => HOJE, pastaWeb: pasta });
    expect((await a.inject({ url: '/estacao.html' })).statusCode).toBe(200);
    expect((await a.inject({ url: '/ordens' })).statusCode).toBe(401);
  });
});
