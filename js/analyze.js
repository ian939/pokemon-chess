/* analyze.js — 피카츄 멘토가 "왜"를 말하기 위한 판 읽기 (화면을 모른다, Node 시험)
 *
 * 엔진 점수만으로는 이유를 말할 수 없어서, 설명할 수 있는 규칙으로 판을 읽는다 (plan §6.2).
 * 점수 단위는 ⚡ (폰 1 · 나이트 3 · 비숍 3 · 룩 5 · 퀸 9).
 */
(function (root) {
  "use strict";
  const C = root.Chess || require("./rules.js");
  const E = root.Engine || require("./engine.js");
  const V = C.VALUE;
  const val = (p) => (p ? V[p.toUpperCase()] : 0);

  /** 잡기만 이어 두는 계산 — 둘 차례 기준 ⚡ 차이 */
  function qs(s, a, b, d) {
    const stand = C.material(s, s.turn) - C.material(s, C.other(s.turn));
    if (d >= 8 || stand >= b) return stand;
    if (stand > a) a = stand;
    const ms = C.moves(s, { promos: "Q", caps: true }).sort((x, y) => val(y.cap) - val(x.cap) || val(x.p) - val(y.p));
    for (const m of ms) {
      const t = C.make(s, m);
      if (t.kings[t.turn] < 0 && s.kings[t.turn] >= 0) continue;
      const v = -qs(t, -b, -a, d + 1);
      if (v >= b) return v;
      if (v > a) a = v;
    }
    return a;
  }
  /** 수 m 으로 둔 쪽이 얻는 ⚡ (잡고 잡히는 걸 끝까지 계산) */
  function gain(s, m) {
    const before = C.material(s, s.turn) - C.material(s, C.other(s.turn));
    return -qs(C.make(s, m), -99, 99, 0) - before;
  }
  /** 차례를 넘긴 판 (상대가 지금 둔다면?) */
  function pass(s) {
    return { b: s.b, turn: C.other(s.turn), castle: s.castle, ep: -1, half: s.half, full: s.full, kings: s.kings };
  }
  const nameOfSide = (s, c) => (s.turn === c ? s : pass(s));

  /** c 편 말 중 공짜로(또는 손해 보고) 잡힐 말들 — 손해 큰 순 */
  function hanging(s, c) {
    const t = nameOfSide(s, C.other(c));
    if (C.inCheck(t, c)) return []; // (c 가 상대를 체크 중이면 판단 안 함)
    const caps = C.moves(t, { promos: "Q", caps: true });
    const out = [];
    for (let i = 0; i < 64; i++) {
      const p = s.b[i];
      if (!p || C.colorOf(p) !== c || p.toUpperCase() === "K") continue;
      let bestG = 0, by = null;
      for (const m of caps) {
        if (m.to !== i) continue;
        const g = gain(t, m);
        if (g > bestG || (g === bestG && by && val(m.p) < val(by.p))) { bestG = g; by = m; }
      }
      if (bestG >= 1) out.push({ sq: i, piece: p, loss: bestG, by: by.from, byPiece: by.p, undefended: C.attackers(s, i, c).length === 0 });
    }
    return out.sort((a, b) => b.loss - a.loss || val(b.piece) - val(a.piece));
  }
  /** 지금 둘 차례인 쪽이 이득 보며 잡을 수 있는 수 — 이득 큰 순 */
  function freeCaptures(s) {
    const out = [];
    for (const m of C.moves(s, { promos: "Q", caps: true })) {
      if (!m.cap) continue;
      const g = gain(s, m);
      if (g >= 1) out.push({ m, gain: g, undefended: C.attackers(s, m.to, C.other(s.turn)).length === 0 });
    }
    return out.sort((a, b) => b.gain - a.gain);
  }
  const mateIn1 = (s) => C.moves(s, { promos: "Q" }).filter((m) => E.isMateMove(s, m));
  const checks = (s) => C.moves(s, { promos: "Q" }).filter((m) => C.inCheck(C.make(s, m)));
  /** 상대가 다음 수에 메이트를 노리는가 (내가 체크 중이 아닐 때) */
  function threatMate(s) {
    if (C.inCheck(s) || s.kings[s.turn] < 0) return [];
    const t = pass(s);
    if (C.inCheck(t)) return [];
    return mateIn1(t);
  }
  /** 진화할 수 있는 폰: c 편이 다음 수에 진화할 수 있는가 */
  function promoNext(s, c) {
    const t = nameOfSide(s, c);
    return C.moves(t, { promos: "Q" }).filter((m) => m.promo && gain(t, m) >= 0);
  }
  /** 체크하고 있는 말들의 칸 */
  const checkers = (s) => (s.kings[s.turn] < 0 ? [] : C.attackers(s, s.kings[s.turn], C.other(s.turn)));

  /** 아직 집(첫 줄)에 있는 나이트·비숍 */
  function undeveloped(s, c) {
    const home = c === "w" ? 0 : 7, out = [];
    for (let i = 0; i < 64; i++) {
      const p = s.b[i];
      if (p && C.colorOf(p) === c && "NB".includes(p.toUpperCase()) && (i >> 3) === home) out.push(i);
    }
    return out;
  }

  /**
   * 수마다 값 (⚡, 내 수 → 상대 최선 → 잡기 끝까지). 메이트는 ±100.
   * 멘토의 '큰 실수 경고'와 끝난 뒤 돌아보기에 쓴다.
   */
  function moveValues(s, depth) {
    const sc = E.scoreMoves(s, depth || 2, { type: "mate" }, { pst: false, nodes: 300000 });
    return sc.map((x) => ({ m: x.m, v: Math.abs(x.v) > E.WIN / 2 ? Math.sign(x.v) * 100 : Math.round(x.v / 100) }));
  }
  /** 수 m 뒤 상대의 가장 좋은 대답 */
  function refutation(s, m) {
    const t = C.make(s, m);
    const b = E.best(t, 2, { type: "mate" }, { pst: false, nodes: 150000 });
    return b ? b.m : null;
  }
  /** 힌트용 좋은 수 (깊이 2 + 위치 점수, 무작위 없음) */
  function hintMove(s, goal) {
    const b = E.best(s, 2, goal || { type: "mate" }, { nodes: 300000 });
    return b ? b.m : null;
  }

  /**
   * 이기는 끝내기인가: 상대(검정)가 킹 + 폰 몇 개뿐이고 흰이 ⚡5 이상 앞섬.
   * 맞으면 { kingSquares: 상대 대장이 갈 수 있는 칸들, far: 우리 대장이 멀리 있나 }
   */
  function winningEndgame(s) {
    if (s.kings.w < 0 || s.kings.b < 0) return null;
    let bPieces = 0;
    for (const p of s.b) if (p && p > "a" && p !== "k" && p !== "p") bPieces++;
    if (bPieces > 0) return null;
    if (C.material(s, "w") - C.material(s, "b") < 5) return null;
    const t = pass(s);
    const kingSquares = C.inCheck(t, "w") ? [] : C.moves(t).filter((m) => m.p === "k").map((m) => m.to);
    const kw = s.kings.w, kb = s.kings.b;
    const far = Math.max(Math.abs((kw & 7) - (kb & 7)), Math.abs((kw >> 3) - (kb >> 3))) >= 4;
    return { kingSquares, far };
  }
  /** 끝내기 안내용 수: 메이트 쪽으로 몰아가는 수 (깊이 3, 스테일메이트는 0점이라 저절로 피함) */
  function mateGuideMove(s) {
    const b = E.best(s, 3, { type: "mate" }, { nodes: 250000 });
    return b ? b.m : null;
  }
  /** 수 m 이 스테일메이트를 만드는가 */
  function makesStalemate(s, m) {
    const t = C.make(s, m);
    const them = t.turn;
    return t.kings[them] >= 0 && !C.inCheck(t) && C.moves(t).length === 0;
  }

  const Analyze = {
    winningEndgame, mateGuideMove, makesStalemate, qs, gain, pass, hanging, freeCaptures, mateIn1, checks, threatMate, promoNext, checkers, undeveloped, moveValues, refutation, hintMove, val };
  root.Analyze = Analyze;
  if (typeof module !== "undefined") module.exports = Analyze;
})(typeof window !== "undefined" ? window : globalThis);
