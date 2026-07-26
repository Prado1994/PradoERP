# Backend do SouCrum (Supabase)

Notificações por e-mail **multi-usuário com consentimento**: qualquer pessoa que
usa o app é perguntada no primeiro acesso e recebe avisos no próprio e-mail.

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
                                  • destinatário = e-mail
                                    do próprio usuário     ──►  envia
                                  • registra em
                                    notification_log
```

## Por que a chave da Resend não fica no app

O envio acontece **na Edge Function**, não no navegador. Assim:

- A chave vive como *secret* do projeto — o usuário nunca a recebe.
- O cliente **não escolhe o destinatário**: a função envia sempre para o e-mail
  do usuário autenticado. Sem isso, qualquer pessoa com login poderia usar sua
  conta da Resend para mandar e-mail para terceiros (relé de spam).
- Sem consentimento registrado, a função responde **403** e não envia.

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

Migração e função já foram aplicadas. Para reaplicar:

```bash
supabase db push                                  # migrations/
supabase functions deploy send-notification       # functions/
```

## Usar

```bash
# teste (envia para o e-mail do usuário do token)
curl -X POST https://sbyivwkcvjkropoforqx.supabase.co/functions/v1/send-notification \
  -H "Authorization: Bearer <JWT_DO_USUARIO>" \
  -H "Content-Type: application/json" \
  -d '{"kind":"test"}'

# resumo de atrasadas
curl ... -d '{"kind":"overdue"}'

# simulação: mostra o que enviaria, sem enviar
curl ... -d '{"kind":"overdue","dry_run":true}'
```

Respostas: `{sent:true,...}` · `403` sem consentimento · `401` token inválido ·
`502` com o erro da Resend.

## Envio automático (opcional, não configurado)

Para o resumo diário sair sozinho, agende com `pg_cron` + `pg_net`:

```sql
select cron.schedule('resumo-atrasadas', '0 11 * * 1-5', $$
  select net.http_post(
    url := 'https://sbyivwkcvjkropoforqx.supabase.co/functions/v1/send-notification',
    headers := '{"Authorization":"Bearer <JWT>","Content-Type":"application/json"}'::jsonb,
    body := '{"kind":"overdue"}'::jsonb
  );
$$);
```

> `0 11 * * 1-5` = 8h de Brasília (o cron roda em UTC), dias de semana.
> Requer um token de serviço por usuário — avise se quiser que eu implemente
> essa parte, que exige um laço server-side sobre quem deu consentimento.

## Tabelas

| Tabela | Para quê | RLS |
|---|---|---|
| `notification_prefs` | Consentimento e preferências por usuário | Cada um só a própria linha |
| `notification_log` | Auditoria dos envios | Leitura do próprio histórico |

Isolamento verificado no banco: dono vê a própria linha, outro usuário vê 0,
anônimo vê 0.

## Desfazer

```sql
drop table if exists public.notification_log;
drop table if exists public.notification_prefs;
drop function if exists public.touch_notification_prefs();
```
