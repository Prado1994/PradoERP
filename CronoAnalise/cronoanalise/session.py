"""Sessao de captura: liga fonte de video -> detector -> motor de ciclos.

Roda em thread propria para nao travar a API. Publica eventos em tempo real
(inicio/fim de elemento, peca contada, ciclo fechado) e mantem o ultimo frame
anotado para o preview MJPEG.
"""

from __future__ import annotations

import asyncio
import threading
import time
from typing import Any

from . import stats
from .cycle_engine import MotorCiclos
from .detectors import criar_detector
from .models import Estudo
from .sources import FonteNavegador, criar_fonte


class Sessao:
    def __init__(self, estudo: Estudo, detector: str = "auto",
                 loop: asyncio.AbstractEventLoop | None = None):
        self.estudo = estudo
        self.tipo_detector = detector
        self.loop = loop
        self.fonte = criar_fonte(estudo.fonte)
        self.detector = criar_detector(estudo.rois, detector)
        self.motor = MotorCiclos(estudo.rois, on_evento=self._publicar)
        self.eventos: list[dict[str, Any]] = []
        self.assinantes: set[asyncio.Queue] = set()
        self.rodando = False
        self.erro: str | None = None
        self.iniciada_em: float | None = None
        self.finalizada_em: float | None = None
        self._thread: threading.Thread | None = None
        self._ultimo_jpeg: bytes | None = None
        self._lock = threading.Lock()
        self._ultimo_resultado = None
        self._t0_monotonico: float | None = None

    # ------------------------------------------------------------------ #
    @property
    def eh_navegador(self) -> bool:
        return isinstance(self.fonte, FonteNavegador)

    def enviar_frame(self, jpeg: bytes) -> None:
        if isinstance(self.fonte, FonteNavegador):
            self.fonte.enviar(jpeg)

    def _publicar(self, evento: dict[str, Any]) -> None:
        evento.setdefault("t", round(self.motor.duracao_captura, 3))
        self.eventos.append(evento)
        if len(self.eventos) > 5000:
            del self.eventos[:1000]
        if self.loop is None:
            return
        for fila in list(self.assinantes):
            try:
                self.loop.call_soon_threadsafe(fila.put_nowait, evento)
            except RuntimeError:
                pass

    # ------------------------------------------------------------------ #
    def iniciar(self) -> None:
        if self.rodando:
            return
        # Relogio de parede da sessao: e ele que datamos as marcacoes manuais.
        # Sem isso, um estudo feito so no cronometro (sem camera) nao teria
        # nenhuma referencia de tempo - o motor so avanca com frame chegando.
        self._t0_monotonico = time.monotonic()
        self.fonte.abrir()
        self.rodando = True
        self.erro = None
        self.iniciada_em = time.time()
        self.finalizada_em = None
        self._thread = threading.Thread(target=self._loop_captura, daemon=True,
                                        name=f"captura-{self.estudo.id}")
        self._thread.start()
        self._publicar({"tipo": "captura_iniciada", "fonte": self.estudo.fonte,
                        "detector": self.tipo_detector})

    def _loop_captura(self) -> None:
        import cv2

        vazios = 0
        try:
            while self.rodando:
                frame = self.fonte.ler()
                if frame is None:
                    if self.fonte.ao_vivo:
                        vazios += 1
                        if vazios > 50:
                            self.erro = "Fonte de video parou de responder."
                            break
                        time.sleep(0.05)
                        continue
                    break  # fim do arquivo de video
                if frame.imagem is None:
                    time.sleep(0.005)
                    continue
                vazios = 0

                resultado = self.detector.processar(frame.imagem, frame.ts)
                self.motor.processar(resultado.atividade, frame.ts)
                self._ultimo_resultado = resultado

                anotado = self.detector.anotar(frame.imagem, resultado, self.motor.estado())
                ok, buf = cv2.imencode(".jpg", anotado, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
                if ok:
                    with self._lock:
                        self._ultimo_jpeg = buf.tobytes()
        except Exception as exc:  # captura nunca derruba a API
            self.erro = f"{type(exc).__name__}: {exc}"
        finally:
            self.rodando = False
            self.finalizada_em = time.time()
            self.motor.finalizar()
            self.fonte.fechar()
            self._publicar({"tipo": "captura_encerrada", "erro": self.erro,
                            "ciclos": len(self.motor.ciclos)})

    def parar(self) -> None:
        self.rodando = False
        if isinstance(self.fonte, FonteNavegador):
            self.fonte.fechar()
        if self._thread is not None:
            self._thread.join(timeout=3.0)
        self.motor.finalizar()

    # ------------------------------------------------------------------ #
    def marcar(self, elemento: str, fechar_ciclo: bool = False,
               ts: float | None = None) -> dict[str, Any]:
        """Marcacao manual (cronometro na mao) sincronizada com o video."""
        if ts is not None:
            quando = ts
        elif self.fonte.ao_vivo and self._t0_monotonico is not None:
            # ao vivo (celular, webcam, CFTV) o relogio de parede e a mesma
            # referencia dos frames, entao a marcacao cai no lugar certo
            quando = time.monotonic() - self._t0_monotonico
        else:
            # analise de arquivo gravado: vale o tempo do proprio video
            quando = self.motor.duracao_captura
        self.motor.marcar_manual(elemento, quando, fechar_ciclo=fechar_ciclo)
        return {"elemento": elemento, "t": round(quando, 3), "fechou_ciclo": fechar_ciclo}

    def redefinir_fundo(self) -> None:
        if hasattr(self.detector, "redefinir_fundo"):
            self.detector.redefinir_fundo()

    def frame_jpeg(self) -> bytes | None:
        with self._lock:
            return self._ultimo_jpeg

    def resumo(self) -> dict[str, Any]:
        analise = stats.analisar(list(self.motor.ciclos), self.estudo.parametros,
                                 self.motor.duracao_captura)
        return {
            "estudo": self.estudo.to_dict(),
            "rodando": self.rodando,
            "erro": self.erro,
            "estado": self.motor.estado(),
            "analise": analise,
            "ciclos": [c.to_dict() for c in self.motor.ciclos],
        }
