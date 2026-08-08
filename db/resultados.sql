-- ============================================================================
-- resultados.sql — Resultados de consultas cadastrados pelo painel
--
-- Cada linha é uma consulta encerrada com seus dois endereços:
--   • resumo público    — números agregados, pode ser divulgado
--   • resultados completos — devolutivas na íntegra e identificação, restrito
--
-- Só quem está em `resultados_consultas.acesso` cadastra ou edita. A leitura
-- também é restrita: esta é uma lista interna do painel.
--
-- Todo o acesso passa por funções em `public`, porque o schema
-- `resultados_consultas` não está exposto na API.
--
-- Pré-requisito: consulta-acesso.sql e cards.sql já executados.
-- Rode no Supabase → SQL Editor.
-- ============================================================================

-- 1) TABELA -----------------------------------------------------------------
create table if not exists resultados_consultas.resultados (
  id             bigint generated always as identity primary key,
  ordem          integer not null default 0,
  titulo         text    not null,
  descricao      text,          -- ex.: "257 contribuições · 90 unidades · jul–ago/2026"
  url_publico    text,          -- ex.: divulga_atrib.html
  url_completo   text,          -- ex.: cons_atrib.html  (restrito)
  visivel        boolean not null default true,
  atualizado_em  timestamptz not null default now()
);

comment on table resultados_consultas.resultados is
  'Consultas encerradas e os enderecos dos seus resultados (publico e completo).';

create index if not exists resultados_ordem_idx
  on resultados_consultas.resultados (ordem, id);

alter table resultados_consultas.resultados enable row level security;
revoke all on resultados_consultas.resultados from anon, authenticated;


-- 2) LISTAR (restrito) ------------------------------------------------------
create or replace function public.resultados_listar()
returns setof resultados_consultas.resultados
language sql
stable
security definer
set search_path = resultados_consultas, pg_temp
as $$
  select r.*
    from resultados_consultas.resultados r
   where resultados_consultas.pode_editar()
   order by r.ordem, r.id;
$$;

revoke execute on function public.resultados_listar() from public, anon;
grant  execute on function public.resultados_listar() to authenticated;


-- 3) GRAVAR -----------------------------------------------------------------
create or replace function public.resultado_salvar(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = resultados_consultas, pg_temp
as $$
declare
  v_id bigint := nullif(p->>'id', '')::bigint;
  v_re text := '^(https?://|[A-Za-z0-9._~/-]+\.html|[A-Za-z0-9._~/-]+/?)($|[?#])';
begin
  if not resultados_consultas.pode_editar() then
    raise exception 'sem permissao para editar os resultados';
  end if;
  if coalesce(trim(p->>'titulo'), '') = '' then
    raise exception 'titulo obrigatorio';
  end if;
  if coalesce(p->>'url_publico', '')  <> '' and p->>'url_publico'  !~ v_re then
    raise exception 'link do resumo publico invalido';
  end if;
  if coalesce(p->>'url_completo', '') <> '' and p->>'url_completo' !~ v_re then
    raise exception 'link dos resultados completos invalido';
  end if;

  if v_id is null then
    insert into resultados_consultas.resultados
      (ordem, titulo, descricao, url_publico, url_completo, visivel)
    values (
      coalesce((p->>'ordem')::integer, 0),
      trim(p->>'titulo'),
      nullif(p->>'descricao', ''),
      nullif(p->>'url_publico', ''),
      nullif(p->>'url_completo', ''),
      coalesce((p->>'visivel')::boolean, true)
    )
    returning id into v_id;
  else
    update resultados_consultas.resultados set
      ordem         = coalesce((p->>'ordem')::integer, ordem),
      titulo        = trim(p->>'titulo'),
      descricao     = nullif(p->>'descricao', ''),
      url_publico   = nullif(p->>'url_publico', ''),
      url_completo  = nullif(p->>'url_completo', ''),
      visivel       = coalesce((p->>'visivel')::boolean, true),
      atualizado_em = now()
    where id = v_id;
    if not found then
      raise exception 'resultado % nao encontrado', v_id;
    end if;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.resultado_salvar(jsonb) from public, anon;
grant  execute on function public.resultado_salvar(jsonb) to authenticated;


-- 4) EXCLUIR ----------------------------------------------------------------
create or replace function public.resultado_excluir(p_id bigint)
returns void
language plpgsql
security definer
set search_path = resultados_consultas, pg_temp
as $$
begin
  if not resultados_consultas.pode_editar() then
    raise exception 'sem permissao para editar os resultados';
  end if;
  delete from resultados_consultas.resultados where id = p_id;
end;
$$;

revoke execute on function public.resultado_excluir(bigint) from public, anon;
grant  execute on function public.resultado_excluir(bigint) to authenticated;


-- 5) REORDENAR --------------------------------------------------------------
create or replace function public.resultados_reordenar(p_ids jsonb)
returns void
language plpgsql
security definer
set search_path = resultados_consultas, pg_temp
as $$
begin
  if not resultados_consultas.pode_editar() then
    raise exception 'sem permissao para editar os resultados';
  end if;
  update resultados_consultas.resultados r
     set ordem = t.pos, atualizado_em = now()
    from (
      select (valor)::bigint as id, (indice - 1) as pos
        from jsonb_array_elements_text(p_ids) with ordinality as e(valor, indice)
    ) t
   where r.id = t.id;
end;
$$;

revoke execute on function public.resultados_reordenar(jsonb) from public, anon;
grant  execute on function public.resultados_reordenar(jsonb) to authenticated;


-- 6) CARGA INICIAL ----------------------------------------------------------
insert into resultados_consultas.resultados (ordem, titulo, descricao, url_publico, url_completo)
select 0,
       'Remoção e Atribuição de Aulas 2026/2027',
       '257 contribuições · 90 unidades · coletadas entre 15/07/2026 e 07/08/2026',
       'divulga_atrib.html',
       'cons_atrib.html'
where not exists (select 1 from resultados_consultas.resultados);


-- 7) CONFERIR ---------------------------------------------------------------
select id, ordem, titulo, url_publico, url_completo, visivel
  from resultados_consultas.resultados
 order by ordem, id;
