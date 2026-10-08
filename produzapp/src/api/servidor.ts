import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { randomUUID } from 'node:crypto';
import type { Repositorio } from '../repositorio/repositorio.js';
import type { EventoEtapa, OrdemProducao } from '../dominio/tipos.js';
import { CONFIG_PADRAO, processarLeitura, type ConfigLeitura } from '../dominio/leitura.js';
import { pad } from '../dominio/codigo.js';
import { reprogramar } from '../dominio/previsao.js';
import {
  atrasoDias, calcularIndicadores, diasProducao, etapaAtual, etapasConcluidas, inicioDoDia, prazoPlanejado, situacao,
} from '../dominio/prazos.js';

export interface OpcoesServidor {
  repo: Repositorio;
  apiKeys: string[];
  config?: ConfigLeitura;
  /** Relógio injetável: facilita testes. */
  agora?: () => Date;
  /** Pasta com as telas (estação, painel). Servidas sem chave; a chave é pedida pelas telas para chamar a API. */
  pastaWeb?: string;
}

const ROTAS_API = ['/saude', '/leituras', '/ordens', '/paradas', '/indicadores', '/sincronizacao'];
const ehRotaApi = (url: string) => ROTAS_API.some((r) => url === r || url.startsWith(r + '/') || url.startsWith(r + '?'));

const data = (v: unknown): Date | undefined => {
  if (typeof v !== 'string' && !(v instanceof Date)) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export function criarServidor(opcoes: OpcoesServidor): FastifyInstance {
  const { repo, apiKeys } = opcoes;
  const config = opcoes.config ?? CONFIG_PADRAO;
  const agora = opcoes.agora ?? (() => new Date());
  const app = Fastify({ logger: false });

  // ---- Autenticação por chave (uma por cliente da API) ----
  app.addHook('onRequest', async (req, reply) => {
    if (req.url === '/saude') return;
    if (opcoes.pastaWeb && !ehRotaApi(req.url)) return; // arquivos das telas
    const chave = req.headers['x-api-key'];
    if (typeof chave !== 'string' || !apiKeys.includes(chave)) {
      return reply.code(401).send({ erro: 'Chave de API ausente ou inválida.' });
    }
  });

  if (opcoes.pastaWeb) app.register(fastifyStatic, { root: opcoes.pastaWeb });

  const visao = async (o: OrdemProducao, eventos?: EventoEtapa[]) => {
    const ev = eventos ?? (await repo.eventosDaOrdem(o.id));
    const hoje = agora();
    return {
      id: o.id, op: o.op, caixa: o.caixa, plano: o.plano, cliente: o.cliente, produto: o.produto, pares: o.pares,
      entrada: o.entrada, previsaoInicial: o.previsaoInicial, previsaoAtual: o.previsaoAtual,
      reprogramadaDias: Math.round((o.previsaoAtual.getTime() - o.previsaoInicial.getTime()) / 86_400_000),
      etapasConcluidas: etapasConcluidas(ev), etapaAtual: etapaAtual(ev),
      situacao: situacao(o, ev, hoje), atrasoDias: atrasoDias(o, ev, hoje),
      diasProducao: diasProducao(o, ev, hoje), prazoPlanejadoDias: prazoPlanejado(o),
    };
  };

  app.get('/saude', async () => ({ ok: true, hora: agora().toISOString() }));

  // ---- Leituras (estação) ----
  app.post('/leituras', async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (typeof b.codigo !== 'string' || typeof b.estacao !== 'string') {
      return reply.code(400).send({ erro: 'Informe "codigo" e "estacao".' });
    }
    // Leitura feita offline chega depois: "lidoEm" preserva a hora real do bipe (aceita até 7 dias atrás, nunca no futuro).
    const agoraData = agora();
    const lido = data(b.lidoEm);
    const hora = lido && lido.getTime() <= agoraData.getTime() + 60_000 && agoraData.getTime() - lido.getTime() <= 7 * 86_400_000
      ? lido : agoraData;
    return processarLeitura(repo, {
      codigo: b.codigo, estacao: b.estacao.toUpperCase(),
      idLeitura: typeof b.idLeitura === 'string' ? b.idLeitura : undefined,
      operador: typeof b.operador === 'string' ? b.operador : undefined,
    }, config, hora);
  });

  // ---- Ordens ----
  app.get('/ordens', async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const lista = await Promise.all((await repo.listarOrdens()).map((o) => visao(o)));
    return lista
      .filter((o) => (!q.cliente || o.cliente === q.cliente) && (!q.produto || o.produto === q.produto) &&
        (!q.situacao || o.situacao === q.situacao))
      .sort((a, b) => b.atrasoDias - a.atrasoDias || a.previsaoInicial.getTime() - b.previsaoInicial.getTime());
  });

  app.get('/ordens/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const o = await repo.buscarOrdem(id);
    if (!o) return reply.code(404).send({ erro: 'OP não encontrada.' });
    const eventos = await repo.eventosDaOrdem(o.id);
    return { ...(await visao(o, eventos)), historicoPrevisao: o.historicoPrevisao, eventos };
  });

  app.post('/ordens', async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const previsao = data(b.previsaoInicial);
    const pares = Number(b.pares);
    if (typeof b.op !== 'string' || typeof b.caixa !== 'string' || typeof b.cliente !== 'string' ||
        typeof b.produto !== 'string' || !previsao || !Number.isInteger(pares) || pares <= 0) {
      return reply.code(400).send({ erro: 'Campos obrigatórios: op, caixa, cliente, produto, pares (inteiro > 0), previsaoInicial.' });
    }
    const op = pad(b.op, 5), caixa = pad(b.caixa, 2);
    if (await repo.buscarOrdemPorCodigo(op, caixa)) {
      return reply.code(409).send({ erro: `OP ${op} caixa ${caixa} já existe.` });
    }
    const agoraData = agora();
    const ordem: OrdemProducao = {
      id: randomUUID(), op, caixa, plano: typeof b.plano === 'string' ? b.plano : undefined,
      cliente: b.cliente, produto: b.produto, pares,
      entrada: data(b.entrada) ?? inicioDoDia(agoraData),
      previsaoInicial: previsao, previsaoAtual: previsao, historicoPrevisao: [], criadaEm: agoraData,
    };
    await repo.salvarOrdem(ordem);
    return reply.code(201).send(await visao(ordem, []));
  });

  app.patch('/ordens/:id/previsao', async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as Record<string, unknown>;
    const o = await repo.buscarOrdem(id);
    if (!o) return reply.code(404).send({ erro: 'OP não encontrada.' });
    const para = data(b.para);
    if (!para || typeof b.motivo !== 'string' || !b.motivo.trim()) {
      return reply.code(422).send({ erro: 'Informe "para" (data) e "motivo" (obrigatório).' });
    }
    const nova = reprogramar(o, para, b.motivo, agora());
    await repo.salvarOrdem(nova);
    return { ...(await visao(nova)), historicoPrevisao: nova.historicoPrevisao };
  });

  // ---- Paradas, indicadores, sincronização ----
  app.get('/paradas', async () => repo.listarParadas());

  app.get('/indicadores', async () => {
    const ordens = await repo.listarOrdens();
    const mapa = new Map<string, EventoEtapa[]>();
    for (const o of ordens) mapa.set(o.id, await repo.eventosDaOrdem(o.id));
    return calcularIndicadores(ordens, mapa, agora());
  });

  app.get('/sincronizacao/pendentes', async () => {
    const fila = await repo.listarFila();
    return {
      pendentes: fila.filter((i) => i.status === 'pendente'),
      falhas: fila.filter((i) => i.status === 'falha'),
      enviados: fila.filter((i) => i.status === 'enviado').length,
    };
  });

  return app;
}
