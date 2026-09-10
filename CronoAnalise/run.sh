#!/usr/bin/env bash
# Sobe o Cronoanálise Prado.  Uso:  ./run.sh [porta]
set -euo pipefail
cd "$(dirname "$0")"
PORTA="${1:-8000}"

if [ ! -d .venv ]; then
  echo "→ Criando ambiente virtual..."
  python3 -m venv .venv
  ./.venv/bin/pip install --upgrade pip -q
  ./.venv/bin/pip install -r requirements.txt
fi

IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
echo ""
echo "  Cronoanálise Prado no ar"
echo "  Neste computador : http://localhost:${PORTA}"
echo "  No celular       : http://${IP}:${PORTA}   (mesma rede Wi-Fi)"
echo ""
exec ./.venv/bin/uvicorn cronoanalise.api:app --host 0.0.0.0 --port "${PORTA}"
