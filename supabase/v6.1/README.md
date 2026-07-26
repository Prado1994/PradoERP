# SouCrum v6.1 — ambiente recriado

Banco novo, criado do zero e carregado a partir do antigo. **O banco antigo não
foi tocado**: segue no ar, servindo o app em produção.

| | Antigo | v6.1 |
|---|---|---|
| Projeto | `sbyivwkcvjkropoforqx` | `njlnvcrcoebbednfrzhr` |
| Nome | soucrum | soucrum-v61 |
| Região | sa-east-1 | sa-east-1 |
| Custo | — | US$ 0/mês (plano gratuito) |

URL: `https://njlnvcrcoebbednfrzhr.supabase.co`
Chave publicável: `sb_publishable_IgYK8FpeOWNcYdGdiU065w_ibLgOaMu`

> A chave publicável é feita para viver no navegador — pode ir no front-end. A
> `service_role` **não**: ela ignora RLS e dá controle total do banco.

## Arquivos

| Arquivo | O que é |
|---|---|
| `01_schema.sql` | Esquema completo: 13 tabelas, 7 funções, 2 triggers, 7 índices, RLS e 26 políticas |
| `02_endurecimento.sql` | Fechamento de funções expostas por RPC — só no v6.1 |

O esquema foi **extraído do catálogo do banco em produção**, não escrito de
memória: tipos, defaults, constraints, índices, corpo das funções e expressões
das políticas vieram de `pg_catalog` / `pg_policies`.

## O que foi migrado

| Tabela | Linhas | Conferido |
|---|---|---|
| `auth.users` | 9 | md5 igual |
| `auth.identities` | 9 | md5 igual |
| `objects` | 52 | md5 igual |
| `projects` | 9 | md5 igual |
| `workspaces` | 4 | md5 igual |
| `workspace_members` | 10 | md5 igual |
| `workspace_invites` | 1 | — |
| `pages` | 1 | — |
| `notifications` | 2 | — |

A conferência não foi por contagem: gerei um `md5` do conteúdo concatenado
(ids, títulos, status, prazos, recorrência, checklists) nos dois bancos e
comparei. Os seis hashes bateram exatamente.

**Os UUIDs foram preservados.** É isso que mantém cada projeto, cartão e página
pertencendo à mesma pessoa.

## O que NÃO foi migrado, e por quê

| Tabela | Linhas | Motivo |
|---|---|---|
| `activity` | 1.206 | Feed append-only de auditoria (263 kB). Histórico, não estado — o app funciona sem ele. Migrável depois se quiser. |
| `backups` | 3 | Snapshot do cliente (104 kB), redundante com as tabelas vivas. |
| `transactions` | 0 | Vazia na origem. |
| `card_shares` | 0 | Vazia na origem. |
| `notification_prefs` / `notification_log` | 0 | Vazias na origem. |

## Senhas: nenhuma foi copiada

`encrypted_password` ficou **NULL** para todos os 9 usuários. Não movi hash de
senha por este canal.

Isso importa menos do que parece: **6 dos 9 usuários entram por Google OAuth** e
não têm senha nenhuma. Para eles o login funciona assim que o provedor Google
estiver configurado — as linhas de `auth.identities` foram copiadas com o mesmo
`provider_id` (o `sub` do Google), então o login cai no **mesmo UUID** e cada um
reencontra os próprios dados.

Os 3 restantes (`share-14291@`, `sw-31024@`, `inv-12505@` em `example.com`) são
contas de teste.

## Para o v6.1 entrar em uso

1. **Google OAuth**: Authentication → Providers → Google, com o mesmo Client ID
   e Secret do projeto antigo. Sem isso os 6 usuários não entram.
   Incluir a URL do app em Authentication → URL Configuration → Redirect URLs.
2. **Secrets da Edge Function** (Edge Functions → Secrets):
   `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, `NOTIFY_APP_URL`.
3. **Apontar o app** para a URL e a chave publicável acima.
4. Opcional: ligar *leaked password protection* em Authentication → Policies.

A função `send-notification` já está publicada (versão 1, `verify_jwt` ligado),
com os dois avisos: `overdue` e `mentions`. Ver `../README.md`.

## Verificações feitas no banco novo

- **Trigger sobrevive ao endurecimento**: inserindo workspace como
  `authenticated`, `add_owner_as_member` continuou criando a linha de membro
  `owner`, mesmo com `EXECUTE` revogado. Testado em transação e desfeito.
- **Isolamento por RLS**:

  | Quem | objects | projects | workspaces |
  |---|---|---|---|
  | Dono da maior parte dos dados | 50 | 7 | 3 |
  | Outro usuário, sem vínculo | 0 | 0 | 0 |
  | Anônimo | 0 | 0 | 0 |

  50 dos 52 objetos, e não 52, porque 2 pertencem a outro usuário em projeto que
  não compartilha workspace. Está correto.

## Dados pessoais não entram no repositório

Este diretório tem **apenas esquema**. O dump de dados não foi commitado porque
`Prado1994/PradoERP` é um repositório **público** — subir os inserts publicaria
e-mails da equipe, UUIDs de usuários e descrições internas dos projetos. A carga
foi feita direto de banco para banco.

Para exportar de novo, gere no banco de origem e aplique no destino sem passar
pelo Git:

```sql
select string_agg(format('insert into public.objects (...) values (%L,...);', id, ...), E'\n')
from public.objects;
```

## Desfazer

O v6.1 é isolado: apagar o projeto `njlnvcrcoebbednfrzhr` no painel da Supabase
não afeta nada do ambiente antigo.
