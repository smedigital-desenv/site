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

Isto não é hipótese. Até 2026-08-25 o repositório `site` versionava 17 arquivos
`.sql`; quatro deles somavam **3.152 e-mails de servidores da rede**, e ficaram
baixáveis pela web enquanto estiveram lá — o Pages publica da raiz, então todo
arquivo commitado vira URL.

Onde a definição de esquema já está versionada de antes — é o caso de `lunar`,
`saelm`, `repositorio` e `questoes` —, ela fica listada em `.guarda-permitidos`,
arquivo por arquivo e com a justificativa escrita. Estar na lista **não** é
liberação para acrescentar mais: cada arquivo novo exige uma linha nova, e a
linha exige que alguém tenha aberto o arquivo.

**Também nunca versione:**

- `*.csv`, `*.dump`, `*.xlsx`, `*.xls` — export carrega dado real junto, quase
  sempre sem quem escreveu perceber. Estão no `.gitignore`.
- Dado pessoal de qualquer natureza: nome, e-mail, RA, matrícula, CPF, telefone,
  endereço. Nem em código, nem em comentário, nem em dado de exemplo, nem em
  mensagem de commit.
- Credencial de qualquer tipo: `service_role`, senha de banco, token de API,
  chave privada.

#### As CINCO portas da guarda

Nada disso depende de alguém lembrar. **Uma** regra —
`.claude/hooks/verificar-vazamento.sh` — atende cinco portas, porque fechar só
uma não fecha nada:

| Porta | Cobre | O que ela pergunta |
|---|---|---|
| `PreToolUse` / Bash | `git commit` e `git push` do Claude Code | o que está staged; o que está versionado |
| `PreToolUse` / MCP do GitHub | `create_or_update_file`, `push_files` | escrita direta pela API, que não passa por git nenhum |
| `pre-commit` do git | terminal, VS Code, GitHub Desktop | o que está staged |
| `pre-push` do git | última barreira antes de sair da máquina | o que está versionado, e o que os commits não publicados tocaram |
| `.github/workflows/guarda-dados.yml` | o GitHub, a cada push e PR | o que está versionado — e não depende de máquina nenhuma |

⚠️ **O workflow não reimplementa a regra: ele CHAMA a mesma guarda**, em modo
de push. Duas implementações da mesma regra divergem na primeira correção feita
só em uma — e aí uma libera o que a outra barra, sem ninguém saber qual está
certa.

As portas do git se instalam sozinhas: `.githooks/` é versionado e o
`SessionStart` aponta `core.hooksPath` para lá. À mão, uma vez por clone:
`git config core.hooksPath .githooks`.

⚠️ **`git commit` passar não é sinal verde: o push pergunta outra coisa.** O
commit olha o que está staged; o push olha o que está VERSIONADO — e por isso
pega o que entrou por qualquer outro caminho: `--no-verify`, `git add -f`, outra
máquina, outra ferramenta, ou antes de a guarda existir.

⚠️ **A guarda ignora as EXCLUSÕES (`--diff-filter=d`).** Apagar um arquivo
proibido é a correção, não a falta. Até 2026-08-25 ela olhava `--name-only`
puro e barrava justamente o commit que limpava o vazamento — ou seja, tornava
permanente qualquer vazamento que já tivesse acontecido.

⚠️ **E-mail institucional também é dado pessoal.** Três ou mais endereços
`.gov.br` distintos no mesmo diff bloqueiam; um endereço de contato num
documento passa. O vazamento de 2026-08 foram 3.152 endereços institucionais, e
a regra antiga liberava `.gov.br` inteiro.

⚠️ **O `%` fica FORA da parte local do e-mail, e isso não é descuido de
regex.** Com ele, o coringa do SQL (`email like '%@educacao.pmrp.sp.gov.br'`)
casa como se fosse endereço de gente, e uma checagem de domínio vira "dado
pessoal publicado". Foi assim que a auditoria acusou quatro arquivos do `lunar`
que não tinham endereço nenhum de pessoa.

⚠️ **Nada disso apaga o histórico, e o `.gitignore` não destrava arquivo já
rastreado.** A guarda impede o PRÓXIMO vazamento. O que já foi publicado só sai
com reescrita de histórico e força-push.

#### Quando uma guarda te barra

**A resposta certa é tirar o arquivo do commit**, não contornar a guarda.
`git commit --no-verify`, `git add -f` e `SME_PERMITIR_COMMIT=1` existem para
falso positivo em arquivo que comprovadamente não tem dado pessoal — nunca para
publicar um `.sql`. Na dúvida, pergunte antes de commitar; desfazer depois custa
semanas.

⚠️ **E a válvula destranca UMA porta, não a publicação.** O que entrar com
`SME_PERMITIR_COMMIT=1` continua barrado no `push` e no workflow. É de
propósito: um descuido não pode virar publicação por causa de uma variável de
ambiente.

Falso positivo que se repete — um modelo em branco que a própria página oferece
para download, a definição de esquema de um sistema — vai para
**`.guarda-permitidos`**: uma linha por caminho, linha terminada em `/` cobre a
pasta, e a justificativa escrita ao lado ou em bloco acima. **A mesma lista é
lida pela guarda local, pelo workflow e pela auditoria semanal da rede** — se
cada um tivesse a sua, uma liberaria o que a outra barra.

⚠️ **Liberar o caminho NÃO desliga a checagem de conteúdo.** Um arquivo novo
dentro de uma pasta liberada continua barrado se trouxer CPF, chave privada,
`service_role` ou lista de e-mails. Antes de acrescentar uma linha, **abra o
arquivo** e procure nome, e-mail, RA, matrícula, CPF, telefone e endereço; se
achar qualquer um, ele não entra na lista — sai do Git.

#### Como a regra chega a todo aparelho

São dois alcances diferentes, e os dois são necessários: a **memória** faz o
Claude Code saber a regra; a **guarda** impede a publicação mesmo de quem não
leu. O texto canônico da memória está em `.claude/memoria-perfil.md`.

| Onde | Alcance | Como instalar |
| --- | --- | --- |
| Setup script do ambiente de nuvem | Toda sessão de nuvem, **de qualquer aparelho** — navegador, celular, desktop, `claude --cloud`, rotinas | claude.ai/code → Environments → Setup script, colando `.claude/setup-ambiente-nuvem.sh` |
| `~/.sme-guarda` + `core.hooksPath` global | **Todo repositório daquele computador**, inclusive os que ainda não existem, e toda sessão do Claude Code daquele perfil | `curl -fsSL https://smedigital.com.br/guarda/instalar.sh \| bash`, uma vez por máquina |
| `.githooks/` + `.claude/settings.json` do repositório | Quem clonar este repositório, com ou sem instalador | vem versionado; o `SessionStart` liga sozinho |
| `.github/workflows/guarda-dados.yml` | O GitHub, independente de máquina | vem versionado |
| `CLAUDE.md` de cada repositório | Quem trabalha naquele repositório | replicar esta seção |

O setup script é o que resolve "qualquer computador ou celular" para a memória:
roda como root antes de o Claude Code iniciar e grava `~/.claude/CLAUDE.md`
dentro do container. Como o ambiente é do perfil, e não do aparelho, vale
igualmente no celular e no navegador. O instalador por máquina é o que resolve
o mesmo para a guarda, inclusive fora do Claude Code.

⚠️ **O ambiente de nuvem é efêmero.** O que você instalar à mão dentro de uma
sessão morre com o container; o que vale na sessão seguinte é o que está no
setup script do ambiente ou versionado no repositório.

Ao criar um repositório novo nesta rede, copie para ele o `.gitignore`, o hook,
o `.githooks/`, o workflow e esta seção — ou comece pelo `template-sistema-sme`,
que já traz tudo.

**Pode versionar:** a chave `anon` do Supabase. Ela é pública por natureza e vai
para o navegador de qualquer visitante. A segurança real está nas permissões do
banco, nunca em esconder essa chave.

Os sistemas desta rede tratam **dados pessoais de crianças**, alguns de natureza
sensível. Isso não é hipótese: é o conteúdo real da maioria destas bases.

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
