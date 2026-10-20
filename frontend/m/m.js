/* PHAROS OCEAN · 手机端（严格对照设计稿；与 PC 共用后端与账号，数据互通） */
"use strict";

(function () {
  var TOKEN_KEY = "pharos_token";
  var LAST_USER = "pharos_last_user";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ── SVG 线性图标 ── */
  function svg(path, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"' + (extra || "") + ">" + path + "</svg>";
  }
  var IC = {
    home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>'),
    spark: svg('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z"/>'),
    grid: svg('<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 9h17"/><path d="M8 4V2.5M16 4V2.5"/><path d="M7.5 13h4M7.5 16.5h7"/>'),
    link: svg('<path d="M9.5 14.5 14.5 9.5"/><path d="M11 6.5 12.6 5a4 4 0 0 1 5.7 5.7L16.7 12"/><path d="M13 17.5 11.4 19a4 4 0 0 1-5.7-5.7L7.3 12"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4.5 21c1.4-3.6 4.2-5.5 7.5-5.5s6.1 1.9 7.5 5.5"/>'),
    bell: svg('<path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    box: svg('<path d="M21 8.5 12 3.5 3 8.5v7l9 5 9-5v-7z"/><path d="m3 8.5 9 5 9-5"/><path d="M12 13.5V21"/>'),
    globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 4 5.8 4 9s-1.5 6.4-4 9c-2.5-2.6-4-5.8-4-9s1.5-6.4 4-9z"/>'),
    doc: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>'),
    cart: svg('<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>'),
    shield: svg('<path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6l-7-3z"/><path d="m9 12 2 2 4-4"/>'),
    coin: svg('<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>'),
    alert: svg('<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 9v5"/><circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none"/>'),
    arrow: svg('<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>'),
    chev: svg('<path d="m9 5 7 7-7 7"/>'),
    back: svg('<path d="m15 5-7 7 7 7"/>'),
    check: svg('<path d="m4 12.5 5 5L20 6.5"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    cloud: svg('<path d="M17.5 19a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.2 11.4 3.8 3.8 0 0 0 6.5 19h11z"/><path d="M12 12v6"/><path d="m9.5 15.5 2.5 2.5 2.5-2.5"/>'),
    monitor: svg('<rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8 20h8M12 16.5V20"/>'),
    help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.3"/><circle cx="12" cy="17.3" r=".9" fill="currentColor" stroke="none"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".9" fill="currentColor" stroke="none"/>'),
    target: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>'),
    logout: svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h10"/>'),
    headphone: '<svg viewBox="0 0 64 64" fill="none"><defs><linearGradient id="hp1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7b8fa3"/><stop offset="100%" stop-color="#3f5568"/></linearGradient></defs><path d="M14 36v-4a18 18 0 0 1 36 0v4" stroke="url(#hp1)" stroke-width="5" stroke-linecap="round"/><rect x="9" y="33" width="12" height="19" rx="6" fill="#22364a"/><rect x="43" y="33" width="12" height="19" rx="6" fill="#22364a"/><rect x="12" y="36" width="6" height="13" rx="3" fill="#5d7183"/><rect x="46" y="36" width="6" height="13" rx="3" fill="#5d7183"/></svg>',
    map: svg('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>'),
  };

  var S = {
    token: localStorage.getItem(TOKEN_KEY) || "",
    user: null,
    agents: [],
    plan: null,
    platforms: [],
    team: null,
    page: "home",
    agentCat: "all",
    platFilter: "all",
    projTab: "overview",
    mkTab: "g",
    pdTab: "p",
    chatConv: null,
    chatAgent: null,
    sending: false,
    aiText: {},
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function toast(msg, bad) {
    var t = $("#toast");
    t.textContent = msg;
    t.className = "toast on" + (bad ? " bad" : "");
    clearTimeout(t.__timer);
    t.__timer = setTimeout(function () { t.className = "toast" + (bad ? " bad" : ""); }, 3200);
  }
  function api(path, opts) {
    var headers = { "Content-Type": "application/json" };
    if (S.token) headers["Authorization"] = "Bearer " + S.token;
    return fetch(path, Object.assign({ headers: headers }, opts || {})).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) {
        if (r.status === 401) {
          S.token = ""; localStorage.removeItem(TOKEN_KEY);
          showLogin(); throw new Error("登录已失效，请重新登录");
        }
        if (!r.ok) throw new Error((d && (d.detail || d.message)) || ("请求失败 " + r.status));
        return d;
      });
    });
  }

  function md(src) {
    var t = esc(src || "");
    var blocks = [];
    t = t.replace(/```[\s\S]*?```/g, function (m) {
      var code = m.slice(3, -3).replace(/^\w+\n/, "").replace(/\n$/, "");
      blocks.push("<pre><code>" + code + "</code></pre>");
      return "\u0000" + (blocks.length - 1) + "\u0000";
    });
    t = t.replace(/^#{1,4}\s+(.+)$/gm, "<b>$1</b>");
    t = t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/^\s*[-•]\s+(.+)$/gm, "· $1");
    t = t.replace(/\u0000(\d+)\u0000/g, function (m, i) { return blocks[+i]; });
    t = t.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
    return "<p>" + t + "</p>";
  }

  /* ══ 启动 / 登录 ══ */
  function boot() {
    $("#splash-go").addEventListener("click", enter);
    setTimeout(enter, 8000);
    bindLogin();
  }
  function enter() {
    var sp = $("#splash");
    if (sp && !sp.classList.contains("fade")) {
      sp.classList.add("fade");
      setTimeout(function () { sp.classList.add("hidden"); }, 560);
    }
    if (S.token) {
      api("/api/auth/me").then(function (r) { S.user = r.user; startApp(); })
        .catch(function () { showLogin(); });
    } else showLogin();
  }
  function showLogin() {
    $("#app").classList.add("hidden");
    $("#chat").classList.add("hidden");
    $("#login").classList.remove("hidden");
    var last = localStorage.getItem(LAST_USER);
    if (last && $("#lg-user") && !$("#lg-user").value) $("#lg-user").value = last;
  }
  function bindLogin() {
    $("#lg-eye").onclick = function () {
      var i = $("#lg-pass");
      i.type = i.type === "password" ? "text" : "password";
    };
    $("#lg-forgot").onclick = function () { toast("请联系团队管理员重置密码"); };
    $$(".social button").forEach(function (b) {
      b.onclick = function () { toast("第三方登录暂未开通，请用账号密码登录"); };
    });
    $("#to-register").onclick = function () {
      $("#form-login").classList.add("hidden");
      $("#form-register").classList.remove("hidden");
      var last = localStorage.getItem(LAST_USER);
      if (last && !$("#rg-user").value) $("#rg-user").value = last;
    };
    $("#to-login").onclick = function () {
      $("#form-register").classList.add("hidden");
      $("#form-login").classList.remove("hidden");
    };
    $("#form-login").onsubmit = function (e) {
      e.preventDefault();
      $("#lg-err").textContent = "";
      var u = $("#lg-user").value.trim();
      api("/api/auth/login", { method: "POST", body: JSON.stringify({ username: u, password: $("#lg-pass").value }) })
        .then(function (r) {
          S.token = r.token; S.user = r.user;
          localStorage.setItem(TOKEN_KEY, r.token);
          if ($("#lg-remember").checked) localStorage.setItem(LAST_USER, u);
          startApp();
        }).catch(function (err) { $("#lg-err").textContent = err.message; });
    };
    $("#form-register").onsubmit = function (e) {
      e.preventDefault();
      $("#rg-err").textContent = "";
      if ($("#rg-pass").value !== $("#rg-pass2").value) { $("#rg-err").textContent = "两次密码不一致"; return; }
      if (!$("#rg-agree").checked) { $("#rg-err").textContent = "请先同意服务条款"; return; }
      var u = $("#rg-user").value.trim();
      api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username: u, password: $("#rg-pass").value, company: $("#rg-company").value.trim() }),
      }).then(function (r) {
        S.token = r.token; S.user = r.user;
        localStorage.setItem(TOKEN_KEY, r.token);
        localStorage.setItem(LAST_USER, u);
        startApp();
      }).catch(function (err) {
        var msg = err.message || "";
        $("#rg-err").innerHTML = esc(msg) +
          (msg.indexOf("已被注册") >= 0 ? ' · <a class="link" id="rg-go-login">直接用这个账号登录</a>' : "");
        var go = $("#rg-go-login");
        if (go) go.onclick = function () {
          $("#form-register").classList.add("hidden");
          $("#form-login").classList.remove("hidden");
          $("#lg-user").value = u;
        };
      });
    };
  }

  /* ══ 应用 ══ */
  function startApp() {
    $("#login").classList.add("hidden");
    $("#app").classList.remove("hidden");
    bindTabs();
    loadAll().then(function () { go("home"); });
  }
  function bindTabs() {
    $$(".tab").forEach(function (b) {
      b.onclick = function () { go(b.getAttribute("data-tab")); };
    });
  }
  function loadAll() {
    return Promise.all([
      api("/api/agents").catch(function () { return { agents: [] }; }),
      api("/api/launch/plan").catch(function () { return null; }),
      api("/api/launch/platforms").catch(function () { return { platforms: [] }; }),
      api("/api/team").catch(function () { return null; }),
    ]).then(function (r) {
      S.agents = r[0].agents || [];
      S.plan = r[1];
      S.platforms = (r[2] && r[2].platforms) || [];
      S.team = r[3];
    });
  }
  function go(page) {
    var tabIds = ["home", "agents", "platforms", "project", "me"];
    if (tabIds.indexOf(S.page) >= 0 && tabIds.indexOf(page) < 0) S.lastTab = S.page;
    S.page = page;
    if (tabIds.indexOf(page) >= 0) {
      $$(".tab").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-tab") === page); });
    }
    render();
    $("#page").scrollTop = 0;
  }
  function back() {
    go(S.lastTab || "home");
  }

  function render() {
    var p = $("#page");
    var map = {
      home: viewHome, agents: viewAgents, platforms: viewPlatforms, project: viewProject, me: viewMe,
      market: viewMarket, product: viewProduct, plan: viewPlan, notices: viewNotices,
    };
    p.innerHTML = (map[S.page] || viewHome)();
    bindPage();
  }

  /* ── 进度 ── */
  function progress() {
    var a = (S.plan && S.plan.answers) || {};
    var r = (S.plan && S.plan.result) || null;
    var connected = S.platforms.filter(function (x) { return x.status && x.status !== "none"; }).length;
    var items = [
      { k: "市场分析", done: !!(r && r.route), doing: !r && !!Object.keys(a).length },
      { k: "选品策略", done: !!(a.product && a.category) },
      { k: "平台对接", done: connected > 0, doing: connected === 0 },
      { k: "预算规划", done: !!(r && (r.budget || []).length) },
      { k: "风险评估", done: !!(r && (r.risks || []).length) },
    ];
    var done = items.filter(function (i) { return i.done; }).length;
    return { items: items, done: done, total: items.length, pct: Math.round(done / items.length * 100), connected: connected };
  }
  function ringSvg(pct, size) {
    size = size || 92;
    var R = (size - 12) / 2, C = 2 * Math.PI * R;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '">' +
      '<circle class="bg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + R + '"/>' +
      '<circle class="fg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + R + '" stroke-dasharray="' + C.toFixed(1) +
      '" stroke-dashoffset="' + C.toFixed(1) + '" data-off="' + (C * (1 - pct / 100)).toFixed(1) + '"/></svg>';
  }

  function head(title, sub, opts) {
    opts = opts || {};
    var right = opts.right || "";
    var left = opts.back ? '<button class="icon-btn back" data-back>' + IC.back + "</button>" : "";
    return '<div class="page-head">' +
      '<div style="display:flex;align-items:flex-start;gap:6px">' + left +
      "<div><h1 class=\"h1\">" + esc(title) + '</h1>' + (sub ? '<p class="sub1">' + esc(sub) + "</p>" : "") + "</div></div>" +
      (right ? '<div class="right">' + right + "</div>" : "") + "</div>";
  }

  /* ══ 首页 ══ */
  function viewHome() {
    var pg = progress();
    var u = S.user || {};
    var projects = (S.team && S.team.projects) || [];
    var r = (S.plan && S.plan.result) || null;
    var company = u.company || (S.team && S.team.workspaces[0] && S.team.workspaces[0].name) || "";

    return '<div class="page-head"><div>' +
      '<h1 class="h1">早上好，' + esc(u.username || "商家") + "</h1>" +
      '<p class="sub1">今天也是走向全球的一天 <span class="star">✦</span></p>' +
      '<div class="who"><span class="av">' + IC.user + '</span><span>' + esc(company || "PHAROS 出海工作台") + "</span></div></div>" +
      '<div class="right"><button class="icon-btn bell" data-notices>' + IC.bell + "</button>" +
      '<button class="icon-btn" data-go="me" style="border-radius:50%">' + IC.user + "</button></div></div>" +

      '<div class="search">' + IC.search + "搜索项目、平台、智能体…</div>" +

      '<div class="card">' +
      '<div class="ring-wrap"><div><div class="ov-h">出海进度</div>' +
      '<div class="ov-n">' + pg.done + '<span> / ' + pg.total + "</span></div></div>" +
      '<div class="ring">' + ringSvg(pg.pct, 104) + '<div class="pct">' + pg.pct + "<small>%</small></div></div></div>" +
      '<ul class="steps">' + pg.items.map(function (i, n) {
        var cls = i.done ? "done" : (i.doing ? "doing" : "");
        var st = i.done ? "已完成" : (i.doing ? "进行中" : "待开始");
        var inner = i.done ? IC.check : (i.doing ? (n + 1) : (n + 1));
        return '<li class="' + cls + '"><span class="ic">' + inner + "</span>" +
          "<span>" + esc(i.k) + '</span><span class="st">' + st + "</span></li>";
      }).join("") + "</ul>" +
      '<button class="btn-navy" data-plan style="margin-top:16px">' + (r ? "继续出海计划" : "开启出海计划") + " →</button>" +
      "</div>" +

      '<div class="sec"><h3>快速开始</h3></div>' +
      '<div class="quick-grid">' +
      [["市场分析", IC.chart, "blue", "market"], ["选品策略", IC.box, "orange", "product"],
       ["平台对接", IC.link, "green", "platforms"], ["内容营销", IC.doc, "purple", "copy"]]
        .map(function (x) {
          return '<button class="quick" data-quick="' + x[3] + '"><span class="g3d ' + x[2] + '">' + x[1] + "</span>" + x[0] + "</button>";
        }).join("") + "</div>" +

      '<div class="sec"><h3>我的项目</h3><button class="more" data-go="project">查看全部' + IC.chev + "</button></div>" +
      '<div class="proj-row">' +
      (projects.length ? projects.map(function (pr, i) {
        return '<div class="proj-card"><div class="thumb"><img src="/m/assets/hp2.jpg" alt=""></div>' +
          '<div class="nm">' + esc(pr.name) + "</div>" +
          '<div class="meta"><span class="tag ' + (i === 0 && pg.done ? "warn" : "gray") + '"><i class="dot"></i>' +
          (i === 0 && pg.done ? "进行中" : "规划中") + "</span><span class=\"tiny\">" + esc(pr.market || "美国") + "</span></div></div>";
      }).join("")
        : '<div class="proj-card"><div class="thumb"><img src="/m/assets/hp2.jpg" alt=""></div>' +
          '<div class="nm">还没有项目</div><div class="meta"><span class="tag gray">去出海计划创建</span></div></div>') +
      "</div>";
  }

  /* ══ 智能体 ══ */
  var CATS = [["all", "全部"], ["market", "市场"], ["insight", "选品"], ["ops", "运营"], ["content", "内容"]];
  var ACAT = { command: "market", health: "market", culture: "market", insight: "insight", copy: "content", asset: "content", audit: "ops", growth: "ops" };
  var AICON = { command: IC.globe, health: IC.shield, culture: IC.spark, insight: IC.box, copy: IC.doc, asset: IC.mic, audit: IC.shield, growth: IC.chart };
  var ACOLOR = { command: "blue", health: "green", culture: "teal", insight: "orange", copy: "purple", asset: "pink", audit: "green", growth: "blue" };

  function viewAgents() {
    var list = S.agents.filter(function (a) { return S.agentCat === "all" || ACAT[a.id] === S.agentCat; });
    return head("AI 智能体", "8 位专业智能体，助你高效出海") +
      '<div class="pills">' + CATS.map(function (c) {
        return '<button class="pill ' + (S.agentCat === c[0] ? "on" : "") + '" data-cat="' + c[0] + '">' + c[1] + "</button>";
      }).join("") + "</div>" +
      '<div class="agent-grid">' + list.map(function (a) {
        return '<button class="agent-card" data-agent="' + esc(a.id) + '">' +
          '<span class="g3d ' + (ACOLOR[a.id] || "blue") + '">' + (AICON[a.id] || IC.spark) + "</span>" +
          '<div class="nm">' + esc(a.name) + "</div>" +
          '<div class="ds">' + esc(a.desc) + "</div></button>";
      }).join("") + "</div>";
  }

  /* ══ 平台 ══ */
  var LOGO = { amazon: "amazon", tiktok: "tiktok", shopify: "shopify", shopee: "shopee", aliexpress: "aliexpress" };
  var LOGO_TEXT = { temu: "TEMU", shein: "SHEIN", lazada: "Lazada" };
  function platLogo(id) {
    if (LOGO[id]) {
      return '<span class="plat-logo"><img src="/m/assets/logo-' + LOGO[id] + '.svg" alt=""></span>';
    }
    return '<span class="plat-logo txt">' + esc(LOGO_TEXT[id] || "•") + "</span>";
  }
  function viewPlatforms() {
    var pg = progress();
    var list = S.platforms.filter(function (p) {
      var on = p.status && p.status !== "none";
      if (S.platFilter === "on") return on;
      if (S.platFilter === "off") return !on;
      return true;
    });
    return head("平台管理", "已连接 " + pg.connected + " / " + S.platforms.length + " 个平台",
      { right: '<button class="pill-btn" data-add-plat>＋ 添加平台</button>' }) +
      '<div class="pills">' +
      [["all", "全部 (" + S.platforms.length + ")"], ["on", "已连接 (" + pg.connected + ")"], ["off", "未连接 (" + (S.platforms.length - pg.connected) + ")"]]
        .map(function (x) {
          return '<button class="pill ' + (S.platFilter === x[0] ? "on" : "") + '" data-pf="' + x[0] + '">' + x[1] + "</button>";
        }).join("") + "</div>" +
      list.map(function (p) {
        var st = p.status || "none";
        var cls = st === "opened" ? "ok" : (st === "none" ? "gray" : "warn");
        var txt = { none: "未连接", preparing: "进行中", submitted: "审核中", opened: "已连接" }[st] || st;
        return '<div class="plat"><div class="plat-top" data-plat="' + esc(p.id) + '">' +
          platLogo(p.id) +
          '<span style="min-width:0"><span class="nm" style="display:block">' + esc(p.name) + "</span>" +
          '<span class="rg" style="display:block">' + esc(p.region) + "</span></span>" +
          '<span class="st"><span class="tag ' + cls + '"><i class="dot"></i>' + txt + "</span></span></div>" +
          '<div class="plat-acts"><button data-ana="' + esc(p.id) + '">市场分析</button>' +
          '<button data-guide="' + esc(p.id) + '">入驻指南</button>' +
          '<button data-plat="' + esc(p.id) + '">数据看板</button></div></div>';
      }).join("");
  }

  /* ══ 项目 ══ */
  function viewProject() {
    var pg = progress();
    var r = (S.plan && S.plan.result) || null;
    var a = (S.plan && S.plan.answers) || {};
    var p0 = ((S.team && S.team.projects) || [])[0] || { name: "第一个出海项目", market: "美国" };
    var firstOrder = !!(S.plan && S.plan.first_order);
    var tabs = [["overview", "概览"], ["market", "市场"], ["product", "选品"], ["platforms", "平台"], ["ops", "运营"]];
    var body = "";

    if (S.projTab === "overview") {
      var ms = (r && r.milestones) || [];
      body =
        '<div class="card"><div class="ring-wrap"><div><div class="ov-h">项目进度</div>' +
        '<div class="ov-n">' + pg.done + '<span> / ' + pg.total + '</span></div>' +
        '<div class="tiny" style="margin-top:6px">' + pg.pct + "% 已完成</div></div>" +
        '<div class="ring">' + ringSvg(pg.pct) + '<div class="pct">' + pg.pct + "<small>%</small></div></div></div>" +
        '<div class="bar" style="margin-top:14px"><i style="width:' + pg.pct + '%"></i></div>' +
        '<div class="flow">' + pg.items.map(function (i) {
          var cls = i.done ? "done" : (i.doing ? "doing" : "");
          return '<div class="node ' + cls + '"><span class="dot">' + (i.done ? IC.check : "") + "</span>" +
            '<span class="lb">' + esc(i.k) + "</span></div>";
        }).join("") + "</div></div>" +

        '<div class="sec"><h3>AI 建议</h3></div>' +
        '<div class="card">' +
        ((r && (r.next_steps || []).length)
          ? r.next_steps.slice(0, 3).map(function (x, i) {
              return '<div class="ai-sug"><span class="g3d ' + ["blue", "green", "orange"][i % 3] + '">' + (i === 0 ? IC.target : (i === 1 ? IC.box : IC.doc)) + "</span><span>" + esc(x) + "</span></div>";
            }).join("")
          : '<div class="ai-sug"><span class="g3d blue">' + IC.spark + '</span><span>完成出海计划后，AI 会给出针对你的下一步建议。</span></div>') +
        "</div>" +

        (ms.length
          ? '<div class="sec"><h3>阶段计划</h3></div><div class="card">' + ms.map(function (m, i) {
              return '<div style="margin-bottom:' + (i === ms.length - 1 ? 0 : 16) + 'px"><div style="font-size:13.5px;font-weight:750;margin-bottom:7px">' +
                (i + 1) + ". " + esc(m.phase || "") + "</div>" +
                (m.tasks || []).map(function (t) { return '<div class="muted">· ' + esc(t) + "</div>"; }).join("") + "</div>";
            }).join("") + "</div>"
          : "") +

        '<div class="card" style="margin-top:14px"><div style="display:flex;align-items:center;gap:12px">' +
        '<span class="g3d ' + (firstOrder ? "green" : "orange") + '">' + IC.target + "</span>" +
        '<div style="flex:1"><div style="font-size:13.5px;font-weight:750">完成首次出单</div>' +
        '<div class="tiny" style="margin-top:3px">' + (firstOrder ? "已达成，恭喜出海第一步！" : "方案落地后标记完成") + "</div></div>" +
        (firstOrder ? '<span class="tag ok">已达成</span>' : '<button class="btn-line" data-mark-order>标记完成</button>') +
        "</div></div>" +

        '<button class="btn-navy" data-plan2 style="margin-top:14px">' + (r ? "继续执行下一步" : "去完成出海计划") + " →</button>";
    } else if (S.projTab === "market") {
      var mk = { us: "北美", eu: "欧洲", sea: "东南亚", me: "中东", latam: "拉美", jpkr: "日韩", other: "其他" };
      body = '<div class="card"><div class="ov-h" style="margin-bottom:12px">目标市场</div>' +
        '<div class="chips">' + ((a.markets || []).length
          ? a.markets.map(function (m) { return '<span class="chip on" style="pointer-events:none">' + (mk[m] || m) + "</span>"; }).join("")
          : '<span class="muted">尚未选择市场，去出海计划里补充</span>') + "</div>" +
        (r && r.route ? '<div class="muted">首选平台：<b style="color:var(--ink)">' + esc(r.route.primary) + "</b><br>" + esc(r.route.primary_reason || "") + "</div>" : "") +
        "</div>" +
        '<div class="card" style="margin-top:14px"><div class="ov-h" style="margin-bottom:10px">AI 市场分析</div>' +
        '<div id="ai-out" class="muted">' + (S.aiText.market ? md(S.aiText.market) : "点下方按钮，让 AI 结合你的产品分析目标市场的需求、竞争与切入角度。") + "</div>" +
        '<button class="btn-navy" data-ai="market" style="margin-top:14px">' + IC.spark + ' 生成市场分析</button></div>';
    } else if (S.projTab === "product") {
      body = '<div class="card"><div class="ov-h" style="margin-bottom:12px">产品信息</div>' +
        '<div class="muted">' +
        (a.category ? "品类：" + esc(a.category) + "<br>" : "") +
        (a.product ? "产品：" + esc(a.product) + "<br>" : "") +
        (a.price ? "客单价：" + esc(a.price) + "<br>" : "") +
        (a.supply ? "供应链：" + esc(a.supply) + "<br>" : "") +
        (!a.category && !a.product ? "还没有填写产品信息，去出海计划补充。" : "") + "</div></div>" +
        '<div class="card" style="margin-top:14px"><div class="ov-h" style="margin-bottom:10px">AI 选品建议</div>' +
        '<div id="ai-out" class="muted">' + (S.aiText.product ? md(S.aiText.product) : "让 AI 结合你的品类与客单价，给出差异化选品与定价建议。") + "</div>" +
        '<button class="btn-navy" data-ai="product" style="margin-top:14px">' + IC.spark + ' 生成选品建议</button></div>';
    } else if (S.projTab === "ops") {
      body = '<div class="card"><div class="ov-h" style="margin-bottom:12px">运营建议</div>' +
        '<div class="muted">上线节奏、广告预算与内容排期，AI 会结合你的阶段给出建议。</div></div>' +
        '<div class="card" style="margin-top:14px"><div class="ov-h" style="margin-bottom:10px">AI 运营规划</div>' +
        '<div id="ai-out" class="muted">' + (S.aiText.ops ? md(S.aiText.ops) : "点下方按钮，让 AI 给出冷启动 30 天的运营节奏与预算分配。") + "</div>" +
        '<button class="btn-navy" data-ai="ops" style="margin-top:14px">' + IC.spark + " 生成运营规划</button></div>";
    } else {
      body = '<div class="card"><div class="ov-h" style="margin-bottom:12px">平台对接</div>' +
        '<div class="muted">已连接 ' + pg.connected + " / " + S.platforms.length + " 个平台</div></div>" +
        S.platforms.slice(0, 4).map(function (p) {
          var st = p.status || "none";
          var cls = st === "opened" ? "ok" : (st === "none" ? "gray" : "warn");
          var txt = { none: "未连接", preparing: "进行中", submitted: "审核中", opened: "已连接" }[st] || st;
          return '<div class="plat" style="margin-top:12px"><div class="plat-top">' +
            platLogo(p.id) +
            '<span><span class="nm" style="display:block">' + esc(p.name) + '</span><span class="rg" style="display:block">' + esc(p.region) + "</span></span>" +
            '<span class="st"><span class="tag ' + cls + '"><i class="dot"></i>' + txt + "</span></span></div></div>";
        }).join("") +
        '<button class="btn-navy" data-go="platforms" style="margin-top:14px">去平台管理 →</button>';
    }

    return head(p0.name, "创建于 " + new Date().toISOString().slice(0, 10),
      { back: true, right: '<button class="icon-btn">⋯</button>' }) +
      '<div class="card"><div class="proj-hero"><div class="thumb"><img src="/m/assets/hp2.jpg" alt=""></div>' +
      '<div style="flex:1;min-width:0"><div style="font-size:15.5px;font-weight:750">' + esc(p0.name) + "</div>" +
      '<div class="tiny" style="margin-top:5px">' + esc(p0.market || "美国") + " · " + esc(p0.platform || "待定") + "</div>" +
      '<div style="margin-top:9px"><span class="tag ' + (pg.pct ? "warn" : "gray") + '"><i class="dot"></i>' + (pg.pct ? "进行中" : "规划中") + "</span></div></div></div></div>" +
      '<div class="tabs">' + tabs.map(function (t) {
        return '<button class="' + (S.projTab === t[0] ? "on" : "") + '" data-pt="' + t[0] + '">' + t[1] + "</button>";
      }).join("") + "</div>" + body;
  }

  /* ══ 市场分析独立页（示例数据均明确标注）══ */
  function viewMarket() {
    var a = (S.plan && S.plan.answers) || {};
    var markets = a.markets || [];
    var has = function (k) { return markets.indexOf(k) >= 0; };
    var tabs = [["g", "全球市场"], ["t", "趋势分析"], ["c", "竞争分析"]];
    var mkt = [["北美", "$1.2B", "+12%"], ["欧洲", "$856M", "+8%"], ["东南亚", "$620M", "+18%"]];
    return head("市场分析", "全球市场 · 机会与趋势", { back: true }) +
      '<div class="pills">' + tabs.map(function (t) {
        return '<button class="pill ' + (S.mkTab === t[0] ? "on" : "") + '" data-mk="' + t[0] + '">' + t[1] + "</button>";
      }).join("") + "</div>" +
      '<div class="card map-card">' + worldMap(has) + "</div>" +
      '<div class="mk-row" style="margin-top:12px">' + mkt.map(function (x) {
        return '<div class="mk"><div class="lb">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="d">' + x[2] + "</div></div>";
      }).join("") + "</div>" +
      '<div class="tiny" style="margin:8px 2px 0">示例数据 · 仅示意，真实结论请用 AI 分析生成</div>' +
      '<div class="sec"><h3>市场趋势</h3></div>' +
      '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between">' +
      "<div><div style=\"font-size:13.5px;font-weight:700\">" + esc(a.category || "宠物智能用品") + "</div>" +
      '<div class="tiny" style="margin-top:4px">2023-2025 搜索增长</div></div>' +
      '<div style="font-size:18px;font-weight:800;color:var(--ok)">+32%</div></div>' +
      '<div class="trend">' + [34, 48, 40, 62, 55, 74, 68, 86].map(function (h) {
        return '<i style="height:' + h + '%"></i>';
      }).join("") + "</div></div>" +
      '<div class="card" style="margin-top:14px"><div class="ov-h" style="margin-bottom:10px">AI 市场分析</div>' +
      '<div id="ai-out" class="muted">' + (S.aiText.market ? md(S.aiText.market) : "让 AI 结合你的品类与目标市场，分析需求、竞争、价格带与切入角度。") + "</div>" +
      '<button class="btn-navy" data-ai="market" style="margin-top:14px">' + IC.spark + " 生成市场分析</button></div>";
  }

  /* 真实世界地图（公开矢量素材）+ 目标市场光点 */
  function worldMap(has) {
    var pins = [
      ["us", 22, 38], ["latam", 30, 66], ["eu", 51, 29],
      ["me", 60, 45], ["sea", 76, 58], ["jpkr", 84, 40],
    ].filter(function (p) { return has(p[0]); }).map(function (p) {
      return '<span class="pin" style="left:' + p[1] + "%;top:" + p[2] + '%"></span>';
    }).join("");
    return '<div class="mapwrap"><img src="/m/assets/world.svg" alt="世界地图">' + pins + "</div>";
  }

  /* ══ 选品分析独立页 ══ */
  function viewProduct() {
    var a = (S.plan && S.plan.answers) || {};
    var tabs = [["p", "潜力产品"], ["c", "竞争分析"], ["m", "利润分析"]];
    var items = [
      ["无线降噪耳机", "市场潜力高 · 竞争中", "85", "hp", true],
      ["智能宠物喂食器", "市场潜力高 · 竞争中", "78", "box", false],
      ["便携投影仪", "市场潜力高 · 竞争中", "76", "proj", false],
      ["户外露营灯", "市场潜力中 · 竞争低", "72", "lamp", false],
    ];
    return head("选品分析", "潜力评估 · 差异化机会", { back: true }) +
      '<div class="pills">' + tabs.map(function (t) {
        return '<button class="pill ' + (S.pdTab === t[0] ? "on" : "") + '" data-pd="' + t[0] + '">' + t[1] + "</button>";
      }).join("") + "</div>" +
      '<div class="card" style="padding:8px 6px">' + items.map(function (it) {
        return '<div class="pitem"><div class="pthumb">' +
          (it[4] ? '<img src="/m/assets/hp2.jpg" alt="">' : '<span class="g3d ' + (it[3] === "box" ? "orange" : (it[3] === "proj" ? "purple" : "green")) + '">' + (it[3] === "box" ? IC.box : (it[3] === "proj" ? IC.monitor : IC.spark)) + "</span>") +
          '</div><div class="pinfo"><div class="pname">' + esc(it[0]) + '</div><div class="psub">' + esc(it[1]) + "</div></div>" +
          '<div class="pscore"><div class="s">' + it[2] + '</div><div class="sl">综合评分</div></div></div>';
      }).join("") + "</div>" +
      '<div class="tiny" style="margin:8px 2px 0">示例产品 · 仅示意，AI 会按你的品类生成真实建议</div>' +
      '<div class="sec"><h3>AI 选品建议</h3></div>' +
      '<div class="card"><div id="ai-out" class="muted">' + (S.aiText.product ? md(S.aiText.product) : "让 AI 结合你的品类、客单价与目标市场，给出产品方向、差异化卖点与定价建议。") + "</div>" +
      '<button class="btn-navy" data-ai="product" style="margin-top:14px">' + IC.spark + " 生成选品建议</button></div>";
  }

  /* ══ 出海计划页 ══ */
  function viewPlan() {
    var pg = progress();
    return head("出海计划", "五步完成你的出海准备", { back: true }) +
      '<div class="card"><div class="planlist">' + pg.items.map(function (i, n) {
        var cls = i.done ? "done" : (i.doing ? "now" : "");
        var st = i.done ? "已完成" : (i.doing ? "进行中" : "待开始");
        return '<div class="planstep ' + cls + '"><span class="n">' + (i.done ? IC.check : n + 1) + "</span>" +
          "<div><div class=\"t\">" + esc(i.k) + '</div><div class="d">' +
          ["完成市场调研，确定目标市场", "筛选高潜力产品，分析竞争", "开通平台账号，完成入驻", "制定投放预算与运营计划", "识别合规与政策风险"][n] +
          '</div><div class="s">' + st + "</div></div></div>";
      }).join("") + "</div>" +
      '<button class="btn-navy" data-open-wiz style="margin-top:6px">' + (pg.done ? "继续下一步" : "开始填写") + " →</button></div>";
  }

  /* ══ 消息 ══ */
  function viewNotices() {
    var pg = progress();
    var list = [];
    if (S.plan && S.plan.result) list.push([IC.target, "blue", "项目进度更新", "出海方案已生成，查看阶段计划与预算", "5 分钟前"]);
    list.push([IC.link, "green", "平台对接", "已连接 " + pg.connected + " / " + S.platforms.length + " 个平台", "1 小时前"]);
    if (pg.done) list.push([IC.spark, "purple", "AI 分析报告", "出海进度 " + pg.done + " / " + pg.total + "，继续完成剩余步骤", "2 小时前"]);
    if (S.plan && S.plan.first_order) list.push([IC.target, "orange", "首次出单", "恭喜完成出海第一步", "今天"]);
    list.push([IC.info, "teal", "系统通知", "PC 与手机同账号，数据实时互通", "今天"]);
    return head("消息通知", "全部 · 系统 · 项目 · 平台", { back: true }) +
      '<div class="card">' + list.map(function (n) {
        return '<div class="notif"><span class="g3d ' + n[1] + '">' + n[0] + "</span>" +
          '<div style="flex:1;min-width:0"><div class="t">' + esc(n[2]) + '</div><div class="d">' + esc(n[3]) + "</div></div>" +
          '<span class="time">' + esc(n[4]) + "</span></div>";
      }).join("") + "</div>";
  }

  /* ══ 我的 ══ */
  function viewMe() {
    var u = S.user || {};
    return '<div class="me-head"><div class="me-av">' + IC.user + "</div>" +
      '<div><div class="nm">' + esc(u.username || "商家") + '</div><div class="sub">' + esc(u.company || "个人版") + "</div></div>" +
      '<span class="tag warn" style="margin-left:auto">专业版</span></div>' +

      '<div class="menu" style="margin-bottom:14px">' +
      '<button data-team><span class="mi">' + IC.user + "</span>团队与邀请" + '<span class="ar">' + IC.chev + "</span></button>" +
      '<button data-todo><span class="mi">' + IC.grid + "</span>今日待办" + '<span class="ar">' + IC.chev + "</span></button>" +
      '<button data-go="project"><span class="mi">' + IC.grid + "</span>我的项目" + '<span class="ar">' + IC.chev + "</span></button>" +
      '<button data-ai-settings><span class="mi">' + IC.gear + "</span>AI 服务配置" + '<span class="val" id="ai-state">检查中…</span></button>' +
      '<button data-notices><span class="mi">' + IC.bell + "</span>通知设置" + '<span class="val">' + (notifCount()) + " 条</span></button>" +
      "</div>" +

      '<div class="menu" style="margin-bottom:18px">' +
      '<button data-sync><span class="mi">' + IC.cloud + "</span>数据同步" + '<span class="val good">已开启</span></button>' +
      '<button data-desktop><span class="mi">' + IC.monitor + "</span>桌面版" + '<span class="ar">' + IC.chev + "</span></button>" +
      '<button data-help><span class="mi">' + IC.help + "</span>帮助中心" + '<span class="ar">' + IC.chev + "</span></button>" +
      '<button data-about><span class="mi">' + IC.info + "</span>关于我们" + '<span class="ar">' + IC.chev + "</span></button>" +
      "</div>" +

      '<button class="btn-line" data-logout style="width:100%;color:var(--bad);padding:14px">退出登录</button>' +
      '<p class="tiny" style="text-align:center;margin-top:18px;line-height:1.7">PHAROS OCEAN · v2.0<br>数据存于你的服务器 · PC 与手机同账号互通</p>';
  }
  function notifCount() {
    var n = 1;
    if (S.plan && S.plan.result) n++;
    if (progress().connected) n++;
    if (S.plan && S.plan.first_order) n++;
    return n;
  }

  /* ══ 事件 ══ */
  function bindPage() {
    var p = $("#page");
    $$("[data-back]", p).forEach(function (b) { b.onclick = back; });
    $$("[data-go]", p).forEach(function (b) { b.onclick = function () { go(b.getAttribute("data-go")); }; });
    $$("[data-plan]", p).forEach(function (b) { b.onclick = function () { go("plan"); }; });
    $$("[data-plan2]", p).forEach(function (b) { b.onclick = function () { go("plan"); }; });
    $$("[data-notices]", p).forEach(function (b) { b.onclick = function () { go("notices"); }; });
    $$("[data-agent]", p).forEach(function (b) { b.onclick = function () { openChat(b.getAttribute("data-agent")); }; });
    $$("[data-quick]", p).forEach(function (b) {
      b.onclick = function () {
        var q = b.getAttribute("data-quick");
        if (q === "market") go("market");
        else if (q === "product") go("product");
        else if (q === "platforms") go("platforms");
        else if (q === "copy") openChat("copy");
      };
    });
    $$("[data-cat]", p).forEach(function (b) { b.onclick = function () { S.agentCat = b.getAttribute("data-cat"); render(); }; });
    $$("[data-pf]", p).forEach(function (b) { b.onclick = function () { S.platFilter = b.getAttribute("data-pf"); render(); }; });
    $$("[data-plat]", p).forEach(function (b) { b.onclick = function () { openPlatform(b.getAttribute("data-plat")); }; });
    $$("[data-guide]", p).forEach(function (b) { b.onclick = function () { openGuide(b.getAttribute("data-guide")); }; });
    $$("[data-ana]", p).forEach(function (b) {
      b.onclick = function () {
        var p2 = S.platforms.filter(function (x) { return x.id === b.getAttribute("data-ana"); })[0];
        openChat("insight");
        setTimeout(function () {
          var t = $("#chat-text");
          if (t && p2) { t.value = "帮我分析" + p2.name + "这个平台适合卖什么、怎么进入"; t.focus(); }
        }, 500);
      };
    });
    $$("[data-pt]", p).forEach(function (b) { b.onclick = function () { S.projTab = b.getAttribute("data-pt"); render(); }; });
    $$("[data-mk]", p).forEach(function (b) { b.onclick = function () { S.mkTab = b.getAttribute("data-mk"); render(); }; });
    $$("[data-pd]", p).forEach(function (b) { b.onclick = function () { S.pdTab = b.getAttribute("data-pd"); render(); }; });
    $$("[data-ai]", p).forEach(function (b) {
      b.onclick = function () {
        var kind = b.getAttribute("data-ai");
        var prompt = kind === "market"
          ? "帮我做目标市场的机会分析：需求规模、竞争格局、价格带和切入角度。" + ((S.plan && S.plan.answers && S.plan.answers.product) ? "我的产品是" + S.plan.answers.product + "。" : "")
          : (kind === "ops"
            ? "给我一个冷启动 30 天的运营规划：节奏、广告预算分配、内容排期和止损线。"
            : "基于我的品类与客单价，给我选品方向、差异化卖点和定价建议。");
        aiInto("insight", prompt, kind, b);
      };
    });
    var ow = $("[data-open-wiz]", p);
    if (ow) ow.onclick = openPlanSheet;
    var mt = $("[data-team]", p);
    if (mt) mt.onclick = openTeamSheet;
    var td = $("[data-todo]", p);
    if (td) td.onclick = openTodoSheet;
    var mo2 = $("[data-mark-order]", p);
    if (mo2) mo2.onclick = function () {
      if (!confirm("标记「完成首次出单」？")) return;
      api("/api/launch/first-order", { method: "POST", body: JSON.stringify({ done: true }) })
        .then(function () { toast("恭喜！首次出单里程碑达成"); loadAll().then(render); })
        .catch(function (e) { toast(e.message, true); });
    };
    var ap = $("[data-add-plat]", p);
    if (ap) ap.onclick = function () { toast("点下方平台卡片，更新对接状态即可"); };
    var aiset = $("[data-ai-settings]", p);
    if (aiset) aiset.onclick = openAiSettings;
    var sync = $("[data-sync]", p);
    if (sync) sync.onclick = function () { loadAll().then(function () { toast("已与服务器同步"); render(); }); };
    var desk = $("[data-desktop]", p);
    if (desk) desk.onclick = function () { location.href = "/?desktop=1"; };
    var help = $("[data-help]", p);
    if (help) help.onclick = function () {
      openSheet("帮助中心", "", '<div class="muted">1. 「我的 → AI 服务配置」填 API Key<br>2. 「智能体」随时问出海问题<br>3. 首页「开启出海计划」生成方案<br>4. 「平台」记录对接进度、拿 AI 入驻指南<br><br>PC 与手机同一账号，数据实时互通。</div>');
    };
    var about = $("[data-about]", p);
    if (about) about.onclick = function () {
      openSheet("关于 PHAROS", "出海 · 让世界看见你的好产品",
        '<div class="muted">面向中小出海商家的一站式工作台：填资料生成出海方案、对接 8 大平台、8 位 AI 智能体随时待命。数据保存在你自己的服务器。</div>');
    };
    var lo = $("[data-logout]", p);
    if (lo) lo.onclick = function () {
      if (!confirm("退出登录？")) return;
      api("/api/auth/logout", { method: "POST", body: "{}" }).catch(function () {});
      S.token = ""; localStorage.removeItem(TOKEN_KEY); S.user = null;
      showLogin();
    };
    checkAiState();
    var fg = $(".ring .fg", p);
    if (fg) requestAnimationFrame(function () { fg.style.strokeDashoffset = fg.getAttribute("data-off"); });
  }

  function checkAiState() {
    api("/api/settings").then(function (s) {
      var el = $("#ai-state");
      if (el) {
        el.textContent = s.llm_configured ? "已配置" : "未配置";
        el.style.color = s.llm_configured ? "var(--ok)" : "var(--warn)";
      }
    }).catch(function () {});
  }

  /* 页面内 AI 输出（流式） */
  function aiInto(agentId, prompt, kind, btn) {
    var out = $("#ai-out");
    if (!out) return;
    if (btn) btn.disabled = true;
    out.innerHTML = "AI 正在分析<span class=\"typing\"><i></i><i></i><i></i></span>";
    api("/api/conversations", { method: "POST", body: JSON.stringify({ agent_id: agentId }) })
      .then(function (c) {
        return fetch("/api/conversations/" + c.id + "/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + S.token },
          body: JSON.stringify({ message: prompt }),
        });
      }).then(function (resp) {
        if (!resp.ok) return resp.json().then(function (d) { throw new Error((d && d.detail) || "失败"); });
        var reader = resp.body.getReader(), dec = new TextDecoder(), full = "", buf = "";
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) {
              S.aiText[kind] = full || "（无内容）";
              out.innerHTML = md(S.aiText[kind]);
              if (btn) btn.disabled = false;
              return;
            }
            buf += dec.decode(r.value, { stream: true });
            var i;
            while ((i = buf.indexOf("\n\n")) >= 0) {
              var chunk = buf.slice(0, i); buf = buf.slice(i + 2);
              chunk.split("\n").forEach(function (line) {
                if (line.indexOf("data:") !== 0) return;
                var ev; try { ev = JSON.parse(line.slice(5).trim()); } catch (e) { return; }
                if (ev.type === "token") {
                  full += ev.text;
                  S.aiText[kind] = full;
                  out.innerHTML = md(full);
                } else if (ev.type === "error") throw new Error(ev.message);
              });
            }
            return pump();
          });
        }
        return pump();
      }).catch(function (e) {
        out.innerHTML = "提示：" + esc(e.message);
        if (btn) btn.disabled = false;
        if (String(e.message).indexOf("尚未配置") >= 0) {
          setTimeout(function () { if (confirm("还没配置 AI 服务，现在去配置？")) openAiSettings(); }, 300);
        }
      });
  }

  /* ══ 聊天 ══ */
  function openChat(agentId) {
    var a = S.agents.filter(function (x) { return x.id === agentId; })[0] || S.agents[0] || { id: "command", name: "智能体", desc: "" };
    S.chatAgent = a; S.chatConv = null;
    $("#chat-name").textContent = a.name;
    $("#chat-desc").textContent = (a.desc || "");
    $("#chat").classList.remove("hidden");
    var intro = '<div class="msg"><div class="av">' + (AICON[a.id] || IC.spark) + "</div>" +
      '<div class="bub">你好，我是「' + esc(a.name) + "」。" + esc(a.desc || "") +
      ((a.suggestions || []).length ? "<br><br>可以试试：<br>" + a.suggestions.map(function (s) { return "· " + esc(s); }).join("<br>") : "") +
      "</div></div>";
    /* 市场类智能体：示例数据卡（明确标注“示例”，不是真实业务数据） */
    if (a.id === "insight" || a.id === "command") {
      intro += '<div class="msg"><div class="av">' + (AICON[a.id] || IC.spark) + "</div><div class=\"bub\">" +
        '<div class="sample-card"><span class="tag-s">示例数据 · 仅示意</span>' +
        '<div><span class="big">$320B</span><span class="up">+12%</span></div>' +
        '<div class="cap">北美宠物用品市场 · 2020-2025 CAGR</div>' +
        '<div class="mini-chart">' + [38, 52, 46, 60, 57, 72, 68, 84, 88].map(function (h, i) {
          return '<i class="' + (i > 6 ? "hi" : "") + '" style="height:' + h + '%"></i>';
        }).join("") + "</div>" +
        '<div class="cap" style="margin-top:8px">核心机会点：智能喂食器 / 宠物健康护理 / 出行装备</div></div></div></div>';
    }
    $("#chat-body").innerHTML = intro;
    $("#chat-text").value = "";
    $("#chat-text").focus();
  }
  function bindChat() {
    $("#chat-back").innerHTML = IC.back;
    $("#chat-back").onclick = function () { $("#chat").classList.add("hidden"); };
    $("#chat-clear").onclick = function () {
      S.chatConv = null;
      openChat(S.chatAgent ? S.chatAgent.id : "command");
    };
    $("#chat-send").onclick = sendChat;
    $("#chat-text").addEventListener("input", function () {
      var el = this; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 110) + "px";
    });
    $("#chat-text").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });
  }
  function pushMsg(role, text) {
    var body = $("#chat-body");
    var d = document.createElement("div");
    d.className = "msg" + (role === "user" ? " me" : "");
    d.innerHTML = '<div class="av">' + (role === "user" ? IC.user : (AICON[S.chatAgent && S.chatAgent.id] || IC.spark)) + "</div>" +
      '<div class="bub">' + (role === "user" ? esc(text) : md(text)) + "</div>";
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
    return d.querySelector(".bub");
  }
  function sendChat() {
    var text = $("#chat-text").value.trim();
    if (!text || S.sending) return;
    S.sending = true;
    $("#chat-text").value = "";
    $("#chat-text").style.height = "auto";
    pushMsg("user", text);
    var bub = pushMsg("assistant", '<span class="typing"><i></i><i></i><i></i></span>');
    ensureConv().then(function (cid) {
      return fetch("/api/conversations/" + cid + "/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + S.token },
        body: JSON.stringify({ message: text }),
      });
    }).then(function (resp) {
      if (!resp.ok) return resp.json().then(function (d) { throw new Error((d && d.detail) || "发送失败"); });
      var reader = resp.body.getReader(), dec = new TextDecoder(), full = "", buf = "";
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { bub.innerHTML = md(full || "（AI 没有返回内容，请重试）"); S.sending = false; return; }
          buf += dec.decode(r.value, { stream: true });
          var i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            var chunk = buf.slice(0, i); buf = buf.slice(i + 2);
            chunk.split("\n").forEach(function (line) {
              if (line.indexOf("data:") !== 0) return;
              var ev; try { ev = JSON.parse(line.slice(5).trim()); } catch (e) { return; }
              if (ev.type === "token") {
                full += ev.text;
                bub.innerHTML = md(full) + '<span class="typing"><i></i><i></i><i></i></span>';
                $("#chat-body").scrollTop = $("#chat-body").scrollHeight;
              } else if (ev.type === "error") throw new Error(ev.message || "AI 服务异常");
            });
          }
          return pump();
        });
      }
      return pump();
    }).catch(function (err) {
      bub.innerHTML = "提示：" + esc(err.message || "网络异常");
      S.sending = false;
      if (String(err.message).indexOf("尚未配置") >= 0) {
        setTimeout(function () { if (confirm("还没配置 AI 服务，现在去配置？")) openAiSettings(); }, 300);
      }
    });
  }
  function ensureConv() {
    if (S.chatConv) return Promise.resolve(S.chatConv);
    return api("/api/conversations", { method: "POST", body: JSON.stringify({ agent_id: S.chatAgent ? S.chatAgent.id : "command" }) })
      .then(function (r) { S.chatConv = r.id; return r.id; });
  }

  /* ══ 平台详情 / 指南 ══ */
  function openPlatform(pid) {
    var p = S.platforms.filter(function (x) { return x.id === pid; })[0];
    if (!p) return;
    var sts = [["none", "未连接"], ["preparing", "进行中"], ["submitted", "已提交"], ["opened", "已连接"]];
    var html = '<div class="chips" id="plat-st">' + sts.map(function (s) {
      return '<button class="chip ' + ((p.status || "none") === s[0] ? "on" : "") + '" data-s="' + s[0] + '">' + s[1] + "</button>";
    }).join("") + "</div>" +
      '<div class="field"><label>店铺链接（开店后填写）</label><input id="plat-url" placeholder="https://…" value="' + esc(p.store_url || "") + '"></div>' +
      '<div class="muted" style="margin:10px 0 4px"><b>入驻要求</b><br>' + (p.entry || []).map(function (e) { return "· " + esc(e); }).join("<br>") + "</div>" +
      '<div class="muted" style="margin-top:10px"><b>适合谁</b><br>' + esc(p.fit || "") + "</div>" +
      '<div class="actions"><button class="btn-gold" id="plat-save">保存进度</button></div>' +
      '<div class="actions"><button class="btn-line" id="plat-verify" style="width:100%">验证店铺链接（真实访问）</button></div>' +
      '<div class="tiny" id="plat-vnote" style="margin-top:8px"></div>' +
      '<div class="actions"><button class="btn-line" id="plat-guide" style="width:100%">AI 入驻指南</button></div>';
    openSheet(p.name, p.region + " · " + p.mode, html);
    var chosen = p.status || "none";
    $$("#plat-st .chip").forEach(function (c) {
      c.onclick = function () {
        chosen = c.getAttribute("data-s");
        $$("#plat-st .chip").forEach(function (x) { x.classList.toggle("on", x === c); });
      };
    });
    $("#plat-save").onclick = function () {
      api("/api/launch/platforms/" + pid, { method: "PUT", body: JSON.stringify({ status: chosen, store_url: $("#plat-url").value.trim() }) })
        .then(function () { closeSheet(); toast("已保存"); loadAll().then(render); })
        .catch(function (e) { toast(e.message, true); });
    };
    $("#plat-guide").onclick = function () { openGuide(pid); };
    $("#plat-verify").onclick = function () {
      var url = $("#plat-url").value.trim();
      var note = $("#plat-vnote");
      if (!url) { note.textContent = "请先填写店铺链接"; return; }
      note.textContent = "正在访问…";
      api("/api/verify-url", { method: "POST", body: JSON.stringify({ url: url }) })
        .then(function (r) { note.textContent = "✅ 可访问：" + (r.title || r.final_url) + "（HTTP " + r.status + "）"; })
        .catch(function (e) { note.textContent = "❌ " + e.message; });
    };
  }
  function openGuide(pid) {
    var p = S.platforms.filter(function (x) { return x.id === pid; })[0] || {};
    openSheet("AI 入驻指南", (p.name || "") + " · 结合你的资料生成",
      '<div class="muted" id="guide-body">生成中<span class="typing"><i></i><i></i><i></i></span></div>');
    api("/api/launch/platforms/" + pid + "/guide", { method: "POST", body: "{}" }).then(function (r) {
      var g = r.guide || {};
      var html = "";
      if (g.overview) html += '<div class="muted" style="margin-bottom:12px">' + esc(g.overview) + "</div>";
      if ((g.requirements || []).length) html += '<div style="font-size:13px;font-weight:750;margin:12px 0 6px">需要准备</div>' +
        g.requirements.map(function (x) { return '<div class="muted">· ' + esc(x) + "</div>"; }).join("");
      if ((g.steps || []).length) html += '<div style="font-size:13px;font-weight:750;margin:14px 0 6px">入驻步骤</div>' +
        g.steps.map(function (s, i) { return '<div class="muted" style="margin-bottom:9px"><b>' + (i + 1) + ". " + esc(s.step) + "</b><br>" + esc(s.detail) + "</div>"; }).join("");
      if (g.timeline) html += '<div class="muted" style="margin-top:12px">预计周期：' + esc(g.timeline) + "</div>";
      if ((g.pitfalls || []).length) html += '<div style="font-size:13px;font-weight:750;margin:14px 0 6px">避坑</div>' +
        g.pitfalls.map(function (x) { return '<div class=\"muted\">注意：' + esc(x) + "</div>"; }).join("");
      $("#guide-body").innerHTML = html || "暂无内容";
    }).catch(function (e) {
      $("#guide-body").innerHTML = "提示：" + esc(e.message);
      if (String(e.message).indexOf("尚未配置") >= 0) toast("请先在「我的 → AI 服务配置」填 API Key", true);
    });
  }

  /* ══ 出海计划（向导，从计划页进入） ══ */
  var WIZ = ["市场分析", "选品策略", "平台对接", "预算规划", "风险评估"];
  var wiz = null;
  function openPlanSheet() {
    var a = (S.plan && S.plan.answers) || {};
    wiz = { step: 1, answers: Object.assign({}, a) };
    renderWizard();
  }
  function chipRow(key, opts, multi) {
    var cur = multi ? (wiz.answers[key] || []) : String(wiz.answers[key] == null ? "" : wiz.answers[key]);
    return '<div class="chips" data-key="' + key + '"' + (multi ? ' data-multi="1"' : "") + ">" +
      opts.map(function (o) {
        var on = multi ? cur.indexOf(o[0]) >= 0 : String(o[0]) === cur;
        return '<button class="chip ' + (on ? "on" : "") + '" data-v="' + esc(o[0]) + '">' + o[1] + "</button>";
      }).join("") + "</div>";
  }
  function renderWizard() {
    var step = wiz.step, body = "";
    if (step === 1) {
      body += '<div class="field"><label>目标市场（可多选）</label></div>' +
        chipRow("markets", [["us", "美国"], ["eu", "欧洲"], ["sea", "东南亚"], ["me", "中东"], ["latam", "拉美"], ["jpkr", "日韩"]], true) +
        '<div class="field"><label>首选市场</label><select id="w-first">' +
        ["美国", "欧洲", "东南亚", "中东", "拉美", "日韩", "其他"].map(function (m) {
          return '<option value="' + m + '"' + ((wiz.answers.first_market || "美国") === m ? " selected" : "") + ">" + m + "</option>";
        }).join("") + "</select></div>" +
        '<div class="field"><label>公司类型</label></div>' +
        chipRow("company_type", [["factory", "工厂"], ["trader", "贸易商"], ["brand", "品牌商"], ["individual", "个人卖家"]]);
    } else if (step === 2) {
      var cats = ["请选择品类", "消费电子", "家居生活", "服装服饰", "美妆个护", "运动户外", "宠物用品", "母婴玩具", "汽摩配件", "工业用品", "食品饮料", "其他"];
      body += '<div class="field"><label>主营品类</label><select id="w-cat">' +
        cats.map(function (c) { return '<option value="' + esc(c) + '"' + ((wiz.answers.category || "请选择品类") === c ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label>产品介绍</label><input id="w-prod" placeholder="是什么、卖给谁、凭什么赢" value="' + esc(wiz.answers.product || "") + '"></div>' +
        '<div class="field"><label>客单价</label></div>' +
        chipRow("price", [["lt50", "50 元以下"], ["50-150", "50-150 元"], ["150-500", "150-500 元"], ["gt500", "500 元以上"]]) +
        '<div class="field"><label>供应链</label></div>' +
        chipRow("supply", [["factory", "自有工厂"], ["stable", "稳定货源"], ["seeking", "需要找货"]]);
    } else if (step === 3) {
      body += '<div class="muted">选择计划先对接的平台（可多选，生成方案后会给你对应建议）。</div>' +
        '<div class="chips" id="w-plats" style="margin-top:12px">' + S.platforms.map(function (p) {
          return '<button class="chip" data-pid="' + esc(p.id) + '">' + esc(p.name) + "</button>";
        }).join("") + "</div>";
    } else if (step === 4) {
      body += '<div class="field"><label>启动预算</label></div>' +
        chipRow("budget", [["lt3", "3 万以下"], ["3-10", "3-10 万"], ["10-30", "10-30 万"], ["gt30", "30 万以上"]]) +
        '<div class="field"><label>团队规模</label></div>' +
        chipRow("team", [["1", "1 人"], ["2-5", "2-5 人"], ["6-20", "6-20 人"], ["gt20", "20 人以上"]]);
    } else {
      body += '<div class="field"><label>公司资质</label></div>' +
        chipRow("has_license", [["1", "有营业执照"], ["0", "暂无"]]) +
        chipRow("has_brand", [["1", "有注册商标"], ["0", "暂无"]]) +
        '<div class="field"><label>出海经验</label></div>' +
        chipRow("experience", [["none", "无经验"], ["domestic", "国内电商"], ["cross", "有跨境经验"]]) +
        '<div class="field"><label>已有认证（选填）</label><input id="w-certs" placeholder="如 CE、FCC" value="' + esc(wiz.answers.certs || "") + '"></div>';
    }
    var html = '<div class="grab"></div><h3>出海计划</h3>' +
      '<div class="sub">第 ' + step + " 步 / 共 5 步 · " + WIZ[step - 1] + "</div>" +
      '<div class="pills" style="margin-bottom:16px">' + WIZ.map(function (t, i) {
        var n = i + 1;
        return '<span class="pill ' + (n === step ? "on" : "") + '" style="opacity:' + (n < step ? ".6" : "1") + '">' + (n < step ? "✓ " : "") + n + ". " + t + "</span>";
      }).join("") + "</div>" + body +
      '<div class="actions">' +
      (step > 1 ? '<button class="btn-line" id="w-prev">上一步</button>' : "") +
      (step < 5 ? '<button class="btn-gold" id="w-next" style="flex:1">继续下一步 →</button>' : '<button class="btn-gold" id="w-gen" style="flex:1">生成出海方案</button>') +
      "</div>";
    openSheet(null, null, html, true);
    var wrap = $("#sheet");
    $$(".chips", wrap).forEach(function (row) {
      var key = row.getAttribute("data-key");
      if (!key) return;
      var multi = row.getAttribute("data-multi") === "1";
      $$(".chip", row).forEach(function (c) {
        c.onclick = function () {
          var v = c.getAttribute("data-v");
          if (multi) {
            var arr = (wiz.answers[key] || []).slice();
            var i = arr.indexOf(v);
            if (i >= 0) arr.splice(i, 1); else arr.push(v);
            wiz.answers[key] = arr; c.classList.toggle("on");
          } else {
            wiz.answers[key] = v;
            $$(".chip", row).forEach(function (x) { x.classList.toggle("on", x === c); });
          }
        };
      });
    });
    var plats = $("#w-plats", wrap);
    if (plats) $$(".chip", plats).forEach(function (c) { c.onclick = function () { c.classList.toggle("on"); }; });
    var collect = function () {
      var cat = $("#w-cat", wrap); if (cat) wiz.answers.category = cat.value;
      var prod = $("#w-prod", wrap); if (prod) wiz.answers.product = prod.value.trim();
      var certs = $("#w-certs", wrap); if (certs) wiz.answers.certs = certs.value.trim();
      var first = $("#w-first", wrap); if (first) wiz.answers.first_market = first.value;
    };
    var prev = $("#w-prev", wrap);
    if (prev) prev.onclick = function () { collect(); wiz.step--; renderWizard(); };
    var next = $("#w-next", wrap);
    if (next) next.onclick = function () { collect(); wiz.step++; renderWizard(); };
    var gen = $("#w-gen", wrap);
    if (gen) gen.onclick = function () { collect(); doGenerate(wrap); };
  }
  function doGenerate(wrap) {
    wrap.querySelector(".grab").insertAdjacentHTML("afterend",
      '<div class="muted" id="gen-tip" style="padding:8px 0">AI 正在生成方案，约 30-60 秒<span class="typing"><i></i><i></i><i></i></span></div>');
    api("/api/launch/plan", { method: "PUT", body: JSON.stringify({ step: 5, answers: wiz.answers }) })
      .then(function () { return api("/api/launch/generate", { method: "POST", body: "{}" }); })
      .then(function () {
        closeSheet(); toast("出海方案已生成 🎉");
        loadAll().then(function () { S.projTab = "overview"; go("project"); });
      })
      .catch(function (e) {
        var tip = $("#gen-tip");
        if (tip) tip.innerHTML = "提示：" + esc(e.message);
        if (String(e.message).indexOf("尚未配置") >= 0) {
          toast("请先配置 AI 服务", true);
          setTimeout(openAiSettings, 600);
        }
      });
  }

  /* ══ AI 设置 ══ */
  var PRESETS = [
    ["DeepSeek", "https://api.deepseek.com/v1", "deepseek-chat"],
    ["智谱 GLM", "https://open.bigmodel.cn/api/paas/v4", "glm-4-flash"],
    ["通义千问", "https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus"],
    ["Kimi", "https://api.moonshot.cn/v1", "moonshot-v1-8k"],
    ["硅基流动", "https://api.siliconflow.cn/v1", "deepseek-ai/DeepSeek-V3"],
  ];
  function openAiSettings() {
    api("/api/settings").then(function (s) {
      var html = '<div class="chips" id="ai-presets">' + PRESETS.map(function (p) {
        return '<button class="chip" data-b="' + esc(p[1]) + '" data-m="' + esc(p[2]) + '">' + p[0] + "</button>";
      }).join("") + "</div>" +
        '<div class="field"><label>接口地址 Base URL</label><input id="ai-base" value="' + esc(s.llm_base_url || "") + '" placeholder="https://api.deepseek.com/v1"></div>' +
        '<div class="field"><label>API Key</label><input id="ai-key" type="password" placeholder="' + (s.llm_configured ? "已配置（留空不变）" : "sk-…") + '"></div>' +
        '<div class="field"><label>模型</label><input id="ai-model" value="' + esc(s.llm_model || "") + '" placeholder="deepseek-chat"></div>' +
        '<div class="actions"><button class="btn-gold" id="ai-save">保存并测试连接</button></div>' +
        '<p class="tiny" style="margin-top:10px">保存在你的服务器，PC 与手机共用同一个 Key。</p>';
      openSheet("AI 服务配置", "支持 DeepSeek / 智谱 / 通义 / Kimi 等", html, true);
      $$("#ai-presets .chip").forEach(function (c) {
        c.onclick = function () {
          $("#ai-base").value = c.getAttribute("data-b");
          $("#ai-model").value = c.getAttribute("data-m");
          $$("#ai-presets .chip").forEach(function (x) { x.classList.toggle("on", x === c); });
        };
      });
      $("#ai-save").onclick = function () {
        var btn = $("#ai-save");
        btn.disabled = true;
        api("/api/settings", {
          method: "POST",
          body: JSON.stringify({
            llm_base_url: $("#ai-base").value.trim(),
            llm_api_key: $("#ai-key").value.trim(),
            llm_model: $("#ai-model").value.trim(),
          }),
        }).then(function () { return api("/api/settings/test", { method: "POST", body: "{}" }); })
          .then(function (r) { closeSheet(); toast("连接成功：" + String(r.reply || "OK").slice(0, 20)); checkAiState(); })
          .catch(function (e) { btn.disabled = false; toast(e.message, true); });
      };
    }).catch(function (e) { toast(e.message, true); });
  }

  /* ══ 团队与邀请 / 今日待办 ══ */
  function openTeamSheet() {
    api("/api/team").then(function (t) {
      var role = t.me_role || "owner";
      var members = (t.members || []).map(function (m) { return m.name; }).join("、");
      var html = '<div class="muted">当前团队：<b>' + esc((t.workspaces[0] || {}).name || "") +
        "</b><br>成员：" + esc(members || "仅你一人") + "（" + (t.members || []).length + " 人）</div>" +
        (role === "owner"
          ? '<div class="actions"><button class="btn-gold" id="tm-invite">生成邀请码</button></div><div class="muted" id="tm-out" style="margin-top:10px"></div>'
          : '<div class="actions"><button class="btn-line" id="tm-leave" style="width:100%">退出团队</button></div>') +
        '<div class="field" style="margin-top:16px"><label>已注册同事，输入邀请码加入</label>' +
        '<input id="tm-code" placeholder="6 位邀请码"></div>' +
        '<div class="actions"><button class="btn-navy" id="tm-join">加入团队（数据共享）</button></div>';
      openSheet("团队与邀请", "同一账号体系，加入后共享方案、平台进度与待办", html);
      var inv = $("#tm-invite");
      if (inv) inv.onclick = function () {
        api("/api/team/invite", { method: "POST", body: JSON.stringify({ role: "member" }) })
          .then(function (r) {
            $("#tm-out").innerHTML = "邀请码 <b style=\"color:var(--warn)\">" + esc(r.code) +
              "</b><br>让同事在「我的 → 团队与邀请」输入即可，7 天有效。";
          }).catch(function (e) { toast(e.message, true); });
      };
      var lv = $("#tm-leave");
      if (lv) lv.onclick = function () {
        api("/api/team/leave", { method: "POST", body: "{}" }).then(function () {
          closeSheet(); toast("已退出团队"); loadAll().then(render);
        });
      };
      $("#tm-join").onclick = function () {
        api("/api/team/join", { method: "POST", body: JSON.stringify({ code: $("#tm-code").value.trim() }) })
          .then(function (r) {
            closeSheet();
            toast("已加入 " + (r.joined ? r.joined.owner_name : "团队") + "，数据已共享");
            loadAll().then(function () { render(); });
          }).catch(function (e) { toast(e.message, true); });
      };
    }).catch(function (e) { toast(e.message, true); });
  }

  function openTodoSheet() {
    api("/api/workhub").then(function (d) {
      var html = '<div class="muted">' + (d.connected
          ? "已绑定 " + d.bindings.map(function (b) { return b.provider; }).join("、")
          : "还没有绑定工作账号（飞书 / 企微 / 邮箱），绑定后待办会汇到这里") + "</div>" +
        '<div class="field" style="margin-top:14px"><label>绑定工作账号</label><input id="wh-acc" placeholder="账号，如 ops@company.com"></div>' +
        '<div class="actions"><button class="btn-line" id="wh-bind" style="width:100%">绑定</button></div>' +
        '<div class="sec" style="margin-top:18px"><h3>今日待办（' + d.tasks.length + "）</h3></div>" +
        d.tasks.map(function (t) {
          return '<div class="plat" style="margin-bottom:10px;padding:13px"><div class="tiny">' + esc(t.source) +
            '</div><div style="font-size:13.5px;font-weight:700;margin-top:4px">' + esc(t.title) +
            '</div><div class="tiny" style="margin-top:4px">' + esc(t.detail || "") + "</div></div>";
        }).join("");
      openSheet("今日待办", "由出海计划、平台进度与工作账号实时推导", html);
      $("#wh-bind").onclick = function () {
        api("/api/workhub/bind", {
          method: "POST",
          body: JSON.stringify({ provider: "邮箱", account: $("#wh-acc").value.trim() }),
        }).then(function () { closeSheet(); openTodoSheet(); toast("已绑定"); })
          .catch(function (e) { toast(e.message, true); });
      };
    }).catch(function (e) { toast(e.message, true); });
  }

  /* ══ 弹层 ══ */
  function openSheet(title, sub, html, noHead) {
    var sh = $("#sheet");
    var headHtml = noHead ? "" : '<div class="grab"></div>' +
      (title ? "<h3>" + esc(title) + "</h3>" : "") + (sub ? '<div class="sub">' + esc(sub) + "</div>" : "");
    sh.innerHTML = headHtml + html;
    $("#sheet-mask").classList.add("on");
    sh.classList.add("on");
  }
  function closeSheet() {
    $("#sheet-mask").classList.remove("on");
    $("#sheet").classList.remove("on");
  }
  $("#sheet-mask").onclick = closeSheet;

  bindChat();
  boot();
})();
