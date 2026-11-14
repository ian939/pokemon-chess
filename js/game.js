/* game.js — 한 판의 진행과 승패 (화면을 모른다, Node 시험)
 *
 * 목표(goal) 종류
 *   mate        : 보통 체스. 체크메이트하면 승, 스테일메이트·50수·3회 반복·말 부족은 비김
 *   promote     : 폰 전쟁류. 먼저 진화(프로모션)하면 승. 둘 곳이 없으면 폰이 많은 쪽 승
 *   captureAll  : { hunter:'w' } 사냥꾼이 상대 말을 다 잡으면 승, 상대 폰이 진화하거나 사냥꾼 말이 다 잡히면 패
 *   points      : { plies } 정해진 수가 지나면 ⚡ 점수(남은 말 가치)가 높은 쪽 승
 *   mateIn      : { plies } 흰이 그 안에 메이트하면 승. 못 하면(비김 포함) 실패
 *   stars       : { stars:[칸 이름] } 별을 더 많이 주운 쪽 승. 상대 말을 다 잡아도 승
 */
(function (root) {
  "use strict";
  const C = root.Chess || require("./rules.js");

  const count = (s, c) => { let n = 0; for (const p of s.b) if (p && C.colorOf(p) === c && p.toUpperCase() !== "K") n++; return n; };
  const pawns = (s, c) => { let n = 0; for (const p of s.b) if (p === (c === "w" ? "P" : "p")) n++; return n; };
  const cmp = (a, b) => (a > b ? "w" : a < b ? "b" : "draw");

  const Goals = {
    /** 수 m 을 막 둔 판 t 에서 바로 승패가 났는가 → 'w' | 'b' | 'draw' | null */
    after(goal, t, m) {
      const mover = C.colorOf(m.p);
      if (goal.type === "promote" && m.promo) return mover;
      if (goal.type === "captureAll") {
        const h = goal.hunter || "w", prey = C.other(h);
        if (m.promo && mover === prey) return prey;
        if (count(t, prey) === 0) return h;
        if (count(t, h) === 0) return prey;
      }
      if (goal.type === "stars" && count(t, C.other(mover)) === 0) return mover;
      return null;
    },
    /** 둘 수 있는 수가 없는 판 s 의 결과 */
    noMoves(goal, s) {
      if (s.kings[s.turn] >= 0) {
        if (C.inCheck(s)) return C.other(s.turn);
        return goal.type === "mateIn" ? "b" : "draw";
      }
      if (goal.type === "promote") return cmp(pawns(s, "w"), pawns(s, "b"));
      if (goal.type === "points") return cmp(C.material(s, "w"), C.material(s, "b"));
      return "draw";
    },
  };

  function create(cfg) {
    const s = C.parse(cfg.fen);
    return {
      cfg, s, keys: [C.posKey(s)], hist: [],
      stars: cfg.goal.type === "stars" ? new Set(cfg.goal.stars.map(C.sq)) : null,
      score: { w: 0, b: 0 }, over: null,
    };
  }
  const legal = (g) => (g.over ? [] : C.moves(g.s, { promos: g.cfg.promos || "Q" }));

  function play(g, m) {
    g.hist.push({ s: g.s, m, stars: g.stars && new Set(g.stars), score: { ...g.score }, keys: g.keys.length });
    const mover = g.s.turn;
    g.s = C.make(g.s, m);
    g.keys.push(C.posKey(g.s));
    if (g.stars && g.stars.has(m.to)) { g.stars.delete(m.to); g.score[mover]++; }
    g.over = result(g, m);
    return g.over;
  }
  function undo(g, n) {
    n = Math.min(n || 1, g.hist.length);
    for (let i = 0; i < n; i++) {
      const h = g.hist.pop();
      g.s = h.s; g.stars = h.stars; g.score = h.score; g.keys.length = h.keys;
    }
    g.over = null;
  }

  /** 승패: { winner:'w'|'b'|null, reason } 또는 계속이면 null */
  function result(g, m) {
    const goal = g.cfg.goal, s = g.s;
    const w = Goals.after(goal, s, m);
    if (w) return { winner: w === "draw" ? null : w, reason: goal.type === "promote" || (goal.type === "captureAll" && m.promo) ? "promote" : goal.type === "stars" ? "allCaptured" : "captureAll" };
    if (g.stars && g.stars.size === 0) {
      const r = cmp(g.score.w, g.score.b);
      return { winner: r === "draw" ? null : r, reason: "stars" };
    }
    const st = C.status(s, goal.type === "mate" || goal.type === "mateIn" ? g.keys : null);
    if (st.over) {
      if (st.result === "mate") return { winner: st.winner, reason: "mate" };
      if (st.result === "nomoves") { const r = Goals.noMoves(goal, s); return { winner: r === "draw" ? null : r, reason: "nomoves" }; }
      if (goal.type === "mateIn") return { winner: "b", reason: st.result };
      if (goal.type === "mate") return { winner: null, reason: st.result };
      // 킹이 있는 미니게임의 스테일메이트 등
      if (st.result === "stalemate") return { winner: null, reason: "stalemate" };
    }
    const plies = g.hist.length;
    if (goal.type === "points" && plies >= goal.plies) {
      const r = cmp(C.material(s, "w"), C.material(s, "b"));
      return { winner: r === "draw" ? null : r, reason: "points" };
    }
    if (goal.type === "mateIn" && plies >= goal.plies) return { winner: "b", reason: "timeout" };
    return null;
  }

  const Game = { Goals, create, legal, play, undo, result, count, pawns };
  root.Game = Game;
  if (typeof module !== "undefined") module.exports = Game;
})(typeof window !== "undefined" ? window : globalThis);
