"""Detector por objeto + zona (opcional).

Quando o posto tem peca bem definida (par, forma, cabedal, caixa), detectar o
OBJETO da resultado mais estavel que detectar movimento. Pipeline igual ao que
a Roboflow documenta para contagem em linha de producao:

    YOLO (ultralytics)  ->  supervision.Detections  ->  ByteTrack  ->  PolygonZone

Instalar com:  pip install -r requirements-ml.txt
Modelo padrao: yolo11n.pt (baixa sozinho no primeiro uso, ~6 MB).
"""

from __future__ import annotations

from typing import Any

import numpy as np

from ..models import ROI
from .base import ResultadoFrame

_ERRO = (
    "Detector YOLO indisponivel. Instale as dependencias opcionais:\n"
    "    pip install -r requirements-ml.txt\n"
    "Ou use o detector padrao (movimento/presenca), que nao precisa de GPU."
)


class DetectorYOLO:
    def __init__(self, rois: list[ROI], modelo: str = "yolo11n.pt",
                 confianca: float = 0.35, saturacao: int = 2, **_: Any):
        try:
            import supervision as sv
            from ultralytics import YOLO
        except ImportError as exc:  # pragma: no cover - depende de extra opcional
            raise RuntimeError(_ERRO) from exc
        self._sv = sv
        self.rois = rois
        self.confianca = confianca
        self.saturacao = max(1, saturacao)   # quantos objetos ja significam "100%"
        self.modelo = YOLO(modelo)
        self.tracker = sv.ByteTrack()
        self._zonas: dict[str, Any] = {}
        self._shape: tuple[int, int] | None = None
        self._anotador_caixa = sv.BoxAnnotator()
        self._anotador_rotulo = sv.LabelAnnotator()

    def _preparar_zonas(self, h: int, w: int) -> None:
        if self._shape == (h, w) and self._zonas:
            return
        self._shape = (h, w)
        self._zonas = {
            roi.nome: self._sv.PolygonZone(
                polygon=np.array([[int(x * w), int(y * h)] for x, y in roi.pontos], dtype=np.int32)
            )
            for roi in self.rois
        }

    def processar(self, frame: np.ndarray, ts: float) -> ResultadoFrame:
        h, w = frame.shape[:2]
        self._preparar_zonas(h, w)

        resultado = self.modelo(frame, verbose=False, conf=self.confianca)[0]
        deteccoes = self._sv.Detections.from_ultralytics(resultado)
        deteccoes = self.tracker.update_with_detections(deteccoes)

        nomes = self.modelo.model.names if hasattr(self.modelo, "model") else {}
        atividade: dict[str, float] = {}
        for roi in self.rois:
            alvo = deteccoes
            if roi.classe_objeto and len(deteccoes) and deteccoes.class_id is not None:
                ids = [i for i, c in enumerate(deteccoes.class_id)
                       if str(nomes.get(int(c), c)).lower() == roi.classe_objeto.lower()]
                alvo = deteccoes[ids] if ids else deteccoes[[]]
            dentro = self._zonas[roi.nome].trigger(detections=alvo) if len(alvo) else []
            n = int(np.count_nonzero(dentro)) if len(alvo) else 0
            atividade[roi.nome] = min(1.0, n / self.saturacao)

        return ResultadoFrame(ts=ts, atividade=atividade,
                              extras={"deteccoes": int(len(deteccoes))})

    def redefinir_fundo(self) -> None:
        self.tracker = self._sv.ByteTrack()

    def anotar(self, frame: np.ndarray, resultado: ResultadoFrame,
               estado: dict[str, Any] | None = None) -> np.ndarray:
        from .motion_roi import DetectorROI
        # reaproveita o desenho de ROIs do detector padrao
        return DetectorROI.anotar(self, frame, resultado, estado)  # type: ignore[arg-type]
