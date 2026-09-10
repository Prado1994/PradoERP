"""Detector de atividade por regiao de interesse (OpenCV).

Duas leituras por ROI, escolhidas por `ROI.deteccao`:

- MOVIMENTO: subtracao de fundo adaptativa (MOG2). Responde a "tem alguem/algo
  se mexendo aqui". Ideal para medir elemento de trabalho manual (pespontar,
  colar, montar) e para camera fixa de CFTV.
- PRESENCA: diferenca contra um fundo de referencia aprendido no inicio.
  Responde a "tem peca parada aqui". Ideal para bancada, rampa de saida,
  caixa de par pronto - o contador de pecas.

Referencia de implementacao: o pipeline classico de motion detection do
OpenCV/PyImageSearch (blur -> subtracao -> threshold -> morfologia -> area).
"""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from ..models import ModoDeteccao, ROI
from .base import ResultadoFrame

CORES = {
    "off": (169, 193, 204),   # bege Prado (BGR)
    "on": (97, 199, 254),     # amarelo Safety (BGR)
    "contador": (52, 82, 159),  # terra Country (BGR)
}


class DetectorROI:
    def __init__(self, rois: list[ROI], largura_proc: int = 480,
                 sensibilidade: float = 25.0, aprendizado_fundo: float = 0.002,
                 aquecimento_s: float = 8.0, aprendizado_aquecimento: float = 0.02):
        self.rois = rois
        self.largura_proc = largura_proc
        self.sensibilidade = sensibilidade   # threshold em niveis de cinza
        self.aprendizado_fundo = aprendizado_fundo
        # Aquecimento: o modelo de fundo precisa ver o posto por alguns segundos
        # antes de valer. Sem isso, o primeiro ciclo sai picotado e contamina a
        # media. Durante o aquecimento nada e reportado, e o modelo aprende
        # DEVAGAR (0,02) de proposito: com aprendizado rapido ele absorveria o
        # operador em movimento como se fosse parte do fundo.
        self.aquecimento_s = aquecimento_s
        self.aprendizado_aquecimento = aprendizado_aquecimento
        self._t_inicio: float | None = None
        self._mog = cv2.createBackgroundSubtractorMOG2(
            history=500, varThreshold=32, detectShadows=True)
        self._fundo: np.ndarray | None = None     # media movel para modo PRESENCA
        self._mascaras: dict[str, np.ndarray] = {}
        self._areas: dict[str, float] = {}
        self._shape: tuple[int, int] | None = None
        self._kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

    # ------------------------------------------------------------------ #
    def _preparar_mascaras(self, h: int, w: int) -> None:
        if self._shape == (h, w) and self._mascaras:
            return
        self._shape = (h, w)
        self._mascaras.clear()
        self._areas.clear()
        for roi in self.rois:
            m = np.zeros((h, w), dtype=np.uint8)
            pts = np.array([[int(x * w), int(y * h)] for x, y in roi.pontos], dtype=np.int32)
            if len(pts) >= 3:
                cv2.fillPoly(m, [pts], 255)
            self._mascaras[roi.nome] = m
            self._areas[roi.nome] = float(max(1, int(np.count_nonzero(m))))

    def _reduzir(self, frame: np.ndarray) -> np.ndarray:
        h, w = frame.shape[:2]
        if w <= self.largura_proc:
            return frame
        escala = self.largura_proc / float(w)
        return cv2.resize(frame, (self.largura_proc, max(1, int(h * escala))),
                          interpolation=cv2.INTER_AREA)

    # ------------------------------------------------------------------ #
    def processar(self, frame: np.ndarray, ts: float) -> ResultadoFrame:
        pequeno = self._reduzir(frame)
        h, w = pequeno.shape[:2]
        self._preparar_mascaras(h, w)

        if self._t_inicio is None:
            self._t_inicio = ts
        aquecendo = (ts - self._t_inicio) < self.aquecimento_s

        cinza = cv2.cvtColor(pequeno, cv2.COLOR_BGR2GRAY)
        cinza = cv2.GaussianBlur(cinza, (21, 21), 0)

        # --- movimento (MOG2) --------------------------------------------
        fg = self._mog.apply(
            pequeno, learningRate=self.aprendizado_aquecimento if aquecendo else -1)
        _, fg = cv2.threshold(fg, 200, 255, cv2.THRESH_BINARY)  # remove sombra (127)
        fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, self._kernel)
        fg = cv2.dilate(fg, self._kernel, iterations=2)

        # --- presenca (diferenca contra fundo de referencia) --------------
        if self._fundo is None:
            self._fundo = cinza.astype("float32")
        diff = cv2.absdiff(cinza, cv2.convertScaleAbs(self._fundo))
        _, presenca = cv2.threshold(diff, self.sensibilidade, 255, cv2.THRESH_BINARY)
        presenca = cv2.morphologyEx(presenca, cv2.MORPH_OPEN, self._kernel)
        presenca = cv2.dilate(presenca, self._kernel, iterations=2)
        # o fundo aprende devagar: peca parada continua sendo "presenca" por minutos
        cv2.accumulateWeighted(cinza.astype("float32"), self._fundo,
                               0.25 if aquecendo else self.aprendizado_fundo)

        if aquecendo:
            # nada e reportado enquanto o fundo nao estabiliza
            return ResultadoFrame(ts=ts, atividade={r.nome: 0.0 for r in self.rois},
                                  extras={"aquecendo": True,
                                          "restam_s": round(self.aquecimento_s - (ts - self._t_inicio), 1)})

        atividade: dict[str, float] = {}
        for roi in self.rois:
            mascara = self._mascaras[roi.nome]
            area = self._areas[roi.nome]
            fonte = presenca if roi.deteccao is ModoDeteccao.PRESENCA else fg
            ocupado = cv2.countNonZero(cv2.bitwise_and(fonte, fonte, mask=mascara))
            atividade[roi.nome] = min(1.0, ocupado / area)

        return ResultadoFrame(ts=ts, atividade=atividade,
                              extras={"largura_proc": w, "altura_proc": h})

    def redefinir_fundo(self) -> None:
        """Reaprende o fundo agora (usar com o posto vazio)."""
        self._fundo = None
        self._t_inicio = None
        self._mog = cv2.createBackgroundSubtractorMOG2(
            history=500, varThreshold=32, detectShadows=True)

    # ------------------------------------------------------------------ #
    def anotar(self, frame: np.ndarray, resultado: ResultadoFrame,
               estado: dict[str, Any] | None = None) -> np.ndarray:
        """Desenha ROIs, estado e valores sobre o frame (preview do operador)."""
        out = frame.copy()
        h, w = out.shape[:2]
        gatilhos = (estado or {}).get("gatilhos", {})
        for roi in self.rois:
            g = gatilhos.get(roi.nome, {})
            ativo = bool(g.get("ativo"))
            cor = CORES["contador"] if roi.modo.value == "contador" else (
                CORES["on"] if ativo else CORES["off"])
            pts = np.array([[int(x * w), int(y * h)] for x, y in roi.pontos], dtype=np.int32)
            if len(pts) >= 3:
                cv2.polylines(out, [pts], True, cor, 2 if not ativo else 3)
                if ativo:
                    camada = out.copy()
                    cv2.fillPoly(camada, [pts], cor)
                    cv2.addWeighted(camada, 0.18, out, 0.82, 0, out)
                x, y = int(pts[:, 0].min()), int(pts[:, 1].min())
                valor = resultado.atividade.get(roi.nome, 0.0)
                texto = f"{roi.nome} {valor:.0%}"
                cv2.rectangle(out, (x, max(0, y - 20)), (x + 9 * len(texto), y), (50, 38, 28), -1)
                cv2.putText(out, texto, (x + 3, max(11, y - 6)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (244, 252, 255), 1, cv2.LINE_AA)
        if estado:
            rodape = (f"t={estado.get('duracao_s', 0):.1f}s  "
                      f"ciclos={estado.get('ciclos_completos', 0)}")
            cv2.rectangle(out, (0, h - 26), (w, h), (50, 38, 28), -1)
            cv2.putText(out, rodape, (8, h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                        (97, 199, 254), 1, cv2.LINE_AA)
        return out
