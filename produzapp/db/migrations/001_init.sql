-- produzapp · esquema inicial (PostgreSQL 14+)
BEGIN;

CREATE TABLE ordens (
  id               uuid PRIMARY KEY,
  op               char(5)      NOT NULL,
  caixa            char(2)      NOT NULL,
  plano            text,
  cliente          text         NOT NULL,
  produto          text         NOT NULL,
  pares            integer      NOT NULL CHECK (pares > 0),
  entrada          date         NOT NULL,
  previsao_inicial date         NOT NULL,   -- compromisso original: nunca é alterada
  previsao_atual   date         NOT NULL,
  criada_em        timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (op, caixa)
);

-- Impede alterar a previsão inicial depois de gravada
CREATE FUNCTION bloqueia_previsao_inicial() RETURNS trigger AS $$
BEGIN
  IF NEW.previsao_inicial <> OLD.previsao_inicial THEN
    RAISE EXCEPTION 'previsao_inicial nao pode ser alterada';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER ordens_previsao_inicial BEFORE UPDATE ON ordens
  FOR EACH ROW EXECUTE FUNCTION bloqueia_previsao_inicial();

CREATE TABLE previsoes (
  id        uuid PRIMARY KEY,
  ordem_id  uuid NOT NULL REFERENCES ordens(id),
  em        timestamptz NOT NULL DEFAULT now(),
  de        date NOT NULL,
  para      date NOT NULL,
  motivo    text NOT NULL CHECK (length(trim(motivo)) > 0)
);

CREATE TABLE eventos_etapa (
  id          uuid PRIMARY KEY,
  ordem_id    uuid NOT NULL REFERENCES ordens(id),
  sigla       char(3) NOT NULL CHECK (sigla IN ('COR','PES','EST','INJ','ACA','EMB','EXP')),
  em          timestamptz NOT NULL,
  estacao     char(3) NOT NULL,
  operador    text,
  id_leitura  text NOT NULL UNIQUE,
  colado      boolean NOT NULL DEFAULT false,
  UNIQUE (ordem_id, sigla)               -- uma leitura válida por etapa e caixa
);

-- Eventos são imutáveis: nunca alterar nem apagar (correção = novo evento/estorno)
CREATE FUNCTION eventos_imutaveis() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'eventos_etapa e somente inclusao';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER eventos_sem_update BEFORE UPDATE OR DELETE ON eventos_etapa
  FOR EACH ROW EXECUTE FUNCTION eventos_imutaveis();

CREATE TABLE leituras (
  id_leitura  text PRIMARY KEY,
  resultado   jsonb NOT NULL,
  em          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE paradas (
  id        uuid PRIMARY KEY,
  sigla     char(3) NOT NULL CHECK (sigla IN ('COR','PES','EST','INJ','ACA','EMB','EXP')),
  motivo    text NOT NULL,
  inicio    timestamptz NOT NULL,
  fim       timestamptz,
  operador  text
);
CREATE UNIQUE INDEX uma_parada_aberta_por_etapa ON paradas (sigla) WHERE fim IS NULL;

CREATE TABLE fila_sincronizacao (
  id                 uuid PRIMARY KEY,
  destino            text NOT NULL CHECK (destino IN ('bling','odoo')),
  tipo               text NOT NULL,
  payload            jsonb NOT NULL,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  tentativas         integer NOT NULL DEFAULT 0,
  proxima_tentativa  timestamptz NOT NULL DEFAULT now(),
  status             text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','falha')),
  ultimo_erro        text
);
CREATE INDEX fila_pronta ON fila_sincronizacao (proxima_tentativa) WHERE status = 'pendente';

CREATE TABLE clientes_api (
  id         uuid PRIMARY KEY,
  nome       text NOT NULL UNIQUE,         -- ex.: estacao-corte, painel, integrador-bling
  chave_hash text NOT NULL,                -- nunca a chave em texto
  ativo      boolean NOT NULL DEFAULT true,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

COMMIT;
