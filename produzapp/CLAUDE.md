# produzapp — contexto para o Claude Code

Gestão de produção do **Grupo Prado** (calçados de segurança e EPIs; Itanhandu e Guaxupé/MG).
Responda e documente em **português do Brasil**. Tom direto e prático, linguagem acessível a produção, vendas e gestão.
Quando houver dúvida de negócio, **pergunte antes de assumir**.

## Em uma frase

App próprio de produção com API própria: o **produzapp é dono das OPs e do rastreamento**; o **Bling** fica com
estoque/fiscal/pedidos de venda e o **Odoo** com o cadastro (produto, lista de materiais, custo).

## Como chegamos aqui (resumo)

- A migração Softpool → Odoo travou por recriar a lógica do Softpool dentro do Odoo (app de baixa customizado,
  ficha como centro de tudo, OEE estimado por intervalo entre bipes). Fit-gap: quase nada precisava de customização;
  o gap real é a grade de tamanhos do calçado.
- O módulo de Ordens de Produção do Bling **não está ativado** na conta de Itanhandu (só Vendas e Pedidos de Compra
  aparecem na consulta de módulos, 08/10/2026). Ativação é pela interface web do Bling.
- Decisão (08/10/2026): construir o produzapp, desacoplado dos dois sistemas, para a produção não depender de nenhum deles.

## Decisões vigentes (detalhe em docs/DECISOES.md)

- **7 etapas, nesta ordem:** `COR` Corte · `PES` Pesponto · `EST` Esteira de Montagem · `INJ` Injetora ·
  `ACA` Esteira de Acabamento · `EMB` Embalagem · `EXP` Expedição. (Aviamento **não** é mais etapa.)
- **Uma OP por caixa** (10–20 pares). Código de barras da ficha A6: `OP-CAIXA-SIGLA`, ex.: `00101-01-COR`.
  Paradas: `PARADA-SIGLA-MOTIVO` / `RETOMA-SIGLA`.
- **Atraso é medido contra a previsão INICIAL.** A previsão atual pode ser reprogramada (motivo obrigatório,
  com histórico), mas nunca esconde o atraso.
- **Eventos de etapa são imutáveis.** Gravar primeiro, sincronizar depois (fila com reenvio). Leitura idempotente (`idLeitura`).
- **Sequência estrita** por padrão (`BLOQUEAR_FORA_DE_SEQUENCIA`). Setor errado é recusado.
- "Concluída" no Bling = leitura de **Expedição**.

## Estado do código

- ✅ Fase 1: domínio (`src/dominio`), API Fastify (`src/api`), fila de sincronização, repositório **em memória**,
  destinos Bling/Odoo **simulados**, esquema PostgreSQL pronto (`db/migrations/001_init.sql`), OpenAPI, CI, **33 testes**.
- ✅ Fase 2 (08/10/2026): `RepositorioPostgres` (`src/repositorio/postgres.ts`) + runner de migrações (`npm run migrar`),
  suíte de contrato rodando contra memória **e** PostgreSQL (`DATABASE_URL_TESTE`; 53 testes), `src/app.ts`
  (escolhe o repositório por `DATABASE_URL`), função serverless `api/index.ts` + `vercel.json` (estáticos em `web/`).
  Validado localmente: gravar → reiniciar → dado persiste; leitura repetida (`idLeitura`) devolve o mesmo resultado.
- ❌ Não existe ainda: telas ligadas à API, conectores reais, deploy de fato, **cron da fila de sincronização na Vercel**
  (o `setInterval` só vale no servidor tradicional; serverless precisa de Vercel Cron chamando um endpoint).
- `web/prototipo/estacao-de-baixa.html`: protótipo navegável, **dados simulados no navegador**, não grava em lugar nenhum.
  - Aba **Estação**: seletor obrigatório de etapa, tela antiburro (cor inteira piscando verde/vermelho/amarelo + som),
    foco permanente, detecção de leitura colada, recusa de setor errado e de etapa fora de ordem, histórico.
  - Aba **Acompanhamento** (visual "Vidro Prado"): indicadores (prazo médio de produção, idade média das abertas,
    atrasadas, atraso médio, entregas em 7 dias, avanço), pares por etapa, filtros, tabela por OP / cliente / produto
    com entrada, previsão inicial, previsão atual (reprogramada), dias em produção × planejado, dias em atraso
    (linha destacada) e linha do tempo das etapas ao clicar.

## Deploy — o que já foi tentado

- **GitHub:** o repositório `produzapp` (privado) **ainda não foi publicado**; não havia conector nem credenciais na sessão.
  Use `./scripts/publicar-github.sh <dono>` (requer `gh auth login`).
- **Vercel:** o conector devolveu **403 ao criar projeto** na equipe "Wesley Sousa's projects" (já tinha ocorrido antes).
  Não repetir. Caminho: publicar no GitHub → Vercel → *Add New → Project → Import*. Depois disso o conector consegue
  acompanhar deploys e logs.
- Atenção: na Vercel (serverless) **memória não persiste**. O teste real exige banco.

## Próximos passos (nesta ordem)

1. ~~**Banco:** implementar `RepositorioPostgres`~~ **feito** (resta decidir onde hospedar). Antes: implementar `RepositorioPostgres` (contrato em `src/repositorio/repositorio.ts`) rodando a migração
   `001_init.sql`; os testes existentes devem passar também contra ele (idealmente com a mesma suíte parametrizada).
   *Decisão pendente com o Wesley:* Neon pelo Marketplace da Vercel (rápido, só para piloto sem dado real de cliente)
   **ou** PostgreSQL na VPS da empresa.
2. ~~**Vercel-ready:**~~ **feito, ainda não publicado.** Antes: função da API em `api/` + `vercel.json`; estação e painel como estáticos servidos pelo mesmo projeto.
3. **Telas ligadas à API:** `POST /leituras` com `idLeitura` único e **fila local no navegador** se a rede cair;
   painel usando `GET /ordens` e `GET /indicadores`. A chave de API **não** vai no código: cada estação a digita uma vez
   e o navegador a guarda localmente (ou usar login simples na fase seguinte).
4. **Criação de OPs em lote por plano** (`POST /ordens/lote`) — uma OP por caixa pesa no PCP; medir no piloto.
5. **Piloto no modelo 40501** (docs/PILOTO-40501.md): uma semana, ficha de papel e Softpool em paralelo.
6. Quando o módulo de OP do Bling for ativado: rodar o **teste de viabilidade** (docs/INTEGRACAO-BLING.md) **antes** de
   escrever o conector. Se não for ativado, o conector envia só movimentação de estoque.
7. Conector Odoo (leitura de cadastro) só depois de o cadastro estabilizar.

## Regras para mexer no código

- Regras de negócio ficam em `src/dominio` e **não** importam rede, banco nem Fastify.
- Toda regra nova entra com teste. Antes de concluir: `npm run typecheck && npm test`.
- O núcleo nunca fala "Bling" ou "Odoo": só o contrato `Destino`.
- Nunca commitar `.env`, chaves, tokens ou dados reais de cliente. Repositório **privado**.
- Não gravar cadastro no Odoo. O usuário de integração do Odoo precisa declarar as empresas permitidas
  (no piloto antigo, ordens de outra empresa ficaram invisíveis).
- O refresh token do Bling é rotacionado a cada uso: gravar sempre o novo.

## Pendências de negócio (não decidir sozinho; perguntar ao Wesley)

- **Aviamento:** dentro do Corte ou controlado à parte?
- **Expedição:** leitura por caixa de produção ou por volume de despacho?
- **Estorno** de leitura errada (quem autoriza) e **crachá** do operador.
- Onde ficará o banco (Neon × VPS) e quem mantém o sistema (responsável técnico, backup).
- Cadastro aberto no Odoo que afeta a leitura: prefixo ST indefinido, variantes do 40501 ST sem código,
  ST45501 sem grade, roteiros incompletos.

## Pessoas e papéis

Wesley (COO/TI, decide) · Ana Clara (supervisora de produção, Itanhandu) · Ana Beatriz (PCP, cria as OPs) ·
Analice (valida tempos e especificações técnicas) · Alencar e Marisia (sócios).

## Contexto de negócio

Meta: 550 pares/dia. Marcas: Safety Prado e Country Prado. Canais: B2B, representantes e marketplaces.
Identidade visual: cores Prado (navy `#1C2632`, azul `#2C3B4E`, terra `#9F5234`, amarelo `#FEC761`, bege `#CCC1A9`,
branco `#FFFCF4`), fonte DM Sans, painéis em vidro fosco; sempre com a logo oficial quando o arquivo estiver disponível.
Números no padrão brasileiro (`1.234,56`, `dd/mm/aaaa`).

## Primeiro pedido sugerido ao Claude Code

> Leia o CLAUDE.md e docs/. Implemente o `RepositorioPostgres` com a migração `db/migrations/001_init.sql`,
> faça a suíte de testes do repositório rodar contra a memória e contra o Postgres, e depois prepare o projeto para
> o deploy na Vercel (função em `api/` + `vercel.json`), sem commitar nenhum segredo.
