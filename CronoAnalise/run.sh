#!/usr/bin/env bash
# Sobe o Cronoanálise Prado.
#
#   ./run.sh                 HTTP  na porta 8000
#   ./run.sh --https         HTTPS na porta 8443  (libera a câmera do celular)
#   ./run.sh --https 9000    HTTPS em outra porta
set -euo pipefail
cd "$(dirname "$0")"

HTTPS=0
PORTA=""
for arg in "$@"; do
  case "$arg" in
    --https) HTTPS=1 ;;
    --http)  HTTPS=0 ;;
    *[!0-9]*) echo "Argumento desconhecido: $arg"; exit 1 ;;
    *) PORTA="$arg" ;;
  esac
done
[ -z "$PORTA" ] && { [ "$HTTPS" = "1" ] && PORTA=8443 || PORTA=8000; }

if [ ! -d .venv ]; then
  echo "→ Criando ambiente virtual..."
  python3 -m venv .venv
  ./.venv/bin/pip install --upgrade pip -q
  ./.venv/bin/pip install -r requirements.txt
fi

IP=$(./.venv/bin/python -c "from cronoanalise.rede import ips_locais; print(ips_locais()[0])" 2>/dev/null || echo localhost)

if [ "$HTTPS" = "1" ]; then
  echo "→ Preparando certificado local..."
  ./.venv/bin/python -c "from cronoanalise.certificados import garantir_certificado as g; g()"
  echo ""
  echo "  Cronoanálise Prado no ar (HTTPS)"
  echo "  Neste computador : https://localhost:${PORTA}"
  echo "  No celular       : https://${IP}:${PORTA}/celular"
  echo ""
  echo "  O celular vai avisar 'conexão não privada' na primeira vez."
  echo "  É o próprio servidor da fábrica: Avançado → Prosseguir."
  echo "  Na tela do PC, o botão 'Abrir no celular' mostra o QR code."
  echo ""
  exec ./.venv/bin/uvicorn cronoanalise.api:app --host 0.0.0.0 --port "${PORTA}" \
       --ssl-keyfile certificados/chave.pem --ssl-certfile certificados/cert.pem
fi

echo ""
echo "  Cronoanálise Prado no ar (HTTP)"
echo "  Neste computador : http://localhost:${PORTA}"
echo "  No celular       : http://${IP}:${PORTA}/celular"
echo ""
echo "  Atenção: em HTTP o navegador do celular NÃO libera a câmera."
echo "  Para usar a câmera do celular, suba com:  ./run.sh --https"
echo ""
exec ./.venv/bin/uvicorn cronoanalise.api:app --host 0.0.0.0 --port "${PORTA}"
