-- ============================================================================
-- cards-resultado.sql — Liga o card ao resultado da consulta
--
-- Com o selo "Resultado publicado", o painel passa a cadastrar o card e o
-- resultado numa tela só. Para isso o card guarda a qual resultado pertence.
--
-- Pré-requisitos: cards.sql e resultados.sql já executados.
-- Rode no Supabase → SQL Editor.
-- ============================================================================

-- 1) VÍNCULO ----------------------------------------------------------------
alter table resultados_consultas.cards
  add column if not exists resultado_id bigint
  references resultados_consultas.resultados(id) on delete set null;

comment on column resultados_consultas.cards.resultado_id is
  'Resultado que este card divulga. Preenchido pelo painel quando o selo e "resultado".';

-- Se o resultado for excluído, o card continua existindo, só perde o vínculo
-- (on delete set null acima) — nunca some da home por tabela.


-- 2) card_salvar passa a aceitar resultado_id -------------------------------
create or replace function public.card_salvar(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = resultados_consultas, pg_temp
as $$
declare
  v_id bigint := nullif(p->>'id', '')::bigint;
begin
  if not resultados_consultas.pode_editar() then
    raise exception 'sem permissao para editar os cards';
  end if;

  if coalesce(trim(p->>'titulo'), '') = '' then
    raise exception 'titulo obrigatorio';
  end if;
  if coalesce(p->>'cor', '') not in ('gold', 'blue', 'green', 'purple') then
    raise exception 'cor invalida';
  end if;
  if coalesce(p->>'estado', '') not in ('aberta', 'resultado', 'encerrada', 'breve', 'nenhum') then
    raise exception 'estado invalido';
  end if;
  -- Só http(s) ou caminho relativo: bloqueia javascript: e afins.
  if coalesce(p->>'href', '') <> ''
     and p->>'href' !~ '^(https?://\S+|[\w.~/#?=&%+-]+)$' then
    raise exception 'link invalido';
  end if;

  if v_id is null then
    insert into resultados_consultas.cards
      (em_recentes, em_resultados, ordem, cor, icone, categoria, titulo, publico,
       estado, destaque, href, nova_aba, prazo, cta, visivel, resultado_id)
    values (
      coalesce((p->>'em_recentes')::boolean, true),
      coalesce((p->>'em_resultados')::boolean, false),
      coalesce((p->>'ordem')::integer, 0),
      p->>'cor',
      coalesce(nullif(p->>'icone', ''), 'documento'),
      nullif(p->>'categoria', ''),
      trim(p->>'titulo'),
      nullif(p->>'publico', ''),
      p->>'estado',
      coalesce((p->>'destaque')::boolean, false),
      nullif(p->>'href', ''),
      coalesce((p->>'nova_aba')::boolean, true),
      nullif(p->>'prazo', '')::date,
      nullif(p->>'cta', ''),
      coalesce((p->>'visivel')::boolean, true),
      nullif(p->>'resultado_id', '')::bigint
    )
    returning id into v_id;
  else
    update resultados_consultas.cards set
      em_recentes   = coalesce((p->>'em_recentes')::boolean, true),
      em_resultados = coalesce((p->>'em_resultados')::boolean, false),
      ordem         = coalesce((p->>'ordem')::integer, ordem),
      cor           = p->>'cor',
      icone         = coalesce(nullif(p->>'icone', ''), 'documento'),
      categoria     = nullif(p->>'categoria', ''),
      titulo        = trim(p->>'titulo'),
      publico       = nullif(p->>'publico', ''),
      estado        = p->>'estado',
      destaque      = coalesce((p->>'destaque')::boolean, false),
      href          = nullif(p->>'href', ''),
      nova_aba      = coalesce((p->>'nova_aba')::boolean, true),
      prazo         = nullif(p->>'prazo', '')::date,
      cta           = nullif(p->>'cta', ''),
      visivel       = coalesce((p->>'visivel')::boolean, true),
      resultado_id  = nullif(p->>'resultado_id', '')::bigint,
      atualizado_em = now()
    where id = v_id;
    if not found then
      raise exception 'card % nao encontrado', v_id;
    end if;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.card_salvar(jsonb) from public, anon;
grant  execute on function public.card_salvar(jsonb) to authenticated;


-- 3) Recarrega o cache da API (a coluna nova precisa ser enxergada) ---------
notify pgrst, 'reload schema';


-- 4) CONFERIR ---------------------------------------------------------------
select id, titulo, estado, resultado_id
  from resultados_consultas.cards
 order by ordem, id;
 then
    raise exception 'link invalido';
  end if;

  if v_id is null then
    insert into resultados_consultas.cards
      (em_recentes, em_resultados, ordem, cor, icone, categoria, titulo, publico,
       estado, destaque, href, nova_aba, prazo, cta, visivel, resultado_id)
    values (
      coalesce((p->>'em_recentes')::boolean, true),
      coalesce((p->>'em_resultados')::boolean, false),
      coalesce((p->>'ordem')::integer, 0),
      p->>'cor',
      coalesce(nullif(p->>'icone', ''), 'documento'),
      nullif(p->>'categoria', ''),
      trim(p->>'titulo'),
      nullif(p->>'publico', ''),
      p->>'estado',
      coalesce((p->>'destaque')::boolean, false),
      nullif(p->>'href', ''),
      coalesce((p->>'nova_aba')::boolean, true),
      nullif(p->>'prazo', '')::date,
      nullif(p->>'cta', ''),
      coalesce((p->>'visivel')::boolean, true),
      nullif(p->>'resultado_id', '')::bigint
    )
    returning id into v_id;
  else
    update resultados_consultas.cards set
      em_recentes   = coalesce((p->>'em_recentes')::boolean, true),
      em_resultados = coalesce((p->>'em_resultados')::boolean, false),
      ordem         = coalesce((p->>'ordem')::integer, ordem),
      cor           = p->>'cor',
      icone         = coalesce(nullif(p->>'icone', ''), 'documento'),
      categoria     = nullif(p->>'categoria', ''),
      titulo        = trim(p->>'titulo'),
      publico       = nullif(p->>'publico', ''),
      estado        = p->>'estado',
      destaque      = coalesce((p->>'destaque')::boolean, false),
      href          = nullif(p->>'href', ''),
      nova_aba      = coalesce((p->>'nova_aba')::boolean, true),
      prazo         = nullif(p->>'prazo', '')::date,
      cta           = nullif(p->>'cta', ''),
      visivel       = coalesce((p->>'visivel')::boolean, true),
      resultado_id  = nullif(p->>'resultado_id', '')::bigint,
      atualizado_em = now()
    where id = v_id;
    if not found then
      raise exception 'card % nao encontrado', v_id;
    end if;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.card_salvar(jsonb) from public, anon;
grant  execute on function public.card_salvar(jsonb) to authenticated;


-- 3) Recarrega o cache da API (a coluna nova precisa ser enxergada) ---------
notify pgrst, 'reload schema';


-- 4) CONFERIR ---------------------------------------------------------------
select id, titulo, estado, resultado_id
  from resultados_consultas.cards
 order by ordem, id;
