import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { RepositorioPostgres, migrar } from '../src/repositorio/postgres.js';
import { FonteBling, configBlingDoAmbiente } from '../src/integracoes/bling-pedidos.js';

/**
 * Autorização única do Bling (OAuth).
 *   1) npm run bling:autorizar            -> mostra o link para o dono da conta autorizar
 *   2) npm run bling:autorizar -- CODIGO  -> troca o código (parâmetro "code" do endereço de retorno) pelos tokens
 */
const cfg = configBlingDoAmbiente();
if (!cfg) { console.error('Defina BLING_CLIENT_ID e BLING_CLIENT_SECRET.'); process.exit(1); }
const codigo = process.argv[2];

if (!codigo) {
  const estado = randomBytes(8).toString('hex');
  console.log('Abra este link logado como administrador do Bling e clique em Autorizar:\n');
  console.log(`https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${cfg.clientId}&state=${estado}\n`);
  console.log('Depois copie o valor de "code" do endereço para o qual o Bling redirecionar e rode:\n  npm run bling:autorizar -- <code>');
  process.exit(0);
}
if (!process.env.DATABASE_URL) { console.error('Defina DATABASE_URL (os tokens ficam no banco).'); process.exit(1); }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
await migrar(pool);
await new FonteBling(new RepositorioPostgres(pool), cfg).autorizar(codigo);
console.log('Bling autorizado. Os tokens foram gravados no banco (e se renovam sozinhos).');
await pool.end();
