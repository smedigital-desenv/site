/**
 * EnviarListaPresenca.gs — envia a LISTA DE PRESENÇA de cada UNIDADE (escola)
 * por e-mail, com a lista em PDF anexado.
 *
 * Reaproveita helpers GLOBAIS do Code.gs (supaFetch, supaFetchAll, esc) e as
 * constantes do EnviarQR.gs (EVENTO_TEMA, EVENTO_DATA, REMETENTE) — mesmo
 * projeto Apps Script.
 *
 * FONTE DOS DADOS: Supabase (participantes + presencas).
 * DESTINATÁRIOS: uma aba da planilha ativa chamada "emails_escolas" com
 *   duas colunas no cabeçalho: uma contendo "unidade" (ou "escola") e outra
 *   contendo "email" (ou "e-mail"). Cada linha = uma escola e o e-mail dela.
 *
 * PRÉ-REQUISITOS
 *   - SUPABASE_SERVICE_KEY em Script Properties (a mesma do Code.gs).
 *   - Aba "emails_escolas" preenchida (unidade | email).
 *
 * COMO USAR (nesta ordem)
 *   1. previewListasPresenca()
 *        → mostra no Log quantas escolas receberiam, quais unidades estão SEM
 *          e-mail cadastrado e a cota de envio restante. NÃO envia nada.
 *   2. enviarListaPresencaTeste("seu-email@dominio", "NOME EXATO DA ESCOLA")
 *        → envia UMA lista de teste para você conferir o PDF.
 *          (Se omitir a unidade, usa a primeira encontrada.)
 *   3. enviarListasPresencaPorEscola()
 *        → envia a TODAS as escolas que têm e-mail cadastrado na planilha.
 *
 * OBSERVAÇÕES
 *   - O nome da unidade no cadastro (participantes.unidade) é casado com o da
 *     planilha ignorando acentos, maiúsculas/minúsculas e espaços repetidos.
 *   - Respeita a cota diária do Gmail (MailApp.getRemainingDailyQuota).
 *   - Reenviar é seguro: cada execução manda a versão atual da lista.
 */

var LP_SHEET   = "emails_escolas";                                  // aba com unidade|email
var LP_ASSUNTO = "Lista de presença — Congresso Municipal de Educação";
var LP_COR     = "#173257";

// ── Normalização para casar nomes de unidade (dados x planilha) ──────────────
function _lpNorm(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // remove acentos
    .replace(/\s+/g, " ").trim().toUpperCase();
}

function _lpSlug(s) {
  return _lpNorm(s).toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "").slice(0, 50) || "escola";
}

// ── Lê a planilha "emails_escolas" → { unidadeNormalizada: {email, nome} } ───
function _lpMapaEmails() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(LP_SHEET);
  if (!sh) throw new Error('Crie uma aba chamada "' + LP_SHEET + '" com as colunas "unidade" e "email".');

  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return {};

  var H = vals[0].map(function (h) { return String(h || "").toLowerCase(); });
  function idx(fn) { for (var i = 0; i < H.length; i++) if (fn(H[i])) return i; return -1; }
  var iU = idx(function (h) { return h.indexOf("unidade") !== -1 || h.indexOf("escola") !== -1; });
  var iE = idx(function (h) { return h.indexOf("mail") !== -1; });
  if (iU === -1 || iE === -1) {
    throw new Error('A aba "' + LP_SHEET + '" precisa ter uma coluna "unidade" (ou "escola") e uma coluna "email".');
  }

  var map = {};
  for (var r = 1; r < vals.length; r++) {
    var u = String(vals[r][iU] || "").trim();
    var e = String(vals[r][iE] || "").trim();
    if (u && e) map[_lpNorm(u)] = { email: e, nome: u };
  }
  return map;
}

// ── Busca dados do Supabase: participantes (+palestra) e presenças validadas ─
function _lpDados() {
  var parts = supaFetchAll(
    "participantes?select=token,nome,unidade,palestra_id,palestras(nome,periodo,hora)" +
    "&order=unidade.asc,nome.asc"
  );
  if (!Array.isArray(parts)) throw new Error("Erro ao ler participantes do Supabase.");

  var pres = supaFetchAll("presencas?select=token");
  var presSet = {};
  (Array.isArray(pres) ? pres : []).forEach(function (p) { presSet[p.token] = true; });

  return { parts: parts, presSet: presSet };
}

// ── Agrupa participantes por unidade (chave normalizada) ─────────────────────
function _lpAgrupar(parts) {
  var g = {};
  parts.forEach(function (x) {
    var u = (x.unidade || "").trim();
    var k = _lpNorm(u);
    if (!k) k = "(SEM UNIDADE)";
    if (!g[k]) g[k] = { nome: u || "(Unidade não informada)", lista: [] };
    g[k].lista.push(x);
  });
  return g;
}

function _lpPeriodo(pal) {
  var per = pal && pal.periodo ? String(pal.periodo) : "";
  var s = per.toLowerCase(), c = per;
  if (s.indexOf("manh") === 0) c = "Manhã";
  else if (s.indexOf("tard") === 0) c = "Tarde";
  else if (s.indexOf("noit") === 0 || s.indexOf("notur") === 0) c = "Noite";
  return c + (pal && pal.hora ? " (" + pal.hora + ")" : "");
}

// ── HTML da lista (vira o PDF) ───────────────────────────────────────────────
function _lpHtmlLista(unidadeNome, lista, presSet) {
  var val = 0, rows = "";
  var thBase = 'border:1px solid #cbd5e1;padding:6px 8px;';
  var thHead = 'style="' + thBase + 'background:' + LP_COR + ';color:#fff;text-align:left;"';
  lista.forEach(function (x, i) {
    var ok = !!presSet[x.token]; if (ok) val++;
    var pal = x.palestras ? (x.palestras.nome || "") : "";
    var per = x.palestras ? _lpPeriodo(x.palestras) : "";
    var presCss = ok ? 'color:#1e7a34;background:#e7f4ea;' : 'color:#9a6a00;background:#fff4e0;';
    rows +=
      '<tr>' +
        '<td style="' + thBase + 'text-align:center;">' + (i + 1) + '</td>' +
        '<td style="' + thBase + '">' + esc(x.nome || "") + '</td>' +
        '<td style="' + thBase + '">' + esc(pal + (per ? " — " + per : "")) + '</td>' +
        '<td style="' + thBase + 'font-family:monospace;">' + esc(x.token || "") + '</td>' +
        '<td style="' + thBase + 'text-align:center;font-weight:bold;' + presCss + '">' + (ok ? "Validada" : "Não") + '</td>' +
      '</tr>';
  });
  var pend = lista.length - val;
  var agora = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm");

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="font-family:Arial,Helvetica,sans-serif;color:#16181d;">' +
      '<h2 style="color:' + LP_COR + ';margin:0 0 2px;">' + esc(unidadeNome) + '</h2>' +
      '<div style="color:#555;font-size:13px;margin:0 0 2px;">Lista de presença — Congresso Municipal da Educação</div>' +
      '<div style="color:#555;font-size:12px;margin:0 0 14px;">' + esc(EVENTO_TEMA) + ' · ' + esc(EVENTO_DATA) + ' · Emitido em ' + agora + '</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12.5px;">' +
        '<thead><tr>' +
          '<th ' + thHead + ' style="' + thBase + 'background:' + LP_COR + ';color:#fff;text-align:center;">#</th>' +
          '<th ' + thHead + '>Nome</th>' +
          '<th ' + thHead + '>Palestra</th>' +
          '<th ' + thHead + '>Código</th>' +
          '<th ' + thHead + ' style="' + thBase + 'background:' + LP_COR + ';color:#fff;text-align:center;">Presença</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p style="margin:14px 0 0;color:' + LP_COR + ';font-weight:bold;font-size:13px;">' +
        'Total de inscritos: ' + lista.length +
        ' · Presenças validadas: ' + val +
        ' · Não validadas: ' + pend + '</p>' +
    '</body></html>';
}

// Corpo curto do e-mail (a lista completa vai no PDF anexado).
function _lpCorpoEmail(unidadeNome) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#333;line-height:1.6;">' +
    '<p>Prezada equipe da <strong>' + esc(unidadeNome) + '</strong>,</p>' +
    '<p>Segue em anexo (PDF) a <strong>lista de presença</strong> dos participantes da sua unidade no ' +
    'Congresso Municipal de Educação, com a indicação de presença <strong>validada</strong> ou <strong>não validada</strong>.</p>' +
    '<p>Atenciosamente,<br><strong>' + esc(REMETENTE) + '</strong></p></div>';
}

function _lpPdf(html, filename) {
  return Utilities.newBlob(html, "text/html", filename).getAs("application/pdf").setName(filename);
}

// ── Preview (não envia) ──────────────────────────────────────────────────────
function previewListasPresenca() {
  var mapa = _lpMapaEmails();
  var dados = _lpDados();
  var grupos = _lpAgrupar(dados.parts);

  var comEmail = 0, sem = [], emailsSemPart = [];
  Object.keys(grupos).forEach(function (k) {
    if (mapa[k]) comEmail++;
    else sem.push(grupos[k].nome + " (" + grupos[k].lista.length + " inscritos)");
  });
  Object.keys(mapa).forEach(function (k) { if (!grupos[k]) emailsSemPart.push(mapa[k].nome); });

  Logger.log("Escolas com participantes: " + Object.keys(grupos).length);
  Logger.log("→ COM e-mail cadastrado (receberão): " + comEmail);
  Logger.log("→ SEM e-mail na planilha (" + sem.length + "):" + (sem.length ? "\n- " + sem.join("\n- ") : " nenhuma"));
  if (emailsSemPart.length) Logger.log("E-mails na planilha SEM participantes no cadastro: " + emailsSemPart.join(", "));
  Logger.log("Cota de e-mails restante hoje: " + MailApp.getRemainingDailyQuota());
}

// ── Teste: envia UMA lista para um e-mail de destino ─────────────────────────
function enviarListaPresencaTeste(emailDestino, unidade) {
  if (!emailDestino) { Logger.log("Informe o e-mail de destino."); return; }
  var dados = _lpDados();
  var grupos = _lpAgrupar(dados.parts);
  var k = unidade ? _lpNorm(unidade) : Object.keys(grupos)[0];
  var g = grupos[k];
  if (!g) {
    var ex = Object.keys(grupos).slice(0, 6).map(function (x) { return grupos[x].nome; });
    Logger.log("Unidade não encontrada. Exemplos disponíveis:\n- " + ex.join("\n- "));
    return;
  }
  var html = _lpHtmlLista(g.nome, g.lista, dados.presSet);
  var pdf = _lpPdf(html, "lista-presenca-" + _lpSlug(g.nome) + ".pdf");
  GmailApp.sendEmail(emailDestino, "[TESTE] " + LP_ASSUNTO,
    "Teste da lista de presença de " + g.nome + " (veja o PDF em anexo).",
    { htmlBody: _lpCorpoEmail(g.nome), attachments: [pdf], name: REMETENTE });
  Logger.log("Teste enviado para " + emailDestino + " · unidade: " + g.nome + " · " + g.lista.length + " inscritos.");
}

// ── Envio real: uma lista (PDF) para cada escola com e-mail cadastrado ───────
function enviarListasPresencaPorEscola() {
  var mapa = _lpMapaEmails();
  var dados = _lpDados();
  var grupos = _lpAgrupar(dados.parts);

  var enviados = 0, semEmail = [], erros = 0;

  Object.keys(grupos).forEach(function (k) {
    var g = grupos[k];
    var alvo = mapa[k];
    if (!alvo) { semEmail.push(g.nome); return; }

    if (MailApp.getRemainingDailyQuota() <= 1) {
      Logger.log("Cota de e-mail esgotada — parando. Rode novamente amanhã para os restantes.");
      return;
    }
    try {
      var html = _lpHtmlLista(alvo.nome || g.nome, g.lista, dados.presSet);
      var pdf = _lpPdf(html, "lista-presenca-" + _lpSlug(g.nome) + ".pdf");
      GmailApp.sendEmail(alvo.email, LP_ASSUNTO,
        "Segue em anexo a lista de presença da sua unidade no Congresso Municipal de Educação.",
        { htmlBody: _lpCorpoEmail(alvo.nome || g.nome), attachments: [pdf], name: REMETENTE });
      enviados++;
    } catch (e) {
      erros++;
      Logger.log("Erro ao enviar para " + g.nome + " (" + alvo.email + "): " + e.message);
    }
  });

  Logger.log("Concluído. Enviados: " + enviados + " | Sem e-mail cadastrado: " + semEmail.length + " | Erros: " + erros);
  if (semEmail.length) Logger.log("Unidades SEM e-mail na planilha (não enviadas):\n- " + semEmail.join("\n- "));
  return { enviados: enviados, semEmail: semEmail, erros: erros };
}
