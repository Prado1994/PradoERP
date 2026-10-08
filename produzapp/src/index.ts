import { montarApp } from './app.js';
import { sincronizarPedidos } from './sincronizacaoPedidos.js';
import { processarFila } from './sincronizacao.js';
import { DestinoSimulado } from './integracoes/simulados.js';

let montado;
try {
  montado = await montarApp();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
const { app, repo, fontePedidos } = montado;

// Fase 3 troca o destino simulado pelo conector real do Bling.
const bling = new DestinoSimulado('bling');
setInterval(() => { processarFila(repo, { bling }).catch((e) => console.error('sincronização:', e)); }, 10_000);

// Conferidor de pedidos: o webhook avisa na hora; isto cobre avisos perdidos e é idempotente.
if (fontePedidos) {
  let desde = process.env.BLING_IMPORTAR_DESDE ? new Date(process.env.BLING_IMPORTAR_DESDE) : new Date(Date.now() - 2 * 86_400_000);
  if (Number.isNaN(desde.getTime())) { console.error('BLING_IMPORTAR_DESDE inválida (use AAAA-MM-DD).'); process.exit(1); }
  const conferir = async () => {
    const inicio = new Date();
    try {
      const r = await sincronizarPedidos(repo, fontePedidos, desde);
      desde = new Date(inicio.getTime() - 10 * 60_000); // sobreposição de 10 min por segurança
      if (r.novos || r.atualizados) console.log(`pedidos: ${r.novos} novos, ${r.atualizados} atualizados`);
    } catch (e) { console.error('pedidos (Bling):', (e as Error).message); }
  };
  void conferir();
  setInterval(conferir, 5 * 60_000);
}

const porta = Number(process.env.PORT ?? 3000);
await app.listen({ port: porta, host: '0.0.0.0' });
console.log(`produzapp na porta ${porta} · banco: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'memória (dados se perdem ao reiniciar)'}`);
