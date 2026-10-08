import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Repositorio } from '../repositorio/repositorio.js';
import type { FontePedidos } from '../integracoes/bling-pedidos.js';
import { consolidar, type PedidoEntrada } from '../dominio/pedidos.js';
import { ErroProgramacao, programarPedido, receberPedido } from '../pedidos.js';
import { sincronizarPedidos } from '../sincronizacaoPedidos.js';

export interface DepsPedidos {
  repo: Repositorio;
  agora: () => Date;
  fonte?: FontePedidos;
  /** Segredo para validar a assinatura dos avisos (webhooks) da origem. */
  segredoWebhook?: string;
}

declare module 'fastify' { interface FastifyRequest { rawBody?: string } }

const data = (v: unknown): Date | undefined => {
  if (typeof v !== 'string') return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const visaoPedido = (p: PedidoEntrada) => ({ ...p, linhas: consolidar(p) });

export function assinaturaValida(corpo: string, cabecalho: unknown, segredo: string): boolean {
  if (typeof cabecalho !== 'string') return false;
  const esperado = 'sha256=' + createHmac('sha256', segredo).update(corpo).digest('hex');
  const a = Buffer.from(cabecalho.trim()), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registrarRotasPedidos(app: FastifyInstance, { repo, agora, fonte, segredoWebhook }: DepsPedidos) {
  // guarda o corpo cru: a assinatura do webhook é calculada sobre ele
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    req.rawBody = body as string;
    if (!body) return done(null, undefined);
    try { done(null, JSON.parse(body as string)); } catch (e) { (e as any).statusCode = 400; done(e as Error); }
  });

  app.get('/pedidos', async (req) => {
    const q = req.query as { status?: string };
    const todos = await repo.listarPedidos();
    const lista = todos.filter((p) => !q.status || p.status === q.status);
    const ordens = await repo.listarOrdens();
    return lista.map((p) => ({ ...visaoPedido(p), ordens: ordens.filter((o) => o.pedidoId === p.id).map((o) => ({ id: o.id, op: o.op, caixa: o.caixa, pares: o.pares })) }));
  });

  app.get('/pedidos/:id', async (req, reply) => {
    const p = await repo.buscarPedido((req.params as { id: string }).id);
    return p ? visaoPedido(p) : reply.code(404).send({ erro: 'Pedido não encontrado.' });
  });

  app.post('/pedidos/:id/programar', async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, any>;
    if (!Array.isArray(b.linhas) || b.linhas.length === 0) return reply.code(400).send({ erro: 'Informe "linhas" (uma por modelo).' });
    try {
      const { pedido, ordens } = await programarPedido(repo, (req.params as { id: string }).id, {
        linhas: b.linhas.map((l: any) => ({
          modelo: String(l.modelo ?? ''), paresPorCaixa: Number(l.paresPorCaixa),
          previsaoInicial: data(l.previsaoInicial), op: typeof l.op === 'string' && l.op.trim() ? l.op.trim() : undefined,
        })),
        previsaoInicial: data(b.previsaoInicial), observacaoPcp: typeof b.observacaoPcp === 'string' ? b.observacaoPcp : undefined,
        entrada: data(b.entrada),
      }, agora());
      return reply.code(201).send({ pedido: visaoPedido(pedido), ordens: ordens.map((o) => ({ id: o.id, op: o.op, caixa: o.caixa, pares: o.pares })) });
    } catch (e) {
      if (e instanceof ErroProgramacao) return reply.code(e.status).send({ erro: e.message });
      throw e;
    }
  });

  // "Sincronizar agora": busca na origem o que mudou nos últimos dias (reenvio é inofensivo).
  app.post('/pedidos/sincronizar', async (req, reply) => {
    if (!fonte) return reply.code(503).send({ erro: 'Integração com o Bling não está configurada neste servidor.' });
    const dias = Math.min(30, Math.max(1, Number((req.body as any)?.dias) || 2));
    try {
      return await sincronizarPedidos(repo, fonte, new Date(agora().getTime() - dias * 86_400_000), agora());
    } catch (e) {
      return reply.code(502).send({ erro: (e as Error).message });
    }
  });

  // Aviso da origem (webhook). Sem chave de API: a autenticação é a assinatura.
  app.post('/webhooks/bling', async (req, reply) => {
    if (!segredoWebhook || !fonte) return reply.code(503).send({ erro: 'Webhook não configurado.' });
    if (!assinaturaValida(req.rawBody ?? '', req.headers['x-bling-signature-256'], segredoWebhook)) {
      return reply.code(401).send({ erro: 'Assinatura inválida.' });
    }
    const b = (req.body ?? {}) as { event?: string; data?: { id?: number | string } };
    const evento = String(b.event ?? '');
    const id = b.data?.id !== undefined ? String(b.data.id) : '';
    if (!evento.startsWith('order.') || !id) return { ok: true, ignorado: true };
    try {
      if (evento === 'order.deleted') {
        const atual = await repo.buscarPedidoPorOrigem(fonte.origem, id);
        if (atual) await receberPedido(repo, { ...atual, cancelado: true }, agora());
      } else {
        const p = await fonte.obter(id);
        if (p) await receberPedido(repo, p, agora());
      }
    } catch (e) {
      // 5xx faz o Bling reenviar; o conferidor periódico cobre o resto
      return reply.code(502).send({ erro: (e as Error).message });
    }
    return { ok: true };
  });
}
