/**
 * DanosWebApp.gs — publica as respostas da planilha como JSON para o painel danos.html
 *
 * COMO USAR (na planilha das RESPOSTAS do formulário):
 *   1. Extensões -> Apps Script
 *   2. Apague o conteúdo e cole este arquivo. Salve.
 *   3. Implantar -> Nova implantação -> tipo "App da Web"
 *        - Executar como: Eu (sua conta)
 *        - Quem pode acessar: Qualquer pessoa
 *   4. Autorize quando pedir. Copie a URL que termina em /exec.
 *   5. Mande essa URL para colocarmos em DADOS_URL no danos.html.
 *
 * SEGURANÇA: o JSON publicado NÃO inclui e-mail dos respondentes — só o
 * necessário para o painel (segmento, unidade, status e motivo). A planilha
 * permanece privada; apenas este resumo fica acessível pela URL.
 *
 * Ao adicionar novas respostas, o painel se atualiza sozinho (a cada hora,
 * ou ao recarregar a página). Não precisa republicar o script.
 */

function doGet(e) {
  var dados = coletar();
  var payload = JSON.stringify(dados);
  var cb = e && e.parameter && e.parameter.callback;
  if (cb) {
    // JSONP — evita bloqueio de CORS quando a página busca os dados
    return ContentService
      .createTextOutput(cb + "(" + payload + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

// Descobre a aba de respostas (nome contém "respost"); senão usa a 1ª.
function abaRespostas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shs = ss.getSheets();
  for (var i = 0; i < shs.length; i++) {
    if (shs[i].getName().toLowerCase().indexOf("respost") !== -1) return shs[i];
  }
  return shs[0];
}

function coletar() {
  var sh = abaRespostas();
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];

  var H = vals[0].map(function(h){ return String(h || "").toLowerCase(); });
  function idx(fn){ for (var i = 0; i < H.length; i++){ if (fn(H[i])) return i; } return -1; }

  var iSeg  = idx(function(h){ return h.indexOf("segmento") !== -1; });
  var iNome = idx(function(h){ return h.indexOf("unidade escolar") !== -1; });
  var iConv = idx(function(h){ return h.indexOf("conveniada") !== -1; });
  var iCEI  = idx(function(h){ return h.indexOf("- cei") !== -1; });
  var iEMEI = idx(function(h){ return h.indexOf("- emei") !== -1; });
  var iEMEF = idx(function(h){ return h.indexOf("- emef") !== -1; });
  var iSusp = idx(function(h){ return h.indexOf("suspen") !== -1 && h.indexOf("atendimento") !== -1; });
  var iMot  = idx(function(h){ return h.indexOf("motivos") !== -1; });
  var iImp  = idx(function(h){ return h.indexOf("impedem o funcionamento") !== -1 && h.indexOf("não") === -1 && h.indexOf("nao") === -1; });
  var iNimp = idx(function(h){ return h.indexOf("impedem o funcionamento") !== -1 && (h.indexOf("não") !== -1 || h.indexOf("nao") !== -1); });
  var iCar  = idx(function(h){ return h.indexOf("carimbo") !== -1; });

  function n(v){ return String(v == null ? "" : v).trim(); }
  function sn(v){ var s = n(v).toLowerCase(); return s.indexOf("sim") === 0 ? "Sim" : (s.indexOf("n") === 0 ? "Não" : n(v)); }
  function tipos(m){
    var t = [], ml = (m || "").toLowerCase();
    if (/energ|luz|el[eé]tric/.test(ml)) t.push("Energia");
    if (/sem [aá]gua|falta de [aá]gua|caixa d|abastec/.test(ml)) t.push("Água");
    if (/alag|inund|salas? com [aá]gua|p[aá]tio.*[aá]gua/.test(ml)) t.push("Alagamento");
    if (/[aá]rvore|galho/.test(ml)) t.push("Árvores");
    if (/destelh|telhad|forr[oó]|telha/.test(ml)) t.push("Telhado");
    if (/muro/.test(ml)) t.push("Muro");
    return t;
  }

  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r];
    if (iCar !== -1 && n(row[iCar]) === "") continue;   // linha sem carimbo = vazia
    var nome = n(iNome !== -1 ? row[iNome] : "") ||
               n(iConv !== -1 ? row[iConv] : "") ||
               n(iCEI  !== -1 ? row[iCEI]  : "") ||
               n(iEMEI !== -1 ? row[iEMEI] : "") ||
               n(iEMEF !== -1 ? row[iEMEF] : "");
    if (!nome) continue;

    var x = {
      seg:       n(iSeg  !== -1 ? row[iSeg]  : ""),
      nome:      nome,
      susp:      sn(iSusp !== -1 ? row[iSusp] : ""),
      motivo:    n(iMot  !== -1 ? row[iMot]  : ""),
      impede:    sn(iImp  !== -1 ? row[iImp]  : ""),
      naoimpede: sn(iNimp !== -1 ? row[iNimp] : "")
    };
    x.tipos = tipos(x.motivo);
    x.prio  = x.impede === "Sim" ? "critica"
            : (x.susp === "Sim" ? "alta"
            : (x.naoimpede === "Sim" ? "atencao" : "normal"));
    out.push(x);
  }
  return out;
}
