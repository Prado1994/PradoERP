-- produzapp · caixa de entrada de pedidos e credenciais de integração
BEGIN;

CREATE TABLE pedidos_entrada (
  id                uuid PRIMARY KEY,
  origem            text NOT NULL,                 -- ex.: 'bling'
  id_externo        text NOT NULL,
  numero            text NOT NULL,
  cliente           text NOT NULL,
  documento_cliente text,
  data_pedido       date,
  previsao_externa  date,                          -- quase sempre vazia; a previsão inicial é do PCP
  situacao_externa  text,
  total             numeric(14,2),
  itens             jsonb NOT NULL,
  status            text NOT NULL DEFAULT 'a_programar' CHECK (status IN ('a_programar','programado','cancelado_na_origem')),
  observacao_pcp    text,
  programado_em     timestamptz,
  programacao       jsonb,
  alerta            text,
  recebido_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (origem, id_externo)
);
CREATE INDEX pedidos_por_status ON pedidos_entrada (status, recebido_em);

ALTER TABLE ordens ADD COLUMN pedido_id uuid REFERENCES pedidos_entrada(id);
CREATE INDEX ordens_por_pedido ON ordens (pedido_id);

-- Tokens OAuth (o refresh token é rotacionado a cada uso: sempre gravar o novo)
CREATE TABLE integracao_tokens (
  nome           text PRIMARY KEY,
  access_token   text NOT NULL,
  refresh_token  text NOT NULL,
  expira_em      timestamptz NOT NULL,
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

COMMIT;
