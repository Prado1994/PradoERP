-- Restringe as notificações a dois tipos: tarefas vencidas e marcações.
--
-- Aplicada no projeto sbyivwkcvjkropoforqx em 2026-07-26
-- (versão 20260726153610).
--
-- Antes existiam três chaves (overdue_daily, weekly_summary, task_assigned).
-- O resumo semanal sai de cena; as outras duas passam a ter nome que combina
-- com o que a Edge Function aceita em `kind` (overdue | mentions).

alter table public.notification_prefs
  drop column if exists weekly_summary;

alter table public.notification_prefs
  rename column overdue_daily to overdue_enabled;

alter table public.notification_prefs
  rename column task_assigned to mentions_enabled;

-- Marcador anti-reenvio: guarda o created_at da marcação mais nova já avisada
-- por e-mail. A função só avança este campo quando o envio dá certo, então uma
-- falha da Resend não faz a marcação desaparecer do próximo e-mail.
alter table public.notification_prefs
  add column if not exists last_mention_email_at timestamptz;

comment on column public.notification_prefs.overdue_enabled is
  'Avisar por e-mail sobre tarefas com due_date no passado.';
comment on column public.notification_prefs.mentions_enabled is
  'Avisar por e-mail quando o usuário for marcado (notifications.type = mention).';
comment on column public.notification_prefs.last_mention_email_at is
  'created_at da marcação mais recente já enviada por e-mail. Evita reenvio.';

-- Para desfazer:
--   alter table public.notification_prefs drop column last_mention_email_at;
--   alter table public.notification_prefs rename column mentions_enabled to task_assigned;
--   alter table public.notification_prefs rename column overdue_enabled to overdue_daily;
--   alter table public.notification_prefs add column weekly_summary boolean not null default false;
