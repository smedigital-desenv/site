-- ============================================================
--  Inserção de validadores (perfil padrão: 'fiscal')
--  Tabela: presenca.validadores (email PK, nome, perfil)
--
--  Observações:
--   - Emails normalizados para minúsculas (auth.js compara com
--     session.user.email.toLowerCase(), então precisa bater exato).
--   - Nomes com espaços extras foram aparados.
--   - Duplicatas removidas (Patrícia Batista da Silva,
--     Márcia Roberta Sousa Silva, Arnaldo Martinez de Bacco Junior).
--   - Correções de e-mail com erro de digitação:
--       * Camila Sabatin Branchini: "pnrp.sp.gov" -> "pmrp.sp.gov.br"
--       * Benilde Helena de Moraes Rosa: removido sufixo "@g" indevido.
--   - ON CONFLICT DO NOTHING: não sobrescreve validadores já existentes.
-- ============================================================

insert into presenca.validadores (email, nome, perfil) values
  ('celsopacola@educacao.pmrp.sp.gov.br',        'Celso Raphael de Pádua Pacola',                     'fiscal'),
  ('danieleaugusto@educacao.pmrp.sp.gov.br',     'Daniele dos Santos Souza Augusto',                  'fiscal'),
  ('leticiasantos@educacao.pmrp.sp.gov.br',      'Leticia Aparecida dos Santos',                      'fiscal'),
  ('deborasantos@educacao.pmrp.sp.gov.br',       'Débora Helena Gonçalves',                           'fiscal'),
  ('patriciaoliveira@educacao.pmrp.sp.gov.br',   'Patrícia Gimenez Santos de Oliveira',               'fiscal'),
  ('julianaramos@educacao.pmrp.sp.gov.br',       'Juliana Maria Scandelai Ramos',                     'fiscal'),
  ('marianaimori@educacao.pmrp.sp.gov.br',       'Mariana Galves Imori',                              'fiscal'),
  ('adrianacruz@educacao.pmrp.sp.gov.br',        'Adriana Bestwti',                                   'fiscal'),
  ('elianasilva@educacao.pmrp.sp.gov.br',        'Eliana Nunes da Silva',                             'fiscal'),
  ('rodrigofelix@educacao.pmrp.sp.gov.br',       'Rodrigo Aécio Felix',                               'fiscal'),
  ('anadias@educacao.pmrp.sp.gov.br',            'Ana Paula Dias Moares',                             'fiscal'),
  ('viviancoraucci@educacao.pmrp.sp.gov.br',     'Vivian Coraucci',                                   'fiscal'),
  ('guilhermealmeida@educacao.pmrp.sp.gov.br',   'Guilherme Mantovan de Almeida',                     'fiscal'),
  ('fernandamaria@educacao.pmrp.sp.gov.br',      'Fernanda Maria de Oliveira',                        'fiscal'),
  ('cleufecastro@educacao.pmrp.sp.gov.br',       'Cleufe Cristina Tavares de Castro',                 'fiscal'),
  ('adrianamizukami@educacao.pmrp.sp.gov.br',    'Adriana Carvalho Mizukami',                         'fiscal'),
  ('esouza@educacao.pmrp.sp.gov.br',             'Elaine Cristina dos Santos Garcia Colli de Souza',  'fiscal'),
  ('inesmazer@educacao.pmrp.sp.gov.br',          'Inês Maria Silva Barros Mazer',                     'fiscal'),
  ('carolinaalexandre@educacao.pmrp.sp.gov.br',  'Carolina Veloni Alexandre',                         'fiscal'),
  ('roselainepagliotto@educacao.pmrp.sp.gov.br', 'Roselaine Thomaz Pagliotto',                        'fiscal'),
  ('fabiosilva@educacao.pmrp.sp.gov.br',         'Fábio Deodato dos Santos Silva',                    'fiscal'),
  ('arnaldojunior@educacao.pmrp.sp.gov.br',      'Arnaldo Martinez de Bacco Junior',                  'fiscal'),
  ('mbsilva@educacao.pmrp.sp.gov.br',            'Mariane Banks',                                     'fiscal'),
  ('brenohomem@educacao.pmrp.sp.gov.br',         'Breno Donadon Homem',                               'fiscal'),
  ('adrianavicentini@educacao.pmrp.sp.gov.br',   'Adriana Lúcia Capranica Vicentini',                 'fiscal'),
  ('tiagofeliciano@educacao.pmrp.sp.gov.br',     'Tiago Esteves Bernardes Pinto Feliciano',           'fiscal'),
  ('denisecherfan@educacao.pmrp.sp.gov.br',      'Denise Aparecida Duarte Cherfan',                   'fiscal'),
  ('renataquintino@educacao.pmrp.sp.gov.br',     'Renata Pinheiro',                                   'fiscal'),
  ('marciasilva@educacao.pmrp.sp.gov.br',        'Márcia Roberta Sousa Silva',                        'fiscal'),
  ('paulafigueiredo@educacao.pmrp.sp.gov.br',    'Paula Ripamonte Figueiredo',                        'fiscal'),
  ('daniellecardoso@educacao.pmrp.sp.gov.br',    'Danielle Regina do Amaral Cardoso',                 'fiscal'),
  ('joicecosta@educacao.pmrp.sp.gov.br',         'Joice Fernanda Ferreira Costa',                     'fiscal'),
  ('pbsilva@educacao.pmrp.sp.gov.br',            'Patrícia Batista da Silva',                         'fiscal'),
  ('patriciarodrigues@educacao.pmrp.sp.gov.br',  'Patrícia Barbosa Valadao Rodrigues',                'fiscal'),
  ('suelenjacintho@educacao.pmrp.sp.gov.br',     'Suelen Cristina Oliveira Nascimento Jacintho',      'fiscal'),
  ('carlosmacedo@educacao.pmrp.sp.gov.br',       'Carlos Eduardo de Carvalho Macedo',                 'fiscal'),
  ('isadoraremundini@educacao.pmrp.sp.gov.br',   'Isadora Remundini',                                 'fiscal'),
  ('fernandacalegari@educacao.pmrp.sp.gov.br',   'Fernanda Oliveira de Andrade Calegari',             'fiscal'),
  ('danielacosta@educacao.pmrp.sp.gov.br',       'Daniela Netto Scatolin Costa',                      'fiscal'),
  ('mariacaliman@educacao.pmrp.sp.gov.br',       'Maria Juliana Ferreira Caliman',                    'fiscal'),
  ('andresaferreira@educacao.pmrp.sp.gov.br',    'Andresa Ferreira',                                  'fiscal'),
  ('camilabranchini@educacao.pmrp.sp.gov.br',    'Camila Sabatin Branchini',                          'fiscal'),
  ('joubertoliveira@educacao.pmrp.sp.gov.br',    'Joubert Silva de Oliveira',                         'fiscal'),
  ('karinabrito@educacao.pmrp.sp.gov.br',        'Karina Daniela Mazzaro de Brito',                   'fiscal'),
  ('robertapoltronieri@educacao.pmrp.sp.gov.br', 'Roberta Poltronieri',                               'fiscal'),
  ('ruteribeiro@educacao.pmrp.sp.gov.br',        'Rute Mara Leite Ribeiro',                           'fiscal'),
  ('andregoncalves@educacao.pmrp.sp.gov.br',     'André Gomes Ventura Gonçalves',                     'fiscal'),
  ('elianaoliveira@educacao.pmrp.sp.gov.br',     'Eliana Silva de Oliveira',                          'fiscal'),
  ('christianoliveira@educacao.pmrp.sp.gov.br',  'Christian V Oliveira',                              'fiscal'),
  ('benilderosa@educacao.pmrp.sp.gov.br',        'Benilde Helena de Moraes Rosa',                     'fiscal'),
  ('julianaferreira@educacao.pmrp.sp.gov.br',    'Juliana Gaia',                                      'fiscal'),
  ('evelinesouza@educacao.pmrp.sp.gov.br',       'Eveline Pereira de Andrade Souza',                  'fiscal'),
  ('brunosilva@educacao.pmrp.sp.gov.br',         'Bruno Lucas da Silva',                              'fiscal'),
  ('helenabernardes@educacao.pmrp.sp.gov.br',    'Helena Vassimon Bernardes',                         'fiscal'),
  ('nathaliaalmeida@educacao.pmrp.sp.gov.br',    'Nathalia Suppino Ribeiro de Almeida',               'fiscal'),
  ('anacardoso@educacao.pmrp.sp.gov.br',         'Ana Paula Nascimento Cardoso',                      'fiscal')
on conflict (email) do nothing;
