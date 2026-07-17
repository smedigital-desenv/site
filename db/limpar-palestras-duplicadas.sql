-- ============================================================
--  Remove as PALESTRAS DUPLICADAS/ÓRFÃS.
--
--  Contexto: sobraram linhas antigas na tabela presenca.palestras
--  (nome em MAIÚSCULA, o local dentro do campo carga_horaria, do schema
--  original que só tinha id/nome/carga_horaria). Elas NÃO têm inscritos
--  nem presenças — os inscritos apontam para as linhas corretas
--  (MOCHILA_M, MOCHILA_T, ... com as colunas local/periodo/hora).
--
--  Estratégia segura: apaga apenas palestras SEM nenhum participante
--  E SEM nenhuma presença (ou seja, as órfãs). As 23 sessões reais têm
--  inscritos, então não são tocadas.
--
--  Rode no SQL Editor do Supabase (projeto do gom).
-- ============================================================

-- 1) CONFERIR ANTES (opcional): veja o que será apagado.
--    Rode só este SELECT primeiro para revisar a lista.
select p.id, p.nome, p.carga_horaria, p.local, p.periodo,
       (select count(*) from presenca.participantes pa where pa.palestra_id = p.id) as inscritos,
       (select count(*) from presenca.presencas     pr where pr.palestra_id = p.id) as presencas
from presenca.palestras p
where not exists (select 1 from presenca.participantes pa where pa.palestra_id = p.id)
  and not exists (select 1 from presenca.presencas     pr where pr.palestra_id = p.id)
order by p.nome;

-- 2) APAGAR as órfãs (sem inscritos e sem presenças).
delete from presenca.palestras p
where not exists (select 1 from presenca.participantes pa where pa.palestra_id = p.id)
  and not exists (select 1 from presenca.presencas     pr where pr.palestra_id = p.id);

-- 3) GARANTIR que as 23 sessões corretas tenham local/periodo/hora.
--    (reaplica o upsert oficial; se algo tiver sido apagado por engano, recria)
--    -> rode em seguida:  db/adicionar-local-sessoes.sql
