import { criarServidor } from './api/servidor.js';
import type { Repositorio } from './repositorio/repositorio.js';
import { RepositorioMemoria } from './repositorio/memoria.js';
import { RepositorioPostgres, migrar } from './repositorio/postgres.js';
import { fileURLToPath } from 'node:url';
import { carregarDemonstracao } from './seed.js';
import { FonteBling, configBlingDoAmbiente } from './integracoes/bling-pedidos.js';

/** Escolhe o repositório pelo ambiente: com DATABASE_URL usa PostgreSQL, sem ela usa memória (só desenvolvimento). */
export async function criarRepositorio(env = process.env): Promise<Repositorio> {
  if (env.DATABASE_URL) {
    const repo = RepositorioPostgres.conectar(env.DATABASE_URL);
    if (env.MIGRAR_AO_INICIAR !== '0') await migrar(repo.pool);
    return repo;
  }
  const repo = new RepositorioMemoria();
  if (env.SEED === '1') await carregarDemonstracao(repo);
  return repo;
}

export function lerApiKeys(env = process.env): string[] {
  return (env.API_KEYS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function configDoAmbiente(env = process.env) {
  return {
    bloquearForaDeSequencia: env.BLOQUEAR_FORA_DE_SEQUENCIA !== '0',
    paresPadrao: Number(env.PARES_PADRAO_POR_CAIXA ?? 20),
  };
}

export async function montarApp(env = process.env) {
  const apiKeys = lerApiKeys(env);
  if (apiKeys.length === 0) throw new Error('Defina API_KEYS (veja .env.example).');
  const repo = await criarRepositorio(env);
  const cfgBling = configBlingDoAmbiente(env);
  const fontePedidos = cfgBling ? new FonteBling(repo, cfgBling) : undefined;
  const app = criarServidor({ repo, apiKeys, config: configDoAmbiente(env), fontePedidos, segredoWebhook: cfgBling?.clientSecret,
    pastaWeb: env.SERVIR_TELAS === '0' ? undefined : fileURLToPath(new URL('../web', import.meta.url)) });
  return { app, repo, fontePedidos };
}
