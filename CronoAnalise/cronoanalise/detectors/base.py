from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class ResultadoFrame:
    """Saida de um detector para um frame."""

    ts: float                                   # segundos desde o inicio da captura
    atividade: dict[str, float] = field(default_factory=dict)   # ROI -> 0..1
    extras: dict[str, Any] = field(default_factory=dict)


class Detector(Protocol):
    def processar(self, frame, ts: float) -> ResultadoFrame: ...
    def anotar(self, frame, resultado: ResultadoFrame, estado: dict[str, Any] | None = None): ...
