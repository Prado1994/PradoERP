-- =============================================================================
-- SouCrum v6.1 — esquema completo, do zero
-- =============================================================================
--
-- Recria todo o ambiente em um projeto Supabase novo e vazio. Extraído do
-- projeto sbyivwkcvjkropoforqx (Postgres 17.6) em 2026-07-26, e não de memória:
-- tipos, defaults, constraints, índices, funções, triggers e políticas foram
-- lidos do catálogo do banco em produção.
--
-- Ordem obrigatória: tabelas → funções → triggers → índices → RLS/políticas.
-- As funções são compiladas na criação e referenciam tabelas; as políticas
-- chamam is_member(). Trocar a ordem quebra o script.
--
-- Aplicar:
--   supabase db execute --file supabase/v6.1/01_schema.sql
--   depois 02_data.sql, se for migrar os dados do banco antigo.

begin;

-- -----------------------------------------------------------------------------
-- 0. Extensões
-- -----------------------------------------------------------------------------
-- pgcrypto: gen_random_bytes(), usado no token de card_shares.
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Tabelas, em ordem de dependência
-- -----------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('owner', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  -- Convite não cria dono: só member ou viewer.
  role text not null default 'member' check (role in ('member', 'viewer')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#7c6afa',
  cycle jsonb,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  deadline date,
  description text,
  folders jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela central: tarefa, rotina e nota são todas `objects`.
--
-- ATENÇÃO a `status`: é TEXTO LIVRE, sem enum e sem check. O fluxo real é
--   jot → extracted → refined → scheduled
-- e NÃO existe o valor 'done'. Conclusão de rotina se registra em `last_done`
-- (data do último ciclo fechado), nunca no status. Filtrar por status <> 'done'
-- não exclui nada e faz agenda e resumo de atrasadas perderem o sentido.
create table public.objects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  parent_id uuid references public.objects(id) on delete set null,
  type text not null default 'jot',
  title text not null,
  body text default ''::text,
  tags text[] default '{}'::text[],
  status text not null default 'jot',
  area text,
  due_date date,
  started_at date,
  eisenhower text,
  pom_est integer default 0,
  pom_done integer default 0,
  show_in_agenda boolean default false,
  -- Recorrência da rotina + data do último ciclo concluído.
  recurrence text,
  last_done date,
  assignee text,
  checklist jsonb default '[]'::jsonb,
  comments jsonb default '[]'::jsonb,
  -- attachments guarda, entre outros, o message_id do Gmail. A ponte de e-mail
  -- deduplica com o operador de contenção: attachments @> '[{"message_id":...}]'
  attachments jsonb default '[]'::jsonb,
  -- Idempotência com o Google Calendar: um evento por cartão.
  gcal_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null default 'Sem título',
  content text default ''::text,
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  amount numeric not null,
  unit text default 'un'::text,
  tx_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action text not null,
  entity_type text not null,
  entity_title text not null,
  project_id uuid,
  object_id uuid,
  created_at timestamptz default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_email text not null,
  -- 'mention' é o tipo em uso; o e-mail de marcações lê daqui.
  type text not null,
  message text not null,
  object_id uuid,
  read boolean default false,
  created_at timestamptz default now()
);

create table public.card_shares (
  token text primary key default encode(extensions.gen_random_bytes(16), 'hex'),
  object_id uuid not null references public.objects(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  revoked boolean not null default false,
  created_at timestamptz default now()
);

create table public.backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data text not null,
  updated_at timestamptz not null default now()
);

-- Consentimento de e-mail. Dois avisos, e nada mais: tarefas vencidas e
-- marcações. Ver 03_edge_function_send-notification.ts.
create table public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Destino. Vem do e-mail autenticado; o cliente nunca escolhe destinatário.
  email text not null,
  email_enabled boolean not null default false,
  -- Nulo = nunca foi perguntado.
  consent_at timestamptz,
  overdue_enabled boolean not null default true,
  mentions_enabled boolean not null default true,
  -- created_at da marcação mais nova já enviada. Só avança quando o envio dá
  -- certo, para uma falha da Resend não apagar o aviso.
  last_mention_email_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  kind text not null,
  subject text,
  status text not null,
  error text,
  sent_at timestamptz not null default now()
);

comment on column public.objects.status is
  'Texto livre: jot | extracted | refined | scheduled. Não existe done.';
comment on column public.objects.last_done is
  'Data do último ciclo concluído da rotina. É aqui que se lê conclusão.';
comment on column public.notification_prefs.last_mention_email_at is
  'created_at da marcação mais recente já enviada por e-mail. Evita reenvio.';

-- -----------------------------------------------------------------------------
-- 2. Funções
-- -----------------------------------------------------------------------------

-- Pertence ao workspace? SECURITY DEFINER para as políticas poderem chamar sem
-- cair na própria RLS de workspace_members (recursão).
create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists(
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, email, role)
  values (new.id, new.owner_id, (select email from auth.users where id = new.owner_id), 'owner')
  on conflict do nothing;
  return new;
end $$;

create or replace function public.accept_my_invites()
returns void language plpgsql security definer set search_path to 'public'
as $$
declare inv record; my_email text;
begin
  select email into my_email from auth.users where id = auth.uid();
  for inv in select * from public.workspace_invites where email = my_email loop
    insert into public.workspace_members (workspace_id, user_id, email, role)
    values (inv.workspace_id, auth.uid(), my_email, inv.role)
    on conflict (workspace_id, user_id) do nothing;
    delete from public.workspace_invites where id = inv.id;
  end loop;
end $$;

-- Cartão público por token: entrega só os campos abaixo, sem expor owner_id
-- nem a linha inteira. Revogar = card_shares.revoked = true.
create or replace function public.get_shared_card(p_token text)
returns table(
  id uuid, title text, body text, status text, due_date date, eisenhower text,
  pom_est integer, pom_done integer, recurrence text, area text,
  checklist jsonb, comments jsonb, project_name text, project_color text,
  created_at timestamptz, updated_at timestamptz
) language sql stable security definer set search_path to 'public'
as $$
  select o.id, o.title, o.body, o.status, o.due_date, o.eisenhower,
         o.pom_est, o.pom_done, o.recurrence, o.area,
         to_jsonb(o.checklist), to_jsonb(o.comments),
         p.name, p.color, o.created_at, o.updated_at
  from card_shares s
  join objects o on o.id = s.object_id
  left join projects p on p.id = o.project_id
  where s.token = p_token and s.revoked = false
$$;

create or replace function public.get_shared_card_children(p_token text)
returns table(id uuid, title text, status text)
language sql stable security definer set search_path to 'public'
as $$
  select c.id, c.title, c.status
  from card_shares s
  join objects c on c.parent_id = s.object_id
  where s.token = p_token and s.revoked = false
$$;

-- Marca alguém por e-mail. Silencioso se o e-mail não existe, de propósito:
-- não confirma para quem chamou se aquele endereço tem conta.
create or replace function public.notify_by_email(
  p_email text, p_type text, p_message text, p_object_id uuid default null
) returns void language plpgsql security definer set search_path to 'public'
as $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where lower(email) = lower(p_email) limit 1;
  if v_uid is null then return; end if;
  insert into public.notifications (user_id, actor_email, type, message, object_id)
  values (
    v_uid,
    coalesce((select email from auth.users where id = auth.uid()), 'alguém'),
    p_type, p_message, p_object_id
  );
end $$;

create or replace function public.touch_notification_prefs()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Triggers
-- -----------------------------------------------------------------------------

create trigger trg_ws_owner after insert on public.workspaces
  for each row execute function public.add_owner_as_member();

create trigger notification_prefs_touch before update on public.notification_prefs
  for each row execute function public.touch_notification_prefs();

-- -----------------------------------------------------------------------------
-- 4. Índices
-- -----------------------------------------------------------------------------

create index objects_owner_idx on public.objects (owner_id);
create index objects_project_idx on public.objects (project_id);
create index objects_parent_idx on public.objects (parent_id);
create index pages_proj_idx on public.pages (project_id);
create index tx_owner_idx on public.transactions (owner_id, tx_date desc);
create index card_shares_object_idx on public.card_shares (object_id);
create index notification_log_user_sent_idx on public.notification_log (user_id, sent_at desc);

-- -----------------------------------------------------------------------------
-- 5. RLS
-- -----------------------------------------------------------------------------

alter table public.workspaces          enable row level security;
alter table public.workspace_members   enable row level security;
alter table public.workspace_invites   enable row level security;
alter table public.projects            enable row level security;
alter table public.objects             enable row level security;
alter table public.pages               enable row level security;
alter table public.transactions        enable row level security;
alter table public.activity            enable row level security;
alter table public.notifications       enable row level security;
alter table public.card_shares         enable row level security;
alter table public.backups             enable row level security;
alter table public.notification_prefs  enable row level security;
alter table public.notification_log    enable row level security;

-- Workspaces
create policy ws_select on public.workspaces
  for select using (is_member(id) or owner_id = auth.uid());
create policy ws_insert on public.workspaces
  for insert with check (owner_id = auth.uid());
create policy ws_update on public.workspaces
  for update using (owner_id = auth.uid());
create policy ws_delete on public.workspaces
  for delete using (owner_id = auth.uid());

create policy wm_select on public.workspace_members
  for select using (is_member(workspace_id));
create policy wm_owner_manage on public.workspace_members
  for all using (exists (
    select 1 from public.workspaces w
    where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
  )) with check (exists (
    select 1 from public.workspaces w
    where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
  ));

create policy wi_owner on public.workspace_invites
  for all using (exists (
    select 1 from public.workspaces w
    where w.id = workspace_invites.workspace_id and w.owner_id = auth.uid()
  )) with check (exists (
    select 1 from public.workspaces w
    where w.id = workspace_invites.workspace_id and w.owner_id = auth.uid()
  ));
-- O convidado enxerga o próprio convite antes de ser membro: casa pelo e-mail
-- do JWT, porque ainda não existe linha em workspace_members.
create policy wi_invitee_select on public.workspace_invites
  for select using (email = (auth.jwt() ->> 'email'));

-- Projetos, objetos e páginas: dono, ou membro do workspace do projeto.
create policy projects_access on public.projects
  for all using (owner_id = auth.uid() or (workspace_id is not null and is_member(workspace_id)))
  with check (owner_id = auth.uid() or (workspace_id is not null and is_member(workspace_id)));

create policy objects_access on public.objects
  for all using (
    owner_id = auth.uid() or exists (
      select 1 from public.projects p
      where p.id = objects.project_id and p.workspace_id is not null and is_member(p.workspace_id)
    )
  ) with check (
    owner_id = auth.uid() or exists (
      select 1 from public.projects p
      where p.id = objects.project_id and p.workspace_id is not null and is_member(p.workspace_id)
    )
  );

create policy pages_access on public.pages
  for all using (
    owner_id = auth.uid() or exists (
      select 1 from public.projects p
      where p.id = pages.project_id and p.workspace_id is not null and is_member(p.workspace_id)
    )
  ) with check (
    owner_id = auth.uid() or exists (
      select 1 from public.projects p
      where p.id = pages.project_id and p.workspace_id is not null and is_member(p.workspace_id)
    )
  );

create policy tx_owner on public.transactions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Feed: visível se não tem projeto, ou se o projeto passa pela RLS de projects.
create policy activity_select_visible on public.activity
  for select to authenticated
  using (project_id is null or project_id in (select projects.id from public.projects));
create policy activity_insert_auth on public.activity
  for insert to authenticated with check (true);

create policy notif_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notif_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid());
-- Insert liberado porque marcar outra pessoa grava na linha dela. O destinatário
-- é resolvido por notify_by_email(), não escolhido pelo cliente.
create policy notif_insert_auth on public.notifications
  for insert to authenticated with check (true);

create policy shares_select_own on public.card_shares
  for select to authenticated
  using (created_by = auth.uid() or object_id in (select objects.id from public.objects));
create policy shares_insert_visible on public.card_shares
  for insert to authenticated
  with check (object_id in (select objects.id from public.objects));
create policy shares_update_own on public.card_shares
  for update to authenticated using (created_by = auth.uid());

create policy own_select on public.backups
  for select using (auth.uid() = user_id);
create policy own_insert on public.backups
  for insert with check (auth.uid() = user_id);
create policy own_update on public.backups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy notification_prefs_select_own on public.notification_prefs
  for select using (auth.uid() = user_id);
create policy notification_prefs_insert_own on public.notification_prefs
  for insert with check (auth.uid() = user_id);
create policy notification_prefs_update_own on public.notification_prefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Só leitura do próprio histórico. A escrita é da Edge Function com service
-- role, então não existe policy de insert para o usuário.
create policy notification_log_select_own on public.notification_log
  for select using (auth.uid() = user_id);

commit;
