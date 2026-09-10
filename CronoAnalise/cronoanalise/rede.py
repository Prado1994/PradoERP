"""Descoberta de endereco na rede local - para achar o servidor pelo celular."""

from __future__ import annotations

import ipaddress
import socket


def ips_locais() -> list[str]:
    """IPs IPv4 desta maquina na rede, do mais provavel para o menos.

    O truque do socket UDP nao envia pacote nenhum: so pergunta ao sistema
    qual interface ele usaria para sair - que e justamente a do Wi-Fi da fabrica.
    """
    encontrados: list[str] = []

    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        encontrados.append(s.getsockname()[0])
    except OSError:
        pass
    finally:
        s.close()

    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in encontrados:
                encontrados.append(ip)
    except OSError:
        pass

    validos = []
    for ip in encontrados:
        try:
            end = ipaddress.IPv4Address(ip)
        except ValueError:
            continue
        if end.is_loopback or end.is_link_local:
            continue
        validos.append(ip)
    return validos or ["127.0.0.1"]


def urls_de_acesso(porta: int, https: bool) -> list[str]:
    esquema = "https" if https else "http"
    return [f"{esquema}://{ip}:{porta}" for ip in ips_locais()]


def qr_svg(texto: str, tamanho: int = 240) -> str | None:
    """QR code em SVG (string) para o celular so apontar a camera.

    Depende do pacote opcional `qrcode`. Sem ele, a interface mostra so a URL.
    """
    try:
        import qrcode
        import qrcode.image.svg
    except ImportError:
        return None
    img = qrcode.make(texto, image_factory=qrcode.image.svg.SvgPathImage,
                      box_size=10, border=2)
    import io
    buf = io.BytesIO()
    img.save(buf)
    svg = buf.getvalue().decode("utf-8")
    # o SVG do pacote vem com largura em mm; troca por px para caber no card
    svg = svg.replace('<svg ', f'<svg width="{tamanho}" height="{tamanho}" ', 1)
    return svg
