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

## Implementação (fase 3)

- `src/integracoes/bling.ts` implementando `Destino`.
- OAuth2 com renovação automática do token (o refresh token é rotacionado a cada uso: gravar o novo sempre).
- Respeitar o limite de requisições: enviar em fila, nunca em rajada.
- Se o módulo de OP do Bling não for ativado, o conector envia só **movimentação de estoque**
  (saída de insumos e entrada de produto acabado) e a OP existe apenas no produzapp.
