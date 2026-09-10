"""Fontes de video.

O mesmo estudo roda com qualquer entrada:

    navegador          celular na mao, frames chegam por WebSocket
    webcam:0           webcam USB ligada no PC do posto
    rtsp://user:sen@ip/stream1   camera de CFTV (Intelbras, Hikvision, TP-Link...)
    http://ip/video.mjpg         camera IP em MJPEG
    arquivo:/caminho/video.mp4   video ja gravado (analise em lote, mais rapido)
"""

from __future__ import annotations

import queue
import time
from dataclasses import dataclass
from typing import Any


@dataclass
class Frame:
    imagem: Any      # np.ndarray BGR
    ts: float        # segundos desde o inicio da captura
    indice: int


class FonteVideo:
    def abrir(self) -> None: ...
    def ler(self) -> Frame | None: ...
    def fechar(self) -> None: ...
    @property
    def ao_vivo(self) -> bool: return True


class FonteOpenCV(FonteVideo):
    """Webcam, RTSP/CFTV, MJPEG ou arquivo de video."""

    def __init__(self, destino: str, largura_max: int = 960, fps_alvo: float = 12.0):
        self.destino = destino
        self.largura_max = largura_max
        self.fps_alvo = fps_alvo
        self.cap = None
        self._t0 = 0.0
        self._indice = 0
        self._fps_arquivo = 0.0
        self._arquivo = False
        self._ultimo_ts_real = 0.0

    def _alvo(self):
        d = self.destino
        if d.startswith("webcam:"):
            return int(d.split(":", 1)[1] or 0)
        if d.startswith("arquivo:"):
            self._arquivo = True
            return d.split(":", 1)[1]
        if "://" in d:
            return d
        self._arquivo = True
        return d

    def abrir(self) -> None:
        import cv2

        alvo = self._alvo()
        self.cap = cv2.VideoCapture(alvo)
        if isinstance(alvo, str) and alvo.startswith("rtsp"):
            # buffer curto: em CFTV, atraso acumulado estraga a medicao
            try:
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            except Exception:
                pass
        if not self.cap.isOpened():
            raise RuntimeError(f"Nao consegui abrir a fonte de video: {self.destino}")
        if self._arquivo:
            self._fps_arquivo = float(self.cap.get(cv2.CAP_PROP_FPS) or 0.0)
        self._t0 = time.monotonic()
        self._indice = 0

    def ler(self) -> Frame | None:
        import cv2

        if self.cap is None:
            return None
        ok, img = self.cap.read()
        if not ok or img is None:
            return None
        self._indice += 1

        if self._arquivo and self._fps_arquivo > 0:
            # tempo do proprio video: analise em lote nao depende da velocidade do PC
            ts = self._indice / self._fps_arquivo
        else:
            ts = time.monotonic() - self._t0
            # descarta frames alem do fps alvo, para nao gastar CPU a toa
            intervalo = 1.0 / self.fps_alvo if self.fps_alvo > 0 else 0.0
            if intervalo and (ts - self._ultimo_ts_real) < intervalo:
                return Frame(imagem=None, ts=ts, indice=self._indice)
            self._ultimo_ts_real = ts

        h, w = img.shape[:2]
        if w > self.largura_max:
            escala = self.largura_max / float(w)
            img = cv2.resize(img, (self.largura_max, int(h * escala)),
                             interpolation=cv2.INTER_AREA)
        return Frame(imagem=img, ts=ts, indice=self._indice)

    def fechar(self) -> None:
        if self.cap is not None:
            self.cap.release()
            self.cap = None

    @property
    def ao_vivo(self) -> bool:
        return not self._arquivo


class FonteNavegador(FonteVideo):
    """Frames enviados pelo celular/navegador via WebSocket.

    O navegador manda JPEG ja reduzido (padrao 640 px, ~10 fps), o que cabe
    tranquilo no Wi-Fi da fabrica e no 4G.
    """

    def __init__(self, tamanho_fila: int = 4):
        self.fila: queue.Queue[tuple[bytes, float]] = queue.Queue(maxsize=tamanho_fila)
        self._t0: float | None = None
        self._indice = 0
        self._ativa = True

    def abrir(self) -> None:
        self._t0 = None
        self._indice = 0
        self._ativa = True

    def enviar(self, jpeg: bytes) -> None:
        """Chamado pelo WebSocket. Descarta o mais antigo se a fila encher."""
        if not self._ativa:
            return
        if self.fila.full():
            try:
                self.fila.get_nowait()
            except queue.Empty:
                pass
        try:
            self.fila.put_nowait((jpeg, time.monotonic()))
        except queue.Full:
            pass

    def ler(self) -> Frame | None:
        import cv2
        import numpy as np

        try:
            jpeg, chegada = self.fila.get(timeout=1.0)
        except queue.Empty:
            return Frame(imagem=None, ts=0.0, indice=self._indice) if self._ativa else None
        if self._t0 is None:
            self._t0 = chegada
        img = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            return Frame(imagem=None, ts=chegada - self._t0, indice=self._indice)
        self._indice += 1
        return Frame(imagem=img, ts=chegada - self._t0, indice=self._indice)

    def fechar(self) -> None:
        self._ativa = False


def criar_fonte(destino: str, **kwargs) -> FonteVideo:
    if not destino or destino == "navegador":
        return FonteNavegador()
    return FonteOpenCV(destino, **kwargs)
