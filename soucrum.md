# SouCrum — mapa do projeto

Documento de continuidade: onde está cada coisa, como rodar, o que já funciona,
o que está pendente e as decisões que não devem ser desfeitas sem pensar.

Última atualização: 2026-07-26 · branch `claude/scrum-update-fmrmf3`

---

## 1. As três partes

```
PradoERP/
├── SouCrum/          front-end React + Vite + TypeScript (protótipo da UI)
├── soucrum-mcp/      servidor MCP (Node, stdio) — 24 ferramentas
└── supabase/         migrações + Edge Function de notificação
```

Além disso, o **app real** do usuário (o que está em `soucrum.vercel.app`, com
login e banco) **não está neste repositório**. O que existe aqui em `SouCrum/`
é o protótipo da nova UI, criado a partir do design `SouCrum_CRM.dc.html`.

> ⚠️ **Não faça deploy de `SouCrum/` no projeto Vercel `soucrum`.** Isso já
> aconteceu uma vez e sobrescreveu o app de produção do usuário. O banco não foi
> afetado, mas o front foi. Se precisar publicar, crie um projeto Vercel novo.

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
| `src/theme.ts` | `lightTokens` / `darkTokens`, `rootVars(dark)`, `colorMap()` |
| `src/data.ts` | Dados de exemplo (contatos, negócios, e-mails, time), `stageDefs`, `viewTitles` |
| `src/types.ts` | Tipos do domínio |
| `src/hooks/useCrmStore.ts` | Store central (useState) — navegação, dark mode, drag&drop, criação |
| `src/hooks/useMcpSettings.ts` | Preferências de MCP em localStorage + `buildMcpConfig()` |
| `src/hooks/useMcpHealth.ts` | Consulta `http://127.0.0.1:<porta>/health` do servidor MCP |
| `src/components/EmailConsent.tsx` | Modal de permissão de e-mail + `useEmailConsent()` |
| `src/components/views/McpSettings.tsx` | Seção MCP dentro de Configurações |
| `src/components/views/*.tsx` | Dashboard, Inbox, Pipeline, Contacts, Settings, Placeholder |

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

Projeto `sbyivwkcvjkropoforqx`, região `sa-east-1`, Postgres 17.6.
Detalhes completos em [`supabase/README.md`](supabase/README.md).

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
