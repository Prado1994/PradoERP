import { randomUUID } from 'node:crypto';
import type { Repositorio } from './repositorio/repositorio.js';
import { inicioDoDia } from './dominio/prazos.js';

/** OPs de demonstração (desenvolvimento). Nunca roda em produção. */
export async function carregarDemonstracao(repo: Repositorio, hoje = new Date()) {
  const base = inicioDoDia(hoje).getTime();
  const dia = 86_400_000;
  const modelos = [
    ['40501 · Bota elástica ECO PVC', 'Estoque Prado'],
    ['45501 · Bota elástica PVC', 'Indústria de Calçado'],
    ['45505 · Sapato elástico PVC', 'Cooperativa'],
  ] as const;
  for (let i = 0; i < 6; i++) {
    const [produto, cliente] = modelos[i % modelos.length]!;
    const entrada = new Date(base - (2 + i) * dia);
    const previsaoInicial = new Date(entrada.getTime() + (6 + i * 2) * dia);
    await repo.salvarOrdem({
      id: randomUUID(), op: String(101 + i).padStart(5, '0'), caixa: '01', cliente, produto,
      pares: i % 2 ? 10 : 20, entrada, previsaoInicial, previsaoAtual: previsaoInicial,
      historicoPrevisao: [], criadaEm: entrada,
    });
  }
}
