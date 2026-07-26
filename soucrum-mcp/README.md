# SouCrum MCP Server

Servidor **MCP (Model Context Protocol)** para o SouCrum — permite que assistentes
de IA (Claude Desktop, Claude Code, Cursor…) consultem e operem seus workspaces,
projetos, cartões/tarefas, rotinas, agenda, páginas e atividade.

Backend: **Supabase** (Postgres + RLS). Transporte: **stdio**.

## Instalação

```bash
cd soucrum-mcp
npm install
npm run build
```

## Configuração

Copie `.env.example` e preencha:

```bash
SOUCRUM_SUPABASE_URL=https://sbyivwkcvjkropoforqx.supabase.co
SOUCRUM_SUPABASE_KEY=<sua chave>
```

### Qual chave usar

| Modo | Chave | Comportamento |
|---|---|---|
| **Recomendado** | `anon`/`publishable` + `SOUCRUM_USER_JWT` | Respeita RLS — o assistente vê **apenas** os dados daquele usuário |
| Administrativo | `service_role` | Ignora RLS, acesso total. Só em máquina confiável |

> ⚠️ A chave `service_role` dá acesso irrestrito ao banco. Nunca a exponha em
> navegador, repositório público ou log. Sem `SOUCRUM_USER_JWT`, a chave `anon`
> não enxerga nada (RLS bloqueia), o que é o comportamento esperado.

Opcional: `SOUCRUM_READ_ONLY=true` desativa todas as ferramentas de escrita.

### Endpoint de status (opcional)

Com `SOUCRUM_HTTP_PORT=7757`, o servidor abre `GET /health` em `127.0.0.1` para a
tela **Configurações → Status do servidor** do SouCrum mostrar o estado real:

```bash
curl -s http://127.0.0.1:7757/health | jq '{ok, version, mode, tool_count, supabase}'
```

```json
{ "ok": true, "version": "0.1.0", "mode": "read-write", "tool_count": 24,
  "supabase": { "reachable": true, "latency_ms": 84 } }
```

- Escuta **só em loopback** — nada exposto na rede local.
- Devolve apenas metadados: versão, modo, nomes das ferramentas e se o banco
  responde. **Nunca** a chave nem dados de negócio.
- CORS: qualquer porta de `localhost`/`127.0.0.1` é aceita (é a sua máquina);
  origens da internet só com `SOUCRUM_HTTP_ALLOWED_ORIGINS`.
- Sem a variável, nenhuma porta é aberta.

### Registrar no Claude Desktop

Em `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "soucrum": {
      "command": "node",
      "args": ["/caminho/para/PradoERP/soucrum-mcp/dist/index.js"],
      "env": {
        "SOUCRUM_SUPABASE_URL": "https://sbyivwkcvjkropoforqx.supabase.co",
        "SOUCRUM_SUPABASE_KEY": "sb_publishable_...",
        "SOUCRUM_USER_JWT": "eyJ..."
      }
    }
  }
}
```

### Registrar no Claude Code

```bash
claude mcp add soucrum -- node /caminho/para/soucrum-mcp/dist/index.js
```

## Usar junto com Notion e Google

Clientes MCP conectam vários servidores ao mesmo tempo — o SouCrum roda **ao lado**
do Notion e do Google Workspace, não dentro deles. Configurações prontas para
Claude Desktop, Claude Code, Gemini CLI e Cursor estão em
**[`clients/`](clients/README.md)**.

## Notificações

Envia avisos para **Slack, Google Chat, Microsoft Teams e e-mail**. Cada canal só
entra em ação se estiver configurado (ver `.env.example`), e recebe o formato
nativo dele:

| Canal | Formato | Como obter |
|---|---|---|
| Slack | Blocks (header + seção + botão) | App → Incoming Webhooks |
| Google Chat | Texto com markdown | Espaço → Apps e integrações → Webhooks |
| Teams | Adaptive Card | Canal → Workflows → "when a webhook request is received" |
| E-mail | HTML + texto, via Resend | resend.com → API key + domínio verificado |

> O Teams usa Adaptive Card porque os conectores do Office 365 foram
> descontinuados; o gatilho atual é o do Power Automate / Workflows.

**Falhas são isoladas:** se um canal cair, os outros seguem e o resultado vem
canal por canal, com o status HTTP e o erro real — útil para achar webhook
inválido. Em `SOUCRUM_READ_ONLY=true` as ferramentas de envio ficam desativadas,
já que mandam mensagem para fora.

## Ferramentas (24)

### Leitura
| Ferramenta | O que faz |
|---|---|
| `list_workspaces` | Workspaces e seus membros (e-mail + papel) |
| `list_projects` | Projetos com cor, descrição e prazo; filtra por workspace |
| `project_summary` | Resumo do projeto: contagem por status + tarefas atrasadas |
| `search_tasks` | Busca cartões por texto, status, projeto, tag, área, responsável, prazo |
| `get_task` | Detalhe completo: corpo, checklist, comentários, anexos, subtarefas |
| `today_agenda` | Vencendo hoje, atrasadas, fixadas na agenda e rotinas diárias pendentes |
| `list_routines` | Rotinas recorrentes, com `done_today` indicando o ciclo atual |
| `list_pages` | Páginas/documentos, opcionalmente por projeto |
| `read_page` | Conteúdo de uma página |
| `recent_activity` | Feed de atividade (quem fez o quê) |
| `unread_notifications` | Notificações não lidas |
| `project_transactions` | Lançamentos de um projeto, com total somado |
| `export_agenda_for_calendar` | Cartões com prazo no formato de evento do Google Calendar |
| `export_project_markdown` | Projeto + cartões em Markdown (Notion / Google Docs) |
| `find_task_by_email` | Diz se um e-mail do Gmail já virou cartão (checagem anti-duplicata) |
| `list_email_tasks` | Cartões originados de e-mail, com remetente e link da mensagem |
| `notification_channels` | Quais canais de notificação estão prontos (sem revelar segredos) |

### Escrita (desativáveis via `SOUCRUM_READ_ONLY`)
| Ferramenta | O que faz |
|---|---|
| `create_task` | Cria cartão (tarefa, jot ou rotina) |
| `update_task` | Atualiza cartão: status, prazo, responsável, agenda… |
| `complete_routine` | Conclui o ciclo de uma rotina (grava `last_done`) |
| `link_gcal_event` | Grava o `gcal_event_id` do evento criado no Google Calendar |
| `create_task_from_email` | Transforma e-mail do Gmail em cartão — **idempotente**, não duplica |
| `send_notification` | Envia um aviso para Slack / Chat / Teams / e-mail |
| `notify_overdue_summary` | Monta o resumo de atrasadas do banco e dispara nos canais |

## Modelo de dados

Vocabulário verificado no banco de produção:

- **Fluxo dos cartões** (`objects.status`, texto livre — sem CHECK constraint):
  `jot` (captura) → `extracted` → `refined` → `scheduled`
- **Tipos** (`type`): `task`, `jot`
- **Eisenhower**: `do`, `schedule`, `delegate`, `delete`
- **Rotinas**: cartões com `recurrence` (`daily`, `weekly`, `monthly`); a conclusão
  de cada ciclo é registrada em `last_done` — **não existe status `done`** neste
  schema, então "concluído" para rotinas = `last_done` igual à data do ciclo.

Tabelas expostas: `workspaces`, `workspace_members`, `projects`, `objects`,
`pages`, `activity`, `notifications`, `transactions`.

### Vínculos externos

| Onde fica | Para quê |
|---|---|
| `objects.gcal_event_id` | ID do evento no Google Calendar (coluna já existia, estava vazia) |
| `objects.attachments` | Referência do e-mail: `{type:'email', source:'gmail', message_id, thread_id, from, subject, link}` |

Ambos servem de **chave de idempotência**: as ferramentas consultam esses campos
antes de criar, então sincronizar duas vezes não duplica nada.
`checklist` segue a convenção do app: `[{ id, done, text }]`.

## Exemplos de uso

Depois de registrar, é só pedir em linguagem natural:

- "Quais tarefas estão atrasadas no SouCrum?"
- "Monte minha agenda de hoje e diga quais rotinas ainda faltam"
- "Resuma o projeto ERP Prado"
- "Crie uma tarefa 'Revisar contrato Curticouro' com prazo para sexta"
- "O que mudou no SouCrum nas últimas 24h?"
- "Envie o resumo das tarefas atrasadas no Slack e por e-mail para a equipe"

## Desenvolvimento

```bash
npm run dev        # tsc --watch
npm run typecheck  # checagem de tipos
```

Teste manual do protocolo (handshake + listar ferramentas):

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  | SOUCRUM_SUPABASE_KEY=... node dist/index.js
```
