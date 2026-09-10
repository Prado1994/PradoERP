# Cronoanálise Prado

**Estudo de tempos e produtividade por visão computacional.**
Aponta a câmera do celular — ou usa uma câmera de CFTV que já existe no galpão —
e o app mede o tempo de ciclo, o tempo de cada elemento do trabalho, a capacidade
do posto e a aderência à meta de 550 pares/dia.

Feito para o chão de fábrica de Itanhandu e Guaxupé: roda em qualquer notebook,
sem GPU, sem nuvem e sem instalar nada no celular (é uma página web).

---

## O que ele resolve

| Antes (prancheta e cronômetro) | Com o app |
|---|---|
| Um analista parado no posto, 2 a 3 horas | A câmera mede sozinha o turno inteiro |
| 10 a 20 ciclos medidos | Centenas de ciclos |
| Erro humano no acionar/parar | Precisão de centésimo de segundo |
| Planilha digitada à mão | CSV pronto para Power BI / Odoo |
| Só o tempo total | Tempo por elemento — mostra **onde** está o desperdício |

O que sai no fim: **TM** (tempo médio), **TN** (tempo normal), **TP** (tempo padrão),
capacidade/hora, capacidade/dia, takt time, gargalo, eficiência de balanceamento
e quantos ciclos ainda faltam medir para a amostra ser estatisticamente válida.

---

## Instalação

```bash
cd CronoAnalise
./run.sh --https      # cria o ambiente, gera o certificado e sobe o servidor
```

O script mostra os endereços:

```
Neste computador : https://localhost:8443
No celular       : https://192.168.0.x:8443/celular   (mesma rede Wi-Fi)
```

Sem `--https` ele sobe em HTTP na porta 8000 — serve para a câmera do servidor
e para o cronômetro, mas **não libera a câmera do celular** (ver abaixo).

Instalação manual, se preferir:

```bash
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn cronoanalise.api:app --host 0.0.0.0 --port 8000
```

---

## Módulo Celular

A tela de campo fica em **`/celular`** — feita para ser usada em pé, no posto,
com uma mão e possivelmente de luva: alvos grandes, contraste alto, tempo em
letra garrafal e vibração a cada ciclo fechado.

### Como o celular entra

Na tela do PC, botão **📱 Abrir no celular**: aparece um **QR code** com o endereço
do servidor na rede local. O analista aponta a câmera e está dentro — sem digitar IP.

**Por que HTTPS.** Navegador nenhum entrega a câmera para uma página em HTTP que
não seja `localhost` — é regra de segurança do navegador, não limitação do app.
Por isso `./run.sh --https` gera um certificado local, válido para os IPs desta
máquina (`cronoanalise/certificados.py`). Na primeira vez o celular avisa
"conexão não privada": é o próprio servidor da fábrica — **Avançado → Prosseguir**,
e o aviso não volta mais naquele aparelho.

### Três modos de trabalho

| Modo | Como funciona | Quando usar |
|---|---|---|
| **Ao vivo** | O celular envia ~8 quadros/s e o servidor mede na hora | Wi-Fi bom; você quer ver o resultado subindo na tela |
| **Gravar e analisar** | O celular grava na taxa cheia da câmera e envia o arquivo no fim | **O mais preciso.** Wi-Fi ruim ou instável — a rede só é usada no envio |
| **Só cronômetro** | Sem câmera, só os botões de elemento | Qualquer aparelho, funciona até em HTTP |

O modo **Gravar** é o mais preciso porque o tempo sai do próprio arquivo — cada
quadro carrega seu carimbo — em vez de depender de quando o pacote chegou pela
rede. E ele lida com a **taxa de quadros variável** do celular (a câmera baixa o
fps quando escurece), que faria a conta `índice ÷ fps` acumular erro ao longo do turno.

### O que a tela de campo faz

- **Marcar região com o dedo** — toque nos cantos, dê o nome e o papel. As ROIs
  ficam salvas no estudo e valem também para a CFTV.
- **Lanterna e zoom** — quando o aparelho permite. Galpão escuro e posto distante
  são a regra, não a exceção.
- **Tela não apaga** (Wake Lock) durante a medição.
- **Reconexão automática** — Wi-Fi de galpão cai. O app reconecta sozinho com
  espera crescente, e a medição continua rodando no servidor enquanto isso.
- **Fila de marcações** — se a rede falhar bem na hora do toque, a marcação fica
  na fila e sobe quando a conexão volta. Nenhum toque se perde.
- **Marcar enquanto grava** — no modo Gravar, os toques são cronometrados no
  aparelho e enviados junto com o vídeo. O servidor os encaixa no ponto exato:
  o analista marca o que a câmera não vê, a câmera mede o que o dedo não alcança.
- **Reenvio manual** — se o envio falhar, o vídeo continua no aparelho e há um
  botão para tentar de novo.

### Alternativa sem celular

Se preferir não mexer com certificado: ligue uma **webcam no servidor** ou aponte
para a **CFTV**. O celular vira só um monitor — abre o preview anotado e não
precisa de câmera nem de HTTPS.

---

## Como usar em 5 passos (tela do PC)

1. **Novo estudo** — nome, unidade, setor, produto, posto, operador.
   Ajuste o **fator de ritmo (FR)** e o **fator de tolerância (FT)**.
2. **Escolha a câmera** — celular, CFTV (RTSP), webcam do servidor ou vídeo gravado.
3. **Marque as regiões (ROI)** — toque na tela para desenhar. Cada região tem um papel:
   - **Elemento** — mede a duração daquela etapa (ex.: "pespontar cabedal").
   - **Âncora** — quando essa etapa recomeça, começa um ciclo novo.
   - **Contador** — cada ativação = 1 peça pronta (ex.: a rampa de saída). *É o modo
     mais robusto para câmera de teto: só ele já dá o tempo de ciclo.*
4. **Zere o fundo** com o posto vazio e **inicie a captura**.
5. **Pare e salve** — o resultado aparece na hora e o CSV fica disponível.

> Dica de precisão: o detector leva ~8 s se aquecendo (aprendendo o fundo) antes
> de reportar qualquer coisa. Deixe a câmera ligada um pouco antes do operador começar.

### Cronômetro manual

Sempre disponível, com ou sem câmera, nas duas telas. Toque no elemento que está
começando; ao final do ciclo, toque em **Fim de ciclo**. Serve para a cronoanálise
clássica na mão e para o analista validar o que a câmera está vendo.

---

## Análise em lote (sem servidor)

Para rodar de madrugada sobre as gravações da CFTV:

```bash
python -m cronoanalise.cli /gravacoes/pesponto_terca.mp4 \
       --config demo/estudo_demo.json \
       --csv saidas/pesponto_terca.csv
```

Funciona também com câmera ao vivo: `python -m cronoanalise.cli rtsp://... --config posto.json`

---

## Demonstração sem câmera

```bash
python demo/gerar_video_demo.py                     # gera um posto sintético de 96 s
python -m cronoanalise.cli demo/posto_demo.mp4 --config demo/estudo_demo.json
```

O vídeo tem ciclo de exatamente **12,0 s** e elemento de **6,0 s**. O app mede
12,00 s (desvio 0,00) e 6,00 s — é essa a verificação do
`tests/test_integracao_video.py`, que garante que o app não "mede errado bonito".

---

## As contas que ele faz

```
TM  = média dos tempos de ciclo (já sem as leituras anômalas)
TN  = TM × FR                       ritmo do operador (1,00 = normal)
TP  = TN × (1 + FT)                 tolerâncias: pessoais + fadiga + esperas
Capacidade/hora = 3600 / TP
Capacidade/dia  = (jornada_min × 60) / TP
Takt time       = (jornada_min × 60) / demanda_dia
n recomendado   = (z × s / (e × TM))²      z = 1,96 (95%) · e = 5%
Eficiência linha = Σ TP dos elementos / (postos × TP do gargalo)
```

**Leituras anômalas** (parada de máquina, retrabalho, alguém passando na frente)
são detectadas pelo **MAD** — mediana dos desvios absolutos — e não entram na média.
Quando o processo é muito estável (MAD ≈ 0), o critério passa a ser ±25% da mediana.
Elas continuam no CSV, marcadas, para o analista conferir.

---

## Como a visão computacional funciona aqui

O sinal bruto é ruidoso, e o segredo está nos filtros — os mesmos que um
cronoanalista faz na cabeça:

```
frame → detector → atividade por ROI (0 a 1) → histerese → debounce → ciclos
```

- **Histerese** — liga acima do limiar_on, só desliga abaixo do limiar_off.
  Sem isso, o sinal fica tremendo no limite e gera ciclos fantasmas.
- **Debounce** — a mudança só vale se durar `min_on_s` / `min_off_s`.
  Filtra sombra, reflexo de solda e gente passando na frente.
- **Aquecimento** — 8 s aprendendo o fundo, sem reportar nada. Com aprendizado
  propositalmente lento (0,02): rápido demais, o modelo absorveria o operador em
  movimento como se fosse parte do fundo.

Três motores de detecção, do mais leve ao mais pesado:

| Motor | Precisa de | Quando usar |
|---|---|---|
| **Movimento / presença** (padrão) | só OpenCV | Quase sempre. Roda em CPU fraca, até num Raspberry Pi |
| **Objeto + zona** (YOLO) | `requirements-ml.txt` | Peça bem definida (par, forma, caixa) e cena movimentada |
| **Pose do operador** | `requirements-ml.txt` | Separar trabalho efetivo de espera parada; estudo ergonômico |

```bash
pip install -r requirements-ml.txt    # só se precisar dos dois últimos
```

---

## De onde vieram as ideias

Pesquisa feita antes de escrever a primeira linha. O que foi aproveitado de cada:

**Bibliotecas Python**

- **[OpenCV](https://opencv.org/)** — base de tudo: `BackgroundSubtractorMOG2`,
  máscaras poligonais, morfologia. O pipeline
  *blur → subtração → threshold → morfologia → área* é o clássico documentado no
  [PyImageSearch](https://pyimagesearch.com/2015/05/25/basic-motion-detection-and-tracking-with-python-and-opencv/)
  e no [GeeksforGeeks](https://www.geeksforgeeks.org/webcam-motion-detector-python/),
  que já registram o **intervalo de tempo** de cada movimento — a semente da cronoanálise.
- **[Roboflow Supervision](https://supervision.roboflow.com/)** — de onde veio o modelo
  de `PolygonZone` e `LineZone` + `ByteTrack`. É o pipeline que a Roboflow documenta
  para [contagem em linha de produção](https://blog.roboflow.com/video-object-counting/);
  está reproduzido em `detectors/yolo_zone.py`.
- **[Ultralytics YOLO](https://docs.ultralytics.com/)** — detecção e rastreio com ID
  persistente entre frames, para contar peça sem contar duas vezes.
- **[PyBodyTrack](https://www.sciencedirect.com/science/article/pii/S2352711025002390)** —
  biblioteca de quantificação de movimento corporal em vídeo. A ideia de medir
  *quanto o corpo se deslocou* (em vez de "tem pixel mudando") virou o
  `detectors/pose_motion.py`, sobre MediaPipe Pose.
- **[MediaPipe Pose](https://developers.google.com/mediapipe)** — landmarks de ombro,
  cotovelo, pulso e mãos, que é o que interessa em pesponto, colagem e montagem.

**Softwares de cronoanálise que serviram de espelho**

- **AviX Method / AviX FMEA** — o conceito de *elementos* dentro do ciclo e a análise
  de participação de cada um. Está na tabela "onde está o tempo".
- **Timer Pro Professional** e **Proplanner Time Study** — estudo de tempos a partir de
  vídeo, com marcação de elemento durante a reprodução, fator de ritmo, tolerâncias e
  cálculo de tempo padrão. É a espinha do módulo `stats.py`.
- **Kronos / Cronoanálise (apps de chão de fábrica)** — o cronômetro de voltas com um
  botão por elemento, feito para ser tocado com luva. Virou o cronômetro manual da tela
  de captura.
- **MODAPTS / MTM** — a disciplina de decompor o trabalho em elementos padronizados
  antes de medir. O app não implementa as tabelas MTM, mas adota a mesma decomposição.

O que **não** foi copiado: nenhum código proprietário. Tudo aqui é implementação
própria sobre bibliotecas abertas (OpenCV, FastAPI), seguindo os métodos públicos de
estudo de tempos consolidados por Barnes em *Estudo de Movimentos e de Tempos*.

---

## Estrutura

```
CronoAnalise/
├── run.sh                      sobe tudo com um comando
├── requirements.txt            núcleo (OpenCV + FastAPI)
├── requirements-ml.txt         opcional (YOLO + MediaPipe)
├── cronoanalise/
│   ├── models.py               Estudo, ROI, Ciclo, Leitura, Parâmetros
│   ├── cycle_engine.py         histerese, debounce e montagem dos ciclos
│   ├── stats.py                TM, TN, TP, takt, gargalo, outliers, amostra
│   ├── sources.py              celular, webcam, RTSP/CFTV, arquivo
│   ├── session.py              orquestra captura em thread
│   ├── storage.py              SQLite (estudos e medições)
│   ├── api.py                  REST + WebSocket + preview MJPEG
│   ├── lote.py                 análise de vídeo gravado (CLI e módulo celular)
│   ├── rede.py                 IPs locais e QR de pareamento
│   ├── certificados.py         certificado HTTPS local — libera a câmera
│   ├── cli.py                  análise em lote pelo terminal
│   ├── detectors/
│   │   ├── motion_roi.py       movimento/presença — o padrão
│   │   ├── yolo_zone.py        objeto + zona (opcional)
│   │   └── pose_motion.py      movimento do operador (opcional)
│   └── web/
│       ├── index.html/app.js   tela de escritório
│       ├── celular.html/.js    Módulo Celular — tela de campo
│       └── comum.js            o que as duas telas compartilham
├── demo/                       vídeo sintético + estudo de exemplo
└── tests/                      29 testes (unitários, integração, API e celular)
```

## API

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/api/estudos` | lista os estudos |
| `POST` | `/api/estudos` | cria um estudo |
| `PUT` | `/api/estudos/{id}/rois` | grava as regiões desenhadas |
| `POST` | `/api/estudos/{id}/iniciar` | inicia a captura |
| `POST` | `/api/estudos/{id}/marcar` | marcação do cronômetro manual |
| `POST` | `/api/estudos/{id}/fundo` | reaprende o fundo |
| `POST` | `/api/estudos/{id}/parar` | encerra e salva a medição |
| `GET` | `/api/estudos/{id}/resumo` | análise ao vivo |
| `GET` | `/api/estudos/{id}/preview.mjpg` | preview anotado da câmera |
| `GET` | `/api/medicoes/{id}/export.csv` | CSV (separador `;`, abre direto no Excel) |
| `WS` | `/ws/estudos/{id}/frames` | frames do celular (modo ao vivo) |
| `WS` | `/ws/estudos/{id}/eventos` | eventos ao vivo |
| `GET` | `/celular` | tela de campo do Módulo Celular |
| `GET` | `/api/celular/pareamento` | URLs da rede, QR code e diagnóstico de HTTPS |
| `POST` | `/api/estudos/{id}/gravacao` | recebe o vídeo gravado no celular |
| `GET` | `/api/gravacoes/{job}` | andamento da análise da gravação |

Documentação interativa em `/docs`.

## Testes

```bash
./.venv/bin/python -m pytest tests -q
```

Cobrem o motor de ciclos (histerese, debounce, âncora, contador, cronômetro manual),
as contas de cronoanálise, a API inteira, o Módulo Celular (pareamento, certificado,
upload de WebM e mescla das marcações com a visão) e uma medição ponta a ponta sobre
vídeo, conferindo o valor real conhecido.

---

## Próximos passos sugeridos

1. **Piloto** em um posto de pesponto em Itanhandu: comece pelo Módulo Celular no
   modo **Gravar e analisar** — não depende de infra nenhuma — e compare com uma
   cronoanálise manual do mesmo turno.
2. **Integração** do CSV com o Power BI via Kondado, junto dos dados do Bling.
3. **Tempo padrão no Odoo** — alimentar as rotinas de produção com o TP medido,
   fechando o OKR3 (margem bruta > 40%).
4. **Painel de linha** — vários postos na mesma tela, mostrando o gargalo em tempo real.

---

*Grupo Prado · Safety Prado · Country Prado · Itanhandu & Guaxupé · 2026*
