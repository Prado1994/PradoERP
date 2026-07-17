-- =============================================================
-- Grupo Prado · Gestão de Produção por Ficha
-- Migration 0002 — hierarquia de planejamento:
--   Plano de Produção → Pedidos (itens por modelo) → OPs
-- =============================================================

create sequence public.seq_plano_numero;
create sequence public.seq_pedido_numero;

-- ---------------------------------------------------------
-- Plano de Produção: agrupa vários pedidos num período
-- ---------------------------------------------------------

create table public.planos_producao (
  id          uuid primary key default gen_random_uuid(),
  numero      text not null unique
              default 'PL-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.seq_plano_numero')::text, 3, '0'),
  nome        text not null,
  data_inicio date,
  data_fim    date,
  status      text not null default 'aberto'
              check (status in ('aberto', 'em_producao', 'concluido', 'cancelado')),
  observacao  text,
  criado_por  uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  check (data_fim is null or data_inicio is null or data_fim >= data_inicio)
);

-- ---------------------------------------------------------
-- Pedido: encomenda de um cliente/canal, com itens por modelo.
-- Pode nascer avulso e ser vinculado a um plano depois.
-- ---------------------------------------------------------

create table public.pedidos (
  id         uuid primary key default gen_random_uuid(),
  numero     text not null unique
             default 'PD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.seq_pedido_numero')::text, 4, '0'),
  plano_id   uuid references public.planos_producao (id) on delete set null,
  cliente    text not null,
  canal      text check (canal in ('B2B', 'Representante', 'Marketplace', 'Outro')),
  prazo      date,
  status     text not null default 'aberto'
             check (status in ('aberto', 'concluido', 'cancelado')),
  observacao text,
  created_at timestamptz not null default now()
);

create index pedidos_plano_idx on public.pedidos (plano_id);

create table public.pedido_itens (
  id         uuid primary key default gen_random_uuid(),
  pedido_id  uuid not null references public.pedidos (id) on delete cascade,
  modelo_id  uuid not null references public.modelos (id),
  quantidade int not null check (quantidade > 0),
  grade      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index pedido_itens_pedido_idx on public.pedido_itens (pedido_id);

-- OP passa a poder atender um pedido (o modelo da OP indica o item)
alter table public.ordens_producao
  add column pedido_id uuid references public.pedidos (id) on delete set null;

create index ops_pedido_idx on public.ordens_producao (pedido_id);

-- ---------------------------------------------------------
-- Views de acompanhamento da hierarquia
-- ---------------------------------------------------------

-- Resumo por pedido: pares pedidos vs em OP vs concluídos
create or replace view public.vw_pedidos_resumo
with (security_invoker = true) as
select
  p.id,
  p.numero,
  p.cliente,
  p.canal,
  p.prazo,
  p.status,
  p.plano_id,
  p.created_at,
  pl.numero as plano_numero,
  coalesce(i.pares, 0)             as pares_pedidos,
  coalesce(o.pares_em_op, 0)       as pares_em_op,
  coalesce(o.pares_concluidos, 0)  as pares_concluidos,
  (p.prazo is not null and p.prazo < current_date and p.status = 'aberto') as atrasado
from public.pedidos p
left join public.planos_producao pl on pl.id = p.plano_id
left join lateral (
  select sum(quantidade) as pares
  from public.pedido_itens
  where pedido_id = p.id
) i on true
left join lateral (
  select
    sum(op.quantidade_total) as pares_em_op,
    coalesce(sum((
      select coalesce(sum(f.quantidade), 0)
      from public.fichas f
      where f.op_id = op.id and f.status = 'concluida'
    )), 0) as pares_concluidos
  from public.ordens_producao op
  where op.pedido_id = p.id and op.status <> 'cancelada'
) o on true;

-- Resumo por plano: consolida os pedidos vinculados
create or replace view public.vw_planos_resumo
with (security_invoker = true) as
select
  pl.id,
  pl.numero,
  pl.nome,
  pl.data_inicio,
  pl.data_fim,
  pl.status,
  pl.observacao,
  pl.created_at,
  count(pr.id)                            as total_pedidos,
  coalesce(sum(pr.pares_pedidos), 0)      as pares_pedidos,
  coalesce(sum(pr.pares_em_op), 0)        as pares_em_op,
  coalesce(sum(pr.pares_concluidos), 0)   as pares_concluidos
from public.planos_producao pl
left join public.vw_pedidos_resumo pr on pr.plano_id = pl.id
group by pl.id;

-- Itens do pedido com saldo já coberto por OPs do mesmo modelo
create or replace view public.vw_pedido_itens_saldo
with (security_invoker = true) as
select
  pi.id,
  pi.pedido_id,
  pi.modelo_id,
  pi.quantidade,
  pi.grade,
  m.codigo as modelo_codigo,
  m.nome   as modelo_nome,
  m.marca,
  coalesce((
    select sum(op.quantidade_total)
    from public.ordens_producao op
    where op.pedido_id = pi.pedido_id
      and op.modelo_id = pi.modelo_id
      and op.status <> 'cancelada'
  ), 0) as pares_em_op
from public.pedido_itens pi
join public.modelos m on m.id = pi.modelo_id;

-- ---------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------

alter table public.planos_producao enable row level security;
alter table public.pedidos         enable row level security;
alter table public.pedido_itens    enable row level security;

create policy sel_planos  on public.planos_producao for select to authenticated using (true);
create policy sel_pedidos on public.pedidos         for select to authenticated using (true);
create policy sel_itens   on public.pedido_itens    for select to authenticated using (true);

create policy ins_planos on public.planos_producao for insert to authenticated
  with check (public.papel_usuario() in ('supervisor', 'gestao'));
create policy upd_planos on public.planos_producao for update to authenticated
  using (public.papel_usuario() in ('supervisor', 'gestao'));

create policy ins_pedidos on public.pedidos for insert to authenticated
  with check (public.papel_usuario() in ('supervisor', 'gestao'));
create policy upd_pedidos on public.pedidos for update to authenticated
  using (public.papel_usuario() in ('supervisor', 'gestao'));

create policy ins_itens on public.pedido_itens for insert to authenticated
  with check (public.papel_usuario() in ('supervisor', 'gestao'));
create policy upd_itens on public.pedido_itens for update to authenticated
  using (public.papel_usuario() in ('supervisor', 'gestao'));
create policy del_itens on public.pedido_itens for delete to authenticated
  using (public.papel_usuario() in ('supervisor', 'gestao'));
