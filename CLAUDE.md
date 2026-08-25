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

**Nunca versione:**

- `*.sql`, `*.csv`, `*.dump`, `*.xlsx` — script de carga e export carregam dado
  real junto, quase sempre sem quem escreveu perceber. Estão no `.gitignore`.

  A pasta `db/` existe só na máquina de quem trabalha: **nenhum script dela é
  versionado**. Eles são entregues fora do repositório, executados no SQL Editor
  do Supabase e ficam por lá. Os arquivos que estiveram versionados até
  2026-08-25 carregavam 3.152 e-mails de servidores — e, enquanto estavam no
  repositório, eram baixáveis direto pelo GitHub Pages. Se você precisar de um
  deles, peça a quem executou; não os traga de volta para o Git.

- Dado pessoal de qualquer natureza: nome, e-mail, RA, matrícula, CPF, telefone,
  endereço. Nem em código, nem em comentário, nem em dado de exemplo, nem em
  mensagem de commit.
- Credencial de qualquer tipo: `service_role`, senha de banco, token de API,
  chave privada.

#### A guarda anti-vazamento

Nada disso depende de alguém lembrar. Uma guarda automática barra arquivo de
dados, CPF, chave privada, `service_role` e lista de e-mails **antes** de
virarem publicação. Ela é versionada em
`.claude/hooks/verificar-vazamento.sh` e roda em quatro portas — porque fechar
só uma não fecha nada:

| Porta | Cobre |
|---|---|
| `PreToolUse` / Bash | `git commit` e `git push` feitos pelo Claude Code |
| `PreToolUse` / MCP do GitHub | escrita direta pela API (`create_or_update_file`, `push_files`), que não passa por git nenhum |
| `pre-commit` do git | quem commita fora do Claude Code — terminal, VS Code, GitHub Desktop |
| `pre-push` do git | última barreira antes de o conteúdo sair da máquina |

As duas últimas se instalam sozinhas: `.githooks/` é versionado e o
`SessionStart` aponta `core.hooksPath` para lá. À mão, uma vez por clone:
`git config core.hooksPath .githooks`.

⚠️ **Em cada COMPUTADOR ou dispositivo, rode o instalador uma vez.** Ele passa a
valer para **todo** repositório daquela máquina — inclusive os que ainda não
existem — e para **toda** sessão do Claude Code daquela conta, porque entra em
`~/.claude/settings.json`, que é do usuário e não do projeto:

```bash
curl -fsSL https://smedigital.com.br/guarda/instalar.sh | bash
```

⚠️ **O `git commit` passar não é sinal verde: o push é conferido de novo.** A
válvula `SME_PERMITIR_COMMIT=1` destranca UMA porta, não a publicação — o que
entrou por ela continua barrado no `push`. É de propósito: um descuido não pode
virar publicação por causa de uma variável de ambiente.

⚠️ **A guarda ignora as EXCLUSÕES (`--diff-filter=d`).** Apagar um arquivo
proibido é a correção, não a falta. Até 2026-08-25 ela olhava `--name-only`
puro e barrava justamente o commit que limpava o vazamento — ou seja, tornava
permanente qualquer vazamento que já tivesse acontecido.

⚠️ **E-mail institucional também é dado pessoal.** Três ou mais endereços
`.gov.br` distintos no mesmo diff bloqueiam; um endereço de contato num
documento passa. O vazamento de 2026-08 foram 3.152 endereços institucionais
dentro de scripts de carga, e a regra antiga liberava `.gov.br` inteiro.

⚠️ **O `%` fica FORA da parte local do e-mail, e isso não é descuido de
regex.** Com ele, o coringa do SQL (`email like '%@educacao.pmrp.sp.gov.br'`)
casa como se fosse endereço de gente, e uma checagem de domínio vira "dado
pessoal publicado". Foi assim que a auditoria acusou quatro arquivos do `lunar`
que não tinham endereço nenhum de pessoa.

⚠️ **Nada disso apaga o histórico, e o `.gitignore` não destrava arquivo já
rastreado.** A guarda impede o PRÓXIMO vazamento. O que já foi publicado só sai
com reescrita de histórico e força-push.

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
