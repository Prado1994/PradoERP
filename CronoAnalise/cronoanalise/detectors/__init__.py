from .base import Detector, ResultadoFrame
from .motion_roi import DetectorROI

__all__ = ["Detector", "ResultadoFrame", "DetectorROI", "criar_detector"]


def criar_detector(rois, tipo: str = "auto", **kwargs):
    """Fabrica de detectores.

    - "roi"  : movimento/presenca por ROI com OpenCV (padrao, roda em CPU fraca)
    - "yolo" : deteccao de objetos + zonas (precisa de ultralytics + supervision)
    - "pose" : quantificacao de movimento do operador (precisa de mediapipe)
    """
    tipo = (tipo or "auto").lower()
    if tipo in ("auto", "roi", "movimento", "presenca"):
        return DetectorROI(rois, **kwargs)
    if tipo == "yolo":
        from .yolo_zone import DetectorYOLO
        return DetectorYOLO(rois, **kwargs)
    if tipo == "pose":
        from .pose_motion import DetectorPose
        return DetectorPose(rois, **kwargs)
    raise ValueError(f"Detector desconhecido: {tipo}")
