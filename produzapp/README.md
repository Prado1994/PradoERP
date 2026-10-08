# produzapp

Gestão de produção do **Grupo Prado** (Safety Prado e Country Prado): ordens de produção, leitura por etapa
no chão de fábrica, prazos e uma **API própria** para conectar **Bling** e **Odoo**.

> Repositório **privado**. Nunca versionar chaves, tokens ou dados de clientes.

## Por que existe

A migração Softpool → Odoo travou por tentar recriar o Softpool dentro do Odoo, e o módulo de Ordens de Produção
do Bling depende de ativação no plano. O produzapp assume o que é **específico da nossa fábrica** (OP por caixa,
7 etapas, leitura por código de barras, prazos) e deixa cada sistema fazer o que faz melhor:

| Dado | Dono | produzapp |
|---|---|---|
| OP, caixa, etapas, leituras, paradas, previsões | **produzapp** | grava e expõe pela API |
| Cadastro de produto, lista de materiais, custo | **Odoo** | só lê |
| Estoque físico, NF-e, financeiro, pedidos de venda | **Bling** | lê e envia baixa/entrada |

## O fluxo (7 etapas)

`1 Corte (COR)` → `2 Pesponto (PES)` → `3 Esteira de Montagem (EST)` → `4 Injetora (INJ)` →
`5 Esteira de Acabamento (ACA)` → `6 Embalagem (EMB)` → `7 Expedição (EXP)`

Código de barras da ficha A6: **`OP-CAIXA-SIGLA`**, ex.: `00101-01-COR`.
Paradas: `PARADA-PES-QUEBRA-AGULHA` / `RETOMA-PES`.

## Estado atual (fase 1 — núcleo)

- [x] Regras de leitura: sequência, repetição, setor errado, leitura colada, idempotência
- [x] Prazos: previsão inicial × atual, atraso, dias de produção, prazo médio, indicadores
- [x] API REST com chave por cliente (ver `openapi.yaml`)
- [x] Fila de sincronização com reenvio e espera progressiva (Bling/Odoo **simulados**)
- [x] 33 testes automatizados
- [ ] Persistência PostgreSQL (esquema pronto em `db/migrations`; repositório na fase 2)
- [ ] Estação e acompanhamento ligados à API (protótipo em `web/prototipo`)
- [ ] Conector Bling (fase 3) · Conector Odoo (fase 4)

Roadmap completo: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Como rodar

```bash
npm install
cp .env.example .env        # defina API_KEYS
npm test                    # 33 testes
npm run typecheck
SEED=1 API_KEYS=minha-chave npm start   # sobe em http://localhost:3000 com OPs de demonstração
```

```bash
curl -H "x-api-key: minha-chave" localhost:3000/indicadores
curl -X POST -H "x-api-key: minha-chave" -H "content-type: application/json" \
     -d '{"codigo":"00101-01-COR","estacao":"COR"}' localhost:3000/leituras
```

## Estrutura

```
src/dominio/        regras de negócio puras (etapas, leitura, prazos, previsão) — sem rede, sem banco
src/repositorio/    contrato de persistência + versão em memória
src/integracoes/    contrato Destino (Bling, Odoo) + simulados
src/api/            servidor Fastify
src/sincronizacao.ts  fila de envio com reenvio
db/migrations/      esquema PostgreSQL
docs/               arquitetura, modelo de dados, decisões, integrações, piloto, roadmap
web/prototipo/      protótipo navegável da estação e do acompanhamento (dados simulados)
openapi.yaml        contrato da API
CLAUDE.md           contexto para continuar o desenvolvimento com o Claude Code
```

## Documentação

[Arquitetura](docs/ARQUITETURA.md) · [Modelo de dados](docs/MODELO-DE-DADOS.md) · [Decisões](docs/DECISOES.md) ·
[Integração Bling](docs/INTEGRACAO-BLING.md) · [Integração Odoo](docs/INTEGRACAO-ODOO.md) ·
[Piloto 40501](docs/PILOTO-40501.md) · [Roadmap](docs/ROADMAP.md)
