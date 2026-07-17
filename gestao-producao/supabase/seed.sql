-- Dados de exemplo para ambiente de teste/piloto (opcional)

insert into public.modelos (codigo, nome, marca, linha, grade_inicio, grade_fim) values
  ('SP-1010', 'Bota de Segurança Bico Composite', 'Safety Prado', 'Industrial', 36, 44),
  ('SP-2020', 'Sapato de Segurança Elástico',     'Safety Prado', 'Construção', 36, 44),
  ('CP-3010', 'Bota Country Couro Legítimo',      'Country Prado', 'Agro',      34, 44);

insert into public.planos_producao (nome, data_inicio, data_fim) values
  ('Semana 30 · Julho/2026', '2026-07-20', '2026-07-24');

insert into public.pedidos (plano_id, cliente, canal, prazo) values
  ((select id from public.planos_producao limit 1), 'Distribuidora EPI Sul', 'B2B', '2026-07-31'),
  ((select id from public.planos_producao limit 1), 'Rep. Minas — Carlos', 'Representante', '2026-08-07');

insert into public.pedido_itens (pedido_id, modelo_id, quantidade) values
  ((select id from public.pedidos where cliente = 'Distribuidora EPI Sul'),
   (select id from public.modelos where codigo = 'SP-1010'), 600),
  ((select id from public.pedidos where cliente = 'Distribuidora EPI Sul'),
   (select id from public.modelos where codigo = 'SP-2020'), 300),
  ((select id from public.pedidos where cliente = 'Rep. Minas — Carlos'),
   (select id from public.modelos where codigo = 'CP-3010'), 250);

insert into public.colaboradores (nome, setor, funcao, unidade_id) values
  ('Ana Clara',  'Produção', 'Supervisora',  (select id from public.unidades where nome = 'Itanhandu')),
  ('Michael',    'Produção', 'Encarregado',  (select id from public.unidades where nome = 'Guaxupé')),
  ('José Silva', 'Corte',    'Operador',     (select id from public.unidades where nome = 'Itanhandu')),
  ('Maria Souza','Pesponto', 'Operadora',    (select id from public.unidades where nome = 'Itanhandu')),
  ('Carlos Lima','Montagem', 'Operador',     (select id from public.unidades where nome = 'Guaxupé'));
