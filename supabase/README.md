# Backend do SouCrum (Supabase)

Notificações por e-mail **multi-usuário com consentimento**: qualquer pessoa que
usa o app é perguntada no primeiro acesso e recebe avisos no próprio e-mail.

São **apenas dois avisos**:

| `kind` | O que manda |
|---|---|
| `overdue` | Tarefas com `due_date` no passado (rotina fechada hoje não conta) |
| `mentions` | Marcações não lidas (`notifications.type = 'mention'`) |

(`kind: "test"` existe só para checar a configuração; não lê dado nenhum.)

Projeto: `sbyivwkcvjkropoforqx` (região sa-east-1).

## Como está montado

```
  App (navegador)                    Edge Function              Resend
  ───────────────                    ─────────────              ──────
  1. primeiro acesso
     → pede permissão
     → grava consentimento  ──►  notification_prefs
                                  (RLS: só a própria linha)

  2. pede notificação       ──►  send-notification
     (com o JWT do usuário)       • valida o token
                                  • confere consentimento
                                  • confere a preferência do
                                    tipo (overdue/mentions)
                                  • destinatário = e-mail
                                    do próprio usuário     ──►  envia
                                  • registra em
                                    notification_log
                                  • avança last_mention_email_at
                                    (só se enviou)
```

## Por que a chave da Resend não fica no app

O envio acontece **na Edge Function**, não no navegador. Assim:

- A chave vive como *secret* do projeto — o usuário nunca a recebe.
- O cliente **não escolhe o destinatário**: a função envia sempre para o e-mail
  do usuário autenticado. Sem isso, qualquer pessoa com login poderia usar sua
  conta da Resend para mandar e-mail para terceiros (relé de spam).
- Sem consentimento registrado, a função responde **403** e não envia.

## Não repetir a mesma marcação

`notification_prefs.last_mention_email_at` guarda o `created_at` da marcação
mais nova já avisada. A consulta de marcações filtra por `created_at >` esse
valor, então nada é enviado duas vezes.

O marcador só avança **quando o envio dá certo**. Se a Resend falhar, ele fica
onde está e a marcação entra no próximo e-mail — falha não perde aviso.

## Configurar (uma vez)

### 1. Secrets

Dashboard → **Edge Functions → Secrets**:

| Secret | Valor |
|---|---|
| `RESEND_API_KEY` | a chave `re_...` da Resend |
| `NOTIFY_EMAIL_FROM` | `soucrum@seudominio.com.br` (domínio verificado) |
| `NOTIFY_APP_URL` | `https://soucrum.vercel.app` |

> ⚠️ Nunca coloque a chave no front-end, no repositório ou em conversa de chat.
> Se ela vazar, revogue em resend.com → API Keys e gere outra.

### 2. Domínio na Resend

resend.com → **Domains** → adicionar o domínio → incluir os registros DNS
(SPF/DKIM). Sem domínio verificado, a Resend só entrega para o e-mail da própria
conta — em produção o envio falha.

### 3. Deploy

Migrações e função já foram aplicadas (`create_notification_prefs` e
`notification_prefs_only_overdue_and_mentions`; função na versão 2). Para
reaplicar:

```bash
supabase db push                                  # migrations/
supabase functions deploy send-notification       # functions/
```

## Usar

```bash
BASE=https://sbyivwkcvjkropoforqx.supabase.co/functions/v1/send-notification

# teste (envia para o e-mail do usuário do token)
curl -X POST $BASE \
  -H "Authorization: Bearer <JWT_DO_USUARIO>" \
  -H "Content-Type: application/json" \
  -d '{"kind":"test"}'

curl ... -d '{"kind":"overdue"}'                  # tarefas vencidas
curl ... -d '{"kind":"mentions"}'                 # marcações novas
curl ... -d '{"kind":"overdue","dry_run":true}'   # mostra sem enviar
```

Respostas:

| Situação | Resposta |
|---|---|
| Enviou | `200 {sent:true, to, kind, title}` |
| Nada para avisar | `200 {sent:false, reason:"nenhuma tarefa vencida"}` |
| Tipo desligado | `200 {sent:false, reason:"avisos de marcações desligados"}` |
| Sem consentimento | `403 {sent:false, reason:"usuário não autorizou..."}` |
| Token ruim | `401 {error:"token inválido"}` |
| `kind` inválido | `400` |
| Resend recusou | `502 {sent:false, error}` |

## Envio automático (opcional, não configurado)

Para os avisos saírem sozinhos, agende com `pg_cron` + `pg_net`:

```sql
select cron.schedule('avisos-soucrum', '0 11 * * 1-5', $$
  select net.http_post(
    url := 'https://sbyivwkcvjkropoforqx.supabase.co/functions/v1/send-notification',
    headers := '{"Authorization":"Bearer <JWT>","Content-Type":"application/json"}'::jsonb,
    body := '{"kind":"overdue"}'::jsonb
  );
$$);
```

> `0 11 * * 1-5` = 8h de Brasília (o cron roda em UTC), dias de semana.
> Requer um token por usuário — avise se quiser que eu implemente essa parte,
> que exige um laço server-side sobre quem deu consentimento.

## Tabelas

| Tabela | Para quê | RLS |
|---|---|---|
| `notification_prefs` | Consentimento e as duas preferências por usuário | Cada um só a própria linha |
| `notification_log` | Auditoria dos envios | Leitura do próprio histórico |

Colunas de `notification_prefs`: `user_id`, `email`, `email_enabled`,
`consent_at`, `overdue_enabled`, `mentions_enabled`, `last_mention_email_at`,
`created_at`, `updated_at`.

Isolamento verificado no banco: dono vê a própria linha, outro usuário vê 0,
anônimo vê 0.

## Desfazer

```sql
drop table if exists public.notification_log;
drop table if exists public.notification_prefs;
drop function if exists public.touch_notification_prefs();
```
