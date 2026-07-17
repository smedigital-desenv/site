/**
 * config.js — Configuração central (Supabase + Apps Script) e utilitários compartilhados.
 * IMPORTANTE: incluir com <script src="config.js"></script> ANTES de menu.js e dos
 * scripts de cada página, pois define as globais SUPA_URL / SUPA_KEY / APPS_URL.
 */

// A chave "anon" é pública por design. A segurança real depende das policies de RLS
// configuradas no Supabase — veja SECURITY.md.
// Projeto do gom; tabelas da presença no schema "presenca".
var SUPA_PROJECT_URL = "https://iqldovwttomkjkoakosc.supabase.co";
var SUPA_URL    = SUPA_PROJECT_URL + "/rest/v1";
var SUPA_SCHEMA = "presenca";
var SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxbGRvdnd0dG9ta2prb2Frb3NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDU4NzksImV4cCI6MjA5NjA4MTg3OX0.4dYeK5iIEgSD7CEWyLoaqXEXvuITVNVpTlfdmCyJCI0";
var APPS_URL = "https://script.google.com/macros/s/AKfycbwgn-kasXrfTWULBUe_7chco-O9TUFjFLVtXqkfyBs8WuGHKDLX8hhiENd2r-bly6-E0A/exec";

/**
 * Escapa uma string para inserção segura em HTML (previne XSS armazenado).
 * Use sempre que dados vindos do banco forem para dentro de innerHTML.
 */
function escapeHtml(v) {
  if (v == null) return "";
  return String(v).replace(/[&<>"']/g, function(c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/**
 * Busca TODAS as linhas de um endpoint PostgREST, paginando de pageSize em pageSize.
 * Evita o teto padrão de linhas por requisição (que trunca contagens silenciosamente).
 * Retorna sempre um array.
 */
function fetchAll(url, headers, pageSize) {
  pageSize = pageSize || 1000;
  var acc = [];
  function grab(offset) {
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    return fetch(url + sep + "limit=" + pageSize + "&offset=" + offset, { headers: headers })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!Array.isArray(data)) return acc;
        acc = acc.concat(data);
        return data.length < pageSize ? acc : grab(offset + pageSize);
      });
  }
  return grab(0);
}

/**
 * Período curto e normalizado (Manhã / Tarde / Noite) a partir do valor do banco.
 */
function periodoCurto(periodo) {
  if (!periodo) return "";
  var s = String(periodo).trim().toLowerCase();
  if (s.indexOf("manh") === 0) return "Manhã";
  if (s.indexOf("tard") === 0) return "Tarde";
  if (s.indexOf("noit") === 0 || s.indexOf("notur") === 0) return "Noite";
  return periodo;
}

/**
 * Rótulo da palestra com o PERÍODO (e horário, se houver), para distinguir
 * a mesma palestra que roda de manhã e de tarde. Ex.:
 *   "A Mochila do Educador... — Manhã (08:00)"
 * Aceita objetos com {nome, periodo, hora} (e cai para id/nome se faltar período).
 */
function palestraLabel(pal) {
  if (!pal) return "";
  var nome = pal.nome || pal.id || "";
  var per  = periodoCurto(pal.periodo);
  if (!per) return nome;
  return nome + " — " + per + (pal.hora ? " (" + pal.hora + ")" : "");
}
