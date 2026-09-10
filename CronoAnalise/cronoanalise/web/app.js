/* Cronoanálise Prado — interface de captura e análise.
   Mobile-first: funciona com a câmera do celular na mão do analista,
   ou apenas exibindo o preview de uma câmera de CFTV ligada no servidor. */

const App = (() => {
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

  const estado = {
    estudos: [], estudo: null, rois: [], pontos: [],
    stream: null, facing: 'environment',
    wsFrames: null, wsEventos: null, envio: null, poll: null,
    capturando: false, ultimo: null,
  };

  // ------------------------------------------------------------- API
  async function api(rota, opcoes = {}) {
    const r = await fetch(rota, {
      headers: { 'Content-Type': 'application/json' }, ...opcoes,
    });
    if (!r.ok) {
      let msg = r.statusText;
      try { msg = (await r.json()).detail || msg; } catch (e) { /* corpo vazio */ }
      throw new Error(msg);
    }
    return r.status === 204 ? null : r.json();
  }

  function aviso(texto, erro = false) {
    $('captura-aviso').innerHTML = texto
      ? `<div class="aviso ${erro ? 'erro' : ''}">${texto}</div>` : '';
  }

  // --------------------------------------------------------- navegação
  function irPara(tela) {
    document.querySelectorAll('.tela').forEach((t) => t.classList.remove('ativa'));
    $('tela-' + tela).classList.add('ativa');
    document.querySelectorAll('nav.rodape button').forEach((b) =>
      b.classList.toggle('ativo', b.dataset.tela === tela));
    window.scrollTo(0, 0);
    if (tela === 'estudos') carregarEstudos();
  }

  // ---------------------------------------------------------- estudos
  async function carregarEstudos() {
    estado.estudos = await api('/api/estudos');
    const alvo = $('lista-estudos');
    if (!estado.estudos.length) {
      alvo.innerHTML = '<div class="vazio-lista">Nenhum estudo ainda. Crie o primeiro.</div>';
      return;
    }
    alvo.innerHTML = estado.estudos.map((e) => `
      <div class="item ${e.capturando ? 'ativo' : ''}">
        <div class="info">
          <div class="nome">${e.nome}</div>
          <div class="meta">${e.unidade} · ${e.setor || 'setor não informado'} ·
            ${e.rois.length} região(ões) · ${e.medicoes} medição(ões)
            ${e.capturando ? '· <b style="color:var(--terra)">capturando</b>' : ''}</div>
        </div>
        <button class="claro" onclick="App.editar('${e.id}')">Editar</button>
        <button class="terra" onclick="App.abrir('${e.id}')">Abrir</button>
      </div>`).join('');
  }

  function novoEstudo() {
    estado.estudo = null;
    $('config-titulo').textContent = 'Novo estudo';
    ['f-nome', 'f-produto', 'f-posto', 'f-operador', 'f-analista'].forEach((i) => ($(i).value = ''));
    $('f-fr').value = '1.00'; $('f-ft').value = '0.15'; $('f-jornada').value = '528';
    $('f-meta').value = '550'; $('f-demanda').value = '550'; $('f-pecas').value = '1';
    $('f-postos').value = '1';
    irPara('config');
  }

  async function editar(id) {
    const e = await api('/api/estudos/' + id);
    estado.estudo = e;
    $('config-titulo').textContent = 'Editar estudo';
    $('f-nome').value = e.nome; $('f-unidade').value = e.unidade;
    $('f-setor').value = e.setor || 'Pesponto'; $('f-produto').value = e.produto;
    $('f-posto').value = e.posto; $('f-operador').value = e.operador;
    $('f-analista').value = e.analista;
    const p = e.parametros;
    $('f-fr').value = p.fator_ritmo; $('f-ft').value = p.fator_tolerancia;
    $('f-jornada').value = p.jornada_min; $('f-meta').value = p.meta_dia;
    $('f-demanda').value = p.demanda_dia; $('f-pecas').value = p.pecas_por_ciclo;
    $('f-postos').value = p.postos; $('f-erro').value = p.erro_relativo;
    irPara('config');
  }

  async function salvarEstudo() {
    const corpo = {
      nome: $('f-nome').value.trim() || 'Estudo sem nome',
      unidade: $('f-unidade').value, setor: $('f-setor').value,
      produto: $('f-produto').value.trim(), posto: $('f-posto').value.trim(),
      operador: $('f-operador').value.trim(), analista: $('f-analista').value.trim(),
      parametros: {
        fator_ritmo: +$('f-fr').value, fator_tolerancia: +$('f-ft').value,
        jornada_min: +$('f-jornada').value, meta_dia: +$('f-meta').value,
        demanda_dia: +$('f-demanda').value, pecas_por_ciclo: +$('f-pecas').value,
        postos: +$('f-postos').value, erro_relativo: +$('f-erro').value,
      },
    };
    let e;
    if (estado.estudo) {
      e = await api('/api/estudos/' + estado.estudo.id,
        { method: 'PUT', body: JSON.stringify(corpo) });
    } else {
      e = await api('/api/estudos', { method: 'POST', body: JSON.stringify(corpo) });
    }
    await abrir(e.id);
  }

  async function abrir(id) {
    const e = await api('/api/estudos/' + id);
    estado.estudo = e;
    estado.rois = e.rois || [];
    estado.pontos = [];
    $('topo-estudo').textContent = e.nome;
    $('captura-titulo').textContent = e.nome;
    $('captura-sub').textContent =
      `${e.unidade} · ${e.setor || '—'} · ${e.produto || 'produto não informado'}`;
    $('f-fonte').value = e.fonte && e.fonte !== 'navegador'
      ? (e.fonte.startsWith('webcam') ? 'webcam'
        : e.fonte.startsWith('arquivo') ? 'arquivo' : 'rtsp')
      : 'navegador';
    mudouFonte();
    if (e.fonte && e.fonte !== 'navegador') {
      $('f-endereco').value = e.fonte.replace(/^(webcam:|arquivo:)/, '');
    }
    desenharROIs();
    listarROIs();
    montarBotoesManuais();
    if (e.medicoes && e.medicoes.length) mostrarMedicao(e.medicoes[0].id);
    irPara('captura');
  }

  // ----------------------------------------------------------- câmera
  function mudouFonte() {
    const f = $('f-fonte').value;
    const precisa = f !== 'navegador';
    $('campo-endereco').hidden = !precisa;
    $('btn-camera').hidden = precisa;
    $('btn-trocar').hidden = precisa || !estado.stream;
    const rot = { rtsp: 'Endereço RTSP/HTTP da câmera', webcam: 'Índice da webcam (0, 1, 2…)',
      arquivo: 'Caminho do vídeo no servidor' }[f];
    if (rot) $('rot-endereco').textContent = rot;
    const ph = { rtsp: 'rtsp://usuario:senha@192.168.0.50:554/stream1',
      webcam: '0', arquivo: '/home/prado/videos/pesponto.mp4' }[f];
    if (ph) $('f-endereco').placeholder = ph;
  }

  function fonteEscolhida() {
    const f = $('f-fonte').value;
    const v = $('f-endereco').value.trim();
    if (f === 'navegador') return 'navegador';
    if (f === 'webcam') return 'webcam:' + (v || '0');
    if (f === 'arquivo') return 'arquivo:' + v;
    return v;
  }

  async function abrirCamera() {
    try {
      pararStream();
      estado.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: estado.facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const v = $('video');
      v.srcObject = estado.stream;
      v.hidden = false;
      $('preview').hidden = true;
      $('palco-vazio').hidden = true;
      $('btn-trocar').hidden = false;
      await v.play();
      ajustarCanvas();
      aviso('');
    } catch (e) {
      aviso(`Não consegui abrir a câmera: ${e.message}. ` +
        'Em celular, a câmera só funciona em <b>https</b> ou em <b>localhost</b> — ' +
        'veja a seção "Acesso pelo celular" no README.', true);
    }
  }

  function trocarCamera() {
    estado.facing = estado.facing === 'environment' ? 'user' : 'environment';
    abrirCamera();
  }

  function pararStream() {
    if (estado.stream) {
      estado.stream.getTracks().forEach((t) => t.stop());
      estado.stream = null;
    }
  }

  // -------------------------------------------------------- ROIs (UI)
  function ajustarCanvas() {
    const c = $('desenho');
    const r = $('palco').getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    desenharROIs();
  }

  /* Área realmente ocupada pela imagem dentro do palco (object-fit: contain). */
  function areaImagem() {
    const c = $('desenho');
    const v = $('video');
    const img = $('preview');
    let ar = 4 / 3;
    if (!v.hidden && v.videoWidth) ar = v.videoWidth / v.videoHeight;
    else if (!img.hidden && img.naturalWidth) ar = img.naturalWidth / img.naturalHeight;
    const arCaixa = c.width / c.height;
    if (ar > arCaixa) {
      const h = c.width / ar;
      return { x: 0, y: (c.height - h) / 2, w: c.width, h };
    }
    const w = c.height * ar;
    return { x: (c.width - w) / 2, y: 0, w, h: c.height };
  }

  const CORES = { elemento: '#FEC761', ancora: '#CCC1A9', contador: '#9F5234' };

  function desenharROIs() {
    const c = $('desenho');
    const ctx = c.getContext('2d');
    const a = areaImagem();
    ctx.clearRect(0, 0, c.width, c.height);
    const px = (p) => [a.x + p[0] * a.w, a.y + p[1] * a.h];

    estado.rois.forEach((roi) => {
      if (roi.pontos.length < 3) return;
      ctx.beginPath();
      roi.pontos.forEach((p, i) => {
        const [x, y] = px(p);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = CORES[roi.modo] || '#FEC761';
      ctx.lineWidth = roi.ativo ? 4 : 2;
      ctx.fillStyle = (CORES[roi.modo] || '#FEC761') + (roi.ativo ? '55' : '22');
      ctx.fill(); ctx.stroke();
      const [x, y] = px(roi.pontos[0]);
      ctx.fillStyle = '#1C2632';
      ctx.fillRect(x, y - 18, ctx.measureText(roi.nome).width + 16, 18);
      ctx.fillStyle = '#FFFCF4';
      ctx.font = '12px DM Sans, sans-serif';
      ctx.fillText(roi.nome, x + 6, y - 5);
    });

    if (estado.pontos.length) {
      ctx.beginPath();
      estado.pontos.forEach((p, i) => {
        const [x, y] = px(p);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.strokeStyle = '#9F5234'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.stroke(); ctx.setLineDash([]);
      estado.pontos.forEach((p) => {
        const [x, y] = px(p);
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#9F5234'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      });
    }
  }

  function aoTocar(ev) {
    ev.preventDefault();
    const c = $('desenho');
    const r = c.getBoundingClientRect();
    const a = areaImagem();
    const x = (ev.clientX - r.left - a.x) / a.w;
    const y = (ev.clientY - r.top - a.y) / a.h;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    estado.pontos.push([+x.toFixed(4), +y.toFixed(4)]);
    desenharROIs();
  }

  function desfazerPonto() {
    estado.pontos.pop();
    desenharROIs();
  }

  async function salvarROI() {
    if (estado.pontos.length < 3) {
      aviso('Marque pelo menos 3 pontos na imagem para fechar a região.', true);
      return;
    }
    const nome = $('f-roi-nome').value.trim();
    if (!nome) { aviso('Dê um nome para a região.', true); return; }
    const on = +$('f-roi-sens').value;
    estado.rois.push({
      nome, pontos: estado.pontos.slice(), modo: $('f-roi-modo').value,
      deteccao: $('f-roi-deteccao').value, limiar_on: on, limiar_off: on / 2,
      min_on_s: 0.35, min_off_s: 0.35, ordem: estado.rois.length,
    });
    estado.pontos = [];
    $('f-roi-nome').value = '';
    aviso('');
    await persistirROIs();
  }

  async function persistirROIs() {
    if (!estado.estudo) return;
    await api(`/api/estudos/${estado.estudo.id}/rois`,
      { method: 'PUT', body: JSON.stringify(estado.rois) });
    desenharROIs(); listarROIs(); montarBotoesManuais();
  }

  async function removerROI(i) {
    estado.rois.splice(i, 1);
    await persistirROIs();
  }

  function listarROIs() {
    const alvo = $('lista-rois');
    if (!estado.rois.length) {
      alvo.innerHTML = '<div class="vazio-lista">Nenhuma região marcada. ' +
        'Sem região, você ainda pode medir pelo cronômetro manual.</div>';
      return;
    }
    const rot = { elemento: 'Elemento', ancora: 'Âncora', contador: 'Contador' };
    alvo.innerHTML = estado.rois.map((r, i) => `
      <div class="item ${r.ativo ? 'ativo' : ''}">
        <div class="info">
          <div class="nome">${r.nome}</div>
          <div class="meta">${rot[r.modo]} · ${r.deteccao} ·
            liga em ${(r.limiar_on * 100).toFixed(0)}%
            ${r.valor !== undefined ? `· agora ${(r.valor * 100).toFixed(0)}%` : ''}</div>
        </div>
        <button class="claro" onclick="App.removerROI(${i})">Remover</button>
      </div>`).join('');
  }

  function montarBotoesManuais() {
    const nomes = estado.rois.filter((r) => r.modo !== 'contador').map((r) => r.nome);
    const lista = nomes.length ? nomes : ['Elemento 1', 'Elemento 2', 'Elemento 3'];
    $('botoes-manual').innerHTML = lista.map((n) =>
      `<button class="claro" onclick="App.marcar('${n.replace(/'/g, "\\'")}')">${n}</button>`).join('');
  }

  // ---------------------------------------------------------- captura
  async function iniciar() {
    if (!estado.estudo) { aviso('Abra um estudo antes de iniciar.', true); return; }
    const fonte = fonteEscolhida();
    if (fonte !== 'navegador' && !$('f-endereco').value.trim()) {
      aviso('Informe o endereço da câmera ou o caminho do vídeo.', true); return;
    }
    try {
      const r = await api(`/api/estudos/${estado.estudo.id}/iniciar`, {
        method: 'POST',
        body: JSON.stringify({ fonte, detector: $('f-detector').value }),
      });
      estado.capturando = true;
      $('btn-iniciar').disabled = true;
      $('btn-parar').disabled = false;
      $('btn-fundo').disabled = false;
      $('cronometro-manual').hidden = false;
      $('log').innerHTML = '';
      aviso('');
      if (r.modo_navegador) {
        if (!estado.stream) await abrirCamera();
        conectarFrames();
      } else {
        $('video').hidden = true;
        $('palco-vazio').hidden = true;
        const img = $('preview');
        img.src = `/api/estudos/${estado.estudo.id}/preview.mjpg?t=${Date.now()}`;
        img.hidden = false;
        img.onload = ajustarCanvas;
      }
      conectarEventos();
      estado.poll = setInterval(atualizarKpis, 3000);
    } catch (e) {
      aviso('Não consegui iniciar: ' + e.message, true);
    }
  }

  function conectarFrames() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/estudos/${estado.estudo.id}/frames`);
    ws.binaryType = 'arraybuffer';
    estado.wsFrames = ws;
    const lona = document.createElement('canvas');
    const ctx = lona.getContext('2d');

    ws.onopen = () => {
      // ~8 quadros/s a 640 px: preciso o bastante para cronoanálise e leve na rede
      estado.envio = setInterval(() => {
        const v = $('video');
        if (!v.videoWidth || ws.readyState !== 1 || ws.bufferedAmount > 400000) return;
        const esc = 640 / v.videoWidth;
        lona.width = 640; lona.height = Math.round(v.videoHeight * esc);
        ctx.drawImage(v, 0, 0, lona.width, lona.height);
        lona.toBlob((b) => {
          if (b && ws.readyState === 1) b.arrayBuffer().then((ab) => ws.send(ab));
        }, 'image/jpeg', 0.6);
      }, 125);
    };
    ws.onmessage = (ev) => aplicarEstado(JSON.parse(ev.data));
    ws.onclose = () => clearInterval(estado.envio);
  }

  function aplicarEstado(st) {
    const g = st.gatilhos || {};
    estado.rois.forEach((r) => {
      const info = g[r.nome];
      if (info) { r.ativo = info.ativo; r.valor = info.valor; }
    });
    desenharROIs();
    $('hud').hidden = false;
    $('hud').innerHTML = `<b>${seg(st.duracao_s)}</b> · ciclos: <b>${st.ciclos_completos}</b>`;
  }

  function conectarEventos() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/estudos/${estado.estudo.id}/eventos`);
    estado.wsEventos = ws;
    ws.onmessage = (ev) => registrarEvento(JSON.parse(ev.data));
  }

  function registrarEvento(e) {
    const log = $('log');
    const t = `[${seg(e.t)}]`;
    let linha = '', classe = '';
    if (e.tipo === 'ciclo') {
      classe = 'ciclo';
      linha = `${t} CICLO ${e.numero} fechado — ${fmt(e.duracao)}s (${e.leituras} elementos)`;
    } else if (e.tipo === 'peca') {
      classe = 'peca';
      linha = `${t} peça contada em "${e.elemento}"`;
    } else if (e.tipo === 'elemento_fim') {
      linha = `${t} ${e.elemento}: ${fmt(e.duracao)}s${e.origem === 'manual' ? ' (manual)' : ''}`;
    } else if (e.tipo === 'elemento_inicio') {
      linha = `${t} ▸ ${e.elemento}`;
    } else if (e.tipo === 'captura_iniciada') {
      linha = `${t} captura iniciada — ${e.fonte}`;
    } else if (e.tipo === 'captura_encerrada') {
      linha = `${t} captura encerrada${e.erro ? ' — ERRO: ' + e.erro : ''}`;
      if (e.erro) aviso(e.erro, true);
    }
    if (!linha) return;
    const div = document.createElement('div');
    div.className = classe; div.textContent = linha;
    log.prepend(div);
    while (log.childElementCount > 200) log.lastElementChild.remove();
  }

  async function atualizarKpis() {
    if (!estado.estudo) return;
    try {
      const r = await api(`/api/estudos/${estado.estudo.id}/resumo`);
      estado.ultimo = r;
      const a = r.analise;
      $('kpis-vivo').innerHTML = `
        ${kpi('Ciclos válidos', fmt0(a.ciclos.n), `de ${a.ciclos.total_medidos} medidos`)}
        ${kpi('Tempo de ciclo', fmt(a.ciclos.media), 's · CV ' + fmt(a.ciclos.cv * 100, 1) + '%')}
        ${kpi('Ritmo atual', fmt0(a.producao.ritmo_hora), 'pares/hora')}
        ${kpi('Amostra', `${a.ciclos.n}/${a.ciclos.n_recomendado || '—'}`,
          a.ciclos.amostra_suficiente ? 'suficiente' : 'continue medindo',
          a.ciclos.amostra_suficiente ? 'bom' : '')}`;
    } catch (e) { /* captura pode ter encerrado */ }
  }

  const kpi = (rot, val, uni, cls = '', destaque = false) => `
    <div class="kpi ${destaque ? 'destaque' : ''}">
      <div class="rot">${rot}</div>
      <div class="val ${cls}">${val}</div>
      <div class="uni">${uni || ''}</div>
    </div>`;

  async function marcar(elemento, fecharCiclo = false) {
    if (!estado.capturando) { aviso('Inicie a captura antes de marcar.', true); return; }
    await api(`/api/estudos/${estado.estudo.id}/marcar`, {
      method: 'POST',
      body: JSON.stringify({ elemento, fechar_ciclo: fecharCiclo }),
    });
    if (navigator.vibrate) navigator.vibrate(30);
  }

  async function redefinirFundo() {
    await api(`/api/estudos/${estado.estudo.id}/fundo`, { method: 'POST' });
    aviso('Fundo reaprendido. Faça isso com o posto vazio, antes do operador começar.');
  }

  async function parar() {
    clearInterval(estado.envio); clearInterval(estado.poll);
    if (estado.wsFrames) estado.wsFrames.close();
    if (estado.wsEventos) estado.wsEventos.close();
    estado.capturando = false;
    $('btn-iniciar').disabled = false;
    $('btn-parar').disabled = true;
    $('btn-fundo').disabled = true;
    $('preview').hidden = true;
    const r = await api(`/api/estudos/${estado.estudo.id}/parar`, { method: 'POST' });
    renderResultado(r, r.medicao_id);
    irPara('resultado');
  }

  async function mostrarMedicao(id) {
    const m = await api('/api/medicoes/' + id);
    renderResultado(m, id);
  }

  // -------------------------------------------------------- resultado
  function renderResultado(r, medicaoId) {
    const a = r.analise;
    const e = r.estudo || estado.estudo || {};
    const p = a.producao;
    $('resultado-sub').textContent =
      `${e.nome || '—'} · ${e.unidade || ''} · ${e.produto || ''} · ` +
      `${fmt0(a.ciclos.n)} ciclos em ${seg(p.duracao_captura_s)}`;

    if (!a.ciclos.n) {
      $('resultado-conteudo').innerHTML =
        '<div class="aviso">Nenhum ciclo completo foi medido. Confira se a região ' +
        '<b>contador</b> ou a região <b>âncora</b> está pegando o movimento certo, ' +
        'ou use o cronômetro manual.</div>';
      return;
    }

    const t = a.tempos;
    const adere = p.aderencia_meta >= 1;
    const html = `
      <h3>Tempos</h3>
      <div class="kpis">
        ${kpi('Tempo médio (TM)', fmt(t.tempo_medio_s), 'segundos por ciclo')}
        ${kpi('Tempo normal (TN)', fmt(t.tempo_normal_s), `TM × FR ${fmt(e.parametros?.fator_ritmo ?? 1)}`)}
        ${kpi('Tempo padrão (TP)', fmt(t.tempo_padrao_s), `TN × (1 + FT ${fmt((e.parametros?.fator_tolerancia ?? 0) * 100, 0)}%)`, '', true)}
        ${kpi('Takt time', fmt(a.takt_time_s), a.atende_takt ? 's — o posto atende' : 's — o posto NÃO atende',
          a.atende_takt ? 'bom' : 'ruim')}
      </div>

      <h3>Capacidade e produtividade</h3>
      <div class="kpis">
        ${kpi('Capacidade/hora', fmt0(t.capacidade_hora), 'pares no tempo padrão')}
        ${kpi('Capacidade/dia', fmt0(t.capacidade_dia), `jornada de ${fmt0(e.parametros?.jornada_min ?? 0)} min`)}
        ${kpi('Projeção do dia', fmt0(p.projecao_dia), 'no ritmo observado', adere ? 'bom' : 'ruim')}
        ${kpi('Aderência à meta', fmt(p.aderencia_meta * 100, 0) + '%',
          `meta ${fmt0(p.meta_dia)} · ${p.gap_meta_dia >= 0 ? '+' : ''}${fmt0(p.gap_meta_dia)} pares`,
          adere ? 'bom' : 'ruim', true)}
      </div>

      <h3>Confiabilidade da amostra</h3>
      <div class="card ${a.ciclos.amostra_suficiente ? '' : 'amarelo'}">
        <p style="margin:0;font-size:13px">
          ${a.ciclos.n} ciclos válidos medidos · recomendado
          <b>${a.ciclos.n_recomendado || '—'}</b> ciclos para
          ${fmt((e.parametros?.erro_relativo ?? 0.05) * 100, 0)}% de erro a 95% de confiança.
          ${a.ciclos.descartados ? `<br>${a.ciclos.descartados} leitura(s) fora do padrão foram
          descartadas do cálculo (parada, retrabalho ou interferência).` : ''}
          <br>Desvio padrão ${fmt(a.ciclos.desvio)}s · variação
          ${fmt(a.ciclos.cv * 100, 1)}% · mín ${fmt(a.ciclos.min)}s · máx ${fmt(a.ciclos.max)}s.
          <b>${a.ciclos.amostra_suficiente ? 'Amostra suficiente.' : 'Continue medindo.'}</b>
        </p>
      </div>

      ${a.elementos.length ? `
      <h3>Elementos — onde está o tempo</h3>
      <div class="rolagem"><table>
        <tr><th>Elemento</th><th class="num">n</th><th class="num">TM (s)</th>
            <th class="num">TP (s)</th><th class="num">%</th><th>Participação</th></tr>
        ${a.elementos.map((el) => `
          <tr>
            <td>${el.elemento}${el.elemento === a.gargalo ?
              ' <span class="badge operacional">gargalo</span>' : ''}</td>
            <td class="num">${el.n}</td>
            <td class="num">${fmt(el.media)}</td>
            <td class="num">${fmt(el.tempo_padrao_s)}</td>
            <td class="num">${fmt(el.participacao * 100, 1)}%</td>
            <td><div class="barra"><i style="width:${Math.min(100, el.participacao * 100)}%"></i></div></td>
          </tr>`).join('')}
      </table></div>
      ${e.parametros?.postos > 1 ? `<p class="sub" style="margin-top:8px">
        Eficiência de balanceamento da linha: <b>${fmt(a.eficiencia_linha * 100, 1)}%</b>
        (${e.parametros.postos} postos, gargalo em "${a.gargalo}").</p>` : ''}` : ''}

      <h3>Ciclos medidos</h3>
      <div class="rolagem"><table>
        <tr><th class="num">#</th><th class="num">Início (s)</th>
            <th class="num">Duração (s)</th><th>Elementos</th></tr>
        ${(r.ciclos || []).map((c) => `
          <tr class="${c.valido ? '' : 'invalido'}">
            <td class="num">${c.numero}</td>
            <td class="num">${fmt(c.inicio, 1)}</td>
            <td class="num">${fmt(c.duracao)}</td>
            <td>${c.leituras.map((l) => `${l.elemento} ${fmt(l.duracao, 1)}s`).join(' · ') || '—'}</td>
          </tr>`).join('')}
      </table></div>

      <div class="linha-btn" style="margin-top:16px">
        <button class="terra" onclick="window.location='${medicaoId
          ? `/api/medicoes/${medicaoId}/export.csv`
          : `/api/estudos/${e.id}/export.csv`}'">Exportar CSV</button>
        <button class="claro" onclick="App.irPara('captura')">Nova captura</button>
      </div>`;
    $('resultado-conteudo').innerHTML = html;
  }

  // ------------------------------------------------------------ start
  window.addEventListener('load', () => {
    $('desenho').addEventListener('pointerdown', aoTocar);
    window.addEventListener('resize', ajustarCanvas);
    $('video').addEventListener('loadedmetadata', ajustarCanvas);
    ajustarCanvas();
    carregarEstudos();
  });

  return { irPara, novoEstudo, editar, salvarEstudo, abrir, mudouFonte, abrirCamera,
    trocarCamera, salvarROI, desfazerPonto, removerROI, iniciar, parar, marcar,
    redefinirFundo, mostrarMedicao };
})();
