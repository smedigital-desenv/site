/**
 * EnviarQR.gs — Envia por e-mail a CONFIRMAÇÃO DE INSCRIÇÃO + QR Code de acesso.
 * Arquivo separado do Code.gs para facilitar a manutenção. Reaproveita os
 * helpers GLOBAIS do Code.gs (supaFetch, esc) — ambos no mesmo projeto Apps Script.
 *
 * PRÉ-REQUISITOS
 *   1. Coluna booleana `qr_enviado` na tabela participantes:
 *        alter table participantes add column qr_enviado boolean not null default false;
 *   2. Colunas `local` e `endereco` na tabela de sessões (palestras):
 *        alter table palestras add column if not exists local text;
 *        alter table palestras add column if not exists endereco text;
 *      (ver db/adicionar-local-sessoes.sql)
 *   3. SUPABASE_SERVICE_KEY em Script Properties (a mesma usada pelo Code.gs).
 *   4. QR Codes já gerados (coluna qr_url preenchida) — menu Eventos.
 *
 * USO
 *   - Manual: menu Eventos → "Enviar QR Codes pendentes" (enviarQRCodesPendentes)
 *   - Auto:   menu Eventos → "Configurar envio de QR (1x/hora)" (configurarGatilhoQR)
 *   - Teste:  rodar enviarQRParaToken("EVT00001") no editor
 *
 * OBS: envia só para quem tem QR e ainda não recebeu (qr_enviado != true),
 * marcando qr_enviado=true após o envio — então rodar de novo não duplica.
 *
 * OBS 2: o horário é derivado do sufixo do palestra_id (_M/_T/_N). O período
 * está embutido no id da sessão (ex.: MOCHILA_M, QUEM_BRINCA_T, EJA_N).
 */

var QR_ASSUNTO   = "Confirmação de inscrição no Congresso";
var EVENTO_NOME  = "Educar para COMviver: Ribeirão 170 anos: memória, transformação e identidade";
var EVENTO_DATA  = "21/07/2026";

// Envia o QR de todos os participantes pendentes (com QR e ainda não enviados).
function enviarQRCodesPendentes() {
  try {
    var cfg = _qrConfigEmail();

    var lista = supaFetch(
      "participantes?or=(qr_enviado.is.null,qr_enviado.eq.false)&qr_url=not.is.null" +
      "&select=token,nome,email,qr_url,palestra_id,palestras(nome,local,endereco)",
      "GET", null
    );

    if (lista && lista.error) { Logger.log("Erro ao buscar pendentes: " + JSON.stringify(lista)); return; }
    if (!Array.isArray(lista) || lista.length === 0) { Logger.log("Nenhum QR pendente."); return; }

    Logger.log("Enviando " + lista.length + " QR Code(s)...");
    var enviados = 0, erros = 0, semQR = 0;

    lista.forEach(function(p) {
      try {
        if (!p.email) { erros++; return; }
        var fileId = _extrairFileId(p.qr_url);
        if (!fileId) { semQR++; return; }   // qr_url sem fid (QR ainda em preparo)

        _enviarQR(p, fileId, cfg);
        supaFetch("participantes?token=eq." + encodeURIComponent(p.token), "PATCH", { qr_enviado: true });
        enviados++;
        Logger.log("QR enviado: " + p.email);
      } catch (e) {
        erros++;
        Logger.log("Erro token " + p.token + ": " + e.message);
      }
    });

    Logger.log("Concluido. Enviados: " + enviados + " | Sem QR: " + semQR + " | Erros: " + erros);
  } catch (e) {
    Logger.log("Erro geral (QR): " + e.message);
  }
}

// Envia o QR de um token específico (teste/reenvio pontual).
function enviarQRParaToken(token) {
  var lista = supaFetch(
    "participantes?token=eq." + encodeURIComponent(token) +
    "&select=token,nome,email,qr_url,palestra_id,palestras(nome,local,endereco)&limit=1",
    "GET", null
  );
  if (!Array.isArray(lista) || lista.length === 0) { Logger.log("Token nao encontrado."); return; }

  var p = lista[0];
  if (!p.email) { Logger.log("Participante sem e-mail."); return; }
  var fileId = _extrairFileId(p.qr_url);
  if (!fileId) { Logger.log("Participante sem QR (qr_url sem fid)."); return; }

  _enviarQR(p, fileId, _qrConfigEmail());
  supaFetch("participantes?token=eq." + encodeURIComponent(p.token), "PATCH", { qr_enviado: true });
  Logger.log("QR enviado: " + p.email);
}

// Gatilho automático: envia QR pendentes a cada hora.
function configurarGatilhoQR() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "enviarQRCodesPendentes") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("enviarQRCodesPendentes").timeBased().everyHours(1).create();
  SpreadsheetApp.getUi().alert("Gatilho configurado!\n\nQR Codes pendentes serao enviados a cada hora.");
}

// ── INTERNOS ─────────────────────────────────────────────────
function _qrConfigEmail() {
  var c = supaFetch("email_config?id=eq.1&select=*&limit=1", "GET", null);
  c = (Array.isArray(c) && c.length) ? c[0] : {};
  return {
    nomeEvento: c.nome_evento  || EVENTO_NOME,
    cor:        c.cor_primaria || "#1f4e79"
  };
}

function _extrairFileId(qrUrl) {
  if (!qrUrl) return "";
  var m = String(qrUrl).match(/fid=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

// Horário da sessão a partir do sufixo do palestra_id (_M/_T/_N).
function _horarioDoPeriodo(palestraId) {
  var id = String(palestraId || "");
  if (/_M$/.test(id)) return "08:00 (manhã)";
  if (/_T$/.test(id)) return "14:00 (tarde)";
  if (/_N$/.test(id)) return "19:00 (noite)";
  return "";
}

function _enviarQR(p, fileId, cfg) {
  var nome     = p.nome || "Participante";
  var palestra = p.palestras ? (p.palestras.nome || "")     : "";
  var local    = p.palestras ? (p.palestras.local || "")    : "";
  var endereco = p.palestras ? (p.palestras.endereco || "") : "";
  var horario  = _horarioDoPeriodo(p.palestra_id);

  var arquivo    = DriveApp.getFileById(fileId);
  var blobInline = arquivo.getBlob().setName("qrcode.png");                  // cópia para exibição inline
  var blobAnexo  = arquivo.getBlob().setName("qrcode-" + p.token + ".png");  // cópia para download

  // Versões escapadas para injeção segura no HTML
  var nomeH     = esc(nome);
  var palestraH = esc(palestra);
  var horarioH  = esc(horario);
  var localH    = esc(local) + (endereco ? " – " + esc(endereco) : "");
  var eventoH   = esc(cfg.nomeEvento);
  var cor       = cfg.cor || "#1f4e79";

  var html =
    '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f4" style="background-color:#f4f4f4;">' +
    '<tr><td align="center" style="padding:24px 12px;">' +
      '<table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">' +
        '<tr><td bgcolor="' + cor + '" align="center" style="background-color:' + cor + ';padding:26px 24px;">' +
          '<h1 style="color:#ffffff;font-size:19px;line-height:1.35;margin:0;font-family:Arial,Helvetica,sans-serif;">Confirmação de inscrição no Congresso</h1>' +
        '</td></tr>' +
        '<tr><td style="padding:28px 34px;font-family:Arial,Helvetica,sans-serif;color:#333333;font-size:15px;line-height:1.7;">' +
          '<p style="margin:0 0 16px;">Prezado(a), <strong>' + nomeH + '</strong></p>' +
          '<p style="margin:0 0 16px;">Sua inscrição na palestra <strong>' + palestraH + '</strong> do Congresso da Secretaria Municipal de Educação: &ldquo;' + eventoH + '&rdquo; foi confirmada com sucesso!</p>' +
          '<p style="margin:0 0 16px;">Agradecemos sua inscrição e temos a satisfação de contar com sua presença neste importante momento de formação, troca de experiências e fortalecimento de conhecimentos.</p>' +
          '<p style="margin:0 0 10px;">Para agilizar o processo de credenciamento e garantir seu acesso ao evento, é indispensável apresentar o <strong>QR Code de confirmação</strong>, podendo ser:</p>' +
          '<ul style="margin:0 0 16px;padding-left:22px;">' +
            '<li style="margin:0 0 6px;">exibido na tela do celular (print ou arquivo digital); ou</li>' +
            '<li style="margin:0;">apresentado de forma impressa.</li>' +
          '</ul>' +
          '<p style="margin:0 0 22px;">Recomendamos que o QR Code esteja acessível no momento da entrada, evitando atrasos na validação de presença.</p>' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef3f8" style="background-color:#eef3f8;border:1px solid #d6e2ef;border-radius:8px;">' +
            '<tr><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f4e79;">' +
              '<p style="margin:0 0 6px;"><strong>Data:</strong> ' + esc(EVENTO_DATA) + '</p>' +
              '<p style="margin:0 0 6px;"><strong>Horário:</strong> ' + horarioH + '</p>' +
              '<p style="margin:0;"><strong>Local:</strong> ' + localH + '</p>' +
            '</td></tr>' +
          '</table>' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 0 4px;">' +
            '<img src="cid:qrcode" width="220" height="220" alt="QR Code" style="display:block;margin:0 auto;width:220px;height:220px;border:1px solid #e5e5e5;border-radius:12px;">' +
            '<p style="margin:12px 0 0;font-size:12px;color:#999999;font-family:monospace;">' + esc(p.token) + '</p>' +
          '</td></tr></table>' +
          '<p style="margin:22px 0 4px;">Estamos felizes em recebê-lo(a) e desejamos que sua participação seja enriquecedora e inspiradora.</p>' +
          '<p style="margin:18px 0 0;">Atenciosamente,</p>' +
          '<p style="margin:4px 0 0;"><strong>Equipe Organizadora do<br>Congresso Municipal de Educação / 2026.</strong></p>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr></table>' +
    '</body></html>';

  GmailApp.sendEmail(p.email, QR_ASSUNTO, "Sua inscrição foi confirmada. Apresente o QR Code (em anexo) na entrada do evento.", {
    htmlBody:     html,
    inlineImages: { qrcode: blobInline },
    attachments:  [blobAnexo],
    name:         "Congresso Municipal de Educação / 2026"
  });
}
