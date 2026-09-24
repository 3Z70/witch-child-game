// =============================================================
// 《魔女捡到的孩子》 游戏逻辑
// =============================================================
"use strict";

const $ = (id) => document.getElementById(id);
const SAVE_KEY = "witch_child_save";
const GALLERY_KEY = "witch_child_gallery";

const STATE = {
  screen: "title",
  witchName: "",
  childName: "",
  pers: 0,        // 性格 0内向 1温柔 2偏执
  style: 0,       // 方式 0放养 1亲力亲为 2苛刻
  combo: 0,       // 组合编号 0-8
  round: 1,       // 当前回合 1..9
  stats: { q: 0, y: 0, p: 0, m: 0, r: 0, g: 0 },
  planned: null   // 待执行的下一回合（用于结果页后“继续”）
};

/* ---------- 工具 ---------- */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
  STATE.screen = id;
  window.scrollTo(0, 0);
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("on");
  void t.offsetWidth;
  t.classList.add("on");
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove("on"), 2200);
}

function applyFx(stats, fx) {
  if (!fx) return [];
  const arr = [];
  Object.keys(fx).forEach((k) => {
    if (typeof fx[k] !== "number" || fx[k] === 0) return;
    stats[k] += fx[k];
    arr.push({ k, v: fx[k] });
  });
  return arr;
}

/* 展示用：clamp 到 0-100（内部数值不截断，供结局判定） */
function disp(stats) {
  const out = {};
  Object.keys(stats).forEach((k) => (out[k] = Math.max(0, Math.min(100, stats[k]))));
  return out;
}

/* ---------- 结局判定 ---------- */
function checkCond(s, cond) {
  for (const c of cond) {
    const v = s[c.s];
    if (c.min !== undefined && v < c.min) return false;
    if (c.max !== undefined && v > c.max) return false;
  }
  return true;
}

function evaluateEnding(combo, stats) {
  const list = DATA.endings[combo + 1];
  for (const e of list) {
    if (checkCond(stats, e.cond)) return e;
  }
  // 没有完全满足时：取满足条件最多的结局，平手优先级 光>影>暗
  let best = null;
  let bestN = -1;
  list.forEach((e) => {
    let n = 0;
    e.cond.forEach((c) => {
      const v = stats[c.s];
      if (c.min !== undefined && v >= c.min) n++;
      if (c.max !== undefined && v <= c.max) n++;
    });
    if (n > bestN) {
      bestN = n;
      best = e;
    }
  });
  best = best || list[1];
  if (bestN < 1 && best) {
    // 完全无法满足（数据死角）时，改用兜底：影
    return list[1];
  }
  return best;
}

/* ---------- 存档 ---------- */
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      witchName: STATE.witchName,
      childName: STATE.childName,
      pers: STATE.pers,
      style: STATE.style,
      combo: STATE.combo,
      round: STATE.round,
      stats: STATE.stats,
      planned: STATE.planned
    }));
  } catch (e) { /* ignore */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (d.combo === undefined) return false;
    STATE.witchName = d.witchName;
    STATE.childName = d.childName;
    STATE.pers = d.pers;
    STATE.style = d.style;
    STATE.combo = d.combo;
    STATE.round = d.round;
    STATE.stats = d.stats;
    STATE.planned = d.planned || null;
    return true;
  } catch (e) {
    return false;
  }
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) { /* ignore */ }
}

function galleryAdd(code, type, title) {
  try {
    let g = [];
    try { g = JSON.parse(localStorage.getItem(GALLERY_KEY) || "[]"); } catch (e) { g = []; }
    if (!Array.isArray(g)) g = [];
    if (!g.some((x) => x.code === code)) {
      g.unshift({ code, type, title, witch: STATE.witchName, child: STATE.childName, time: Date.now() });
    }
    localStorage.setItem(GALLERY_KEY, JSON.stringify(g));
  } catch (e) { /* ignore */ }
}

function galleryGet() {
  try {
    const g = JSON.parse(localStorage.getItem(GALLERY_KEY) || "[]");
    return Array.isArray(g) ? g : [];
  } catch (e) {
    return [];
  }
}

/* ---------- 图鉴详情 ---------- */
function findEnding(code) {
  const n = parseInt(code.split("-")[0], 10);
  const list = DATA.endings[n];
  if (!list) return null;
  return list.find((e) => e.code === code) || null;
}

function openGalDetail(code) {
  const ending = findEnding(code);
  if (!ending) {
    toast("找不到这个结局了");
    return;
  }
  const g = galleryGet();
  const entry = g.find((x) => x.code === code) || {};
  const witch = entry.witch || "魔女";
  const child = entry.child || "孩子";
  const n = parseInt(code.split("-")[0], 10);

  closeModal();
  const ovl = $("gal-ovl");
  ovl.classList.remove("ending-light", "ending-shadow", "ending-dark");
  ovl.classList.add("ending-" + ending.key);

  $("gal-code").textContent = endingTag(ending);
  $("gal-route").textContent = "「" + (DATA.routeNames[n - 1] || "") + "」";
  $("gal-title").textContent = "《" + ending.title + "》";

  const cover = $("gal-cover");
  cover.onerror = () => $("gal-cover-wrap").classList.add("noimg");
  cover.onload = () => $("gal-cover-wrap").classList.remove("noimg");
  cover.src = "covers/" + n + ".webp";

  const pic = $("gal-pic");
  pic.onerror = () => $("gal-pic-wrap").classList.add("noimg");
  pic.onload = () => $("gal-pic-wrap").classList.remove("noimg");
  pic.src = "endings/" + ending.code + ".webp";

  $("gal-text").innerHTML = ending.body
    .replace(/\{魔女名\}/g, witch)
    .replace(/\{孩子名\}/g, child)
    .split("\n")
    .map((l) => { const t = l.trim(); return t ? "<p>" + t + "</p>" : "<br>"; })
    .join("");
  $("gal-mono").innerHTML = "“" + ending.mono
    .replace(/\{魔女名\}/g, witch)
    .replace(/\{孩子名\}/g, child)
    .split("\n")
    .map((l) => l.trim())
    .join("<br>") + "”";

  ovl.classList.add("on");
}

function closeGalDetail() {
  $("gal-ovl").classList.remove("on");
}

function bindGalDetail() {
  $("gal-ovl").onclick = (e) => {
    if (e.target === $("gal-ovl")) closeGalDetail();
  };
  $("btn-gal-back").onclick = () => {
    closeGalDetail();
    openGallery();
  };
  $("btn-gal-close").onclick = closeGalDetail;
}

/* ---------- 标题界面 ---------- */
function bindTitle() {
  $("btn-start").onclick = () => {
    showScreen("sc-custom");
    renderCustom();
  };
  $("btn-continue").onclick = () => {
    if (!loadGame()) {
      toast("没有可继续的存档");
      return;
    }
    enterGame();
  };
  $("btn-about").onclick = () => openModal("关于", "这是一个关于魔女与孩子的养成故事。\n\n你的每一个选择，都会改变他的未来。\n\n但无论结局如何，他都是爱着你的。", [{ label: "知道了" }]);
  $("btn-gallery").onclick = openGallery;
  refreshTitleButtons();
}

function refreshTitleButtons() {
  const has = !!localStorage.getItem(SAVE_KEY);
  $("btn-continue").classList.toggle("disabled", !has);
}

function openGallery() {
  const g = galleryGet();
  if (!g.length) {
    openModal("图鉴·回想", "还没有解锁任何结局。\n去养育一个孩子吧。", [{ label: "知道了" }]);
    return;
  }
  const map = { light: "光", shadow: "影", dark: "暗" };
  const item = (e) => {
    const key = e.key || map[e.type] || "shadow";
    const label = map[key] || e.type || "影";
    return '<div class="gal-item ' + key + '" data-code="' + e.code + '"><span class="gal-code">' + e.code + " · " + label + '</span><span class="gal-title">' + e.title + '</span><span class="gal-arrow">›</span></div>';
  };
  openModal("图鉴·回想（" + g.length + "/27）", g.map(item).join(""), [{ label: "关上" }]);
  document.querySelectorAll("#modal-body .gal-item").forEach((el) => {
    el.onclick = () => openGalDetail(el.dataset.code);
  });
}

/* ---------- 自定义界面 ---------- */
function renderCustom() {
  const persSel = document.querySelectorAll('input[name="pers"]');
  const styleSel = document.querySelectorAll('input[name="style"]');
  persSel.forEach((r) => (r.checked = false));
  styleSel.forEach((r) => (r.checked = false));
  $("in-witch").value = "";
  $("in-child").value = "";
  $("custom-hint").textContent = "";
}

function bindCustom() {
  const persBox = $("pers-wrap");
  const styleBox = $("style-wrap");
  persBox.innerHTML = "";
  styleBox.innerHTML = "";
  DATA.persons.forEach((p, i) => {
    const label = document.createElement("label");
    label.className = "opt tag";
    label.innerHTML = '<input type="radio" name="pers" value="' + i + '"><span>' + p + "</span>";
    persBox.appendChild(label);
  });
  DATA.styles.forEach((s, i) => {
    const label = document.createElement("label");
    label.className = "opt tag";
    label.innerHTML = '<input type="radio" name="style" value="' + i + '"><span>' + s + "</span>";
    styleBox.appendChild(label);
  });
  // 选择时联动显示路线名
  function routeHint() {
    const p = document.querySelector('input[name="pers"]:checked');
    const s = document.querySelector('input[name="style"]:checked');
    if (p && s) {
      const idx = +p.value * 3 + +s.value;
      $("route-hint").textContent = "路线：「" + DATA.routeNames[idx] + "」";
    } else {
      $("route-hint").textContent = "";
    }
  }
  persBox.onchange = routeHint;
  styleBox.onchange = routeHint;
  $("btn-begin-story").onclick = beginStory;
}

function beginStory() {
  const witch = $("in-witch").value.trim();
  const child = $("in-child").value.trim();
  const persRad = document.querySelector('input[name="pers"]:checked');
  const styleRad = document.querySelector('input[name="style"]:checked');
  if (!persRad || !styleRad) {
    $("custom-hint").textContent = "请选择孩子的性格与养育方式。";
    return;
  }
  STATE.witchName = witch || "阿芙拉";
  STATE.childName = child || "小夜";
  STATE.pers = +persRad.value;
  STATE.style = +styleRad.value;
  STATE.combo = STATE.pers * 3 + STATE.style;
  const combo = DATA.combos[STATE.combo];
  // 深拷贝初始值
  STATE.stats = {};
  Object.keys(combo.init).forEach((k) => (STATE.stats[k] = combo.init[k]));
  STATE.round = 1;
  STATE.planned = null;
  saveGame();
  showCover();
}

/* ---------- 路线封面 ---------- */
function showCover() {
  const combo = DATA.combos[STATE.combo];
  $("cover-img").style.backgroundImage = 'url("covers/' + (STATE.combo + 1) + '.webp")';
  $("cover-route").textContent = "「" + combo.route + "」";
  showScreen("sc-cover");
}

function bindCover() {
  $("btn-cover-enter").onclick = enterGame;
}

/* ---------- 主游戏 ---------- */
function enterGame() {
  refreshTitleButtons();
  showScreen("sc-game");
  if (STATE.planned) {
    renderResult();
  } else {
    renderGame();
  }
}

function renderGame() {
  const combo = DATA.combos[STATE.combo];
  const roundData = combo.rounds[STATE.round - 1];

  $("g-round").textContent = "回合 " + STATE.round + " / 10";
  $("g-witch").textContent = "魔女：" + STATE.witchName;
  $("g-child").textContent = "孩子：" + STATE.childName;
  $("g-route").textContent = "路线：「" + combo.route + "」";
  renderStats();

  $("g-title").textContent = "第 " + STATE.round + " 回合 · " + roundData.t;
  $("g-text").textContent = roundData.text;
  $("g-text").classList.remove("hidden");

  const box = $("g-choices");
  box.innerHTML = "";
  const act = $("g-result");
  act.classList.add("hidden");
  $("g-choices").classList.remove("hidden");

  [roundData.a, roundData.b].forEach((c, i) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = (i === 0 ? "A. " : "B. ") + c.t;
    btn.onclick = () => pickChoice(c);
    box.appendChild(btn);
  });
}

function renderStats() {
  const d = disp(STATE.stats);
  const box = $("g-stats");
  box.innerHTML = "";
  ["q", "y", "p", "m", "r", "g"].forEach((k) => {
    const raw = STATE.stats[k];
    const v = d[k];
    const item = document.createElement("div");
    item.className = "stat";
    const pct = Math.max(0, Math.min(100, v));
    item.innerHTML =
      '<div class="stat-label">' +
      DATA.statLabels[k] +
      ' <b>' + v + "</b>" +
      (raw < 0 || raw > 100 ? '<span class="raw">' + raw + "</span>" : "") +
      "</div>" +
      '<div class="bar"><div class="fill ' + (raw < 0 ? "neg" : raw > 100 ? "over" : "") + '" style="width:' + pct + '%"></div></div>';
    box.appendChild(item);
  });
}

function pickChoice(c) {
  STATE.planned = { result: c.r, fx: applyFx(STATE.stats, c.fx) };
  saveGame();
  renderResult();
}

function renderResult() {
  const p = STATE.planned;
  const combo = DATA.combos[STATE.combo];
  $("g-title").textContent = "第 " + STATE.round + " 回合 · " + combo.rounds[STATE.round - 1].t + " —— 你的选择";
  $("g-text").classList.add("hidden");
  $("g-choices").classList.add("hidden");

  const act = $("g-result");
  act.classList.remove("hidden");
  const resText = $("res-text");
  resText.textContent = p.result;
  const fxBox = $("res-fx");
  fxBox.innerHTML = "";
  if (p.fx.length) {
    p.fx.forEach((f) => {
      const span = document.createElement("span");
      const sign = f.v > 0 ? "+" : "";
      span.textContent = DATA.statLabels[f.k] + " " + sign + f.v;
      span.className = f.v > 0 ? "fx-pos" : "fx-neg";
      fxBox.appendChild(span);
    });
  } else {
    const span = document.createElement("span");
    span.textContent = "（没有数值变化）";
    span.className = "fx-zero";
    fxBox.appendChild(span);
  }

  renderStats();

  const cont = $("btn-continue-round");
  const isLast = STATE.round >= 9;
  cont.textContent = isLast ? "…… 迎来结局" : "进入下一回合";
  cont.onclick = nextRound;
}

function nextRound() {
  if (STATE.round < 9) {
    STATE.round++;
    STATE.planned = null;
    saveGame();
    renderGame();
  } else {
    const combo = DATA.combos[STATE.combo];
    const ending = evaluateEnding(STATE.combo, STATE.stats);
    galleryAdd(ending.code, ending.key, ending.title);
    clearSave();
    showEnding(ending, combo.route);
  }
}

/* ---------- 结局弹窗 ---------- */
function bindEndModal() {
  $("end-ovl").onclick = (e) => {
    if (e.target === $("end-ovl")) {
      showScreen("sc-title");
      refreshTitleButtons();
    }
  };
}

function endingTag(ending) {
  return "结局 " + ending.code + " · " +
    (ending.key === "light" ? "光" : ending.key === "shadow" ? "影" : "暗");
}

function showEnding(ending, routeName) {
  const ovl = $("end-ovl");
  ovl.classList.remove("ending-light", "ending-shadow", "ending-dark");
  ovl.classList.add("ending-" + ending.key);

  $("end-m-code").textContent = endingTag(ending);
  $("end-m-title").textContent = "《" + ending.title + "》";
  $("end-m-text").innerHTML = ending.body
    .replace(/\{魔女名\}/g, STATE.witchName)
    .replace(/\{孩子名\}/g, STATE.childName)
    .split("\n")
    .map((l) => { const t = l.trim(); return t ? "<p>" + t + "</p>" : "<br>"; })
    .join("");
  $("end-m-mono").innerHTML = "“" + ending.mono
    .replace(/\{魔女名\}/g, STATE.witchName)
    .replace(/\{孩子名\}/g, STATE.childName)
    .split("\n")
    .map((l) => l.trim())
    .join("<br>") + "”";
  const img = $("end-pic");
  img.onerror = () => $("end-pic-wrap").classList.add("noimg");
  img.onload = () => $("end-pic-wrap").classList.remove("noimg");
  img.src = "endings/" + ending.code + ".webp";

  $("btn-end-again").onclick = () => {
    const combo = DATA.combos[STATE.combo];
    STATE.stats = {};
    Object.keys(combo.init).forEach((k) => (STATE.stats[k] = combo.init[k]));
    STATE.round = 1;
    STATE.planned = null;
    saveGame();
    ovl.classList.remove("on");
    showCover();
  };
  $("btn-end-restart").onclick = () => {
    ovl.classList.remove("on");
    showScreen("sc-custom");
    renderCustom();
  };
  $("btn-end-title").onclick = () => {
    ovl.classList.remove("on");
    showScreen("sc-title");
    refreshTitleButtons();
  };

  ovl.classList.add("on");
}

/* ---------- 主界面底部按钮 ---------- */
function bindGameBar() {
  $("btn-save").onclick = () => {
    saveGame();
    toast("已存档");
  };
  $("btn-load").onclick = () => {
    if (!loadGame()) {
      toast("没有存档");
      return;
    }
    enterGame();
  };
  $("btn-settings").onclick = openSettings;
}

function openSettings() {
  const has = !!localStorage.getItem(SAVE_KEY);
  openModal("设置", has ? "当前有自动存档，继续游戏时会自动载入。" : "游戏会在每次选择后自动存档。",
    [
      { label: "清除存档", cls: "danger", cb: () => { clearSave(); refreshTitleButtons(); toast("存档已清除"); } },
      { label: "回到标题", cb: () => { showScreen("sc-title"); refreshTitleButtons(); } },
      { label: "继续游戏", cls: "primary" }
    ]);
}

/* ---------- 通用 Modal ---------- */
function openModal(title, text, buttons) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = text.split("\n").map((l) => l.trim() ? "<p>" + l.trim() + "</p>" : "<br>").join("");
  const foot = $("modal-foot");
  foot.innerHTML = "";
  (buttons || [{ label: "知道了" }]).forEach((b) => {
    const btn = document.createElement("button");
    btn.className = "mbtn " + (b.cls || "");
    btn.textContent = b.label;
    btn.onclick = () => {
      closeModal();
      if (b.cb) b.cb();
    };
    foot.appendChild(btn);
  });
  $("modal-ovl").classList.add("on");
}

function closeModal() {
  $("modal-ovl").classList.remove("on");
}

/* ---------- 背景粒子 ---------- */
function spawnParticles() {
  const box = $("fx");
  if (!box) return;
  for (let i = 0; i < 40; i++) {
    const d = document.createElement("div");
    d.className = "part" + (i % 3 === 0 ? " p2" : i % 5 === 0 ? " p3" : "");
    d.style.left = Math.random() * 100 + "vw";
    d.style.animationDuration = 9 + Math.random() * 14 + "s";
    d.style.animationDelay = -Math.random() * 20 + "s";
    box.appendChild(d);
  }
}

/* ---------- 初始化 ---------- */
function init() {
  spawnParticles();
  bindTitle();
  bindCustom();
  bindCover();
  bindGameBar();
  bindEndModal();
  bindGalDetail();
  $("modal-ovl").onclick = (e) => {
    if (e.target === $("modal-ovl")) closeModal();
  };
  refreshTitleButtons();
}

document.addEventListener("DOMContentLoaded", init);