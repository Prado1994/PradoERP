"""Quantificacao de movimento do operador por pose (opcional).

Mesma ideia da biblioteca PyBodyTrack: em vez de perguntar "tem pixel mudando",
pergunta "quanto o corpo do operador se deslocou". Serve para separar trabalho
efetivo de espera parada, e para estudo ergonomico (quais membros trabalham
mais em cada elemento).

Instalar com:  pip install -r requirements-ml.txt
"""

from __future__ import annotations

from typing import Any

import numpy as np

from ..models import ROI
from .base import ResultadoFrame

_ERRO = (
    "Detector de pose indisponivel. Instale as dependencias opcionais:\n"
    "    pip install -r requirements-ml.txt"
)

# Landmarks de maos/bracos do MediaPipe Pose - o que mais importa em pespontar,
# colar e montar. Ombro, cotovelo, pulso e maos, dos dois lados.
LANDMARKS_TRABALHO = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]


class DetectorPose:
    def __init__(self, rois: list[ROI], escala: float = 40.0,
                 complexidade: int = 0, **_: Any):
        try:
            import mediapipe as mp
        except ImportError as exc:  # pragma: no cover - depende de extra opcional
            raise RuntimeError(_ERRO) from exc
        self._mp = mp
        self.rois = rois
        self.escala = escala   # quanto de deslocamento normalizado ja e "100%"
        self.pose = mp.solutions.pose.Pose(
            model_complexity=complexidade, min_detection_confidence=0.5,
            min_tracking_confidence=0.5, smooth_landmarks=True)
        self._anterior: dict[int, tuple[float, float]] = {}

    @staticmethod
    def _dentro(ponto: tuple[float, float], roi: ROI) -> bool:
        """Ponto-em-poligono por ray casting (coordenadas normalizadas)."""
        x, y = ponto
        pts = roi.pontos
        dentro = False
        j = len(pts) - 1
        for i in range(len(pts)):
            xi, yi = pts[i]
            xj, yj = pts[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi:
                dentro = not dentro
            j = i
        return dentro

    def processar(self, frame: np.ndarray, ts: float) -> ResultadoFrame:
        import cv2

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res = self.pose.process(rgb)
        atividade = {roi.nome: 0.0 for roi in self.rois}
        movimento_total = 0.0

        if res.pose_landmarks:
            atual: dict[int, tuple[float, float]] = {}
            for idx in LANDMARKS_TRABALHO:
                lm = res.pose_landmarks.landmark[idx]
                if lm.visibility < 0.4:
                    continue
                atual[idx] = (lm.x, lm.y)
                ant = self._anterior.get(idx)
                if ant is None:
                    continue
                d = float(np.hypot(lm.x - ant[0], lm.y - ant[1]))
                movimento_total += d
                for roi in self.rois:
                    if self._dentro((lm.x, lm.y), roi):
                        atividade[roi.nome] += d
            self._anterior = atual

        for nome in atividade:
            atividade[nome] = min(1.0, atividade[nome] * self.escala)

        return ResultadoFrame(ts=ts, atividade=atividade,
                              extras={"movimento_corpo": round(movimento_total, 5)})

    def redefinir_fundo(self) -> None:
        self._anterior = {}

    def anotar(self, frame: np.ndarray, resultado: ResultadoFrame,
               estado: dict[str, Any] | None = None) -> np.ndarray:
        from .motion_roi import DetectorROI
        return DetectorROI.anotar(self, frame, resultado, estado)  # type: ignore[arg-type]
