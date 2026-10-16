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
    hideGate();
    mountAccountChip();
    ensureRightRail();
    toast("欢迎回来，" + ((user && user.username) || "商家"), "ok");
    if (user && user.company) {
      /* 公司名写入欢迎语，不做其它侵入性改动 */
      mountChipText();
    }
    syncCfgWithServer();
    mountDock();
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

  /* 登录后：服务器 ↔ 浏览器 双向补齐 */
  function syncCfgWithServer() {
    api("/api/settings").then(function (s) {
      var cfg = parseCfg();
      var cur = currentProvider(cfg);
      if (s && s.llm_configured && s.llm_api_key) {
        if (!cur || !cur.key) {
          /* 服务器已配置、浏览器没有 → 下发到浏览器（原版应用直接可用） */
          var pid = cfg.providerId || matchProviderId(s.llm_base_url);
          cfg.providerId = pid;
          cfg.enabled = true;
          cfg.depth = cfg.depth || "standard";
          cfg.byProvider = cfg.byProvider || {};
          cfg.byProvider[pid] = { base: s.llm_base_url, key: s.llm_api_key, model: s.llm_model };
          writeCfgRaw(cfg);
          toast("已从服务器同步 AI 配置，可直接使用智能体", "ok");
        }
      } else if (cur && cur.key) {
        /* 浏览器已配置、服务器没有 → 上报（让出海启动/平台对接也能用） */
        pushCfg(cur);
      }
    }).catch(function () { /* ignore */ });
  }

  /* ══════════════ 4. 悬浮入口（出海启动 / 平台对接） ══════════════ */

  function mountDock() {
    if ($("#phx-dock")) return;
    var dock = document.createElement("div");
    dock.id = "phx-dock";
    dock.innerHTML =
      '<button type="button" class="phx-dock-btn primary" id="phx-dock-launch">🚀 出海启动</button>' +
      '<button type="button" class="phx-dock-btn" id="phx-dock-platforms">🔗 平台对接</button>';
    document.body.appendChild(dock);
    $("#phx-dock-launch", dock).addEventListener("click", function () { openPanel("launch"); });
    $("#phx-dock-platforms", dock).addEventListener("click", function () { openPanel("platforms"); });
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
          (p.store_url ? '<div style="font-size:11.5px;color:var(--ink-3,#80809A);margin-bottom:10px">🔗 ' + esc(p.store_url) + "</div>" : "") +
          '<div class="ops">' +
          '<button type="button" class="btn sm phx-guide">🤖 AI 入驻指南</button>' +
          '<button type="button" class="btn sm primary phx-save">保存进度</button>' +
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
          body: JSON.stringify({ status: on.getAttribute("data-s") }),
        }).then(function () {
          toast("对接进度已保存", "ok");
        }).catch(handlePanelErr);
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
      var area = currentArea();
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

  function boot() {
    hookCfgSave();
    watchArea();
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
