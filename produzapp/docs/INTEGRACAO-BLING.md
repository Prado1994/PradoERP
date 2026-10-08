# Integração com o Bling

Papel do Bling: **estoque físico, fiscal (NF-e), financeiro e pedidos de venda**. O produzapp não depende
do Bling para produzir; ele só recebe os marcos da OP e fornece dados comerciais.

## O que o produzapp envia (fila `destino = bling`)

| Evento | Quando | Efeito desejado no Bling |
|---|---|---|
| `op.iniciada` | primeira leitura da caixa (Corte) | OP "em andamento" |
| `op.concluida` | leitura de Expedição | OP concluída; baixa de insumos e entrada do produto acabado |

## O que o produzapp lê

- Pedidos de venda e cliente (para preencher cliente da OP)
- Saldo de estoque de insumos e de produto acabado

## O que se sabe (documentação pública da API v3)

- Existem os recursos `/ordens-producao` (listar, consultar, criar, alterar), `/ordens-producao/gerar-sob-demanda`
  e `/ordens-producao/{id}/situacoes` (atualizar situação).
- O módulo de produção, quando ativo, lança estoque ao finalizar a OP: componentes saem como insumo e o produto
  produzido entra.

## A validar (só possível com o módulo ativo na conta)

1. Quais situações a OP tem e se é possível criar situações próprias.
2. Se há webhook (notificação por evento) para OP; se não houver, o caminho é consulta periódica.
3. Limites de requisições por segundo/dia.
4. Se o Bling aceita número de OP definido por nós ou gera sozinho (define o código de barras da ficha).
5. Campos livres (plano, cliente, observação) e depósito/lote na finalização.
6. Se o plano da conta inclui o módulo ou se tem custo adicional.
7. Se a conclusão parcial é aceita pela API.

> **Estado em 08/10/2026:** na conta Bling de Itanhandu o módulo de Ordens de Produção **não aparece** na
> consulta de módulos (só Vendas e Pedidos de Compra). Ativação é pela interface web do Bling.

## Teste de viabilidade (primeiro dia após ativar o módulo)

1. Criar uma OP de teste do 40501 (variante 33, 1 caixa).
2. Ler a OP pela API e anotar os campos retornados.
3. Mudar a situação pela API e conferir no painel.
4. Finalizar a OP e conferir a movimentação de estoque (insumos e produto acabado).
5. Anotar o limite de requisições e testar a consulta de 100 OPs.

## Entrada: pedidos de venda → caixa de entrada (implementado em 08/10/2026)

Decisões do Wesley: (1) o pedido **não** vira OP sozinho — cai numa **caixa de entrada** e o PCP programa conforme capacidade,
matrizes, formas e outras peculiaridades; (2) a **previsão inicial é preenchida pelo PCP** (campo manual; automatizar no futuro);
(3) entram **somente pedidos de venda**; (4) o **código do modelo vem do cadastro de produto do Bling**.

Fluxo: Bling → (webhook `POST /webhooks/bling` + conferência a cada 5 min + botão "Sincronizar") → `pedidos_entrada` (status `a_programar`)
→ tela **Pedidos** (`web/pedidos.html`) → PCP informa pares por caixa, previsão inicial, nº da OP (opcional) e observação → `POST /pedidos/:id/programar`
cria as OPs (uma por caixa) ligadas ao pedido (`ordens.pedido_id`) e imprime as fichas.

Regras:
- Itens do Bling vêm **um por tamanho**; o produzapp soma por modelo e mostra a grade (tamanho: pares).
- Modelo = código do item/cadastro (ex.: `45501-40` → `45501`; `ST45501` → `ST45501`). Item sem código no pedido → consulta o produto
  (`GET /produtos/{id}`, uma vez por produto). Sem código nenhum → modelo lido do começo da descrição, marcado **"lido da descrição"**.
  Sem nada → **sem código**: o pedido não pode ser programado até corrigir o cadastro e sincronizar.
- Entram as situações de `BLING_SITUACOES_IMPORTAR` (padrão **6 = Em aberto**); `BLING_SITUACOES_CANCELADO` (padrão **12 = Cancelado**).
  Os IDs são **da conta** (Itanhandu): conferir em Guaxupé/outras contas.
- Reenviar o mesmo pedido nunca duplica nem desfaz a decisão do PCP. Pedido **cancelado antes de programar** sai da fila;
  **depois de programar** só gera alerta (as OPs não são mexidas). Quantidade alterada depois de programado também gera alerta.
- Convenção de código a combinar com quem cadastra: o modelo precisa ser o **começo** do código (4–6 dígitos, prefixo de até 3 letras),
  separado do tamanho por `-`, `.`, `/`, `_` ou espaço. Ex.: `45501-40`. Código colado (`4550140`) é ambíguo e será lido errado.

Configuração (tudo no servidor, nunca no navegador): `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`; autorizar uma vez com `npm run bling:autorizar`
(os tokens ficam na tabela `integracao_tokens` e se renovam sozinhos, gravando sempre o refresh token novo).

**Não testado contra o Bling real** (só com respostas simuladas no formato real do pedido #43 de Itanhandu): troca de código por token,
formato exato do webhook e do cabeçalho de assinatura (`X-Bling-Signature-256`, HMAC-SHA256 do corpo com o client secret), limites de requisição.
Primeiro teste real: autorizar, clicar em **Sincronizar** e comparar com a lista do Bling.
Observação: as contas têm pouco volume de pedidos de cliente e os mais recentes de Itanhandu são transferências canceladas para Mogi Guaçu.

## Implementação (fase 3)

- `src/integracoes/bling.ts` implementando `Destino`.
- OAuth2 com renovação automática do token (o refresh token é rotacionado a cada uso: gravar o novo sempre).
- Respeitar o limite de requisições: enviar em fila, nunca em rajada.
- Se o módulo de OP do Bling não for ativado, o conector envia só **movimentação de estoque**
  (saída de insumos e entrada de produto acabado) e a OP existe apenas no produzapp.
