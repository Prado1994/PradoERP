#!/usr/bin/env bash
# Gera o .env do servidor com senhas e chaves aleatórias. Rode NO SERVIDOR, na pasta do projeto:  ./scripts/gerar-env.sh
# Nada sai da máquina: as chaves não passam por chat nem por e-mail. Guarde-as no gerenciador de senhas.
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077

[ -e .env ] && { echo "Já existe um .env: nada foi alterado. Apague-o antes se quiser gerar de novo."; exit 1; }
command -v openssl >/dev/null || { echo "Precisa do openssl instalado."; exit 1; }

gerar() { openssl rand -hex 24; }                # 48 caracteres, 192 bits
ESTACOES=(corte pesponto montagem injetora acabamento embalagem expedicao pcp painel)

SENHA_BANCO=$(gerar)
LISTA=""; : > chaves.txt
for e in "${ESTACOES[@]}"; do
  k=$(gerar); LISTA="${LISTA:+$LISTA,}$k"
  printf '%-12s %s\n' "$e" "$k" >> chaves.txt
done

cat > .env <<ENV
DOMINIO=producao.pradocalcados.com.br
POSTGRES_PASSWORD=$SENHA_BANCO
API_KEYS=$LISTA
# Preencha com os dados do aplicativo do Bling (o segredo você copia da tela do Bling, direto para cá):
BLING_CLIENT_ID=
BLING_CLIENT_SECRET=
BLING_SITUACOES_IMPORTAR=6
BLING_SITUACOES_CANCELADO=12
ENV

echo "Pronto."
echo "  .env        -> usado pelo docker compose (permissão só do seu usuário)"
echo "  chaves.txt  -> uma chave por estação/tela. Digite cada uma UMA vez no navegador da estação, guarde no gerenciador de senhas e APAGUE o arquivo."
echo "  Senha do banco: está no .env (POSTGRES_PASSWORD). Ninguém precisa digitá-la."
echo "Falta preencher BLING_CLIENT_ID e BLING_CLIENT_SECRET no .env."
