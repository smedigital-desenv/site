-- ============================================================
--  HOTFIX: local da GESTAO_DEMOCRATICA_M estava errado no banco.
--  Oficial (doc LOCAIS E PALESTRANTES): manhã = UNIP, tarde = SENAI.
--  O banco estava com SENAI nos DOIS períodos — o e-mail de
--  confirmação e o comprovante da consulta usam esse campo.
--  Rode no SQL Editor do Supabase ANTES de disparar os e-mails.
-- ============================================================

update presenca.palestras
set local    = 'UNIP',
    endereco = 'Av. Carlos Consoni, 10 - Jardim Canadá'
where id = 'GESTAO_DEMOCRATICA_M';

-- Conferência: manhã deve ser UNIP, tarde SENAI.
select id, periodo, local, endereco
from presenca.palestras
where id like 'GESTAO_DEMOCRATICA%'
order by id;
