# SouCrum — protótipo de UI

> ⚠️ **Isto não é o SouCrum.** O SouCrum é um app de **gestão de projetos, foco e
> rotinas**, com banco no Supabase, e o código dele não está neste repositório.
>
> Esta pasta é um **protótipo visual** feito a partir de um design estático. As
> telas aqui (contatos, pipeline, caixa de entrada) **não existem no produto**, e
> os dados são fictícios — não há Supabase ligado.
>
> O que presta aqui é o sistema visual: tokens de cor, tipografia, raios, sombras
> e o comportamento de claro/escuro. Use como referência de estilo, não como base
> funcional.

Implementado em **React + Vite + TypeScript**, sem biblioteca de componentes.

## Como rodar

Requer **Node 18+**.

```bash
cd SouCrum
npm install
npm run dev        # http://localhost:5173
```

Outros scripts:

```bash
npm run build      # typecheck (tsc) + build de produção (vite)
npm run preview    # serve o build de produção
npm run typecheck  # apenas checagem de tipos
```

## O que já está implementado (v0.1)

Fiel ao protótipo original, tudo funcionando com **estado em memória**:

- **Layout base**: sidebar com navegação, topbar com título/busca/ação
  primária, tema **claro/escuro** e sidebar **recolhível**.
- **Meu Painel** (`dashboard`): KPIs, gráfico de barras (negócios por mês),
  pipeline por estágio e feed de atividade recente.
- **Caixa de Entrada** (`inbox`): lista de e-mails com não lidos, thread de
  conversa e resposta (Enter envia, Shift+Enter quebra linha).
- **Quadro** (`pipeline`): kanban por estágio com **drag-and-drop** de
  negócios entre colunas e totais por coluna.
- **Contatos** (`contacts`): tabela com busca + painel lateral de detalhes
  (dados de contato e negócios associados).
- **Configurações** (`settings`): perfil, equipe (convidar membro),
  notificações (toggles) e uso do plano.
- **Placeholders**: Hoje, Projetos, Documentos, Materiais, Calendário, Foco,
  Relatórios, Rotinas — telas vazias prontas para receber conteúdo.

> Nota: a view de **Contatos** não tinha item no menu no protótipo original
> (embora a tela e os dados existissem). Foi adicionada à navegação aqui.

## Estrutura do projeto

```
SouCrum/
├── index.html
├── package.json / vite.config.ts / tsconfig.json
└── src/
    ├── main.tsx                # entrypoint React
    ├── App.tsx                 # shell: aplica tema + roteia as views
    ├── index.css               # reset, fontes, animações, scrollbar
    ├── types.ts                # tipos de domínio (Contact, Deal, Email...)
    ├── theme.ts                # tokens claro/escuro + colorMap()
    ├── utils.ts                # fmt() de moeda (R$)
    ├── data.ts                 # dados-semente, estágios, títulos, placeholders
    ├── hooks/
    │   └── useCrmStore.ts      # ESTADO CENTRAL + ações (o "cérebro" do app)
    └── components/
        ├── icons.tsx           # ícones SVG
        ├── Sidebar.tsx         # navegação lateral
        ├── Topbar.tsx          # cabeçalho (título, busca, ações)
        └── views/
            ├── DashboardView.tsx
            ├── InboxView.tsx
            ├── PipelineView.tsx
            ├── ContactsView.tsx
            ├── SettingsView.tsx
            └── PlaceholderView.tsx
```

### Onde mexer

- **Adicionar/alterar dados**: `src/data.ts`.
- **Adicionar ações ou estado**: `src/hooks/useCrmStore.ts` (fonte única de
  verdade; todas as views recebem `store` por props).
- **Cores/tema**: `src/theme.ts`.
- **Nova tela**: crie `src/components/views/MinhaView.tsx`, registre em
  `App.tsx` e, se precisar de item no menu, em `Sidebar.tsx`.

## Próximos passos sugeridos (para o próximo chat)

1. **Persistência real** — hoje o estado é em memória e reseta ao recarregar.
   Ligar a um backend (ex.: **Supabase**) ou, no mínimo, `localStorage`.
2. **Autenticação** — login/multiusuário; hoje o usuário "Você/Admin" é fixo.
3. **CRUD completo** — editar/excluir contatos, negócios e membros (hoje só
   há "adicionar" com dados genéricos).
4. **Preencher os placeholders** — Hoje, Projetos, Documentos, Calendário etc.
5. **E-mail de verdade** — a Caixa de Entrada é mock; integrar com um provedor
   (ex.: Gmail/IMAP) para enviar/receber.
6. **Roteamento por URL** — trocar o roteamento por estado por `react-router`
   para deep-links e navegação por URL.
7. **Testes** — adicionar Vitest + Testing Library.

## Origem

Reconstruído a partir de `SouCrum_CRM.dc.html` (protótipo em formato `.dc`,
que roda em runtime proprietário e não é executável fora dele). Este projeto é
a versão de produção equivalente, com o mesmo design e comportamento.
