/* produzapp · utilitários compartilhados pelas telas (estação, painel, OPs) */
(function () {
  const CHAVE = 'produzapp.chave';
  const BASE = 'produzapp.base';
  const guardar = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  const ler = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };

  const ETAPAS = [
    ['COR', 'Corte'], ['PES', 'Pesponto'], ['EST', 'Esteira de Montagem'], ['INJ', 'Injetora'],
    ['ACA', 'Esteira de Acabamento'], ['EMB', 'Embalagem'], ['EXP', 'Expedição'],
  ].map(([sig, nome]) => ({ sig, nome }));

  // A API fica na raiz (servidor próprio/VPS) ou em /api (Vercel). Descobre uma vez e lembra neste navegador.
  let baseCache = null;
  async function descobrirBase() {
    if (baseCache !== null) return baseCache;
    let salva = null;
    try { salva = localStorage.getItem(BASE); } catch (e) {}
    if (salva !== null) return (baseCache = salva);
    for (const b of ['', '/api']) {
      try {
        const r = await fetch(b + '/saude', { cache: 'no-store' });
        if (r.ok && (await r.json()).ok) { guardar(BASE, b); return (baseCache = b); }
      } catch (e) {}
    }
    return ''; // sem rede agora: tenta de novo na próxima chamada
  }

  class ErroRede extends Error { constructor(m) { super(m); this.rede = true; } }
  class ErroApi extends Error { constructor(status, m) { super(m); this.status = status; } }

  /** Chama a API. Lança ErroRede (sem conexão/timeout) ou ErroApi (resposta de erro). */
  async function api(caminho, { method = 'GET', body, timeout = 6000 } = {}) {
    const base = await descobrirBase();
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    let r;
    try {
      r = await fetch(base + caminho, {
        method, signal: ctl.signal,
        headers: { 'x-api-key': ler(CHAVE), ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) { throw new ErroRede('Sem conexão com o servidor.'); }
    finally { clearTimeout(t); }
    if (r.status === 401) { guardar(CHAVE, null); throw new ErroApi(401, 'Chave de acesso recusada.'); }
    let json = null;
    try { json = await r.json(); } catch (e) {}
    if (r.status >= 500) throw new ErroRede((json && json.erro) || 'Servidor indisponível.');
    if (!r.ok) throw new ErroApi(r.status, (json && json.erro) || 'Erro ' + r.status);
    return json;
  }

  /** Pede a chave de acesso uma única vez e guarda neste navegador. Nunca vai no código. */
  function garantirChave() {
    return new Promise((resolve) => {
      if (ler(CHAVE)) return resolve(ler(CHAVE));
      const bg = document.createElement('div');
      bg.className = 'chave-bg';
      bg.innerHTML = `<form class="chave-box"><h2>Chave de acesso</h2>
        <p>Digite a chave desta estação (peça ao responsável). Ela fica guardada só neste navegador.</p>
        <input type="password" autocomplete="off" placeholder="chave" required><button>Entrar</button></form>`;
      document.body.appendChild(bg);
      const inp = bg.querySelector('input');
      inp.focus();
      bg.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        guardar(CHAVE, inp.value.trim()); bg.remove(); resolve(inp.value.trim());
      });
    });
  }
  const trocarChave = () => { guardar(CHAVE, null); location.reload(); };

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

  // Datas de calendário (previsão/entrada) vêm como meia-noite UTC: mostrar sempre em UTC para não "voltar um dia".
  const fmtData = (iso) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  const fmtHora = (iso) => { const d = new Date(iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  const nf = (n) => Number(n).toLocaleString('pt-BR');
  const d1 = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.Prado = { ETAPAS, api, garantirChave, trocarChave, uuid, fmtData, fmtHora, nf, d1, esc, ErroRede, ErroApi, ler, guardar };
})();
