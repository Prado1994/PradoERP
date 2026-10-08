import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import pg from 'pg';
import type { Repositorio } from './repositorio.js';
import type { EventoEtapa, ItemFila, OrdemProducao, Parada, ResultadoLeitura, TokenIntegracao } from '../dominio/tipos.js';
import type { PedidoEntrada } from '../dominio/pedidos.js';
import type { Sigla } from '../dominio/etapas.js';

type Linha = Record<string, any>;

const PASTA_MIGRACOES = fileURLToPath(new URL('../../db/migrations', import.meta.url));

/** Aplica, em ordem, as migrações ainda não registradas. Seguro para rodar a cada início. */
export async function migrar(pool: pg.Pool, pasta = PASTA_MIGRACOES): Promise<string[]> {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migracoes (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())',
  );
  const feitas = new Set((await pool.query('SELECT nome FROM schema_migracoes')).rows.map((r) => r.nome as string));
  const arquivos = (await readdir(pasta)).filter((f) => f.endsWith('.sql')).sort();
  const aplicadas: string[] = [];
  for (const nome of arquivos) {
    if (feitas.has(nome)) continue;
    const client = await pool.connect();
    try {
      // as migrações trazem BEGIN/COMMIT próprios
      await client.query(await readFile(join(pasta, nome), 'utf8'));
      await client.query('INSERT INTO schema_migracoes (nome) VALUES ($1)', [nome]);
      aplicadas.push(nome);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
  return aplicadas;
}

const paraOrdem = (r: Linha, hist: Linha[]): OrdemProducao => ({
  id: r.id,
  op: r.op,
  caixa: r.caixa,
  ...(r.plano ? { plano: r.plano } : {}),
  ...(r.pedido_id ? { pedidoId: r.pedido_id } : {}),
  cliente: r.cliente,
  produto: r.produto,
  pares: r.pares,
  entrada: r.entrada,
  previsaoInicial: r.previsao_inicial,
  previsaoAtual: r.previsao_atual,
  historicoPrevisao: hist.map((h) => ({ em: h.em, de: h.de, para: h.para, motivo: h.motivo })),
  criadaEm: r.criada_em,
});

const paraEvento = (r: Linha): EventoEtapa => ({
  id: r.id,
  ordemId: r.ordem_id,
  sigla: r.sigla,
  em: r.em,
  estacao: r.estacao,
  ...(r.operador ? { operador: r.operador } : {}),
  idLeitura: r.id_leitura,
  colado: r.colado,
});

const paraParada = (r: Linha): Parada => ({
  id: r.id,
  sigla: r.sigla,
  motivo: r.motivo,
  inicio: r.inicio,
  ...(r.fim ? { fim: r.fim } : {}),
  ...(r.operador ? { operador: r.operador } : {}),
});

const paraItem = (r: Linha): ItemFila => ({
  id: r.id,
  destino: r.destino,
  tipo: r.tipo,
  payload: r.payload,
  criadoEm: r.criado_em,
  tentativas: r.tentativas,
  proximaTentativa: r.proxima_tentativa,
  status: r.status,
  ...(r.ultimo_erro ? { ultimoErro: r.ultimo_erro } : {}),
});

const paraPedido = (r: Linha): PedidoEntrada => ({
  id: r.id, origem: r.origem, idExterno: r.id_externo, numero: r.numero, cliente: r.cliente,
  ...(r.documento_cliente ? { documentoCliente: r.documento_cliente } : {}),
  ...(r.data_pedido ? { dataPedido: r.data_pedido } : {}),
  ...(r.previsao_externa ? { previsaoExterna: r.previsao_externa } : {}),
  ...(r.situacao_externa ? { situacaoExterna: r.situacao_externa } : {}),
  ...(r.total !== null && r.total !== undefined ? { total: Number(r.total) } : {}),
  itens: r.itens, status: r.status,
  ...(r.observacao_pcp ? { observacaoPcp: r.observacao_pcp } : {}),
  ...(r.programado_em ? { programadoEm: r.programado_em } : {}),
  ...(r.programacao ? { programacao: r.programacao.map((l: Linha) => ({ ...l, previsaoInicial: new Date(l.previsaoInicial) })) } : {}),
  ...(r.alerta ? { alerta: r.alerta } : {}),
  recebidoEm: r.recebido_em, atualizadoEm: r.atualizado_em,
});

/** Persistência em PostgreSQL. Mesmo contrato do RepositorioMemoria. */
export class RepositorioPostgres implements Repositorio {
  constructor(readonly pool: pg.Pool) {}

  static conectar(databaseUrl: string): RepositorioPostgres {
    // Neon e similares exigem SSL; a URL traz sslmode=require quando necessário.
    return new RepositorioPostgres(new pg.Pool({ connectionString: databaseUrl, max: 5 }));
  }

  fechar() { return this.pool.end(); }

  // ---- Ordens ----
  async salvarOrdem(o: OrdemProducao) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO ordens (id, op, caixa, plano, cliente, produto, pares, entrada, previsao_inicial, previsao_atual, criada_em, pedido_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO UPDATE SET plano = EXCLUDED.plano, pedido_id = EXCLUDED.pedido_id, cliente = EXCLUDED.cliente, produto = EXCLUDED.produto,
           pares = EXCLUDED.pares, entrada = EXCLUDED.entrada, previsao_inicial = EXCLUDED.previsao_inicial,
           previsao_atual = EXCLUDED.previsao_atual`,
        [o.id, o.op, o.caixa, o.plano ?? null, o.cliente, o.produto, o.pares, o.entrada, o.previsaoInicial, o.previsaoAtual, o.criadaEm, o.pedidoId ?? null],
      );
      // O histórico só cresce: grava apenas as mudanças que ainda não estão no banco.
      const { rows } = await client.query('SELECT count(*)::int AS n FROM previsoes WHERE ordem_id = $1', [o.id]);
      for (const m of o.historicoPrevisao.slice(rows[0].n)) {
        await client.query(
          'INSERT INTO previsoes (id, ordem_id, em, de, para, motivo) VALUES (gen_random_uuid(), $1,$2,$3,$4,$5)',
          [o.id, m.em, m.de, m.para, m.motivo],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  private async montarOrdens(where = '', params: unknown[] = []): Promise<OrdemProducao[]> {
    const { rows } = await this.pool.query(`SELECT * FROM ordens ${where} ORDER BY criada_em, op, caixa`, params);
    if (rows.length === 0) return [];
    const hist = await this.pool.query(
      'SELECT * FROM previsoes WHERE ordem_id = ANY($1::uuid[]) ORDER BY em, id',
      [rows.map((r) => r.id)],
    );
    return rows.map((r) => paraOrdem(r, hist.rows.filter((h) => h.ordem_id === r.id)));
  }

  async buscarOrdem(id: string) { return (await this.montarOrdens('WHERE id = $1', [id]))[0]; }
  async buscarOrdemPorCodigo(op: string, caixa: string) {
    return (await this.montarOrdens('WHERE op = $1 AND caixa = $2', [op, caixa]))[0];
  }
  buscarOrdensPorOp(op: string) { return this.montarOrdens('WHERE op = $1', [op]); }
  listarOrdens() { return this.montarOrdens(); }

  // ---- Eventos (somente inclusão) ----
  async adicionarEvento(e: EventoEtapa) {
    await this.pool.query(
      `INSERT INTO eventos_etapa (id, ordem_id, sigla, em, estacao, operador, id_leitura, colado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [e.id, e.ordemId, e.sigla, e.em, e.estacao, e.operador ?? null, e.idLeitura, e.colado],
    );
  }
  async eventosDaOrdem(ordemId: string) {
    const { rows } = await this.pool.query('SELECT * FROM eventos_etapa WHERE ordem_id = $1 ORDER BY em, id', [ordemId]);
    return rows.map(paraEvento);
  }
  async todosEventos() {
    const { rows } = await this.pool.query('SELECT * FROM eventos_etapa ORDER BY em, id');
    return rows.map(paraEvento);
  }

  // ---- Idempotência ----
  async buscarLeitura(idLeitura: string) {
    const { rows } = await this.pool.query('SELECT resultado FROM leituras WHERE id_leitura = $1', [idLeitura]);
    return rows[0]?.resultado as ResultadoLeitura | undefined;
  }
  async guardarLeitura(r: ResultadoLeitura) {
    await this.pool.query(
      'INSERT INTO leituras (id_leitura, resultado) VALUES ($1,$2) ON CONFLICT (id_leitura) DO UPDATE SET resultado = EXCLUDED.resultado',
      [r.idLeitura, JSON.stringify(r)],
    );
  }

  // ---- Paradas ----
  async abrirParada(p: Parada) {
    await this.pool.query(
      'INSERT INTO paradas (id, sigla, motivo, inicio, fim, operador) VALUES ($1,$2,$3,$4,$5,$6)',
      [p.id, p.sigla, p.motivo, p.inicio, p.fim ?? null, p.operador ?? null],
    );
  }
  async paradaAberta(sigla: Sigla) {
    const { rows } = await this.pool.query('SELECT * FROM paradas WHERE sigla = $1 AND fim IS NULL', [sigla]);
    return rows[0] ? paraParada(rows[0]) : undefined;
  }
  async fecharParada(id: string, fim: Date) {
    await this.pool.query('UPDATE paradas SET fim = $2 WHERE id = $1', [id, fim]);
  }
  async listarParadas() {
    const { rows } = await this.pool.query('SELECT * FROM paradas ORDER BY inicio, id');
    return rows.map(paraParada);
  }

  // ---- Fila de sincronização ----
  async enfileirar(i: ItemFila) {
    await this.pool.query(
      `INSERT INTO fila_sincronizacao (id, destino, tipo, payload, criado_em, tentativas, proxima_tentativa, status, ultimo_erro)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [i.id, i.destino, i.tipo, JSON.stringify(i.payload), i.criadoEm, i.tentativas, i.proximaTentativa, i.status, i.ultimoErro ?? null],
    );
  }
  async filaPronta(agora: Date) {
    const { rows } = await this.pool.query(
      "SELECT * FROM fila_sincronizacao WHERE status = 'pendente' AND proxima_tentativa <= $1 ORDER BY criado_em, id",
      [agora],
    );
    return rows.map(paraItem);
  }
  async atualizarItemFila(i: ItemFila) {
    await this.pool.query(
      'UPDATE fila_sincronizacao SET tentativas = $2, proxima_tentativa = $3, status = $4, ultimo_erro = $5 WHERE id = $1',
      [i.id, i.tentativas, i.proximaTentativa, i.status, i.ultimoErro ?? null],
    );
  }
  async listarFila() {
    const { rows } = await this.pool.query('SELECT * FROM fila_sincronizacao ORDER BY criado_em, id');
    return rows.map(paraItem);
  }

  // ---- Caixa de entrada de pedidos ----
  async salvarPedido(p: PedidoEntrada) {
    await this.pool.query(
      `INSERT INTO pedidos_entrada (id, origem, id_externo, numero, cliente, documento_cliente, data_pedido, previsao_externa, situacao_externa,
         total, itens, status, observacao_pcp, programado_em, programacao, alerta, recebido_em, atualizado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO UPDATE SET numero = EXCLUDED.numero, cliente = EXCLUDED.cliente, documento_cliente = EXCLUDED.documento_cliente,
         data_pedido = EXCLUDED.data_pedido, previsao_externa = EXCLUDED.previsao_externa, situacao_externa = EXCLUDED.situacao_externa,
         total = EXCLUDED.total, itens = EXCLUDED.itens, status = EXCLUDED.status, observacao_pcp = EXCLUDED.observacao_pcp,
         programado_em = EXCLUDED.programado_em, programacao = EXCLUDED.programacao, alerta = EXCLUDED.alerta, atualizado_em = EXCLUDED.atualizado_em`,
      [p.id, p.origem, p.idExterno, p.numero, p.cliente, p.documentoCliente ?? null, p.dataPedido ?? null, p.previsaoExterna ?? null,
       p.situacaoExterna ?? null, p.total ?? null, JSON.stringify(p.itens), p.status, p.observacaoPcp ?? null, p.programadoEm ?? null,
       p.programacao ? JSON.stringify(p.programacao) : null, p.alerta ?? null, p.recebidoEm, p.atualizadoEm],
    );
  }
  async buscarPedido(id: string) {
    const { rows } = await this.pool.query('SELECT * FROM pedidos_entrada WHERE id = $1', [id]);
    return rows[0] ? paraPedido(rows[0]) : undefined;
  }
  async buscarPedidoPorOrigem(origem: string, idExterno: string) {
    const { rows } = await this.pool.query('SELECT * FROM pedidos_entrada WHERE origem = $1 AND id_externo = $2', [origem, idExterno]);
    return rows[0] ? paraPedido(rows[0]) : undefined;
  }
  async listarPedidos() {
    const { rows } = await this.pool.query('SELECT * FROM pedidos_entrada ORDER BY recebido_em, id');
    return rows.map(paraPedido);
  }

  // ---- Credenciais de integração ----
  async lerToken(nome: string) {
    const { rows } = await this.pool.query('SELECT * FROM integracao_tokens WHERE nome = $1', [nome]);
    const r = rows[0];
    return r ? ({ nome: r.nome, accessToken: r.access_token, refreshToken: r.refresh_token, expiraEm: r.expira_em } as TokenIntegracao) : undefined;
  }
  async gravarToken(t: TokenIntegracao) {
    await this.pool.query(
      `INSERT INTO integracao_tokens (nome, access_token, refresh_token, expira_em) VALUES ($1,$2,$3,$4)
       ON CONFLICT (nome) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token,
         expira_em = EXCLUDED.expira_em, atualizado_em = now()`,
      [t.nome, t.accessToken, t.refreshToken, t.expiraEm],
    );
  }
}
