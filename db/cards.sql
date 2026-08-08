-- ============================================================================
-- cards.sql — Cards da home (index.html) gerenciados pelo painel gerenciar.html
--
-- A index passa a carregar os cards daqui em vez de tê-los fixos no HTML.
-- Quem edita é quem está em `resultados_consultas.acesso` (mesma allowlist da
-- cons_atrib.html).
--
-- Todo o acesso passa por funções em `public`, porque o schema
-- `resultados_consultas` NÃO está exposto na API (foi o que causou o 406).
-- A tabela em si permanece inalcançável pela API.
--
-- Pré-requisito: consulta-acesso.sql já executado.
-- Rode no Supabase → SQL Editor.
-- ============================================================================

-- 1) TABELA -----------------------------------------------------------------
create table if not exists resultados_consultas.cards (
  id             bigint generated always as identity primary key,
  em_recentes    boolean not null default true,       -- aparece na aba "Recentes"
  em_resultados  boolean not null default false,      -- aparece na aba "Resultados"
  ordem          integer not null default 0,           -- menor aparece primeiro
  cor            text    not null default 'blue',      -- gold | blue | green | purple
  icone          text    not null default 'documento', -- chave do catálogo em cards.js
  categoria      text,                                 -- eyebrow acima do título
  titulo         text    not null,
  publico        text,                                 -- chip de público-alvo
  estado         text    not null default 'aberta',    -- aberta | resultado | encerrada | breve | nenhum
  destaque       boolean not null default false,      -- CTA em destaque (dourado)
  href           text,                                 -- vazio => card não clicável
  nova_aba       boolean not null default true,
  prazo          date,                                 -- encerra sozinho após a data
  cta            text,                                 -- texto do botão
  visivel        boolean not null default true,
  atualizado_em  timestamptz not null default now()
);

comment on table resultados_consultas.cards is
  'Cards exibidos na home (index.html), editaveis por gerenciar.html.';

create index if not exists cards_ordem_idx
  on resultados_consultas.cards (ordem, id);

-- A tabela nunca é acessada direto pela API.
alter table resultados_consultas.cards enable row level security;
revoke all on resultados_consultas.cards from anon, authenticated;


-- 2) QUEM PODE EDITAR -------------------------------------------------------
create or replace function resultados_consultas.pode_editar()
returns boolean
language sql
stable
security definer
set search_path = resultados_consultas, pg_temp
as $$
  select exists (
    select 1 from resultados_consultas.acesso
     where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;


-- 3) LEITURA PÚBLICA (a home usa esta) --------------------------------------
-- Devolve só o que está visível. Aberta a anônimos de propósito: são os cards
-- da página inicial, conteúdo público por natureza.

create or replace function public.cards_publicos()
returns table (
  id bigint, em_recentes boolean, em_resultados boolean, ordem integer,
  cor text, icone text, categoria text, titulo text, publico text,
  estado text, destaque boolean, href text, nova_aba boolean, prazo date, cta text
)
language sql
stable
security definer
set search_path = resultados_consultas, pg_temp
as $$
  select c.id, c.em_recentes, c.em_resultados, c.ordem, c.cor, c.icone,
         c.categoria, c.titulo, c.publico, c.estado, c.destaque, c.href,
         c.nova_aba, c.prazo, c.cta
    from resultados_consultas.cards c
   where c.visivel
   order by c.ordem, c.id;
$$;

grant execute on function public.cards_publicos() to anon, authenticated;


-- 4) LEITURA DO PAINEL (inclui os ocultos) ----------------------------------
create or replace function public.cards_listar()
returns setof resultados_consultas.cards
language sql
stable
security definer
set search_path = resultados_consultas, pg_temp
as $$
  select c.*
    from resultados_consultas.cards c
   where resultados_consultas.pode_editar()
   order by c.ordem, c.id;
$$;

revoke execute on function public.cards_listar() from public, anon;
grant  execute on function public.cards_listar() to authenticated;


-- 5) GRAVAR -----------------------------------------------------------------
-- Recebe um jsonb. Sem `id` insere; com `id` atualiza. Devolve o id gravado.

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
     and p->>'href' !~ '^(https?://|[A-Za-z0-9._~/-]+\.html|[A-Za-z0-9._~/-]+/?)($|[?#])' then
    raise exception 'link invalido';
  end if;

  if v_id is null then
    insert into resultados_consultas.cards
      (em_recentes, em_resultados, ordem, cor, icone, categoria, titulo, publico,
       estado, destaque, href, nova_aba, prazo, cta, visivel)
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
      coalesce((p->>'visivel')::boolean, true)
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


-- 6) EXCLUIR ----------------------------------------------------------------
create or replace function public.card_excluir(p_id bigint)
returns void
language plpgsql
security definer
set search_path = resultados_consultas, pg_temp
as $$
begin
  if not resultados_consultas.pode_editar() then
    raise exception 'sem permissao para editar os cards';
  end if;
  delete from resultados_consultas.cards where id = p_id;
end;
$$;

revoke execute on function public.card_excluir(bigint) from public, anon;
grant  execute on function public.card_excluir(bigint) to authenticated;


-- 7) REORDENAR --------------------------------------------------------------
-- Recebe um array de ids na ordem desejada: '[12, 7, 3]'::jsonb

create or replace function public.cards_reordenar(p_ids jsonb)
returns void
language plpgsql
security definer
set search_path = resultados_consultas, pg_temp
as $$
begin
  if not resultados_consultas.pode_editar() then
    raise exception 'sem permissao para editar os cards';
  end if;
  update resultados_consultas.cards c
     set ordem = t.pos, atualizado_em = now()
    from (
      select (valor)::bigint as id, (indice - 1) as pos
        from jsonb_array_elements_text(p_ids) with ordinality as e(valor, indice)
    ) t
   where c.id = t.id;
end;
$$;

revoke execute on function public.cards_reordenar(jsonb) from public, anon;
grant  execute on function public.cards_reordenar(jsonb) to authenticated;


-- 8) CARGA INICIAL ----------------------------------------------------------
-- Os cards que hoje estão fixos na index. Rode uma vez só; o `where not exists`
-- evita duplicar se você executar o script de novo.

insert into resultados_consultas.cards
  (em_recentes, em_resultados, ordem, cor, icone, categoria, titulo, publico,
   estado, destaque, href, nova_aba, prazo, cta)
select * from (values
  (true, false, 0, 'blue', 'documento', 'Materiais pedagógicos',
   'Aquisição de jogos e materiais pedagógicos para a rede municipal',
   'Profissionais da educação', 'aberta', false,
   'https://docs.google.com/forms/d/1rtWBo7JcizSzW2JpeTZj6Drqdtu-NsNLV1cdCkoNuJw/viewform',
   true, date '2026-08-31', 'Responder'),
  (true, false, 1, 'green', 'escudo', 'Segurança escolar',
   'Protocolo de Segurança e Paz para as Escolas Municipais de Ribeirão Preto',
   'Comunidade escolar', 'aberta', false,
   'https://docs.google.com/forms/d/1zX1UFU25Zs2oOXxdkpDnpfNOW33jp26hEbxwTooxxgk/viewform',
   true, date '2026-08-31', 'Responder'),
  (true, true, 2, 'purple', 'grafico', 'Vida funcional',
   'Remoção e Atribuição de Aulas 2026/2027 — devolutivas',
   'Profissionais da educação', 'resultado', true,
   'divulga_atrib.html', false, null::date, 'Ver resultados'),
  (true, false, 3, 'blue', 'lapis', 'Vida funcional',
   'Resolução de acompanhamento de sala de aula',
   'Profissionais da educação', 'breve', false,
   null, false, null::date, 'Aguarde a abertura'),
  (true, false, 4, 'gold', 'estrela', 'Avaliação do evento',
   'Avaliação do Congresso Municipal de Educação — 2026',
   'Participantes do Congresso', 'encerrada', false,
   null, false, null::date, null)
) as v(em_recentes, em_resultados, ordem, cor, icone, categoria, titulo, publico,
       estado, destaque, href, nova_aba, prazo, cta)
where not exists (select 1 from resultados_consultas.cards);


-- 9) CONFERIR ---------------------------------------------------------------
select id, ordem, cor, icone, titulo, estado, em_recentes, em_resultados, visivel
  from resultados_consultas.cards
 order by ordem, id;
