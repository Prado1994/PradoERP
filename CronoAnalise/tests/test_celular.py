"""Testes do modulo do celular: pareamento, certificado e gravacao enviada.

O caminho critico e o modo "gravar e analisar": o aparelho grava em WebM
(Android) ou MP4 (iOS), envia o arquivo e o servidor mede em cima dele.
"""

import json
import subprocess
import sys
import time
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

cv2 = pytest.importorskip("cv2")
pytest.importorskip("fastapi")

from fastapi.testclient import TestClient  # noqa: E402

from cronoanalise import rede  # noqa: E402
from cronoanalise.certificados import garantir_certificado  # noqa: E402


@pytest.fixture(scope="module")
def cliente(tmp_path_factory):
    import importlib
    import os
    pasta = tmp_path_factory.mktemp("celular")
    os.environ["CRONO_DB"] = str(pasta / "teste.db")
    os.environ["CRONO_GRAVACOES"] = str(pasta / "gravacoes")
    from cronoanalise import api as modulo
    importlib.reload(modulo)
    with TestClient(modulo.app) as c:
        yield c


@pytest.fixture(scope="module")
def webm(tmp_path_factory):
    """Converte o video demo para WebM, como o celular Android entregaria."""
    origem = tmp_path_factory.mktemp("origem") / "posto.mp4"
    subprocess.run([sys.executable, str(RAIZ / "demo" / "gerar_video_demo.py"),
                    str(origem), "48"], check=True, capture_output=True)
    origem = origem if origem.exists() else origem.with_suffix(".avi")

    destino = origem.parent / "gravacao_celular.webm"
    entrada = cv2.VideoCapture(str(origem))
    fps = entrada.get(cv2.CAP_PROP_FPS) or 20.0
    largura = int(entrada.get(cv2.CAP_PROP_FRAME_WIDTH))
    altura = int(entrada.get(cv2.CAP_PROP_FRAME_HEIGHT))
    saida = cv2.VideoWriter(str(destino), cv2.VideoWriter_fourcc(*"VP80"),
                            fps, (largura, altura))
    if not saida.isOpened():
        entrada.release()
        pytest.skip("build do OpenCV sem suporte a escrita WebM")
    while True:
        ok, img = entrada.read()
        if not ok:
            break
        saida.write(img)
    entrada.release()
    saida.release()
    assert destino.stat().st_size > 0
    return destino


# ------------------------------------------------------------- pareamento
def test_pareamento_traz_url_da_rede_e_diagnostico(cliente):
    p = cliente.get("/api/celular/pareamento").json()
    assert p["urls"] and p["principal"].endswith("/celular")
    # TestClient fala HTTP, entao o app precisa avisar que a camera nao vai abrir
    assert p["contexto_seguro"] is False
    assert "HTTPS" in p["aviso"]


def test_pagina_do_celular_responde(cliente):
    assert cliente.get("/celular").status_code == 200
    assert cliente.get("/static/celular.js").status_code == 200
    assert cliente.get("/static/comum.js").status_code == 200


def test_qr_code_sai_como_svg():
    svg = rede.qr_svg("https://192.168.0.10:8443/celular")
    if svg is None:
        pytest.skip("pacote qrcode nao instalado")
    assert "<svg" in svg and "path" in svg


def test_ips_locais_nunca_vem_vazio():
    ips = rede.ips_locais()
    assert ips and all(len(ip.split(".")) == 4 for ip in ips)


# ------------------------------------------------------------ certificado
def test_certificado_cobre_os_ips_da_maquina(tmp_path):
    cert, chave = garantir_certificado(tmp_path / "certs")
    assert cert.exists() and chave.exists()
    texto = subprocess.run(["openssl", "x509", "-in", str(cert), "-noout", "-text"],
                           capture_output=True, text=True).stdout
    assert "DNS:localhost" in texto
    assert "IP Address:127.0.0.1" in texto
    for ip in rede.ips_locais():
        assert f"IP Address:{ip}" in texto
    # a segunda chamada reaproveita, nao regenera
    assert garantir_certificado(tmp_path / "certs")[0].read_bytes() == cert.read_bytes()


# -------------------------------------------------------------- gravacao
def _aguardar(cliente, job, limite=180):
    fim = time.time() + limite
    while time.time() < fim:
        st = cliente.get(f"/api/gravacoes/{job}").json()
        if st["status"] != "analisando":
            return st
        time.sleep(0.5)
    raise AssertionError("a analise da gravacao nao terminou a tempo")


def test_gravacao_do_celular_e_analisada_no_servidor(cliente, webm):
    cfg = json.loads((RAIZ / "demo" / "estudo_demo.json").read_text(encoding="utf-8"))
    cfg["nome"] = "Gravação do celular"
    eid = cliente.post("/api/estudos", json=cfg).json()["id"]

    with webm.open("rb") as fh:
        r = cliente.post(f"/api/estudos/{eid}/gravacao",
                         files={"arquivo": ("celular.webm", fh, "video/webm")})
    assert r.status_code == 200
    st = _aguardar(cliente, r.json()["job"])

    assert st["status"] == "concluida", st.get("erro")
    analise = st["analise"]
    # 48 s de video com ciclo de 12 s -> 3 ciclos completos
    assert analise["ciclos"]["n"] == 3
    assert abs(analise["ciclos"]["media"] - 12.0) < 0.3
    # ficou salvo como medicao do estudo, igual a uma captura ao vivo
    assert st["medicao_id"]
    assert cliente.get(f"/api/medicoes/{st['medicao_id']}/export.csv").status_code == 200


def test_marcacoes_feitas_durante_a_gravacao_entram_na_analise(cliente, webm):
    cfg = json.loads((RAIZ / "demo" / "estudo_demo.json").read_text(encoding="utf-8"))
    cfg["nome"] = "Gravação com marcações"
    eid = cliente.post("/api/estudos", json=cfg).json()["id"]

    # o analista tocou "conferir" enquanto gravava, em dois momentos
    marcacoes = [{"elemento": "conferir", "t": 5.0, "fechar_ciclo": False},
                 {"elemento": "", "t": 9.0, "fechar_ciclo": False},
                 {"elemento": "conferir", "t": 17.0, "fechar_ciclo": False},
                 {"elemento": "", "t": 21.0, "fechar_ciclo": False}]
    with webm.open("rb") as fh:
        r = cliente.post(f"/api/estudos/{eid}/gravacao",
                         files={"arquivo": ("celular.webm", fh, "video/webm")},
                         data={"marcacoes": json.dumps(marcacoes)})
    assert r.json()["marcacoes"] == 4
    st = _aguardar(cliente, r.json()["job"])
    assert st["status"] == "concluida", st.get("erro")

    nomes = {e["elemento"] for e in st["analise"]["elementos"]}
    assert "conferir" in nomes      # veio do dedo do analista
    assert "pespontar" in nomes     # veio da camera
    conferir = next(e for e in st["analise"]["elementos"] if e["elemento"] == "conferir")
    assert abs(conferir["media"] - 4.0) < 0.2   # 5→9 s e 17→21 s


def test_gravacao_sem_roi_e_recusada(cliente, webm):
    eid = cliente.post("/api/estudos", json={"nome": "Sem ROI"}).json()["id"]
    with webm.open("rb") as fh:
        r = cliente.post(f"/api/estudos/{eid}/gravacao",
                         files={"arquivo": ("celular.webm", fh, "video/webm")})
    assert r.status_code == 400
    assert "regi" in r.json()["detail"].lower()


def test_arquivo_vazio_e_recusado(cliente):
    cfg = json.loads((RAIZ / "demo" / "estudo_demo.json").read_text(encoding="utf-8"))
    eid = cliente.post("/api/estudos", json=cfg).json()["id"]
    r = cliente.post(f"/api/estudos/{eid}/gravacao",
                     files={"arquivo": ("vazio.webm", b"", "video/webm")})
    assert r.status_code == 400
