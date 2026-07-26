# SouCrum — mapa do projeto

Documento de continuidade: onde está cada coisa, como rodar, o que já funciona,
o que está pendente e as decisões que não devem ser desfeitas sem pensar.

Versão **6.1** · última atualização 2026-07-26 · branch `claude/scrum-update-fmrmf3`

---

## 1. As três partes

```
PradoERP/
├── SouCrum/          front-end React + Vite + TypeScript (protótipo da UI)
├── soucrum-mcp/      servidor MCP (Node, stdio) — 24 ferramentas
└── supabase/
    ├── migrations/   migrações incrementais do banco ANTIGO
    ├── functions/    Edge Function de notificação
    └── v6.1/         esquema completo do ambiente novo (ver README de lá)
```

Além disso, o **app real** do usuário (o que está em `soucrum.vercel.app`, com
login e dados de verdade) **não está neste repositório**. O que existe aqui em
`SouCrum/` é o protótipo da nova UI, criado a partir do design
`SouCrum_CRM.dc.html`.

### ⚠️ Como o app real é publicado

Ele **não vem do Git**. Verificado no painel da Vercel: os 34 deploys mais
recentes do projeto `soucrum` foram todos feitos por `vercel deploy` (CLI, upload
de arquivos), nenhum com commit associado. O código vive na máquina do usuário.

O repositório `Prado1994/PradoERP` foi ligado ao projeto Vercel em 26/07, mas
com **branch de produção `claude/ios-automotive-dashboard-lqgubc` e Root
Directory vazio** — e não existe app web na raiz do repositório.

> ⚠️ **Um push naquela branch dispara build da raiz do repo e pode derrubar a
> produção.** Não empurre para `claude/ios-automotive-dashboard-lqgubc`. Trabalhe
> em branch própria (esta é `claude/scrum-update-fmrmf3`), que não dispara nada.

> ⚠️ **Não faça deploy de `SouCrum/` no projeto Vercel `soucrum`.** Isso já
> aconteceu e substituiu o front de produção. O banco não foi afetado.
> Se precisar publicar o protótipo, crie um projeto Vercel novo.

### O protótipo não é o app real

Vale dizer com clareza: o modelo de dados do banco (`objects` com fluxo
jot→scheduled, rotinas, pomodoro, eisenhower, workspaces, páginas, transações)
é de um **gestor de tarefas e projetos**. O protótipo em `SouCrum/` é um **CRM**
(contatos, negócios, pipeline, caixa de entrada). São aplicações diferentes —
aplicar a UI nova no app real é levar os tokens de tema e os ajustes de
componente para o código dele, não publicar esta pasta.

---

## 2. Front-end (`SouCrum/`)

### Rodar

```bash
cd SouCrum
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc + vite build  → dist/
npm run typecheck
```

Sem dependência de UI: React 18 puro, estilos inline com CSS variables. Zero
bibliotecas de componentes, zero CSS framework.

### Estrutura

| Arquivo | Papel |
|---|---|
| `src/App.tsx` | Shell: sidebar + topbar + view atual + modal de consentimento |
| `src/theme.ts` | **Toda a aparência**: `lightTokens` / `darkTokens`, `rootVars(dark)`, `colorMap()` |
| `src/data.ts` | Dados de exemplo (contatos, negócios, e-mails, time), `stageDefs`, `viewTitles` |
| `src/types.ts` | Tipos do domínio |
| `src/hooks/useCrmStore.ts` | Store central (useState) — navegação, dark mode, drag&drop, criação |
| `src/hooks/useMcpSettings.ts` | Preferências de MCP em localStorage + `buildMcpConfig()` |
| `src/hooks/useMcpHealth.ts` | Consulta `http://127.0.0.1:<porta>/health` do servidor MCP |
| `src/components/EmailConsent.tsx` | Modal de permissão de e-mail + `useEmailConsent()` |
| `src/components/views/McpSettings.tsx` | Seção MCP dentro de Configurações |
| `src/components/views/*.tsx` | Dashboard, Inbox, Pipeline, Contacts, Settings, Placeholder |

### Visual: vidro sobre brasa magenta

O aspecto atual segue o protótipo de app esportivo que o usuário enviou: fundo
ameixa quase preto com florações crimson/magenta, cartões de vidro, pílulas e
títulos de peso misto.

**Tudo isso vive em `src/theme.ts`.** Nenhuma view sabe que a aparência mudou —
elas só leem `var(--...)`. Foi assim que este visual entrou sem reestruturar o
app. Para trocar de aparência outra vez, mexa só nos tokens.

| Token | Papel |
|---|---|
| `--bg-glow` | As florações radiais da raiz. **Fixas na viewport**, então posição acima de 100% cai fora do quadro e não aparece |
| `--bg-card` / `--bg-elevated` | Vidro claro (`rgba(255,255,255,.07)`). Só lê como magenta porque a floração atrás é forte |
| `--blur` | Desfoque do vidro, aplicado junto de `bg-card` |
| `--radius-card` | 22px, o canto macio do visual |
| `--brand-gradient` | Crimson → violeta, para selo, botão primário e barra em destaque |
| `--on-invert` | Texto sobre pílula invertida (menu ativo, "Gerenciar plano") |

Três armadilhas que esse esquema cria, e que já foram corrigidas:

1. **Vidro em diálogo não funciona.** O modal de consentimento e o painel de
   contato ficaram ilegíveis com `--bg-card` puro — o conteúdo atrás atravessava
   o texto. Ambos usam agora `backgroundColor: var(--bg-app)` com
   `backgroundImage: linear-gradient(var(--bg-card), var(--bg-card))`: mesmo tom
   do vidro, sem transparência. **Qualquer sobreposição nova precisa disso.**
2. **`--bg-card` não serve como cor de texto.** Antes era branco opaco e era
   usado assim na pílula invertida; virou vidro e o rótulo desapareceu. Use
   `--on-invert`.
3. **Floração fraca vira cinza.** Com alpha baixo no `--bg-glow`, o vidro claro
   dos cartões não tem o que filtrar e tudo fica cinza-chumbo.

O modo claro é a mesma paleta em rosa-pálido — a cor do entorno do protótipo de
referência, não um tema neutro. Padrão do app é o **escuro**
(`useCrmStore`: `useState(true)`), porque o visual nasceu escuro.

### Tema: como as variáveis chegam ao DOM

`rootVars()` devolve uma string de declarações CSS; `App.tsx` converte para
objeto de estilo e aplica na raiz:

```ts
function cssVars(dark: boolean): React.CSSProperties {
  const style: Record<string, string> = {}
  for (const decl of rootVars(dark).split(';')) {
    const [k, v] = decl.split(':')
    if (k?.startsWith('--')) style[k] = v
  }
  return style as React.CSSProperties
}
```

Trocar o tema é só `store.toggleDark()` — todos os componentes leem
`var(--text-1)`, `var(--bg-card)` etc.

### Mobile — estado atual

O layout é **desktop-first**: a raiz tem `minWidth: 1024`, então no celular o
usuário rola na horizontal em vez de ver a interface quebrada. Uma tentativa de
versão responsiva foi feita e revertida (commits `808e006` → `40bbbaf`) porque
descaracterizava o app. **Se for mexer nisso, faça como camada adicional
(media queries / breakpoint), não reescrevendo o layout desktop.**

### Consentimento de e-mail

`useEmailConsent()` guarda `{ emailEnabled, consentAt }` em
`localStorage['soucrum.emailConsent']` — mesma forma dos dados de
`notification_prefs`, para o componente ser portável para o app real. No app
real, troque o localStorage por upsert na tabela e `USUARIO_EMAIL` (hoje fixo em
`App.tsx`) pelo `auth.users.email` do usuário logado.

---

## 3. Servidor MCP (`soucrum-mcp/`)

Expõe o SouCrum para Claude Desktop, Gemini CLI e qualquer cliente MCP.
Transporte **stdio**; roda na máquina do usuário.

```bash
cd soucrum-mcp
npm install && npm run build
cp .env.example .env      # preencher SOUCRUM_SUPABASE_URL e SOUCRUM_SUPABASE_KEY
npm start
```

### 24 ferramentas

**Leitura** — `list_workspaces`, `list_projects`, `project_summary`,
`search_tasks`, `get_task`, `today_agenda`, `list_routines`,
`export_agenda_for_calendar`, `find_task_by_email`, `list_email_tasks`,
`export_project_markdown`, `notification_channels`, `list_pages`, `read_page`,
`recent_activity`, `unread_notifications`, `project_transactions`

**Escrita** (`WRITE_TOOLS`, desativadas com `SOUCRUM_READ_ONLY=true`) —
`create_task`, `update_task`, `complete_routine`, `link_gcal_event`,
`create_task_from_email`, `send_notification`, `notify_overdue_summary`

### Registro das ferramentas

`server.tool` é sobrecarregada, e `Parameters<typeof server.tool>` destrói a
inferência do Zod. Por isso existe o wrapper genérico:

```ts
function reg<S extends z.ZodRawShape>(
  name: string, description: string, schema: S,
  handler: (args: z.infer<z.ZodObject<S>>) => ToolResult | Promise<ToolResult>,
): void {
  registeredTools.push({ name, description, write: WRITE_TOOLS.has(name) })
  ;(server.tool as any)(name, description, schema, handler)
}
```

Ao adicionar ferramenta: chame `reg(...)` e, se ela escreve ou manda mensagem
para fora, inclua o nome em `WRITE_TOOLS`.

### Endpoint `/health` (opcional)

Com `SOUCRUM_HTTP_PORT=7757`, o servidor abre `GET /health` em 127.0.0.1 e a
tela de Configurações mostra status real (versão, modo, ferramentas, conexão com
o banco, canais de notificação). Só metadados — nunca chave nem dado de negócio.

CORS: qualquer porta de localhost é aceita (o dev server troca de porta), e o
resto precisa estar em `SOUCRUM_HTTP_ALLOWED_ORIGINS`.

```ts
function originPermitida(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  try {
    const { hostname, protocol } = new URL(origin)
    return protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')
  } catch { return false }
}
```

Verificado: `https://site-malicioso.com` e `http://evil.localhost.attacker.com`
são recusados (a checagem é por hostname exato, não `endsWith`).

### Notificações do servidor MCP (`src/notify.ts`)

Quatro canais, cada um só ativo se a variável existir: Slack (Blocks),
Google Chat (texto), Microsoft Teams (**Adaptive Card** — os conectores O365
foram descontinuados, use Workflows/Power Automate) e e-mail via Resend.

### Interoperabilidade

MCP é **multi-servidor**: o cliente conecta no SouCrum e no Notion e no Google
ao mesmo tempo. Não embutimos um no outro. Os arquivos prontos para colar estão
em `clients/claude_desktop_config.json` e `clients/gemini-settings.json`, e a
UI gera o mesmo JSON em Configurações → MCP.

---

## 4. Backend (`supabase/`)

Dois projetos, e o antigo **continua sendo o de produção**:

| | Projeto | Papel |
|---|---|---|
| Antigo | `sbyivwkcvjkropoforqx` | **Em produção.** Serve o app real. Intacto. |
| v6.1 | `njlnvcrcoebbednfrzhr` | Ambiente novo, carregado do antigo. Ninguém usa ainda. |

Ambos em `sa-east-1`, Postgres 17.6. O v6.1 saiu de graça (plano gratuito).

- Esquema e migração do v6.1: [`supabase/v6.1/README.md`](supabase/v6.1/README.md)
- Notificações por e-mail: [`supabase/README.md`](supabase/README.md)

### Tabelas (13, `public`)

| Tabela | Conteúdo |
|---|---|
| `workspaces`, `workspace_members`, `workspace_invites` | Multi-usuário |
| `projects` | Projetos (com `cycle`, `deadline`, `folders`) |
| `objects` | **Tabela central** — tarefas, rotinas, notas (25 colunas) |
| `pages` | Documentos |
| `transactions` | Lançamentos financeiros |
| `activity`, `notifications` | Feed e avisos in-app |
| `card_shares` | Links públicos de cartão |
| `backups` | Snapshot por usuário |
| `notification_prefs`, `notification_log` | Consentimento e auditoria de e-mail |

### ⚠️ `objects.status` não é enum

Os valores reais são **`jot` → `extracted` → `refined` → `scheduled`**, texto
livre, e **não existe `'done'`**. Uma versão anterior do servidor MCP filtrava
`.neq('status','done')`, o que deixava a agenda e o resumo de atrasadas sem
sentido. Conclusão de rotina se representa em **`last_done`** (data), não em
status. Qualquer código novo deve tratar `status` como texto livre.

Outras colunas que valem saber: `recurrence` (rotinas), `assignee`,
`show_in_agenda`, `eisenhower`, `pom_est`/`pom_done`, `parent_id` (subtarefas),
`gcal_event_id` (idempotência com Google Calendar), `attachments` (jsonb, usado
para deduplicar e-mail via `@>` com `message_id`).

### Notificações por e-mail — apenas dois tipos

Depois da última decisão, o escopo é exatamente:

| `kind` | O que manda |
|---|---|
| `overdue` | Tarefas com `due_date` no passado (rotina fechada hoje não conta) |
| `mentions` | Marcações não lidas (`notifications.type = 'mention'`) |

`test` existe só para conferir a configuração. Nada de resumo semanal.

`notification_prefs`: `user_id`, `email`, `email_enabled`, `consent_at`,
`overdue_enabled`, `mentions_enabled`, `last_mention_email_at`, `created_at`,
`updated_at`.

Migrações aplicadas: `20260726152326_create_notification_prefs` e
`20260726153610_notification_prefs_only_overdue_and_mentions`.
Edge Function `send-notification` na **versão 2**, `verify_jwt = true`.

### Regras de segurança que não devem ser afrouxadas

1. **O destinatário nunca vem do cliente.** A função usa o e-mail do usuário
   autenticado no JWT. Sem isso, qualquer pessoa com login usaria a conta da
   Resend como relé de spam.
2. **A chave da Resend só existe como secret do projeto.** Nunca no front, nunca
   no repositório, nunca em chat. Se vazar, revogue em resend.com → API Keys.
3. **`service_role` não vai para o navegador.** A UI de Configurações detecta e
   avisa em vermelho:
   ```ts
   const chaveArriscada = /service_role/i.test(settings.publishableKey)
   ```
4. **Sem consentimento, 403.** E cada tipo tem o próprio interruptor.
5. **O marcador anti-reenvio só avança se enviou.** Falha da Resend não faz a
   marcação desaparecer do próximo e-mail.

### Secrets a configurar (Dashboard → Edge Functions → Secrets)

| Secret | Valor |
|---|---|
| `RESEND_API_KEY` | chave `re_...` |
| `NOTIFY_EMAIL_FROM` | remetente em domínio verificado na Resend |
| `NOTIFY_APP_URL` | `https://soucrum.vercel.app` |

### Testar

```bash
BASE=https://sbyivwkcvjkropoforqx.supabase.co/functions/v1/send-notification
curl -X POST $BASE -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" -d '{"kind":"mentions","dry_run":true}'
```

`dry_run` mostra exatamente o que sairia, sem enviar e sem mexer no marcador.

---

## 5. Pendências

**Do usuário:**

- [ ] **Revogar a chave da Resend** que foi colada no chat e gerar outra.
      Chave em conversa é chave vazada.
- [ ] Verificar o domínio na Resend (SPF/DKIM). Sem isso, em produção o envio
      falha — a Resend só entrega para o e-mail da própria conta.
- [ ] Configurar os três secrets acima.
- [ ] **Restaurar o app real na Vercel:** promover o deploy
      `dpl_9aFqkHL2TT3GVjWFaeQ4x5vP2EL2` via Dashboard → Deployments →
      Instant Rollback. Não tenho ferramenta de promote nem o código do app
      real, então essa parte só pode ser feita no painel.

**Técnicas, quando fizer sentido:**

- [ ] Trocar o localStorage do consentimento por `notification_prefs` no app real
      e ligar `USUARIO_EMAIL` ao usuário autenticado.
- [ ] Interruptores de `overdue_enabled` / `mentions_enabled` na tela de
      Configurações (o banco já tem as colunas; a UI ainda não expõe).
- [ ] Agendamento automático (`pg_cron` + `pg_net`): exige um laço server-side
      sobre quem deu consentimento, com token por usuário. Esboço no
      `supabase/README.md`.
- [ ] Mobile como camada adicional, sem desmontar o layout desktop.

---

## 6. Limitações do ambiente (para não perder tempo)

- A rede de saída do sandbox **bloqueia `*.vercel.app` e `*.supabase.co`**.
  Verificação de comportamento foi feita por SQL direto (RLS, dedup jsonb) e
  por servidor HTTP local fingindo ser webhook.
- As ferramentas de leitura da Vercel dão **403** por escopo; deploys funcionam
  **só sem `teamId`**.
- Chromium do Playwright: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
  Não rode `playwright install`.
- Cuidado com servidor MCP velho ainda ocupando a porta 7757 (`EADDRINUSE`) —
  dá para testar o build antigo sem perceber.

---

## 7. Histórico resumido

| Commit | O que entrou |
|---|---|
| `93da9d4` | UI do SouCrum em React + Vite + TS, a partir do design `.dc.html` |
| `808e006` / `40bbbaf` | Tentativa de UI responsiva e reversão |
| `0a92453` | `minWidth: 1024` — rolagem lateral no celular em vez de layout quebrado |
| `7ed83d6` | Servidor MCP do SouCrum |
| `78829d5` | Integração com Notion, Google, Claude Desktop e Gemini |
| `a474050` | Ponte Gmail: e-mail vira cartão sem duplicar (`attachments @> message_id`) |
| `cd0fcb5` / `a6af080` | Seção MCP em Configurações + status real via `/health` |
| `15b066c` | Notificações por Slack, Google Chat, Teams e e-mail no servidor MCP |
| `8ab7eeb` | Notificação por e-mail multi-usuário com consentimento (Supabase) |
| `7eea334` | Notificações restritas a tarefas vencidas e marcações |
| (este) | Visual de vidro sobre brasa magenta, aplicado só via tokens |
