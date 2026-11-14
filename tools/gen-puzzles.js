/* 개념 수업 퍼즐 만들기: node tools/gen-puzzles.js  → data/puzzles.js
 *
 * 씨앗이 고정이라 다시 돌려도 같은 퍼즐이 나온다 (아이 기록이 퍼즐 id 에 붙으므로 함부로 바꾸지 말 것).
 * 모든 퍼즐은 여기서 엔진으로 검증하고, tools/check-puzzles.js 가 한 번 더 확인한다.
 */
const fs = require("fs");
const path = require("path");
const C = require("../js/rules.js");
const E = require("../js/engine.js");
const A = require("../js/analyze.js");
const P = require("../js/puzzle.js");

const rng = E.mulberry(20261114);
const rint = (n) => Math.floor(rng() * n);
const pick = (a) => a[rint(a.length)];
const sname = C.name;

function place(spec) {
  // spec: [['K', 소문자/대문자 말, 제약 fn(i)], ...]
  const b = new Array(64).fill(null);
  for (const [p, ok] of spec) {
    let i, k = 0;
    do { i = rint(64); k++; } while ((b[i] || (ok && !ok(i)) || ("Pp".includes(p) && (i < 8 || i >= 56))) && k < 300);
    if (k >= 300) return null;
    b[i] = p;
  }
  return b;
}
function S(b, turn, castle) {
  const fen = boardFen(b) + " " + (turn || "w") + " " + (castle || "-") + " - 0 1";
  return C.parse(fen);
}
function boardFen(b) {
  const s = { b };
  return C.board(s);
}
const legalPos = (s) => {
  // 둘 차례가 아닌 쪽이 체크 상태면 안 됨, 킹끼리 붙으면 안 됨
  if (s.kings.w >= 0 && s.kings.b >= 0 && C.KG[s.kings.w].includes(s.kings.b)) return false;
  return !C.inCheck(s, C.other(s.turn));
};
const fenOf = (s) => C.fen(s);
const seen = new Set();
function uniq(s) { const k = C.board(s); if (seen.has(k)) return false; seen.add(k); return true; }

function gen(n, maker) {
  const out = [];
  for (let tries = 0; out.length < n && tries < 200000; tries++) {
    const x = maker();
    if (x) out.push(x);
  }
  if (out.length < n) throw new Error("모자람 " + out.length + "/" + n);
  return out;
}

const OUT = {};

// C2 노리기: 이 말이 잡을 수 있는 상대 말을 모두 누르기
OUT.C2 = gen(12, () => {
  const T = pick(["R", "B", "Q", "N", "R", "B", "N"]);
  const b = place([[T], ["p"], ["p"], [pick(["n", "b", "p"])], [pick(["r", "p", "n"])]]);
  if (!b) return null;
  const s = S(b, "w");
  const from = b.indexOf(T);
  const ans = P.tapAnswer({ fen: fenOf(s), piece: sname(from) });
  if (ans.length < 1 || ans.length > 3 || !uniq(s)) return null;
  return { fen: fenOf(s), piece: sname(from) };
});

// C3 공짜 말: 지켜 주는 친구가 없는 상대 말을 잡기 (정답 하나, 함정 잡기 하나 이상)
OUT.C3 = gen(12, () => {
  const b = place([[pick(["R", "B", "N", "Q"])], [pick(["R", "B", "N"])], ["p"], ["p"], [pick(["n", "b", "r"])], [pick(["p", "n", "b"])]]);
  if (!b) return null;
  const s = S(b, "w");
  const caps = C.moves(s).filter((m) => m.cap);
  const good = caps.filter((m) => A.gain(s, m) >= 1 && C.attackers(s, m.to, "b").length === 0);
  const anyGood = caps.filter((m) => A.gain(s, m) >= 1);
  const bad = caps.filter((m) => A.gain(s, m) < 0);
  if (good.length !== 1 || anyGood.length !== 1 || bad.length < 1 || !uniq(s)) return null;
  return { fen: fenOf(s), check: "free" };
});

// C4 에너지 점수: 이 잡기는 이득일까? (상대 말은 폰이 지키고 있다)
OUT.C4 = gen(12, () => {
  const X = pick(["Q", "R", "B", "N", "P"]), Y = pick(["q", "r", "b", "n", "p"]);
  const b = place([[X], [Y]]);
  if (!b) return null;
  const s0 = S(b, "w");
  const from = b.indexOf(X), to = b.indexOf(Y);
  const m = C.moves(s0).find((x) => x.from === from && x.to === to);
  if (!m) return null;
  // 지키는 폰을 붙인다
  const f = to & 7, r = to >> 3;
  if (r >= 6) return null;
  const guardSq = (r + 1) * 8 + f + (rng() < 0.5 ? -1 : 1);
  if ((guardSq & 7) === -1 || Math.abs((guardSq & 7) - f) !== 1 || b[guardSq]) return null;
  b[guardSq] = "p";
  const s = S(b, "w");
  if (!C.attackers(s, to, "b").includes(guardSq)) return null;
  const vx = C.VALUE[X], vy = C.VALUE[Y.toUpperCase()];
  const answer = vy > vx ? "gain" : vy < vx ? "loss" : "even";
  if (!uniq(s)) return null;
  return { fen: fenOf(s), arrow: [sname(from), sname(to)], answer };
});
// 고르게 섞기: 이득/손해/똑같아가 다 있게
if (!["gain", "loss", "even"].every((a) => OUT.C4.some((x) => x.answer === a))) throw new Error("C4 답 치우침");

// C5 지키기: 위험한 내 말을 구하기
OUT.C5 = gen(12, () => {
  const T = pick(["R", "N", "B", "Q", "R"]);
  const b = place([[T], [pick(["R", "N", "B", "P"])], [pick(["p", "n", "b"])], [pick(["p", "n", "r", "b"])]]);
  if (!b) return null;
  const s = S(b, "w");
  const h = A.hanging(s, "w");
  if (h.length !== 1 || h[0].loss < 2) return null;
  const ms = C.moves(s);
  const saves = ms.filter((m) => A.gain(s, m) >= 0);
  if (saves.length < 1 || saves.length > ms.length * 0.6 || !uniq(s)) return null;
  return { fen: fenOf(s), check: "save" };
});

// C6 체크: 체크하는 수 찾기
OUT.C6 = gen(10, () => {
  const b = place([["K", (i) => i < 24], ["k", (i) => i >= 40], [pick(["Q", "R", "B", "N", "R"])], [pick(["p", null].filter(Boolean)[0])]]);
  if (!b) return null;
  const s = S(b, "w");
  if (!legalPos(s) || C.inCheck(s)) return null;
  const ck = A.checks(s);
  if (ck.length < 1 || ck.length > 4 || A.mateIn1(s).length || !uniq(s)) return null;
  return { fen: fenOf(s), check: "check" };
});

// C7 체크 벗어나기: 흰이 체크당한 판 (도망·막기·잡기)
OUT.C7 = gen(10, () => {
  const b = place([["K"], ["k"], [pick(["r", "b", "q", "n", "r"])], [pick(["R", "N", "B"])], ["P", (i) => i < 32]]);
  if (!b) return null;
  const s = S(b, "w");
  if (C.inCheck(s, "b") || !C.inCheck(s)) return null;
  if (s.kings.w >= 0 && C.KG[s.kings.w].includes(s.kings.b)) return null;
  const ms = C.moves(s), illegal = C.pseudoMoves(s).length - ms.length;
  if (ms.length < 2 || illegal < 3 || !uniq(s)) return null;
  const hows = new Set(ms.map((m) => P.escapeHow(s, m)));
  if (hows.size < 2) return null;
  return { fen: fenOf(s), check: "escape" };
});

// C8 체크메이트(1): 한 수 메이트, 정답 하나
const mateMaker = (pieces, edge) => () => {
  const spec = [["k", edge ? (i) => (i >> 3) === 7 || (i & 7) === 0 || (i & 7) === 7 : null], ["K"], ...pieces.map((p) => [p])];
  if (rng() < 0.5) spec.push(["p", (i) => i >= 40]);
  const b = place(spec);
  if (!b) return null;
  const s = S(b, "w");
  if (!legalPos(s) || C.inCheck(s)) return null;
  const mates = A.mateIn1(s);
  if (mates.length !== 1 || !uniq(s)) return null;
  // 흰 말이 잡히는 판은 빼기 (아이가 헷갈림)
  if (A.hanging(s, "w").length) return null;
  return { fen: fenOf(s), check: "mate" };
};
OUT.C8 = [...gen(6, mateMaker(["Q"], true)), ...gen(6, mateMaker(["R", "R"], true)), ...gen(3, mateMaker(["Q", "N"], true))];

// C9 체크메이트(2): 룩 두 개 사다리 / 퀸 + 킹
OUT.C9 = [...gen(5, mateMaker(["R", "R"], true)), ...gen(5, mateMaker(["Q"], true))];

// C10 캐슬링: 할 수 있을까?
OUT.C10 = [];
{
  const want = { ok: 4, between: 2, check: 2, through: 2, moved: 2 };
  for (let k = 0; k < 100000 && Object.values(want).some((v) => v > 0); k++) {
    const b = new Array(64).fill(null);
    b[4] = "K"; b[7] = "R"; b[0] = "R";
    for (const i of [8, 9, 10, 13, 14, 15]) if (rng() < 0.8) b[i] = "P";
    b[60] = "k";
    const kind = pick(Object.keys(want).filter((x) => want[x] > 0));
    const side = rng() < 0.6 ? "K" : "Q";
    let castle = "KQ";
    if (kind === "between") b[side === "K" ? 6 : pick([1, 2, 3])] = pick(["N", "B"]);
    if (kind === "moved") castle = side === "K" ? "Q" : "K";
    if (kind === "check" || kind === "through") {
      const att = pick(["r", "b", "q"]);
      for (let t = 0; t < 50; t++) { const i = 16 + rint(40); if (!b[i]) { b[i] = att; break; } }
    }
    const s = S(b, "w", castle);
    if (C.inCheck(s, "b")) continue;
    if (P.castleWhy(s, side) !== kind || !uniq(s)) continue;
    want[kind]--;
    OUT.C10.push({ fen: fenOf(s), side, answer: kind });
  }
  if (Object.values(want).some((v) => v > 0)) throw new Error("C10 모자람 " + JSON.stringify(want));
  OUT.C10.sort(() => rng() - 0.5);
}

// C11 비김(스테일메이트): 검정 차례 판 — 체크메이트 / 스테일메이트 / 아직 둘 수 있어
OUT.C11 = [];
{
  const want = { mate: 4, stalemate: 4, play: 4 };
  for (let k = 0; k < 400000 && Object.values(want).some((v) => v > 0); k++) {
    const b = place([["k", (i) => (i >> 3) === 7 || (i & 7) === 0 || (i & 7) === 7], ["K"], [pick(["Q", "Q", "R"])]]);
    if (!b) continue;
    const s = S(b, "b");
    if (C.inCheck(s, "w") || C.KG[s.kings.w].includes(s.kings.b)) continue;
    let c = P.classify(s);
    if (c === "check") continue;
    // '아직 둘 수 있어' 는 킹이 갈 곳이 1~2칸뿐인 헷갈리는 판만
    if (c === "play" && C.moves(s).length > 2) continue;
    if (!want[c] || !uniq(s)) continue;
    want[c]--;
    OUT.C11.push({ fen: fenOf(s), answer: c });
  }
  if (Object.values(want).some((v) => v > 0)) throw new Error("C11 모자람 " + JSON.stringify(want));
  OUT.C11.sort(() => rng() - 0.5);
}

// id 붙이기
for (const [k, list] of Object.entries(OUT)) list.forEach((x, i) => (x.id = k + "-" + String(i + 1).padStart(2, "0")));

const file = path.join(__dirname, "..", "data", "puzzles.js");
const body = "/* 자동 생성: node tools/gen-puzzles.js — 손으로 고치지 말 것 (아이 기록이 id 에 붙음) */\n" +
  "(function (root) {\n  const PUZZLES = " + JSON.stringify(OUT, null, 1).replace(/\n\s*/g, "\n  ") + ";\n" +
  "  root.PUZZLES = PUZZLES;\n  if (typeof module !== \"undefined\") module.exports = PUZZLES;\n})(typeof window !== \"undefined\" ? window : globalThis);\n";
fs.writeFileSync(file, body);
console.log(Object.entries(OUT).map(([k, v]) => `${k} ${v.length}`).join(" · "), "→ data/puzzles.js");
