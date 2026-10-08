# Decisões de projeto

Registro curto de decisões (o quê, por quê). Alterar uma decisão = novo item, sem apagar o antigo.

| # | Decisão | Motivo |
|---|---|---|
| 1 | **O produzapp é dono da produção**; Bling e Odoo são conectados | O módulo de OP do Bling depende de ativação no plano e o Odoo nativo exigia dois toques por ficha; a produção não pode parar por causa de um sistema externo |
| 2 | **Odoo é dono do cadastro** (produto, lista de materiais, custo); o app só lê | Evitar dois cadastros divergentes |
| 3 | **Bling é dono de estoque, fiscal e pedidos de venda** | Já é o sistema fiscal e financeiro |
| 4 | **7 etapas**: Corte, Pesponto, Esteira de Montagem, Injetora, Esteira de Acabamento, Embalagem, Expedição | Definição da operação (out/2026). Aviamento deixou de ser etapa própria |
| 5 | **Uma OP por caixa** | "Concluir" significa "esta caixa terminou nesta etapa"; evita produção parcial |
| 6 | **Código `OP-CAIXA-SIGLA`** | Uma leitura só identifica caixa e etapa; ficha reimpressa no padrão A6 |
| 7 | **Sequência estrita por padrão** (configurável) | Ler Embalagem sem ter lido Pesponto é erro de chão de fábrica; antes, com Corte e Aviamento em paralelo, não valia |
| 8 | **Atraso contra a previsão inicial** | Reprogramar não pode esconder que o compromisso foi perdido; a previsão atual aparece ao lado |
| 9 | **Eventos imutáveis** | Rastreabilidade (ISO) e possibilidade de reconstruir qualquer OP |
| 10 | **Gravar primeiro, sincronizar depois** | O operador nunca depende do Bling/Odoo |
| 11 | **Adaptador `Destino` por sistema externo** | Quando o Odoo assumir mais coisas, troca-se o adaptador, não o núcleo |
| 12 | **TypeScript + Fastify + PostgreSQL**, na VPS da empresa | Já existe a VPS (nginx/HTTPS); stack pequena e testável |
| 13 | **"Concluída" no Bling = leitura de Expedição** | Só então o par saiu da fábrica; é quando o estoque de produto acabado entra |

## Pendentes de decisão

- Aviamento: dentro do Corte ou controlado à parte?
- Expedição: leitura por caixa de produção ou por volume de despacho?
- Estorno de leitura errada: quem autoriza e como fica registrado (hoje não há estorno).
- Operador por crachá: quando e com qual identificação.
