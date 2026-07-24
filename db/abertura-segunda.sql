-- ============================================================================
-- abertura-segunda.sql
-- Tabela para o painel danos.html registrar se cada unidade escolar tem
-- condições de ABRIR na segunda-feira (e, quando não, o motivo).
--
-- Enquanto esta tabela não existir, o painel salva as marcações apenas no
-- navegador (localStorage). Depois de rodar este SQL, as marcações passam a
-- ser salvas no Supabase e ficam compartilhadas entre todos os acessos.
--
-- Rode no SQL Editor do Supabase (uma vez).
-- ============================================================================

create table if not exists presenca.danos_abertura (
  nome           text primary key,               -- unidade escolar (chave)
  segmento       text,                            -- CEI / EMEI / EMEF / Conveniada
  avaliacao      text,                            -- graves / leves / energia / sem / naoavaliado
  abre           text,                            -- 'Sim' | 'Não' | '' (pendente)
  motivo         text,                            -- obrigatório quando abre = 'Não'
  atualizado_em  timestamptz default now()
);

-- Row Level Security com políticas permissivas (mesma lógica "anon" pública
-- que o restante do app já usa — a chave anon é pública por design).
alter table presenca.danos_abertura enable row level security;

drop policy if exists danos_abertura_sel on presenca.danos_abertura;
create policy danos_abertura_sel on presenca.danos_abertura
  for select using (true);

drop policy if exists danos_abertura_ins on presenca.danos_abertura;
create policy danos_abertura_ins on presenca.danos_abertura
  for insert with check (true);

drop policy if exists danos_abertura_upd on presenca.danos_abertura;
create policy danos_abertura_upd on presenca.danos_abertura
  for update using (true) with check (true);

grant usage on schema presenca to anon;
grant select, insert, update on presenca.danos_abertura to anon;

-- ---------------------------------------------------------------------------
-- Para acompanhar / exportar depois (relatório):
--   select segmento, nome, avaliacao, abre, motivo, atualizado_em
--   from presenca.danos_abertura
--   order by (abre = 'Não') desc, segmento, nome;
-- ---------------------------------------------------------------------------
