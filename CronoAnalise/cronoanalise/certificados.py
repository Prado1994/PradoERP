"""Certificado HTTPS local - o que destrava a camera do celular.

Navegador so libera `getUserMedia` (a camera) em contexto seguro: HTTPS ou
localhost. Numa rede de fabrica, sem dominio e sem internet, a saida e um
certificado autoassinado gerado aqui mesmo, valido para os IPs desta maquina.

O celular vai mostrar um aviso de "conexao nao privada" na primeira vez.
E esperado: e o proprio servidor da fabrica, nao um site desconhecido.
Toque em Avancado -> Prosseguir e o aviso nao volta mais naquele aparelho.
"""

from __future__ import annotations

import datetime as dt
import ipaddress
import subprocess
from pathlib import Path

from .rede import ips_locais

VALIDADE_DIAS = 825  # limite aceito pelos navegadores para certificado local


def _com_cryptography(cert: Path, chave: Path, ips: list[str]) -> bool:
    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.x509.oid import NameOID
    except ImportError:
        return False

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    nome = x509.Name([
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Grupo Prado"),
        x509.NameAttribute(NameOID.COMMON_NAME, "Cronoanalise Prado"),
    ])
    alternativos: list[x509.GeneralName] = [
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
    ]
    for ip in ips:
        try:
            alternativos.append(x509.IPAddress(ipaddress.IPv4Address(ip)))
        except ValueError:
            continue

    agora = dt.datetime.now(dt.timezone.utc)
    certificado = (
        x509.CertificateBuilder()
        .subject_name(nome)
        .issuer_name(nome)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(agora - dt.timedelta(days=1))
        .not_valid_after(agora + dt.timedelta(days=VALIDADE_DIAS))
        .add_extension(x509.SubjectAlternativeName(alternativos), critical=False)
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )

    chave.write_bytes(key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()))
    cert.write_bytes(certificado.public_bytes(serialization.Encoding.PEM))
    chave.chmod(0o600)
    return True


def _com_openssl(cert: Path, chave: Path, ips: list[str]) -> bool:
    san = ",".join(["DNS:localhost", "IP:127.0.0.1"] + [f"IP:{ip}" for ip in ips])
    try:
        subprocess.run(
            ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
             "-keyout", str(chave), "-out", str(cert), "-days", str(VALIDADE_DIAS),
             "-subj", "/O=Grupo Prado/CN=Cronoanalise Prado",
             "-addext", f"subjectAltName={san}"],
            check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError):
        return False
    chave.chmod(0o600)
    return True


def garantir_certificado(destino: str | Path = "certificados",
                         forcar: bool = False) -> tuple[Path, Path]:
    """Devolve (cert.pem, chave.pem), gerando na primeira vez.

    O certificado e refeito quando o IP da maquina muda - senao o celular
    reclama de nome invalido depois que o DHCP troca o endereco.
    """
    pasta = Path(destino)
    pasta.mkdir(parents=True, exist_ok=True)
    cert, chave = pasta / "cert.pem", pasta / "chave.pem"
    ips = ips_locais()
    marca = pasta / "ips.txt"
    mudou = marca.read_text(encoding="utf-8").split() != ips if marca.exists() else True

    if forcar or mudou or not (cert.exists() and chave.exists()):
        if not _com_cryptography(cert, chave, ips) and not _com_openssl(cert, chave, ips):
            raise RuntimeError(
                "Nao consegui gerar o certificado HTTPS. Instale uma das opcoes:\n"
                "    pip install cryptography      (recomendado)\n"
                "    apt install openssl")
        marca.write_text("\n".join(ips), encoding="utf-8")
    return cert, chave
