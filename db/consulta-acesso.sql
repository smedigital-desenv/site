-- ============================================================================
-- consulta-acesso.sql — Allowlist PRÓPRIA da página cons_atrib.html
--
-- A página cons_atrib.html (resultados da consulta Remoção e Atribuição
-- 2026/2027, COM a identificação dos respondentes) exige login Google e só
-- abre para e-mails cadastrados na tabela `presenca.consulta_acesso`.
--
-- Esta tabela é INDEPENDENTE de `presenca.validadores`: estar em uma não dá
-- acesso à outra. A sessão também é isolada (storageKey "consulta-auth"),
-- então entrar aqui não desloga ninguém do sistema de presença, e vice-versa.
--
-- Rode no Supabase → SQL Editor.
-- ============================================================================

-- 1) TABELA -----------------------------------------------------------------
create table if not exists presenca.consulta_acesso (
  email      text primary key,
  nome       text,
  criado_em  timestamptz not null default now()
);

comment on table presenca.consulta_acesso is
  'Allowlist da pagina cons_atrib.html (resultados nominais da consulta 2026/2027).';


-- 2) RLS --------------------------------------------------------------------
-- Sem policy de leitura ampla: cada pessoa autenticada só enxerga a PRÓPRIA
-- linha. Assim ninguém consegue baixar a lista de quem tem acesso, e o
-- visitante anônimo não lê nada.

alter table presenca.consulta_acesso enable row level security;

drop policy if exists consulta_acesso_self on presenca.consulta_acesso;
create policy consulta_acesso_self
  on presenca.consulta_acesso
  for select
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Privilégios de tabela (a RLS filtra as linhas; o grant libera o verbo).
grant usage  on schema presenca            to anon, authenticated;
grant select on presenca.consulta_acesso   to authenticated;
revoke all   on presenca.consulta_acesso   from anon;


-- 3) AUTORIZAR --------------------------------------------------------------
-- Cadastre EM MINÚSCULAS, exatamente como o e-mail aparece na conta Google.

insert into presenca.consulta_acesso (email, nome) values
  ('desenv.sme@gmail.com', 'Desenvolvimento SME')
  -- ,('fulano@exemplo.com',  'Nome da Pessoa')
  -- ,('ciclano@exemplo.com', 'Nome da Pessoa')
on conflict (email) do update
  set nome = coalesce(excluded.nome, presenca.consulta_acesso.nome);


-- 4) CONFERIR ---------------------------------------------------------------
-- (rode como service_role / pelo SQL Editor; a policy acima não permite que
--  um usuário comum liste a tabela inteira)
select email, nome, criado_em
  from presenca.consulta_acesso
 order by email;


-- 5) REVOGAR ----------------------------------------------------------------
-- delete from presenca.consulta_acesso where email = 'fulano@exemplo.com';
