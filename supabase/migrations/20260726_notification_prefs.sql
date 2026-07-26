-- Notificações por usuário, com consentimento explícito.
--
-- Aplicada no projeto sbyivwkcvjkropoforqx em 2026-07-26.
-- Aditiva: cria tabelas novas, não altera nenhuma existente.
--
-- Para desfazer:
--   drop table if exists public.notification_log;
--   drop table if exists public.notification_prefs;
--   drop function if exists public.touch_notification_prefs();

create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Destino. Preenchido a partir do e-mail autenticado; o cliente não escolhe
  -- destinatário arbitrário (evita usar a conta de envio como relé de spam).
  email text not null,
  email_enabled boolean not null default false,
  -- Quando o usuário aceitou receber. Nulo = nunca foi perguntado.
  consent_at timestamptz,
  -- Tipos de aviso
  overdue_daily boolean not null default true,
  weekly_summary boolean not null default false,
  task_assigned boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

-- Cada usuário vê e altera apenas a própria linha.
drop policy if exists notification_prefs_select_own on public.notification_prefs;
create policy notification_prefs_select_own on public.notification_prefs
  for select using (auth.uid() = user_id);

drop policy if exists notification_prefs_insert_own on public.notification_prefs;
create policy notification_prefs_insert_own on public.notification_prefs
  for insert with check (auth.uid() = user_id);

drop policy if exists notification_prefs_update_own on public.notification_prefs;
create policy notification_prefs_update_own on public.notification_prefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Registro de envios: auditoria e base para não repetir o mesmo aviso no dia.
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  kind text not null,
  subject text,
  status text not null,
  error text,
  sent_at timestamptz not null default now()
);

alter table public.notification_log enable row level security;

-- Só leitura do próprio histórico. A escrita é feita pela Edge Function com
-- service role, então não há policy de insert para o usuário.
drop policy if exists notification_log_select_own on public.notification_log;
create policy notification_log_select_own on public.notification_log
  for select using (auth.uid() = user_id);

create index if not exists notification_log_user_sent_idx
  on public.notification_log (user_id, sent_at desc);

create or replace function public.touch_notification_prefs()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists notification_prefs_touch on public.notification_prefs;
create trigger notification_prefs_touch before update on public.notification_prefs
  for each row execute function public.touch_notification_prefs();
