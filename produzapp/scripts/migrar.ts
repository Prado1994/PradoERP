import pg from 'pg';
import { migrar } from '../src/repositorio/postgres.js';

const url = process.env.DATABASE_URL;
if (!url) { console.error('Defina DATABASE_URL.'); process.exit(1); }
const pool = new pg.Pool({ connectionString: url, max: 1 });
const feitas = await migrar(pool);
console.log(feitas.length ? `Migrações aplicadas: ${feitas.join(', ')}` : 'Banco já está atualizado.');
await pool.end();
