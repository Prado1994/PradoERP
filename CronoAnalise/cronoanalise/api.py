"""API do Cronoanalise Prado (FastAPI).

Sobe com:
    uvicorn cronoanalise.api:app --host 0.0.0.0 --port 8000

Abrir no celular:  http://<ip-do-pc>:8000/
"""

from __future__ import annotations

import asyncio
import csv
import io
import json
import os
import time
from pathlib import Path
from typing import Any

from contextlib import asynccontextmanager

from fastapi import Body, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import (FileResponse, HTMLResponse, JSONResponse,
                               StreamingResponse)
from fastapi.staticfiles import StaticFiles

from . import stats
from .models import Estudo, ROI
from .session import Sessao
from .storage import Banco

WEB = Path(__file__).parent / "web"
BANCO = Banco(os.environ.get("CRONO_DB", "cronoanalise.db"))

SESSOES: dict[str, Sessao] = {}


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    # A captura roda em thread propria e precisa publicar eventos no loop da API.
    # Os endpoints sincronos rodam no threadpool, onde nao existe loop corrente -
    # por isso a referencia e guardada aqui, no unico ponto que a tem.
    app.state.loop = asyncio.get_running_loop()
    yield
    for sessao in list(SESSOES.values()):
        sessao.parar()


app = FastAPI(title="Cronoanalise Prado", version="1.0.0",
              description="Estudo de tempos por visao computacional - Grupo Prado",
              lifespan=ciclo_de_vida)


def _sessao(estudo_id: str) -> Sessao:
    s = SESSOES.get(estudo_id)
    if s is None:
        raise HTTPException(404, "Nenhuma captura ativa para este estudo.")
    return s


# ---------------------------------------------------------------- estudos
@app.get("/api/estudos")
def listar_estudos() -> list[dict[str, Any]]:
    estudos = BANCO.listar_estudos()
    for e in estudos:
        s = SESSOES.get(e["id"])
        e["capturando"] = bool(s and s.rodando)
    return estudos


@app.post("/api/estudos")
def criar_estudo(dados: dict[str, Any] = Body(...)) -> dict[str, Any]:
    estudo = Estudo.from_dict(dados)
    BANCO.salvar_estudo(estudo)
    return estudo.to_dict()


@app.get("/api/estudos/{estudo_id}")
def obter_estudo(estudo_id: str) -> dict[str, Any]:
    estudo = BANCO.obter_estudo(estudo_id)
    if estudo is None:
        raise HTTPException(404, "Estudo nao encontrado.")
    d = estudo.to_dict()
    s = SESSOES.get(estudo_id)
    d["capturando"] = bool(s and s.rodando)
    d["medicoes"] = BANCO.listar_medicoes(estudo_id)
    return d


@app.put("/api/estudos/{estudo_id}")
def atualizar_estudo(estudo_id: str, dados: dict[str, Any] = Body(...)) -> dict[str, Any]:
    atual = BANCO.obter_estudo(estudo_id)
    if atual is None:
        raise HTTPException(404, "Estudo nao encontrado.")
    base = atual.to_dict()
    base.update(dados)
    base["id"] = estudo_id
    estudo = Estudo.from_dict(base)
    BANCO.salvar_estudo(estudo)
    return estudo.to_dict()


@app.delete("/api/estudos/{estudo_id}")
def remover_estudo(estudo_id: str) -> dict[str, str]:
    s = SESSOES.pop(estudo_id, None)
    if s is not None:
        s.parar()
    BANCO.remover_estudo(estudo_id)
    return {"status": "removido"}


@app.put("/api/estudos/{estudo_id}/rois")
def definir_rois(estudo_id: str, rois: list[dict[str, Any]] = Body(...)) -> dict[str, Any]:
    estudo = BANCO.obter_estudo(estudo_id)
    if estudo is None:
        raise HTTPException(404, "Estudo nao encontrado.")
    estudo.rois = [ROI.from_dict(r) for r in rois]
    BANCO.salvar_estudo(estudo)
    return estudo.to_dict()


# --------------------------------------------------------------- captura
@app.post("/api/estudos/{estudo_id}/iniciar")
def iniciar_captura(estudo_id: str, opcoes: dict[str, Any] = Body(default={})) -> dict[str, Any]:
    estudo = BANCO.obter_estudo(estudo_id)
    if estudo is None:
        raise HTTPException(404, "Estudo nao encontrado.")
    if opcoes.get("fonte"):
        estudo.fonte = opcoes["fonte"]
        BANCO.salvar_estudo(estudo)
    antiga = SESSOES.pop(estudo_id, None)
    if antiga is not None:
        antiga.parar()
    try:
        sessao = Sessao(estudo, detector=opcoes.get("detector", "auto"),
                        loop=getattr(app.state, "loop", None))
        sessao.iniciar()
    except Exception as exc:
        raise HTTPException(400, f"Nao consegui iniciar a captura: {exc}") from exc
    SESSOES[estudo_id] = sessao
    return {"status": "capturando", "fonte": estudo.fonte,
            "modo_navegador": sessao.eh_navegador}


@app.post("/api/estudos/{estudo_id}/parar")
def parar_captura(estudo_id: str, salvar: bool = True) -> dict[str, Any]:
    sessao = _sessao(estudo_id)
    sessao.parar()
    resumo = sessao.resumo()
    medicao_id = None
    if salvar and resumo["analise"]["ciclos"]["n"] > 0:
        medicao_id = BANCO.salvar_medicao(estudo_id, resumo, sessao.iniciada_em,
                                          sessao.finalizada_em or time.time())
    return {"status": "encerrada", "medicao_id": medicao_id, **resumo}


@app.post("/api/estudos/{estudo_id}/marcar")
def marcar(estudo_id: str, dados: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Cronometro manual: registra elemento/volta sincronizado com o video."""
    sessao = _sessao(estudo_id)
    return sessao.marcar(dados.get("elemento", ""), bool(dados.get("fechar_ciclo")))


@app.post("/api/estudos/{estudo_id}/fundo")
def redefinir_fundo(estudo_id: str) -> dict[str, str]:
    """Reaprende o fundo (chamar com o posto vazio, antes de comecar)."""
    _sessao(estudo_id).redefinir_fundo()
    return {"status": "fundo redefinido"}


@app.get("/api/estudos/{estudo_id}/resumo")
def resumo(estudo_id: str) -> dict[str, Any]:
    return _sessao(estudo_id).resumo()


@app.get("/api/estudos/{estudo_id}/preview.mjpg")
async def preview(estudo_id: str):
    """Preview anotado - use quando a camera esta no servidor (CFTV/webcam)."""
    sessao = _sessao(estudo_id)

    async def gerar():
        while sessao.rodando:
            quadro = sessao.frame_jpeg()
            if quadro:
                yield (b"--frame\r\nContent-Type: image/jpeg\r\n"
                       b"Content-Length: " + str(len(quadro)).encode() + b"\r\n\r\n"
                       + quadro + b"\r\n")
            await asyncio.sleep(0.08)

    return StreamingResponse(gerar(),
                             media_type="multipart/x-mixed-replace; boundary=frame")


# ------------------------------------------------------------- websockets
@app.websocket("/ws/estudos/{estudo_id}/frames")
async def ws_frames(ws: WebSocket, estudo_id: str) -> None:
    """Recebe os frames JPEG do celular e devolve o estado a cada frame."""
    await ws.accept()
    sessao = SESSOES.get(estudo_id)
    if sessao is None or not sessao.eh_navegador:
        await ws.close(code=1008, reason="Captura pelo navegador nao esta ativa.")
        return
    try:
        while True:
            dados = await ws.receive_bytes()
            sessao.enviar_frame(dados)
            await ws.send_text(json.dumps(sessao.motor.estado()))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


@app.websocket("/ws/estudos/{estudo_id}/eventos")
async def ws_eventos(ws: WebSocket, estudo_id: str) -> None:
    """Fluxo de eventos ao vivo: elemento, peca, ciclo."""
    await ws.accept()
    sessao = SESSOES.get(estudo_id)
    if sessao is None:
        await ws.close(code=1008, reason="Captura nao encontrada.")
        return
    fila: asyncio.Queue = asyncio.Queue()
    sessao.assinantes.add(fila)
    try:
        for e in sessao.eventos[-40:]:
            await ws.send_text(json.dumps(e, ensure_ascii=False))
        while True:
            evento = await fila.get()
            await ws.send_text(json.dumps(evento, ensure_ascii=False))
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        sessao.assinantes.discard(fila)


# ---------------------------------------------------------------- saidas
@app.get("/api/medicoes/{medicao_id}")
def obter_medicao(medicao_id: str) -> dict[str, Any]:
    m = BANCO.obter_medicao(medicao_id)
    if m is None:
        raise HTTPException(404, "Medicao nao encontrada.")
    return m


def _csv(linhas: list[list[Any]], nome: str) -> StreamingResponse:
    buf = io.StringIO()
    # ; e o separador que o Excel em portugues abre direto
    w = csv.writer(buf, delimiter=";")
    w.writerows(linhas)
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue().encode("utf-8-sig")]),
                             media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{nome}"'})


@app.get("/api/estudos/{estudo_id}/export.csv")
def exportar_csv(estudo_id: str) -> StreamingResponse:
    sessao = _sessao(estudo_id)
    return _csv(stats.linhas_csv(sessao.motor.ciclos), f"cronoanalise_{estudo_id}.csv")


@app.get("/api/medicoes/{medicao_id}/export.csv")
def exportar_medicao_csv(medicao_id: str) -> StreamingResponse:
    m = BANCO.obter_medicao(medicao_id)
    if m is None:
        raise HTTPException(404, "Medicao nao encontrada.")
    linhas: list[list[Any]] = [
        ["ciclo", "ciclo_valido", "ciclo_inicio_s", "ciclo_duracao_s", "elemento",
         "elemento_inicio_s", "elemento_fim_s", "elemento_duracao_s", "origem", "leitura_valida"]
    ]
    for c in m.get("ciclos", []):
        if not c.get("leituras"):
            linhas.append([c["numero"], c["valido"], c["inicio"], c["duracao"],
                           "", "", "", "", "", ""])
        for l in c.get("leituras", []):
            linhas.append([c["numero"], c["valido"], c["inicio"], c["duracao"],
                           l["elemento"], l["inicio"], l["fim"], l["duracao"],
                           l.get("origem", ""), l.get("valida", True)])
    return _csv(linhas, f"cronoanalise_{medicao_id}.csv")


@app.get("/api/saude")
def saude() -> dict[str, Any]:
    import cv2
    extras = {}
    for mod in ("ultralytics", "supervision", "mediapipe"):
        try:
            __import__(mod)
            extras[mod] = True
        except ImportError:
            extras[mod] = False
    return {"status": "ok", "opencv": cv2.__version__, "sessoes_ativas":
            len([s for s in SESSOES.values() if s.rodando]), "extras": extras}


# ------------------------------------------------------------------- web
if WEB.exists():
    app.mount("/static", StaticFiles(directory=str(WEB)), name="static")


@app.get("/", response_class=HTMLResponse)
def home() -> Any:
    indice = WEB / "index.html"
    if not indice.exists():
        return JSONResponse({"erro": "Interface web nao encontrada."}, status_code=500)
    return FileResponse(str(indice))


@app.get("/manifest.webmanifest")
def manifest() -> Any:
    return FileResponse(str(WEB / "manifest.webmanifest"),
                        media_type="application/manifest+json")
