import { beforeEach, describe, expect, it } from 'vitest';
import { RepositorioMemoria } from '../src/repositorio/memoria.js';
import { processarLeitura } from '../src/dominio/leitura.js';
import { ETAPAS } from '../src/dominio/etapas.js';
import { HOJE, ordem } from './ajuda.js';

let repo: RepositorioMemoria;
beforeEach(async () => { repo = new RepositorioMemoria(); await repo.salvarOrdem(ordem()); });

const ler = (codigo: string, estacao: string, idLeitura?: string) =>
  processarLeitura(repo, { codigo, estacao, idLeitura }, undefined, HOJE);

describe('leitura de etapas', () => {
  it('registra a primeira etapa e enfileira "op.iniciada" para o Bling', async () => {
    const r = await ler('00101-01-COR', 'COR');
    expect(r.status).toBe('ok');
    expect(r.pares).toBe(20);
    const fila = await repo.listarFila();
    expect(fila.map((i) => i.tipo)).toEqual(['op.iniciada']);
    expect(fila[0]!.destino).toBe('bling');
  });

  it('percorre as 7 etapas e enfileira "op.concluida" só no fim', async () => {
    let ultimo;
    for (const e of ETAPAS) ultimo = await ler(`00101-01-${e.sigla}`, e.sigla);
    expect(ultimo!.concluida).toBe(true);
    expect((await repo.listarFila()).map((i) => i.tipo)).toEqual(['op.iniciada', 'op.concluida']);
    expect(await repo.eventosDaOrdem((await repo.listarOrdens())[0]!.id)).toHaveLength(7);
  });

  it('não duplica: a mesma etapa lida de novo é "repetida"', async () => {
    await ler('00101-01-COR', 'COR');
    const r = await ler('00101-01-COR', 'COR');
    expect(r.status).toBe('repetida');
    expect(await repo.todosEventos()).toHaveLength(1);
  });

  it('bloqueia pular etapa e diz qual falta', async () => {
    const r = await ler('00101-01-PES', 'PES');
    expect(r.status).toBe('fora_de_sequencia');
    expect(r.mensagem).toContain('Corte');
    expect(await repo.todosEventos()).toHaveLength(0);
  });

  it('recusa código de outro setor na estação errada', async () => {
    const r = await ler('00101-01-PES', 'EMB');
    expect(r.status).toBe('fora_da_estacao');
  });

  it('é idempotente: reenviar o mesmo idLeitura não grava duas vezes', async () => {
    const a = await ler('00101-01-COR', 'COR', 'leitura-1');
    const b = await ler('00101-01-COR', 'COR', 'leitura-1');
    expect(b).toEqual(a);
    expect(await repo.todosEventos()).toHaveLength(1);
  });

  it('aceita leitura colada, mas avisa para configurar o Enter', async () => {
    const r = await ler('00101-01-COR00101-01-COR', 'COR');
    expect(r.status).toBe('ok');
    expect(r.aviso).toMatch(/Enter/);
    expect((await repo.todosEventos())[0]!.colado).toBe(true);
  });

  it('OP inexistente e sigla antiga (AVI) dão erro claro', async () => {
    expect((await ler('09999-01-COR', 'COR')).status).toBe('erro');
    const r = await ler('00101-01-AVI', 'COR');
    expect(r.status).toBe('erro');
    expect(r.mensagem).toContain('AVI');
  });

  it('com a trava desligada, permite pular etapa', async () => {
    const r = await processarLeitura(repo, { codigo: '00101-01-PES', estacao: 'PES' },
      { bloquearForaDeSequencia: false, paresPadrao: 20 }, HOJE);
    expect(r.status).toBe('ok');
  });
});

describe('paradas', () => {
  it('abre, recusa duplicada e fecha com a duração', async () => {
    expect((await ler('PARADA-PES-QUEBRA-AGULHA', 'PES')).status).toBe('parada_aberta');
    expect((await ler('PARADA-PES-FALTA-MATERIAL', 'PES')).status).toBe('repetida');
    const fim = await processarLeitura(repo, { codigo: 'RETOMA-PES', estacao: 'PES' }, undefined,
      new Date(HOJE.getTime() + 15 * 60000));
    expect(fim.status).toBe('parada_encerrada');
    expect(fim.mensagem).toContain('15 min');
  });
  it('retomar sem parada aberta é erro', async () => {
    expect((await ler('RETOMA-PES', 'PES')).status).toBe('erro');
  });
});
