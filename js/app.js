/* app.js — 포켓몬 체스 챔피언십 화면 전체
 *
 * 구역: 저장 · 소리 · 화면 틀 · 잠금 · 홈 · 스쿨(말 미션) · 판 화면 공통 · 미션 · 대결 · 개념 수업 · 배지 · 리그 · 돌아보기 · 도감 · 보호자 · 새 버전
 * 규칙·분석은 rules/game/engine/analyze/mentor/school/puzzle/ranking 에 있다 (Node 로 시험).
 */
"use strict";
const TEST = /[?&]test\b/.test(location.search);
window.TEST = TEST;
const $ = (q, el) => (el || document).querySelector(q);
const $$ = (q, el) => [...(el || document).querySelectorAll(q)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const C = window.Chess, V = window.VoiceLines, L = V.L, T = V.T, Ct = window.Content;
const sleep = (ms) => new Promise((r) => setTimeout(r, TEST ? 0 : ms));
const app = () => $("#app");

// iPad 사파리의 100vh 는 주소창·아래 막대 뒤까지 쳐서 판 아래가 잘린다 → 실제로 보이는 높이를 --vh 로 쓴다
function setVH() {
  const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
  document.documentElement.style.setProperty("--vh", h / 100 + "px");
}
setVH();
window.addEventListener("resize", setVH);
window.addEventListener("orientationchange", () => setTimeout(setVH, 300));
if (window.visualViewport) window.visualViewport.addEventListener("resize", setVH);

// =====================================================================
// 저장 (localStorage 한 키)
// =====================================================================
const Store = {
  key: "pokechess.v1",
  data: null,
  fresh() {
    return {
      v: 1, name: "지온이",
      school: {}, concepts: {}, review: [], badges: {}, badgeLoss: {},
      league: { cls: "normal", rank: Ct.START_RANK, wins: 0, losses: 0, draws: 0, beaten: [], lossStreak: 0, promoted: false },
      game: null, moments: [], stamps: 0, captures: {},
      settings: { voice: true, sfx: true, skin: "poke", help: "auto", unlockAll: false },
      lastRankDay: 0, seenWelcome: false,
    };
  },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.key) || "null"); } catch (e) { d = null; }
    const f = this.fresh();
    this.data = d ? Object.assign(f, d, { settings: Object.assign(f.settings, d.settings || {}), league: Object.assign(f.league, d.league || {}) }) : f;
  },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* 사생활 보호 모드 */ } },
  reset() { this.data = this.fresh(); this.save(); },
};
Store.load();
if (TEST) { Store.data = Store.fresh(); }
const S = () => Store.data;

// =====================================================================
// 소리 — 음성은 <audio> 요소 하나, 효과음만 Web Audio (pad-mic-record 규칙)
// =====================================================================
const SFX = {
  ctx: null, gain: null,
  ensure() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !this.ctx) { this.ctx = new AC(); this.gain = this.ctx.createGain(); this.gain.gain.value = 0.16; this.gain.connect(this.ctx.destination); }
    if (this.ctx && this.ctx.state !== "running") this.ctx.resume().catch(() => {});
  },
  tone(notes, type) {
    if (!S().settings.sfx || TEST || !this.ctx || this.ctx.state !== "running") return;
    let t = this.ctx.currentTime;
    for (const [f, d, v] of notes) {
      if (f) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type || "square"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.8, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + d + 0.02);
      }
      t += d;
    }
  },
  tap() { this.tone([[660, 0.05, 0.5]], "triangle"); },
  move() { this.tone([[440, 0.05, 0.5], [560, 0.06, 0.4]], "triangle"); },
  cap() { this.tone([[880, 0.05], [660, 0.05], [990, 0.09]], "square"); },
  star() { this.tone([[880, 0.07], [1175, 0.07], [1568, 0.14]], "triangle"); },
  no() { this.tone([[220, 0.12, 0.4]], "sawtooth"); },
  bad() { this.tone([[330, 0.12], [220, 0.25]], "sawtooth"); },
  win() { this.tone([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.12], [784, 0.1], [1047, 0.35]]); },
  rank() { this.tone([[523, 0.06], [659, 0.06], [784, 0.06], [1047, 0.06], [1319, 0.2]], "triangle"); },
};
const Voice = {
  el: null, token: 0, unlocked: false,
  key(s) {
    return String(s).replace(/[\u{1F000}-\u{1FAFF}☀-➿️‍⚡]/gu, "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC")
      .toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9'가-힣]+/g, " ").trim();
  },
  unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* */ }
    SFX.ensure();
    if (this.unlocked) return;
    this.el = new Audio();
    this.el.preload = "auto";
    this.el.setAttribute("playsinline", "");
    this.el.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    const p = this.el.play();
    if (p && p.catch) p.catch(() => {});
    this.unlocked = true;
  },
  stop() {
    this.token++;
    if (this.el) { try { this.el.pause(); } catch (e) { /* */ } }
    if (this._end) { this._end(); this._end = null; }
  },
  playOne(text, my) {
    return new Promise((resolve) => {
      if (my !== this.token) return resolve();
      const file = window.VOICE && window.VOICE[this.key(text)];
      let done = false;
      const end = () => { if (!done) { done = true; this._end = null; resolve(); } };
      this._end = end;
      if (!file || !this.el) { setTimeout(end, Math.min(2600, 120 * String(text).length)); return; }
      this.el.onended = end; this.el.onerror = end;
      this.el.src = "assets/voice/" + file;
      const p = this.el.play();
      if (p && p.catch) p.catch(end);
      setTimeout(end, 12000);
    });
  },
  /** 문장들을 차례로 읽는다. 새 말이 오면 하던 말은 끊는다 */
  speak(list) {
    if (TEST || !S().settings.voice) return Promise.resolve();
    this.stop();
    const my = this.token;
    return (async () => { for (const t of list) { if (my !== this.token) return; await this.playOne(t, my); } })();
  },
};
document.addEventListener("pointerdown", () => Voice.unlock(), { capture: true });

// =====================================================================
// 화면 틀
// =====================================================================
function screen(cls, html) {
  Voice.stop();
  $$(".layer").forEach((x) => x.remove());
  const a = app();
  a.className = "screen " + cls;
  a.innerHTML = html;
  window.scrollTo(0, 0);
  return a;
}
function layer(cls, html) {
  const d = document.createElement("div");
  d.className = "layer " + cls;
  d.innerHTML = html;
  document.body.appendChild(d);
  return d;
}
function waitPick(el) {
  return new Promise((res) => {
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]");
      if (b) { SFX.tap(); res(b.dataset.v); }
    });
  });
}
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), 2200);
}
const spr = (n) => `assets/sprites/${n}.png`;
const trn = (n) => `assets/trainers/${n}.png`;
const stars3 = (n) => "⭐".repeat(n || 0) + "☆".repeat(3 - (n || 0));
const today = () => Ranking.dayOf();

// =====================================================================
// 진행 잠금
// =====================================================================
const pieceStage = (p) => (S().school[p] && S().school[p].stage) || 0;
const pieceDone = (p) => pieceStage(p) >= 6;
const pieceOpen = (p) => S().settings.unlockAll || Ct.ORDER.indexOf(p) === 0 || pieceDone(Ct.ORDER[Ct.ORDER.indexOf(p) - 1]);
const allPieces = () => Ct.ORDER.every(pieceDone);
const conceptDone = (id) => !!S().concepts[id];
function conceptOpen(id) {
  if (S().settings.unlockAll) return true;
  const i = Ct.CONCEPTS.findIndex((c) => c.id === id);
  return i === 0 ? allPieces() : conceptDone(Ct.CONCEPTS[i - 1].id);
}
const needDone = (need) => (need.length === 1 ? pieceDone(need) : conceptDone(need));
const badgeOpen = (b) => S().settings.unlockAll || needDone(b.need);
const badgeCount = () => Ct.BADGES.filter((b) => S().badges[b.id]).length;
const leagueOpen = () => S().settings.unlockAll || badgeCount() >= 8;
const needName = (need) => (need.length === 1 ? Ct.PIECES[need].name + " 배우기" : Ct.CONCEPTS.find((c) => c.id === need).title + " 수업");

// =====================================================================
// 홈
// =====================================================================
function renderHome() {
  const lg = S().league;
  screen("screen-home", `
    <div class="home">
      <header class="title-box">
        <img class="title-pika" src="${spr(25)}" alt="">
        <div><h1>포켓몬 체스<br><span>챔피언십</span></h1><p class="sub">피카츄와 함께 진짜 체스를 배워요</p></div>
        <img class="title-trophy" src="${trn("leon")}" alt="">
      </header>
      <nav class="menu">
        <button class="mbtn school" data-go="school"><b>🏫</b><span>포켓몬 스쿨</span><small>말 하나씩 배우기</small></button>
        <button class="mbtn badge ${Ct.BADGES.some(badgeOpen) ? "" : "locked"}" data-go="badges"><b>🏅</b><span>배지 도전</span><small>${badgeCount()} / 8 배지</small></button>
        <button class="mbtn league ${leagueOpen() ? "" : "locked"}" data-go="league"><b>🏆</b><span>월드 챔피언십</span><small>${leagueOpen() ? lg.rank.toLocaleString() + "위" : "배지 8개 필요"}</small></button>
        <button class="mbtn dex" data-go="dex"><b>📘</b><span>도감</span><small>친구 · 트레이너 · 배지</small></button>
      </nav>
      <footer class="foot">
        <button class="btn small ghost" data-go="parent">🔒 어른</button>
        ${S().settings.unlockAll ? '<span class="unlock-tag">🔓 어른 모드: 모두 열림</span>' : ""}
        <span class="ver">v${esc(APP_VERSION)}<span id="updFoot"></span></span>
        ${Update.ver ? '<button class="btn small primary" data-go="update">🎁 새 버전으로 바꾸기</button>' : ""}
      </footer>
    </div>`);
  app().onclick = (e) => {
    const b = e.target.closest("[data-go]");
    if (!b) return;
    SFX.tap();
    const go = b.dataset.go;
    if (go === "school") renderSchool();
    else if (go === "badges") Ct.BADGES.some(badgeOpen) ? renderBadges() : sayToast(L.lockedBadge);
    else if (go === "league") leagueOpen() ? renderLeague() : sayToast(L.lockedLeague);
    else if (go === "dex") renderDex("pieces");
    else if (go === "parent") renderParent();
    else if (go === "update") applyUpdate();
  };
  if (!S().seenWelcome) { S().seenWelcome = true; Store.save(); Voice.speak([L.welcome]); }
  if (Update.ver && !Update.shown) checkUpdate(true); else checkUpdate();
}
function sayToast(text) { toast(text); Voice.speak([text]); }

// =====================================================================
// 스쿨
// =====================================================================
function renderSchool() {
  const cards = Ct.ORDER.map((p) => {
    const P = Ct.PIECES[p], st = pieceStage(p), open = pieceOpen(p);
    const dots = [0, 1, 2, 3, 4, 5].map((i) => `<i class="${i < st ? "on" : ""}"></i>`).join("");
    return `<button class="pcard ${open ? "" : "locked"} ${pieceDone(p) ? "done" : ""}" data-p="${p}">
      <img src="${spr(P.dex)}" alt=""><b>${P.name}</b><small>${P.chess} ${P.glyph}</small><div class="dots">${dots}</div>${open ? "" : '<span class="lock">🔒</span>'}</button>`;
  }).join("");
  const lessons = Ct.CONCEPTS.map((c) => {
    const open = conceptOpen(c.id), st = S().concepts[c.id];
    return `<button class="lcard ${open ? "" : "locked"} ${st ? "done" : ""}" data-c="${c.id}"><b>${c.icon}</b><span>${esc(c.title)}</span><small>${st ? stars3(st.stars) : open ? "새 수업!" : "🔒"}</small></button>`;
  }).join("");
  screen("screen-list", `
    <div class="list-page">
      <div class="topbar"><button class="btn icon" data-v="home" aria-label="뒤로">◀</button><h2>🏫 포켓몬 스쿨</h2></div>
      <h3 class="sec">말 친구들 <small>왼쪽부터 차례로</small></h3>
      <div class="pgrid">${cards}</div>
      <h3 class="sec">체스 수업 <small>여섯 친구를 다 배우면 열려요</small></h3>
      <div class="lgrid">${lessons}</div>
    </div>`);
  app().onclick = (e) => {
    if (e.target.closest('[data-v="home"]')) return renderHome();
    const pc = e.target.closest("[data-p]");
    if (pc) {
      SFX.tap();
      const p = pc.dataset.p;
      if (!pieceOpen(p)) return sayToast(L.lockedPiece);
      // 모두 열기거나 이미 배운 말이면 단계를 골라 들어간다
      if (S().settings.unlockAll || pieceDone(p)) return pickStage(p);
      return startPiece(p);
    }
    const lc = e.target.closest("[data-c]");
    if (lc) { SFX.tap(); return conceptOpen(lc.dataset.c) ? startConcept(lc.dataset.c) : sayToast(L.lockedLesson); }
  };
}

// =====================================================================
// 판 화면 공통
// =====================================================================
let P = {}; // 지금 판을 다루는 쪽 (미션·퍼즐·대결)
let lastSay = [];
function playScreen(o) {
  P = {};
  screen("screen-play", `
    <div class="play">
      <div class="bwrap"><div id="board"></div></div>
      <aside class="side">
        <div class="sbar"><button class="btn icon" id="exitBtn" aria-label="나가기">⏸</button><div class="stitle">${esc(o.title)}</div></div>
        <div class="steps" id="steps"></div>
        <div class="opp hidden" id="opp"></div>
        <div class="mentor"><img class="pika" src="${spr(25)}" alt=""><div class="bubble"><p id="say"></p><button class="btn icon small" id="replay" aria-label="다시 듣기">🔊</button></div></div>
        <div class="info" id="info"></div>
        <div class="tools" id="tools"></div>
      </aside>
    </div>`);
  const board = Board.create($("#board"), {
    onDown: (sq) => (P.onDown ? P.onDown(sq) : false),
    onDrop: (f, t) => P.onDrop && P.onDrop(f, t),
  });
  board.skin = S().settings.skin;
  $("#replay").onclick = () => { Voice.speak(lastSay); };
  $("#exitBtn").onclick = () => { SFX.tap(); (o.onExit || renderHome)(); };
  return board;
}
function say(texts) {
  texts = [].concat(texts || []).filter(Boolean);
  if (!texts.length) return Promise.resolve();
  lastSay = texts;
  const p = $("#say");
  if (p) { p.textContent = texts.join(" "); const b = p.parentNode; b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
  return Voice.speak(texts);
}
function setInfo(html) { const i = $("#info"); if (i) i.innerHTML = html; }
function setTools(html, handler) {
  const t = $("#tools");
  if (!t) return;
  t.innerHTML = html;
  t.onclick = (e) => { const b = e.target.closest("[data-t]"); if (b && !b.disabled) { SFX.tap(); handler(b.dataset.t); } };
}
function setSteps(list, cur) {
  const el = $("#steps");
  if (!el) return;
  el.innerHTML = list.map((x, i) => `<span class="${i < cur ? "on" : i === cur ? "cur" : ""}">${esc(x)}</span>`).join("");
}
/** 옆 칸에 "다음" 같은 버튼을 띄우고 누를 때까지 기다린다 */
function askSide(buttons) {
  return new Promise((res) => {
    setTools(buttons.map(([v, label, cls]) => `<button class="btn big ${cls || ""}" data-t="${v}">${label}</button>`).join(""), (v) => res(v));
  });
}
/** 검정이 노리는 칸 (빈칸·흰 말 칸) */
function attackedSquares(s) {
  const out = [];
  for (let i = 0; i < 64; i++) if ((!s.b[i] || s.b[i] < "a") && C.attacked(s, i, "b")) out.push(i);
  return out;
}

// =====================================================================
// 말 하나 배우기 (plan §4.1)
// =====================================================================
/** 단계 고르기 (모두 열기 또는 다 배운 말) */
function pickStage(p) {
  const PC = Ct.PIECES[p], stages = Ct.stagesFor(p), st = pieceStage(p);
  const d = layer("modal", `<div class="win-box stage-pick"><h2><img src="${spr(PC.dex)}" alt=""> ${PC.name} (${PC.chess} ${PC.glyph})</h2>
    <div class="stage-list">${stages.map((x, i) => `<button class="btn big ${i < st ? "done" : ""}" data-v="${i}">${i + 1}. ${esc(x.title)}${i < st ? " ✅" : ""}</button>`).join("")}</div>
    <div class="row"><button class="btn big" data-v="close">닫기</button></div></div>`);
  waitPick(d).then((v) => { d.remove(); if (v !== "close") startPiece(p, +v); });
}

async function startPiece(p, from) {
  const PC = Ct.PIECES[p];
  const stages = Ct.stagesFor(p);
  let idx = from != null ? from : Math.min(pieceStage(p), 5);
  if (pieceDone(p) && from == null) idx = 0;
  const board = playScreen({ title: `${PC.name} (${PC.chess} ${PC.glyph})`, onExit: renderSchool });
  P.board = board;
  while (idx < stages.length) {
    setSteps(stages.map((x) => x.title), idx);
    const st = stages[idx];
    let ok;
    if (st.kind === "meet") ok = await stageMeet(board, p);
    else if (st.kind === "battle") ok = await stageBattle(board, p);
    else ok = await stageMissions(board, p, st);
    if (!ok) return;
    const rec = S().school[p] || (S().school[p] = { stage: 0 });
    // 차례대로 해낸 단계만 기록 (어른 모드로 건너뛰어 끝낸 단계는 진도에 안 넣는다)
    if (idx <= rec.stage) rec.stage = Math.max(rec.stage, idx + 1);
    Store.save();
    idx++;
    if (idx < stages.length) {
      say(L.stageDone);
      const v = await askSide([["next", "다음 단계 ▶", "primary"], ["out", "그만하기"]]);
      if (v === "out") return renderSchool();
    }
  }
  SFX.win();
  setSteps(stages.map((x) => x.title), stages.length);
  say(L.pieceDone);
  setInfo(`<div class="done-card"><img src="${spr(PC.dex)}"><b>${PC.name}</b><span>체스 이름: ${PC.chess} ${PC.glyph}</span><span>⚡ ${PC.value || "∞"}</span></div>`);
  const v = await askSide([["school", "스쿨로 ▶", "primary"]]);
  if (v) renderSchool();
}

async function stageMeet(board, p) {
  const PC = Ct.PIECES[p];
  const s = School.stateOf(new Array(64).fill(null));
  const at = p === "P" ? C.sq("e2") : C.sq("d4");
  s.b[at] = p; if (p === "K") s.kings.w = at;
  board.set(s);
  const ms = C.moves(s);
  board.marks({ dots: ms.filter((m) => !m.cap).map((m) => m.to), glow: at });
  setInfo(`<div class="meet"><img src="${spr(PC.dex)}" alt=""><div><b>${PC.name}</b><span class="chessname">체스 이름: <em>${PC.chess}</em> <span class="bigglyph">${PC.glyph}</span></span><span>⚡ 에너지 ${PC.value || "대장"}</span></div></div>`);
  for (let i = 0; i < PC.story.length; i++) {
    say(PC.story[i]);
    const v = await askSide([["next", i < PC.story.length - 1 ? "다음 ▶" : "알겠어! ▶", "primary"]]);
    if (!v) return false;
  }
  return true;
}

async function stageMissions(board, p, st) {
  const kindSay = { stars: L.starsGo, starsDark: L.starsDarkGo, pawnBlock: L.pawnBlockGo, capture: p === "P" ? [L.captureGo, L.pawnCaptureGo] : L.captureGo, safe: p === "K" ? L.kingSafeGo : L.safeGo, cross: L.crossGo };
  for (let i = 0; i < st.n; i++) {
    const ms = School.gen(p, st.kind, Math.floor(Math.random() * 1e6) + i);
    const showDanger = st.kind === "safe" ? i === 0 || p === "K" : st.kind === "cross";
    let line = kindSay[st.kind];
    if (st.kind === "safe" && !showDanger) line = L.safeDarkGo;
    if (i === 0 && st.kind === "capture" && ms.frozen.size) line = [L.captureGo, L.frozenTip];
    const r = await runMission(board, ms, { line, showDanger, title: `${st.title} ${i + 1} / ${st.n}`, tip: Ct.PIECES[p].tip });
    if (!r) return false;
  }
  return true;
}

async function stageBattle(board, p) {
  const B = Ct.BATTLES[p];
  say([B.say]);
  setInfo(`<div class="battle-intro"><h3>⚔️ ${esc(B.title)}</h3><p>${esc(B.say)}</p></div>`);
  const v = await askSide([["go", "대결 시작! ▶", "primary"]]);
  if (!v) return false;
  for (;;) {
    let won;
    if (B.mission) {
      const ms = School.gen(p, "cross", Math.floor(Math.random() * 1e6));
      won = !!(await runMission(board, ms, { line: B.say, showDanger: true, title: B.title }));
    } else {
      const r = await runGame({ board, cfg: { fen: B.fen, goal: B.goal }, bot: B.bot, help: "battle", title: B.title });
      if (r.exit) return false;
      won = r.winner === "w";
    }
    if (won) return true;
    say(L.retry);
    const a = await askSide([["again", "다시 도전 ↺", "primary"], ["out", "그만하기"]]);
    if (a === "out") { renderSchool(); return false; }
  }
}

// =====================================================================
// 미션 (별 줍기·잡기·안전한 칸·건너가기)
// =====================================================================
function runMission(board, ms, o) {
  return new Promise((resolve) => {
    let st = School.start(ms), sel = -1, busy = false, hintStep = null;
    const draw = (extra) => {
      board.set(st.s);
      const legal = sel >= 0 ? School.legal(ms, st.s).filter((m) => m.from === sel) : [];
      board.marks(Object.assign({
        sel,
        dots: ms.show ? legal.filter((m) => !m.cap).map((m) => m.to) : [],
        caps: ms.show ? legal.filter((m) => m.cap).map((m) => m.to) : [],
        stars: [...st.stars], frozen: [...ms.frozen],
        red: o.showDanger ? attackedSquares(st.s) : [],
        glow: hintStep ? hintStep.from : undefined,
        arrows: hintStep ? [[hintStep.from, hintStep.to, "green"]] : [],
      }, extra || {}));
      const goalTxt = ms.goal === "stars" ? `⭐ 남은 별 ${st.stars.size}` : ms.goal === "capture" ? `남은 상대 ${st.s.b.filter((x) => x && x > "a").length}` : "맨 위 줄까지!";
      setInfo(`<div class="mission-info"><b>${esc(o.title)}</b><span>${goalTxt}</span><span>👣 ${st.steps}걸음${ms.kind === "starsDark" ? ` · 최소 ${ms.par}걸음` : ""}</span>${o.tip ? `<small>${esc(o.tip)}</small>` : ""}</div>`);
    };
    const tools = () => setTools(`<button class="btn" data-t="hint">💡 힌트</button><button class="btn" data-t="reset">↺ 처음부터</button>`, (t) => {
      if (busy) return;
      if (t === "reset") { st = School.start(ms); sel = -1; hintStep = null; draw(); }
      if (t === "hint") { hintStep = School.firstStep(st); sel = -1; draw(); say(L.hint2); }
    });
    const tryMove = async (from, to) => {
      const m = School.legal(ms, st.s).find((x) => x.from === from && x.to === to);
      if (!m) {
        SFX.no();
        const pm = C.pseudoMoves(st.s).find((x) => x.from === from && x.to === to);
        if (pm && st.s.b[from] === "K") { say(L.kingDanger); board.flash(to, "flash-red"); }
        else { say(Mentor.illegal(st.s, from, to)); board.shake(from); }
        return;
      }
      busy = true; hintStep = null;
      const before = st.s;
      await board.slide(m.from, m.to);
      const r = School.play(st, m);
      sel = -1;
      if (m.cap) SFX.cap(); else if (r.star) SFX.star(); else SFX.move();
      if (m.promo) say(L.evolved);
      draw();
      if (r.caught) {
        SFX.bad();
        await sleep(200);
        await board.slide(r.caught.by, r.caught.sq);
        say(L.caught);
        await sleep(1400);
        st = School.start(ms);
        draw();
        busy = false;
        return;
      }
      if (r.won) {
        SFX.win();
        const stars = ms.kind === "starsDark" ? School.starsFor(st) : 3;
        const doneLine = ms.goal === "stars" ? L.allStars : ms.goal === "capture" ? L.allCaptured : L.crossed;
        const extra = ms.kind === "starsDark" ? [stars === 3 ? L.star3 : stars === 2 ? L.star2 : L.star1] : [];
        setInfo(`<div class="win-card"><b>${stars3(stars)}</b><span>${esc(doneLine)}</span></div>`);
        await say([doneLine, ...extra]);
        await sleep(600);
        P = {};
        resolve({ stars });
        return;
      }
      busy = false;
      void before;
    };
    P = {
      board, kind: "mission", st: () => st, busy: () => busy,
      onDown(sq) {
        if (busy) return false;
        const p = st.s.b[sq];
        if (sel >= 0 && sq !== sel && !(p && p < "a" && !ms.frozen.has(sq))) { tryMove(sel, sq); return false; }
        if (p && p < "a") {
          if (ms.frozen.has(sq)) { say(L.sleeping); board.shake(sq); return false; }
          sel = sq; SFX.tap(); draw(); return true;
        }
        if (!p || p > "a") { if (sel < 0) say(L.pickPiece); }
        return false;
      },
      onDrop(f, t) { if (!busy) tryMove(f, t); },
    };
    $("#exitBtn").onclick = () => { P = {}; resolve(null); renderSchool(); };
    draw();
    tools();
    say(o.line);
  });
}

// =====================================================================
// 대결 (미니 대결 · 배지 · 리그 · 첫 걸음 수업)
// =====================================================================
/**
 * o: { board, cfg:{fen,goal}, bot(1~8|'race'|'raceEasy'), help:'full'|'half'|'ask'|'none'|'battle', title,
 *      trainer, hints, undos, resume:[uci], onSave(moves), afterKid(g, m) → 'stop'|null, review:true }
 * 돌려주는 값: { winner, reason, g, review:[], exit }
 */
function runGame(o) {
  return new Promise((resolve) => {
    const board = o.board;
    const goal = o.cfg.goal;
    const g = Game.create(o.cfg);
    for (const u of o.resume || []) { const m = Game.legal(g).find((x) => C.uci(x) === u); if (m) Game.play(g, m); }
    const help = o.help === "battle" ? "full" : o.help;
    const mateGoal = goal.type === "mate" || goal.type === "mateIn";
    const rng = Math.random;
    const ctx = { tipsSaid: new Set(), rng };
    let sel = -1, busy = false, values = null, valuesAt = -1, hintLv = 0, hintMove = null, hintMarks = {};
    let hintsLeft = o.hints == null ? Infinity : o.hints, undosLeft = o.undos == null ? Infinity : o.undos;
    const review = [];
    const ace = o.trainer ? o.trainer.ace : null;
    if (o.trainer) {
      const op = $("#opp");
      op.classList.remove("hidden");
      op.innerHTML = `<img class="tr" src="${trn(o.trainer.sprite)}" alt=""><div><b>${esc(o.trainer.name)}</b><small>대장: ${esc(o.trainer.aceName)} <img src="${spr(o.trainer.ace)}" alt=""></small></div><div class="capt" id="capt"></div>`;
    }
    const lastMove = () => (g.hist.length ? g.hist[g.hist.length - 1].m : null);
    const capturedRow = () => {
      const el = $("#capt");
      if (!el) return;
      const mine = [];
      for (const h of g.hist) if (h.m.cap && C.colorOf(h.m.p) === "w") mine.push(h.m.cap);
      el.innerHTML = mine.map((p) => `<img src="${spr(Board.DEX[p.toUpperCase()])}" alt="">`).join("");
    };
    const draw = () => {
      board.set(g.s, { ace });
      const lm = lastMove();
      let dots = [], caps = [], risky = [];
      if (sel >= 0) {
        const ms = Game.legal(g).filter((m) => m.from === sel);
        dots = ms.filter((m) => !m.cap).map((m) => m.to);
        caps = ms.filter((m) => m.cap).map((m) => m.to);
        if (help === "full" || help === "half") {
          // 가면 손해 보는 칸은 빨간 테두리
          risky = ms.filter((m) => (goal.type === "stars" ? C.attacked(C.make(g.s, m), m.to, "b") : Analyze.gain(g.s, m) < 0)).map((m) => m.to);
        }
      }
      board.marks(Object.assign({
        sel, dots, caps, risky,
        last: lm ? [lm.from, lm.to] : [],
        check: g.s.kings.w >= 0 && C.inCheck(g.s, "w") ? g.s.kings.w : g.s.kings.b >= 0 && C.inCheck(g.s, "b") ? g.s.kings.b : undefined,
        stars: g.stars ? [...g.stars] : [],
      }, hintMarks));
      capturedRow();
      const goalTxt = {
        mate: "체크메이트하면 이겨요", promote: "먼저 진화하면 이겨요", captureAll: `남은 상대 ${Game.count(g.s, "b")}`,
        points: `⚡ 나 ${C.material(g.s, "w")} : 상대 ${C.material(g.s, "b")} · 남은 수 ${Math.max(0, Math.ceil((goal.plies - g.hist.length) / 2))}`,
        mateIn: `남은 수 ${Math.max(0, Math.ceil((goal.plies - g.hist.length) / 2))}`, stars: `⭐ 나 ${g.score.w} : 상대 ${g.score.b}`,
      }[goal.type];
      setInfo(`<div class="game-info"><b>${esc(o.title)}</b><span>${goalTxt}</span>${o.extraInfo ? o.extraInfo(g) : ""}</div>`);
      tools();
    };
    const tools = () => {
      const kid = g.s.turn === "w" && !g.over && !busy;
      setTools(`
        <button class="btn" data-t="hint" ${kid && hintsLeft > 0 ? "" : "disabled"}>💡 힌트${hintsLeft !== Infinity ? " " + hintsLeft : ""}</button>
        <button class="btn" data-t="undo" ${kid && undosLeft > 0 && g.hist.length >= 2 ? "" : "disabled"}>↩ 무르기${undosLeft !== Infinity ? " " + undosLeft : ""}</button>`, onTool);
    };
    const onTool = (t) => {
      if (busy || g.s.turn !== "w" || g.over) return;
      if (t === "hint") {
        if (hintsLeft <= 0) return say(L.noHint);
        if (hintLv === 0) {
          hintsLeft--;
          if (goal.type === "stars") hintMove = School.raceBot(g, Math.random, "hard");
          else hintMove = mateGoal ? (Analyze.winningEndgame(g.s) ? Analyze.mateGuideMove(g.s) : Analyze.hintMove(g.s)) : (Engine.best(g.s, 2, goal) || {}).m;
        }
        hintLv = Math.min(3, hintLv + 1);
        const h = Mentor.hint(g.s, goal, hintLv, hintMove);
        if (h) { hintMarks = { glow: h.glow, rings: h.rings, arrows: h.arrows }; say(h.say); }
        sel = -1; draw();
      }
      if (t === "undo") {
        Game.undo(g, g.s.turn === "w" ? 2 : 1);
        undosLeft--; sel = -1; hintLv = 0; hintMarks = {};
        if (o.onSave) o.onSave(g.hist.map((h) => C.uci(h.m)));
        kidTurn(null);
      }
    };
    const finish = async () => {
      busy = true;
      sel = -1; hintMarks = {};
      draw();
      const r = g.over, w = r.winner;
      const line = resultLine(goal, r);
      if (w === "w") SFX.win(); else if (w === "b") SFX.bad();
      await say([line]);
      P = {};
      resolve({ winner: w, reason: r.reason, g, review });
    };
    const kidTurn = async (prev) => {
      busy = false; sel = -1; hintLv = 0; hintMarks = {}; values = null;
      draw();
      const tm = Mentor.turnStart(g.s, goal, help, ctx);
      const lines = [];
      if (prev) lines.push(prev.say[0]);
      if (tm) { lines.push(...(prev ? tm.say.slice(0, 1) : tm.say)); hintMarks = { glow: tm.glow, rings: tm.rings, arrows: tm.arrows }; draw(); }
      if (lines.length) say(lines);
      if (mateGoal && help !== "none" && g.s.kings.w >= 0) {
        const at = g.hist.length;
        setTimeout(() => { if (g.hist.length === at && !g.over) { values = Analyze.moveValues(g.s); valuesAt = at; } }, TEST ? 0 : 60);
      }
    };
    const botTurn = async () => {
      busy = true; draw();
      await sleep(650);
      let m;
      if (o.bot === "race" || o.bot === "raceEasy") m = School.raceBot(g, rng, o.bot === "raceEasy" ? "easy" : "normal");
      else m = Engine.pick(g.s, o.bot, goal, rng);
      if (!m) { g.over = Game.result(g, { p: "k", from: 0, to: 0 }) || { winner: null, reason: "nomoves" }; return finish(); }
      await board.slide(m.from, m.to);
      if (m.flag === "K" || m.flag === "Q") { /* 룩도 옮겨짐: set 으로 반영 */ }
      const before = g.s;
      Game.play(g, m);
      if (m.cap) SFX.cap(); else SFX.move();
      if (o.onSave) o.onSave(g.hist.map((h) => C.uci(h.m)));
      if (g.over) return finish();
      kidTurn(Mentor.afterTheirs(before, m, g.s));
    };
    const kidMove = async (m) => {
      busy = true;
      // 비기는 수(스테일메이트·앞서는데 세 번 반복) 막기 — 피카츄가 돕는 동안(마스터즈 에이트 전)은 늘
      const dw = help !== "none" ? Mentor.drawWarn(g.s, m, g.keys) : null;
      if (dw) {
        const go = await preview(m, dw);
        if (!go) { busy = false; sel = -1; draw(); return; }
      } else if (help !== "none" && mateGoal && values && valuesAt === g.hist.length) {
        const w = Mentor.warn(g.s, m, values, help);
        if (w) {
          const go = await preview(m, w);
          if (!go) { busy = false; sel = -1; draw(); say(L.cheer2); return; }
        }
      }
      if (values && valuesAt === g.hist.length) {
        const mine = values.find((x) => C.uci(x.m) === C.uci(m));
        if (mine) review.push({ fen: C.fen(g.s), uci: C.uci(m), loss: values[0].v - mine.v, best: C.uci(values[0].m), cap: m.cap, mate: Engine.isMateMove(g.s, m) });
      }
      hintMarks = {};
      await board.slide(m.from, m.to);
      const before = g.s;
      Game.play(g, m);
      if (m.cap) { SFX.cap(); S().captures[m.p.toUpperCase()] = (S().captures[m.p.toUpperCase()] || 0) + 1; } else SFX.move();
      if (o.onSave) o.onSave(g.hist.map((h) => C.uci(h.m)));
      sel = -1;
      draw();
      if (g.over) return finish();
      if (o.afterKid && o.afterKid(g, m) === "stop") { g.over = { winner: "w", reason: "lesson" }; P = {}; resolve({ winner: "w", reason: "lesson", g, review }); return; }
      const am = Mentor.afterMine(before, m, g.s, goal, help);
      const sp = am ? say(am.say) : null;
      if (am && am.arrows && am.arrows.length) { hintMarks = { arrows: am.arrows }; draw(); hintMarks = {}; }
      if (sp && !TEST) await Promise.race([sp, sleep(2200)]);
      botTurn();
    };
    const preview = async (m, w) => {
      const t = C.make(g.s, m);
      await board.slide(m.from, m.to, { ghost: true });
      board.set(t, { ace });
      if (w.refute) {
        board.marks({ arrows: [[w.refute.from, w.refute.to, "red"]], last: [m.from, m.to] });
        await sleep(350);
        await board.slide(w.refute.from, w.refute.to, { ghost: true });
      } else {
        // 스테일메이트·반복: 상대 대장을 빨갛게 (갈 곳이 없어요)
        board.marks({ last: [m.from, m.to], red: t.kings.b >= 0 ? [t.kings.b] : [] });
        if (t.kings.b >= 0) board.flash(t.kings.b, "flash-red");
      }
      say(w.say);
      const v = await askSide([["back", "🤔 다시 생각할래", "primary"], ["go", "그래도 둘래"]]);
      board.set(g.s, { ace });
      return v === "go";
    };
    P = {
      board, kind: "game", g, goal, busy: () => busy,
      onDown(sq) {
        if (busy || g.over || g.s.turn !== "w") return false;
        const p = g.s.b[sq];
        if (sel >= 0 && sq !== sel && !(p && p < "a")) { attempt(sel, sq); return false; }
        if (p && p < "a") { sel = sq; SFX.tap(); draw(); return true; }
        if (p) say(L.notYours);
        return false;
      },
      onDrop(f, t) { if (!busy) attempt(f, t); },
    };
    const attempt = (from, to) => {
      const m = Game.legal(g).find((x) => x.from === from && x.to === to);
      if (!m) {
        SFX.no();
        const txt = g.s.kings.w >= 0 ? Mentor.illegal(g.s, from, to) : L.illegal;
        say(txt);
        board.shake(from);
        return;
      }
      kidMove(m);
    };
    $("#exitBtn").onclick = async () => {
      if (busy && g.s.turn === "w") return;
      say(L.exitAsk);
      const v = await askSide([["stay", "계속하기 ▶", "primary"], ["exit", o.onSave ? "나중에 이어 하기" : "나가기"]]);
      if (v === "exit") { P = {}; Voice.stop(); resolve({ exit: true, g }); (o.onExit || renderHome)(); }
      else draw();
    };
    if (g.s.turn === "w") kidTurn(null); else botTurn();
  });
}
function resultLine(goal, r) {
  const w = r.winner;
  if (!w) return r.reason === "stalemate" ? L.stalemate : L.draw;
  const win = w === "w";
  switch (goal.type) {
    case "promote": return win ? L.promoWin : L.promoLose;
    case "captureAll": return win ? L.huntWin : L.huntLose;
    case "points": return win ? L.pointsWin : L.pointsLose;
    case "mateIn": return win ? L.win : L.mateInFail;
    case "stars": return win ? (r.reason === "allCaptured" ? L.winRace : L.starsWin) : (r.reason === "allCaptured" ? L.loseRace : L.starsLose);
    default: return win ? L.win : L.lose;
  }
}

// =====================================================================
// 개념 수업 (plan §4.3)
// =====================================================================
async function startConcept(id) {
  const c = Ct.CONCEPTS.find((x) => x.id === id);
  const board = playScreen({ title: `${c.icon} ${c.title}`, onExit: renderSchool });
  const empty = C.parse("8/8/8/8/8/8/8/8 w - - 0 1");
  board.set(empty); board.marks({});
  setSteps(["설명", "연습"], 0);
  for (const step of c.intro) {
    if (step.fen) { board.set(C.parse(step.fen)); board.marks({ rings: step.ring || [], arrows: (step.arrows || []).map((a) => [a[0], a[1], "blue"]) }); }
    say(step.say);
    setInfo(`<div class="lesson-text">${esc(step.say)}</div>`);
    const v = await askSide([["next", "다음 ▶", "primary"]]);
    if (!v) return;
  }
  setSteps(["설명", "연습"], 1);
  let mistakes = 0;
  const t = c.task;
  const wrongIds = [];
  // 복습 먼저 (틀렸던 다른 수업 문제, 최대 2개)
  const due = S().review.filter((r) => r.due <= Date.now() && r.pool !== t.pool).slice(0, 2);
  if (due.length && t.pool) {
    say(L.reviewFirst);
    await sleep(1200);
    for (const r of due) {
      const pz = (window.PUZZLES[r.pool] || []).find((x) => x.id === r.id);
      const lesson = Ct.CONCEPTS.find((x) => x.task.pool === r.pool);
      if (!pz || !lesson) continue;
      const res = await runPuzzle(board, lesson.task, pz, "복습");
      if (res === null) return;
      if (res === 0) { r.due = Date.now() + 3 * 86400e3; r.step = (r.step || 0) + 1; if (r.step >= 2) S().review = S().review.filter((x) => x !== r); }
      else r.due = Date.now() + 86400e3;
      Store.save();
    }
  }
  if (t.type === "setup") { const r = await runSetup(board); if (r === null) return; mistakes = r; }
  else if (t.type === "opening") { const r = await runOpening(board); if (r === null) return; }
  else {
    const pool = (window.PUZZLES[t.pool] || []).slice().sort(() => Math.random() - 0.5).slice(0, t.n);
    for (let i = 0; i < pool.length; i++) {
      const r = await runPuzzle(board, t, pool[i], `${i + 1} / ${pool.length}`);
      if (r === null) return;
      mistakes += r;
      if (r > 0) wrongIds.push(pool[i].id);
    }
  }
  for (const wid of wrongIds) if (!S().review.some((x) => x.id === wid)) S().review.push({ pool: t.pool, id: wid, due: Date.now() + 86400e3 });
  const stars = mistakes <= 1 ? 3 : mistakes <= 3 ? 2 : 1;
  const prev = S().concepts[id];
  S().concepts[id] = { stars: Math.max(stars, prev ? prev.stars : 0) };
  Store.save();
  SFX.win();
  setInfo(`<div class="win-card"><b>${stars3(stars)}</b><span>${esc(L.lessonDone)}</span></div>`);
  say(L.lessonDone);
  const v = await askSide([["school", "스쿨로 ▶", "primary"]]);
  if (v) renderSchool();
}

/** 퍼즐 하나 → 틀린 횟수 (나가면 null) */
function runPuzzle(board, task, pz, label) {
  P = {};
  return new Promise((resolve) => {
    let s = C.parse(pz.fen), mistakes = 0, sel = -1, busy = false, found = new Set(), hint = {};
    const isTap = task.type === "tap" || (pz.piece && !pz.check);
    const kind = pz.check ? "move" : isTap ? "tap" : task.type;
    const answer = isTap ? Puzzle.tapAnswer(pz) : null;
    const out = (v) => { P = {}; resolve(v); };
    $("#exitBtn").onclick = () => { P = {}; resolve(null); renderSchool(); };
    const draw = (extra) => {
      board.set(s);
      const ms = sel >= 0 ? C.moves(s).filter((m) => m.from === sel) : [];
      board.marks(Object.assign({
        sel, dots: ms.filter((m) => !m.cap).map((m) => m.to), caps: ms.filter((m) => m.cap).map((m) => m.to),
        glow: isTap ? C.sq(pz.piece) : undefined, ticks: [...found],
        check: s.kings[s.turn] >= 0 && C.inCheck(s) ? s.kings[s.turn] : undefined,
        arrows: pz.arrow ? [[pz.arrow[0], pz.arrow[1], "blue"]] : [],
        moved: kind === "castle" && pz.answer === "moved" ? [pz.side === "K" ? "h1" : "a1"] : [],
      }, hint, extra || {}));
    };
    const info = (q) => setInfo(`<div class="puzzle-info"><small>${esc(label)}</small><b>${esc(q)}</b></div>`);
    const success = async (lines) => {
      busy = true;
      SFX.star();
      setInfo(`<div class="win-card"><b>⭕</b><span>${esc(lines.join(" "))}</span></div>`);
      await say(lines);
      await sleep(500);
      out(mistakes);
    };
    const miss = (line) => { mistakes++; SFX.no(); say([line]); };

    if (kind === "tap") {
      info(task.say);
      say(task.say);
      P = {
        kind: "tap", pz, answer, busy: () => busy,
        onDown(sq) {
          if (busy) return false;
          if (answer.includes(sq)) {
            if (found.has(sq)) return false;
            found.add(sq); SFX.tap(); draw();
            if (found.size === answer.length) success([L.tapDone]);
            else say(L.tapMore);
          } else if (sq !== C.sq(pz.piece)) { miss(L.tapWrong); board.shake(sq); }
          return false;
        },
      };
      setTools(`<button class="btn" data-t="hint">💡 힌트</button>`, () => { hint = { rings: answer.filter((x) => !found.has(x)).slice(0, 1) }; draw(); });
      draw();
      return;
    }
    if (kind === "trade" || kind === "classify" || kind === "castle") {
      const vx = pz.arrow ? C.VALUE[C.typeOf(s.b[C.sq(pz.arrow[0])])] : 0, vy = pz.arrow ? C.VALUE[C.typeOf(s.b[C.sq(pz.arrow[1])])] : 0;
      let q, opts, answerV, explain;
      if (kind === "trade") {
        q = `⚡${vx} 친구로 ⚡${vy} 친구를 잡으면, 상대 리오르가 다시 잡아. 이득일까?`;
        opts = [["gain", "👍 이득"], ["loss", "👎 손해"], ["even", "🤝 똑같아"]];
        answerV = pz.answer;
        explain = { gain: L.tradeGain, loss: L.tradeLoss, even: L.tradeEven }[pz.answer];
        say(task.say);
      } else if (kind === "classify") {
        q = task.say;
        opts = [["mate", "👑 체크메이트"], ["stalemate", "🤝 스테일메이트"], ["play", "▶ 아직 둘 수 있어"]];
        answerV = pz.answer;
        explain = { mate: L.clsMate, stalemate: L.clsStalemate, play: L.clsPlay }[pz.answer];
        say(q);
      } else {
        q = pz.side === "K" ? L.castleShortQ : L.castleLongQ;
        opts = [["ok", "⭕ 할 수 있어"], ["no", "❌ 못 해"]];
        answerV = pz.answer === "ok" ? "ok" : "no";
        explain = { ok: L.castleOk, between: L.castleBetween, check: L.castleCheck, through: L.castleThrough, moved: L.castleMoved }[pz.answer];
        say(q);
      }
      info(q);
      draw();
      P = { kind: "choice", answer: answerV, busy: () => busy };
      const ask = async () => {
        const v = await askSide(opts.map(([a, b]) => [a, b, "choice"]));
        if (v !== answerV) { miss(L.wrong); await sleep(900); return ask(); }
        if (kind === "castle" && answerV === "ok") {
          // 직접 캐슬링해 보기
          say(L.castleOk);
          info(L.castleOk);
          setTools("", () => {});
          P = {
            onDown(sq) {
              if (busy) return false;
              const p = s.b[sq];
              if (sel >= 0 && sq !== sel) {
                const m = C.moves(s).find((x) => x.from === sel && x.to === sq);
                if (m && (m.flag === "K" || m.flag === "Q")) {
                  busy = true;
                  board.slide(m.from, m.to).then(() => { s = C.make(s, m); sel = -1; draw(); success([L.castleDone]); });
                } else { miss(L.castleOk); sel = -1; draw(); }
                return false;
              }
              if (p === "K") { sel = sq; draw(); return true; }
              return false;
            },
            onDrop(f, t) { P.onDown(f); P.onDown(t); },
          };
          return;
        }
        success([L.right, explain]);
      };
      ask();
      return;
    }
    // 수 두기 퍼즐
    const qText = task.say;
    info(qText);
    say(qText);
    const goodMoves = () => C.moves(s).filter((m) => Puzzle.checkMove(pz, s, m).ok);
    setTools(`<button class="btn" data-t="hint">💡 힌트</button>`, () => {
      const g = goodMoves()[0];
      if (!g) return;
      hint = hint.glow === undefined ? { glow: g.from } : { glow: g.from, arrows: [[g.from, g.to, "green"]] };
      draw();
      say(hint.arrows ? L.hint2 : T.moveIt(g.p));
    });
    const attempt = async (from, to) => {
      const m = C.moves(s).find((x) => x.from === from && x.to === to);
      if (!m) {
        const pm = C.pseudoMoves(s).find((x) => x.from === from && x.to === to);
        if (pm) { miss(Mentor.illegal(s, from, to)); } else { SFX.no(); say(L.illegal); }
        board.shake(from);
        return;
      }
      busy = true; hint = {};
      const r = Puzzle.checkMove(pz, s, m);
      const s0 = s;
      await board.slide(m.from, m.to);
      s = C.make(s, m);
      sel = -1; draw();
      if (r.ok) {
        const howLine = { run: L.howRun, capture: L.howCapture, block: L.howBlock, guard: L.howGuard }[r.how];
        const escLine = { run: L.escRun, capture: L.escCapture, block: L.escBlock }[r.how];
        const extra = pz.check === "save" ? howLine : pz.check === "escape" ? escLine : pz.check === "mate" ? L.win : null;
        return success([L.right, extra].filter(Boolean));
      }
      miss({ notCapture: L.notCapture, badTrade: L.badTrade, stillHanging: L.stillHanging, noCheck: L.noCheck, onlyCheck: L.onlyCheck, noMate: L.noMate }[r.how] || L.wrong);
      await sleep(1300);
      s = s0; draw(); busy = false;
    };
    P = {
      kind: "puzzle", pz, s: () => s, busy: () => busy,
      onDown(sq) {
        if (busy) return false;
        const p = s.b[sq];
        if (sel >= 0 && sq !== sel && !(p && p < "a")) { attempt(sel, sq); return false; }
        if (p && p < "a") { sel = sq; SFX.tap(); draw(); return true; }
        if (p) say(L.notYours);
        return false;
      },
      onDrop(f, t) { if (!busy) attempt(f, t); },
    };
    draw();
  });
}

/** C1 판 차리기 → 틀린 횟수 */
function runSetup(board) {
  return new Promise((resolve) => {
    const start = C.parse(C.START);
    const s = C.parse("rnbqkbnr/pppppppp/8/8/8/8/8/8 w - - 0 1");
    const need = { P: 8, R: 2, N: 2, B: 2, Q: 1, K: 1 };
    let pick = null, mistakes = 0;
    $("#exitBtn").onclick = () => { P = {}; resolve(null); renderSchool(); };
    const tray = () => {
      setTools(Object.keys(need).map((k) => `<button class="btn tray ${pick === k ? "primary" : ""}" data-t="${k}" ${need[k] ? "" : "disabled"}><img src="${spr(Board.DEX[k])}" alt=""><span>${need[k]}</span></button>`).join(""), (k) => { pick = k; tray(); draw(); });
    };
    const draw = () => {
      board.set(s);
      const spots = [];
      if (pick) for (let i = 0; i < 16; i++) if (!s.b[i] && start.b[i] === pick) spots.push(i);
      board.marks({ dots: S().settings.help === "none" ? [] : [] });
      setInfo(`<div class="puzzle-info"><b>${esc(L.setupGo)}</b><small>${pick ? Ct.PIECES[pick].name + "를 어디에 세울까?" : "아래에서 친구를 골라요"}</small></div>`);
      void spots;
    };
    P = {
      kind: "setup", need, pick: (k) => { pick = k; tray(); },
      onDown(sq) {
        if (!pick) { say(L.setupGo); return false; }
        if (!s.b[sq] && start.b[sq] === pick) {
          s.b[sq] = pick; need[pick]--; SFX.tap();
          if (!need[pick]) pick = Object.keys(need).find((k) => need[k]) || null;
          tray(); draw();
          if (Object.values(need).every((n) => n === 0)) { SFX.win(); say(L.setupDone).then(() => { P = {}; resolve(mistakes); }); if (TEST) { P = {}; resolve(mistakes); } }
        } else { mistakes++; SFX.no(); say(L.setupWrong); board.flash(sq, "flash-red"); }
        return false;
      },
    };
    say(L.setupGo);
    tray(); draw();
  });
}

/** C12 첫 걸음 세 약속: 봇 1 과 두면서 가운데·꺼내기·캐슬링 */
async function runOpening(board) {
  const got = { center: false, develop: false, castle: false };
  const extraInfo = () => `<ul class="goals"><li class="${got.center ? "on" : ""}">${got.center ? "✅" : "⬜"} 가운데 차지하기</li><li class="${got.develop ? "on" : ""}">${got.develop ? "✅" : "⬜"} 친구 둘 꺼내기</li><li class="${got.castle ? "on" : ""}">${got.castle ? "✅" : "⬜"} 캐슬링</li></ul>`;
  for (;;) {
    got.center = got.develop = got.castle = false;
    const r = await runGame({
      board, cfg: { fen: C.START, goal: { type: "mate" } }, bot: 1, help: "full", title: "첫 걸음 세 약속", extraInfo,
      afterKid(g, m) {
        const s = g.s;
        if (!got.center && [27, 28, 35, 36].some((i) => s.b[i] === "P")) { got.center = true; say(L.goalCenter); }
        const out = Analyze.undeveloped(s, "w").length;
        if (!got.develop && out <= 2) { got.develop = true; say(L.goalDevelop); }
        if (!got.castle && (m.flag === "K" || m.flag === "Q")) { got.castle = true; say(L.goalCastle); }
        if (got.center && got.develop && got.castle) { SFX.win(); say(L.goalAll); return "stop"; }
        return null;
      },
    });
    if (r.exit) return null;
    if (r.reason === "lesson") { await sleep(1500); return 0; }
    say(L.retry);
    const v = await askSide([["again", "다시 ↺", "primary"]]);
    if (!v) return null;
  }
}

// =====================================================================
// 배지 도전 (plan §5)
// =====================================================================
function renderBadges() {
  const cards = Ct.BADGES.map((b) => {
    const open = badgeOpen(b), got = S().badges[b.id];
    return `<button class="bcard ${open ? "" : "locked"} ${got ? "got" : ""}" data-b="${b.id}">
      <span class="bicon">${got ? Ct.BADGE_ICON[b.id] : open ? b.icon : "🔒"}</span><b>${esc(b.title)}</b>
      <small>${got ? stars3(got.stars) : open ? "도전!" : esc(needName(b.need))}</small></button>`;
  }).join("");
  screen("screen-list", `
    <div class="list-page">
      <div class="topbar"><button class="btn icon" data-v="home" aria-label="뒤로">◀</button><h2>🏅 배지 도전 <small>${badgeCount()} / 8</small></h2></div>
      <p class="hint-line">배지 8개를 모으면 월드 챔피언십에 나갈 수 있어요!</p>
      <div class="bgrid">${cards}</div>
    </div>`);
  app().onclick = (e) => {
    if (e.target.closest('[data-v="home"]')) return renderHome();
    const c = e.target.closest("[data-b]");
    if (!c) return;
    SFX.tap();
    const b = Ct.BADGES.find((x) => x.id === +c.dataset.b);
    if (!badgeOpen(b)) { toast(`${needName(b.need)}를 먼저 끝내면 열려요!`); return Voice.speak([L.lockedBadge]); }
    startBadge(b);
  };
}
async function startBadge(b) {
  const board = playScreen({ title: `${b.icon} ${b.title}`, onExit: renderBadges });
  board.set(C.parse(b.fen));
  board.marks({ stars: b.goal.stars || [] });
  say([b.say]);
  setInfo(`<div class="battle-intro"><h3>${b.icon} ${esc(b.title)}</h3><p>${esc(b.say)}</p></div>`);
  if (!(await askSide([["go", "도전 시작! ▶", "primary"]]))) return;
  for (;;) {
    const loss = S().badgeLoss[b.id] || 0;
    const bot = typeof b.bot === "number" ? Math.max(1, b.bot - (loss >= 2 ? 1 : 0)) : loss >= 2 ? "raceEasy" : b.bot;
    let usedHelp = 0;
    const r = await runGame({ board, cfg: { fen: b.fen, goal: b.goal }, bot, help: "full", title: b.title, onExit: renderBadges });
    if (r.exit) return;
    usedHelp = 0;
    if (r.winner === "w") {
      S().badgeLoss[b.id] = 0;
      const stars = r.g.hist.length < 80 ? 3 : 2;
      const prev = S().badges[b.id];
      const first = !prev;
      S().badges[b.id] = { stars: Math.max(stars, prev ? prev.stars : 0) };
      if (b.id === 8 && first) S().moments.push({ fen: C.fen(r.g.s), title: "첫 진짜 체스 승리!", at: Date.now() });
      Store.save();
      void usedHelp;
      const allNow = badgeCount() === 8;
      setInfo(`<div class="win-card"><b class="badge-big">${Ct.BADGE_ICON[b.id]}</b><span>${esc(b.title)} 배지!</span></div>`);
      await say([L.badgeGet, allNow && first ? L.allBadges : null]);
      const v = await askSide([["list", "배지 목록 ▶", "primary"], ...(allNow ? [["league", "🏆 월드 챔피언십"]] : [])]);
      return v === "league" ? renderLeague() : renderBadges();
    }
    S().badgeLoss[b.id] = loss + 1;
    Store.save();
    const v = await askSide([["again", "다시 도전 ↺", "primary"], ["list", "배지 목록"]]);
    if (v !== "again") return renderBadges();
  }
}

// =====================================================================
// 월드 챔피언십 (plan §7)
// =====================================================================
function nextOpponent() {
  const lg = S().league;
  if (lg.cls !== "normal") return null;
  if (lg.wins >= Ct.NORMAL_LINE.length) return Ct.NORMAL_PROMO;
  return Ct.NORMAL_LINE[lg.wins];
}
function renderLeague() {
  const lg = S().league;
  const day = today();
  const cls = Ct.CLASSES.find((c) => c.id === lg.cls);
  const me = { rank: lg.rank, name: S().name, wins: lg.wins, rivalBeat: !!lg.rivalBeat, rivalBeatDay: lg.rivalBeatDay };
  const bd = Ranking.board(day, me);
  const oppId = nextOpponent();
  const opp = oppId && Ct.TRAINERS[oppId];
  const rows = bd.near.map((x) => `<li class="${x.me ? "me" : ""} ${x.rival ? "rival" : ""}"><span class="rk">${x.rank.toLocaleString()}위</span>${x.me ? `<img src="${trn("ash")}" alt="">` : `<img src="${trn(x.sprite)}" alt="">`}<b>${esc(x.name)}</b>${x.rival ? "<em>라이벌</em>" : ""}</li>`).join("");
  const masters = bd.masters.map((x) => `<li class="master"><span class="rk">${x.rank}위</span><img src="${trn(x.sprite)}" alt=""><b>${esc(x.name)}</b></li>`).join("");
  screen("screen-list", `
    <div class="list-page league">
      <div class="topbar"><button class="btn icon" data-v="home" aria-label="뒤로">◀</button><h2>🏆 월드 챔피언십</h2></div>
      <div class="league-top">
        <div class="mycard"><img src="${trn("ash")}" alt=""><div><small>${cls.ball} ${cls.name}</small><b class="myrank">${lg.rank.toLocaleString()}위</b><span>${lg.wins}승 ${lg.losses}패 ${lg.draws}무</span></div></div>
        ${opp ? `<div class="oppcard"><small>${opp.promo ? "⭐ 승급전" : opp.rival ? `⚔️ 라이벌전! (${lg.wins + 1}/${Ct.NORMAL_LINE.length})` : `다음 상대 (${lg.wins + 1}/${Ct.NORMAL_LINE.length})`}</small><img src="${trn(opp.sprite)}" alt=""><b>${esc(opp.name)}</b><span>대장 ${esc(opp.aceName)} <img src="${spr(opp.ace)}" alt=""></span>
          <button class="btn big primary" data-v="match">${S().game ? "이어서 두기 ▶" : "대결! ▶"}</button></div>`
          : `<div class="oppcard"><b>🔵 슈퍼 클래스</b><span>${esc(L.superSoon)}</span><button class="btn big primary" data-v="free">연습 대결 ▶</button></div>`}
      </div>
      ${S().settings.unlockAll ? `<div class="free-pick"><h3 class="sec">🔓 상대 고르기 <small>(어른 모드 · 다음 상대가 아니면 연습 대결이라 순위는 그대로)</small></h3>
        <div class="free-list">${[...Ct.NORMAL_LINE, ...Ct.NORMAL_EXTRA, Ct.NORMAL_PROMO].map((id) => { const t = Ct.TRAINERS[id]; return `<button class="btn free-opp" data-v="pick" data-id="${id}"><img src="${trn(t.sprite)}" alt=""><span>${esc(t.name)}</span><small>봇 ${t.bot}${t.promo ? " · 승급전" : ""}</small></button>`; }).join("")}</div></div>` : ""}
      <div class="ranks">
        <div><h3 class="sec">내 순위 둘레</h3><ol class="rlist">${rows}</ol></div>
        <div><h3 class="sec">🟣 마스터즈 에이트</h3><ol class="rlist">${masters}</ol></div>
      </div>
      <div class="news-box"><h3 class="sec">📰 오늘의 순위 소식</h3>${Ranking.news(day, me).map((n) => `<p>${esc(n)}</p>`).join("")}</div>
    </div>`);
  app().onclick = (e) => {
    const b = e.target.closest("[data-v]");
    if (!b) return;
    SFX.tap();
    if (b.dataset.v === "home") renderHome();
    if (b.dataset.v === "match") startMatch(oppId);
    if (b.dataset.v === "free") startMatch(Ct.NORMAL_LINE[Math.floor(Math.random() * 4)], true);
    if (b.dataset.v === "pick") startMatch(b.dataset.id, b.dataset.id !== oppId);
  };
  if (S().lastRankDay !== day) {
    S().lastRankDay = day; Store.save();
    Voice.speak(lg.wins + lg.losses === 0 ? [L.leagueHello] : [L.newsHello]);
  }
}
async function startMatch(oppId, practice) {
  const tr = Ct.TRAINERS[oppId];
  const lg = S().league;
  const saved = S().game && S().game.trainer === oppId ? S().game : null;
  const board = playScreen({ title: `${tr.promo ? "⭐ 승급전 · " : tr.rival ? "⚔️ 라이벌전 · " : ""}vs ${tr.name}`, onExit: renderLeague });
  board.set(C.parse(C.START), { ace: tr.ace });
  board.marks({});
  if (!saved) {
    setInfo(`${tr.rival ? `<div class="rival-banner">⚔️ 라이벌전 ⚔️</div>` : ""}<div class="vs"><img src="${trn("ash")}" alt=""><b>VS</b><img src="${trn(tr.sprite)}" alt=""></div><p class="tr-line">“${esc(tr.hello)}”</p>`);
    say(tr.rival ? [L.rivalIntro, tr.hello] : [tr.hello]);
    if (!(await askSide([["go", "대결 시작! ▶", "primary"]]))) return;
  }
  const lossStreak = lg.lossStreak || 0;
  const bot = Math.max(1, tr.bot - (lossStreak >= 2 ? 1 : 0)); // 두 번 지면 몰래 한 단계 약하게
  const help = S().settings.help === "auto" ? "full" : S().settings.help;
  const r = await runGame({
    board, cfg: { fen: C.START, goal: { type: "mate" } }, bot, help, title: tr.name, trainer: tr, onExit: renderLeague,
    resume: saved ? saved.moves : null,
    onSave: practice ? null : (moves) => { S().game = { trainer: oppId, moves }; Store.save(); },
  });
  if (r.exit) return;
  S().game = null;
  await afterMatch(tr, oppId, r, practice);
}
async function afterMatch(tr, oppId, r, practice) {
  const lg = S().league;
  const old = lg.rank;
  let promoted = false;
  if (!practice) {
    if (r.winner === "w") {
      lg.lossStreak = 0;
      if (tr.promo) { lg.rank = Ct.PROMO_RANK; lg.cls = "super"; promoted = true; }
      else { lg.rank = Ct.NORMAL_STEPS[Math.min(lg.wins, Ct.NORMAL_STEPS.length - 1)]; }
      lg.wins++;
      if (!lg.beaten.includes(oppId)) lg.beaten.push(oppId);
      if (tr.rival) { lg.rivalBeat = true; lg.rivalBeatDay = today(); }
      S().moments.push({ fen: C.fen(r.g.s), title: `${tr.name}에게 승리!`, at: Date.now() });
    } else if (r.winner === "b") { lg.losses++; lg.lossStreak = (lg.lossStreak || 0) + 1; }
    else lg.draws++;
    Store.save();
  }
  // 순위 변동 연출
  let passed = Ranking.passed(today(), old, lg.rank, lg.wins - 1);
  const rivalWin = !practice && tr.rival && r.winner === "w";
  if (rivalWin) passed = [{ id: "bea", name: "채두", sprite: "bea", rival: true }, ...passed.filter((x) => !x.rival)];
  const trLine = r.winner === "w" ? tr.bye : r.winner === "b" ? tr.win : null;
  const d = layer("modal", `<div class="win-box rank-box">
      <h2>${r.winner === "w" ? (rivalWin ? "⚔️ 라이벌 채두를 이겼어요!" : "🎉 승리!") : r.winner === "b" ? "😢 아쉬워요" : "🤝 비겼어요"}</h2>
      ${trLine ? `<p class="tr-say"><img src="${trn(tr.sprite)}" alt=""> “${esc(trLine)}”</p>` : ""}
      <div class="rank-roll"><small>세계 순위</small><b id="rollNum">${old.toLocaleString()}</b><span>위</span></div>
      <p id="rollMsg">${lg.rank < old ? `${(old - lg.rank).toLocaleString()}계단 올랐어요!` : esc(L.rankSame)}</p>
      <ul class="passed">${passed.slice(0, 5).map((x) => `<li><img src="${trn(x.sprite)}" alt=""> ${esc(x.name)} ${x.rival ? "<em>라이벌!</em>" : ""} ⬇</li>`).join("")}${passed.length > 5 ? `<li>…그리고 ${passed.length - 5}명 더!</li>` : ""}</ul>
      ${promoted ? `<p class="promo">🔵 ${esc(L.promoClass)}</p>` : ""}
      <div class="row"><button class="btn big primary" data-v="next">${r.review && r.review.length ? "돌아보기 ▶" : "계속 ▶"}</button></div></div>`);
  if (lg.rank < old) {
    SFX.rank();
    const el = $("#rollNum", d), t0 = performance.now(), dur = TEST ? 1 : 1600;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(old - (old - lg.rank) * e).toLocaleString();
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    Voice.speak(rivalWin ? [L.rivalWin, tr.bye] : [promoted ? L.promoClass : L.rankUp]);
  }
  await waitPick(d);
  d.remove();
  if (r.review && r.review.length && r.winner !== undefined) await runReview(r.review);
  renderLeague();
}

// =====================================================================
// 끝난 뒤 돌아보기 (plan §6.3)
// =====================================================================
async function runReview(list) {
  const best = list.filter((x) => x.loss <= 0 && (x.mate || (x.cap && C.VALUE[x.cap.toUpperCase()] >= 3))).pop();
  const mistakes = list.filter((x) => x.loss >= 3).sort((a, b) => b.loss - a.loss).slice(0, 2);
  if (!best && !mistakes.length) return;
  const board = playScreen({ title: "🔍 돌아보기", onExit: renderLeague });
  let quit = false;
  $("#exitBtn").onclick = () => { quit = true; P = {}; renderLeague(); };
  if (best) {
    const s = C.parse(best.fen);
    board.set(s);
    board.marks({ arrows: [[best.uci.slice(0, 2), best.uci.slice(2, 4), "green"]] });
    say([L.reviewTime, L.reviewBest]);
    setInfo(`<div class="lesson-text">⭐ ${esc(L.reviewBest)}</div>`);
    if (!(await askSide([["next", "다음 ▶", "primary"]])) || quit) return;
  }
  for (const mk of mistakes) {
    if (quit) return;
    const ok = await new Promise((resolve) => {
      let s = C.parse(mk.fen), sel = -1, tries = 0, busy = false;
      const vals = Analyze.moveValues(s);
      const bestV = vals[0].v;
      const draw = (extra) => { board.set(s); const ms = sel >= 0 ? C.moves(s).filter((m) => m.from === sel) : []; board.marks(Object.assign({ sel, dots: ms.filter((m) => !m.cap).map((m) => m.to), caps: ms.filter((m) => m.cap).map((m) => m.to), arrows: [[mk.uci.slice(0, 2), mk.uci.slice(2, 4), "red", "ghost"]] }, extra || {})); };
      say([L.reviewRetry]);
      setInfo(`<div class="lesson-text">🔁 ${esc(L.reviewRetry)}<br><small>빨간 점선 = 그때 둔 수</small></div>`);
      setTools(`<button class="btn" data-t="skip">건너뛰기 ▶</button>`, () => { P = {}; resolve(false); });
      P = {
        onDown(sq) {
          if (busy) return false;
          const p = s.b[sq];
          if (sel >= 0 && sq !== sel && !(p && p < "a")) {
            const m = C.moves(s).find((x) => x.from === sel && x.to === sq);
            if (!m) { say(Mentor.illegal(s, sel, sq)); return false; }
            const v = vals.find((x) => C.uci(x.m) === C.uci(m));
            if (v && v.v >= bestV - 1) {
              busy = true; S().stamps++; Store.save(); SFX.star();
              board.slide(m.from, m.to).then(() => { s = C.make(s, m); sel = -1; draw({ arrows: [] }); say([L.reviewGood]).then(() => { P = {}; resolve(true); }); if (TEST) { P = {}; resolve(true); } });
            } else {
              tries++; SFX.no(); say(L.reviewTryAgain); sel = -1;
              draw(tries >= 2 ? { arrows: [[mk.uci.slice(0, 2), mk.uci.slice(2, 4), "red", "ghost"], [mk.best.slice(0, 2), mk.best.slice(2, 4), "green"]] } : {});
            }
            return false;
          }
          if (p && p < "a") { sel = sq; draw(); return true; }
          return false;
        },
      };
      draw();
    });
    void ok;
  }
  if (!quit) { say(L.reviewDone); await sleep(800); }
}

// =====================================================================
// 도감 (plan §8)
// =====================================================================
function renderDex(tab) {
  const tabs = [["pieces", "친구들"], ["trainers", "트레이너"], ["badges", "배지"], ["moments", "명장면"]];
  let body = "";
  if (tab === "pieces") {
    body = `<div class="dgrid">${Ct.ORDER.map((p) => {
      const PC = Ct.PIECES[p], done = pieceDone(p);
      return `<div class="dcard ${done ? "" : "unknown"}"><img src="${spr(PC.dex)}" alt=""><b>${done ? PC.name : "???"}</b>
        <span>${done ? `${PC.chess} ${PC.glyph}` : "스쿨에서 배우면 등록"}</span>${done ? `<small>⚡ ${PC.value || "대장"} · 잡은 횟수 ${S().captures[p] || 0}</small><small class="tip">${esc(PC.tip)}</small>` : ""}</div>`;
    }).join("")}</div>`;
  } else if (tab === "trainers") {
    const ids = [...Ct.NORMAL_LINE, Ct.NORMAL_PROMO];
    body = `<div class="dgrid">${ids.map((id) => {
      const t = Ct.TRAINERS[id], won = S().league.beaten.includes(id);
      return `<div class="dcard ${won ? "" : "unknown"}"><img src="${trn(t.sprite)}" alt=""><b>${won ? esc(t.name) : "???"}</b><span>${won ? `대장 ${esc(t.aceName)}` : "이기면 등록"}</span>${won ? `<img class="ace" src="${spr(t.ace)}" alt="">` : ""}</div>`;
    }).join("")}</div>`;
  } else if (tab === "badges") {
    body = `<div class="bgrid">${Ct.BADGES.map((b) => { const got = S().badges[b.id]; return `<div class="bcard ${got ? "got" : "locked"}"><span class="bicon">${got ? Ct.BADGE_ICON[b.id] : "❔"}</span><b>${esc(b.title)}</b><small>${got ? stars3(got.stars) : ""}</small></div>`; }).join("")}</div>
      <p class="hint-line">⭐ 돌아보기 도장 ${S().stamps}개</p>`;
  } else {
    const ms = S().moments.slice(-12).reverse();
    body = ms.length ? `<div class="mgrid">${ms.map((m) => `<div class="moment">${miniBoard(m.fen)}<b>${esc(m.title)}</b><small>${new Date(m.at).toLocaleDateString("ko-KR")}</small></div>`).join("")}</div>` : `<p class="hint-line">이긴 판이 여기에 그림으로 남아요!</p>`;
  }
  screen("screen-list", `
    <div class="list-page">
      <div class="topbar"><button class="btn icon" data-v="home" aria-label="뒤로">◀</button><h2>📘 도감</h2></div>
      <div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${k === tab ? "on" : ""}" data-tab="${k}">${n}</button>`).join("")}</div>
      ${body}
    </div>`);
  app().onclick = (e) => {
    if (e.target.closest('[data-v="home"]')) return renderHome();
    const t = e.target.closest("[data-tab]");
    if (t) { SFX.tap(); renderDex(t.dataset.tab); }
  };
}
function miniBoard(fen) {
  const s = C.parse(fen);
  let h = '<div class="mini">';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const i = (7 - y) * 8 + x, p = s.b[i];
    h += `<i class="${C.isLight(i) ? "l" : "d"}">${p ? `<img src="${spr(Board.DEX[p.toUpperCase()])}" class="${p < "a" ? "" : "bk"}" alt="">` : ""}</i>`;
  }
  return h + "</div>";
}

// =====================================================================
// 보호자 화면 (🔒 곱셈 잠금)
// =====================================================================
function renderParent() {
  const a = 12 + Math.floor(Math.random() * 28), b = 3 + Math.floor(Math.random() * 7);
  const d = layer("modal", `<div class="win-box gate"><h2>🔒 어른 확인</h2><p>${a} × ${b} = ?</p><input id="gateIn" inputmode="numeric" autocomplete="off"><div class="row"><button class="btn big primary" data-v="ok">확인</button><button class="btn big" data-v="no">닫기</button></div></div>`);
  setTimeout(() => $("#gateIn").focus(), 50);
  waitPick(d).then((v) => {
    const ok = +$("#gateIn").value === a * b || TEST;
    d.remove();
    if (v === "ok" && ok) renderParentPage();
    else if (v === "ok") toast("틀렸어요");
  });
}
function renderParentPage() {
  const st = S().settings;
  const done = Ct.ORDER.filter(pieceDone).length, cdone = Ct.CONCEPTS.filter((c) => conceptDone(c.id)).length;
  const lg = S().league;
  const opt = (k, v, label) => `<button class="btn ${st[k] === v ? "primary" : ""}" data-k="${k}" data-val="${v}">${label}</button>`;
  screen("screen-list", `
    <div class="list-page parent">
      <div class="topbar"><button class="btn icon" data-v="home" aria-label="뒤로">◀</button><h2>🔒 어른 화면</h2></div>
      <div class="pbox"><h3>진행</h3><p>말 ${done}/6 · 수업 ${cdone}/12 · 배지 ${badgeCount()}/8 · 리그 ${lg.rank.toLocaleString()}위 (${lg.wins}승 ${lg.losses}패 ${lg.draws}무) · 복습 대기 ${S().review.length}문제 · 도장 ${S().stamps}</p>
        <p>${Ct.CONCEPTS.map((c) => `${c.title} ${S().concepts[c.id] ? stars3(S().concepts[c.id].stars) : "-"}`).join(" · ")}</p></div>
      <div class="pbox"><h3>소리</h3>${opt("voice", true, "목소리 켜기")}${opt("voice", false, "목소리 끄기")} ${opt("sfx", true, "효과음 켜기")}${opt("sfx", false, "효과음 끄기")}</div>
      <div class="pbox"><h3>말 모양</h3>${opt("skin", "poke", "포켓몬")}${opt("skin", "chess", "진짜 체스 말")}</div>
      <div class="pbox"><h3>피카츄 도움 (리그)</h3>${opt("help", "auto", "자동(노멀 = 많이)")}${opt("help", "half", "반만")}${opt("help", "ask", "물을 때만")}${opt("help", "none", "혼자")}</div>
      <div class="pbox"><h3>🔓 모든 콘텐츠 열기 (어른 모드)</h3><p>켜면 모든 말·단계·수업·배지·리그 상대를 골라서 바로 할 수 있어요. 아이 기록은 그대로예요.</p>${opt("unlockAll", false, "🔒 차례대로 열기")}${opt("unlockAll", true, "🔓 모두 열기")}</div>
      <div class="pbox danger"><h3>기록 지우기</h3><p>지우려면 아래 칸에 <b>초기화</b> 라고 써 주세요.</p><input id="resetIn" autocomplete="off"><button class="btn" data-v="reset">모두 지우기</button></div>
      <p class="ver">v${esc(APP_VERSION)}</p>
    </div>`);
  app().onclick = (e) => {
    const k = e.target.closest("[data-k]");
    if (k) {
      let v = k.dataset.val;
      if (v === "true") v = true; else if (v === "false") v = false;
      st[k.dataset.k] = v; Store.save(); SFX.tap(); renderParentPage();
      return;
    }
    const b = e.target.closest("[data-v]");
    if (!b) return;
    if (b.dataset.v === "home") renderHome();
    if (b.dataset.v === "reset") {
      if ($("#resetIn").value.trim() === "초기화") { Store.reset(); toast("모두 지웠어요"); renderHome(); }
      else toast("'초기화' 라고 정확히 써 주세요");
    }
  };
}

// =====================================================================
// 새 버전 감지 (패드가 옛 HTML 을 붙들고 있는 문제)
// =====================================================================
const Update = { ver: null, last: 0, shown: false };
async function checkUpdate(force) {
  if (location.protocol === "file:" || !navigator.onLine || TEST) return;
  const now = Date.now();
  if (!force && now - Update.last < 60000) return;
  Update.last = now;
  try {
    const r = await fetch(location.pathname + "?v=" + now, { cache: "no-store" });
    if (r.ok) {
      const m = /APP_VERSION\s*=\s*"([^"]+)"/.exec(await r.text());
      if (m && m[1] !== APP_VERSION) Update.ver = m[1];
    }
  } catch (e) { return; }
  if (!Update.ver) return;
  const f = $("#updFoot");
  if (f) f.textContent = " → 새 버전 v" + Update.ver;
  if (!app().classList.contains("screen-home") || Update.shown) return; // 판 중에는 방해하지 않는다
  Update.shown = true;
  const d = layer("modal", `<div class="win-box"><h2>🎁 ${esc(L.updateNew)}</h2>
    <p>지금 <b>v${esc(APP_VERSION)}</b> 을 쓰고 있어요.<br>새 버전 <b>v${esc(Update.ver)}</b> 으로 바꿔 볼까요?<br><small>배운 기록은 그대로 남아요</small></p>
    <div class="row"><button class="btn big primary" data-v="go">🔄 새 버전으로 바꾸기</button><button class="btn big" data-v="later">나중에</button></div></div>`);
  waitPick(d).then((v) => { d.remove(); if (v === "go") applyUpdate(); else renderHome(); });
}
function applyUpdate() { location.replace(location.pathname + "?v=" + Date.now()); }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkUpdate(); });
window.addEventListener("online", () => checkUpdate(true));
setInterval(() => checkUpdate(), 10 * 60000);

// ---------- 시험용 손잡이 (?test) ----------
if (TEST) window.__T = { Store, renderHome, renderSchool, startPiece, startConcept, renderBadges, startBadge, renderLeague, startMatch, renderDex, renderParent, renderParentPage, P: () => P, lastSay: () => lastSay, runReview };

renderHome();
