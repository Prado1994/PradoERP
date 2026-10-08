import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { RepositorioMemoria } from '../src/repositorio/memoria.js';
import { DestinoSimulado } from '../src/integracoes/simulados.js';
import { MAX_TENTATIVAS, processarFila } from '../src/sincronizacao.js';
import { HOJE } from './ajuda.js';

const item = () => ({
  id: randomUUID(), destino: 'bling' as const, tipo: 'op.iniciada', payload: {}, criadoEm: HOJE,
  tentativas: 0, proximaTentativa: HOJE, status: 'pendente' as const,
});

describe('fila de sincronização', () => {
  it('envia o que está pendente', async () => {
    const repo = new RepositorioMemoria(); const bling = new DestinoSimulado('bling');
    await repo.enfileirar(item());
    expect(await processarFila(repo, { bling }, HOJE)).toEqual({ enviados: 1, reagendados: 0, falhas: 0 });
    expect(bling.enviados).toHaveLength(1);
  });

  it('se o Bling cair, reagenda com espera e envia depois, sem perder nada', async () => {
    const repo = new RepositorioMemoria(); const bling = new DestinoSimulado('bling');
    bling.falharProximas(1);
    await repo.enfileirar(item());
    expect((await processarFila(repo, { bling }, HOJE)).reagendados).toBe(1);
    // ainda dentro da espera de 30 s: não tenta
    expect((await processarFila(repo, { bling }, new Date(HOJE.getTime() + 10_000))).enviados).toBe(0);
    // depois da espera: envia
    expect((await processarFila(repo, { bling }, new Date(HOJE.getTime() + 31_000))).enviados).toBe(1);
  });

  it('depois de muitas falhas marca "falha" para a supervisão ver', async () => {
    const repo = new RepositorioMemoria(); const bling = new DestinoSimulado('bling');
    bling.falharProximas(99);
    await repo.enfileirar(item());
    let t = HOJE.getTime();
    for (let i = 0; i < MAX_TENTATIVAS; i++) { await processarFila(repo, { bling }, new Date(t)); t += 3_600_000; }
    expect((await repo.listarFila())[0]!.status).toBe('falha');
  });

  it('destino não configurado: o item espera na fila', async () => {
    const repo = new RepositorioMemoria();
    await repo.enfileirar({ ...item(), destino: 'odoo' });
    expect(await processarFila(repo, {}, HOJE)).toEqual({ enviados: 0, reagendados: 0, falhas: 0 });
    expect((await repo.listarFila())[0]!.status).toBe('pendente');
  });
});
