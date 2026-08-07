-- ============================================================================
-- consulta-acesso.sql — Schema dos resultados de consultas + allowlist
--
-- Cria o schema `resultados_consultas`, separado do `presenca`, para abrigar
-- tudo que diz respeito aos resultados das consultas públicas. Por ora tem uma
-- tabela: `acesso`, a allowlist da página cons_atrib.html (resultados da
-- consulta Remoção e Atribuição 2026/2027, COM a identificação dos
-- respondentes).
--
-- Independente de `presenca.validadores`: estar em uma não dá acesso à outra.
-- A sessão do navegador também é isolada (storageKey "consulta-auth"), então
-- entrar aqui não desloga ninguém do sistema de presença, e vice-versa.
--
-- Nome do schema sem espaços e sem acento de propósito: PostgREST identifica o
-- schema pelo cabeçalho HTTP `Accept-Profile`, e espaços exigiriam aspas em
-- toda referência SQL.
--
-- ⚠️ PASSO OBRIGATÓRIO NO PAINEL, DEPOIS DE RODAR ESTE SCRIPT:
--    Supabase → Settings → API → "Exposed schemas": acrescentar
--    `resultados_consultas` à lista (que hoje tem `public` e `presenca`).
--    Sem isso a API devolve 404/406 e a página não libera o acesso.
--
-- Rode no Supabase → SQL Editor.
-- ============================================================================

-- 1) SCHEMA -----------------------------------------------------------------
create schema if not exists resultados_consultas;

comment on schema resultados_consultas is
  'Resultados das consultas publicas da SME (dados e controle de acesso).';

grant usage on schema resultados_consultas to anon, authenticated;


-- 2) TABELA DE ACESSO -------------------------------------------------------
create table if not exists resultados_consultas.acesso (
  email      text primary key,
  nome       text,
  criado_em  timestamptz not null default now()
);

comment on table resultados_consultas.acesso is
  'Allowlist da pagina cons_atrib.html (resultados nominais da consulta 2026/2027).';


-- 3) RLS --------------------------------------------------------------------
-- Sem policy de leitura ampla: cada pessoa autenticada só enxerga a PRÓPRIA
-- linha. Assim ninguém consegue baixar a lista de quem tem acesso, e o
-- visitante anônimo não lê nada.

alter table resultados_consultas.acesso enable row level security;

drop policy if exists acesso_self on resultados_consultas.acesso;
create policy acesso_self
  on resultados_consultas.acesso
  for select
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Privilégios de tabela (a RLS filtra as linhas; o grant libera o verbo).
grant select on resultados_consultas.acesso to authenticated;
revoke all   on resultados_consultas.acesso from anon;


-- 4) AUTORIZAR --------------------------------------------------------------
-- Cadastre EM MINÚSCULAS, exatamente como o e-mail aparece na conta Google.

-- O campo `nome` é só um rótulo para consulta administrativa; ajuste à vontade.
-- Todos precisam ser contas Google (Workspace ou Gmail) — o login é OAuth Google.

insert into resultados_consultas.acesso (email, nome) values
  ('desenv.sme@gmail.com',                       'Desenvolvimento SME'),
  ('matheusprospero@educacao.pmrp.sp.gov.br',    'Matheus Prospero'),
  ('christianoliveira@educacao.pmrp.sp.gov.br',  'Christian Oliveira'),
  ('g.atribucao@educacao.pmrp.sp.gov.br',        'Atribuição (conta setorial)')
  -- ,('fulano@exemplo.com', 'Nome da Pessoa')
on conflict (email) do update
  set nome = coalesce(excluded.nome, resultados_consultas.acesso.nome);


-- 5) CONFERIR ---------------------------------------------------------------
-- (rode pelo SQL Editor, que usa service_role; a policy acima não permite que
--  um usuário comum liste a tabela inteira)
select email, nome, criado_em
  from resultados_consultas.acesso
 order by email;


-- 6) REVOGAR ----------------------------------------------------------------
-- delete from resultados_consultas.acesso where email = 'fulano@exemplo.com';


-- 7) LIMPEZA ----------------------------------------------------------------
-- Só se você chegou a rodar a versão anterior deste script, que criava a
-- tabela dentro do schema `presenca`:
-- drop table if exists presenca.consulta_acesso;
