import { montarApp } from './app.js';
import { processarFila } from './sincronizacao.js';
import { DestinoSimulado } from './integracoes/simulados.js';

let montado;
try {
  montado = await montarApp();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
const { app, repo } = montado;

// Fase 3 troca o destino simulado pelo conector real do Bling.
const bling = new DestinoSimulado('bling');
setInterval(() => { processarFila(repo, { bling }).catch((e) => console.error('sincronização:', e)); }, 10_000);

const porta = Number(process.env.PORT ?? 3000);
await app.listen({ port: porta, host: '0.0.0.0' });
console.log(`produzapp na porta ${porta} · banco: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'memória (dados se perdem ao reiniciar)'}`);
