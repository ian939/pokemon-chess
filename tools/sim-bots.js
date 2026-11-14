/* 봇 단계 시험: node tools/sim-bots.js [판 수=40] [최대 단계=5]
 * 이웃 단계끼리 두게 해서 위 단계가 이기는 비율(비김 0.5)을 본다. 목표 65% 이상.
 * 미니게임 목표(폰 전쟁 등)에서도 판이 끝까지 가는지 확인한다. */
const C = require("../js/rules.js");
const Game = require("../js/game.js");
const E = require("../js/engine.js");

const N = +(process.argv[2] || 40), MAXL = +(process.argv[3] || 5);
function playOne(cfg, lw, lb, seed, maxPly) {
  const g = Game.create(cfg), rng = E.mulberry(seed);
  let ms = 0, n = 0;
  while (!g.over && g.hist.length < (maxPly || 200)) {
    const t0 = Date.now();
    const m = E.pick(g.s, g.s.turn === "w" ? lw : lb, cfg.goal, rng);
    ms = Math.max(ms, Date.now() - t0); n++;
    if (!m) break;
    Game.play(g, m);
  }
  return { over: g.over, plies: g.hist.length, slow: ms, s: g.s };
}
let fail = 0;
const full = { fen: C.START, goal: { type: "mate" } };
for (let lo = 1; lo < MAXL; lo++) {
  const hi = lo + 1;
  let score = 0, plies = 0, slow = 0, unfinished = 0, W = 0, D = 0, Lo = 0;
  for (let i = 0; i < N; i++) {
    const hiWhite = i % 2 === 0;
    const r = playOne(full, hiWhite ? hi : lo, hiWhite ? lo : hi, 1000 + i * 7 + lo);
    plies += r.plies; slow = Math.max(slow, r.slow);
    const hiColor = hiWhite ? "w" : "b";
    if (r.over && r.over.winner) {
      if (r.over.winner === hiColor) { W++; score += 1; } else Lo++;
      continue;
    }
    if (!r.over) unfinished++;
    D++;
    // 비김·미완은 남은 말 차이로 판정 (⚡3 이상 앞서면 앞선 쪽)
    const diff = C.material(r.s, hiColor) - C.material(r.s, C.other(hiColor));
    score += diff >= 3 ? 1 : diff <= -3 ? 0 : 0.5;
  }
  const pct = Math.round((score / N) * 100);
  if (pct < 65) fail++;
  console.log(`봇 ${hi} vs 봇 ${lo}: ${pct}%  (승 ${W} 무 ${D} 패 ${Lo})  평균 ${Math.round(plies / N)}수  가장 느린 한 수 ${slow}ms  200수 미완 ${unfinished}${pct < 65 ? "  ← 65% 미만" : ""}`);
}

console.log("\n미니게임이 끝나는가 (봇 2 vs 봇 2, 20판씩)");
const minis = {
  "폰 전쟁": { fen: "8/pppppppp/8/8/8/8/PPPPPPPP/8 w - - 0 1", goal: { type: "promote" } },
  "룩 2 vs 폰 5": { fen: "8/1pp1pp1p/8/8/8/8/8/R6R w - - 0 1", goal: { type: "captureAll", hunter: "w" } },
  "말 사냥": { fen: "rnbq1bnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQ1BNR w - - 0 1", goal: { type: "points", plies: 30 } },
  "킹과 폰": { fen: "4k3/pppp4/8/8/8/8/PPPP4/4K3 w - - 0 1", goal: { type: "promote" } },
};
for (const [name, cfg] of Object.entries(minis)) {
  let done = 0, w = 0, plies = 0;
  for (let i = 0; i < 20; i++) {
    const r = playOne(cfg, 2, 2, 50 + i, 300);
    if (r.over) done++;
    if (r.over && r.over.winner === "w") w++;
    plies += r.plies;
  }
  if (done < 20) fail++;
  console.log(`  ${name}: 끝남 ${done}/20 · 흰 승 ${w} · 평균 ${Math.round(plies / 20)}수`);
}
console.log(fail ? `\n확인 필요 ${fail}개` : "\n통과");
process.exit(fail ? 1 : 0);
