-- ============================================================================
-- consulta-acesso.sql — Libera cons_atrib.html para e-mails específicos
--
-- A página cons_atrib.html (resultados da consulta Remoção e Atribuição
-- 2026/2027, COM a identificação dos respondentes) exige login Google e só
-- abre para e-mails cadastrados em `presenca.validadores` cujo `perfil` esteja
-- na lista PERFIS_OK do próprio HTML — hoje: 'gerente' e 'consulta'.
--
-- Não é preciso criar tabela: reaproveita a allowlist que já existe.
-- Rode no Supabase → SQL Editor.
-- ============================================================================

-- 1) AUTORIZAR --------------------------------------------------------------
-- Cadastre cada e-mail EM MINÚSCULAS, exatamente como aparece na conta Google.
-- O perfil 'consulta' dá acesso a esta página SEM dar acesso ao sistema de
-- presença (validar/dashboard exigem 'fiscal' ou 'gerente').

insert into presenca.validadores (email, nome, perfil) values
  ('desenv.sme@gmail.com', 'Desenvolvimento SME', 'consulta')
  -- ,('fulano@exemplo.com',  'Nome da Pessoa',      'consulta')
  -- ,('ciclano@exemplo.com', 'Nome da Pessoa',      'consulta')
on conflict (email) do update
  set nome   = coalesce(excluded.nome, presenca.validadores.nome),
      perfil = excluded.perfil;

-- Atenção: quem já é 'gerente' do sistema de presença JÁ tem acesso à página.
-- Se não for essa a intenção, troque PERFIS_OK em cons_atrib.html para
-- apenas ["consulta"] e cadastre nominalmente quem deve entrar.


-- 2) CONFERIR ---------------------------------------------------------------
select email, nome, perfil
  from presenca.validadores
 where perfil in ('gerente', 'consulta')
 order by perfil, email;


-- 3) REVOGAR ----------------------------------------------------------------
-- Tira o acesso à página mas mantém a pessoa no sistema de presença:
-- update presenca.validadores set perfil = 'fiscal' where email = 'fulano@exemplo.com';

-- Remove a pessoa de tudo:
-- delete from presenca.validadores where email = 'fulano@exemplo.com';
