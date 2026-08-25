#!/usr/bin/env bash
# Guarda anti-vazamento da rede SME (hook PreToolUse do Claude Code).
#
# Todo repositório desta rede é PÚBLICO e o site é publicado pelo GitHub Pages
# a partir da raiz do repositório: todo arquivo commitado vira URL pública.
# O histórico do Git, além disso, é permanente.
#
# Este hook intercepta:
#   • `git commit` — bloqueia se as mudanças staged trazem dado pessoal,
#     credencial ou arquivo de dados;
#   • `git push`   — bloqueia se QUALQUER arquivo de dados estiver versionado,
#     mesmo que tenha entrado por outro caminho (--no-verify, outra máquina,
#     outra ferramenta). É a rede de segurança de última hora.
#
# Falso positivo? Rode com SME_PERMITIR_COMMIT=1. Isso existe para arquivo que
# comprovadamente não tem dado pessoal — NUNCA para publicar um .sql.
#
# Só usa bash + git + grep + sed + base64 (tudo vem com o Git for Windows /
# qualquer Linux ou macOS). Nada a instalar nas máquinas.
#
# Também funciona como pre-commit do git (sem stdin JSON):
#   ln -s ../../.claude/hooks/verificar-vazamento.sh .git/hooks/pre-commit

set -u

REPO="$PWD"
# Sem JSON no stdin (uso como pre-commit do git), o que se verifica é o commit.
ACAO="commit"

# Quando chamado pelo Claude Code, chega um JSON no stdin com o comando.
if [ ! -t 0 ]; then
  ENTRADA="$(cat 2>/dev/null || true)"
  if [ -n "$ENTRADA" ] && printf '%s' "$ENTRADA" | grep -q '"tool_input"'; then
    # Só interessam git commit e git push; qualquer outro comando passa direto.
    if printf '%s' "$ENTRADA" | grep -qE 'git([^"|;&]|\\\\)*commit'; then
      ACAO="commit"
    elif printf '%s' "$ENTRADA" | grep -qE 'git([^"|;&]|\\\\)*push'; then
      ACAO="push"
    else
      exit 0
    fi
    CWD_JSON="$(printf '%s' "$ENTRADA" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
    [ -n "$CWD_JSON" ] && REPO="$(printf '%s' "$CWD_JSON" | sed 's/\\\\/\//g')"
    M=$(printf '%s' "$ENTRADA" | sed -n 's/.*git[[:space:]]\{1,\}-C[[:space:]]\{1,\}\(\\\"[^\\]*\\\"\|[^ "\\]*\).*/\1/p' | head -1)
    [ -n "${M:-}" ] && REPO="$(printf '%s' "$M" | sed 's/^\\\"//; s/\\\"$//')"
  fi
fi

[ "${SME_PERMITIR_COMMIT:-0}" = "1" ] && exit 0
command -v git >/dev/null 2>&1 || exit 0
git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1 || exit 0

PROBLEMAS=""
falha() { PROBLEMAS="${PROBLEMAS}- $1
"; }

EXT_DADOS='\.(sql|csv|dump|xlsx|xls)$'

# Exceções conferidas uma a uma em .guarda-permitidos (modelo em branco que a
# própria página oferece para download, por exemplo). Sem o arquivo, nada é
# permitido — o padrão é barrar.
PERMITIDOS="$REPO/.guarda-permitidos"
tirar_permitidos() {
  [ -f "$PERMITIDOS" ] || { cat; return; }
  LISTA="$(mktemp 2>/dev/null || echo "${TMPDIR:-/tmp}/guarda.$$")"
  grep -vE '^[[:space:]]*(#|$)' "$PERMITIDOS" > "$LISTA" 2>/dev/null || true
  if [ -s "$LISTA" ]; then
    # grep sai 1 quando filtra tudo — o caso bom. `|| true` evita quebrar o pipe.
    grep -vxF -f "$LISTA" || true
  else
    cat
  fi
  rm -f "$LISTA"
}

# ---------------------------------------------------------------- PUSH -------
# Rede de última hora: não importa como o arquivo entrou (--no-verify, outra
# máquina, outra ferramenta) — se está versionado, não sai daqui.
if [ "$ACAO" = "push" ]; then
  VERSIONADOS="$(git -C "$REPO" ls-files | grep -iE "$EXT_DADOS" | tirar_permitidos | head -20 || true)"
  if [ -n "$VERSIONADOS" ]; then
    {
      echo "PUSH BLOQUEADO pela guarda anti-vazamento (repositório público da SME):"
      echo "Há arquivo de dados versionado. O site é publicado pelo GitHub Pages a"
      echo "partir da raiz, então isto viraria URL pública e baixável:"
      printf '%s\n' "$VERSIONADOS" | sed 's/^/  - /'
      echo "Tire do índice com: git rm --cached <arquivo>  (o arquivo continua no disco)"
      echo "Falso positivo? Rode com SME_PERMITIR_COMMIT=1."
    } >&2
    exit 2
  fi
  exit 0
fi

# -------------------------------------------------------------- COMMIT -------
# 1. Arquivo de dados proibido em repositório público
#    --diff-filter=d exclui as EXCLUSÕES: apagar um arquivo destes é a correção,
#    não a falta. Sem isso, a guarda impede que se limpe um vazamento já feito.
ARQUIVOS_RUINS="$(git -C "$REPO" diff --cached --name-only --diff-filter=d | grep -iE "$EXT_DADOS" | tirar_permitidos || true)"
if [ -n "$ARQUIVOS_RUINS" ]; then
  while IFS= read -r a; do
    falha "arquivo de dados proibido em repositório público: $a"
  done <<EOF
$ARQUIVOS_RUINS
EOF
fi

# Só as linhas ADICIONADAS do diff staged
ADICIONADAS="$(git -C "$REPO" diff --cached | grep '^+' | grep -v '^+++' | cut -c2- || true)"

if [ -n "$ADICIONADAS" ]; then
  # 2. CPF formatado
  N_CPF=$(printf '%s' "$ADICIONADAS" | grep -cE '[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}' || true)
  [ "${N_CPF:-0}" -gt 0 ] && falha "possível CPF em linha adicionada ($N_CPF ocorrência(s))"

  # 3. Chave privada
  printf '%s' "$ADICIONADAS" | grep -q -- '-----BEGIN [A-Z ]*PRIVATE KEY-----' \
    && falha "chave privada em linha adicionada"

  # 4. Token de acesso do Supabase
  printf '%s' "$ADICIONADAS" | grep -qE '\bsbp_[A-Za-z0-9]{20,}' \
    && falha "token de acesso do Supabase (sbp_...) em linha adicionada"

  # 5. JWT com role service_role (a chave anon é pública e PODE ser versionada;
  #    decodificamos o payload para distinguir uma da outra)
  for PAYLOAD in $(printf '%s' "$ADICIONADAS" \
      | grep -oE 'eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+' \
      | cut -d. -f2 | sort -u); do
    PAD=$(( (4 - ${#PAYLOAD} % 4) % 4 ))
    DECOD="$(printf '%s' "$PAYLOAD" | tr '_-' '/+' | { cat; printf '%.0s=' $(seq 1 $PAD 2>/dev/null); } | base64 -d 2>/dev/null || true)"
    if printf '%s' "$DECOD" | grep -qE '"role"[[:space:]]*:[[:space:]]*"service_role"'; then
      falha "JWT com role service_role em linha adicionada"
      break
    fi
  done

  # 6. E-mail não institucional (institucionais e técnicos são permitidos)
  SUSPEITOS="$(printf '%s' "$ADICIONADAS" \
    | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' \
    | grep -ivE '@([A-Za-z0-9.-]*\.)?(anthropic\.com|smedigital\.com\.br|supabase\.(co|com)|github\.com|users\.noreply\.github\.com|example\.com|exemplo\.com)$|\.gov\.br$' \
    | sort -u | head -5 || true)"
  [ -n "$SUSPEITOS" ] && falha "e-mail(s) não institucionais: $(printf '%s' "$SUSPEITOS" | tr '\n' ' ')"
fi

if [ -n "$PROBLEMAS" ]; then
  {
    echo "COMMIT BLOQUEADO pela guarda anti-vazamento (repositório público da SME):"
    printf '%s' "$PROBLEMAS"
    echo "Revise as mudanças staged. Falso positivo? Rode com SME_PERMITIR_COMMIT=1."
  } >&2
  exit 2
fi
exit 0
