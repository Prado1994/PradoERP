"""Gera um video sintetico de um posto de trabalho, para testar o app sem camera.

Simula um ciclo de 12 s:
    0,0 - 6,0 s   operador pespontando (movimento na bancada)
    6,0 - 8,0 s   pausa
    8,0 - 9,5 s   par pronto aparece na rampa de saida (contador)
    9,5 - 12,0 s  rampa livre

Uso:  python demo/gerar_video_demo.py [saida.mp4] [duracao_s]
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import cv2
import numpy as np

L, A, FPS = 640, 480, 20.0
CICLO = 12.0

# regioes (normalizadas) - as mesmas do demo/estudo_demo.json
BANCADA = (0.05, 0.25, 0.45, 0.88)
SAIDA = (0.58, 0.55, 0.95, 0.92)


def _cx(caixa):
    x1, y1, x2, y2 = caixa
    return int(x1 * L), int(y1 * A), int(x2 * L), int(y2 * A)


def desenhar_fundo() -> np.ndarray:
    img = np.full((A, L, 3), 118, dtype=np.uint8)
    cv2.rectangle(img, (0, int(0.22 * A)), (L, A), (96, 104, 112), -1)   # chao
    x1, y1, x2, y2 = _cx(BANCADA)
    cv2.rectangle(img, (x1 - 12, y1 - 12), (x2 + 12, y2 + 12), (128, 142, 156), -1)  # bancada
    x1, y1, x2, y2 = _cx(SAIDA)
    cv2.rectangle(img, (x1 - 10, y1 - 10), (x2 + 10, y2 + 10), (104, 118, 132), -1)  # rampa
    ruido = np.random.default_rng(7).normal(0, 3, img.shape).astype(np.int16)
    return np.clip(img.astype(np.int16) + ruido, 0, 255).astype(np.uint8)


def main(argv: list[str]) -> int:
    saida = Path(argv[1]) if len(argv) > 1 else Path(__file__).parent / "posto_demo.mp4"
    duracao = float(argv[2]) if len(argv) > 2 else 96.0

    fundo = desenhar_fundo()
    escritor = cv2.VideoWriter(str(saida), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (L, A))
    if not escritor.isOpened():  # alguns builds nao trazem mp4v
        saida = saida.with_suffix(".avi")
        escritor = cv2.VideoWriter(str(saida), cv2.VideoWriter_fourcc(*"MJPG"), FPS, (L, A))

    rng = np.random.default_rng(11)
    total = int(duracao * FPS)
    for i in range(total):
        t = i / FPS
        fase = t % CICLO
        img = fundo.copy()
        img = np.clip(img.astype(np.int16) + rng.normal(0, 2, img.shape).astype(np.int16),
                      0, 255).astype(np.uint8)

        # operador trabalhando na bancada (maos indo e vindo)
        if fase < 6.0:
            bx1, by1, bx2, by2 = _cx(BANCADA)
            cv2.rectangle(img, (bx1 + 20, by1 + 30), (bx2 - 20, by2 - 30), (52, 82, 159), -1)
            osc = math.sin(fase * 6.0)
            cx = int((bx1 + bx2) / 2 + osc * (bx2 - bx1) * 0.28)
            cy = int((by1 + by2) / 2 + math.cos(fase * 7.0) * (by2 - by1) * 0.18)
            cv2.circle(img, (cx, cy), 26, (168, 190, 214), -1)
            cv2.circle(img, (cx + 46, cy + 12), 22, (168, 190, 214), -1)

        # par pronto na rampa de saida
        if 8.0 <= fase < 9.5:
            sx1, sy1, sx2, sy2 = _cx(SAIDA)
            cv2.rectangle(img, (sx1 + 14, sy1 + 18), (sx2 - 14, sy2 - 18), (28, 38, 50), -1)
            cv2.rectangle(img, (sx1 + 24, sy1 + 28), (sx2 - 24, sy1 + 52), (97, 199, 254), -1)

        escritor.write(img)

    escritor.release()
    print(f"Video demo gerado: {saida}  ({duracao:.0f}s, {int(duracao / CICLO)} ciclos esperados)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
