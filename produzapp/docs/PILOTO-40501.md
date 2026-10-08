# Piloto: modelo 40501

**Objetivo:** provar o fluxo ponta a ponta com **um modelo**, **uma semana**, **ficha de papel e Softpool
rodando em paralelo**, sem parar a fábrica.

## Escopo

- Produto: 40501 (16 variantes, 40501-33 a 40501-48)
- Uma OP por caixa, lançada pelo PCP
- 7 etapas, leitura em cada uma; estação com computador comum e leitor USB (sufixo Enter configurado)
- Acompanhamento em um painel para supervisão (Ana Clara) e PCP (Ana Beatriz)

## Antes de começar (pré-requisitos)

- [ ] Leitores configurados com Enter (CR) no final
- [ ] Estações com a etapa escolhida e rede estável no ponto da bancada
- [ ] Fichas A6 reimpressas com `OP-CAIXA-SIGLA`
- [ ] Banco PostgreSQL com backup diário
- [ ] Repositório privado e chaves de API geradas por cliente
- [ ] Decidir: aviamento (dentro do Corte?) e leitura de Expedição (caixa ou volume?)

## Critério de saída (combinar antes)

- 5 dias seguidos com **pares do app = pares da conferência manual**
- Nenhuma leitura perdida; divergência de sincronização com o Bling resolvida em até 1 dia
- Operadores sem necessidade de ajuda para ler (taxa de erro de leitura < 5%)

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Erro de operação (setor errado, caixa errada) | Tela antiburro; recusa por setor e por sequência |
| Leitor sem Enter | Detecção de leitura colada + aviso; configurar o leitor |
| Bling/Odoo fora do ar | Fila de envio com reenvio; produção segue |
| Volume de OPs (uma por caixa) pesa no PCP | Medir tempo de lançamento no piloto; avaliar criação em lote por plano |
| Resistência do time | Treinar primeiro a Ana Beatriz; um responsável por turno |

## Medir durante o piloto

Pares/dia por etapa, prazo médio de produção, atraso médio, leituras repetidas/erradas por etapa,
itens pendentes na fila, tempo de lançamento de OP pelo PCP.
