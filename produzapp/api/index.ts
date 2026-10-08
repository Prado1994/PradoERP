import type { IncomingMessage, ServerResponse } from 'node:http';
import { montarApp } from '../src/app.js';

/**
 * Função serverless da Vercel: toda chamada a /api/* cai aqui e é repassada ao Fastify.
 * Exige DATABASE_URL (memória não persiste entre invocações) e API_KEYS.
 */
let pronto: ReturnType<typeof iniciar> | undefined;

async function iniciar() {
  if (!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL: sem banco, nada é gravado na Vercel.');
  const { app } = await montarApp();
  await app.ready();
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    pronto ??= iniciar();
    const app = await pronto;
    req.url = (req.url ?? '/').replace(/^\/api(?=\/|\?|$)/, '') || '/';
    app.server.emit('request', req, res);
  } catch (e) {
    pronto = undefined; // tenta de novo na próxima chamada
    console.error('falha ao iniciar a API:', (e as Error).message);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ erro: 'API indisponível: veja os logs.' }));
  }
}
