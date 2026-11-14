/* engine.js — 판 평가 · 탐색 · 컴퓨터 상대(봇 1~8) (화면을 모른다, Node 시험)
 *
 * 6살 상대는 "얼마나 약하게, 사람처럼 약하게" 가 핵심이다.
 * 실수는 무작위 헛수가 아니라 '상위 후보 중 덜 좋은 수'를 고르는 식으로 만든다 (plan §10.3).
 */
(function (root) {
  "use strict";
  const C = root.Chess || require("./rules.js");
  const Game = root.Game || require("./game.js");

  const WIN = 100000;
  const VAL = { P: 100, N: 300, B: 310, R: 500, Q: 900, K: 0 };
  // 흰 기준 위치 점수 (index 0 = a1). 검정은 위아래를 뒤집어 쓴다
  const CENTER = [];
  for (let i = 0; i < 64; i++) {
    const f = i & 7, r = i >> 3;
    CENTER[i] = 6 - (Math.abs(3.5 - f) + Math.abs(3.5 - r)); // -1 ~ 6
  }
  const PAWN_ADV = [0, 0, 4, 10, 22, 40, 70, 0];
  const RACE_ADV = [0, 0, 10, 25, 50, 90, 160, 0];

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 흰 기준 점수 (센티폰) */
  function evaluate(s, goal, opt) {
    const pst = !opt || opt.pst !== false;
    const race = goal && (goal.type === "promote" || goal.type === "captureAll");
    let sc = 0, wN = 0, bN = 0;
    const b = s.b;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p) continue;
      const w = p < "a", T = p.toUpperCase(), sign = w ? 1 : -1;
      sc += sign * VAL[T];
      if (T !== "K") { if (w) wN += VAL[T]; else bN += VAL[T]; }
      const rel = w ? i >> 3 : 7 - (i >> 3);
      if (T === "P") {
        sc += sign * (race ? RACE_ADV[rel] * (goal.type === "captureAll" && C.colorOf(p) !== (goal.hunter || "w") ? 1.5 : 1) : pst ? PAWN_ADV[rel] + (CENTER[i] > 4 ? 8 : 0) : 0);
      } else if (pst && (T === "N" || T === "B")) {
        sc += sign * (CENTER[i] * 4 + (rel === 0 ? -12 : 0));
      } else if (pst && T === "Q") {
        sc += sign * CENTER[i] * 1.5;
      } else if (pst && T === "K" && wN + bN > 2600) {
        // 판이 복잡할 땐 킹은 뒤에 숨기 (캐슬링 자리 칭찬)
        const f = i & 7;
        sc += sign * (rel === 0 && (f <= 2 || f >= 6) ? 20 : rel > 1 ? -25 : 0);
      }
    }
    // 끝내기: 한쪽이 킹만 남으면 그 킹을 가장자리로, 우리 킹은 가까이 (메이트를 찾게)
    if ((s.kings.w >= 0 && s.kings.b >= 0) && (wN === 0 || bN === 0) && wN !== bN) {
      const strong = wN > bN ? "w" : "b", lone = s.kings[C.other(strong)], mine = s.kings[strong];
      const edge = 6 - CENTER[lone];
      const dist = Math.abs((lone & 7) - (mine & 7)) + Math.abs((lone >> 3) - (mine >> 3));
      sc += (strong === "w" ? 1 : -1) * (edge * 12 + (14 - dist) * 5);
    }
    return Math.round(sc);
  }

  const order = (ms) => ms.sort((a, b) => (b.cap ? VAL[b.cap.toUpperCase()] * 10 - VAL[b.p.toUpperCase()] : b.promo ? 800 : 0) - (a.cap ? VAL[a.cap.toUpperCase()] * 10 - VAL[a.p.toUpperCase()] : a.promo ? 800 : 0));

  class Abort extends Error {}

  function Searcher(goal, opt) {
    opt = opt || {};
    this.goal = goal || { type: "mate" };
    this.opt = opt;
    this.nodes = 0;
    this.limit = opt.nodes || 400000;
  }
  Searcher.prototype.ev = function (s) {
    const v = evaluate(s, this.goal, this.opt);
    return s.turn === "w" ? v : -v;
  };
  /** 수 m 을 둔 뒤 바로 승패가 났으면 둔 쪽 기준 점수, 아니면 null */
  Searcher.prototype.imm = function (t, m, ply) {
    const r = Game.Goals.after(this.goal, t, m);
    if (!r) return null;
    if (r === "draw") return 0;
    return r === C.colorOf(m.p) ? WIN - ply - 1 : -WIN + ply + 1;
  };
  Searcher.prototype.noMoves = function (s, ply) {
    const r = Game.Goals.noMoves(this.goal, s);
    if (r === "draw") return 0;
    return r === s.turn ? WIN - ply : -WIN + ply;
  };
  Searcher.prototype.qs = function (s, a, b, ply, qd) {
    if (++this.nodes > this.limit) throw new Abort();
    const stand = this.ev(s);
    if (qd >= 6) return stand;
    if (stand >= b) return stand;
    if (stand > a) a = stand;
    const ms = order(C.moves(s, { promos: "Q", caps: true }));
    for (const m of ms) {
      const t = C.make(s, m);
      let v = this.imm(t, m, ply);
      if (v === null) v = -this.qs(t, -b, -a, ply + 1, qd + 1);
      if (v >= b) return v;
      if (v > a) a = v;
    }
    return a;
  };
  Searcher.prototype.nega = function (s, d, a, b, ply) {
    if (++this.nodes > this.limit) throw new Abort();
    const ms = C.moves(s, { promos: "Q" });
    if (!ms.length) return this.noMoves(s, ply);
    if (this.goal.type === "mate" && s.half >= 100) return 0;
    if (d <= 0) return this.qs(s, a, b, ply, 0);
    order(ms);
    let best = -Infinity;
    for (const m of ms) {
      const t = C.make(s, m);
      let v = this.imm(t, m, ply);
      if (v === null) v = -this.nega(t, d - 1, -b, -a, ply + 1);
      if (v > best) best = v;
      if (v > a) a = v;
      if (a >= b) break;
    }
    return best;
  };
  /** 뿌리의 모든 수에 점수를 매긴다 (창을 열어 두므로 각 수의 값이 정확하다) */
  Searcher.prototype.scoreAll = function (s, d, ms) {
    ms = order(ms || C.moves(s, { promos: "Q" }));
    const out = [];
    for (const m of ms) {
      const t = C.make(s, m);
      let v = this.imm(t, m, 0);
      if (v === null) v = d <= 1 ? -this.qs(t, -WIN - 1, WIN + 1, 1, 0) : -this.nega(t, d - 1, -WIN - 1, WIN + 1, 1);
      out.push({ m, v });
    }
    return out.sort((x, y) => y.v - x.v);
  };

  /** 수마다 점수 (깊이 d). 노드 한도를 넘으면 한 단계 얕은 결과를 돌려준다 */
  function scoreMoves(s, d, goal, opt) {
    let last = null;
    for (let depth = 1; depth <= d; depth++) {
      const S = new Searcher(goal, opt);
      try { last = S.scoreAll(s, depth); } catch (e) { if (e instanceof Abort) break; throw e; }
    }
    return last || [];
  }
  function best(s, d, goal, opt) {
    const sc = scoreMoves(s, d, goal, opt);
    return sc[0] || null;
  }

  // ---------- 봇 ----------
  const LEVELS = {
    1: { name: "아무렇게나" },
    2: { name: "잡을 수 있으면 잡기" },
    3: { name: "한 수 앞 계산", depth: 1, blind: 0.5, missMate: 0.4 },
    4: { depth: 2, pst: false, mistake: 0.3, cap: 300, missMate: 0.3 },
    5: { depth: 2, mistake: 0.15, cap: 200, missMate: 0.1 },
    6: { depth: 3, mistake: 0.08, cap: 150 },
    7: { depth: 3, mistake: 0.03, cap: 100 },
    8: { depth: 4, mistake: 0, cap: 0 },
  };
  const pickR = (arr, rng) => arr[Math.floor(rng() * arr.length)];

  /** 잡는 수의 얕은 계산: 잡은 말 - (내려앉은 칸이 노려지면 내 말) */
  function liteGain(s, m) {
    const t = C.make(s, m);
    const got = m.cap ? VAL[m.cap.toUpperCase()] : 0;
    const risk = C.attacked(t, m.to, t.turn) ? VAL[(m.promo || m.p).toUpperCase()] : 0;
    return got - risk + (m.promo ? 800 : 0);
  }
  function isMateMove(s, m) {
    const t = C.make(s, m);
    return C.inCheck(t) && C.moves(t, { promos: "Q" }).length === 0;
  }

  /**
   * 봇이 둘 수를 고른다.
   * @param level 1~8, goal 판 목표, rng 난수 함수
   */
  function pick(s, level, goal, rng) {
    rng = rng || Math.random;
    goal = goal || { type: "mate" };
    let ms = C.moves(s, { promos: "Q" });
    if (!ms.length) return null;
    const L = LEVELS[level] || LEVELS[3];
    // 바로 이기는 수(진화 경주의 진화 등)는 2단계부터 놓치지 않는다
    if (level >= 2) {
      const win = ms.find((m) => Game.Goals.after(goal, C.make(s, m), m) === s.turn);
      if (win) return win;
    }
    if (level <= 1) return pickR(ms, rng);
    if (level === 2) {
      const caps = ms.filter((m) => m.cap || m.promo);
      return pickR(caps.length ? caps : ms, rng);
    }
    // 한 수 메이트를 일부러 놓치기 (아이가 역전할 틈)
    if (L.missMate && rng() < L.missMate) {
      const rest = ms.filter((m) => !isMateMove(s, m));
      if (rest.length) ms = rest;
    }
    let scored;
    if (L.blind && rng() < L.blind) {
      scored = ms.map((m) => ({ m, v: liteGain(s, m) + rng() * 30 })).sort((a, b) => b.v - a.v);
    } else {
      const S = new Searcher(goal, { pst: L.pst !== false, nodes: 250000 });
      try { scored = S.scoreAll(s, L.depth || 1, ms); }
      catch (e) { if (!(e instanceof Abort)) throw e; scored = new Searcher(goal, { pst: L.pst !== false }).scoreAll(s, 1, ms); }
      // 같은 점수끼리는 섞는다 (매번 같은 판이 되지 않게)
      scored.forEach((x) => (x.v += rng() * 12));
      scored.sort((a, b) => b.v - a.v);
    }
    if (L.mistake && rng() < L.mistake) {
      const cand = scored.slice(1, 4).filter((x) => x.v >= scored[0].v - L.cap);
      if (cand.length) return pickR(cand, rng).m;
    }
    return scored[0].m;
  }

  const Engine = { WIN, VAL, LEVELS, evaluate, Searcher, scoreMoves, best, pick, mulberry, isMateMove, Abort };
  root.Engine = Engine;
  if (typeof module !== "undefined") module.exports = Engine;
})(typeof window !== "undefined" ? window : globalThis);
