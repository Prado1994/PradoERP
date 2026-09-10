/* Peças compartilhadas entre a tela de escritório (app.js) e a de campo (celular.js). */

const Crono = (() => {
  const $ = (id) => document.getElementById(id);

  const fmt = (v, d = 2) => (v ?? 0).toLocaleString('pt-BR',
    { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmt0 = (v) => Math.round(v ?? 0).toLocaleString('pt-BR');
  const seg = (s) => {
    s = s || 0;
    if (s < 60) return fmt(s, 2) + 's';
    const m = Math.floor(s / 60);
    return `${m}min ${fmt(s - m * 60, 0)}s`;
  };
  const relogio = (s) => {
    s = Math.max(0, s || 0);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  async function api(rota, opcoes = {}) {
    const cfg = { ...opcoes };
    if (!(cfg.body instanceof FormData)) {
      cfg.headers = { 'Content-Type': 'application/json', ...(cfg.headers || {}) };
    }
    const r = await fetch(rota, cfg);
    if (!r.ok) {
      let msg = r.statusText;
      try { msg = (await r.json()).detail || msg; } catch (e) { /* corpo vazio */ }
      throw new Error(msg);
    }
    return r.status === 204 ? null : r.json();
  }

  const CORES = { elemento: '#FEC761', ancora: '#CCC1A9', contador: '#9F5234' };

  /* Área ocupada pela imagem dentro do canvas (object-fit: contain). É o que
     permite marcar a mesma ROI no celular em pé e no monitor deitado. */
  function areaImagem(canvas, midia) {
    let ar = 4 / 3;
    if (midia) {
      if (midia.videoWidth) ar = midia.videoWidth / midia.videoHeight;
      else if (midia.naturalWidth) ar = midia.naturalWidth / midia.naturalHeight;
    }
    const arCaixa = canvas.width / canvas.height;
    if (ar > arCaixa) {
      const h = canvas.width / ar;
      return { x: 0, y: (canvas.height - h) / 2, w: canvas.width, h };
    }
    const w = canvas.height * ar;
    return { x: (canvas.width - w) / 2, y: 0, w, h: canvas.height };
  }

  function desenharPoligonos(ctx, area, rois, emEdicao = []) {
    const px = (p) => [area.x + p[0] * area.w, area.y + p[1] * area.h];
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = '12px DM Sans, sans-serif';

    rois.forEach((roi) => {
      if (!roi.pontos || roi.pontos.length < 3) return;
      ctx.beginPath();
      roi.pontos.forEach((p, i) => {
        const [x, y] = px(p);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.closePath();
      const cor = CORES[roi.modo] || CORES.elemento;
      ctx.strokeStyle = cor;
      ctx.lineWidth = roi.ativo ? 4 : 2;
      ctx.fillStyle = cor + (roi.ativo ? '55' : '22');
      ctx.fill(); ctx.stroke();
      const [x, y] = px(roi.pontos[0]);
      ctx.fillStyle = '#1C2632';
      ctx.fillRect(x, y - 18, ctx.measureText(roi.nome).width + 16, 18);
      ctx.fillStyle = '#FFFCF4';
      ctx.fillText(roi.nome, x + 6, y - 5);
    });

    if (emEdicao.length) {
      ctx.beginPath();
      emEdicao.forEach((p, i) => {
        const [x, y] = px(p);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.strokeStyle = '#9F5234'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.stroke(); ctx.setLineDash([]);
      emEdicao.forEach((p) => {
        const [x, y] = px(p);
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#9F5234'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      });
    }
  }

  /* Converte o toque na tela em coordenada normalizada da imagem (0..1). */
  function pontoNormalizado(ev, canvas, midia) {
    const r = canvas.getBoundingClientRect();
    const a = areaImagem(canvas, midia);
    const x = (ev.clientX - r.left - a.x) / a.w;
    const y = (ev.clientY - r.top - a.y) / a.h;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return [+x.toFixed(4), +y.toFixed(4)];
  }

  return { $, fmt, fmt0, seg, relogio, api, CORES, areaImagem, desenharPoligonos,
    pontoNormalizado };
})();
