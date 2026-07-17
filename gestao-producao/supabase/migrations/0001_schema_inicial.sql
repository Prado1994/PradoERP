-- =============================================================
-- Grupo Prado · Gestão de Produção por Ficha
-- Migration 0001 — schema inicial, regras de negócio e RLS
-- =============================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- Tabelas de domínio
-- ---------------------------------------------------------

create table public.unidades (
  id   serial primary key,
  nome text not null unique
);

create table public.etapas (
  id    serial primary key,
  nome  text not null unique,
  ordem int  not null unique,
  setor text
);

create table public.motivos_perda (
  id        serial primary key,
  descricao text not null unique,
  ativo     boolean not null default true
);

create table public.modelos (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,
  nome         text not null,
  marca        text not null check (marca in ('Safety Prado', 'Country Prado')),
  linha        text,
  grade_inicio int not null default 34,
  grade_fim    int not null default 44,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  check (grade_fim >= grade_inicio)
);

create table public.colaboradores (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  setor      text,
  funcao     text,
  unidade_id int references public.unidades (id),
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- Perfil de acesso vinculado ao usuário autenticado
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nome       text,
  papel      text not null default 'operador' check (papel in ('operador', 'supervisor', 'gestao')),
  unidade_id int references public.unidades (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Ordem de Produção e Ficha
-- ---------------------------------------------------------

create sequence public.seq_op_numero;
create sequence public.seq_ficha_numero;

create table public.ordens_producao (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique
                   default 'OP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.seq_op_numero')::text, 4, '0'),
  modelo_id        uuid not null references public.modelos (id),
  quantidade_total int not null check (quantidade_total > 0),
  unidade_id       int not null references public.unidades (id),
  data_abertura    date not null default current_date,
  prazo            date,
  status           text not null default 'aberta'
                   check (status in ('aberta', 'em_producao', 'concluida', 'cancelada')),
  criado_por       uuid references auth.users (id),
  created_at       timestamptz not null default now()
);

create table public.fichas (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null unique
                 default 'F-' || lpad(nextval('public.seq_ficha_numero')::text, 6, '0'),
  op_id          uuid not null references public.ordens_producao (id) on delete cascade,
  lote           text,
  quantidade     int not null check (quantidade > 0),
  grade          jsonb not null default '{}'::jsonb, -- ex.: {"38": 40, "39": 60}
  qr_token       uuid not null unique default gen_random_uuid(),
  etapa_atual_id int references public.etapas (id),
  status         text not null default 'em_andamento'
                 check (status in ('em_andamento', 'concluida', 'cancelada')),
  created_at     timestamptz not null default now()
);

create index fichas_op_idx on public.fichas (op_id);
create index fichas_status_idx on public.fichas (status);

-- Toda ficha nasce na primeira etapa do roteiro
create or replace function public.ficha_etapa_inicial()
returns trigger
language plpgsql
as $$
begin
  if new.etapa_atual_id is null then
    select id into new.etapa_atual_id from public.etapas order by ordem limit 1;
  end if;
  return new;
end;
$$;

create trigger trg_ficha_etapa_inicial
  before insert on public.fichas
  for each row execute function public.ficha_etapa_inicial();

-- ---------------------------------------------------------
-- Apontamento
-- ---------------------------------------------------------

create table public.apontamentos (
  id             uuid primary key default gen_random_uuid(),
  ficha_id       uuid not null references public.fichas (id) on delete cascade,
  etapa_id       int not null references public.etapas (id),
  colaborador_id uuid references public.colaboradores (id),
  usuario_id     uuid references auth.users (id),
  unidade_id     int not null references public.unidades (id),
  inicio         timestamptz,
  fim            timestamptz not null default now(),
  qtd_produzida  int not null check (qtd_produzida >= 0),
  qtd_perdida    int not null default 0 check (qtd_perdida >= 0),
  motivo_perda   text,
  created_at     timestamptz not null default now(),
  check (qtd_produzida + qtd_perdida > 0),
  check (qtd_perdida = 0 or motivo_perda is not null)
);

create index apontamentos_ficha_idx on public.apontamentos (ficha_id);
create index apontamentos_etapa_idx on public.apontamentos (etapa_id);
create index apontamentos_fim_idx on public.apontamentos (fim);

-- ---------------------------------------------------------
-- Regra central: registrar apontamento respeitando a sequência
-- de etapas, com apontamento parcial e avanço automático.
--
-- Quantidade disponível numa etapa = quantidade da ficha (1ª etapa)
-- ou soma produzida na etapa anterior. A etapa avança quando
-- produzido + perdido cobre tudo o que entrou nela.
-- ---------------------------------------------------------

create or replace function public.registrar_apontamento(
  p_qr_token       uuid,
  p_etapa_id       int,
  p_qtd_produzida  int,
  p_qtd_perdida    int default 0,
  p_motivo_perda   text default null,
  p_colaborador_id uuid default null,
  p_inicio         timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ficha         public.fichas%rowtype;
  v_op            public.ordens_producao%rowtype;
  v_etapa_ordem   int;
  v_qtd_entrada   int;
  v_produzido     int;
  v_perdido       int;
  v_proxima_etapa int;
  v_avancou       boolean := false;
  v_concluida     boolean := false;
begin
  select * into v_ficha from public.fichas where qr_token = p_qr_token for update;
  if not found then
    raise exception 'Ficha não encontrada para este QR Code.';
  end if;

  if v_ficha.status <> 'em_andamento' then
    raise exception 'Ficha % está % e não aceita apontamento.', v_ficha.numero, v_ficha.status;
  end if;

  if p_etapa_id <> v_ficha.etapa_atual_id then
    raise exception 'Etapa inválida: a ficha % está na etapa "%". Conclua a etapa atual antes de avançar.',
      v_ficha.numero, (select nome from public.etapas where id = v_ficha.etapa_atual_id);
  end if;

  if p_qtd_produzida < 0 or coalesce(p_qtd_perdida, 0) < 0 then
    raise exception 'Quantidades não podem ser negativas.';
  end if;

  if coalesce(p_qtd_perdida, 0) > 0 and nullif(trim(coalesce(p_motivo_perda, '')), '') is null then
    raise exception 'Informe o motivo da perda/refugo.';
  end if;

  select * into v_op from public.ordens_producao where id = v_ficha.op_id;
  select ordem into v_etapa_ordem from public.etapas where id = p_etapa_id;

  -- quantidade que entrou nesta etapa
  if v_etapa_ordem = (select min(ordem) from public.etapas) then
    v_qtd_entrada := v_ficha.quantidade;
  else
    select coalesce(sum(a.qtd_produzida), 0) into v_qtd_entrada
    from public.apontamentos a
    join public.etapas e on e.id = a.etapa_id
    where a.ficha_id = v_ficha.id
      and e.ordem = (select max(e2.ordem) from public.etapas e2 where e2.ordem < v_etapa_ordem);
  end if;

  -- já apontado nesta etapa
  select coalesce(sum(qtd_produzida), 0), coalesce(sum(qtd_perdida), 0)
    into v_produzido, v_perdido
  from public.apontamentos
  where ficha_id = v_ficha.id and etapa_id = p_etapa_id;

  if v_produzido + v_perdido + p_qtd_produzida + coalesce(p_qtd_perdida, 0) > v_qtd_entrada then
    raise exception 'Quantidade excede o disponível na etapa: entraram % pares, já apontados % (restam %).',
      v_qtd_entrada, v_produzido + v_perdido, v_qtd_entrada - v_produzido - v_perdido;
  end if;

  insert into public.apontamentos
    (ficha_id, etapa_id, colaborador_id, usuario_id, unidade_id,
     inicio, fim, qtd_produzida, qtd_perdida, motivo_perda)
  values
    (v_ficha.id, p_etapa_id, p_colaborador_id, auth.uid(), v_op.unidade_id,
     p_inicio, now(), p_qtd_produzida, coalesce(p_qtd_perdida, 0),
     nullif(trim(coalesce(p_motivo_perda, '')), ''));

  -- etapa concluída? avança ou encerra a ficha
  if v_produzido + v_perdido + p_qtd_produzida + coalesce(p_qtd_perdida, 0) >= v_qtd_entrada then
    select id into v_proxima_etapa
    from public.etapas
    where ordem > v_etapa_ordem
    order by ordem
    limit 1;

    if v_proxima_etapa is null or v_produzido + p_qtd_produzida = 0 then
      -- última etapa concluída, ou tudo perdido: ficha encerrada
      update public.fichas set status = 'concluida', etapa_atual_id = null where id = v_ficha.id;
      v_concluida := true;
    else
      update public.fichas set etapa_atual_id = v_proxima_etapa where id = v_ficha.id;
      v_avancou := true;
    end if;
  end if;

  -- status da OP
  if v_op.status = 'aberta' then
    update public.ordens_producao set status = 'em_producao' where id = v_op.id;
  end if;

  if v_concluida and not exists (
    select 1 from public.fichas
    where op_id = v_op.id and status = 'em_andamento'
  ) then
    update public.ordens_producao set status = 'concluida' where id = v_op.id;
  end if;

  return jsonb_build_object(
    'ficha', v_ficha.numero,
    'etapa_avancou', v_avancou,
    'ficha_concluida', v_concluida
  );
end;
$$;

-- ---------------------------------------------------------
-- Perfil automático para novos usuários
-- ---------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------
-- Views de acompanhamento e indicadores
-- ---------------------------------------------------------

-- Situação atual de cada ficha (painel de acompanhamento)
create or replace view public.vw_fichas_painel
with (security_invoker = true) as
select
  f.id,
  f.numero,
  f.status,
  f.quantidade,
  f.lote,
  f.qr_token,
  f.created_at,
  op.numero  as op_numero,
  op.prazo,
  op.status  as op_status,
  u.id       as unidade_id,
  u.nome     as unidade,
  m.codigo   as modelo_codigo,
  m.nome     as modelo_nome,
  m.marca,
  e.id       as etapa_atual_id,
  e.nome     as etapa_atual,
  e.ordem    as etapa_ordem,
  (op.prazo is not null and op.prazo < current_date and f.status = 'em_andamento') as atrasada,
  coalesce((select sum(a.qtd_produzida) from public.apontamentos a
            where a.ficha_id = f.id and a.etapa_id = f.etapa_atual_id), 0) as produzido_etapa_atual,
  coalesce((select max(a.fim) from public.apontamentos a where a.ficha_id = f.id), f.created_at) as ultimo_apontamento
from public.fichas f
join public.ordens_producao op on op.id = f.op_id
join public.unidades u on u.id = op.unidade_id
join public.modelos m on m.id = op.modelo_id
left join public.etapas e on e.id = f.etapa_atual_id;

-- Produção e perdas por dia / unidade / etapa (dashboard)
create or replace view public.vw_producao_diaria
with (security_invoker = true) as
select
  date(a.fim)         as dia,
  a.unidade_id,
  u.nome              as unidade,
  a.etapa_id,
  e.nome              as etapa,
  e.ordem             as etapa_ordem,
  sum(a.qtd_produzida) as produzido,
  sum(a.qtd_perdida)   as perdido
from public.apontamentos a
join public.unidades u on u.id = a.unidade_id
join public.etapas e on e.id = a.etapa_id
group by 1, 2, 3, 4, 5, 6;

-- Perdas por motivo (indicador de qualidade / ISO)
create or replace view public.vw_perdas_motivo
with (security_invoker = true) as
select
  date(a.fim)      as dia,
  a.unidade_id,
  u.nome           as unidade,
  e.nome           as etapa,
  coalesce(a.motivo_perda, 'Não informado') as motivo,
  sum(a.qtd_perdida) as perdido
from public.apontamentos a
join public.unidades u on u.id = a.unidade_id
join public.etapas e on e.id = a.etapa_id
where a.qtd_perdida > 0
group by 1, 2, 3, 4, 5;

-- ---------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------

create or replace function public.papel_usuario()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select papel from public.profiles where id = auth.uid()), 'operador');
$$;

alter table public.unidades         enable row level security;
alter table public.etapas           enable row level security;
alter table public.motivos_perda    enable row level security;
alter table public.modelos          enable row level security;
alter table public.colaboradores    enable row level security;
alter table public.profiles         enable row level security;
alter table public.ordens_producao  enable row level security;
alter table public.fichas           enable row level security;
alter table public.apontamentos     enable row level security;

-- Leitura: qualquer usuário autenticado
create policy sel_unidades        on public.unidades        for select to authenticated using (true);
create policy sel_etapas          on public.etapas          for select to authenticated using (true);
create policy sel_motivos         on public.motivos_perda   for select to authenticated using (true);
create policy sel_modelos         on public.modelos         for select to authenticated using (true);
create policy sel_colaboradores   on public.colaboradores   for select to authenticated using (true);
create policy sel_ops             on public.ordens_producao for select to authenticated using (true);
create policy sel_fichas          on public.fichas          for select to authenticated using (true);
create policy sel_apontamentos    on public.apontamentos    for select to authenticated using (true);

-- Perfis: cada um lê o próprio; gestão lê todos e altera papéis
create policy sel_profile_proprio on public.profiles for select to authenticated
  using (id = auth.uid() or public.papel_usuario() = 'gestao');
create policy upd_profile_gestao  on public.profiles for update to authenticated
  using (public.papel_usuario() = 'gestao');

-- Cadastros e OPs: supervisor e gestão
create policy ins_modelos on public.modelos for insert to authenticated
  with check (public.papel_usuario() in ('supervisor', 'gestao'));
create policy upd_modelos on public.modelos for update to authenticated
  using (public.papel_usuario() in ('supervisor', 'gestao'));

create policy ins_colaboradores on public.colaboradores for insert to authenticated
  with check (public.papel_usuario() in ('supervisor', 'gestao'));
create policy upd_colaboradores on public.colaboradores for update to authenticated
  using (public.papel_usuario() in ('supervisor', 'gestao'));

create policy ins_ops on public.ordens_producao for insert to authenticated
  with check (public.papel_usuario() in ('supervisor', 'gestao'));
create policy upd_ops on public.ordens_producao for update to authenticated
  using (public.papel_usuario() in ('supervisor', 'gestao'));

create policy ins_fichas on public.fichas for insert to authenticated
  with check (public.papel_usuario() in ('supervisor', 'gestao'));
create policy upd_fichas on public.fichas for update to authenticated
  using (public.papel_usuario() in ('supervisor', 'gestao'));

-- Apontamentos são gravados apenas pela função registrar_apontamento
-- (security definer); nenhuma policy de insert direto.
revoke execute on function public.registrar_apontamento(uuid, int, int, int, text, uuid, timestamptz) from public, anon;
grant execute on function public.registrar_apontamento(uuid, int, int, int, text, uuid, timestamptz) to authenticated;

-- Realtime no painel
alter publication supabase_realtime add table public.apontamentos;
alter publication supabase_realtime add table public.fichas;

-- ---------------------------------------------------------
-- Dados fixos (seeds de domínio)
-- ---------------------------------------------------------

insert into public.unidades (nome) values ('Itanhandu'), ('Guaxupé');

insert into public.etapas (nome, ordem, setor) values
  ('Corte',         1, 'Corte'),
  ('Pesponto',      2, 'Pesponto/Costura'),
  ('Pré-montagem',  3, 'Pré-montagem'),
  ('Montagem',      4, 'Montagem'),
  ('Acabamento',    5, 'Acabamento'),
  ('Expedição',     6, 'Expedição');

insert into public.motivos_perda (descricao) values
  ('Corte fora do padrão'),
  ('Costura defeituosa'),
  ('Material com defeito'),
  ('Falha de colagem/solado'),
  ('Dano no manuseio'),
  ('Erro de numeração/grade'),
  ('Outros');
