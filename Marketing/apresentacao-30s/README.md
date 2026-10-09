# Spot 30s — Safety Prado Adventure 48506

Vídeo estilo comercial de intervalo (16:9, 1920×1080, 30 fps, 30,0 s, sem áudio).

**Arquivo final:** `safety-adventure-48506-spot-30s.mp4`

## Roteiro

| Tempo | Cena | Texto na tela |
|---|---|---|
| 0:00–0:03 | Gancho | PISE FIRME. · Safety Prado · Linha Adventure |
| 0:03–0:08 | Herói | Linha Adventure · 48506 · Botina Safety Prado |
| 0:08–0:14 | Detalhes | Olha o detalhe. · Painel em mesh 3D · Costura dupla aparente · Forro laranja |
| 0:14–0:21 | Cores | Escolha a sua cor. · Café · Preto · Marrom |
| 0:21–0:26 | Assinatura | FEITOS PARA DURAR. · Desde 1994 |
| 0:26–0:30 | Fechamento | Logo · Fale com um representante Prado · @botinasprado |

## Como editar e renderizar

- `spot.template.html` é o código-fonte. O `spot.html` é gerado dele, com o logo oficial embutido no lugar de `__LOGO__`.
- A animação é determinística: `renderAt(t)` desenha o quadro do instante `t`. Tempos, textos e posições estão nesse arquivo.
- Renderizar quadros: `node render.mjs <pasta-saida> <inicio> <fim>` (precisa do Playwright; 900 quadros no total).
- Montar o vídeo: `ffmpeg -framerate 30 -i <pasta>/f_%04d.jpg -c:v libx264 -crf 17 -pix_fmt yuv420p -movflags +faststart saida.mp4`

## Pendências

- Sem áudio. Falta trilha e/ou locução.
- Conferir com o comercial o @ do perfil e o texto das chamadas antes de publicar.
- Fotos reais em 2x (não 8K); ver `../fotos-produto/README.md`.
