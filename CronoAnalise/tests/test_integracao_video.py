"""Teste ponta a ponta: video sintetico -> detector -> ciclos -> analise.

Gera o video demo (12 s de ciclo, 6 s de elemento) e confere se o app mede
exatamente isso. E o teste que garante que o app nao "mede errado bonito".
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

cv2 = pytest.importorskip("cv2")

from cronoanalise import stats  # noqa: E402
from cronoanalise.cycle_engine import MotorCiclos  # noqa: E402
from cronoanalise.detectors import criar_detector  # noqa: E402
from cronoanalise.models import Estudo  # noqa: E402
from cronoanalise.sources import criar_fonte  # noqa: E402

CICLO_REAL = 12.0
ELEMENTO_REAL = 6.0


@pytest.fixture(scope="module")
def video(tmp_path_factory):
    destino = tmp_path_factory.mktemp("demo") / "posto.mp4"
    subprocess.run([sys.executable, str(RAIZ / "demo" / "gerar_video_demo.py"),
                    str(destino), "96"], check=True, capture_output=True)
    caminho = destino if destino.exists() else destino.with_suffix(".avi")
    assert caminho.exists(), "o video demo nao foi gerado"
    return caminho


def medir(caminho):
    cfg = json.loads((RAIZ / "demo" / "estudo_demo.json").read_text(encoding="utf-8"))
    estudo = Estudo.from_dict(cfg)
    detector = criar_detector(estudo.rois, "auto")
    motor = MotorCiclos(estudo.rois)
    fonte = criar_fonte(str(caminho))
    fonte.abrir()
    try:
        while True:
            frame = fonte.ler()
            if frame is None:
                break
            if frame.imagem is None:
                continue
            motor.processar(detector.processar(frame.imagem, frame.ts).atividade, frame.ts)
    finally:
        fonte.fechar()
    motor.finalizar()
    return estudo, motor


def test_mede_o_ciclo_e_o_elemento_com_precisao(video):
    estudo, motor = medir(video)
    analise = stats.analisar(motor.ciclos, estudo.parametros, motor.duracao_captura)

    # 96 s de video / ciclo de 12 s = 8 ativacoes -> 7 ciclos completos
    assert len(motor.ciclos) == 7
    assert abs(analise["ciclos"]["media"] - CICLO_REAL) < 0.25
    assert analise["ciclos"]["desvio"] < 0.25

    elemento = analise["elementos"][0]
    assert elemento["elemento"] == "pespontar"
    assert abs(elemento["media"] - ELEMENTO_REAL) < 0.35

    # TP = TM x FR 1,00 x (1 + FT 0,15)
    assert abs(analise["tempos"]["tempo_padrao_s"] - CICLO_REAL * 1.15) < 0.3
    assert analise["gargalo"] == "pespontar"
    assert analise["atende_takt"] is True
