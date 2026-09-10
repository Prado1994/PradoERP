"""Testes da API: ciclo de vida completo de um estudo, sem camera fisica."""

import json
import subprocess
import sys
import time
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

pytest.importorskip("cv2")
pytest.importorskip("fastapi")

from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="module")
def cliente(tmp_path_factory, monkeypatch_module=None):
    import os
    os.environ["CRONO_DB"] = str(tmp_path_factory.mktemp("db") / "teste.db")
    import importlib
    from cronoanalise import api as modulo
    importlib.reload(modulo)
    with TestClient(modulo.app) as c:
        yield c


@pytest.fixture(scope="module")
def video(tmp_path_factory):
    destino = tmp_path_factory.mktemp("video") / "posto.mp4"
    subprocess.run([sys.executable, str(RAIZ / "demo" / "gerar_video_demo.py"),
                    str(destino), "48"], check=True, capture_output=True)
    return destino if destino.exists() else destino.with_suffix(".avi")


def test_saude(cliente):
    r = cliente.get("/api/saude")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_interface_web_responde(cliente):
    assert cliente.get("/").status_code == 200
    assert cliente.get("/static/app.js").status_code == 200
    assert cliente.get("/manifest.webmanifest").status_code == 200


def test_criar_editar_e_remover_estudo(cliente):
    corpo = {"nome": "Pesponto teste", "unidade": "Guaxupé", "setor": "Pesponto"}
    e = cliente.post("/api/estudos", json=corpo).json()
    assert e["id"].startswith("est_")

    e2 = cliente.put(f"/api/estudos/{e['id']}", json={"posto": "Máquina 3"}).json()
    assert e2["posto"] == "Máquina 3" and e2["nome"] == "Pesponto teste"

    rois = [{"nome": "saida", "pontos": [[0, 0], [1, 0], [1, 1]], "modo": "contador"}]
    assert len(cliente.put(f"/api/estudos/{e['id']}/rois", json=rois).json()["rois"]) == 1

    assert cliente.delete(f"/api/estudos/{e['id']}").status_code == 200
    assert cliente.get(f"/api/estudos/{e['id']}").status_code == 404


def test_captura_sobre_video_gera_medicao_e_csv(cliente, video):
    cfg = json.loads((RAIZ / "demo" / "estudo_demo.json").read_text(encoding="utf-8"))
    estudo = cliente.post("/api/estudos", json=cfg).json()
    eid = estudo["id"]

    r = cliente.post(f"/api/estudos/{eid}/iniciar", json={"fonte": f"arquivo:{video}"})
    assert r.status_code == 200 and r.json()["status"] == "capturando"

    limite = time.time() + 120
    while time.time() < limite:
        if not cliente.get(f"/api/estudos/{eid}/resumo").json()["rodando"]:
            break
        time.sleep(0.5)

    final = cliente.post(f"/api/estudos/{eid}/parar").json()
    analise = final["analise"]
    # 48 s de video, ciclo de 12 s -> 4 ativacoes -> 3 ciclos completos
    assert analise["ciclos"]["n"] == 3
    assert abs(analise["ciclos"]["media"] - 12.0) < 0.3
    assert final["medicao_id"]

    csv = cliente.get(f"/api/medicoes/{final['medicao_id']}/export.csv")
    assert csv.status_code == 200
    assert "elemento_duracao_s" in csv.text
    assert "pespontar" in csv.text


def test_cronometro_manual_pela_api(cliente):
    estudo = cliente.post("/api/estudos", json={"nome": "Manual", "fonte": "navegador"}).json()
    eid = estudo["id"]
    cliente.post(f"/api/estudos/{eid}/iniciar", json={"fonte": "navegador"})

    # sem camera, so as marcacoes do analista
    for elemento in ["preparar", "costurar", "conferir"]:
        r = cliente.post(f"/api/estudos/{eid}/marcar", json={"elemento": elemento})
        assert r.status_code == 200
        time.sleep(0.3)
    cliente.post(f"/api/estudos/{eid}/marcar", json={"elemento": "", "fechar_ciclo": True})

    final = cliente.post(f"/api/estudos/{eid}/parar").json()
    elementos = {e["elemento"] for e in final["analise"]["elementos"]}
    assert {"preparar", "costurar"} <= elementos


def test_captura_inexistente_retorna_404(cliente):
    assert cliente.get("/api/estudos/est_naoexiste/resumo").status_code == 404
