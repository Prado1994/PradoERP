#!/usr/bin/env bash
# Publica o projeto como repositório PRIVADO no GitHub.
# Uso:  ./scripts/publicar-github.sh [dono]      (ex.: ./scripts/publicar-github.sh minha-empresa)
# Requer: GitHub CLI (gh) instalado e autenticado (gh auth login).
set -euo pipefail

DONO="${1:-}"
NOME="produzapp"
ALVO="${DONO:+$DONO/}$NOME"

command -v gh >/dev/null || { echo "Instale o GitHub CLI: https://cli.github.com"; exit 1; }
gh auth status >/dev/null || { echo "Faça login primeiro: gh auth login"; exit 1; }

[ -d .git ] || { git init -b main; git add -A; git commit -m "feat: núcleo do produzapp (fase 1)"; }

gh repo create "$ALVO" --private --source=. --remote=origin --push \
  --description "Gestão de produção do Grupo Prado: OPs, etapas, prazos e API para Bling e Odoo"

echo "Pronto: repositório privado criado e enviado."
gh repo view "$ALVO" --web || true
