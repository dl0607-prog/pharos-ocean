/* PHAROS OCEAN · 手机端逻辑（与 PC 端共用同一后端与账号，数据实时互通） */
"use strict";

(function () {
  var TOKEN_KEY = "pharos_token";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var S = {
    token: localStorage.getItem(TOKEN_KEY) || "",
    user: null,
    agents: [],
    plan: null,
    platforms: [],
    team: null,
    tab: "home",
    agentFilter: "all",
    platFilter: "all",
    chatConv: null,
    chatAgent: null,
    sending: false,
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
    t.__timer = setTimeout(function () { t.className = "toast" + (bad ? " bad" : ""); }, 3000);
  }

  function api(path, opts) {
    var headers = { "Content-Type": "application/json" };
    if (S.token) headers["Authorization"] = "Bearer " + S.token;
    return fetch(path, Object.assign({ headers: headers }, opts || {})).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) {
        if (r.status === 401) {
          S.token = ""; localStorage.removeItem(TOKEN_KEY);
          showLogin(); throw new Error("登录已失效");
        }
        if (!r.ok) throw new Error((d && (d.detail || d.message)) || ("请求失败 " + r.status));
        return d;
      });
    });
  }

  /* ── Markdown 简化渲染 ── */
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
    t = t.replace(/\u0000(\d+)\u0000/g, function (m, i) { return blocks[+i]; });
    t = t.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
    return "<p>" + t + "</p>";
  }

  /* ══ 启动 → 登录 / 应用 ══ */
  function boot() {
    $("#splash-go").addEventListener("click", function () { enter(); });
    setTimeout(enter, 6000); // 兜底自动进入
    bindLogin();
  }

  function enter() {
    var sp = $("#splash");
    if (sp && !sp.classList.contains("fade")) {
      sp.classList.add("fade");
      setTimeout(function () { sp.classList.add("hidden"); }, 520);
    }
    if (S.token) {
      api("/api/auth/me").then(function (r) {
        S.user = r.user;
        startApp();
      }).catch(function () { showLogin(); });
    } else {
      showLogin();
    }
  }

  function showLogin() {
    $("#app").classList.add("hidden");
    $("#chat").classList.add("hidden");
    $("#login").classList.remove("hidden");
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
    };
    $("#to-login").onclick = function () {
      $("#form-register").classList.add("hidden");
      $("#form-login").classList.remove("hidden");
    };
    $("#form-login").onsubmit = function (e) {
      e.preventDefault();
      $("#lg-err").textContent = "";
      api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: $("#lg-user").value.trim(), password: $("#lg-pass").value }),
      }).then(function (r) {
        S.token = r.token; S.user = r.user;
        localStorage.setItem(TOKEN_KEY, r.token);
        startApp();
      }).catch(function (err) { $("#lg-err").textContent = err.message; });
    };
    $("#form-register").onsubmit = function (e) {
      e.preventDefault();
      $("#rg-err").textContent = "";
      if ($("#rg-pass").value !== $("#rg-pass2").value) { $("#rg-err").textContent = "两次密码不一致"; return; }
      if (!$("#rg-agree").checked) { $("#rg-err").textContent = "请先同意服务条款"; return; }
      api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: $("#rg-user").value.trim(),
          password: $("#rg-pass").value,
          company: $("#rg-company").value.trim(),
        }),
      }).then(function (r) {
        S.token = r.token; S.user = r.user;
        localStorage.setItem(TOKEN_KEY, r.token);
        startApp();
      }).catch(function (err) { $("#rg-err").textContent = err.message; });
    };
  }

  /* ══ 主应用 ══ */
  function startApp() {
    $("#login").classList.add("hidden");
    $("#app").classList.remove("hidden");
    bindTabs();
    loadAll().then(function () { render(); });
  }

  function bindTabs() {
    $$(".tab").forEach(function (b) {
      b.onclick = function () {
        S.tab = b.getAttribute("data-tab");
        $$(".tab").forEach(function (x) { x.classList.toggle("on", x === b); });
        render();
        $("#page").scrollTop = 0;
      };
    });
    $("#bell").onclick = openNotifications;
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

  function render() {
    var p = $("#page");
    if (S.tab === "home") p.innerHTML = viewHome();
    else if (S.tab === "agents") p.innerHTML = viewAgents();
    else if (S.tab === "platforms") p.innerHTML = viewPlatforms();
    else if (S.tab === "project") p.innerHTML = viewProject();
    else p.innerHTML = viewMe();
    bindPage();
  }

  /* ── 进度计算 ── */
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
    return { items: items, done: done, total: items.length, pct: Math.round(done / items.length * 100) };
  }

  function ringSvg(pct) {
    var R = 34, C = 2 * Math.PI * R;
    return '<svg width="84" height="84" viewBox="0 0 84 84">' +
      '<defs><linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#ffe0b0"/><stop offset="100%" stop-color="#f2b26c"/></linearGradient></defs>' +
      '<circle class="bg" cx="42" cy="42" r="' + R + '"/>' +
      '<circle class="fg" cx="42" cy="42" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + C.toFixed(1) + '" data-off="' + (C * (1 - pct / 100)).toFixed(1) + '"/>' +
      "</svg>";
  }

  /* ══ 首页 ══ */
  function viewHome() {
    var pg = progress();
    var name = (S.user && S.user.username) || "商家";
    var company = (S.user && S.user.company) || (S.team && S.team.workspaces[0] && S.team.workspaces[0].name) || "";
    var projects = (S.team && S.team.projects) || [];
    var r = (S.plan && S.plan.result) || null;
    var nextSteps = (r && r.next_steps) || [];

    return '' +
      '<div class="greet"><h1>早上好，' + esc(name) + '</h1>' +
      '<p>' + esc(company || "让世界看见你的好产品") + '</p></div>' +

      '<div class="card">' +
      '<div class="overview">' +
      '<div class="ring">' + ringSvg(pg.pct) + '<div class="pct">' + pg.pct + '%</div></div>' +
      '<div class="ov-main"><div class="num">出海总览 ' + pg.done + '/' + pg.total + '</div>' +
      '<div class="lbl">' + (pg.done === pg.total ? "全部完成，继续冲首单" : "完成全部步骤还有 " + (pg.total - pg.done) + " 步") + '</div></div>' +
      '</div>' +
      '<ul class="steps">' + pg.items.map(function (i) {
        var cls = i.done ? "done" : (i.doing ? "doing" : "");
        var st = i.done ? "✓ 已完成" : (i.doing ? "进行中" : "待开始");
        return '<li class="' + cls + '"><span class="ic">' + (i.done ? "✓" : "•") + "</span>" +
          '<span class="t">' + esc(i.k) + '</span><span class="st">' + st + "</span></li>";
      }).join("") + "</ul>" +
      '<button class="btn-gold full" id="go-launch" style="margin-top:16px">' +
      (r ? "继续出海计划 →" : "开始出海计划 →") + "</button>" +
      "</div>" +

      (nextSteps.length
        ? '<div class="sec-title"><h3>AI 建议</h3></div><div class="card">' +
          nextSteps.slice(0, 3).map(function (x) {
            return '<div class="muted" style="margin-bottom:8px">✦ ' + esc(x) + "</div>";
          }).join("") + "</div>"
        : "") +

      '<div class="sec-title"><h3>我的项目</h3><button class="more" id="go-project">查看全部 ›</button></div>' +
      '<div class="proj-row">' +
      (projects.length ? projects.map(function (p, i) {
        return '<div class="card proj-card"><div class="thumb">' + (i === 0 ? "🎧" : "📦") + '</div>' +
          '<div class="nm">' + esc(p.name) + '</div>' +
          '<div class="meta"><span class="tag ' + (i === 0 && pg.done > 0 ? "warn" : "") + '">' +
          (i === 0 && pg.done > 0 ? "进行中" : "规划中") + "</span>" +
          '<span>' + esc(p.market || "美国") + "</span></div></div>";
      }).join("")
        : '<div class="card proj-card"><div class="thumb">🚀</div><div class="nm">还没有项目</div>' +
          '<div class="meta"><span class="tag">去出海启动创建</span></div></div>') +
      "</div>" +

      '<div class="sec-title"><h3>快捷工具</h3></div>' +
      '<div class="agent-grid">' +
      [["市场分析", "📊", "market"], ["选品分析", "🔍", "insight"], ["内容营销", "✍️", "copy"], ["数据分析", "📈", "growth"]]
        .map(function (x) {
          return '<button class="agent-card" data-quick="' + x[2] + '"><div class="ic">' + x[1] + '</div>' +
            '<div class="nm">' + x[0] + "</div><div class=\"ds\">打开对应智能体</div></button>";
        }).join("") +
      "</div>";
  }

  /* ══ 智能体 ══ */
  var GROUPS = [
    { id: "all", t: "全部" },
    { id: "core", t: "核心" },
    { id: "business", t: "业务" },
  ];

  function viewAgents() {
    var list = S.agents.filter(function (a) {
      return S.agentFilter === "all" || a.group === S.agentFilter;
    });
    return '<div class="greet" style="padding-top:4px"><h1>AI 智能体</h1>' +
      '<p>8 位出海专家，随时待命</p></div>' +
      '<div class="searchbox">🔍<input id="agent-search" placeholder="搜索智能体…"></div>' +
      '<div class="pills">' + GROUPS.map(function (g) {
        return '<button class="pill ' + (S.agentFilter === g.id ? "on" : "") + '" data-g="' + g.id + '">' + g.t + "</button>";
      }).join("") + "</div>" +
      '<div class="agent-grid">' + list.map(function (a) {
        return '<button class="agent-card" data-agent="' + esc(a.id) + '">' +
          '<div class="ic">' + esc(a.ico) + "</div>" +
          '<div class="nm">' + esc(a.name) + "</div>" +
          '<div class="ds">' + esc(a.desc) + "</div></button>";
      }).join("") + "</div>";
  }

  /* ══ 平台 ══ */
  function viewPlatforms() {
    var list = S.platforms.filter(function (p) {
      var on = p.status && p.status !== "none";
      if (S.platFilter === "on") return on;
      if (S.platFilter === "off") return !on;
      return true;
    });
    var connected = S.platforms.filter(function (p) { return p.status && p.status !== "none"; }).length;
    return '<div class="greet" style="padding-top:4px"><h1>平台对接</h1>' +
      '<p>已对接 ' + connected + " / " + S.platforms.length + ' 个平台</p></div>' +
      '<div class="pills">' +
      [["all", "全部"], ["on", "已对接"], ["off", "未对接"]].map(function (x) {
        return '<button class="pill ' + (S.platFilter === x[0] ? "on" : "") + '" data-pf="' + x[0] + '">' + x[1] + "</button>";
      }).join("") + "</div>" +
      list.map(function (p) {
        var st = p.status || "none";
        var cls = st === "opened" ? "ok" : (st === "none" ? "" : "warn");
        var txt = { none: "未对接", preparing: "准备中", submitted: "已提交", opened: "已开通" }[st] || st;
        return '<button class="plat-item" data-plat="' + esc(p.id) + '">' +
          '<span class="ic">' + esc(p.ico) + "</span>" +
          "<span><span class=\"nm\">" + esc(p.name) + '</span><span class="rg" style="display:block">' + esc(p.region) + "</span></span>" +
          '<span class="st"><span class="tag ' + cls + '">' + txt + "</span></span></button>";
      }).join("");
  }

  /* ══ 项目 ══ */
  function viewProject() {
    var pg = progress();
    var r = (S.plan && S.plan.result) || null;
    var projects = (S.team && S.team.projects) || [];
    var p0 = projects[0] || { name: "第一个出海项目", market: "美国" };
    var firstOrder = !!(S.plan && S.plan.first_order);
    var ms = (r && r.milestones) || [];
    var risks = (r && r.risks) || [];

    return '<div class="greet" style="padding-top:4px"><h1>项目详情</h1><p>进度与阶段计划</p></div>' +
      '<div class="card"><div class="proj-hero">' +
      '<div class="thumb">🎧</div>' +
      '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:650">' + esc(p0.name) + "</div>" +
      '<div class="tiny" style="margin-top:4px">' + esc(p0.market || "美国") + " · " + esc(p0.platform || "待定") + "</div>" +
      '<div class="bar" style="margin-top:10px"><i style="width:' + pg.pct + '%"></i></div>' +
      '<div class="tiny" style="margin-top:6px">' + pg.done + " / " + pg.total + " 步 · " + pg.pct + "%</div></div></div></div>" +

      '<div class="sec-title"><h3>阶段计划</h3></div>' +
      (ms.length
        ? '<div class="card">' + ms.map(function (m, i) {
            return '<div style="margin-bottom:14px"><div style="font-size:13.5px;font-weight:650;margin-bottom:6px">' +
              (i + 1) + ". " + esc(m.phase || "") + "</div>" +
              (m.tasks || []).map(function (t) {
                return '<div class="muted" style="padding-left:2px">▸ ' + esc(t) + "</div>";
              }).join("") + "</div>";
          }).join("") + "</div>"
        : '<div class="card"><div class="muted">还没有生成方案。点下面按钮完成出海计划，AI 会给你阶段任务。</div>' +
          '<button class="btn-gold full" id="go-launch2" style="margin-top:14px">去完成出海计划</button></div>') +

      (risks.length
        ? '<div class="sec-title"><h3>风险提示</h3></div><div class="card">' +
          risks.map(function (x) { return '<div class="muted" style="margin-bottom:6px">⚠️ ' + esc(x) + "</div>"; }).join("") + "</div>"
        : "") +

      '<div class="sec-title"><h3>里程碑</h3></div>' +
      '<div class="card"><div style="display:flex;align-items:center;gap:10px">' +
      '<span style="font-size:20px">' + (firstOrder ? "🏆" : "🎯") + "</span>" +
      '<div style="flex:1"><div style="font-size:13.5px;font-weight:650">完成首次出单</div>' +
      '<div class="tiny">' + (firstOrder ? "已达成，恭喜出海第一步！" : "方案落地后标记完成") + "</div></div>" +
      (firstOrder
        ? '<span class="tag ok">已达成</span>'
        : '<button class="btn-ghost" id="mark-order">标记完成</button>') +
      "</div></div>";
  }

  /* ══ 我的 ══ */
  function viewMe() {
    var name = (S.user && S.user.username) || "商家";
    var company = (S.user && S.user.company) || "";
    return '<div class="me-head"><div class="me-avatar">🧑</div>' +
      '<div><div class="nm">' + esc(name) + '</div><div class="sub">' + esc(company || "个人版") + '</div></div>' +
      '<span class="tag warn" style="margin-left:auto">专业版</span></div>' +

      '<div class="menu" style="margin-bottom:14px">' +
      '<button id="me-project">▤ 我的项目<span class="ar">›</span></button>' +
      '<button id="me-ai">⚙ AI 服务设置<span class="sub" id="ai-state">检查中…</span></button>' +
      '<button id="me-notify">🔔 消息通知<span class="sub">' + (notifList().length || "无") + " 条</span></button>" +
      "</div>" +

      '<div class="menu" style="margin-bottom:14px">' +
      '<button id="me-sync">☁ 数据同步<span class="sub" style="color:var(--ok)">已连接</span></button>' +
      '<button id="me-desktop">🖥 桌面版<span class="ar">›</span></button>' +
      '<button id="me-help">❓ 帮助中心<span class="ar">›</span></button>' +
      "</div>" +

      '<button class="btn-ghost" id="me-logout" style="width:100%;color:var(--bad);border-color:rgba(255,155,134,.3)">退出登录</button>' +
      '<p class="tiny" style="text-align:center;margin-top:18px">PHAROS OCEAN · v2.0 · 数据存于你的服务器</p>';
  }

  /* ══ 页面事件 ══ */
  function bindPage() {
    var p = $("#page");
    var gl = $("#go-launch", p) || $("#go-launch2", p);
    if (gl) gl.onclick = openWizard;
    var gp = $("#go-project", p);
    if (gp) gp.onclick = function () { switchTab("project"); };

    $$("[data-agent]", p).forEach(function (b) {
      b.onclick = function () { openChat(b.getAttribute("data-agent")); };
    });
    $$("[data-quick]", p).forEach(function (b) {
      b.onclick = function () { openChat(b.getAttribute("data-quick")); };
    });
    $$("[data-g]", p).forEach(function (b) {
      b.onclick = function () { S.agentFilter = b.getAttribute("data-g"); render(); };
    });
    var search = $("#agent-search", p);
    if (search) {
      search.addEventListener("input", function () {
        var q = search.value.trim();
        $$("[data-agent]", p).forEach(function (b) {
          var a = S.agents.filter(function (x) { return x.id === b.getAttribute("data-agent"); })[0] || {};
          var hit = !q || (a.name || "").indexOf(q) >= 0 || (a.desc || "").indexOf(q) >= 0;
          b.style.display = hit ? "" : "none";
        });
      });
    }
    $$("[data-pf]", p).forEach(function (b) {
      b.onclick = function () { S.platFilter = b.getAttribute("data-pf"); render(); };
    });
    $$("[data-plat]", p).forEach(function (b) {
      b.onclick = function () { openPlatform(b.getAttribute("data-plat")); };
    });
    var mo = $("#mark-order", p);
    if (mo) mo.onclick = function () {
      if (!confirm("标记「完成首次出单」？")) return;
      api("/api/launch/first-order", { method: "POST", body: JSON.stringify({ done: true }) })
        .then(function () { toast("🏆 恭喜！首次出单里程碑达成"); loadAll().then(render); })
        .catch(function (e) { toast(e.message, true); });
    };
    var mp = $("#me-project", p);
    if (mp) mp.onclick = function () { switchTab("project"); };
    var mai = $("#me-ai", p);
    if (mai) mai.onclick = openAiSettings;
    var mn = $("#me-notify", p);
    if (mn) mn.onclick = openNotifications;
    var ms = $("#me-sync", p);
    if (ms) ms.onclick = function () { loadAll().then(function () { toast("已与服务器同步"); render(); }); };
    var md = $("#me-desktop", p);
    if (md) md.onclick = function () { location.href = "/?desktop=1"; };
    var mh = $("#me-help", p);
    if (mh) mh.onclick = function () {
      openSheet("帮助中心", "", '<div class="muted">1. 先点「AI 服务设置」填入你的 API Key<br>' +
        "2. 打开「AI 智能体」随时问出海问题<br>" +
        "3. 首页「开始出海计划」填 4 步资料，AI 生成方案<br>" +
        "4. 平台对接里记录进度、拿 AI 入驻指南<br><br>PC 端与手机端登录同一账号，数据实时互通。</div>");
    };
    var ml = $("#me-logout", p);
    if (ml) ml.onclick = function () {
      if (!confirm("退出登录？")) return;
      api("/api/auth/logout", { method: "POST", body: "{}" }).catch(function () {});
      S.token = ""; localStorage.removeItem(TOKEN_KEY); S.user = null;
      showLogin();
    };
    checkAiState();
    var fg = $(".ring .fg", p);
    if (fg) requestAnimationFrame(function () { fg.style.strokeDashoffset = fg.getAttribute("data-off"); });
  }

  function switchTab(t) {
    S.tab = t;
    $$(".tab").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-tab") === t); });
    render();
    $("#page").scrollTop = 0;
  }

  /* ══ 聊天 ══ */
  function openChat(agentId) {
    var a = S.agents.filter(function (x) { return x.id === agentId; })[0] || S.agents[0] || { id: "command", name: "智能体", desc: "" };
    S.chatAgent = a;
    S.chatConv = null;
    $("#chat-name").textContent = a.ico + " " + a.name;
    $("#chat-desc").textContent = a.desc || "";
    $("#chat").classList.remove("hidden");
    var body = $("#chat-body");
    body.innerHTML = '<div class="msg"><div class="av">⚓</div><div class="bub">' +
      "你好，我是「" + esc(a.name) + "」。" + esc(a.desc || "") +
      (a.suggestions && a.suggestions.length ? "<br><br>可以试试：<br>" + a.suggestions.map(function (s) { return "• " + esc(s); }).join("<br>") : "") +
      "</div></div>";
    $("#chat-text").value = "";
    $("#chat-text").focus();
  }

  $("#chat-back") && ($("#chat-back").onclick = function () { $("#chat").classList.add("hidden"); });

  function bindChat() {
    $("#chat-back").onclick = function () { $("#chat").classList.add("hidden"); };
    $("#chat-clear").onclick = function () { S.chatConv = null; openChat(S.chatAgent ? S.chatAgent.id : "command"); };
    $("#chat-send").onclick = sendChat;
    $("#chat-text").addEventListener("input", function () {
      var el = this; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 110) + "px";
    });
    $("#chat-text").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });
  }

  function pushMsg(role, text, isErr) {
    var body = $("#chat-body");
    var d = document.createElement("div");
    d.className = "msg" + (role === "user" ? " me" : "");
    d.innerHTML = '<div class="av">' + (role === "user" ? "🧑" : (isErr ? "⚠️" : "⚓")) + "</div>" +
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
      if (!resp.ok) {
        return resp.json().then(function (d) { throw new Error((d && d.detail) || "发送失败"); });
      }
      var reader = resp.body.getReader();
      var dec = new TextDecoder();
      var full = "", buf = "";
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            bub.innerHTML = md(full || "（AI 没有返回内容，请重试）");
            S.sending = false;
            return;
          }
          buf += dec.decode(r.value, { stream: true });
          var idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            var chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
            chunk.split("\n").forEach(function (line) {
              if (line.indexOf("data:") !== 0) return;
              var ev; try { ev = JSON.parse(line.slice(5).trim()); } catch (e) { return; }
              if (ev.type === "token") {
                full += ev.text;
                bub.innerHTML = md(full) + '<span class="typing"><i></i><i></i><i></i></span>';
                $("#chat-body").scrollTop = $("#chat-body").scrollHeight;
              } else if (ev.type === "error") {
                throw new Error(ev.message || "AI 服务异常");
              }
            });
          }
          return pump();
        });
      }
      return pump();
    }).catch(function (err) {
      bub.innerHTML = "⚠️ " + esc(err.message || "网络异常");
      S.sending = false;
      if (String(err.message).indexOf("尚未配置") >= 0) {
        setTimeout(function () {
          if (confirm("还没配置 AI 服务，现在去配置？")) openAiSettings();
        }, 300);
      }
    });
  }

  function ensureConv() {
    if (S.chatConv) return Promise.resolve(S.chatConv);
    return api("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ agent_id: S.chatAgent ? S.chatAgent.id : "command" }),
    }).then(function (r) { S.chatConv = r.id; return r.id; });
  }

  /* ══ 平台详情 ══ */
  function openPlatform(pid) {
    var p = S.platforms.filter(function (x) { return x.id === pid; })[0];
    if (!p) return;
    var sts = [["none", "未对接"], ["preparing", "准备中"], ["submitted", "已提交"], ["opened", "已开通"]];
    var html = '<div class="chips" id="plat-st">' + sts.map(function (s) {
      return '<button class="chip ' + ((p.status || "none") === s[0] ? "on" : "") + '" data-s="' + s[0] + '">' + s[1] + "</button>";
    }).join("") + "</div>" +
      '<div class="field"><label>店铺链接（开店后填写）</label><input id="plat-url" placeholder="https://…" value="' + esc(p.store_url || "") + '"></div>' +
      '<div class="muted" style="margin:8px 0 4px"><b>入驻要求</b><br>' + (p.entry || []).map(function (e) { return "• " + esc(e); }).join("<br>") + "</div>" +
      '<div class="muted" style="margin-top:8px"><b>适合谁</b><br>' + esc(p.fit || "") + "</div>" +
      '<div class="actions"><button class="btn-gold" id="plat-save">保存进度</button>' +
      '<button class="btn-ghost" id="plat-guide">🤖 AI 入驻指南</button></div>';
    openSheet(p.ico + " " + p.name, p.region + " · " + p.mode, html);
    var chosen = p.status || "none";
    $$("#plat-st .chip").forEach(function (c) {
      c.onclick = function () {
        chosen = c.getAttribute("data-s");
        $$("#plat-st .chip").forEach(function (x) { x.classList.toggle("on", x === c); });
      };
    });
    $("#plat-save").onclick = function () {
      api("/api/launch/platforms/" + pid, {
        method: "PUT",
        body: JSON.stringify({ status: chosen, store_url: $("#plat-url").value.trim() }),
      }).then(function () {
        closeSheet();
        toast("已保存");
        loadAll().then(render);
      }).catch(function (e) { toast(e.message, true); });
    };
    $("#plat-guide").onclick = function () {
      $("#sheet").innerHTML = '<div class="grab"></div><h3>AI 入驻指南</h3>' +
        '<div class="sub">' + esc(p.name) + " · 结合你的资料生成</div>" +
        '<div class="muted" id="guide-body"><span class="typing"><i></i><i></i><i></i></span> 生成中…</div>';
      api("/api/launch/platforms/" + pid + "/guide", { method: "POST", body: "{}" }).then(function (r) {
        var g = r.guide || {};
        var html = "";
        if (g.overview) html += '<div class="muted" style="margin-bottom:12px">' + esc(g.overview) + "</div>";
        if ((g.requirements || []).length) html += '<div style="font-size:13px;font-weight:650;margin:10px 0 6px">需要准备</div>' +
          g.requirements.map(function (x) { return '<div class="muted">• ' + esc(x) + "</div>"; }).join("");
        if ((g.steps || []).length) html += '<div style="font-size:13px;font-weight:650;margin:12px 0 6px">入驻步骤</div>' +
          g.steps.map(function (s, i) { return '<div class="muted" style="margin-bottom:8px"><b>' + (i + 1) + ". " + esc(s.step) + "</b><br>" + esc(s.detail) + "</div>"; }).join("");
        if (g.timeline) html += '<div class="muted" style="margin-top:10px">⏱ 预计周期：' + esc(g.timeline) + "</div>";
        if ((g.pitfalls || []).length) html += '<div style="font-size:13px;font-weight:650;margin:12px 0 6px">避坑</div>' +
          g.pitfalls.map(function (x) { return '<div class="muted">⚠️ ' + esc(x) + "</div>"; }).join("");
        $("#guide-body").innerHTML = html || "暂无内容";
      }).catch(function (e) {
        $("#guide-body").innerHTML = "⚠️ " + esc(e.message);
        if (String(e.message).indexOf("尚未配置") >= 0) toast("请先在「我的 → AI 服务设置」填 API Key", true);
      });
    };
  }

  /* ══ 出海向导（4 步） ══ */
  var WIZ = ["商家情况", "产品信息", "目标市场", "确认生成"];
  var wiz = null;

  function openWizard() {
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
    var step = wiz.step;
    var body = "";
    if (step === 1) {
      body += '<div class="field"><label>公司类型</label></div>' + chipRow("company_type", [["factory", "🏭 工厂"], ["trader", "📦 贸易商"], ["brand", "🏷️ 品牌商"], ["individual", "🧑 个人卖家"]]);
      body += '<div class="field"><label>营业执照</label></div>' + chipRow("has_license", [["1", "✅ 有"], ["0", "暂无"]]);
      body += '<div class="field"><label>注册商标</label></div>' + chipRow("has_brand", [["1", "✅ 有"], ["0", "暂无"]]);
      body += '<div class="field"><label>出海经验</label></div>' + chipRow("experience", [["none", "🌱 无经验"], ["domestic", "🏪 国内电商"], ["cross", "🌍 有跨境经验"]]);
      body += '<div class="field"><label>启动预算</label></div>' + chipRow("budget", [["lt3", "3万以下"], ["3-10", "3-10万"], ["10-30", "10-30万"], ["gt30", "30万以上"]]);
      body += '<div class="field"><label>团队规模</label></div>' + chipRow("team", [["1", "1人"], ["2-5", "2-5人"], ["6-20", "6-20人"], ["gt20", "20人以上"]]);
    } else if (step === 2) {
      var cats = ["请选择品类", "消费电子", "家居生活", "服装服饰", "美妆个护", "运动户外", "宠物用品", "母婴玩具", "汽摩配件", "工业用品", "食品饮料", "其他"];
      body += '<div class="field"><label>主营品类</label><select id="w-cat">' +
        cats.map(function (c) { return '<option value="' + esc(c) + '"' + ((wiz.answers.category || "请选择品类") === c ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") +
        "</select></div>";
      body += '<div class="field"><label>产品介绍</label><input id="w-prod" placeholder="是什么、卖给谁、凭什么赢" value="' + esc(wiz.answers.product || "") + '"></div>';
      body += '<div class="field"><label>客单价</label></div>' + chipRow("price", [["lt50", "50元以下"], ["50-150", "50-150元"], ["150-500", "150-500元"], ["gt500", "500元以上"]]);
      body += '<div class="field"><label>供应链</label></div>' + chipRow("supply", [["factory", "🏭 自有工厂"], ["stable", "🤝 稳定货源"], ["seeking", "🔎 需要找货"]]);
      body += '<div class="field"><label>已有认证（选填）</label><input id="w-certs" placeholder="如 CE、FCC" value="' + esc(wiz.answers.certs || "") + '"></div>';
    } else if (step === 3) {
      body += '<div class="field"><label>目标市场（可多选）</label></div>' +
        chipRow("markets", [["us", "🇺🇸 美国"], ["eu", "🇪🇺 欧洲"], ["sea", "🌏 东南亚"], ["me", "🕌 中东"], ["latam", "🌎 拉美"], ["jpkr", "🗾 日韩"], ["other", "🌍 其他"]], true);
      body += '<div class="field"><label>首选市场</label><select id="w-first">' +
        ["美国", "欧洲", "东南亚", "中东", "拉美", "日韩", "其他"].map(function (m) {
          return '<option value="' + m + '"' + ((wiz.answers.first_market || "美国") === m ? " selected" : "") + ">" + m + "</option>";
        }).join("") + "</select></div>";
    } else {
      var LBL = {
        company_type: { factory: "工厂", trader: "贸易商", brand: "品牌商", individual: "个人卖家" },
        budget: { lt3: "3万以下", "3-10": "3-10万", "10-30": "10-30万", gt30: "30万以上" },
        markets: { us: "美国", eu: "欧洲", sea: "东南亚", me: "中东", latam: "拉美", jpkr: "日韩", other: "其他" },
      };
      var lab = function (k, v) { return (LBL[k] && LBL[k][v]) || v || "-"; };
      body += '<div class="muted" style="line-height:1.9">' +
        "公司：<b>" + esc(lab("company_type", wiz.answers.company_type)) + "</b> · 预算：<b>" + esc(lab("budget", wiz.answers.budget)) + "</b><br>" +
        "品类：<b>" + esc(wiz.answers.category || "-") + "</b><br>" +
        "产品：<b>" + esc(wiz.answers.product || "-") + "</b><br>" +
        "市场：<b>" + esc((wiz.answers.markets || []).map(function (m) { return lab("markets", m); }).join("、") || "-") + "</b>（首选 " + esc(wiz.answers.first_market || "美国") + "）</div>" +
        '<div class="muted" style="margin-top:14px">确认后点「生成我的出海方案」，AI 会给出首选平台、阶段任务、预算、资质与风险。</div>';
    }
    var html = '<div class="grab"></div>' +
      '<h3>出海启动 · ' + WIZ[step - 1] + "</h3>" +
      '<div class="sub">第 ' + step + " 步，共 4 步</div>" +
      '<div class="pills" style="margin-bottom:14px">' + WIZ.map(function (t, i) {
        var n = i + 1;
        return '<span class="pill ' + (n === step ? "on" : "") + '" style="opacity:' + (n < step ? ".7" : "1") + '">' + (n < step ? "✓ " : "") + n + ". " + t + "</span>";
      }).join("") + "</div>" +
      body +
      '<div class="actions">' +
      (step > 1 ? '<button class="btn-ghost" id="w-prev">上一步</button>' : "") +
      (step < 4 ? '<button class="btn-gold" id="w-next">下一步</button>' : '<button class="btn-gold" id="w-gen">⚡ 生成方案</button>') +
      "</div>";
    openSheet(null, null, html, true);
    var wrap = $("#sheet");
    $$(".chips", wrap).forEach(function (row) {
      var key = row.getAttribute("data-key");
      var multi = row.getAttribute("data-multi") === "1";
      $$(".chip", row).forEach(function (c) {
        c.onclick = function () {
          var v = c.getAttribute("data-v");
          if (multi) {
            var arr = (wiz.answers[key] || []).slice();
            var i = arr.indexOf(v);
            if (i >= 0) arr.splice(i, 1); else arr.push(v);
            wiz.answers[key] = arr;
            c.classList.toggle("on");
          } else {
            wiz.answers[key] = v;
            $$(".chip", row).forEach(function (x) { x.classList.toggle("on", x === c); });
          }
        };
      });
    });
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
      '<div class="muted" id="gen-tip" style="padding:8px 0"><span class="typing"><i></i><i></i><i></i></span> AI 正在生成方案，约 30-60 秒…</div>');
    api("/api/launch/plan", {
      method: "PUT",
      body: JSON.stringify({ step: 4, answers: wiz.answers }),
    }).then(function () {
      return api("/api/launch/generate", { method: "POST", body: "{}" });
    }).then(function () {
      closeSheet();
      toast("出海方案已生成 🎉");
      loadAll().then(function () { switchTab("project"); });
    }).catch(function (e) {
      var tip = $("#gen-tip");
      if (tip) tip.innerHTML = "⚠️ " + esc(e.message);
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

  function checkAiState() {
    api("/api/settings").then(function (s) {
      var el = $("#ai-state");
      if (el) el.textContent = s.llm_configured ? "已配置" : "未配置";
      if (el) el.style.color = s.llm_configured ? "var(--ok)" : "var(--warn)";
    }).catch(function () {});
  }

  function openAiSettings() {
    api("/api/settings").then(function (s) {
      var html = '<div class="chips" id="ai-presets">' + PRESETS.map(function (p) {
        return '<button class="chip" data-b="' + esc(p[1]) + '" data-m="' + esc(p[2]) + '">' + p[0] + "</button>";
      }).join("") + "</div>" +
        '<div class="field"><label>接口地址 Base URL</label><input id="ai-base" value="' + esc(s.llm_base_url || "") + '" placeholder="https://api.deepseek.com/v1"></div>' +
        '<div class="field"><label>API Key</label><input id="ai-key" type="password" placeholder="' + (s.llm_configured ? "已配置（留空不变）" : "sk-…") + '"></div>' +
        '<div class="field"><label>模型</label><input id="ai-model" value="' + esc(s.llm_model || "") + '" placeholder="deepseek-chat"></div>' +
        '<div class="actions"><button class="btn-gold" id="ai-save">保存并测试</button></div>' +
        '<p class="tiny" style="margin-top:10px">配置保存在你的服务器，PC 端与手机端共用。</p>';
      openSheet("AI 服务设置", "支持 DeepSeek / 智谱 / 通义 / Kimi / 硅基流动等 OpenAI 兼容接口", html, true);
      $$("#ai-presets .chip").forEach(function (c) {
        c.onclick = function () {
          $("#ai-base").value = c.getAttribute("data-b");
          $("#ai-model").value = c.getAttribute("data-m");
          $$("#ai-presets .chip").forEach(function (x) { x.classList.toggle("on", x === c); });
        };
      });
      $("#ai-save").onclick = function () {
        $("#ai-save").disabled = true;
        api("/api/settings", {
          method: "POST",
          body: JSON.stringify({
            llm_base_url: $("#ai-base").value.trim(),
            llm_api_key: $("#ai-key").value.trim(),
            llm_model: $("#ai-model").value.trim(),
          }),
        }).then(function () {
          return api("/api/settings/test", { method: "POST", body: "{}" });
        }).then(function (r) {
          closeSheet();
          toast("连接成功：" + String(r.reply || "OK").slice(0, 20));
          checkAiState();
        }).catch(function (e) {
          $("#ai-save").disabled = false;
          toast(e.message, true);
        });
      };
    }).catch(function (e) { toast(e.message, true); });
  }

  /* ══ 通知 ══ */
  function notifList() {
    var out = [];
    var pg = progress();
    if (S.plan && S.plan.result) out.push(["🎯", "出海方案已生成", "查看阶段计划与预算", "项目"]);
    if (pg.items[2].done) out.push(["🔗", "已开始平台对接", "记录进度可获取 AI 入驻指南", "平台"]);
    if (S.plan && S.plan.first_order) out.push(["🏆", "首次出单已达成", "恭喜完成出海第一步", "项目"]);
    var connected = S.platforms.filter(function (p) { return p.status && p.status !== "none"; }).length;
    if (connected) out.push(["☁", "数据已同步", connected + " 个平台状态已保存到服务器", "同步"]);
    if (!out.length) out.push(["👋", "欢迎使用 PHAROS OCEAN", "点下方按钮开始你的出海计划", "新手"]);
    return out;
  }

  function openNotifications() {
    var list = notifList();
    openSheet("消息通知", "全部标记为已读", list.map(function (n) {
      return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid rgba(247,241,228,.07)">' +
        '<span style="font-size:20px">' + n[0] + "</span>" +
        '<div style="flex:1"><div style="font-size:13.5px;font-weight:600">' + esc(n[1]) + "</div>" +
        '<div class="tiny" style="margin-top:3px">' + esc(n[2]) + "</div></div>" +
        '<span class="tag">' + esc(n[3]) + "</span></div>";
    }).join(""));
  }

  /* ══ 弹层控制 ══ */
  function openSheet(title, sub, html, noHead) {
    var sh = $("#sheet");
    var head = noHead ? "" : '<div class="grab"></div>' +
      (title ? "<h3>" + esc(title) + "</h3>" : "") +
      (sub ? '<div class="sub">' + esc(sub) + "</div>" : "");
    sh.innerHTML = head + html;
    $("#sheet-mask").classList.add("on");
    sh.classList.add("on");
  }

  function closeSheet() {
    $("#sheet-mask").classList.remove("on");
    $("#sheet").classList.remove("on");
  }

  $("#sheet-mask") && ($("#sheet-mask").onclick = closeSheet);

  /* ── 初始化 ── */
  bindChat();
  boot();
})();
