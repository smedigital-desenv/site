-- ============================================================================
-- acesso-manutencao.sql — RPCs para a tela de manutenção da allowlist
--   (resultados_consultas.acesso), usada por gerenciar-acesso.html.
--
-- Regras:
--   • Só quem já está na allowlist (resultados_consultas.pode_editar()) pode
--     listar, adicionar ou remover e-mails.
--   • A RLS da tabela só deixa cada pessoa ver a própria linha; por isso a
--     listagem completa passa por função SECURITY DEFINER.
--   • Ninguém consegue remover o PRÓPRIO acesso (evita se trancar para fora).
--
-- Rode uma vez no SQL Editor do Supabase.
-- ============================================================================

-- 1) LISTAR — devolve a allowlist inteira (só para quem pode editar) ----------
create or replace function public.acesso_listar()
returns table (email text, nome text, criado_em timestamptz)
language sql
stable
security definer
set search_path = resultados_consultas, pg_temp
as $$
  select a.email, a.nome, a.criado_em
    from resultados_consultas.acesso a
   where resultados_consultas.pode_editar()
   order by a.email;
$$;

revoke execute on function public.acesso_listar() from public, anon;
grant  execute on function public.acesso_listar() to authenticated;


-- 2) SALVAR — adiciona ou renomeia um e-mail ---------------------------------
create or replace function public.acesso_salvar(p jsonb)
returns void
language plpgsql
security definer
set search_path = resultados_consultas, pg_temp
as $$
declare
  v_email text := lower(trim(p->>'email'));
  v_nome  text := nullif(trim(p->>'nome'), '');
begin
  if not resultados_consultas.pode_editar() then
    raise exception 'sem permissao para gerenciar acessos';
  end if;
  if coalesce(v_email, '') = '' then
    raise exception 'e-mail obrigatorio';
  end if;
  if v_email !~ '^\S+@\S+\.\S+$' then
    raise exception 'e-mail invalido';
  end if;
  insert into resultados_consultas.acesso (email, nome)
  values (v_email, v_nome)
  on conflict (email) do update set nome = excluded.nome;
end;
$$;

revoke execute on function public.acesso_salvar(jsonb) from public, anon;
grant  execute on function public.acesso_salvar(jsonb) to authenticated;


-- 3) REMOVER — apaga um e-mail (menos o próprio) -----------------------------
create or replace function public.acesso_remover(p jsonb)
returns void
language plpgsql
security definer
set search_path = resultados_consultas, pg_temp
as $$
declare
  v_email text := lower(trim(p->>'email'));
begin
  if not resultados_consultas.pode_editar() then
    raise exception 'sem permissao para gerenciar acessos';
  end if;
  if v_email = lower(auth.jwt() ->> 'email') then
    raise exception 'voce nao pode remover o proprio acesso';
  end if;
  delete from resultados_consultas.acesso where lower(email) = v_email;
end;
$$;

revoke execute on function public.acesso_remover(jsonb) from public, anon;
grant  execute on function public.acesso_remover(jsonb) to authenticated;


-- 4) Registra o e-mail solicitado (idempotente) ------------------------------
insert into resultados_consultas.acesso (email, nome) values
  ('gabinete@educacao.pmrp.sp.gov.br', 'Gabinete')
on conflict (email) do update set nome = excluded.nome;
