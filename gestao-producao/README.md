# Gestão de Produção por Ficha — Grupo Prado

Sistema independente para acompanhar a produção de calçados através da **ficha de produção**, do corte à expedição, com apontamento por etapa via QR Code e visibilidade em tempo real para as unidades de **Itanhandu** e **Guaxupé**.

**Stack:** React + Vite + Tailwind (frontend, deploy na Vercel) · Supabase (PostgreSQL, Auth, Realtime).

---

## Funcionalidades (MVP — Fase 1 + parte da Fase 2)

- **Modelos/SKUs** — cadastro com marca (Safety Prado / Country Prado), linha e grade de numeração.
- **Ordens de Produção** — abertura com geração automática de fichas (1 ou N lotes), numeração automática (`OP-2026-0001`, `F-000001`) e QR Code único por ficha.
- **Impressão da ficha** — layout para impressão com QR Code, grade de numeração e quadro de apontamento manual (backup em papel).
- **Apontamento mobile-first** — escanear QR (câmera do navegador) ou digitar o número da ficha → confirmar etapa → informar quantidade produzida, perdas e motivo → salvar. Poucos toques, pensado para o chão de fábrica.
- **Regras de negócio no banco** (função `registrar_apontamento`):
  - uma etapa só aceita apontamento se for a etapa atual da ficha (sequência Corte → Pesponto → Pré-montagem → Montagem → Acabamento → Expedição);
  - apontamento parcial permitido (ex.: 300 de 500 pares);
  - a ficha avança de etapa automaticamente quando produzido + perdido cobre o que entrou na etapa;
  - perdas exigem motivo (histórico de qualidade para a ISO);
  - quantidade disponível em cada etapa desconta as perdas das etapas anteriores.
- **Painel de acompanhamento** — fichas por etapa/unidade/status, indicação de atraso vs. prazo, atualização **em tempo real** (Supabase Realtime).
- **Dashboard** — produção do dia vs. meta de **550 pares/dia** (consolidada e por unidade), série dos últimos 7 dias, perdas por etapa e por motivo (30 dias).
- **Perfis de acesso** — `operador` (só aponta), `supervisor` (acompanha e cadastra), `gestao` (visão consolidada e administração de perfis), aplicados via RLS no banco.

## Estrutura

```
gestao-producao/
├── supabase/
│   ├── migrations/0001_schema_inicial.sql   # schema, regras, RLS, views, seeds de domínio
│   └── seed.sql                             # dados de exemplo (opcional)
├── src/
│   ├── lib/            # cliente Supabase + contexto de autenticação
│   ├── components/     # Layout (header Prado), leitor de QR Code
│   └── pages/          # Login, Apontamento, Painel, Dashboard, OPs, Modelos, Equipe, Impressão
└── vercel.json         # rewrites de SPA
```

## Como subir o ambiente

### 1. Banco (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, execute `supabase/migrations/0001_schema_inicial.sql` (cria tabelas, função de apontamento, RLS, views e os seeds fixos: unidades, etapas e motivos de perda).
3. (Opcional) Execute `supabase/seed.sql` para dados de exemplo.
4. Em **Authentication → Users**, crie os usuários (e-mail/senha). O perfil é criado automaticamente como `operador`; ajuste o papel na tabela `profiles` (`supervisor` para Ana Clara/Michael, `gestao` para Wesley).

### 2. Frontend (local)

```bash
cd gestao-producao
npm install
cp .env.example .env   # preencha com URL e anon key do projeto Supabase
npm run dev
```

### 3. Deploy (Vercel)

Importe o repositório na Vercel com **Root Directory** = `gestao-producao`, framework Vite, e defina as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. O `vercel.json` já cuida das rotas da SPA.

## Decisões de modelagem

- O **QR Code carrega um token UUID** (`fichas.qr_token`), não o número sequencial — evita apontamento em ficha errada por digitação/adivinhação.
- Apontamentos **só entram pela função** `registrar_apontamento` (security definer, transacional): a validação de sequência e o avanço de etapa não podem ser burlados pelo cliente.
- O indicador "pares produzidos" do dashboard usa por padrão a etapa **Montagem** (configurável na tela) — é o ponto usual de contagem de par produzido no setor.
- Códigos de OP/SKU em padrão simples e exportável, já pensando numa integração futura com o Delta ERP (fora do escopo atual).

## Evolução prevista (fases 2–3)

- Exportação CSV/Excel dos apontamentos (cruzamento futuro com Power BI/Kondado).
- Alertas de ficha parada há X horas numa etapa.
- Tempo médio por etapa (gargalos — pesponto/costura é o suspeito usual).

---

*Grupo Prado · Safety Prado · Country Prado · Itanhandu & Guaxupé*
