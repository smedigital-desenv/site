-- ============================================================
--  PÓS-ATUALIZAÇÃO: padronização de nomes + garantia de envio
--  para quem trocou de palestra. Rode UMA vez no SQL Editor.
--  (Ideal: antes de ligar/continuar o envio dos comprovantes.)
-- ============================================================

begin;

-- 1) PADRONIZA OS NOMES (Título: "Maria de Souza e Silva") ---------
--    initcap põe cada palavra com inicial maiúscula; depois os
--    conectivos voltam para minúsculo. Vale para toda a base
--    (oficiais em CAIXA ALTA e manuais em minúsculo).
update presenca.participantes
set nome = replace(replace(replace(replace(replace(replace(
             initcap(regexp_replace(trim(nome), '\s+', ' ', 'g')),
           ' Da ',  ' da '),
           ' De ',  ' de '),
           ' Do ',  ' do '),
           ' Das ', ' das '),
           ' Dos ', ' dos '),
           ' E ',   ' e ')
where nome is not null and nome <> '';

-- 2) GARANTE O ENVIO DO NOVO E-MAIL PARA QUEM TROCOU DE PALESTRA ---
--    28 professores (na atualização de 13/07 saíram de uma sessão e
--    entraram em outra). As linhas foram recriadas com qr_enviado
--    false, mas este UPDATE garante mesmo que algum lote já tenha
--    passado por eles: o gatilho horário reenvia com os dados novos.
update presenca.participantes
set qr_enviado = false
where token in (
  '31088','34556_M','36696_M','36696_T','38145','38232','38246','38344',
  '38428','38437','39980','40104','41201','42419_M','44177','47743',
  '47783','47814','47832','47850','48028','48037','48889','49197',
  '49452','49835','50158','50310','50342'
);

commit;

-- CONFERÊNCIA ------------------------------------------------------
-- Amostra de nomes padronizados
select nome from presenca.participantes order by nome limit 12;

-- Os 28 que trocaram: palestra atual e status de envio (deve ser false)
select token, nome, palestra_id, qr_enviado
from presenca.participantes
where token in (
  '31088','34556_M','36696_M','36696_T','38145','38232','38246','38344',
  '38428','38437','39980','40104','41201','42419_M','44177','47743',
  '47783','47814','47832','47850','48028','48037','48889','49197',
  '49452','49835','50158','50310','50342'
)
order by nome, token;
