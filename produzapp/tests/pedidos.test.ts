import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { RepositorioMemoria } from '../src/repositorio/memoria.js';
import { consolidar, modeloDoItem, tamanhoDoItem, SEM_CODIGO, type ItemPedido } from '../src/dominio/pedidos.js';
import { ErroProgramacao, programarPedido, receberPedido, type PedidoRecebido } from '../src/pedidos.js';
import { criarServidor } from '../src/api/servidor.js';
import { FonteBling, normalizarPedidoBling } from '../src/integracoes/bling-pedidos.js';
import { sincronizarPedidos } from '../src/sincronizacaoPedidos.js';
import { HOJE, ordem } from './ajuda.js';

const D45501 = '45501-BOTINA COM FECHAMENTO EM ELASTICO , COM SOLADO PU E PALMILHA INTERNA ,BICO PLASTICO *ELETRICISTA*';
const item = (id: number, tam: number, qtd: number, extra: Partial<ItemPedido> = {}): ItemPedido =>
  ({ idExterno: String(id), descricao: `${D45501} Tamanho:${tam}`, quantidade: qtd, ...extra });

// Formato real devolvido pela API do Bling (pedido #43 de Itanhandu, 23/09/2026)
const BLING_43 = {
  id: 26944364806, numero: 43, data: '2026-09-23', dataPrevista: '0000-00-00', total: 600,
  contato: { id: 17916610851, nome: 'Prado Calçados - Mogi Guaçu', numeroDocumento: '00.164.308/0001-72' },
  situacao: { id: 6, valor: 0 },
  itens: [
    { id: 19986067387, codigo: '', descricao: `${D45501} Tamanho:40`, quantidade: 5, produto: { id: 16709480553 } },
    { id: 19986067388, codigo: '', descricao: `${D45501} Tamanho:42`, quantidade: 5, produto: { id: 16709480555 } },
  ],
};
const CFG = { situacoesCancelado: [12] };

const recebido = (extra: Partial<PedidoRecebido> = {}): PedidoRecebido => ({
  origem: 'bling', idExterno: '1', numero: '43', cliente: 'Estoque Prado', itens: [item(1, 40, 60), item(2, 42, 40)], cancelado: false, ...extra,
});

describe('modelo e grade a partir do pedido', () => {
  it('lê o modelo do código do cadastro; sem código, da descrição (marcando)', () => {
    expect(modeloDoItem({ idExterno: '1', descricao: 'x', codigo: '45501-40', quantidade: 1 })).toEqual({ modelo: '45501', pelaDescricao: false });
    expect(modeloDoItem({ idExterno: '1', descricao: 'x', codigo: 'ST45501', quantidade: 1 })).toEqual({ modelo: 'ST45501', pelaDescricao: false });
    expect(modeloDoItem(item(1, 40, 5))).toEqual({ modelo: '45501', pelaDescricao: true });
    expect(modeloDoItem({ idExterno: '1', descricao: 'BOTA SEM CODIGO', quantidade: 1 }).modelo).toBe(SEM_CODIGO);
  });

  it('lê o tamanho da descrição ou do sufixo do código', () => {
    expect(tamanhoDoItem(item(1, 42, 1))).toBe('42');
    expect(tamanhoDoItem({ idExterno: '1', descricao: 'bota', codigo: '40501-38', quantidade: 1 })).toBe('38');
  });

  it('consolida a grade (uma linha por tamanho) em uma linha por modelo', () => {
    const [l, ...resto] = consolidar({ itens: [item(1, 40, 5), item(2, 42, 5), item(3, 40, 10)] });
    expect(resto).toHaveLength(0);
    expect(l).toMatchObject({ modelo: '45501', pares: 20, grade: { '40': 15, '42': 5 }, modeloPelaDescricao: true, semCodigo: false });
    expect(l!.descricao.startsWith('BOTINA COM FECHAMENTO')).toBe(true); // sem o "45501-" repetido
    expect(l!.descricao.endsWith('*ELETRICISTA*')).toBe(true);
  });
});

describe('tradução do pedido do Bling', () => {
  it('traduz o pedido real: previsão vazia, itens, situação e cliente', () => {
    const p = normalizarPedidoBling(BLING_43, CFG);
    expect(p).toMatchObject({ origem: 'bling', idExterno: '26944364806', numero: '43', cliente: 'Prado Calçados - Mogi Guaçu', total: 600, cancelado: false, situacaoExterna: '6' });
    expect(p.previsaoExterna).toBeUndefined(); // "0000-00-00" não vira data
    expect(p.itens).toHaveLength(2);
    expect(p.itens[0]).toMatchObject({ idExterno: '19986067387', produtoIdExterno: '16709480553', quantidade: 5 });
    expect(p.itens[0]!.codigo).toBeUndefined();
  });
  it('usa o código do cadastro quando existe e marca cancelado', () => {
    const p = normalizarPedidoBling({ ...BLING_43, situacao: { id: 12 }, dataPrevista: '2026-10-30', itens: [{ ...BLING_43.itens[0], codigo: '45501-40' }] }, CFG);
    expect(p.cancelado).toBe(true);
    expect(p.previsaoExterna?.toISOString()).toBe('2026-10-30T00:00:00.000Z');
    expect(p.itens[0]!.codigo).toBe('45501-40');
  });
});

describe('caixa de entrada', () => {
  let repo: RepositorioMemoria;
  beforeEach(() => { repo = new RepositorioMemoria(); });

  it('pedido novo entra "a programar"; reenviar não duplica', async () => {
    expect((await receberPedido(repo, recebido(), HOJE)).resultado).toBe('novo');
    expect((await receberPedido(repo, recebido(), HOJE)).resultado).toBe('atualizado');
    expect(await repo.listarPedidos()).toHaveLength(1);
  });

  it('pedido cancelado que nunca entrou é ignorado', async () => {
    expect((await receberPedido(repo, recebido({ cancelado: true }), HOJE)).resultado).toBe('ignorado');
    expect(await repo.listarPedidos()).toHaveLength(0);
  });

  it('cancelamento antes de programar tira da fila; depois de programar só avisa o PCP e não mexe nas OPs', async () => {
    const { pedido } = await receberPedido(repo, recebido(), HOJE);
    await receberPedido(repo, recebido({ cancelado: true }), HOJE);
    expect((await repo.buscarPedido(pedido!.id))!.status).toBe('cancelado_na_origem');
    await receberPedido(repo, recebido(), HOJE); // reaberto
    expect((await repo.buscarPedido(pedido!.id))!.status).toBe('a_programar');

    await programarPedido(repo, pedido!.id, { linhas: [{ modelo: '45501', paresPorCaixa: 20 }], previsaoInicial: new Date('2026-10-20') }, HOJE);
    await receberPedido(repo, recebido({ cancelado: true }), HOJE);
    const p = (await repo.buscarPedido(pedido!.id))!;
    expect(p.status).toBe('programado');
    expect(p.alerta).toMatch(/CANCELADO/);
    expect((await repo.listarOrdens()).length).toBe(5);
  });

  it('alteração de quantidade depois de programado gera alerta, sem mudar o que o PCP decidiu', async () => {
    const { pedido } = await receberPedido(repo, recebido(), HOJE);
    await programarPedido(repo, pedido!.id, { linhas: [{ modelo: '45501', paresPorCaixa: 20 }], previsaoInicial: new Date('2026-10-20'), observacaoPcp: 'usar forma 12' }, HOJE);
    await receberPedido(repo, recebido({ itens: [item(1, 40, 80), item(2, 42, 40)] }), HOJE);
    const p = (await repo.buscarPedido(pedido!.id))!;
    expect(p.alerta).toMatch(/ALTERADO/);
    expect(p.observacaoPcp).toBe('usar forma 12');
    expect(p.programacao).toHaveLength(1);
  });
});

describe('programar o pedido (gera as OPs)', () => {
  let repo: RepositorioMemoria; let id: string;
  beforeEach(async () => { repo = new RepositorioMemoria(); id = (await receberPedido(repo, recebido(), HOJE)).pedido!.id; });

  it('divide em caixas, numera a OP, liga ao pedido e guarda a previsão informada pelo PCP', async () => {
    const { ordens, pedido } = await programarPedido(repo, id, {
      linhas: [{ modelo: '45501', paresPorCaixa: 20 }], previsaoInicial: new Date('2026-10-20'), observacaoPcp: 'forma 12, matriz B',
    }, HOJE);
    expect(ordens.map((o) => [o.op, o.caixa, o.pares])).toEqual([['00001', '01', 20], ['00001', '02', 20], ['00001', '03', 20], ['00001', '04', 20], ['00001', '05', 20]]);
    expect(ordens[0]).toMatchObject({ cliente: 'Estoque Prado', plano: 'Pedido 43', pedidoId: id });
    expect(ordens[0]!.produto.startsWith('45501 · ')).toBe(true);
    expect(ordens[0]!.previsaoInicial).toEqual(new Date('2026-10-20'));
    expect(pedido).toMatchObject({ status: 'programado', observacaoPcp: 'forma 12, matriz B' });
    expect(pedido.programacao![0]).toMatchObject({ op: '00001', caixas: 5, pares: 100 });
  });

  it('última caixa leva o resto; OP continua a numeração existente', async () => {
    await repo.salvarOrdem(ordem({ op: '00120', caixa: '01' }));
    const { ordens } = await programarPedido(repo, id, { linhas: [{ modelo: '45501', paresPorCaixa: 30 }].map((l) => ({ ...l, paresPorCaixa: 18 })), previsaoInicial: new Date('2026-10-20') }, HOJE);
    expect(ordens.map((o) => o.pares)).toEqual([18, 18, 18, 18, 18, 10]);
    expect(ordens[0]!.op).toBe('00121');
  });

  it('exige previsão inicial, modelo certo, caixa 1–20 e previsão depois da entrada', async () => {
    const tenta = (e: Parameters<typeof programarPedido>[2]) => programarPedido(repo, id, e, HOJE);
    await expect(tenta({ linhas: [{ modelo: '45501', paresPorCaixa: 20 }] })).rejects.toThrow(/previsão inicial/);
    await expect(tenta({ linhas: [{ modelo: '99999', paresPorCaixa: 20 }], previsaoInicial: new Date('2026-10-20') })).rejects.toThrow(/Falta programar|não está no pedido/);
    await expect(tenta({ linhas: [{ modelo: '45501', paresPorCaixa: 25 }], previsaoInicial: new Date('2026-10-20') })).rejects.toThrow(/1 a 20/);
    await expect(tenta({ linhas: [{ modelo: '45501', paresPorCaixa: 20 }], previsaoInicial: new Date('2026-09-01') })).rejects.toThrow(/antes da entrada/);
    expect(await repo.listarOrdens()).toHaveLength(0); // nada foi criado pela metade
  });

  it('não programa duas vezes nem item sem código de modelo', async () => {
    await programarPedido(repo, id, { linhas: [{ modelo: '45501', paresPorCaixa: 20 }], previsaoInicial: new Date('2026-10-20') }, HOJE);
    await expect(programarPedido(repo, id, { linhas: [{ modelo: '45501', paresPorCaixa: 20 }], previsaoInicial: new Date('2026-10-20') }, HOJE)).rejects.toMatchObject({ status: 409 });
    const semCod = (await receberPedido(repo, recebido({ idExterno: '9', itens: [{ idExterno: '1', descricao: 'BOTA SEM CODIGO', quantidade: 10 }] }), HOJE)).pedido!;
    await expect(programarPedido(repo, semCod.id, { linhas: [{ modelo: SEM_CODIGO, paresPorCaixa: 10 }], previsaoInicial: new Date('2026-10-20') }, HOJE)).rejects.toThrow(/sem código de modelo/);
    await expect(programarPedido(repo, 'nao-existe', { linhas: [], }, HOJE)).rejects.toBeInstanceOf(ErroProgramacao);
  });

  it('um pedido com dois modelos gera uma OP por modelo, cada um com sua previsão', async () => {
    const dois = (await receberPedido(repo, recebido({ idExterno: '7', itens: [item(1, 40, 20), { idExterno: '2', codigo: '40501-38', descricao: '40501-BOTA ECO Tamanho:38', quantidade: 10 }] }), HOJE)).pedido!;
    const { ordens } = await programarPedido(repo, dois.id, {
      linhas: [{ modelo: '45501', paresPorCaixa: 20, previsaoInicial: new Date('2026-10-18') }, { modelo: '40501', paresPorCaixa: 10, previsaoInicial: new Date('2026-10-25') }],
    }, HOJE);
    expect(new Set(ordens.map((o) => o.op)).size).toBe(2);
    expect(ordens.find((o) => o.produto.startsWith('40501'))!.previsaoInicial).toEqual(new Date('2026-10-25'));
  });
});

describe('API da caixa de entrada', () => {
  const H = { 'x-api-key': 'k' };
  const SEGREDO = 'segredo-do-app';
  it('lista, programa e as OPs aparecem em /ordens', async () => {
    const repo = new RepositorioMemoria();
    const app = criarServidor({ repo, apiKeys: ['k'], agora: () => HOJE, segredoWebhook: SEGREDO });
    const { pedido } = await receberPedido(repo, recebido(), HOJE);
    const lista = (await app.inject({ url: '/pedidos?status=a_programar', headers: H })).json();
    expect(lista).toHaveLength(1);
    expect(lista[0].linhas[0]).toMatchObject({ modelo: '45501', pares: 100 });
    expect((await app.inject({ method: 'POST', url: `/pedidos/${pedido!.id}/programar`, headers: H, payload: { linhas: [{ modelo: '45501', paresPorCaixa: 20 }] } })).statusCode).toBe(422);
    const ok = await app.inject({ method: 'POST', url: `/pedidos/${pedido!.id}/programar`, headers: H,
      payload: { linhas: [{ modelo: '45501', paresPorCaixa: 20 }], previsaoInicial: '2026-10-20', observacaoPcp: 'forma 12' } });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().ordens).toHaveLength(5);
    expect((await app.inject({ url: '/ordens', headers: H })).json()).toHaveLength(5);
    expect((await app.inject({ url: '/pedidos?status=a_programar', headers: H })).json()).toHaveLength(0);
    expect((await app.inject({ url: '/pedidos' })).statusCode).toBe(401);
  });

  it('webhook: sem assinatura válida é recusado; com assinatura, atualiza o pedido', async () => {
    const repo = new RepositorioMemoria();
    const fonte = { origem: 'bling', listarAlterados: async () => [], obter: async () => recebido({ numero: '77' }) };
    const app = criarServidor({ repo, apiKeys: ['k'], agora: () => HOJE, fontePedidos: fonte, segredoWebhook: SEGREDO });
    const corpo = JSON.stringify({ event: 'order.created', data: { id: 1 } });
    const assin = 'sha256=' + createHmac('sha256', SEGREDO).update(corpo).digest('hex');
    const envia = (sig?: string) => app.inject({ method: 'POST', url: '/webhooks/bling', payload: corpo, headers: { 'content-type': 'application/json', ...(sig ? { 'x-bling-signature-256': sig } : {}) } });
    expect((await envia()).statusCode).toBe(401);
    expect((await envia('sha256=00')).statusCode).toBe(401);
    expect((await envia(assin)).statusCode).toBe(200);
    expect((await repo.listarPedidos())[0]!.numero).toBe('77');
  });
});

describe('conector Bling (API simulada)', () => {
  const resp = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

  it('renova o token vencido, grava o NOVO refresh token e usa o novo access token', async () => {
    const repo = new RepositorioMemoria();
    await repo.gravarToken({ nome: 'bling', accessToken: 'velho', refreshToken: 'r1', expiraEm: new Date(HOJE.getTime() - 1000) });
    const chamadas: { url: string; auth?: string; corpo?: string }[] = [];
    const fetchFalso = (async (url: string, init: any) => {
      chamadas.push({ url, auth: init?.headers?.Authorization, corpo: init?.body });
      if (url.includes('/oauth/token')) return resp({ access_token: 'novo', refresh_token: 'r2', expires_in: 21600 });
      return resp({ data: BLING_43 });
    }) as unknown as typeof fetch;
    const fonte = new FonteBling(repo, { clientId: 'id', clientSecret: 's', situacoesImportar: [6], situacoesCancelado: [12], fetch: fetchFalso, esperaMs: 0, agora: () => HOJE });
    const p = await fonte.obter('26944364806');
    expect(p?.numero).toBe('43');
    expect(chamadas[0]!.corpo).toContain('refresh_token=r1');
    expect(chamadas[0]!.auth).toMatch(/^Basic /);
    expect(chamadas.at(-1)!.auth).toBe('Bearer novo');
    expect(await repo.lerToken('bling')).toMatchObject({ accessToken: 'novo', refreshToken: 'r2' });
  });

  it('sem autorização prévia, falha com instrução clara', async () => {
    const fonte = new FonteBling(new RepositorioMemoria(), { clientId: 'i', clientSecret: 's', situacoesImportar: [6], situacoesCancelado: [12], fetch: (async () => resp({})) as unknown as typeof fetch, esperaMs: 0 });
    await expect(fonte.obter('1')).rejects.toThrow(/bling:autorizar/);
  });

  it('busca o código no cadastro do produto quando o item vem sem código (uma vez por produto)', async () => {
    const repo = new RepositorioMemoria();
    await repo.gravarToken({ nome: 'bling', accessToken: 't', refreshToken: 'r', expiraEm: new Date(HOJE.getTime() + 3_600_000) });
    const urls: string[] = [];
    const fetchFalso = (async (url: string) => {
      urls.push(url);
      if (url.includes('/produtos/16709480553')) return resp({ data: { codigo: '45501-40' } });
      if (url.includes('/produtos/16709480555')) return resp({ data: { codigo: '45501-42' } });
      return resp({ data: BLING_43 });
    }) as unknown as typeof fetch;
    const fonte = new FonteBling(repo, { clientId: 'i', clientSecret: 's', situacoesImportar: [6], situacoesCancelado: [12], fetch: fetchFalso, esperaMs: 0, agora: () => HOJE });
    const p = (await fonte.obter('1'))!;
    expect(p.itens.map((i) => i.codigo)).toEqual(['45501-40', '45501-42']);
    expect(consolidar(p)[0]).toMatchObject({ modelo: '45501', modeloPelaDescricao: false });
    await fonte.obter('1');
    expect(urls.filter((u) => u.includes('/produtos/')).length).toBe(2); // cache
  });

  it('sincroniza: importa os "Em aberto" e pula cancelados que nunca entraram', async () => {
    const repo = new RepositorioMemoria();
    await repo.gravarToken({ nome: 'bling', accessToken: 't', refreshToken: 'r', expiraEm: new Date(HOJE.getTime() + 3_600_000) });
    const urls: string[] = [];
    const fetchFalso = (async (url: string) => {
      urls.push(url);
      if (url.includes('/pedidos/vendas?')) return resp({ data: [{ id: 26944364806, situacao: { id: 6 } }, { id: 555, situacao: { id: 12 } }] });
      if (url.includes('/pedidos/vendas/26944364806')) return resp({ data: { ...BLING_43, itens: BLING_43.itens.map((i) => ({ ...i, codigo: '45501-40' })) } });
      return resp({}, 404);
    }) as unknown as typeof fetch;
    const fonte = new FonteBling(repo, { clientId: 'i', clientSecret: 's', situacoesImportar: [6], situacoesCancelado: [12], fetch: fetchFalso, esperaMs: 0, agora: () => HOJE });
    expect(await sincronizarPedidos(repo, fonte, new Date('2026-10-06T10:00:00Z'), HOJE)).toEqual({ novos: 1, atualizados: 0, ignorados: 0 });
    expect(urls.some((u) => u.includes('/pedidos/vendas/555'))).toBe(false);
    expect(urls[0]).toContain('idsSituacoes%5B%5D=6');
    expect(urls[0]).toContain('dataAlteracaoInicial=2026-10-06+10%3A00%3A00');
    expect(await sincronizarPedidos(repo, fonte, new Date('2026-10-06'), HOJE)).toMatchObject({ novos: 0, atualizados: 1 }); // idempotente
  });
});
