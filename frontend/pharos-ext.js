/* PHAROS 出海工作台 · 扩展层
   在原版应用（原版单文件工作台）之上叠加，不改动原版任何布局与交互：
     · 账号门槛：注册 / 登录后才可进入（公司级产品的常规流程）
     · AI 配置双向同步：应用内 ⚙ 保存 → 同步到服务器；服务器已配置 → 自动下发到浏览器
     · 出海启动：填资料 → AI 生成专属出海方案（前后端）
     · 平台对接：8 大海外平台进度管理 + AI 定制入驻指南
   视觉全部复用原版设计语言（白玻璃卡片 / 药丸按钮 / 圆角 / 项目色）。 */
"use strict";

(function () {
  var TOKEN_KEY = "pharos_token";
  var CFG_KEY = "yhxd_llm_cfg_v2";
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }
  function setToken(t) {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }

  /* ── Toast（扩展层自己的提示，避免污染原版提示） ── */
  function toast(msg, kind) {
    var box = $("#phx-toasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "phx-toasts";
      document.body.appendChild(box);
    }
    var el = document.createElement("div");
    el.className = "phx-toast" + (kind ? " " + kind : "");
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
  }

  /* ── 弹窗容器(按需创建,不依赖页面结构) ── */
  function closeModal() {
    var mask = document.getElementById("mask");
    if (mask) mask.classList.remove("show");
    var wrap = document.getElementById("modal-wrap");
    if (wrap) wrap.innerHTML = "";
  }

  function openModal(html, wide) {
    closeModal();
    var wrap = document.getElementById("modal-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "modal-wrap";
      document.body.appendChild(wrap);
    }
    var mask = document.getElementById("mask");
    if (!mask) {
      mask = document.createElement("div");
      mask.id = "mask";
      document.body.appendChild(mask);
    }
    var m = document.createElement("div");
    m.className = "modal" + (wide ? " wide" : "");
    m.innerHTML = html;
    wrap.appendChild(m);
    mask.classList.add("show");
    requestAnimationFrame(function () { m.classList.add("show"); });
    var closeBtn = $(".modal-close", m);
    if (closeBtn) closeBtn.onclick = closeModal;
    mask.onclick = closeModal;
    return m;
  }

  /* ── API（带登录态） ── */
  function api(path, opts) {
    var headers = { "Content-Type": "application/json" };
    if (token()) headers["Authorization"] = "Bearer " + token();
    return fetch(path, Object.assign({ headers: headers }, opts || {})).then(function (resp) {
      return resp.json().catch(function () { return null; }).then(function (data) {
        if (resp.status === 401) {
          setToken("");
          showGate();
          var e401 = new Error("登录已失效，请重新登录");
          e401.unauthorized = true;
          throw e401;
        }
        if (!resp.ok) {
          var msg = (data && (data.detail || data.message)) || ("请求失败 HTTP " + resp.status);
          var err = new Error(msg);
          err.notConfigured = msg.indexOf("尚未配置") >= 0;
          throw err;
        }
        return data;
      });
    });
  }

  /* ══════════════ 1. 登录门槛 ══════════════ */

  var gateEl = null;

  function gateMarkup() {
    return '' +
      '<div class="phx-gate-card" role="dialog" aria-label="登录 PHAROS 出海工作台">' +
      '  <div class="phx-gate-brand">' +
      '    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
      '      <path d="M2 13c3.5 0 3.5 3 7 3s3.5-3 7-3 3.5 3 7 3 3.5-3 7-3" stroke="#14203A" stroke-width="2.2" stroke-linecap="round"/>' +
      '      <path d="M2 21c3.5 0 3.5 3 7 3s3.5-3 7-3 3.5 3 7 3 3.5-3 7-3" stroke="#f2b26b" stroke-width="2.2" stroke-linecap="round"/>' +
      '    </svg><b>PHAROS 出海工作台</b>' +
      '  </div>' +
      '  <div class="phx-gate-sub">中小商家出海一站式系统 · 登录后进入工作台</div>' +
      '  <div class="phx-tabs">' +
      '    <button type="button" data-tab="login" class="on">登录</button>' +
      '    <button type="button" data-tab="register">注册账号</button>' +
      '  </div>' +
      '  <form id="phx-form-login">' +
      '    <div class="phx-field"><label>用户名</label><input id="phx-li-user" autocomplete="username" placeholder="用户名"></div>' +
      '    <div class="phx-field"><label>密码</label><input id="phx-li-pass" type="password" autocomplete="current-password" placeholder="密码"></div>' +
      '    <button type="submit" class="phx-btn-primary">登 录</button>' +
      '    <div class="phx-gate-err" id="phx-li-err"></div>' +
      '  </form>' +
      '  <form id="phx-form-register" hidden>' +
      '    <div class="phx-field"><label>用户名</label><input id="phx-rg-user" autocomplete="username" placeholder="2-20 位字母、数字、下划线或中文"></div>' +
      '    <div class="phx-field"><label>密码</label><input id="phx-rg-pass" type="password" autocomplete="new-password" placeholder="至少 6 位"></div>' +
      '    <div class="phx-field"><label>确认密码</label><input id="phx-rg-pass2" type="password" autocomplete="new-password" placeholder="再输入一次"></div>' +
      '    <div class="phx-field"><label>公司 / 团队名称（选填）</label><input id="phx-rg-company" placeholder="用于方案定制，可留空"></div>' +
      '    <label class="phx-agree"><input type="checkbox" id="phx-rg-agree"> 我已阅读并同意《服务条款》：AI 输出仅供参考，重大决策请咨询专业机构</label>' +
      '    <button type="submit" class="phx-btn-primary">注册并进入工作台</button>' +
      '    <div class="phx-gate-err" id="phx-rg-err"></div>' +
      '  </form>' +
      '  <div class="phx-gate-foot">数据仅存于本服务器 · 接入任意 OpenAI 兼容 API 即可使用</div>' +
      '</div>';
  }

  function showGate() {
    if (!gateEl) {
      gateEl = document.createElement("div");
      gateEl.id = "phx-gate";
      gateEl.innerHTML = gateMarkup();
      document.body.appendChild(gateEl);
      bindGate();
    }
    gateEl.hidden = false;
  }

  function hideGate() {
    if (gateEl) gateEl.hidden = true;
  }

  function bindGate() {
    var g = gateEl;
    $$(".phx-tabs button", g).forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$(".phx-tabs button", g).forEach(function (b) { b.classList.toggle("on", b === btn); });
        $("#phx-form-login", g).hidden = btn.getAttribute("data-tab") !== "login";
        $("#phx-form-register", g).hidden = btn.getAttribute("data-tab") !== "register";
      });
    });
    $("#phx-form-login", g).addEventListener("submit", function (e) {
      e.preventDefault();
      var err = $("#phx-li-err", g);
      err.textContent = "";
      api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: $("#phx-li-user", g).value.trim(),
          password: $("#phx-li-pass", g).value,
        }),
      }).then(function (r) {
        setToken(r.token);
        afterAuth(r.user);
      }).catch(function (ex) {
        if (!ex.unauthorized) err.textContent = ex.message;
      });
    });
    $("#phx-form-register", g).addEventListener("submit", function (e) {
      e.preventDefault();
      var err = $("#phx-rg-err", g);
      err.textContent = "";
      if ($("#phx-rg-pass", g).value !== $("#phx-rg-pass2", g).value) {
        err.textContent = "两次输入的密码不一致";
        return;
      }
      if (!$("#phx-rg-agree", g).checked) {
        err.textContent = "请先阅读并同意《服务条款》";
        return;
      }
      api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: $("#phx-rg-user", g).value.trim(),
          password: $("#phx-rg-pass", g).value,
          company: $("#phx-rg-company", g).value.trim(),
        }),
      }).then(function (r) {
        setToken(r.token);
        afterAuth(r.user);
      }).catch(function (ex) {
        if (!ex.unauthorized) err.textContent = ex.message;
      });
    });
  }

  /* ══════════════ 2. 账号徽标 & 登录后流程 ══════════════ */

  var currentUser = null;

  /* 进入工作台后恢复原版右侧工作台面板（Team & decisions）为展开状态 */
  function ensureRightRail() {
    try {
      var UI = window.LH_UI;
      if (UI && UI.S && !UI.S.railOpen) {
        UI.S.railOpen = true;
        if (UI.renderRail) UI.renderRail();
      }
    } catch (e) { /* ignore */ }
  }

  function afterAuth(user) {
    currentUser = user || null;
    loadTeam().then(function () {
      hideGate();
      mountAccountChip();
      ensureRightRail();
      toast("欢迎回来，" + ((user && user.username) || "商家"), "ok");
      if (user && user.company) {
        mountChipText();
      }
      syncCfgWithServer();
      mountSidebarNav();
    });
  }

  /* ══════════════ 团队成员：查看视图里可直接编辑/删除 ══════════════ */
  function hookTeamEdit() {
    var main = document.getElementById("mainInner");
    if (!main || main.__phxObs) return;
    main.__phxObs = true;
    new MutationObserver(function () { decorateTeamView(); })
      .observe(main, { childList: true, subtree: true });
    decorateTeamView();
  }

  function decorateTeamView() {
    var UI = window.LH_UI, E = window.LH_ENGINE;
    if (!UI || !E || UI.S.view !== "team") return;
    var main = document.getElementById("mainInner");
    var tbl = main.querySelector(".tbl");
    if (!tbl) return;
    var rows = tbl.querySelectorAll("tbody tr");
    var members = E.membersOf() || [];
    rows.forEach(function (tr, i) {
      var m = members[i];
      if (!m) return;
      var last = tr.lastElementChild;
      if (!last || last.querySelector("[data-phx-edit]")) return;
      var isMe = E.state.me === m.id;
      var editBtn = document.createElement("button");
      editBtn.className = "btn xs";
      editBtn.setAttribute("data-phx-edit", m.id);
      editBtn.textContent = "✏️ 编辑";
      var delBtn = document.createElement("button");
      delBtn.className = "btn xs danger";
      delBtn.setAttribute("data-phx-del", m.id);
      delBtn.textContent = "🗑";
      delBtn.title = isMe ? "不能删除自己" : "移除成员";
      last.appendChild(document.createTextNode(" "));
      last.appendChild(editBtn);
      if (!isMe) { last.appendChild(document.createTextNode(" ")); last.appendChild(delBtn); }
    });
  }

  document.addEventListener("click", function (e) {
    var editId = e.target && e.target.getAttribute && e.target.getAttribute("data-phx-edit");
    var delId = e.target && e.target.getAttribute && e.target.getAttribute("data-phx-del");
    if (editId) { e.stopPropagation(); openMemberEditModal(editId); }
    if (delId) {
      e.stopPropagation();
      var E = window.LH_ENGINE;
      var m = (E && E.member(delId)) || {};
      if (!confirm("移除成员 " + (m.name || "") + "？")) return;
      api("/api/team/members/" + delId, { method: "DELETE" }).then(function () {
        toast("已移除成员");
        loadTeam();
      }).catch(function (err) { toast(err.message, "bad"); });
    }
  });

  function openMemberEditModal(mid) {
    var E = window.LH_ENGINE;
    var m = (E && E.member(mid)) || {};
    var roleOptions = [
      ["owner", "Owner · 负责人"], ["ops", "Ops · 运营"], ["content", "Content · 内容"],
      ["compliance", "Compliance · 合规"], ["viewer", "Viewer · 只读"],
    ];
    var modal = openModal(
      '<div class="modal-head"><h3>✏️ 编辑成员</h3><button class="modal-close">✕</button></div>'
      + '<div class="modal-body">'
      + '<div class="phx-field"><label>成员姓名</label><input id="phx-e-name" value="' + esc(m.name || "") + '"></div>'
      + '<div class="phx-field"><label>角色</label><select id="phx-e-role">'
      + roleOptions.map(function (o) {
          return '<option value="' + o[0] + '"' + ((m.role || "member") === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
        }).join("")
      + "</select></div>"
      + '<div class="phx-field"><label>职位</label><input id="phx-e-title" value="' + esc(m.title || "") + '"></div>'
      + '<div class="modal-actions"><button class="btn-primary" id="phx-e-save" style="flex:1;padding:11px;border:none;border-radius:980px;color:#fff;background:linear-gradient(135deg,#6366F1,#8B5CF6);cursor:pointer;font-size:14px;font-weight:650">保存</button>'
      + '<button class="btn" id="phx-e-cancel">取消</button></div></div>'
    );
    $("#phx-e-cancel", modal).onclick = closeModal;
    $("#phx-e-save", modal).onclick = function () {
      var name = $("#phx-e-name", modal).value.trim();
      if (!name) { toast("请填写成员姓名", "bad"); return; }
      api("/api/team/members/" + mid, {
        method: "PUT",
        body: JSON.stringify({
          name: name,
          role: $("#phx-e-role", modal).value,
          title: $("#phx-e-title", modal).value.trim() || "成员",
        }),
      }).then(function () {
        closeModal();
        toast("已保存", "ok");
        loadTeam();
      }).catch(function (e) { toast(e.message, "bad"); });
    };
  }

  function applyTeam(team) {
    var D = window.LH_DATA, E = window.LH_ENGINE, UI = window.LH_UI;
    if (!D || !E) return;
    var ws = (team.workspaces || []).map(function (w) {
      return { id: w.id, name: w.name, short: w.short || w.name.slice(0, 2),
               plan: w.plan || "Free", owner: w.owner, desc: w.desc || "" };
    });
    var members = (team.members || []).map(function (m) {
      return { id: m.id, ws: m.ws, name: m.name, role: m.role || "member",
               title: m.title || "", initial: (m.name || "?").slice(0, 1).toUpperCase(),
               online: true, lastSeen: "在线", load: "" };
    });
    var projects = (team.projects || []).map(function (p, i) {
      return { id: p.id, ws: p.ws, name: p.name, sku: "1 SKU", progress: 0,
               gate: 0, members: [], current: i === 0 };
    });
    if (!ws.length || !members.length) return;   // 后端无数据则保持原样
    D.members = members;
    D.workspaces = ws;
    D.projects = projects;
    var owner = members.filter(function (m) { return m.role === "owner"; })[0] || members[0];
    E.state.me = owner.id;
    E.state.ws = ws[0].id;
    E.state.project = projects[0].id;
    /* 清空原版演示数据：从空白开始，随真实业务逐步出现 */
    ["tasks", "inbox", "activities", "artifacts", "notifications"].forEach(function (k) {
      if (Array.isArray(D[k])) D[k] = [];
    });
    E.state.activities = [];
    /* 清掉引用已不存在成员的演示活动（避免「Unknown」记录） */
    var ids = {};
    members.forEach(function (m) { ids[m.id] = 1; });
    E.state.activities = (E.state.activities || []).filter(function (a) { return ids[a.who]; });
    if (UI.renderAll) UI.renderAll();
  }

  function loadTeam() {
    return api("/api/team").then(function (team) {
      applyTeam(team);
    }).catch(function () { /* 后端不可用时保留原版数据 */ });
  }

  function persistTeam() {
    var D = window.LH_DATA;
    if (!D) return;
    api("/api/team", {
      method: "PUT",
      body: JSON.stringify({
        workspaces: D.workspaces || [],
        members: D.members || [],
        projects: D.projects || [],
      }),
    }).catch(function () { /* 静默 */ });
  }

  function mountChipText() {
    var chip = $("#phx-user");
    if (chip) {
      var nm = $("#phx-user-name", chip);
      if (nm) nm.textContent = currentUser.username + (currentUser.company ? " · " + currentUser.company : "");
    }
  }

  function mountAccountChip() {
    if (!currentUser) return;
    var topbar = $(".topbar");
    if (!topbar) { setTimeout(mountAccountChip, 800); return; }
    if ($("#phx-user")) { mountChipText(); return; }
    var chip = document.createElement("div");
    chip.className = "phx-user";
    chip.id = "phx-user";
    chip.innerHTML = '<span>🧑</span><span id="phx-user-name">' + esc(currentUser.username) + '</span>' +
      '<button type="button" class="phx-out" title="退出登录">退出</button>';
    $(".phx-out", chip).addEventListener("click", function () {
      if (!confirm("确定退出登录？")) return;
      api("/api/auth/logout", { method: "POST", body: "{}" }).catch(function () { /* ignore */ });
      setToken("");
      currentUser = null;
      if (chip.parentNode) chip.parentNode.removeChild(chip);
      var dock = $("#phx-dock");
      if (dock && dock.parentNode) dock.parentNode.removeChild(dock);
      showGate();
    });
    topbar.appendChild(chip);
  }

  /* ══════════════ 3. AI 配置双向同步 ══════════════ */

  var _origSetItem = null;

  function parseCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY) || "{}") || {}; } catch (e) { return {}; }
  }

  function writeCfgRaw(cfg) {
    if (_origSetItem) _origSetItem.call(localStorage, CFG_KEY, JSON.stringify(cfg));
    else localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }

  function currentProvider(cfg) {
    if (!cfg || !cfg.byProvider) return null;
    var pid = cfg.providerId;
    if (pid && cfg.byProvider[pid]) return cfg.byProvider[pid];
    /* 没标记 providerId 时：取任意一个已填 key 的 */
    var keys = Object.keys(cfg.byProvider);
    for (var i = 0; i < keys.length; i++) {
      if (cfg.byProvider[keys[i]] && cfg.byProvider[keys[i]].key) return cfg.byProvider[keys[i]];
    }
    return null;
  }

  /* 应用内 ⚙ 保存 → 镜像到服务器（供出海启动 / 平台对接等后端能力使用） */
  function hookCfgSave() {
    _origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
      _origSetItem.call(localStorage, key, value);
      if (key === CFG_KEY && token()) {
        try {
          var cfg = JSON.parse(value || "{}") || {};
          var cur = currentProvider(cfg);
          if (cur && cur.key) pushCfg(cur);
        } catch (e) { /* ignore */ }
      }
    };
  }

  function pushCfg(cur) {
    api("/api/settings", {
      method: "POST",
      body: JSON.stringify({
        llm_base_url: cur.base || "",
        llm_api_key: cur.key || "",
        llm_model: cur.model || "",
      }),
    }).catch(function () { /* 静默：不打扰原版操作 */ });
  }

  function matchProviderId(base) {
    try {
      var list = (window.LH_PROVIDERS && window.LH_PROVIDERS.list) || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].base && base && base.indexOf(list[i].base) === 0) return list[i].id;
      }
    } catch (e) { /* ignore */ }
    return "custom";
  }

  /* 登录后：把浏览器里的 Key 上报到服务器（供出海启动/平台对接等后端能力使用）。
     服务器不会把明文 Key 回传给任何客户端——安全要求。 */
  function syncCfgWithServer() {
    api("/api/settings").then(function (s) {
      var cfg = parseCfg();
      var cur = currentProvider(cfg);
      if (cur && cur.key) {
        pushCfg(cur);
      } else if (s && s.llm_configured) {
        /* 服务器已配置但本浏览器没有 Key：提示到 ⚙ 里填一次（不自动下发 Key） */
        console.info("[PHAROS] 服务器已配置 AI，本机浏览器未保存 Key；智能体对话需在 ⚙ 中填写。");
      }
    }).catch(function () { /* ignore */ });
  }

  /* ══════════════ 4. 悬浮入口（出海启动 / 平台对接） ══════════════ */

  function mountSidebarNav() {
    injectSidebarNav();
    var sb = document.getElementById("sidebar");
    if (sb && !sb.__phxObs) {
      sb.__phxObs = true;
      new MutationObserver(function () { injectSidebarNav(); })
        .observe(sb, { childList: true });
    }
  }

  /* 团队动态为空时给一句提示（不留空白块，也不造假数据） */
  function hookRailEmptyState() {
    var rail = document.getElementById("rail");
    if (!rail || rail.__phxObs) return;
    rail.__phxObs = true;
    var apply = function () {
      var feed = rail.querySelector(".feed");
      if (feed && !feed.children.length) {
        feed.innerHTML = '<div class="feed-i"><div class="fc" style="color:rgba(128,128,154,.9)">' +
          "暂无动态 —— 你与团队的每次决策、每个任务都会记录在这里。</div></div>";
      }
    };
    new MutationObserver(apply).observe(rail, { childList: true, subtree: true });
    apply();
  }

  /* ══════════════ 首页「开始出海」大按钮 ══════════════
     出海启动是产品核心,放在登录后第一眼能看到的地方。 */
  function hookOverviewCta() {
    var UI = window.LH_UI;
    if (!UI || !UI.views || !UI.views.overview || UI.views.overview.__phx) return;
    var orig = UI.views.overview;
    UI.views.overview = function () {
      var html = orig.apply(this, arguments);
      var banner =
        '<div class="next-hint" style="margin-bottom:16px;background:linear-gradient(135deg, rgba(245,158,11,.16), rgba(99,102,241,.12));border-color:rgba(245,158,11,.45)">' +
        '<span class="nh-badge" style="background:linear-gradient(135deg,#F59E0B,#F97316)">🚀 出海启动</span>' +
        '<span class="nh-text"><b>不知道怎么出海？</b>填一份资料，AI 直接给你专属出海方案 —— 首选平台、阶段任务、预算清单，照着做就能开第一单。</span>' +
        '<button class="btn beacon" id="phx-ov-launch">开始出海 →</button>' +
        '<button class="btn" id="phx-ov-platforms">🔗 平台对接</button>' +
        "</div>";
      return banner + html;
    };
    UI.views.overview.__phx = true;
    document.addEventListener("click", function (e) {
      if (e.target && e.target.id === "phx-ov-launch") { e.stopPropagation(); openPanel("launch"); }
      if (e.target && e.target.id === "phx-ov-platforms") { e.stopPropagation(); openPanel("platforms"); }
    });
  }

  function injectSidebarNav() {
    var sb = document.getElementById("sidebar");
    if (!sb || document.getElementById("phx-side-nav")) return;
    var block = document.createElement("div");
    block.id = "phx-side-nav";
    block.innerHTML =
      '<div class="nav-sec">出海工作台</div>' +
      '<button class="nav-i" id="phx-nav-launch"><span class="ic">🚀</span><span class="t">出海启动</span></button>' +
      '<button class="nav-i" id="phx-nav-platforms"><span class="ic">🔗</span><span class="t">平台对接</span></button>';
    sb.insertBefore(block, sb.firstChild);   // 放在左侧栏最顶部
    document.getElementById("phx-nav-launch").addEventListener("click", function () { openPanel("launch"); });
    document.getElementById("phx-nav-platforms").addEventListener("click", function () { openPanel("platforms"); });
  }

  /* 把「邀请/加入团队」嵌进原版「团队与权限」页；把「工作接入+今日待办」嵌进「任务与审批」页 */
  function hookTeamAndTasks() {
    var main = document.getElementById("mainInner");
    if (!main || main.__phxViews) return;
    main.__phxViews = true;
    new MutationObserver(function () { decorateViews(); }).observe(main, { childList: true });
    decorateViews();
  }

  function decorateViews() {
    var UI = window.LH_UI;
    if (!UI || !UI.S) return;
    var main = document.getElementById("mainInner");
    if (!main) return;
    if (UI.S.view === "team" && !document.getElementById("phx-team-card")) {
      var box = document.createElement("div");
      box.id = "phx-team-card";
      box.className = "card";
      box.style.marginBottom = "16px";
      box.innerHTML = '<div class="card-h"><div><h3>邀请成员 · 加入团队</h3>' +
        '<div class="sub">同一账号体系：同事先注册，再用邀请码加入，团队数据全员共享</div></div></div>' +
        '<div class="card-b"><div class="row wrap" style="gap:8px;align-items:center">' +
        '<button class="btn primary" id="phx-tc-invite">生成邀请码</button>' +
        '<span id="phx-tc-out" class="tiny"></span></div>' +
        '<div class="row wrap" style="gap:8px;align-items:center;margin-top:10px">' +
        '<input id="phx-tc-code" placeholder="输入 6 位邀请码" style="padding:8px 12px;border-radius:10px;border:1px solid var(--glass-line);background:transparent;color:inherit;min-width:200px">' +
        '<button class="btn" id="phx-tc-join">加入团队</button>' +
        '<button class="btn ghost" id="phx-tc-leave">退出团队</button></div></div>';
      main.insertBefore(box, main.firstChild);
      $("#phx-tc-invite", box).onclick = function () {
        api("/api/team/invite", { method: "POST", body: JSON.stringify({ role: "member" }) })
          .then(function (r) {
            $("#phx-tc-out", box).innerHTML = "邀请码 <b style=\"color:var(--gold,#f2b26c)\">" + esc(r.code) +
              '</b>（7 天有效）· <a href="' + esc(location.origin + r.link_mobile) + '" target="_blank">邀请链接</a>';
          }).catch(function (e) { toast(e.message, "bad"); });
      };
      $("#phx-tc-join", box).onclick = function () {
        api("/api/team/join", { method: "POST", body: JSON.stringify({ code: $("#phx-tc-code", box).value.trim() }) })
          .then(function (r) {
            toast("已加入 " + (r.joined ? r.joined.owner_name : "团队") + "，数据已共享", "ok");
            loadTeam();
          }).catch(function (e) { toast(e.message, "bad"); });
      };
      $("#phx-tc-leave", box).onclick = function () {
        api("/api/team/leave", { method: "POST", body: "{}" }).then(function () { toast("已退出团队"); loadTeam(); });
      };
    }
    if (UI.S.view === "tasks" && !document.getElementById("phx-todo-card")) {
      api("/api/workhub").then(function (d) {
        if (document.getElementById("phx-todo-card")) return;
        var card = document.createElement("div");
        card.id = "phx-todo-card";
        card.className = "card";
        card.style.marginBottom = "16px";
        card.innerHTML = '<div class="card-h"><div><h3>工作接入 · 今日待办（' + d.tasks.length + '）</h3>' +
          '<div class="sub">绑定飞书/企微/邮箱后，待办汇到这里；PC 与手机同源</div></div></div>' +
          '<div class="card-b">' +
          '<div class="row wrap" style="gap:8px;margin-bottom:10px">' +
          '<select id="phx-wk-prov" class="btn" style="padding:8px 12px"><option>飞书</option><option>企业微信</option><option>邮箱</option><option>亚马逊卖家后台</option><option>TikTok Shop</option></select>' +
          '<input id="phx-wk-acc" placeholder="工作账号" style="padding:8px 12px;border-radius:10px;border:1px solid var(--glass-line);background:transparent;color:inherit">' +
          '<button class="btn" id="phx-wk-bind">绑定</button>' +
          '<span class="tiny">' + (d.connected ? "已绑定 " + d.bindings.map(function (b) { return b.provider; }).join("、") : "未绑定") + "</span></div>" +
          d.tasks.map(function (t) {
            return '<div class="row" style="gap:8px;padding:7px 0;border-top:1px solid var(--hair)">' +
              tag(t.source, "soft") + '<span class="small">' + esc(t.title) + "</span></div>";
          }).join("") + "</div>";
        main.insertBefore(card, main.firstChild);
        $("#phx-wk-bind", card).onclick = function () {
          api("/api/workhub/bind", { method: "POST", body: JSON.stringify({ provider: $("#phx-wk-prov", card).value, account: $("#phx-wk-acc", card).value.trim() }) })
            .then(function () { toast("已绑定", "ok"); card.remove(); decorateViews(); })
            .catch(function (e) { toast(e.message, "bad"); });
        };
      }).catch(function () {});
    }
  }

  /* 添加团队成员：写入服务器并刷新原版团队视图 */
  /* 工作接入：绑定飞书/企微/邮箱，生成今日待办（由真实业务数据推导） */
  function openWorkhub() {
    if (!token()) { showGate(); return; }
    api("/api/workhub").then(function (d) {
      var body = "";
      if (!d.bindings.length) {
        body += '<div class="phx-label">还没有绑定工作账号</div>';
      } else {
        body += '<div class="phx-label">已绑定</div>' + d.bindings.map(function (b) {
          return '<div class="phx-plat" style="margin-bottom:8px;padding:12px 14px">' +
            "<b>" + esc(b.provider) + "</b> · " + esc(b.account) +
            ' <button class="btn sm" data-unbind="' + b.id + '" style="float:right">解绑</button></div>';
        }).join("");
      }
      body += '<div class="phx-label" style="margin-top:14px">绑定新的工作账号</div>' +
        '<div class="phx-field"><select id="wh-provider"><option>飞书</option><option>企业微信</option><option>邮箱</option><option>亚马逊卖家后台</option><option>TikTok Shop</option></select></div>' +
        '<div class="phx-field"><input id="wh-account" placeholder="账号，如 ops@company.com"></div>' +
        '<button class="btn primary" id="wh-bind" style="margin-bottom:16px">绑定</button>' +
        '<div class="phx-label">今日待办（' + d.tasks.length + "）</div>" +
        d.tasks.map(function (t) {
          return '<div class="phx-plat" style="margin-bottom:8px;padding:12px 14px;display:block">' +
            '<span class="tag" style="margin-right:8px">' + esc(t.source) + "</span>" +
            "<b>" + esc(t.title) + "</b><div class=\"tiny\" style=\"margin-top:4px;color:var(--ink-3,#80809A)\">" +
            esc(t.detail || "") + "</div></div>";
        }).join("");
      var wrap = panelShell("工作接入 · 今日待办", "📥", "绑定工作账号后，每日待办会汇到这里（外部消息需服务商授权后同步）", body);
      $("#wh-bind", wrap).addEventListener("click", function () {
        api("/api/workhub/bind", {
          method: "POST",
          body: JSON.stringify({ provider: $("#wh-provider", wrap).value, account: $("#wh-account", wrap).value.trim() }),
        }).then(function () { closePanel(); openWorkhub(); toast("已绑定", "ok"); })
          .catch(function (e) { toast(e.message, "bad"); });
      });
      $$("[data-unbind]", wrap).forEach(function (b) {
        b.addEventListener("click", function () {
          api("/api/workhub/bind/" + b.getAttribute("data-unbind"), { method: "DELETE" })
            .then(function () { closePanel(); openWorkhub(); });
        });
      });
    }).catch(handlePanelErr);
  }

  function openMemberModal() {
    if (!token()) { showGate(); return; }
    var D = window.LH_DATA;
    var roleOptions = [
      ["owner", "Owner · 负责人"], ["ops", "Ops · 运营"], ["content", "Content · 内容"],
      ["compliance", "Compliance · 合规"], ["viewer", "Viewer · 只读"],
    ];
    var m = openModal(
      '<div class="modal-head"><h3>👥 团队与邀请</h3><button class="modal-close">✕</button></div>'
      + '<div class="modal-body">'
      + '<div class="phx-field"><label>邀请同事加入团队</label>'
      + '<div style="display:flex;gap:8px;align-items:center"><button class="btn sm primary" id="phx-make-invite">生成邀请码</button>'
      + '<span id="phx-invite-out" style="font-size:12px;color:var(--ink-3,#80809A)"></span></div></div>'
      + '<div class="phx-field"><label>已有邀请码？加入团队</label>'
      + '<div style="display:flex;gap:8px"><input id="phx-join-code" placeholder="6 位邀请码" style="flex:1">'
      + '<button class="btn sm" id="phx-join-btn">加入</button></div></div>'
      + '<div class="phx-field"><label>成员姓名</label><input id="phx-m-name" placeholder="如：王小明"></div>'
      + '<div class="phx-field"><label>角色</label><select id="phx-m-role">'
      + roleOptions.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + "</option>"; }).join("")
      + "</select></div>"
      + '<div class="phx-field"><label>职位（选填）</label><input id="phx-m-title" placeholder="如：运营 / 财务 / 设计"></div>'
      + '<div class="modal-actions"><button class="btn-primary" id="phx-m-save" style="flex:1;padding:11px;border:none;border-radius:980px;color:#fff;background:linear-gradient(135deg,#6366F1,#8B5CF6);cursor:pointer;font-size:14px;font-weight:650">添加成员</button>'
      + '<button class="btn" id="phx-m-cancel">取消</button></div></div>'
    );
    $("#phx-m-cancel", m).onclick = closeModal;
    var mk = $("#phx-make-invite", m);
    if (mk) mk.onclick = function () {
      api("/api/team/invite", { method: "POST", body: JSON.stringify({ role: "member" }) })
        .then(function (r) {
          var link = location.origin + r.link_mobile;
          $("#phx-invite-out", m).innerHTML = "邀请码 <b style=\"color:var(--gold,#f2b26c)\">" + esc(r.code) +
            '</b> · <a href="' + esc(link) + '" target="_blank">打开邀请链接</a>';
          toast("邀请码：" + r.code + "（7 天有效）", "ok");
        }).catch(function (e) { toast(e.message, "bad"); });
    };
    var jb = $("#phx-join-btn", m);
    if (jb) jb.onclick = function () {
      api("/api/team/join", { method: "POST", body: JSON.stringify({ code: $("#phx-join-code", m).value.trim() }) })
        .then(function (r) {
          toast("已加入 " + (r.joined ? r.joined.owner_name : "团队") + " 的团队，数据已共享", "ok");
          closeModal();
          loadTeam();
        }).catch(function (e) { toast(e.message, "bad"); });
    };
    $("#phx-m-save", m).onclick = function () {
      var name = $("#phx-m-name", m).value.trim();
      if (!name) { toast("请填写成员姓名", "bad"); return; }
      var E = window.LH_ENGINE;
      var ws = (E && E.state.ws) || "";
      api("/api/team/members", {
        method: "POST",
        body: JSON.stringify({
          ws: ws, name: name,
          role: $("#phx-m-role", m).value,
          title: $("#phx-m-title", m).value.trim() || "成员",
        }),
      }).then(function (r) {
        var D = window.LH_DATA, UI = window.LH_UI;
        if (D && r.member) {
          D.members.push({
            id: r.member.id, ws: r.member.ws, name: r.member.name,
            role: r.member.role, title: r.member.title,
            initial: (r.member.name || "?").slice(0, 1).toUpperCase(),
            online: true, lastSeen: "在线", load: "",
          });
          if (UI.renderAll) UI.renderAll();
        }
        closeModal();
        toast("已添加成员：" + name, "ok");
      }).catch(function (e) { toast(e.message, "bad"); });
    };
  }

  /* ══════════════ 5. 覆盖面板 ══════════════ */

  var panelMask = null;

  function panelShell(title, ico, sub, bodyHtml) {
    closePanel();
    panelMask = document.createElement("div");
    panelMask.className = "modal-mask";
    panelMask.innerHTML =
      '<div class="modal phx-panel">' +
      '  <div class="phx-panel-head">' +
      '    <span class="ico">' + ico + '</span>' +
      '    <div><h2>' + esc(title) + '</h2><div class="sub">' + esc(sub) + '</div></div>' +
      '    <span class="sp"></span>' +
      '    <button type="button" class="phx-x" title="关闭">✕</button>' +
      '  </div>' +
      '  <div class="phx-panel-body" id="phx-panel-body">' + bodyHtml + '</div>' +
      '</div>';
    document.body.appendChild(panelMask);
    $(".phx-x", panelMask).addEventListener("click", closePanel);
    panelMask.addEventListener("click", function (e) { if (e.target === panelMask) closePanel(); });
    return $("#phx-panel-body", panelMask);
  }

  function closePanel() {
    if (panelMask && panelMask.parentNode) panelMask.parentNode.removeChild(panelMask);
    panelMask = null;
  }

  function openPanel(kind) {
    if (!token()) { showGate(); return; }
    if (kind === "launch") openLaunch();
    else openPlatforms();
  }

  /* ══════════════ 6. 出海启动（向导 + 方案） ══════════════ */

  var WIZ_STEPS = ["商家情况", "产品信息", "目标市场", "确认生成"];
  var wiz = null;         // { step, answers }
  var planCache = null;   // 服务端计划缓存

  function openLaunch(forceWizard) {
    api("/api/launch/plan").then(function (plan) {
      planCache = plan || {};
      if (planCache.result && !forceWizard) {
        renderPlan(planCache);
      } else {
        wiz = {
          step: Math.min(Math.max(planCache.step || 1, 1), 4),
          answers: Object.assign({}, planCache.answers || {}),
        };
        renderWizard();
      }
    }).catch(handlePanelErr);
  }

  function handlePanelErr(ex) {
    if (ex.unauthorized) return;
    toast(ex.message, "bad");
    if (ex.notConfigured) openAppSettings();
  }

  function openAppSettings() {
    var btn = document.querySelector('[data-act="open-settings"]');
    if (btn) btn.click();
    else toast("请点击右上角 ⚙ 配置 AI 服务", "bad");
  }

  function stepsBar(step) {
    return '<div class="phx-steps">' + WIZ_STEPS.map(function (t, i) {
      var n = i + 1;
      var cls = n === step ? "now" : (n < step ? "done" : "");
      return '<div class="phx-step ' + cls + '" data-step="' + n + '">' +
        '<div class="n"><i>' + (n < step ? "✓" : n) + '</i>STEP ' + n + '</div>' +
        '<div class="t">' + t + '</div></div>';
    }).join("") + '</div>';
  }

  function fieldRow(label, inner) {
    return '<div class="phx-label">' + esc(label) + '</div>' + inner;
  }

  function chipRow(key, options, multi) {
    var a = wiz.answers;
    var cur = multi ? (a[key] || []) : String(a[key] == null ? "" : a[key]);
    return '<div class="phx-chips" data-key="' + esc(key) + '"' + (multi ? ' data-multi="1"' : '') + '>' +
      options.map(function (o) {
        var v = o[0], label = o[1];
        var on = multi ? cur.indexOf(v) >= 0 : String(v) === cur;
        return '<button type="button" class="phx-chip' + (on ? " on" : "") + '" data-v="' + esc(v) + '">' + label + '</button>';
      }).join("") + '</div>';
  }

  function renderWizard() {
    var step = wiz.step;
    var body = stepsBar(step);
    if (step === 1) {
      body += fieldRow("公司类型", chipRow("company_type", [["factory", "🏭 工厂 / 生产商"], ["trader", "📦 贸易商"], ["brand", "🏷️ 品牌商"], ["individual", "🧑 个人卖家"]]));
      body += fieldRow("营业执照", chipRow("has_license", [["1", "✅ 有营业执照"], ["0", "暂无"]]));
      body += fieldRow("注册商标", chipRow("has_brand", [["1", "✅ 有注册商标"], ["0", "暂无"]]));
      body += fieldRow("出海经验", chipRow("experience", [["none", "🌱 无经验，第一次出海"], ["domestic", "🏪 做过国内电商"], ["cross", "🌍 有跨境经验"]]));
      body += fieldRow("启动预算（人民币）", chipRow("budget", [["lt3", "3 万以下"], ["3-10", "3-10 万"], ["10-30", "10-30 万"], ["gt30", "30 万以上"]]));
      body += fieldRow("团队规模", chipRow("team", [["1", "1 人"], ["2-5", "2-5 人"], ["6-20", "6-20 人"], ["gt20", "20 人以上"]]));
    } else if (step === 2) {
      var cats = ["请选择品类", "消费电子", "家居生活", "服装服饰", "美妆个护", "运动户外", "宠物用品", "母婴玩具", "汽摩配件", "工业用品", "食品饮料", "其他"];
      body += fieldRow("主营品类",
        '<div class="phx-field"><select id="phx-w-cat">' + cats.map(function (c) {
          return '<option value="' + esc(c) + '"' + ((wiz.answers.category || "请选择品类") === c ? " selected" : "") + ">" + esc(c) + "</option>";
        }).join("") + "</select></div>");
      body += fieldRow("产品介绍",
        '<div class="phx-field"><input id="phx-w-prod" placeholder="一句话介绍你的产品：是什么、卖给谁、凭什么赢" value="' + esc(wiz.answers.product || "") + '"></div>');
      body += fieldRow("客单价", chipRow("price", [["lt50", "50 元以下"], ["50-150", "50-150 元"], ["150-500", "150-500 元"], ["gt500", "500 元以上"]]));
      body += fieldRow("供应链", chipRow("supply", [["factory", "🏭 自有工厂"], ["stable", "🤝 稳定货源"], ["seeking", "🔎 需要找货"]]));
      body += fieldRow("已有认证（选填）",
        '<div class="phx-field"><input id="phx-w-certs" placeholder="如 CE、FCC、FDA，没有可留空" value="' + esc(wiz.answers.certs || "") + '"></div>');
    } else if (step === 3) {
      body += fieldRow("目标市场（可多选）", chipRow("markets", [["us", "🇺🇸 美国"], ["eu", "🇪🇺 欧洲"], ["sea", "🌏 东南亚"], ["me", "🕌 中东"], ["latam", "🌎 拉美"], ["jpkr", "🗾 日韩"], ["other", "🌍 其他"]], true));
      var markets = ["美国", "欧洲", "东南亚", "中东", "拉美", "日韩", "其他"];
      body += fieldRow("首选市场",
        '<div class="phx-field"><select id="phx-w-first">' + markets.map(function (m) {
          return '<option value="' + esc(m) + '"' + ((wiz.answers.first_market || "美国") === m ? " selected" : "") + ">" + esc(m) + "</option>";
        }).join("") + "</select></div>");
    } else {
      body += confirmTable();
      body += '<div class="phx-route" style="background:linear-gradient(150deg, rgba(245,158,11,.14), rgba(255,255,255,.6) 65%);border-color:rgba(245,158,11,.4)">' +
        '<div style="font-size:13px;line-height:1.7;color:var(--ink-2,#55556E)"><b>确认无误后点击「生成我的出海方案」</b>：AI 会结合以上资料，' +
        '推荐首选平台、拆解阶段任务、测算启动预算、列出资质清单与风险提示。</div></div>';
    }
    body += '<div class="phx-actions">' +
      (step > 1 ? '<button type="button" class="btn" id="phx-w-prev">← 上一步</button>'
        : (planCache && planCache.result ? '<button type="button" class="btn" id="phx-w-back">← 返回方案</button>' : '')) +
      '<span class="sp"></span>' +
      (step < 4
        ? '<button type="button" class="btn primary" id="phx-w-next">下一步 →</button>'
        : '<button type="button" class="btn primary" id="phx-w-gen">⚡ 生成我的出海方案</button>') +
      '</div>';

    var wrap = panelShell("出海启动", "🚀", "填一份资料，AI 为你生成专属出海方案 —— 不是教程，是直接能执行的开店计划", body);

    $$(".phx-step", wrap).forEach(function (el) {
      el.addEventListener("click", function () {
        collectStep(wrap);
        wiz.step = Math.min(4, Math.max(1, Number(el.getAttribute("data-step"))));
        renderWizard();
      });
    });
    $$(".phx-chips", wrap).forEach(function (row) {
      var key = row.getAttribute("data-key");
      var multi = row.getAttribute("data-multi") === "1";
      $$(".phx-chip", row).forEach(function (chip) {
        chip.addEventListener("click", function () {
          var v = chip.getAttribute("data-v");
          if (multi) {
            var arr = (wiz.answers[key] || []).slice();
            var i = arr.indexOf(v);
            if (i >= 0) arr.splice(i, 1); else arr.push(v);
            wiz.answers[key] = arr;
            chip.classList.toggle("on");
          } else {
            wiz.answers[key] = v;
            $$(".phx-chip", row).forEach(function (c) { c.classList.toggle("on", c === chip); });
          }
        });
      });
    });
    var prev = $("#phx-w-prev", wrap);
    if (prev) prev.addEventListener("click", function () { collectStep(wrap); wiz.step -= 1; renderWizard(); });
    var back = $("#phx-w-back", wrap);
    if (back) back.addEventListener("click", function () { renderPlan(planCache); });
    var next = $("#phx-w-next", wrap);
    if (next) next.addEventListener("click", function () { collectStep(wrap); wiz.step = Math.min(4, wiz.step + 1); renderWizard(); });
    var gen = $("#phx-w-gen", wrap);
    if (gen) gen.addEventListener("click", function () { collectStep(wrap); doGenerate(); });
  }

  function collectStep(wrap) {
    var cat = $("#phx-w-cat", wrap);
    if (cat) wiz.answers.category = cat.value;
    var prod = $("#phx-w-prod", wrap);
    if (prod) wiz.answers.product = prod.value.trim();
    var certs = $("#phx-w-certs", wrap);
    if (certs) wiz.answers.certs = certs.value.trim();
    var first = $("#phx-w-first", wrap);
    if (first) wiz.answers.first_market = first.value;
  }

  function confirmTable() {
    var a = wiz.answers;
    var nameMaps = {
      company_type: { factory: "工厂/生产商", trader: "贸易商", brand: "品牌商", individual: "个人卖家" },
      experience: { none: "无经验", domestic: "国内电商", cross: "有跨境经验" },
      budget: { lt3: "3 万以下", "3-10": "3-10 万", "10-30": "10-30 万", gt30: "30 万以上" },
      team: { "1": "1 人", "2-5": "2-5 人", "6-20": "6-20 人", gt20: "20 人以上" },
      price: { lt50: "50 元以下", "50-150": "50-150 元", "150-500": "150-500 元", gt500: "500 元以上" },
      supply: { factory: "自有工厂", stable: "稳定货源", seeking: "需要找货" },
    };
    var mk = { us: "美国", eu: "欧洲", sea: "东南亚", me: "中东", latam: "拉美", jpkr: "日韩", other: "其他" };
    function pick(key) {
      var v = a[key];
      if (key === "markets") return (v || []).map(function (x) { return mk[x] || x; }).join("、") || "未选择";
      if (key === "category" || key === "product") return v || "未填写";
      if (key === "certs") return v || "无";
      return (nameMaps[key] && nameMaps[key][v]) || v || "未选择";
    }
    return '<div style="overflow-x:auto;margin-bottom:14px"><table class="phx-table">' +
      "<tr><th>公司类型</th><td>" + esc(pick("company_type")) + "</td><th>营业执照</th><td>" + (a.has_license === "1" ? "有" : "无") + "</td></tr>" +
      "<tr><th>商标</th><td>" + (a.has_brand === "1" ? "有" : "无") + "</td><th>出海经验</th><td>" + esc(pick("experience")) + "</td></tr>" +
      "<tr><th>启动预算</th><td>" + esc(pick("budget")) + "</td><th>团队</th><td>" + esc(pick("team")) + "</td></tr>" +
      "<tr><th>主营品类</th><td>" + esc(pick("category")) + "</td><th>客单价</th><td>" + esc(pick("price")) + "</td></tr>" +
      "<tr><th>供应链</th><td>" + esc(pick("supply")) + "</td><th>已有认证</th><td>" + esc(pick("certs")) + "</td></tr>" +
      "<tr><th>目标市场</th><td colspan='3'>" + esc(pick("markets")) + "（首选：" + esc(a.first_market || "美国") + "）</td></tr>" +
      "<tr><th>产品介绍</th><td colspan='3'>" + esc(pick("product")) + "</td></tr>" +
      "</table></div>";
  }

  function doGenerate() {
    var wrap = panelShell("出海启动", "🚀", "AI 正在分析平台匹配度、拆解任务与预算", "");
    wrap.innerHTML = '<div class="phx-loading"><div class="spinner"></div>' +
      '<p>AI 正在结合你的资料生成专属出海方案……<br>大约需要 30-60 秒，请稍候</p></div>';
    api("/api/launch/plan", {
      method: "PUT",
      body: JSON.stringify({ step: 4, answers: wiz.answers }),
    }).then(function () {
      return api("/api/launch/generate", { method: "POST", body: "{}" });
    }).then(function (r) {
      planCache = { step: 4, answers: wiz.answers, result: r.result };
      wiz = null;
      toast("出海方案已生成 🎉", "ok");
      renderPlan(planCache);
    }).catch(handlePanelErr);
  }

  function renderPlan(plan) {
    var r = plan.result || {};
    function arr(v) { return Array.isArray(v) ? v : []; }
    var gb = "已就绪";
    var body = "" +
      '<div class="phx-route">' +
      '  <span class="badge">🎯 首选路线</span>' +
      '  <h3>' + esc((r.route && r.route.primary) || "—") + '</h3>' +
      '  <div class="why">' + esc((r.route && r.route.primary_reason) || "") + '</div>' +
      (arr(r.route && r.route.alternatives).length
        ? '<div class="alt">备选：' + esc(arr(r.route.alternatives).join(" · ")) + '</div>' : '') +
      '</div>';

    if (arr(r.compare).length) {
      body += '<div class="phx-block"><div class="phx-label">⚖️ 平台适配对比</div><div style="overflow-x:auto"><table class="phx-table">' +
        '<thead><tr><th>平台</th><th>适配度</th><th>理由</th></tr></thead><tbody>' +
        arr(r.compare).map(function (c) {
          var cls = c.fit === "高" ? "phx-fit-high" : (c.fit === "中" ? "phx-fit-mid" : "phx-fit-low");
          return "<tr><td><b>" + esc(c.platform || "") + "</b></td><td class='" + cls + "'>" + esc(c.fit || "") + "</td><td>" + esc(c.reason || "") + "</td></tr>";
        }).join("") + "</tbody></table></div></div>";
    }

    if (arr(r.milestones).length) {
      body += '<div class="phx-block"><div class="phx-label">🗓️ 阶段计划</div><div class="phx-tl">' +
        arr(r.milestones).map(function (m) {
          return '<div class="item"><span class="dot"></span><div style="flex:1;min-width:0">' +
            '<div class="ph">' + esc(m.phase || "") + "</div>" +
            arr(m.tasks).map(function (t) { return '<div class="tk">' + esc(t) + "</div>"; }).join("") +
            "</div></div>";
        }).join("") + "</div></div>";
    }

    if (arr(r.budget).length) {
      body += '<div class="phx-block"><div class="phx-label">💰 启动预算测算</div><div style="overflow-x:auto"><table class="phx-table">' +
        "<thead><tr><th>费用项目</th><th>金额区间</th></tr></thead><tbody>" +
        arr(r.budget).map(function (b) { return "<tr><td>" + esc(b.item || "") + "</td><td>" + esc(b.range || "") + "</td></tr>"; }).join("") +
        "</tbody></table></div></div>";
    }

    if (arr(r.qualifications).length) {
      body += '<div class="phx-block"><div class="phx-label">📜 资质准备清单</div>' +
        arr(r.qualifications).map(function (q) { return '<div class="phx-li" data-ico="✅">' + esc(q) + "</div>"; }).join("") + "</div>";
    }

    if (arr(r.risks).length) {
      body += '<div class="phx-block"><div class="phx-label">⚠️ 风险提示</div>' +
        arr(r.risks).map(function (x) { return '<div class="phx-li warn" data-ico="⚠️">' + esc(x) + "</div>"; }).join("") + "</div>";
    }

    if (arr(r.next_steps).length) {
      body += '<div class="phx-block"><div class="phx-label">🏁 下一步行动</div>' +
        arr(r.next_steps).map(function (x, i) { return '<div class="phx-li" data-ico="' + (i + 1) + '.">' + esc(x) + "</div>"; }).join("") + "</div>";
    }

    body += '<div class="phx-actions">' +
      '<button type="button" class="btn" id="phx-p-edit">✏️ 修改资料</button>' +
      '<button type="button" class="btn" id="phx-p-regen">⚡ 重新生成</button>' +
      '<span class="sp"></span>' +
      '<button type="button" class="btn primary" id="phx-p-plat">🔗 去对接平台</button>' +
      '</div>';

    var wrap = panelShell("我的出海方案", "🚀", "基于你的资料由 AI 生成 · 可随时修改资料重新生成", body);
    $("#phx-p-edit", wrap).addEventListener("click", function () {
      wiz = { step: 1, answers: Object.assign({}, plan.answers || {}) };
      renderWizard();
    });
    $("#phx-p-regen", wrap).addEventListener("click", function () {
      wiz = { step: 4, answers: Object.assign({}, plan.answers || {}) };
      doGenerate();
    });
    $("#phx-p-plat", wrap).addEventListener("click", function () { openPlatforms(); });
  }

  /* ══════════════ 7. 平台对接 ══════════════ */

  var STATUS_LABELS = { none: "未开始", preparing: "资料准备中", submitted: "已提交申请", opened: "已开通" };

  function openPlatforms() {
    api("/api/launch/platforms").then(function (data) {
      renderPlatforms(data);
    }).catch(handlePanelErr);
  }

  function renderPlatforms(data) {
    var list = (data && data.platforms) || [];
    var body = '<div class="phx-label">选择目标平台、记录对接进度；点「AI 入驻指南」可拿到结合你资料的定制入驻步骤。</div>' +
      '<div class="phx-plat-grid">' + list.map(function (p) {
        var status = p.status || "none";
        return '<div class="phx-plat" data-pid="' + esc(p.id) + '">' +
          '<div class="hd"><span class="ic">' + esc(p.ico) + "</span><span><b>" + esc(p.name) + "</b><br>" +
          '<span class="rg">' + esc(p.region) + "</span></span></div>" +
          '<div class="mode">' + esc(p.mode) + "</div>" +
          '<div class="fees">' + esc(p.fees) + "</div>" +
          '<ul class="entry">' + (p.entry || []).slice(0, 3).map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul>" +
          '<div class="fit">👤 ' + esc(p.fit) + "</div>" +
          '<div class="phx-status">' + Object.keys(STATUS_LABELS).map(function (s) {
            return '<button type="button" class="st' + (status === s ? " on" : "") + '" data-s="' + s + '">' + STATUS_LABELS[s] + "</button>";
          }).join("") + "</div>" +
          '<div class="phx-field" style="margin-bottom:8px"><input class="phx-url" placeholder="店铺链接，如 https://www.amazon.com/shops/你的店" value="' + esc(p.store_url || "") + '"></div>' +
          '<div class="phx-verify-note" style="font-size:11px;color:var(--ink-3,#80809A);margin-bottom:8px">' +
          (p.verified ? "✅ 已验证：" + esc(p.verify_note || "") : "未验证：填好链接后点「验证链接」，系统会真的访问一次") + "</div>" +
          '<div class="ops">' +
          '<button type="button" class="btn sm phx-verify">🔍 验证链接</button>' +
          '<button type="button" class="btn sm phx-guide">AI 入驻指南</button>' +
          '<button type="button" class="btn sm primary phx-save">保存</button>' +
          "</div></div>";
      }).join("") + "</div>";

    var wrap = panelShell("平台对接", "🔗", "亚马逊 / TikTok / Temu 等 8 大海外平台 · 进度可记录、指南可定制", body);

    $$(".phx-plat", wrap).forEach(function (card) {
      var pid = card.getAttribute("data-pid");
      $$(".phx-status .st", card).forEach(function (st) {
        st.addEventListener("click", function () {
          $$(".phx-status .st", card).forEach(function (c) { c.classList.toggle("on", c === st); });
        });
      });
      $(".phx-save", card).addEventListener("click", function () {
        var on = $(".phx-status .st.on", card);
        if (!on) { toast("请先选择对接进度", "bad"); return; }
        api("/api/launch/platforms/" + pid, {
          method: "PUT",
          body: JSON.stringify({
            status: on.getAttribute("data-s"),
            store_url: $(".phx-url", card).value.trim(),
          }),
        }).then(function () {
          toast("已保存（进度 + 店铺链接）", "ok");
        }).catch(handlePanelErr);
      });
      $(".phx-verify", card).addEventListener("click", function () {
        var url = $(".phx-url", card).value.trim();
        if (!url) { toast("请先填写店铺链接", "bad"); return; }
        var note = $(".phx-verify-note", card);
        note.textContent = "正在访问该链接…";
        api("/api/launch/platforms/" + pid + "/verify", {
          method: "POST",
          body: JSON.stringify({ store_url: url }),
        }).then(function (r) {
          note.textContent = "✅ 已验证：" + (r.title || "页面可访问") + "（HTTP " + r.status + "）";
          toast("链接验证通过，店铺确实存在", "ok");
        }).catch(function (e) {
          note.textContent = "❌ 验证失败：" + e.message;
          toast(e.message, "bad");
        });
      });
      $(".phx-guide", card).addEventListener("click", function () { openGuide(pid, card); });
    });
  }

  function openGuide(pid, card) {
    var wrap = panelShell("AI 入驻指南", "🤖", "结合你的资料生成的定制入驻步骤", "");
    wrap.innerHTML = '<div class="phx-loading"><div class="spinner"></div>' +
      "<p>AI 正在结合你的资料生成入驻指南……</p></div>";
    api("/api/launch/platforms/" + pid + "/guide", { method: "POST", body: "{}" }).then(function (r) {
      var g = r.guide || {};
      function arr(v) { return Array.isArray(v) ? v : []; }
      var html = "";
      if (g.overview) html += '<div class="phx-route" style="margin-bottom:16px"><div class="why" style="font-size:13.5px">' + esc(g.overview) + "</div></div>";
      if (arr(g.requirements).length) {
        html += '<div class="phx-block"><div class="phx-label">📋 需要准备的材料</div>' +
          arr(g.requirements).map(function (x) { return '<div class="phx-li" data-ico="▸">' + esc(x) + "</div>"; }).join("") + "</div>";
      }
      if (arr(g.steps).length) {
        html += '<div class="phx-block"><div class="phx-label">🪜 入驻步骤</div><div class="phx-tl">' +
          arr(g.steps).map(function (s, i) {
            return '<div class="item"><span class="dot" style="font-size:0"></span><div style="flex:1;min-width:0">' +
              '<div class="ph">' + (i + 1) + ". " + esc(s.step || "") + "</div>" +
              '<div class="tk" style="padding-left:0">' + esc(s.detail || "") + "</div></div></div>";
          }).join("") + "</div></div>";
      }
      if (g.timeline) {
        html += '<div class="phx-block"><div class="phx-label">⏱️ 预计周期</div><div class="phx-li" data-ico="▸">' + esc(g.timeline) + "</div></div>";
      }
      if (arr(g.pitfalls).length) {
        html += '<div class="phx-block"><div class="phx-label">⚠️ 避坑提醒</div>' +
          arr(g.pitfalls).map(function (x) { return '<div class="phx-li warn" data-ico="⚠️">' + esc(x) + "</div>"; }).join("") + "</div>";
      }
      html += '<div class="phx-actions"><button type="button" class="btn" id="phx-g-back">← 返回平台列表</button></div>';
      wrap.innerHTML = html;
      $("#phx-g-back", wrap).addEventListener("click", function () { openPlatforms(); });
    }).catch(function (ex) {
      wrap.innerHTML = '<div class="phx-loading"><p>⚠️ ' + esc(ex.message) + "</p></div>" +
        '<div class="phx-actions"><button type="button" class="btn" id="phx-g-back2">← 返回平台列表</button></div>';
      var back = $("#phx-g-back2", wrap);
      if (back) back.addEventListener("click", function () { openPlatforms(); });
      if (ex.notConfigured) openAppSettings();
    });
  }

  /* ══════════════ 8. 启动 ══════════════
     门槛时机：海面入口（site）完整保留、不拦截；
     当原版应用把区域切到工作台（area === 'app'，即滚动到底/点击进入）时，
     若未登录才弹出登录卡片 —— 保留原版「下潜进工作台」的全部仪式感。 */

  function currentArea() {
    try { return (window.LH_UI && window.LH_UI.S && window.LH_UI.S.area) || null; } catch (e) { return null; }
  }

  function watchArea() {
    setInterval(function () {
      var UI = window.LH_UI;
      var area = currentArea();
      if (area === "app" && UI && UI.S) {
        /* 右侧面板常驻:任何情况下被收起(如按 Esc)都自动重新展开 */
        if (!UI.S.railOpen) {
          UI.S.railOpen = true;
          if (UI.renderRail) UI.renderRail();
        }
      }
      if (area !== "app") return;
      if (!token()) {
        showGate();
      } else if (!currentUser) {
        api("/api/auth/me").then(function (r) {
          afterAuth(r.user);
        }).catch(function () { showGate(); });
      }
    }, 700);
  }

  function hookTeamPersist() {
    var UI = window.LH_UI;
    if (!UI || !UI.actions) return;
    ["create-ws", "create-project"].forEach(function (act) {
      if (UI.actions[act] && !UI.actions[act].__phx) {
        var orig = UI.actions[act];
        UI.actions[act] = function () {
          orig();
          persistTeam();
        };
        UI.actions[act].__phx = true;
      }
    });
  }

  /* ══════════════ PC 端「演示按钮」统一接活 ══════════════
     原版很多按钮（创建补货单 / 登记证书 / 链接店铺…）没有任何处理，
     这里按按钮文字识别并接到真实记录接口，保存后可查看列表。 */
  var OPS_FORMS = {
    replenish: {
      label: "创建补货单", kind: "replenish",
      fields: [["name", "商品 / SKU"], ["qty", "补货数量"], ["eta", "预计到仓日（如 2026-11-01）"]],
      title: function (v) { return v.name + " · " + v.qty + " 件"; },
    },
    cert: {
      label: "登记证书", kind: "cert",
      fields: [["name", "证书类型（CE / FCC / FDA / 商标…）"], ["no", "证书编号"], ["expire", "到期日"]],
      title: function (v) { return v.name + " · " + v.no; },
    },
    store: {
      label: "链接店铺", kind: "store",
      fields: [["name", "店铺名称"], ["platform", "平台（Amazon / TikTok / 独立站…）"], ["url", "店铺链接"]],
      title: function (v) { return v.name + " · " + v.platform; },
    },
  };

  function openOpsForm(key) {
    if (!token()) { showGate(); return; }
    var cfg = OPS_FORMS[key];
    if (!cfg) return;
    var html = '<div class="modal-head"><h3>' + esc(cfg.label) + '</h3><button class="modal-close">✕</button></div>' +
      '<div class="modal-body">' +
      cfg.fields.map(function (f) {
        return '<div class="phx-field"><label>' + esc(f[1]) + '</label><input id="ops-' + f[0] + '"></div>';
      }).join("") +
      (key === "store" ? '<button class="btn" id="ops-verify" style="margin-bottom:10px">🔍 验证链接（真实访问）</button><div class="tiny" id="ops-vnote" style="margin-bottom:10px"></div>' : "") +
      '<div class="modal-actions"><button class="btn primary" id="ops-save">保存</button>' +
      '<button class="btn" id="ops-list">查看已有记录</button></div></div>';
    var m = openModal(html);
    var gather = function () {
      var v = {};
      cfg.fields.forEach(function (f) { v[f[0]] = ($("#ops-" + f[0], m).value || "").trim(); });
      return v;
    };
    var vf = $("#ops-verify", m);
    if (vf) vf.onclick = function () {
      var url = ($("#ops-url", m).value || "").trim();
      var note = $("#ops-vnote", m);
      if (!url) { note.textContent = "请先填店铺链接"; return; }
      note.textContent = "正在访问…";
      api("/api/verify-url", { method: "POST", body: JSON.stringify({ url: url }) })
        .then(function (r) { note.textContent = "✅ 可访问：" + (r.title || r.final_url) + "（HTTP " + r.status + "）"; })
        .catch(function (e) { note.textContent = "❌ " + e.message; });
    };
    $("#ops-save", m).onclick = function () {
      var v = gather();
      if (!v[cfg.fields[0][0]]) { toast("请先填写" + cfg.fields[0][1], "bad"); return; }
      api("/api/records", {
        method: "POST",
        body: JSON.stringify({ kind: cfg.kind, title: cfg.title(v), payload: v }),
      }).then(function () {
        closeModal();
        toast(cfg.label + "已保存", "ok");
        openRecords(cfg.kind, cfg.label);
      }).catch(function (e) { toast(e.message, "bad"); });
    };
    $("#ops-list", m).onclick = function () { closeModal(); openRecords(cfg.kind, cfg.label); };
  }

  function openRecords(kind, label) {
    api("/api/records?kind=" + encodeURIComponent(kind)).then(function (d) {
      var body = '<div class="phx-label">' + esc(label) + " · 已有 " + d.records.length + " 条</div>" +
        (d.records.length ? d.records.map(function (r) {
          return '<div class="phx-plat" style="margin-bottom:8px;padding:12px 14px;display:flex;align-items:center;gap:10px">' +
            "<b>" + esc(r.title) + '</b><span style="margin-left:auto;font-size:11px;color:var(--ink-3,#80809A)">' +
            new Date(r.created_at * 1000).toLocaleDateString() + "</span>" +
            '<button class="btn sm" data-del-rec="' + r.id + '">删除</button></div>';
        }).join("") : '<div class="phx-plat" style="padding:16px">还没有记录，点上方按钮创建</div>');
      var wrap = panelShell(label, "📋", "记录保存在服务器，团队成员共享", body);
      $$("[data-del-rec]", wrap).forEach(function (b) {
        b.addEventListener("click", function () {
          api("/api/records/" + b.getAttribute("data-del-rec"), { method: "DELETE" })
            .then(function () { closePanel(); openRecords(kind, label); });
        });
      });
    }).catch(handlePanelErr);
  }

  function hookDemoButtons() {
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!btn) return;
      var txt = (btn.textContent || "").trim();
      var map = { "创建补货单": "replenish", "登记证书": "cert", "链接店铺": "store", "添加店铺": "store" };
      var key = null;
      Object.keys(map).forEach(function (k) { if (txt.indexOf(k) >= 0) key = map[k]; });
      if (!key) return;
      e.preventDefault();
      e.stopPropagation();
      openOpsForm(key);
    }, true);
  }

  function boot() {
    hookCfgSave();
    watchArea();
    hookTeamPersist();
    hookTeamEdit();
    hookTeamAndTasks();
    hookOverviewCta();
    hookRailEmptyState();
    hookDemoButtons();
    if (token()) {
      api("/api/auth/me").then(function (r) {
        afterAuth(r.user);
      }).catch(function () {
        setToken("");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 60); });
  } else {
    setTimeout(boot, 60);
  }
})();
