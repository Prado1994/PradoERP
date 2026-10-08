import type { Repositorio } from '../repositorio/repositorio.js';
import type { TokenIntegracao } from '../dominio/tipos.js';
import type { ItemPedido } from '../dominio/pedidos.js';
import type { PedidoRecebido } from '../pedidos.js';

/** Contrato de uma origem de pedidos. O núcleo só conhece isto; o Bling é um detalhe desta pasta. */
export interface FontePedidos {
  readonly origem: string;
  /** Pedidos criados ou alterados desde `desde`. `jaConhecido` evita buscar o detalhe de cancelados que nunca entraram. */
  listarAlterados(desde: Date, jaConhecido: (idExterno: string) => Promise<boolean>): Promise<PedidoRecebido[]>;
  obter(idExterno: string): Promise<PedidoRecebido | undefined>;
}

export interface ConfigBling {
  clientId: string;
  clientSecret: string;
  /** Situações (IDs da conta) que entram na caixa de entrada. Padrão: Em aberto (6). */
  situacoesImportar: number[];
  /** Situações que significam cancelado (para avisar o PCP). Padrão: Cancelado (12). */
  situacoesCancelado: number[];
  fetch?: typeof fetch;
  /** Intervalo mínimo entre chamadas (o Bling limita ~3 req/s). */
  esperaMs?: number;
  agora?: () => Date;
}

const API = 'https://api.bling.com.br/Api/v3';
const TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';
export const NOME_TOKEN = 'bling';

export function configBlingDoAmbiente(env = process.env): ConfigBling | undefined {
  if (!env.BLING_CLIENT_ID || !env.BLING_CLIENT_SECRET) return undefined;
  const lista = (v: string | undefined, padrao: number[]) =>
    v ? v.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n)) : padrao;
  return {
    clientId: env.BLING_CLIENT_ID, clientSecret: env.BLING_CLIENT_SECRET,
    situacoesImportar: lista(env.BLING_SITUACOES_IMPORTAR, [6]), situacoesCancelado: lista(env.BLING_SITUACOES_CANCELADO, [12]),
  };
}

const dataCivil = (v: unknown): Date | undefined => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v) || v.startsWith('0000')) return undefined;
  const d = new Date(v.slice(0, 10) + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/** Traduz um pedido de venda do Bling (API v3) para o formato do produzapp. */
export function normalizarPedidoBling(b: any, cfg: Pick<ConfigBling, 'situacoesCancelado'>, codigos: Map<string, string> = new Map()): PedidoRecebido {
  const itens: ItemPedido[] = (b.itens ?? []).map((i: any): ItemPedido => {
    const produtoId = i.produto?.id ? String(i.produto.id) : undefined;
    const codigo = (typeof i.codigo === 'string' && i.codigo.trim()) || (produtoId && codigos.get(produtoId)) || undefined;
    return {
      idExterno: String(i.id), ...(produtoId ? { produtoIdExterno: produtoId } : {}), ...(codigo ? { codigo } : {}),
      descricao: String(i.descricao ?? ''), quantidade: Number(i.quantidade) || 0,
    };
  });
  const situacaoId = b.situacao?.id;
  return {
    origem: 'bling', idExterno: String(b.id), numero: String(b.numero), cliente: String(b.contato?.nome ?? 'Cliente não informado'),
    ...(b.contato?.numeroDocumento ? { documentoCliente: String(b.contato.numeroDocumento) } : {}),
    ...(dataCivil(b.data) ? { dataPedido: dataCivil(b.data) } : {}),
    ...(dataCivil(b.dataPrevista) ? { previsaoExterna: dataCivil(b.dataPrevista) } : {}),
    ...(situacaoId !== undefined ? { situacaoExterna: String(situacaoId) } : {}),
    ...(typeof b.total === 'number' ? { total: b.total } : {}),
    itens, cancelado: cfg.situacoesCancelado.includes(Number(situacaoId)),
  };
}

export class ErroBling extends Error {
  constructor(readonly status: number, mensagem: string) { super(mensagem); }
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class FonteBling implements FontePedidos {
  readonly origem = 'bling';
  private readonly f: typeof fetch;
  private readonly agora: () => Date;
  private ultimaChamada = 0;
  private readonly codigosProduto = new Map<string, string>();
  private renovando?: Promise<TokenIntegracao>;

  constructor(private readonly repo: Repositorio, private readonly cfg: ConfigBling) {
    this.f = cfg.fetch ?? fetch;
    this.agora = cfg.agora ?? (() => new Date());
  }

  // ---- OAuth ----
  private async pedirToken(corpo: Record<string, string>): Promise<TokenIntegracao> {
    const basic = Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString('base64');
    const r = await this.f(TOKEN_URL, {
      method: 'POST', headers: { Authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded', accept: '1.0' },
      body: new URLSearchParams(corpo).toString(),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token || !j.refresh_token) {
      throw new ErroBling(r.status, `Bling recusou o token (${r.status}). Refaça a autorização: npm run bling:autorizar.`);
    }
    const token: TokenIntegracao = {
      nome: NOME_TOKEN, accessToken: j.access_token, refreshToken: j.refresh_token,
      expiraEm: new Date(this.agora().getTime() + (Number(j.expires_in) || 21600) * 1000),
    };
    await this.repo.gravarToken(token); // o refresh token muda a cada uso: o novo precisa ser gravado
    return token;
  }

  /** Troca o código de autorização (uma vez) pelo primeiro par de tokens. */
  autorizar(codigo: string) { return this.pedirToken({ grant_type: 'authorization_code', code: codigo }); }

  private async token(): Promise<string> {
    const t = await this.repo.lerToken(NOME_TOKEN);
    if (!t) throw new ErroBling(401, 'Bling ainda não foi autorizado. Rode: npm run bling:autorizar.');
    if (t.expiraEm.getTime() - this.agora().getTime() > 60_000) return t.accessToken;
    // uma renovação por vez: dois refresh simultâneos invalidariam um ao outro
    this.renovando ??= this.pedirToken({ grant_type: 'refresh_token', refresh_token: t.refreshToken }).finally(() => { this.renovando = undefined; });
    return (await this.renovando).accessToken;
  }

  // ---- chamadas ----
  private async get(caminho: string, tentativa = 0): Promise<any> {
    const espera = this.cfg.esperaMs ?? 400;
    const falta = this.ultimaChamada + espera - Date.now();
    if (falta > 0) await dormir(falta);
    this.ultimaChamada = Date.now();
    const r = await this.f(API + caminho, { headers: { Authorization: `Bearer ${await this.token()}`, accept: 'application/json' } });
    if (r.status === 429 && tentativa < 3) { await dormir(1500 * (tentativa + 1)); return this.get(caminho, tentativa + 1); }
    if (r.status === 404) return undefined;
    if (!r.ok) throw new ErroBling(r.status, `Bling respondeu ${r.status} em ${caminho.split('?')[0]}.`);
    return r.json();
  }

  private async codigoDoProduto(id: string): Promise<string | undefined> {
    if (this.codigosProduto.has(id)) return this.codigosProduto.get(id);
    const p = await this.get(`/produtos/${id}`);
    const codigo = typeof p?.data?.codigo === 'string' ? p.data.codigo.trim() : '';
    if (codigo) this.codigosProduto.set(id, codigo);
    return codigo || undefined;
  }

  private async detalhar(id: string): Promise<PedidoRecebido | undefined> {
    const j = await this.get(`/pedidos/vendas/${id}`);
    if (!j?.data) return undefined;
    // Cadastro novo traz o código no item; pedidos antigos (item sem código) consultam o produto, uma vez por produto.
    for (const i of j.data.itens ?? []) {
      if (!(typeof i.codigo === 'string' && i.codigo.trim()) && i.produto?.id) await this.codigoDoProduto(String(i.produto.id));
    }
    return normalizarPedidoBling(j.data, this.cfg, this.codigosProduto);
  }

  obter(idExterno: string) { return this.detalhar(idExterno); }

  async listarAlterados(desde: Date, jaConhecido: (id: string) => Promise<boolean>): Promise<PedidoRecebido[]> {
    const situacoes = [...new Set([...this.cfg.situacoesImportar, ...this.cfg.situacoesCancelado])];
    const inicio = desde.toISOString().slice(0, 19).replace('T', ' ');
    const saida: PedidoRecebido[] = [];
    for (let pagina = 1; pagina <= 50; pagina++) {
      const q = new URLSearchParams({ pagina: String(pagina), limite: '100', dataAlteracaoInicial: inicio });
      situacoes.forEach((s) => q.append('idsSituacoes[]', String(s)));
      const j = await this.get(`/pedidos/vendas?${q}`);
      const lista: any[] = j?.data ?? [];
      for (const p of lista) {
        const id = String(p.id);
        const cancelado = this.cfg.situacoesCancelado.includes(Number(p.situacao?.id));
        if (cancelado && !(await jaConhecido(id))) continue;
        const d = await this.detalhar(id);
        if (d) saida.push(d);
      }
      if (lista.length < 100) break;
    }
    return saida;
  }
}
