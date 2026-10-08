# Roadmap

| Fase | Entrega | Situação |
|---|---|---|
| **0** | Contrato da API (`openapi.yaml`) e modelo de dados | ✅ pronto |
| **1** | Núcleo: leituras, etapas, prazos, previsões, fila, API, testes (repositório em memória, conectores simulados) | ✅ pronto |
| **2** | PostgreSQL (repositório real + migrações) · estação e acompanhamento ligados à API · piloto no 40501 | próximo |
| **3** | Conector Bling: movimentação de estoque e pedidos de venda; OP no Bling se o módulo for ativado | depende do teste de viabilidade |
| **4** | Conector Odoo: leitura de cadastro e lista de materiais; custo real | depois do cadastro estabilizar |
| **5** | Crachá/operador, estorno de leitura com autorização, prazo médio por etapa, paradas no painel | backlog |

## Backlog priorizado (fase 2)

1. Repositório PostgreSQL + migração `001_init.sql` aplicada
2. Estação (`web/`) chamando `POST /leituras` com `idLeitura` e fila local no navegador (se a rede cair)
3. Painel chamando `GET /ordens` e `GET /indicadores`
4. Criação de OPs em lote por plano (`POST /ordens/lote`)
5. Autenticação com chaves guardadas com hash (`clientes_api`)
6. Empacotamento: Dockerfile + nginx + HTTPS na VPS
