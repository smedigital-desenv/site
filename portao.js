/**
 * portao.js — Portão de acesso das páginas restritas.
 *
 * Login Google + allowlist própria (resultados_consultas.acesso), checada pela
 * função public.tem_acesso_consulta(). Sessão isolada do sistema de presença
 * pelo storageKey "consulta-auth", e compartilhada entre as páginas restritas:
 * quem entrou em uma, entra nas outras sem novo login.
 *
 * Falha fechada: sem sessão, fora da lista ou erro na verificação, o conteúdo
 * não é montado e os dados sensíveis não chegam a ser requisitados.
 *
 * Requer supabase-js (CDN) e config.js antes.
 */
(function () {
  "use strict";

  var portao, carreg, caixa, msg, btnLogin, btnSair, cliente = null;

  function mostrarCaixa(html, comSair) {
    carreg.hidden = true;
    caixa.hidden = false;
    msg.innerHTML = html || "";
    btnSair.hidden = !comSair;
  }

  function sair() {
    if (!cliente) { location.reload(); return; }
    cliente.auth.signOut().catch(function () {}).then(function () { location.reload(); });
  }

  function identificar(email) {
    var alvo = document.querySelector(".gov-actions") || document.querySelector(".gov-top .wrap");
    if (!alvo) return;
    var cx = document.createElement("div");
    cx.className = "sessao-info";
    var q = document.createElement("span");
    q.textContent = email;
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = "Sair";
    b.addEventListener("click", sair);
    cx.appendChild(q); cx.appendChild(b);
    alvo.insertBefore(cx, alvo.firstChild);
  }

  window.PORTAO = {
    /**
     * @param {function(token): Promise} aoLiberar recebe o access_token e monta a página.
     */
    abrir: function (aoLiberar) {
      portao   = document.getElementById("portao");
      carreg   = document.getElementById("portaoCarregando");
      caixa    = document.getElementById("portaoCx");
      msg      = document.getElementById("portaoMsg");
      btnLogin = document.getElementById("portaoLogin");
      btnSair  = document.getElementById("portaoSair");
      document.body.style.overflow = "hidden";

      if (!window.supabase || !window.supabase.createClient) {
        mostrarCaixa('<div class="portao-erro"><b>Autenticação indisponível.</b>' +
          "Não foi possível carregar o serviço de login. Verifique a conexão e recarregue.</div>", false);
        btnLogin.hidden = true;
        return Promise.resolve();
      }

      cliente = window.supabase.createClient(SUPA_PROJECT_URL, SUPA_KEY, {
        auth: {
          persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
          flowType: "pkce", storage: window.localStorage, storageKey: "consulta-auth"
        }
      });

      btnLogin.addEventListener("click", function () {
        btnLogin.disabled = true;
        btnLogin.textContent = "Redirecionando…";
        cliente.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: location.origin + location.pathname,
            queryParams: { prompt: "select_account" }
          }
        }).catch(function () {
          btnLogin.disabled = false;
          btnLogin.textContent = "Entrar com conta Google";
          mostrarCaixa('<div class="portao-erro"><b>Não foi possível iniciar o login.</b>' +
            "Tente novamente em instantes.</div>", false);
        });
      });
      btnSair.addEventListener("click", sair);

      var verificar = window.verificarAcessoConsulta || function () {
        return cliente.auth.getSession().then(function (res) {
          var s = res && res.data ? res.data.session : null;
          if (!s || !s.user || !s.user.email) return { semSessao: true };
          var email = s.user.email.toLowerCase();
          return fetch(SUPA_URL + "/rpc/tem_acesso_consulta", {
            method: "POST",
            headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + s.access_token,
                       "Content-Type": "application/json" },
            body: "{}"
          })
            .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
            .then(function (lib) {
              return lib === true ? { ok: true, email: email, token: s.access_token }
                                  : { negado: true, email: email };
            });
        });
      };

      return verificar().then(function (r) {
        if (r.semSessao) { mostrarCaixa("", false); return; }
        if (r.negado) {
          mostrarCaixa('<div class="portao-erro"><b>Conta sem autorização.</b>O e-mail <b>' +
            r.email + "</b> não está na lista de acesso desta página.</div>", true);
          btnLogin.textContent = "Entrar com outra conta";
          return;
        }
        identificar(r.email);
        return Promise.resolve(aoLiberar(r.token)).then(function () {
          portao.hidden = true;
          document.body.style.overflow = "";
        });
      }).catch(function () {
        mostrarCaixa('<div class="portao-erro"><b>Não foi possível verificar o acesso.</b>' +
          "Recarregue a página. Se persistir, confirme se a função " +
          "<b>public.tem_acesso_consulta()</b> existe no banco.</div>", true);
      });
    }
  };
})();
