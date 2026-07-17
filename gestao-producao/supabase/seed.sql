-- Dados de exemplo para ambiente de teste/piloto (opcional)

insert into public.modelos (codigo, nome, marca, linha, grade_inicio, grade_fim) values
  ('SP-1010', 'Bota de Segurança Bico Composite', 'Safety Prado', 'Industrial', 36, 44),
  ('SP-2020', 'Sapato de Segurança Elástico',     'Safety Prado', 'Construção', 36, 44),
  ('CP-3010', 'Bota Country Couro Legítimo',      'Country Prado', 'Agro',      34, 44);

insert into public.colaboradores (nome, setor, funcao, unidade_id) values
  ('Ana Clara',  'Produção', 'Supervisora',  (select id from public.unidades where nome = 'Itanhandu')),
  ('Michael',    'Produção', 'Encarregado',  (select id from public.unidades where nome = 'Guaxupé')),
  ('José Silva', 'Corte',    'Operador',     (select id from public.unidades where nome = 'Itanhandu')),
  ('Maria Souza','Pesponto', 'Operadora',    (select id from public.unidades where nome = 'Itanhandu')),
  ('Carlos Lima','Montagem', 'Operador',     (select id from public.unidades where nome = 'Guaxupé'));
