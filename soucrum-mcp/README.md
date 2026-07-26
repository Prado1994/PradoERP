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

## Ferramentas (15)

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

### Escrita (desativáveis via `SOUCRUM_READ_ONLY`)
| Ferramenta | O que faz |
|---|---|
| `create_task` | Cria cartão (tarefa, jot ou rotina) |
| `update_task` | Atualiza cartão: status, prazo, responsável, agenda… |
| `complete_routine` | Conclui o ciclo de uma rotina (grava `last_done`) |

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

## Exemplos de uso

Depois de registrar, é só pedir em linguagem natural:

- "Quais tarefas estão atrasadas no SouCrum?"
- "Monte minha agenda de hoje e diga quais rotinas ainda faltam"
- "Resuma o projeto ERP Prado"
- "Crie uma tarefa 'Revisar contrato Curticouro' com prazo para sexta"
- "O que mudou no SouCrum nas últimas 24h?"

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
