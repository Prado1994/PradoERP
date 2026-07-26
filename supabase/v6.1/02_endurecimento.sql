-- =============================================================================
-- SouCrum v6.1 — endurecimento das funções
-- =============================================================================
--
-- Aplicado em njlnvcrcoebbednfrzhr como a migração
-- `v6_1_endurecimento_funcoes`. Não existe no banco antigo: é uma das
-- "novas atualizações" do v6.1.
--
-- Motivo: o esquema herdado expunha em /rest/v1/rpc funções que nunca deveriam
-- ser chamadas de fora. Nada aqui muda comportamento do app.

-- 1. search_path fixo. Sem isto, um schema no caminho de busca do chamador pode
--    resolver `now()` para outra função.
create or replace function public.touch_notification_prefs()
returns trigger language plpgsql set search_path to 'pg_catalog', 'public' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- 2. Funções de TRIGGER não deveriam ser chamáveis por RPC — e estas são
--    SECURITY DEFINER. O Postgres não checa EXECUTE do usuário para disparar
--    trigger, então revogar não quebra a criação de workspace.
--
--    Verificado no banco: inserindo um workspace como `authenticated` com o JWT
--    do dono, o trigger continuou criando a linha de membro (role = owner).
revoke all on function public.add_owner_as_member() from anon, authenticated, public;
revoke all on function public.touch_notification_prefs() from anon, authenticated, public;

-- 3. Estas dependem de auth.uid(): chamada por anon só gastaria recurso.
revoke all on function public.accept_my_invites() from anon;
revoke all on function public.is_member(uuid) from anon;
revoke all on function public.notify_by_email(text, text, text, uuid) from anon;

-- NÃO revogado de propósito: get_shared_card e get_shared_card_children seguem
-- abertas para anon. É o recurso de cartão público; o token é o segredo, e a
-- função devolve um subconjunto de colunas, nunca a linha inteira.

-- -----------------------------------------------------------------------------
-- Avisos do linter que ficaram de pé, e por quê
-- -----------------------------------------------------------------------------
-- • notifications.notif_insert_auth com WITH CHECK (true)
--     Necessário: marcar outra pessoa grava na linha DELA. Quem resolve o
--     destinatário é notify_by_email(), que busca o usuário pelo e-mail — o
--     cliente não escolhe user_id arbitrário na prática.
-- • activity.activity_insert_auth com WITH CHECK (true)
--     Feed append-only de auditoria, herdado. Apertar exigiria mudar o app.
-- • auth_leaked_password_protection desligado
--     É configuração de Auth no painel, não SQL. Vale ligar em
--     Authentication → Policies, mas 6 dos 9 usuários entram por Google e nem
--     têm senha.
