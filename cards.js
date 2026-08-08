/**
 * cards.js — Catálogo de ícones, renderização e carga dos cards da home.
 *
 * Usado por index.html (exibe) e gerenciar.html (edita/pré-visualiza), para que
 * os dois desenhem o card exatamente igual.
 *
 * Requer config.js antes (SUPA_URL / SUPA_KEY).
 */
(function () {
  "use strict";

  /* ---------- Catálogo de ícones ----------
     Traço, não preenchimento — combina com o estilo do site (stroke-width 2).
     Para acrescentar um ícone, some uma chave aqui: ela aparece sozinha no
     seletor do painel. */
  var ICONES = {
    documento:  { rotulo: "Documento",   d: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>' },
    escudo:     { rotulo: "Escudo",      d: '<path d="M12 22s8-4.5 8-11V5l-8-3-8 3v6c0 6.5 8 11 8 11z"/>' },
    estrela:    { rotulo: "Estrela",     d: '<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7-5.4-4.7 7.1-.6z"/>' },
    grafico:    { rotulo: "Gráfico",     d: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>' },
    pessoas:    { rotulo: "Pessoas",     d: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>' },
    calendario: { rotulo: "Calendário",  d: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>' },
    livro:      { rotulo: "Livro",       d: '<path d="M4 4h7a3 3 0 013 3v13a2.5 2.5 0 00-2.5-2.5H4zM20 4h-7a3 3 0 00-3 3v13a2.5 2.5 0 012.5-2.5H20z"/>' },
    lapis:      { rotulo: "Lápis",       d: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/>' },
    balao:      { rotulo: "Balão",       d: '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8z"/>' },
    alerta:     { rotulo: "Alerta",      d: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>' },
    check:      { rotulo: "Confirmado",  d: '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>' },
    coracao:    { rotulo: "Coração",     d: '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>' },
    escola:     { rotulo: "Escola",      d: '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>' },
    lampada:    { rotulo: "Ideia",       d: '<path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/>' },
    pasta:      { rotulo: "Pasta",       d: '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>' },
    link:       { rotulo: "Link",        d: '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>' },
    megafone:   { rotulo: "Megafone",    d: '<path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1zM16 8a5 5 0 010 8"/>' },
    relogio:    { rotulo: "Relógio",     d: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' }
  };

  var CORES = [
    { chave: "gold",   rotulo: "Dourado" },
    { chave: "blue",   rotulo: "Azul" },
    { chave: "green",  rotulo: "Verde" },
    { chave: "purple", rotulo: "Roxo" }
  ];

  var ESTADOS = {
    aberta:    { rotulo: "Aberta",              classe: "open" },
    resultado: { rotulo: "Resultado publicado", classe: "done" },
    encerrada: { rotulo: "Prazo encerrado",     classe: "" },
    breve:     { rotulo: "Em breve",            classe: "soon" },
    nenhum:    { rotulo: "",                    classe: "" }
  };

  var ESTADOS_LISTA = [
    { chave: "aberta",    rotulo: "Aberta" },
    { chave: "resultado", rotulo: "Resultado publicado" },
    { chave: "encerrada", rotulo: "Prazo encerrado" },
    { chave: "breve",     rotulo: "Em breve" },
    { chave: "nenhum",    rotulo: "Sem selo" }
  ];

  function svgIcone(chave) {
    var ic = ICONES[chave] || ICONES.documento;
    return '<svg viewBox="0 0 24 24">' + ic.d + "</svg>";
  }

  function fmtBR(iso) {
    if (!iso) return "";
    var p = String(iso).slice(0, 10).split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  /** Passou da data? Compara só a data local, sem hora. */
  function prazoVencido(iso) {
    if (!iso) return false;
    var p = String(iso).slice(0, 10).split("-");
    var fim = new Date(+p[0], +p[1] - 1, +p[2], 23, 59, 59);
    return new Date() > fim;
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /**
   * Monta o HTML de um card, replicando exatamente o que a index já fazia:
   * passado o prazo, o card deixa de linkar, o chip vira "Encerrou em …",
   * o chip de prazo some e o botão vira o status "Em análise".
   */
  function html(card) {
    var vencido  = prazoVencido(card.prazo);
    var encerrado = vencido || card.estado === "encerrada";
    var clicavel = !!card.href && !encerrado && card.estado !== "breve";

    var chips = "";
    if (card.publico) chips += '<span class="chip">' + esc(card.publico) + "</span>";

    if (card.estado === "breve") {
      chips += '<span class="chip soon"><span class="d"></span>Em breve</span>';
    } else if (card.estado === "resultado") {
      chips += '<span class="chip done"><span class="d"></span>Resultado publicado</span>';
    } else if (encerrado) {
      chips += '<span class="chip closed"><span class="d"></span>' +
               (card.prazo ? "Encerrou em " + fmtBR(card.prazo) : "Prazo encerrado") + "</span>";
    } else if (card.estado === "aberta") {
      chips += '<span class="chip open"><span class="d"></span>Aberta</span>';
    }

    // O chip de prazo só faz sentido enquanto a consulta está no ar.
    if (card.prazo && !encerrado) {
      chips += '<span class="chip prazo">' + svgIcone("calendario") +
               "Até <b>" + fmtBR(card.prazo) + "</b></span>";
    }

    var rodape = "";
    if (card.estado === "breve") {
      rodape = '<span class="c-status soon">' + svgIcone("relogio") +
               esc(card.cta || "Aguarde a abertura") + "</span>";
    } else if (encerrado && card.estado !== "resultado") {
      rodape = '<span class="c-status">' + svgIcone("relogio") + "Em análise</span>";
    } else if (clicavel) {
      rodape = '<span class="c-cta' + (card.destaque ? " destaque" : "") + '">' +
               esc(card.cta || "Acessar") +
               ' <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';
    }

    var corpo =
      '<span class="c-ico">' + svgIcone(card.icone) + "</span>" +
      '<div class="c-body">' +
        (card.categoria ? '<span class="c-tag">' + esc(card.categoria) + "</span>" : "") +
        "<h3>" + esc(card.titulo) + "</h3>" +
        (chips ? '<div class="c-chips">' + chips + "</div>" : "") +
      "</div>" + rodape;

    var classe = "consulta " + (card.cor || "blue") + (clicavel ? "" : " static");
    if (!clicavel) return '<div class="' + classe + '">' + corpo + "</div>";

    var alvo = card.nova_aba ? ' target="_blank" rel="noopener"' : "";
    return '<a class="' + classe + '" href="' + esc(card.href) + '"' + alvo + ">" + corpo + "</a>";
  }

  /** Busca os cards visíveis. Rejeita a promise se a API falhar. */
  function carregar() {
    return fetch(SUPA_URL + "/rpc/cards_publicos", {
      method: "POST",
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": "Bearer " + SUPA_KEY,
        "Content-Type": "application/json"
      },
      body: "{}"
    }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    }).then(function (linhas) {
      if (!Array.isArray(linhas)) throw new Error("resposta inesperada");
      return linhas;
    });
  }

  window.CARDS = {
    ICONES: ICONES,
    CORES: CORES,
    ESTADOS: ESTADOS,
    ESTADOS_LISTA: ESTADOS_LISTA,
    svgIcone: svgIcone,
    fmtBR: fmtBR,
    prazoVencido: prazoVencido,
    html: html,
    carregar: carregar
  };
})();
