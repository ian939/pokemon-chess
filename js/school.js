/* school.js — 포켓몬 스쿨 미션 만들기·풀기 (화면을 모른다, Node 시험: node tools/check-school.js)
 *
 * 미션 판은 손으로 만들지 않고 매번 무작위로 만든 뒤 BFS 로 풀리는지·최소 걸음(par)을 확인한다.
 * 미션에서는 흰(아이)만 움직이고 검정은 가만히 있다 (lichess 입문 '별 줍기' 방식).
 *
 * kind
 *   stars      ② 별 줍기 (갈 수 있는 칸 표시)
 *   starsDark  ③ 표시 없이 별 줍기, 적은 걸음이면 ⭐⭐⭐
 *   capture    ④ 상대 말 모두 잡기 (잠자는 우리 편 = 못 움직이고 넘지도 못함)
 *   safe       ⑤ 상대가 노리는 칸에 가면 잡힘 (킹은 아예 못 감 — 체스 규칙)
 *   cross      킹 ⑥ 위험한 칸을 피해 맨 위 줄까지
 */
(function (root) {
  "use strict";
  const C = root.Chess || require("./rules.js");
  const E = root.Engine || require("./engine.js");

  const NAME = C.name;
  const emptyB = () => new Array(64).fill(null);
  function stateOf(b) {
    const s = { b, turn: "w", castle: "", ep: -1, half: 0, full: 1, kings: { w: -1, b: -1 } };
    for (let i = 0; i < 64; i++) { if (b[i] === "K") s.kings.w = i; else if (b[i] === "k") s.kings.b = i; }
    return s;
  }

  // ---------- 미션 진행 ----------
  /** 지금 움직일 수 있는 수 (흰만, 잠자는 말 제외) */
  function legal(ms, s) {
    s = s || ms.s;
    return C.moves(s, { promos: "Q" }).filter((m) => !ms.frozen.has(m.from));
  }
  /** 이 칸으로 가면 잡히는가 (⑤ safe: 상대가 노리는 칸) */
  function caughtAt(ms, t, to) {
    if (!ms.danger) return false;
    const p = t.b[to];
    if (!p || p === "K") return false;
    return C.attacked(t, to, "b");
  }
  function step(ms, s, m) {
    const t = C.make(s, m);
    t.turn = "w"; t.ep = -1;
    return t;
  }
  function done(ms, s, stars) {
    if (ms.goal === "stars") return stars.size === 0;
    if (ms.goal === "capture") return !s.b.some((p) => p && p > "a");
    if (ms.goal === "cross") return s.kings.w >= 56;
    return false;
  }

  /** BFS 로 최소 걸음 수. 못 풀면 null */
  function solve(ms, limit) {
    limit = limit || 12;
    const start = { s: stateOf(ms.b.slice()), stars: new Set(ms.stars) };
    const key = (x) => C.board(x.s) + "|" + [...x.stars].sort().join(",");
    if (done(ms, start.s, start.stars)) return 0;
    let frontier = [start];
    const seen = new Set([key(start)]);
    for (let d = 1; d <= limit; d++) {
      const next = [];
      for (const x of frontier) {
        for (const m of legal(ms, x.s)) {
          const t = step(ms, x.s, m);
          if (caughtAt(ms, t, m.to)) continue;
          const stars = new Set(x.stars);
          stars.delete(m.to);
          if (done(ms, t, stars)) return d;
          const y = { s: t, stars }, k = key(y);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push(y);
          if (seen.size > 60000) return null;
        }
      }
      frontier = next;
      if (!frontier.length) return null;
    }
    return null;
  }

  // ---------- 미션 만들기 ----------
  const SPECS = {
    R: { stars: [3, 4], cap: 3 }, B: { stars: [3, 4], cap: 3 }, Q: { stars: [4, 5], cap: 4 },
    K: { stars: [3, 4], cap: 3 }, N: { stars: [2, 3], cap: 2 }, P: { stars: [2, 3], cap: 2 },
  };
  const GUARDS = ["p", "n", "b", "r"];

  function gen(piece, kind, seed) {
    const rng = E.mulberry(seed * 7919 + piece.charCodeAt(0) * 31 + kind.length);
    const rint = (n) => Math.floor(rng() * n);
    const sp = SPECS[piece];
    for (let tries = 0; tries < 4000; tries++) {
      const b = emptyB(), stars = [], frozen = [];
      const free = () => { for (let k = 0; k < 200; k++) { const i = rint(64); if (!b[i] && !stars.includes(i)) return i; } return -1; };
      // 내 말 자리
      let home;
      // 폰이 앞이 막히는 판(③ pawnBlock · ④ capture)은 양옆에 대각선이 있게 b~g 줄에서 출발
      const pawnBlocked = piece === "P" && (kind === "pawnBlock" || kind === "capture");
      if (pawnBlocked) home = 9 + rint(6);
      else if (piece === "P") home = 8 + rint(8);
      else if (kind === "cross") home = 4;
      else home = rint(64);
      b[home] = piece;
      if (piece === "P" && kind === "stars" && rng() < 0.4) { const h2 = 8 + rint(8); if (!b[h2]) b[h2] = "P"; }
      if (pawnBlocked) {
        // 바로 앞을 상대 말이 막는다 → 앞으로는 못 가고, 비스듬히 잡아야만 길이 열린다
        b[home + 8] = rng() < 0.7 ? "p" : "n";
        const hf = home & 7;
        const cone = (rMin, rMax, needOtherFile) => {
          for (let k = 0; k < 100; k++) {
            const r = rMin + rint(rMax - rMin + 1), f = hf + rint(5) - 2;
            if (f < 0 || f > 7 || Math.abs(f - hf) > r - 1) continue;
            if (needOtherFile && f === hf) continue;
            const i = r * 8 + f;
            if (!b[i] && !stars.includes(i)) return i;
          }
          return -1;
        };
        if (kind === "pawnBlock") {
          // 비스듬히 잡을 상대 1~2개, 별은 출발 줄이 아닌 곳에 1~2개
          for (let k = 0; k < 1 + rint(2); k++) { const i = cone(2, 5, true); if (i >= 0) b[i] = rng() < 0.7 ? "p" : "n"; }
          for (let k = 0; k < 1 + rint(2); k++) { const i = cone(3, 7, true); if (i >= 0) stars.push(i); }
        } else {
          // ④ 잡기: 옆 리오르가 막은 상대를 비스듬히 잡아 줄 수 있게 + 다른 상대 하나
          const nb = home + (rng() < 0.5 ? -1 : 1);
          b[nb] = "P";
          const i = cone(3, 5, false);
          if (i >= 0) b[i] = rng() < 0.6 ? "p" : "n";
        }
      }
      const nStars = kind === "stars" ? sp.stars[0] : kind === "starsDark" ? sp.stars[1] : kind === "safe" ? sp.stars[0] : 0;
      // 폰의 별은 앞쪽 원뿔 안에
      const starSq = () => {
        if (piece !== "P") return free();
        for (let k = 0; k < 100; k++) {
          const r = 2 + rint(6), f = (home & 7) + rint(3) - 1;
          if (f < 0 || f > 7) continue;
          const i = r * 8 + f;
          if (!b[i] && !stars.includes(i)) return i;
        }
        return -1;
      };
      for (let k = 0; k < nStars; k++) { const i = starSq(); if (i >= 0) stars.push(i); }
      if (kind === "capture" && piece !== "P") {
        const n = sp.cap;
        for (let k = 0; k < n; k++) {
          let i = free();
          if (piece === "P") { const r = 2 + rint(5), f = (home & 7) + rint(5) - 2; i = f >= 0 && f < 8 && !b[r * 8 + f] ? r * 8 + f : -1; }
          if (i >= 0 && i < 56 && i >= 8) b[i] = piece === "K" ? "p" : rng() < 0.6 ? "p" : "n";
          else if (i >= 0 && piece !== "P") b[i] = "n";
        }
        if ("RBQ".includes(piece)) for (let k = 0; k < 1 + rint(2); k++) { const i = free(); if (i >= 8 && i < 56) { b[i] = "P"; frozen.push(i); } }
      }
      if (kind === "safe" || kind === "cross") {
        const n = kind === "cross" ? 3 + rint(2) : 2;
        for (let k = 0; k < n; k++) {
          const i = free();
          if (i < 0) continue;
          let g = GUARDS[rint(GUARDS.length)];
          if (g === "p" && (i < 8 || i >= 56)) g = "n";
          if (kind === "cross" && i < 16) continue; // 출발 바로 옆은 비워 둔다
          b[i] = g;
        }
      }
      if (piece === "K" && kind === "capture") {
        // 킹이 잡을 상대는 지켜 주는 친구가 없어야 한다 (지켜지면 못 잡음 — 체스 규칙)
      }
      const ms = {
        piece, kind, b, stars, frozen: new Set(frozen),
        goal: kind === "capture" ? "capture" : kind === "cross" ? "cross" : "stars",
        show: kind === "stars" || kind === "capture" || kind === "pawnBlock",
        danger: kind === "safe" || kind === "cross",
      };
      const s0 = stateOf(b.slice());
      // 별은 노려지는 칸에 두지 않는다 / 시작부터 잡힌 상태 금지
      if (ms.danger && stars.some((i) => C.attacked(s0, i, "b"))) continue;
      if (ms.danger && piece !== "K" && C.attacked(s0, home, "b")) continue;
      if (piece === "K" && C.attacked(s0, home, "b")) continue;
      if (kind === "capture" && !b.some((p) => p && p > "a")) continue;
      if (piece !== "P" && kind !== "capture" && kind !== "cross" && stars.length < nStars) continue;
      if (piece === "P" && kind !== "capture" && stars.length < 1) continue;
      const par = solve(ms, kind === "cross" ? 14 : 10);
      if (par == null) continue;
      const minPar = kind === "cross" ? 7 : kind === "capture" ? sp.cap : Math.max(stars.length, 2);
      if (par < minPar) continue;
      if (par > (kind === "cross" ? 12 : piece === "P" ? 7 : stars.length + 4)) continue;
      // ⑤ safe 는 '조심하지 않으면 잡히는' 판이어야 한다: 위험 칸 없이 풀었을 때 더 빠르거나 같은 길 일부가 위험
      if (kind === "safe" && piece === "K") {
        // 킹은 위험한 칸에 아예 못 가므로, 길 근처에 위험한 칸이 충분히 있어야 배울 게 있다
        const near = new Set();
        for (const c of [home, ...stars]) for (const x of C.KG[c]) near.add(x);
        let hot = 0;
        for (const x of near) if (!b[x] && C.attacked(s0, x, "b")) hot++;
        if (hot < 4) continue;
      } else if (kind === "safe") {
        const free2 = solve({ ...ms, danger: false }, 10);
        const risky = legal(ms, s0).some((m) => caughtAt(ms, step(ms, s0, m), m.to));
        if (!risky && free2 === par) continue;
      }
      ms.par = par;
      ms.fen = C.board(s0) + " w - - 0 1";
      ms.seed = seed;
      return ms;
    }
    throw new Error("미션을 못 만듦 " + piece + " " + kind);
  }

  /** 힌트: 지금 상태에서 가장 짧은 길의 첫 걸음 */
  function firstStep(st) {
    const ms = st.ms;
    const start = { s: st.s, stars: new Set(st.stars), first: null };
    const key = (x) => C.board(x.s) + "|" + [...x.stars].sort().join(",");
    let frontier = [start];
    const seen = new Set([key(start)]);
    for (let d = 1; d <= 14; d++) {
      const next = [];
      for (const x of frontier) {
        for (const m of legal(ms, x.s)) {
          const t = step(ms, x.s, m);
          if (caughtAt(ms, t, m.to)) continue;
          const stars = new Set(x.stars);
          stars.delete(m.to);
          const first = x.first || m;
          if (done(ms, t, stars)) return first;
          const y = { s: t, stars, first }, k = key(y);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push(y);
          if (seen.size > 60000) return null;
        }
      }
      frontier = next;
      if (!frontier.length) return null;
    }
    return null;
  }

  /** 미션 진행 상태를 만든다 */
  function start(ms) {
    return { ms, s: stateOf(ms.b.slice()), stars: new Set(ms.stars), steps: 0, caught: null, won: false };
  }
  /** 아이가 수를 둔다 → { ok, caught, won, star } */
  function play(st, m) {
    const t = step(st.ms, st.s, m);
    st.s = t;
    st.steps++;
    const star = st.stars.delete(m.to);
    if (caughtAt(st.ms, t, m.to)) {
      st.caught = { sq: m.to, by: C.attackers(t, m.to, "b")[0] };
      return { caught: st.caught };
    }
    if (done(st.ms, t, st.stars)) st.won = true;
    return { won: st.won, star };
  }
  /** 별 개수: 최소 걸음이면 3, +2 이내 2, 나머지 1 */
  const starsFor = (st) => (st.steps <= st.ms.par ? 3 : st.steps <= st.ms.par + 2 ? 2 : 1);

  // ---------- 나이트 경주 (⑥) 검정 봇 ----------
  function knightDist(from, targets, block) {
    if (targets.has(from)) return 0;
    let fr = [from];
    const seen = new Set(fr);
    for (let d = 1; d < 8; d++) {
      const nx = [];
      for (const x of fr) for (const y of C.KN[x]) {
        if (seen.has(y) || (block && block.has(y))) continue;
        if (targets.has(y)) return d;
        seen.add(y); nx.push(y);
      }
      fr = nx;
    }
    return 9;
  }
  /** 별 경주 판(Game, goal stars)에서 검정이 둘 수 */
  function raceBot(g, rng, kind) {
    rng = rng || Math.random;
    const ms = C.moves(g.s);
    if (!ms.length) return null;
    const caps = ms.filter((m) => m.cap);
    if (caps.length && rng() < (kind === "easy" ? 0.5 : 0.9)) return caps[0];
    if (rng() < (kind === "easy" ? 0.5 : kind === "hard" ? 0 : 0.2)) return ms[Math.floor(rng() * ms.length)];
    const them = C.other(g.s.turn);
    let best = null, bd = 99;
    for (const m of ms) {
      // 상대 나이트가 잡을 수 있는 칸은 웬만하면 피한다
      const t = C.make(g.s, m);
      const risky = C.attacked(t, m.to, them) ? 3 : 0;
      const d = (g.stars.has(m.to) ? -1 : knightDist(m.to, g.stars)) + risky + rng() * 0.5;
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  const School = { gen, solve, firstStep, start, play, legal, starsFor, stateOf, raceBot, knightDist, caughtAt };
  root.School = School;
  if (typeof module !== "undefined") module.exports = School;
})(typeof window !== "undefined" ? window : globalThis);
