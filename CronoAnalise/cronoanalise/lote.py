"""Analise de video gravado, quadro a quadro.

Usado em dois caminhos:
- pelo terminal (`python -m cronoanalise.cli`), sobre gravacoes da CFTV;
- pelo modulo do celular, quando o analista grava no aparelho e envia depois.

A gravacao tem uma vantagem sobre o ao vivo: o tempo vem do proprio video
(cada quadro tem sua posicao exata), entao nada se perde por oscilacao de
Wi-Fi. E o modo mais preciso do app.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from . import stats
from .cycle_engine import MotorCiclos
from .detectors import criar_detector
from .models import Ciclo, Estudo
from .sources import criar_fonte


def analisar_video(estudo: Estudo, caminho: str | Path, detector: str = "auto",
                   progresso: Callable[[float, int], None] | None = None,
                   cancelado: Callable[[], bool] | None = None,
                   marcacoes: list[dict[str, Any]] | None = None
                   ) -> tuple[list[Ciclo], dict[str, Any], float]:
    """Roda o pipeline completo sobre um arquivo.

    `progresso` recebe (segundos_processados, ciclos_ate_agora).
    `marcacoes` sao os toques do cronometro feitos durante a gravacao, cada um
    com {elemento, t, fechar_ciclo}. Como o `t` foi cronometrado no celular a
    partir do mesmo instante em que a gravacao comecou, eles caem no ponto
    exato do video - o analista marca o que a camera nao ve, e vice-versa.
    Devolve (ciclos, analise, duracao_do_video).
    """
    if not estudo.rois:
        raise ValueError("O estudo nao tem nenhuma regiao (ROI) definida.")

    fonte = criar_fonte(str(caminho))
    deteccao = criar_detector(estudo.rois, detector)
    motor = MotorCiclos(estudo.rois)

    pendentes = sorted((m for m in (marcacoes or []) if m.get("t") is not None),
                       key=lambda m: float(m["t"]))
    proxima = 0

    fonte.abrir()
    n = 0
    try:
        while True:
            if cancelado is not None and cancelado():
                break
            frame = fonte.ler()
            if frame is None:
                break
            if frame.imagem is None:
                continue
            # as marcacoes entram na ordem do relogio, antes do frame que as sucede
            while proxima < len(pendentes) and float(pendentes[proxima]["t"]) <= frame.ts:
                m = pendentes[proxima]
                motor.marcar_manual(str(m.get("elemento", "")), float(m["t"]),
                                    fechar_ciclo=bool(m.get("fechar_ciclo")))
                proxima += 1
            motor.processar(deteccao.processar(frame.imagem, frame.ts).atividade, frame.ts)
            n += 1
            if progresso is not None and n % 30 == 0:
                progresso(frame.ts, len(motor.ciclos))
    finally:
        fonte.fechar()

    for m in pendentes[proxima:]:
        motor.marcar_manual(str(m.get("elemento", "")), float(m["t"]),
                            fechar_ciclo=bool(m.get("fechar_ciclo")))
    motor.finalizar()
    analise = stats.analisar(motor.ciclos, estudo.parametros, motor.duracao_captura)
    return motor.ciclos, analise, motor.duracao_captura


def resumo_de_arquivo(estudo: Estudo, caminho: str | Path, detector: str = "auto",
                      **kwargs) -> dict[str, Any]:
    """Mesmo formato de `Sessao.resumo()`, para reaproveitar o front e o banco."""
    ciclos, analise, _ = analisar_video(estudo, caminho, detector, **kwargs)
    return {
        "estudo": estudo.to_dict(),
        "rodando": False,
        "erro": None,
        "estado": {"ciclos_completos": len(ciclos)},
        "analise": analise,
        "ciclos": [c.to_dict() for c in ciclos],
    }
