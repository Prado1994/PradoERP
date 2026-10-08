# Modelo de dados

Esquema SQL em `db/migrations/001_init.sql`. Tipos TypeScript em `src/dominio/tipos.ts`.

| Tabela | Conteúdo | Regra importante |
|---|---|---|
| `ordens` | Uma OP = uma caixa (10–20 pares): `op`, `caixa`, cliente, produto, pares, `entrada`, `previsao_inicial`, `previsao_atual` | `(op, caixa)` único; `previsao_inicial` nunca muda |
| `previsoes` | Histórico de reprogramações (de, para, motivo, quando) | motivo obrigatório |
| `eventos_etapa` | Cada leitura válida de etapa: ordem, sigla, quando, estação, operador, `id_leitura`, `colado` | **somente inclusão** (gatilho bloqueia UPDATE/DELETE); `(ordem_id, sigla)` único |
| `leituras` | Resultado de cada leitura (idempotência) | `id_leitura` único |
| `paradas` | Parada por etapa: motivo, início, fim | uma aberta por etapa |
| `fila_sincronizacao` | Itens a enviar a Bling/Odoo: destino, tipo, payload, tentativas, próxima tentativa, status | status `pendente`/`enviado`/`falha` |
| `clientes_api` | Chaves de API (hash, nunca em texto) | uma por cliente |

## Derivados (não gravados)

Calculados a partir dos eventos, para nunca divergir: etapa atual, etapas concluídas, situação do prazo
(`no_prazo`, `em_risco`, `atrasada`, `concluida`), atraso em dias, dias de produção, prazo médio.

## Definições

- **Atraso** = dias entre a **previsão inicial** e hoje (aberta) ou a expedição (concluída).
- **Em risco** = faltam até 2 dias para a previsão inicial e a caixa ainda não passou da etapa 5.
- **Dias de produção** = da data de entrada até hoje (aberta) ou até a leitura de EXP (concluída).
- **Prazo médio de produção** = média dos dias de produção das OPs concluídas.
