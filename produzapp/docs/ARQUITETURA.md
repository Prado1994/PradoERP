# Arquitetura

## Visão geral

```
 Estação (leitor USB + navegador)     Painel de acompanhamento
              │                                  │
              └──────────────► API produzapp ◄───┘
                                   │
              ┌────────────────────┼─────────────────────┐
              │                    │                     │
       Núcleo (domínio)     Repositório (PostgreSQL)   Fila de sincronização
       regras puras         eventos imutáveis                │
                                                  ┌─────────┴─────────┐
                                              Destino Bling      Destino Odoo
```

## Camadas

1. **Domínio** (`src/dominio`): regras puras, sem rede e sem banco. Etapas, interpretação do código,
   decisão de cada leitura, prazos e reprogramação. É o que mais precisa de teste.
2. **Repositório** (`src/repositorio`): contrato assíncrono. Hoje em memória; PostgreSQL na fase 2.
3. **API** (`src/api`): HTTP/JSON, autenticação por chave (`x-api-key`), um cliente = uma chave.
4. **Integrações** (`src/integracoes`): contrato `Destino`. O núcleo nunca fala "Bling" ou "Odoo";
   fala "enviar este item". Trocar um sistema = trocar um adaptador.
5. **Sincronização** (`src/sincronizacao.ts`): esvazia a fila de envio, com espera progressiva.

## Fluxo de uma leitura

1. A estação envia `POST /leituras` com `codigo`, `estacao` e um `idLeitura` único.
2. O domínio decide: `ok`, `repetida`, `fora_da_estacao`, `fora_de_sequencia`, `parada_*` ou `erro`.
3. Se `ok`, o **evento é gravado** e, se for a primeira ou a última etapa, um item entra na **fila**.
4. A resposta volta na hora, com a mensagem pronta para a tela. **O operador nunca espera o Bling nem o Odoo.**
5. O processo de sincronização envia a fila em segundo plano.

## Princípios

- **Gravar primeiro, sincronizar depois.** Falha de rede ou do Bling não pode travar a fábrica.
- **Idempotência.** Reenviar uma leitura (mesmo `idLeitura`) devolve o resultado já gravado e nunca duplica baixa.
- **Eventos imutáveis.** Nada é alterado ou apagado; correções são novos eventos. Dá a rastreabilidade que a ISO pede.
- **Prazo contra a previsão inicial.** A previsão atual pode mudar (com motivo e histórico), mas o atraso é sempre
  medido contra o compromisso original.
- **Núcleo pequeno.** Produção e só isso. Não vira um segundo ERP.

## Falhas e como o sistema reage

| Falha | Reação |
|---|---|
| Bling/Odoo fora do ar | O item fica na fila e é reenviado após 30 s, 2 min, 10 min, 30 min; depois vira `falha` e aparece em `GET /sincronizacao/pendentes` |
| Leitor sem Enter (código colado) | O código é desmembrado, a leitura vale e a resposta traz `aviso` para configurar o leitor |
| Mesma leitura enviada duas vezes | Mesmo `idLeitura` → mesmo resultado, sem novo evento |
| Caixa lida fora de ordem | Recusada (`fora_de_sequencia`) dizendo qual etapa falta; configurável em `BLOQUEAR_FORA_DE_SEQUENCIA` |
| Código de outro setor | Recusado (`fora_da_estacao`) |

## Segurança

- Chaves de API só no servidor (`.env`), uma por cliente, rotacionáveis. Nunca no navegador nem no repositório.
- Tokens do Bling/Odoo ficam só no servidor; renovação automática com alerta se falhar.
- HTTPS e senha na frente (nginx na VPS da empresa); acesso restrito à rede da fábrica quando possível.
- Repositório privado; sem dados reais de cliente em testes ou na demonstração.
- Backup diário do banco.

## Operação

- Um processo de API + um laço de sincronização (a cada ~10 s).
- Estações são computadores comuns com navegador e leitor USB (modo teclado, sufixo Enter).
- Observabilidade mínima: `GET /saude` e `GET /sincronizacao/pendentes` (itens pendentes e com falha).
