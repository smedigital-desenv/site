# Consultas Públicas — SME Ribeirão Preto

> **Este arquivo é lido automaticamente por qualquer sessão do Claude Code
> neste repositório.** Leia antes de mexer em qualquer coisa.

Consultas públicas da Secretaria Municipal de Educação.

Publicado em `smedigital.com.br/presenca/` pelo GitHub Pages.
---

## Regras da rede SME — valem para TODOS os sistemas

> Esta seção é padrão e idêntica em todos os repositórios da SME Ribeirão Preto.
> Ao alterá-la, replique nos demais.

### 1. Todo repositório aqui é PÚBLICO

Trate cada commit como publicação. O histórico do Git guarda para sempre: apagar
depois exige reescrita de histórico, força-push em todas as branches e abertura
de chamado no suporte do GitHub para purgar referências em pull requests. Já
aconteceu nesta rede e levou semanas.

Pior que isso: o site é publicado pelo **GitHub Pages a partir da raiz do
repositório**. Todo arquivo commitado vira URL pública — `db/carga.sql` no Git é
`smedigital.com.br/site/db/carga.sql` no navegador, baixável por qualquer um,
sem passar pelo GitHub. Não existe "arquivo escondido no repositório".

#### Regra dura: script SQL não entra no Git

**Nunca versione `.sql`.** Nem migração, nem carga, nem "só o esquema", nem
exemplo com dado fictício. Não há exceção a avaliar caso a caso — a regra existe
justamente porque o caso a caso falha.

Como funciona no lugar disso:

- os scripts ficam em `db/`, que **existe só na máquina de quem trabalha** e é
  barrado pelo `.gitignore`;
- são entregues fora do repositório (anexo na conversa, e-mail, upload direto),
  rodados no SQL Editor do Supabase, e vivem lá;
- precisa de um script antigo? Peça a quem executou. Não o traga de volta.

Isto não é hipótese. Até 2026-08-25 este repositório versionava 17 arquivos
`.sql`; quatro deles somavam **3.152 e-mails de servidores da rede**, e ficaram
baixáveis pela web enquanto estiveram lá. Foram retirados do `HEAD`; o histórico
ainda os contém.

**Também nunca versione:**

- `*.csv`, `*.dump`, `*.xlsx`, `*.xls` — export carrega dado real junto, quase
  sempre sem quem escreveu perceber. Estão no `.gitignore`.
- Dado pessoal de qualquer natureza: nome, e-mail, RA, matrícula, CPF, telefone,
  endereço. Nem em código, nem em comentário, nem em dado de exemplo, nem em
  mensagem de commit.
- Credencial de qualquer tipo: `service_role`, senha de banco, token de API,
  chave privada.

**Pode versionar:** a chave `anon` do Supabase. Ela é pública por natureza e vai
para o navegador de qualquer visitante. A segurança real está nas permissões do
banco, nunca em esconder essa chave.

Os sistemas desta rede tratam **dados pessoais de crianças**, alguns de natureza
sensível. Isso não é hipótese: é o conteúdo real da maioria destas bases.

#### As três guardas, e o que fazer quando uma delas te barra

1. **`.gitignore`** — barra `*.sql`, `*.csv`, `*.dump`, `*.xlsx`, `*.xls`.
2. **`.claude/hooks/verificar-vazamento.sh`** — hook `PreToolUse`, bloqueia
   `git commit` e `git push` que levem arquivo de dados, CPF, chave privada,
   token `sbp_`, JWT `service_role` ou e-mail não institucional.
3. **`.github/workflows/guarda-dados.yml`** — roda no GitHub a cada push e
   falha se algum arquivo de dados estiver versionado. É a única que não depende
   da máquina de ninguém.

Quando uma guarda barra, **a resposta certa é tirar o arquivo do commit**, não
contornar a guarda. `git commit --no-verify`, `git add -f` e
`SME_PERMITIR_COMMIT=1` existem para falso positivo em arquivo que
comprovadamente não tem dado pessoal — nunca para publicar um `.sql`. Na dúvida,
pergunte antes de commitar; desfazer depois custa semanas.

Falso positivo que se repete — um modelo em branco que a própria página oferece
para download, por exemplo — vai para **`.guarda-permitidos`**, uma linha por
caminho, com a justificativa escrita ao lado. As guardas 2 e 3 leem a mesma
lista. Antes de acrescentar uma linha, **abra o arquivo** e procure nome,
e-mail, RA, matrícula, CPF, telefone e endereço; se achar qualquer um, ele não
entra na lista — sai do Git. A lista é para modelo vazio, nunca para dado com
dono.

Esta regra também está gravada como memória de usuário do perfil, em
`~/.claude/CLAUDE.md`, e por isso vale em qualquer repositório desta rede —
inclusive nos que ainda não têm as guardas instaladas. Ao criar um repositório
novo, copie para ele o `.gitignore`, o hook e o workflow daqui.

### 2. Login é sempre pelo Controle de Acesso CENTRAL

Nenhum sistema da rede deve ter login próprio. A autenticação acontece no
**central** (`smedigital.com.br/central/`), que governa quem entra, em quais
sistemas e em quais telas.

Integrar um sistema novo:

```html
<script>window.ACESSO_SISTEMA = 'slug-do-sistema';</script>
<script src="/central/config.js"></script>
<script src="/central/acesso-sme.js"></script>
```

Isso expõe `window.AcessoSME` com `.pronto`, `.perfil`, `.escolas`, `.sistema`,
`.can(tela, acao)`, `.token()`, `.signOut()` e `.simular()`. Sem sessão válida,
a pessoa é levada ao login do central automaticamente.

O sistema precisa estar cadastrado no catálogo do central (tabela `sistemas`),
com suas telas e papéis, antes de a integração funcionar.

**Quando o sistema tem banco Supabase próprio**, existe um degrau: um token
emitido pelo central não é reconhecido por outro projeto Supabase. É preciso uma
ponte que valide o token do central e abra sessão no projeto do sistema. O MAPA
tem essa ponte implementada (`supabase/functions/central-bridge/`) e serve de
referência — não reinvente, copie.

### 3. Segurança do banco (Supabase)

Invariantes. Quebrar qualquer uma expõe dado:

1. **O papel `anon` não tem permissão em nada.** Nem tabela, nem função. Se você
   for escrever `grant ... to anon`, pare e entenda por que aquilo está fechado.
2. **Toda tabela com dado pessoal tem RLS ligado E policy com condição real.**
   RLS ligado sem policy adequada não protege — e policies permissivas se somam
   com **OR**, então uma única `using (true)` anula todas as outras da tabela.
   Verificação canônica:
   ```sql
   select tablename, policyname, cmd from pg_policies
    where schemaname='public' and qual='true' and cmd in ('SELECT','ALL');
   ```
   Só catálogo e configuração podem aparecer aí.
3. **View materializada IGNORA RLS.** É cópia física dos dados. Proteger só a
   tabela de origem é proteção de fachada; revogue o acesso direto e exponha por
   função.
4. **Função `SECURITY DEFINER` ignora RLS** — ela roda com o poder do dono. Ou
   aplica o recorte por dentro, ou não deveria ser `DEFINER`.
5. **O filtro feito em JavaScript não é segurança.** É conforto visual. Quem
   abre o DevTools vê tudo que o banco entregou. A regra tem que estar no
   Postgres.

**Desempenho:** chamadas de função dentro de policy precisam ser envolvidas em
`(select ...)`, senão são reavaliadas linha a linha e a consulta estoura tempo
até em tabela pequena:

```sql
using ( (select public.minha_funcao()) or coluna = ... )
```

### 4. Armadilhas de publicação

- **O `git push` feito por automação não dispara o workflow de deploy.** Rode
  manualmente pela aba Actions depois de publicar.
- **Confirme o push por hash, não pela mensagem.** `git push | tail` esconde
  "Everything up-to-date":
  ```bash
  git fetch origin -q && git rev-parse --short origin/main
  ```
- **O SQL Editor do Supabase envolve o script inteiro numa transação.** Um erro
  no meio **desfaz tudo que veio antes**, e o painel mostra só a mensagem do
  erro — parece que o resto passou. Ao falhar no meio, presuma que nada rodou.
- **Edge Function não vai junto no deploy do site.** Alterá-la exige republicar
  pelo painel do Supabase ou pela CLI. Front-end e função desalinhados produzem
  erros que não parecem versão.

### 5. Ao investigar um problema

1. `403` / `permission denied` costuma ser proteção funcionando, não avaria.
   Antes de conceder acesso, entenda por que aquilo está fechado.
2. Erro **intermitente** que "funciona depois de algumas tentativas" é assinatura
   de **corrida**, não de configuração. Procure o que executa o mesmo código duas
   vezes (prerender, prefetch, listener duplicado, aba oculta).
3. Timeout em tabela pequena é estatística velha ou instância saturada. Rode
   `ANALYZE` e verifique a capacidade no painel antes de culpar policy.
4. Antes de propor `grant`, releia a seção 3.

### 6. Manutenção deste arquivo

Ao alterar arquitetura, modelo de acesso, fluxo de autenticação ou processo de
publicação, **atualize este arquivo no mesmo commit**. Não espere que peçam.
Documento desatualizado é pior que nenhum: induz ao erro com aparência de
autoridade.
