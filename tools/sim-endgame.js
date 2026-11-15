/* 끝내기 안내 시뮬레이션: node tools/sim-endgame.js [판 수=40]
 * 이기는 끝내기(퀸·룩·룩 둘 vs 킹, 퀸 vs 킹+폰)에서
 *   혼자 두는 아이 (봇 3 처럼: 잡을 건 잡지만 몰아가는 법은 모름)
 *   경고만 듣는 아이 (스테일메이트·반복 경고가 뜨면 다른 수)
 *   안내를 따르는 아이 (경고 + 초록 화살표를 80% 따름, 메이트 화살표는 늘 따름)
 * 가 60수 안에 체크메이트 / 스테일메이트 / 그 밖의 비김으로 끝나는 비율을 본다. */
const C = require("../js/rules.js");
const Game = require("../js/game.js");
const E = require("../js/engine.js");
const A = require("../js/analyze.js");
const M = require("../js/mentor.js");
const N = +(process.argv[2] || 40);

function randomPos(white, black, rng) {
  for (;;) {
    const b = new Array(64).fill(null);
    const put = (p) => { for (;;) { const i = Math.floor(rng() * 64); if (!b[i] && !("Pp".includes(p) && (i < 8 || i >= 56))) { b[i] = p; return; } } };
    put("K"); put("k");
    white.forEach(put); black.forEach(put);
    const s = C.parse(C.board({ b }) + " w - - 0 1");
    if (C.KG[s.kings.w].includes(s.kings.b) || C.inCheck(s, "b")) continue;
    if (C.status(s).over) continue;
    if (!A.winningEndgame(s)) continue;
    return C.fen(s);
  }
}
function kidPick(g, mode, rng) {
  const s = g.s;
  let ms = C.moves(s, { promos: "Q" });
  if (mode !== "alone") {
    const m1 = A.mateIn1(s);
    if (mode === "guided" && m1.length) return m1[0];
    const ok = ms.filter((m) => !M.drawWarn(s, m, g.keys));
    if (ok.length) ms = ok;
    if (mode === "guided" && rng() < 0.8) {
      const gm = A.mateGuideMove(s);
      if (gm && ms.some((m) => C.uci(m) === C.uci(gm))) return gm;
    }
  }
  // 혼자 두는 아이: 봇 3 의 고르기를 위 후보 안에서
  const pick = E.pick(s, 3, { type: "mate" }, rng);
  if (pick && ms.some((m) => C.uci(m) === C.uci(pick))) return pick;
  return ms[Math.floor(rng() * ms.length)];
}
const SETS = { "퀸 vs 킹": [["Q"], []], "룩 vs 킹": [["R"], []], "룩 둘 vs 킹": [["R", "R"], []], "퀸 vs 킹+폰2": [["Q"], ["p", "p"]] };
for (const [name, [w, b]] of Object.entries(SETS)) {
  const out = {};
  for (const mode of ["alone", "warn", "guided"]) {
    let mate = 0, stale = 0, other = 0, plies = 0;
    for (let i = 0; i < N; i++) {
      const rng = E.mulberry(5000 + i);
      const g = Game.create({ fen: randomPos(w, b, rng), goal: { type: "mate" } });
      while (!g.over && g.hist.length < 120) {
        const m = g.s.turn === "w" ? kidPick(g, mode, rng) : E.pick(g.s, 5, { type: "mate" }, rng);
        Game.play(g, m);
      }
      const r = g.over;
      if (r && r.winner === "w") { mate++; plies += g.hist.length; }
      else if (r && r.reason === "stalemate") stale++;
      else other++;
    }
    out[mode] = `메이트 ${Math.round((mate / N) * 100)}% · 스테일 ${Math.round((stale / N) * 100)}% · 그 밖 ${Math.round((other / N) * 100)}%` + (mate ? ` (평균 ${Math.round(plies / mate / 2)}수)` : "");
  }
  console.log(`\n${name}\n  혼자      ${out.alone}\n  경고만    ${out.warn}\n  안내 따름 ${out.guided}`);
}
