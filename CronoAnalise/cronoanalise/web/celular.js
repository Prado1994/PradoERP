/* Módulo Celular — a tela que o analista usa em pé, no posto de trabalho.

   Três modos:
   • Ao vivo   — o celular envia os quadros e o servidor mede na hora.
   • Gravar    — o celular grava na taxa cheia da câmera e envia no fim.
                 É o mais preciso: o tempo sai do arquivo, não da rede.
   • Cronômetro— sem câmera nenhuma, só os botões. Funciona em qualquer aparelho. */

const Campo = (() => {
  const { $, fmt, fmt0, relogio, api, areaImagem, desenharPoligonos,
    pontoNormalizado } = Crono;

  const estado = {
    estudos: [], estudo: null, rois: [], pontos: [], desenhando: false,
    stream: null, faixa: null, facing: 'environment', lanternaLigada: false,
    modo: 'vivo', ativo: false, t0: 0, cronometro: null,
    ws: null, wsEventos: null, envio: null, reconectar: null, tentativas: 0,
    gravador: null, pedacos: [], marcacoes: [], elementoAberto: null,
    wakeLock: null, ciclos: 0, ultimoCiclo: null, seguro: window.isSecureContext,
  };

  // ------------------------------------------------------------- avisos
  function aviso(texto, tipo = '') {
    $('avisos').innerHTML = texto
      ? `<div class="campo-aviso ${tipo}">${texto}</div>` : '';
  }

  function sinal(texto, classe = '') {
    const s = $('sinal');
    s.textContent = texto;
    s.className = 'sinal ' + classe;
  }

  function log(texto, classe = '') {
    const div = document.createElement('div');
    div.className = classe;
    div.textContent = texto;
    $('log').prepend(div);
    while ($('log').childElementCount > 80) $('log').lastElementChild.remove();
  }

  // ------------------------------------------------------------ estudos
  async function carregar() {
    estado.estudos = await api('/api/estudos');
    $('sel-estudo').innerHTML = estado.estudos.length
      ? estado.estudos.map((e) => `<option value="${e.id}">${e.nome}</option>`).join('')
      : '<option value="">— nenhum estudo cadastrado —</option>';
    if (estado.estudos.length) await trocarEstudo();
    else aviso('Nenhum estudo cadastrado. Crie um na <a href="/">tela completa</a> ' +
      'e volte aqui.', 'erro');
  }

  async function trocarEstudo() {
    const id = $('sel-estudo').value;
    if (!id) return;
    estado.estudo = await api('/api/estudos/' + id);
    estado.rois = estado.estudo.rois || [];
    estado.pontos = [];
    montarElementos();
    desenhar();
  }

  function montarElementos() {
    const nomes = estado.rois.filter((r) => r.modo !== 'contador').map((r) => r.nome);
    const lista = nomes.length ? nomes : ['Elemento 1', 'Elemento 2'];
    $('botoes-elementos').innerHTML = lista.map((n) =>
      `<button data-el="${n}" onclick="Campo.marcar('${n.replace(/'/g, "\\'")}')">${n}</button>`
    ).join('');
  }

  // ------------------------------------------------------------- câmera
  async function ligarCamera() {
    if (!estado.seguro) {
      aviso('Este endereço não é seguro (HTTP), então o navegador bloqueia a câmera. ' +
        'Suba o servidor com <b>./run.sh --https</b> e abra pelo QR code, ' +
        'ou use o modo <b>Só cronômetro</b>.', 'erro');
      return;
    }
    try {
      pararCamera();
      estado.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: estado.facing, width: { ideal: 1280 },
          height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      const v = $('video');
      v.srcObject = estado.stream;
      await v.play();
      estado.faixa = estado.stream.getVideoTracks()[0];
      $('placa').hidden = true;
      $('bt-camera').textContent = 'Recomeçar câmera';
      ajustarCapacidades();
      ajustarCanvas();
      aviso('');
    } catch (e) {
      aviso(`Não consegui abrir a câmera: ${e.message}`, 'erro');
    }
  }

  /* Lanterna e zoom só existem em parte dos aparelhos — só mostra o que dá. */
  function ajustarCapacidades() {
    const cap = estado.faixa.getCapabilities ? estado.faixa.getCapabilities() : {};
    $('bt-lanterna').hidden = !cap.torch;
    if (cap.zoom) {
      const z = $('zoom');
      z.hidden = false;
      z.min = cap.zoom.min; z.max = cap.zoom.max;
      z.step = cap.zoom.step || 0.1;
      z.value = estado.faixa.getSettings().zoom || cap.zoom.min;
    } else {
      $('zoom').hidden = true;
    }
  }

  function virarCamera() {
    estado.facing = estado.facing === 'environment' ? 'user' : 'environment';
    ligarCamera();
  }

  async function lanterna() {
    if (!estado.faixa) return;
    estado.lanternaLigada = !estado.lanternaLigada;
    try {
      await estado.faixa.applyConstraints({ advanced: [{ torch: estado.lanternaLigada }] });
      $('bt-lanterna').classList.toggle('ligado', estado.lanternaLigada);
    } catch (e) {
      aviso('Este aparelho não deixa controlar a lanterna pelo navegador.');
    }
  }

  async function zoom(valor) {
    if (!estado.faixa) return;
    try { await estado.faixa.applyConstraints({ advanced: [{ zoom: +valor }] }); }
    catch (e) { /* aparelho sem zoom por software */ }
  }

  function pararCamera() {
    if (estado.stream) {
      estado.stream.getTracks().forEach((t) => t.stop());
      estado.stream = null; estado.faixa = null;
    }
  }

  // --------------------------------------------------------------- ROIs
  function ajustarCanvas() {
    const c = $('desenho');
    const r = $('palco').getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    desenhar();
  }

  function desenhar() {
    const c = $('desenho');
    desenharPoligonos(c.getContext('2d'), areaImagem(c, $('video')),
      estado.rois, estado.pontos);
  }

  function alternarDesenho() {
    estado.desenhando = !estado.desenhando;
    $('bt-roi').classList.toggle('ligado', estado.desenhando);
    if (estado.desenhando) {
      aviso('Toque nos cantos da região e depois em <b>Marcar região</b> de novo ' +
        'para dar o nome.');
    } else if (estado.pontos.length >= 3) {
      salvarROI();
    } else {
      estado.pontos = [];
      aviso('');
      desenhar();
    }
  }

  async function salvarROI() {
    const nome = (prompt('Nome da região (ex.: pespontar cabedal):') || '').trim();
    if (!nome) { estado.pontos = []; desenhar(); aviso(''); return; }
    const papel = (prompt(
      'Papel da região?\n\n' +
      'elemento — mede a duração desta etapa\n' +
      'ancora   — quando reinicia, começa um ciclo\n' +
      'contador — cada ativação é 1 peça pronta',
      'elemento') || 'elemento').trim().toLowerCase();
    const modo = ['elemento', 'ancora', 'contador'].includes(papel) ? papel : 'elemento';
    estado.rois.push({
      nome, pontos: estado.pontos.slice(), modo,
      deteccao: modo === 'contador' ? 'presenca' : 'movimento',
      limiar_on: 0.06, limiar_off: 0.03, min_on_s: 0.35, min_off_s: 0.35,
      ordem: estado.rois.length,
    });
    estado.pontos = [];
    await api(`/api/estudos/${estado.estudo.id}/rois`,
      { method: 'PUT', body: JSON.stringify(estado.rois) });
    montarElementos();
    desenhar();
    aviso('');
    log(`região "${nome}" (${modo}) salva`);
  }

  function aoTocar(ev) {
    if (!estado.desenhando) return;
    ev.preventDefault();
    const ponto = pontoNormalizado(ev, $('desenho'), $('video'));
    if (!ponto) return;
    estado.pontos.push(ponto);
    desenhar();
  }

  // --------------------------------------------------------------- modo
  function modo(m) {
    if (estado.ativo) { aviso('Pare a medição antes de trocar de modo.'); return; }
    estado.modo = m;
    ['vivo', 'gravar', 'manual'].forEach((x) =>
      $('aba-' + x).classList.toggle('ativo', x === m));
    $('painel-manual').hidden = false;
    $('resultado').innerHTML = '';
    const textos = {
      vivo: 'A medição acontece no servidor, em tempo real. Precisa de Wi-Fi estável.',
      gravar: 'O celular grava na taxa cheia da câmera e envia no fim. É o modo mais ' +
        'preciso e o único que funciona com Wi-Fi ruim — a rede só é usada no envio.',
      manual: 'Sem câmera: só os botões de elemento. Funciona em qualquer aparelho, ' +
        'mesmo sem HTTPS.',
    };
    aviso(textos[m]);
  }

  // ------------------------------------------------------------- medição
  async function alternar() {
    if (estado.ativo) await parar();
    else await iniciar();
  }

  async function iniciar() {
    if (!estado.estudo) { aviso('Escolha um estudo.', 'erro'); return; }
    if (estado.modo !== 'manual' && !estado.stream) {
      aviso('Ligue a câmera primeiro.', 'erro'); return;
    }
    if (estado.modo === 'gravar' && !estado.rois.length) {
      aviso('Marque ao menos uma região antes de gravar — é ela que o servidor vai ' +
        'analisar no vídeo.', 'erro');
      return;
    }

    estado.ativo = true;
    estado.t0 = performance.now();
    estado.ciclos = 0; estado.ultimoCiclo = null;
    estado.marcacoes = []; estado.elementoAberto = null;
    $('log').innerHTML = '';
    $('resultado').innerHTML = '';
    $('painel').hidden = false;
    $('bt-acao').textContent = 'Parar';
    $('bt-acao').className = 'parar';
    estado.cronometro = setInterval(atualizarHud, 200);
    await manterTelaAcesa();

    if (estado.modo === 'gravar') {
      iniciarGravacao();
      aviso('Gravando no aparelho. Ao parar, o vídeo é enviado e analisado.');
      return;
    }

    try {
      await api(`/api/estudos/${estado.estudo.id}/iniciar`,
        { method: 'POST', body: JSON.stringify({ fonte: 'navegador' }) });
    } catch (e) {
      estado.ativo = false;
      clearInterval(estado.cronometro);
      $('bt-acao').textContent = 'Iniciar';
      $('bt-acao').className = 'iniciar';
      aviso('Não consegui iniciar no servidor: ' + e.message, 'erro');
      return;
    }
    conectarEventos();
    if (estado.modo === 'vivo') conectarFrames();
    else sinal('cronômetro', 'ok');
    aviso('');
  }

  async function parar() {
    estado.ativo = false;
    clearInterval(estado.cronometro);
    clearInterval(estado.envio);
    clearTimeout(estado.reconectar);
    $('bt-acao').textContent = 'Iniciar';
    $('bt-acao').className = 'iniciar';
    soltarTela();

    if (estado.modo === 'gravar') {
      await pararGravacao();
      return;
    }
    if (estado.ws) { estado.ws.close(); estado.ws = null; }
    if (estado.wsEventos) { estado.wsEventos.close(); estado.wsEventos = null; }
    sinal('—');
    try {
      const r = await api(`/api/estudos/${estado.estudo.id}/parar`, { method: 'POST' });
      mostrarResultado(r.analise, r.medicao_id);
    } catch (e) {
      aviso('Erro ao encerrar: ' + e.message, 'erro');
    }
  }

  // ------------------------------------------------------ modo AO VIVO
  function conectarFrames() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/estudos/${estado.estudo.id}/frames`);
    ws.binaryType = 'arraybuffer';
    estado.ws = ws;
    const lona = document.createElement('canvas');
    const ctx = lona.getContext('2d');

    ws.onopen = () => {
      estado.tentativas = 0;
      sinal('ao vivo', 'ok');
      escoarMarcacoes();
      // ~8 quadros/s a 640 px: preciso o bastante e leve para o Wi-Fi do galpão
      estado.envio = setInterval(() => {
        const v = $('video');
        if (!v.videoWidth || ws.readyState !== 1) return;
        if (ws.bufferedAmount > 400000) { sinal('rede lenta', 'ruim'); return; }
        const esc = 640 / v.videoWidth;
        lona.width = 640; lona.height = Math.round(v.videoHeight * esc);
        ctx.drawImage(v, 0, 0, lona.width, lona.height);
        lona.toBlob((b) => {
          if (b && ws.readyState === 1) b.arrayBuffer().then((ab) => ws.send(ab));
        }, 'image/jpeg', 0.6);
      }, 125);
    };
    ws.onmessage = (ev) => {
      const st = JSON.parse(ev.data);
      const g = st.gatilhos || {};
      estado.rois.forEach((r) => {
        const info = g[r.nome];
        if (info) { r.ativo = info.ativo; r.valor = info.valor; }
      });
      desenhar();
      sinal('ao vivo', 'ok');
    };
    ws.onclose = () => {
      clearInterval(estado.envio);
      if (estado.ativo && estado.modo === 'vivo') tentarReconectar();
    };
    ws.onerror = () => sinal('sem conexão', 'ruim');
  }

  /* Wi-Fi de galpão cai. Reconecta sozinho, com espera crescente, sem perder
     a medição que já está rodando no servidor. */
  function tentarReconectar() {
    estado.tentativas += 1;
    const espera = Math.min(15000, 800 * 2 ** (estado.tentativas - 1));
    sinal(`reconectando (${estado.tentativas})`, 'ruim');
    log(`conexão caiu — nova tentativa em ${(espera / 1000).toFixed(1)}s`);
    estado.reconectar = setTimeout(() => {
      if (estado.ativo) conectarFrames();
    }, espera);
  }

  function conectarEventos() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/estudos/${estado.estudo.id}/eventos`);
    estado.wsEventos = ws;
    ws.onmessage = (ev) => registrarEvento(JSON.parse(ev.data));
    ws.onclose = () => {
      if (estado.ativo && estado.modo !== 'gravar') setTimeout(conectarEventos, 2000);
    };
  }

  function registrarEvento(e) {
    const t = `[${relogio(e.t)}]`;
    if (e.tipo === 'ciclo') {
      estado.ciclos = e.numero;
      estado.ultimoCiclo = e.duracao;
      log(`${t} CICLO ${e.numero} — ${fmt(e.duracao)}s`, 'ciclo');
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    } else if (e.tipo === 'peca') {
      log(`${t} peça contada`, 'peca');
    } else if (e.tipo === 'elemento_fim') {
      log(`${t} ${e.elemento}: ${fmt(e.duracao)}s`);
    } else if (e.tipo === 'elemento_inicio') {
      destacarElemento(e.elemento);
    } else if (e.tipo === 'captura_encerrada' && e.erro) {
      aviso(e.erro, 'erro');
    }
  }

  // ------------------------------------------------------ modo GRAVAR
  function tipoSuportado() {
    const opcoes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8',
      'video/webm', 'video/mp4'];
    return opcoes.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  }

  function iniciarGravacao() {
    const tipo = tipoSuportado();
    if (!tipo) {
      aviso('Este navegador não grava vídeo. Use o modo Ao vivo.', 'erro');
      estado.ativo = false;
      $('bt-acao').textContent = 'Iniciar';
      $('bt-acao').className = 'iniciar';
      return;
    }
    estado.pedacos = [];
    estado.gravador = new MediaRecorder(estado.stream,
      { mimeType: tipo, videoBitsPerSecond: 2500000 });
    estado.gravador.ondataavailable = (ev) => {
      if (ev.data && ev.data.size) estado.pedacos.push(ev.data);
    };
    estado.gravador.start(2000);   // fatia de 2 s: se o app cair, não perde tudo
    $('gravando').hidden = false;
    sinal('gravando', 'ok');
  }

  function pararGravacao() {
    return new Promise((resolve) => {
      $('gravando').hidden = true;
      if (!estado.gravador || estado.gravador.state === 'inactive') { resolve(); return; }
      estado.gravador.onstop = async () => {
        const tipo = estado.gravador.mimeType || 'video/webm';
        const blob = new Blob(estado.pedacos, { type: tipo });
        estado.pedacos = [];
        await enviarGravacao(blob, tipo);
        resolve();
      };
      estado.gravador.stop();
    });
  }

  function enviarGravacao(blob, tipo) {
    return new Promise((resolve) => {
      const mb = (blob.size / 1048576).toFixed(1);
      const ext = tipo.includes('mp4') ? 'mp4' : 'webm';
      $('painel-envio').hidden = false;
      $('texto-envio').innerHTML =
        `Enviando vídeo (${mb} MB)…<div class="progresso"><i id="barra" style="width:0%"></i></div>`;

      const form = new FormData();
      form.append('arquivo', blob, `celular_${Date.now()}.${ext}`);
      form.append('marcacoes', JSON.stringify(estado.marcacoes));

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/estudos/${estado.estudo.id}/gravacao`);
      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return;
        const pc = (ev.loaded / ev.total) * 100;
        const barra = $('barra');
        if (barra) barra.style.width = pc.toFixed(0) + '%';
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const r = JSON.parse(xhr.responseText);
          $('texto-envio').innerHTML = 'Vídeo enviado. Analisando no servidor…' +
            '<div class="progresso"><i id="barra" style="width:8%"></i></div>';
          acompanhar(r.job).then(resolve);
        } else {
          let detalhe = xhr.statusText;
          try { detalhe = JSON.parse(xhr.responseText).detail || detalhe; } catch (e) { /* */ }
          $('texto-envio').textContent = 'Falha no envio: ' + detalhe;
          $('painel-envio').firstElementChild.classList.add('erro');
          resolve();
        }
      };
      xhr.onerror = () => {
        $('texto-envio').innerHTML =
          'Falha no envio (rede). O vídeo continua no aparelho: ' +
          '<button onclick="Campo.reenviar()">tentar de novo</button>';
        estado.ultimoBlob = { blob, tipo };
        resolve();
      };
      estado.ultimoBlob = { blob, tipo };
      xhr.send(form);
    });
  }

  function reenviar() {
    if (estado.ultimoBlob) enviarGravacao(estado.ultimoBlob.blob, estado.ultimoBlob.tipo);
  }

  async function acompanhar(job) {
    for (let i = 0; i < 2400; i += 1) {     // até ~40 min de análise
      await new Promise((r) => setTimeout(r, 1000));
      let st;
      try { st = await api('/api/gravacoes/' + job); }
      catch (e) { continue; }
      const barra = $('barra');
      if (barra) barra.style.width = Math.min(96, 8 + st.ciclos * 4) + '%';
      $('texto-envio').firstChild && ($('texto-envio').childNodes[0].nodeValue =
        `Analisando… ${fmt(st.segundos, 0)}s de vídeo · ${st.ciclos} ciclos `);
      if (st.status === 'concluida') {
        $('painel-envio').hidden = true;
        mostrarResultado(st.analise, st.medicao_id);
        log(`análise concluída — ${st.analise.ciclos.n} ciclos`, 'ciclo');
        return;
      }
      if (st.status === 'erro') {
        $('texto-envio').textContent = 'Erro na análise: ' + st.erro;
        $('painel-envio').firstElementChild.classList.add('erro');
        return;
      }
    }
  }

  // ---------------------------------------------------- cronômetro manual
  async function marcar(elemento) {
    if (!estado.ativo) { aviso('Inicie a medição antes de marcar.', 'erro'); return; }
    if (navigator.vibrate) navigator.vibrate(30);
    destacarElemento(elemento);
    const t = (performance.now() - estado.t0) / 1000;
    estado.marcacoes.push({ elemento, t: +t.toFixed(3), fechar_ciclo: false });
    if (estado.modo === 'gravar') { log(`[${relogio(t)}] ▸ ${elemento}`); return; }
    await enviarMarcacao({ elemento, fechar_ciclo: false });
  }

  async function fimDeCiclo() {
    if (!estado.ativo) { aviso('Inicie a medição antes de marcar.', 'erro'); return; }
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    destacarElemento(null);
    const t = (performance.now() - estado.t0) / 1000;
    estado.marcacoes.push({ elemento: '', t: +t.toFixed(3), fechar_ciclo: true });
    if (estado.modo === 'gravar') { log(`[${relogio(t)}] fim de ciclo`, 'ciclo'); return; }
    await enviarMarcacao({ elemento: '', fechar_ciclo: true });
  }

  /* Se a rede falhar bem na hora do toque, a marcação não se perde:
     fica na fila e sobe assim que a conexão volta. */
  const fila = [];
  async function enviarMarcacao(corpo) {
    try {
      await api(`/api/estudos/${estado.estudo.id}/marcar`,
        { method: 'POST', body: JSON.stringify(corpo) });
    } catch (e) {
      fila.push(corpo);
      sinal(`${fila.length} marcação(ões) na fila`, 'ruim');
    }
  }

  async function escoarMarcacoes() {
    while (fila.length) {
      const corpo = fila.shift();
      try {
        await api(`/api/estudos/${estado.estudo.id}/marcar`,
          { method: 'POST', body: JSON.stringify(corpo) });
      } catch (e) { fila.unshift(corpo); return; }
    }
  }

  function destacarElemento(nome) {
    document.querySelectorAll('#botoes-elementos button').forEach((b) =>
      b.classList.toggle('ligado', b.dataset.el === nome));
    estado.elementoAberto = nome;
  }

  // ------------------------------------------------------------ tela/HUD
  async function manterTelaAcesa() {
    try {
      if ('wakeLock' in navigator) {
        estado.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) { /* aparelho sem suporte: o analista deixa a tela no máximo */ }
  }

  function soltarTela() {
    if (estado.wakeLock) { estado.wakeLock.release(); estado.wakeLock = null; }
  }

  function atualizarHud() {
    const t = (performance.now() - estado.t0) / 1000;
    $('hud-tempo').textContent = relogio(t);
    $('hud-ciclos').textContent = fmt0(estado.ciclos);
    $('hud-ultimo').textContent = estado.ultimoCiclo
      ? `último ${fmt(estado.ultimoCiclo)}s` : 'último —';
  }

  function mostrarResultado(a, medicaoId) {
    if (!a || !a.ciclos.n) {
      $('resultado').innerHTML =
        '<div class="campo-aviso">Nenhum ciclo completo foi medido. Confira a região ' +
        'contador/âncora ou use o cronômetro.</div>';
      return;
    }
    const p = a.producao;
    const kpi = (rot, val, uni) =>
      `<div class="kpi"><div class="rot">${rot}</div><div class="val">${val}</div>
       <div class="uni">${uni}</div></div>`;
    $('resultado').innerHTML = `
      <div class="kpis">
        ${kpi('Ciclos', fmt0(a.ciclos.n), `de ${a.ciclos.total_medidos} medidos`)}
        ${kpi('Tempo de ciclo', fmt(a.ciclos.media), 'segundos')}
        ${kpi('Tempo padrão', fmt(a.tempos.tempo_padrao_s), 'TP por peça')}
        ${kpi('Projeção', fmt0(p.projecao_dia), `pares/dia · meta ${fmt0(p.meta_dia)}`)}
      </div>
      ${medicaoId ? `<div class="linha-btn" style="margin-top:10px">
        <button onclick="window.location='/api/medicoes/${medicaoId}/export.csv'">
          Baixar CSV</button>
        <button onclick="window.location='/'">Ver detalhado</button></div>` : ''}`;
  }

  // -------------------------------------------------------------- início
  window.addEventListener('load', async () => {
    $('desenho').addEventListener('pointerdown', aoTocar);
    window.addEventListener('resize', ajustarCanvas);
    $('video').addEventListener('loadedmetadata', ajustarCanvas);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && estado.ativo) manterTelaAcesa();
    });
    ajustarCanvas();
    modo('vivo');
    await carregar();
    if (!estado.seguro) {
      aviso('Aberto por HTTP: o navegador não vai liberar a câmera. ' +
        'Suba o servidor com <b>./run.sh --https</b> e entre pelo QR code. ' +
        'O modo <b>Só cronômetro</b> funciona assim mesmo.', 'erro');
    }
  });

  return { trocarEstudo, ligarCamera, virarCamera, lanterna, zoom, alternarDesenho,
    modo, alternar, marcar, fimDeCiclo, reenviar };
})();
