/**
 * consulta.js — Motor das páginas de resultado de consulta pública.
 *
 * Uma única implementação serve às duas telas de cada consulta:
 *   • divulga_<slug>.html — pública, só números agregados;
 *   • cons_<slug>.html    — restrita, com identificação e devolutivas na íntegra.
 *
 * A página fornece o esqueleto (as <section> com os ids esperados) e chama
 * CONSULTA.iniciar({ restrito: true|false }). Os dados vêm de dados-<slug>.js,
 * que define window.DADOS_CONSULTA.
 *
 * Requer config.js. No modo restrito, requer também supabase-js (CDN).
 */
(function () {
  "use strict";

  var D, REG, TEMAS, META, RESTRITO = false;
  /** Questões de texto: as abertas (classificadas por assunto e presentes no
   *  arquivo público) mais as restritas (que só chegam do banco após login —
   *  usadas quando o próprio conteúdo da resposta é dado pessoal). */
  var CAMPOS_TXT = [];
  var SCHEMA_RPC_NOMES = null;   // ex.: "respondentes_cal"

  /* ------------------------------------------------------------ utilidades */
  function el(t, cls, txt) {
    var e = document.createElement(t);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function fmtData(iso) {
    if (!iso) return "";
    var p = String(iso).slice(0, 10).split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }
  function pct(v, base) { return base ? Math.round(100 * v / base) : 0; }
  function soma(o) { var s = 0; for (var k in o) s += o[k]; return s; }
  function semAcento(s) {
    return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  /** Rótulos de opção costumam ser longos ("OPÇÃO 1 - CALENDÁRIO…"). Encurta para o gráfico. */
  function curto(s, max) {
    s = String(s || "").trim();
    max = max || 62;
    return s.length <= max ? s : s.slice(0, max - 1).replace(/[\s,;-]+$/, "") + "…";
  }

  /* --------------------------------------------------------------- barras  */
  function barras(alvo, itens, total, cor) {
    var box = typeof alvo === "string" ? document.getElementById(alvo) : alvo;
    box.innerHTML = "";
    itens.forEach(function (it) {
      var p = pct(it.val, it.base || total);
      var linha = el(it.filtro ? "button" : "div", "bar-row" + (it.filtro ? " clic" : ""));
      if (it.filtro) {
        linha.type = "button";
        linha.title = "Ver quem respondeu";
        linha.addEventListener("click", function () {
          abrirModal(it.modalTitulo || it.lab, it.filtro, it.modalSub);
        });
      }
      var lab = el("div", "bar-lab", it.lab);
      if (it.titulo) lab.title = it.titulo;
      linha.appendChild(lab);
      linha.appendChild(el("div", "bar-val", it.txt || (it.val + " · " + p + "%")));
      var tr = el("div", "bar-track"), fl = el("div", "bar-fill " + (it.cor || cor || ""));
      fl.style.width = p + "%";
      tr.appendChild(fl);
      linha.appendChild(tr);
      box.appendChild(linha);
    });
  }

  function cartao(titulo, cap) {
    var c = el("div", "card chart");
    c.appendChild(el("h3", null, titulo));
    if (cap) c.appendChild(el("div", "cap", cap));
    var b = el("div", "bars");
    c.appendChild(b);
    return { card: c, bars: b };
  }

  /* ---------------------------------------------------------------- KPIs   */
  function montarKpis() {
    var cx = document.getElementById("kpis");
    if (!cx) return;
    var comProposta = D.stats.geral.base;
    var lista = [
      { n: META.total, l: META.rotulo_total || "contribuições recebidas",
        h: "envios individuais do formulário" }
    ];
    if (META.unidades) {
      lista.push({ n: META.unidades, l: "unidades escolares",
                   h: META.hint_unidades || "com ao menos uma contribuição" });
    }
    if (META.abertas.length) {
      lista.push({ n: comProposta, l: "com proposta concreta",
                   h: pct(comProposta, META.total) + "% do total de envios" });
    }
    (META.kpis_extra || []).forEach(function (k) { lista.push(k); });
    // 4º indicador: a alternativa mais votada do destaque principal, se houver
    var dq = (D.destaques || [])[0];
    if (dq && D.perfil[dq.campo]) {
      var ent = Object.keys(D.perfil[dq.campo]).map(function (k) { return [k, D.perfil[dq.campo][k]]; });
      ent.sort(function (a, b) { return b[1] - a[1]; });
      if (ent.length) {
        lista.push({ n: pct(ent[0][1], soma(D.perfil[dq.campo])) + "%", gold: true,
                     l: curto(ent[0][0], 34), h: ent[0][1] + " de " + soma(D.perfil[dq.campo]) + " respostas" });
      }
    }
    lista.forEach(function (k) {
      var c = el("div", "kpi" + (k.gold ? " gold" : ""));
      c.appendChild(el("div", "n", k.n));
      c.appendChild(el("div", "l", k.l));
      c.appendChild(el("div", "h", k.h));
      cx.appendChild(c);
    });
  }

  /* -------------------------------------------------------------- síntese - */
  /**
   * Leitura rápida antes dos gráficos, para consultas com muitas questões.
   * Cada item é um par [chamada em negrito, texto]. Sem `resumo`, a seção
   * inteira some — as consultas antigas seguem como estavam.
   */
  function montarResumo() {
    var sec = document.getElementById("secResumo");
    var cx = document.getElementById("resumo");
    var itens = META.resumo || [];
    if (!cx || !itens.length) { if (sec) sec.hidden = true; return; }
    if (sec) sec.hidden = false;
    var ul = el("ul");
    itens.forEach(function (par) {
      var li = el("li");
      li.appendChild(el("strong", null, par[0] + " "));
      li.appendChild(document.createTextNode(par[1]));
      ul.appendChild(li);
    });
    cx.appendChild(ul);
  }

  /* ------------------------------------------------- destaque e perfil ---- */
  var CORES = ["navy", "purple", "green", "gold", "mut"];

  function montarDestaque() {
    var cx = document.getElementById("destaque");
    if (!cx || !(D.destaques || []).length) return;
    D.destaques.forEach(function (dq) {
      var dados = D.perfil[dq.campo] || {};
      var base = soma(dados);
      var c = cartao(dq.titulo, dq.cap + " · base: " + base + " respostas");
      cx.appendChild(c.card);
      barras(c.bars, Object.keys(dados).map(function (k, i) {
        return {
          lab: curto(k, 70), titulo: k, val: dados[k], base: base,
          cor: i === 0 ? "green" : (i === 1 ? "navy" : CORES[i % CORES.length]),
          modalTitulo: curto(k, 60), modalSub: dq.titulo,
          filtro: RESTRITO ? function (r) { return r[dq.campo] === k; } : null
        };
      }), base);
    });
  }

  /**
   * Questão de ordenação (ex.: "classifique as modalidades de 1º a 4º lugar").
   * Cada item é uma coluna do formulário; o gráfico mostra quantos a puseram em
   * primeiro lugar, e a legenda traz a posição média.
   */
  function montarRanking() {
    var cx = document.getElementById("destaque");
    if (!cx || !(D.ranking || []).length) return;
    D.ranking.forEach(function (bl) {
      var c = cartao(bl.titulo, bl.cap);
      cx.appendChild(c.card);
      barras(c.bars, bl.itens.map(function (it, i) {
        var temMedia = typeof it.media === "number";
        return {
          lab: it.lab,
          titulo: temMedia ? "Posição média: " + it.media.toFixed(2).replace(".", ",") : it.lab,
          val: it.val, base: it.base,
          txt: it.val + " · " + pct(it.val, it.base) + "%" +
               (temMedia ? " · média " + it.media.toFixed(1).replace(".", ",") : ""),
          cor: i === 0 ? "green" : (i === 1 ? "navy" : CORES[i % CORES.length]),
          modalTitulo: it.lab + (bl.sufixo || ""), modalSub: bl.titulo,
          filtro: RESTRITO ? function (r) { return r[it.campo] === bl.topo; } : null
        };
      }), bl.itens.length ? bl.itens[0].base : 0);
    });
  }

  /**
   * Questões fechadas de avaliação (o que a rede acha), separadas do perfil
   * (quem a rede é). Só aparece se a consulta declarar `aval_rotulos`.
   */
  function montarAval() {
    var sec = document.getElementById("secAvaliacoes");
    var cx = document.getElementById("avaliacoes");
    var rot = META.aval_rotulos || {};
    var chaves = Object.keys(rot);
    if (!cx || !chaves.length) { if (sec) sec.hidden = true; return; }
    if (sec) sec.hidden = false;
    var destacados = (D.destaques || []).map(function (d) { return d.campo; });
    chaves.forEach(function (campo, idx) {
      if (destacados.indexOf(campo) >= 0) return;           // já saiu no destaque
      var dados = D.perfil[campo] || {};
      var base = soma(dados);
      if (!base) return;
      var c = cartao(rot[campo], "Base: " + base + (base === 1 ? " resposta" : " respostas"));
      cx.appendChild(c.card);
      barras(c.bars, Object.keys(dados).map(function (k) {
        return {
          lab: curto(k, 52), titulo: k, val: dados[k], base: base,
          modalTitulo: curto(k, 60), modalSub: rot[campo],
          filtro: RESTRITO ? function (r) { return r[campo] === k; } : null
        };
      }), base, CORES[idx % 3]);
    });
  }

  function montarPerfil() {
    var cx = document.getElementById("perfil");
    if (!cx) return;
    var destacados = (D.destaques || []).map(function (d) { return d.campo; });
    Object.keys(META.perfil_rotulos).forEach(function (campo, idx) {
      if (destacados.indexOf(campo) >= 0) return;           // já saiu no destaque
      var dados = D.perfil[campo] || {};
      var base = soma(dados);
      var c = cartao(META.perfil_rotulos[campo], "Base: " + base + " respostas");
      cx.appendChild(c.card);
      barras(c.bars, Object.keys(dados).map(function (k) {
        return {
          lab: curto(k, 52), titulo: k, val: dados[k], base: base,
          modalTitulo: curto(k, 60), modalSub: META.perfil_rotulos[campo],
          filtro: RESTRITO ? function (r) { return r[campo] === k; } : null
        };
      }), base, CORES[idx % 3]);
    });
  }

  /* ------------------------------------------------------------- volume --- */
  /** Esconde a <section> que envolve um elemento (consultas sem questões abertas). */
  function esconderBloco(elem) {
    var s = elem;
    while (s && s.className !== "bloco" && s.id !== "temas") s = s.parentNode;
    if (s && s.style) s.hidden = true;
  }

  function montarVolume() {
    var cx = document.getElementById("volume");
    if (!cx) return;
    if (!META.abertas.length) { esconderBloco(cx); return; }
    var itens = [];
    META.abertas.forEach(function (a, i) {
      itens.push({ lab: a.rotulo + " — preenchidas", val: META.preenchidas[a.chave],
                   base: META.total, cor: "mut",
                   modalTitulo: a.rotulo + " — preenchidas", modalSub: "Responderam algo",
                   filtro: RESTRITO ? function (r) { return !!r[a.chave]; } : null });
      itens.push({ lab: a.rotulo + " — com proposta concreta", val: D.stats[a.chave].base,
                   base: META.total, cor: CORES[i % 3],
                   modalTitulo: a.rotulo + " — com proposta", modalSub: "Trouxeram sugestão, crítica ou justificativa",
                   filtro: RESTRITO ? function (r) { return r["t_" + a.chave].length > 0; } : null });
    });
    var c = cartao("Respostas preenchidas × respostas com proposta concreta",
      "Foram contadas como respostas com proposta as que trazem alguma sugestão, crítica ou " +
      "justificativa. Ficaram de fora variações de “não tenho sugestão”, “nenhuma”, “ok” e campos " +
      "preenchidos apenas com pontuação.");
    cx.appendChild(c.card);
    barras(c.bars, itens, META.total);
  }

  /* -------------------------------------------------------------- temas --- */
  var escopoAtual = "geral";

  function montarTemas() {
    var cxTabs = document.getElementById("tabsTema");
    if (!cxTabs) return;
    if (!META.abertas.length) { esconderBloco(cxTabs); return; }
    var escopos = [{ chave: "geral", rotulo: "Visão geral" }].concat(
      META.abertas.map(function (a) { return { chave: a.chave, rotulo: a.rotulo }; }));
    if (META.abertas.length < 2) escopos = [escopos[0]];      // uma questão só: aba única é ruído
    escopos.forEach(function (e, i) {
      var b = el("button", "tab", e.rotulo);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", i === 0 ? "true" : "false");
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(cxTabs.children, function (o) { o.setAttribute("aria-selected", "false"); });
        b.setAttribute("aria-selected", "true");
        escopoAtual = e.chave;
        renderTemas();
      });
      cxTabs.appendChild(b);
    });
    if (escopos.length < 2) cxTabs.hidden = true;
    renderTemas();
  }

  function renderTemas() {
    var s = D.stats[escopoAtual], box = document.getElementById("listaTemas");
    if (!s || !box) return;
    var chaves = Object.keys(s.temas);
    var max = chaves.length ? Math.max.apply(null, chaves.map(function (k) { return s.temas[k]; })) : 1;
    box.innerHTML = "";
    chaves.forEach(function (k) {
      var v = s.temas[k];
      var linha = el(RESTRITO ? "button" : "div", "tema-row");
      if (RESTRITO) {
        linha.type = "button";
        linha.title = "Ver devolutivas sobre: " + TEMAS[k];
        linha.addEventListener("click", function () { filtrarPorTema(k); });
      }
      linha.appendChild(el("div", "lab", TEMAS[k]));
      var val = el("div", "val", v + " ");
      val.appendChild(el("small", null, "· " + pct(v, s.base) + "%"));
      linha.appendChild(val);
      var tr = el("div", "track"), fl = el("div", "fill");
      fl.style.width = (100 * v / max) + "%";
      tr.appendChild(fl);
      linha.appendChild(tr);
      box.appendChild(linha);
    });
    var hint = document.getElementById("temaHint");
    if (hint) {
      hint.textContent = escopoAtual === "geral"
        ? "Cada respondente é contado uma vez por assunto, mesmo que o mencione em mais de uma questão. Base: " +
          s.base + " respondentes com ao menos uma resposta com proposta."
        : "Base: " + s.base + " respostas com proposta.";
    }
  }

  /* --------------------------------------------------- nota metodológica -- */
  function montarNota() {
    var cx = document.getElementById("nota");
    if (!cx) return;
    var temAbertas = META.abertas.length > 0;
    var bases = META.abertas.map(function (a) {
      return a.rotulo + ": " + D.stats[a.chave].base;
    }).join("; ");
    var itens = [
      "<strong>Origem.</strong> Respostas do formulário da consulta, coletadas entre " +
        fmtData(META.inicio) + " e " + fmtData(META.fim) + ". Cada linha corresponde a um envio.",
      "<strong>Privacidade.</strong> " + (RESTRITO
        ? "Esta página exibe a identificação dos respondentes e é restrita a e-mails autorizados. O texto das respostas é reproduzido integralmente, sem correção de grafia."
        : (META.restritas || []).length
          ? "Esta página apresenta apenas dados agregados. O conteúdo das respostas — que aqui é composto de nomes de pessoas — não é publicado, nem consta do arquivo de dados desta página."
          : "Esta página apresenta apenas dados agregados. Nome e unidade dos respondentes não são publicados."),
      temAbertas ? "<strong>Respostas com proposta.</strong> Cada resposta aberta foi marcada como propositiva ou não. " +
        "Variações de “não tenho sugestão”, “nenhuma”, “ok” e campos com apenas pontuação foram excluídas das bases percentuais dos assuntos." : "",
      temAbertas ? "<strong>Classificação por assunto.</strong> Feita por reconhecimento de expressões-chave no texto de cada resposta. " +
        "Uma mesma contribuição pode tratar de vários assuntos — por isso os percentuais somam mais de 100%." : "",
      temAbertas ? "<strong>Bases de cálculo.</strong> " + bases + "; visão geral: " + D.stats.geral.base + " respondentes." : "",
      (Object.keys(META.aval_rotulos || {}).length
        ? "<strong>Bases variáveis.</strong> Parte das questões objetivas só foi exibida a determinados cargos ou segmentos, " +
          "e outras eram de preenchimento opcional. Por isso cada gráfico informa a própria base, que nem sempre é o total de envios."
        : ""),
      "<strong>Limites.</strong> A consulta é de adesão voluntária e não constitui amostra estatística da rede. " +
        "O volume por cargo reflete quem se dispôs a responder."
    ];
    var ul = el("ul");
    itens.filter(Boolean).forEach(function (t) { var li = el("li"); li.innerHTML = t; ul.appendChild(li); });
    cx.appendChild(ul);
  }

  /* ------------------------------------------------- modal de respondentes */
  var listaModal = [], focoAnterior = null;

  function abrirModal(titulo, filtro, sub) {
    var modal = document.getElementById("modal");
    if (!modal) return;
    listaModal = REG.filter(filtro).sort(function (a, b) {
      return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
    });
    document.getElementById("modalTitulo").textContent = titulo;
    var rot = META.rotulo_envios || ["contribuição", "contribuições"];
    document.getElementById("modalSub").textContent =
      (sub ? sub + " · " : "") + listaModal.length +
      " " + (listaModal.length === 1 ? rot[0] : rot[1]);
    document.getElementById("modalBusca").value = "";
    renderModal();
    focoAnterior = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    document.getElementById("modalBusca").focus();
  }
  function fecharModal() {
    var modal = document.getElementById("modal");
    modal.hidden = true;
    document.body.style.overflow = "";
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
  }
  function renderModal() {
    var q = semAcento(document.getElementById("modalBusca").value.trim());
    var corpo = document.getElementById("modalCorpo");
    corpo.innerHTML = "";
    var vis = listaModal.filter(function (r) {
      return !q || semAcento((r.nome || "") + " " + (r.unidade || "")).indexOf(q) >= 0;
    });
    if (!vis.length) {
      corpo.appendChild(el("div", "modal-vazio", "Nenhum respondente encontrado."));
      return;
    }
    vis.forEach(function (r) {
      var b = el("button", "pessoa");
      b.type = "button";
      b.title = "Abrir a " + nomeItem(1) + " #" + r.id;
      b.appendChild(el("span", "pid", "#" + r.id));
      b.appendChild(el("span", "pnome", r.nome || "(nome não informado)"));
      b.appendChild(el("span", "puni", r.unidade || "(unidade não informada)"));
      b.addEventListener("click", function () { verDevolutiva(r.id); });
      corpo.appendChild(b);
    });
  }

  /* ---------------------------------------------------------- devolutivas */
  var POR_PAGINA = 20, pagina = 1, filtrados = [], idFiltro = null;
  var busca, selTema, selQ, selPerfil = {};
  /** Quem não escreveu nada em nenhuma questão aberta não entra na listagem
   *  (só aparece se for aberto individualmente pelo modal). */
  var COM_TEXTO = [];
  /** Como chamar cada linha da listagem: ["devolutiva", "devolutivas"]. */
  function nomeItem(n) {
    var r = META.rotulo_devs || ["devolutiva", "devolutivas"];
    return n === 1 ? r[0] : r[1];
  }

  function montarDevolutivas() {
    var cx = document.getElementById("filtros");
    if (!cx) return;
    busca = document.getElementById("fBusca");

    // um <select> por campo de perfil + assunto + questão
    Object.keys(META.perfil_rotulos).forEach(function (campo) {
      var c = el("div", "campo");
      var lab = el("label", null, META.perfil_rotulos[campo]);
      lab.htmlFor = "f_" + campo;
      var s = document.createElement("select");
      s.id = "f_" + campo;
      s.appendChild(new Option("Todos", ""));
      Object.keys(D.perfil[campo] || {}).forEach(function (k) {
        s.appendChild(new Option(curto(k, 44) + " (" + D.perfil[campo][k] + ")", k));
      });
      s.addEventListener("change", function () { idFiltro = null; aplicar(); });
      selPerfil[campo] = s;
      c.appendChild(lab); c.appendChild(s);
      cx.insertBefore(c, cx.lastElementChild);
    });

    selTema = document.getElementById("fTema");
    Object.keys(D.stats.geral.temas).forEach(function (k) { selTema.appendChild(new Option(TEMAS[k], k)); });

    if (!Object.keys(D.stats.geral.temas).length) selTema.parentNode.hidden = true;

    selQ = document.getElementById("fQuestao");
    CAMPOS_TXT.forEach(function (a) { selQ.appendChild(new Option(a.rotulo, a.chave)); });
    if (CAMPOS_TXT.length < 2) selQ.parentNode.hidden = true;

    REG.forEach(function (r) {
      r._busca = semAcento(CAMPOS_TXT.map(function (a) { return r[a.chave]; }).join(" "));
    });
    COM_TEXTO = REG.filter(function (r) {
      return CAMPOS_TXT.some(function (a) { return !!r[a.chave]; });
    });

    var timer;
    busca.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { idFiltro = null; aplicar(); }, 200);
    });
    [selTema, selQ].forEach(function (s) {
      s.addEventListener("change", function () { idFiltro = null; aplicar(); });
    });
    document.getElementById("btnLimpar").addEventListener("click", function () {
      idFiltro = null;
      busca.value = ""; selTema.value = ""; selQ.value = "";
      Object.keys(selPerfil).forEach(function (k) { selPerfil[k].value = ""; });
      aplicar();
    });

    var rod = document.querySelector(".modal-rod");
    if (rod) rod.textContent = "Clique em um nome para abrir a " + nomeItem(1) + " correspondente.";

    document.getElementById("modalBusca").addEventListener("input", renderModal);
    document.getElementById("modalX").addEventListener("click", fecharModal);
    document.getElementById("modal").addEventListener("click", function (e) {
      if (e.target === document.getElementById("modal")) fecharModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !document.getElementById("modal").hidden) fecharModal();
    });
    aplicar();
  }

  function filtrarPorTema(k) {
    idFiltro = null;
    selTema.value = k;
    selQ.value = escopoAtual === "geral" ? "" : escopoAtual;
    aplicar();
    document.getElementById("devolutivas").scrollIntoView({ behavior: "smooth" });
  }

  function verDevolutiva(id) {
    fecharModal();
    idFiltro = id;
    busca.value = ""; selTema.value = ""; selQ.value = "";
    Object.keys(selPerfil).forEach(function (k) { selPerfil[k].value = ""; });
    aplicar();
    document.getElementById("devolutivas").scrollIntoView({ behavior: "smooth" });
  }

  function filtrar() {
    if (idFiltro) return REG.filter(function (r) { return r.id === idFiltro; });
    var q = semAcento(busca.value.trim()), tm = selTema.value, qs = selQ.value;
    return COM_TEXTO.filter(function (r) {
      var ok = true;
      Object.keys(selPerfil).forEach(function (campo) {
        if (selPerfil[campo].value && r[campo] !== selPerfil[campo].value) ok = false;
      });
      if (!ok) return false;
      if (q && r._busca.indexOf(q) < 0) return false;
      if (qs && !r[qs]) return false;
      if (tm) {
        if (qs) return (r["t_" + qs] || []).indexOf(tm) >= 0;
        return META.abertas.some(function (a) { return r["t_" + a.chave].indexOf(tm) >= 0; });
      }
      return true;
    });
  }

  function marcar(texto, termo) {
    var frag = document.createDocumentFragment();
    if (!termo) { frag.appendChild(document.createTextNode(texto)); return frag; }
    var alvo = semAcento(texto), i = 0, p;
    while ((p = alvo.indexOf(termo, i)) >= 0) {
      frag.appendChild(document.createTextNode(texto.slice(i, p)));
      frag.appendChild(el("mark", null, texto.slice(p, p + termo.length)));
      i = p + termo.length;
    }
    frag.appendChild(document.createTextNode(texto.slice(i)));
    return frag;
  }

  function render() {
    var box = document.getElementById("listaDevs"), pg = document.getElementById("paginacao");
    box.innerHTML = ""; pg.innerHTML = "";
    var termo = semAcento(busca.value.trim()), qs = selQ.value;
    var total = filtrados.length;
    var maxPag = Math.max(1, Math.ceil(total / POR_PAGINA));
    if (pagina > maxPag) pagina = maxPag;

    document.getElementById("resInfo").textContent = idFiltro
      ? "Exibindo apenas a " + nomeItem(1) + " #" + idFiltro + " — use “Limpar filtros” para ver todas."
      : (total === 0 ? "Nenhuma " + nomeItem(1) + " encontrada com os filtros atuais."
         : total + " " + nomeItem(total) + (total === 1 ? " encontrada" : " encontradas") +
           " · exibindo " + ((pagina - 1) * POR_PAGINA + 1) + "–" + Math.min(pagina * POR_PAGINA, total) +
           (total === COM_TEXTO.length && COM_TEXTO.length < META.total
             ? " · os outros " + (META.total - COM_TEXTO.length) + " envios " +
               (META.rotulo_vazio || "não preencheram nenhum campo aberto") : ""));

    if (!total) {
      box.appendChild(el("div", "card vazio", "Tente remover um filtro ou usar outro termo de busca."));
      return;
    }

    filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).forEach(function (r) {
      var c = el("article", "card dev");
      var h = el("div", "dev-h");
      h.appendChild(el("span", "tagi n", "#" + r.id));
      if (r.nome) h.appendChild(el("span", "tagi nome", r.nome));
      if (r.unidade) h.appendChild(el("span", "tagi uni", r.unidade));
      Object.keys(META.perfil_rotulos).forEach(function (campo) {
        if (r[campo]) h.appendChild(el("span", "tagi", curto(r[campo], 46)));
      });
      c.appendChild(h);

      CAMPOS_TXT.forEach(function (a, i) {
        if (!r[a.chave] || (qs && qs !== a.chave)) return;
        var q = el("div", "dev-q " + (i === 1 ? "atr" : i === 2 ? "proj" : ""));
        q.appendChild(el("div", "qh", a.rotulo));
        var p = el("p");
        p.appendChild(marcar(r[a.chave], termo));
        q.appendChild(p);
        c.appendChild(q);
      });

      var ts = {};
      META.abertas.forEach(function (a) { (r["t_" + a.chave] || []).forEach(function (t) { ts[t] = 1; }); });
      var chaves = Object.keys(ts);
      if (chaves.length) {
        var dt = el("div", "dev-temas");
        chaves.forEach(function (t) { dt.appendChild(el("span", null, TEMAS[t])); });
        c.appendChild(dt);
      }
      box.appendChild(c);
    });

    if (maxPag > 1) {
      var ant = el("button", "btn", "‹ Anterior");
      ant.type = "button"; ant.disabled = pagina === 1;
      ant.addEventListener("click", function () { pagina--; render(); document.getElementById("devolutivas").scrollIntoView(); });
      var prox = el("button", "btn", "Próxima ›");
      prox.type = "button"; prox.disabled = pagina === maxPag;
      prox.addEventListener("click", function () { pagina++; render(); document.getElementById("devolutivas").scrollIntoView(); });
      pg.appendChild(ant);
      pg.appendChild(el("span", null, "Página " + pagina + " de " + maxPag));
      pg.appendChild(prox);
    }
  }

  function aplicar() { filtrados = filtrar(); pagina = 1; render(); }

  /* ------------------------------------------------------------ montagem  */
  function montarTudo() {
    document.getElementById("pTotal").textContent = META.total;
    document.getElementById("pPeriodo").textContent = fmtData(META.inicio) + " – " + fmtData(META.fim);
    var h1 = document.getElementById("pTitulo");
    if (h1) h1.textContent = META.titulo;
    var sub = document.getElementById("pSub");
    if (sub) sub.textContent = META.subtitulo;
    montarKpis(); montarResumo(); montarDestaque(); montarRanking(); montarPerfil();
    montarAval(); montarVolume(); montarTemas(); montarNota();
    if (RESTRITO) montarDevolutivas();
  }

  /* --------------------------------------------------------------- API    */
  window.CONSULTA = {
    /**
     * @param {object} op
     *   restrito {boolean}  exige login e exibe identificação/devolutivas
     *   rpcNomes {string}   nome da função que devolve nome+unidade (modo restrito)
     */
    iniciar: function (op) {
      op = op || {};
      RESTRITO = !!op.restrito;
      SCHEMA_RPC_NOMES = op.rpcNomes || null;
      D = window.DADOS_CONSULTA;
      META = D.meta; TEMAS = D.temas; REG = D.registros;
      CAMPOS_TXT = META.abertas.concat(RESTRITO ? (META.restritas || []) : []);
      if (!RESTRITO) { montarTudo(); return Promise.resolve(); }
      return window.PORTAO.abrir(function (token) {
        return carregarNomes(token).then(function (ok) {
          montarTudo();
          if (!ok) avisarSemNomes();
        });
      });
    },
    fmtData: fmtData
  };

  /** Nome e unidade não estão no arquivo estático: vêm do banco, já autenticado. */
  function carregarNomes(token) {
    if (!SCHEMA_RPC_NOMES) return Promise.resolve(false);
    return fetch(SUPA_URL + "/rpc/" + SCHEMA_RPC_NOMES, {
      method: "POST",
      headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: "{}"
    })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (linhas) {
        if (!Array.isArray(linhas) || !linhas.length) return false;
        var porId = {};
        linhas.forEach(function (l) { porId[l.id] = l; });
        // além de nome e unidade, a função pode devolver colunas de texto que
        // não podem estar no arquivo público (ver META.restritas).
        REG.forEach(function (r) {
          var n = porId[r.id];
          if (!n) return;
          Object.keys(n).forEach(function (k) { if (k !== "id") r[k] = n[k] || ""; });
        });
        return true;
      })
      .catch(function () { return false; });
  }

  function avisarSemNomes() {
    var alvo = document.getElementById("resInfo");
    if (!alvo) return;
    var av = el("p", "aviso-nomes",
      "Não foi possível carregar a identificação dos respondentes. " +
      "Os nomes e as unidades não serão exibidos nesta sessão.");
    alvo.parentNode.insertBefore(av, alvo);
  }
})();
