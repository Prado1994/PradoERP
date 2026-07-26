# Usar o SouCrum MCP com Claude, Gemini, Notion e Google

## O conceito

Um cliente MCP conecta **vários servidores ao mesmo tempo**. Você não embute o
Notion nem o Google dentro do SouCrum: registra os três lado a lado, e o
assistente combina as ferramentas numa mesma conversa.

```
        Claude Desktop / Claude Code / Gemini CLI
                      (cliente MCP)
        ┌──────────────┼──────────────┬────────────────┐
        ▼              ▼              ▼                ▼
   soucrum-mcp    notion-mcp    google-workspace   (outros)
   (este repo)    (oficial)     Calendar/Drive/Gmail
        │
   Supabase
```

Assim dá para pedir coisas atravessadas:

> "Pegue as tarefas atrasadas do SouCrum, crie um resumo como página no Notion e
> agende as 3 mais urgentes no meu Google Calendar."

O assistente usa `search_tasks` (SouCrum) → `export_project_markdown` (SouCrum) →
`notion-create-pages` (Notion) → `export_agenda_for_calendar` (SouCrum) →
`create_event` (Google) → `link_gcal_event` (SouCrum, para não duplicar depois).

## Configuração por cliente

| Cliente | Onde colocar | Arquivo de exemplo |
|---|---|---|
| **Claude Desktop** | macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`<br>Windows: `%APPDATA%\Claude\claude_desktop_config.json` | `claude_desktop_config.json` |
| **Claude Code** | `claude mcp add …` (abaixo) | — |
| **Gemini CLI** | `~/.gemini/settings.json` | `gemini-settings.json` |
| **Cursor** | `~/.cursor/mcp.json` (mesmo formato do Claude Desktop) | reutilize o do Claude |

### Claude Code (linha de comando)

```bash
# SouCrum
claude mcp add soucrum \
  --env SOUCRUM_SUPABASE_URL=https://sbyivwkcvjkropoforqx.supabase.co \
  --env SOUCRUM_SUPABASE_KEY=sb_publishable_... \
  --env SOUCRUM_USER_JWT=... \
  -- node /CAMINHO/PradoERP/soucrum-mcp/dist/index.js

# Notion
claude mcp add notion --env NOTION_TOKEN=ntn_... -- npx -y @notionhq/notion-mcp-server

# Conferir
claude mcp list
```

> No **Claude.ai / app web**, Notion e Google entram como **conectores** nas
> configurações (não precisam desses arquivos). Só o `soucrum` exige rodar local.

## Credenciais de cada serviço

### SouCrum
Ver o [README principal](../README.md). Prefira `anon`/`publishable` +
`SOUCRUM_USER_JWT` — respeita RLS e limita o assistente aos dados daquele usuário.

### Notion
1. https://www.notion.so/my-integrations → **New integration**
2. Copie o *Internal Integration Token* (`ntn_…`)
3. **Importante:** na página/database do Notion, menu `⋯` → **Connections** →
   adicione a integração. Sem isso o token não enxerga nada.

### Google (Calendar, Drive, Gmail)
1. Google Cloud Console → crie um projeto
2. **APIs & Services → Library**: ative Calendar API, Drive API, Gmail API
3. **Credentials → OAuth client ID** (tipo *Desktop app*)
4. Use Client ID + Secret nas variáveis; o primeiro uso abre o navegador para
   consentimento e guarda o token localmente

## Segurança

- 🔒 Esses arquivos contêm **segredos**. Não commite os preenchidos — os exemplos
  aqui têm apenas placeholders, e `.gitignore` cobre `.env`.
- Escopo mínimo: dê ao token do Notion acesso só às páginas necessárias, e no
  Google prefira escopos de leitura quando não precisar escrever.
- Para expor o SouCrum sem risco de escrita: `SOUCRUM_READ_ONLY=true`.

## Ferramentas-ponte do SouCrum

Criadas justamente para essa interoperabilidade:

| Ferramenta | Para quê |
|---|---|
| `export_agenda_for_calendar` | Devolve cartões com prazo já no formato de evento do Google Calendar, marcando os que ainda **não** foram sincronizados |
| `link_gcal_event` | Grava o `gcal_event_id` devolvido pelo Google, evitando duplicar na próxima sincronização |
| `export_project_markdown` | Projeto + cartões agrupados por status em Markdown, pronto para virar página no Notion ou doc no Google |
| `create_task_from_email` | Transforma e-mail do Gmail em cartão, guardando o vínculo com a mensagem |
| `find_task_by_email` | Checa se um e-mail já virou cartão, antes de criar |
| `list_email_tasks` | Lista os cartões que vieram de e-mail, com remetente e link |

### Fluxo Gmail → SouCrum

```
gmail search_threads / get_message   (servidor do Google)
        ↓  message_id, assunto, remetente, corpo
create_task_from_email               (SouCrum)
        ↓  grava em attachments: {type:email, source:gmail, message_id, link}
```

**Idempotente por desenho:** o `message_id` fica gravado em `attachments` e a
ferramenta consulta antes de inserir (containment jsonb `@>`). Se você reprocessar
a mesma caixa de entrada, ela devolve o cartão existente em vez de criar outro —
então dá para rodar "triagem da inbox" quantas vezes quiser sem sujar o quadro.

Exemplo de pedido:

> "Veja os e-mails não lidos de fornecedores desta semana, transforme cada um em
> cartão no projeto Compras com checklist de providências, e me diga quais já
> existiam."

> Nota: hoje **nenhum** dos 52 cartões tem `gcal_event_id` preenchido — a coluna
> existia no schema mas a sincronização nunca foi usada. Essas ferramentas
> destravam isso.
