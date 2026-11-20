/* 센 봇(5~8) 단계 시험: node tools/sim-strong.js [판 수=10]
 * 이웃 단계끼리 두고 위 단계 점수(비김·미완은 남은 말 ⚡3 차이로 판정). 시간 제한이 있어 매번 조금씩 다를 수 있다. */
const C = require("../js/rules.js");
const Game = require("../js/game.js");
const E = require("../js/engine.js");
const N = +(process.argv[2] || 10);
for (const [lo, hi] of [[4, 5], [5, 6], [6, 7], [7, 8]]) {
  let score = 0, W = 0, D = 0, Lo = 0;
  for (let i = 0; i < N; i++) {
    const hiWhite = i % 2 === 0, rng = E.mulberry(300 + i * 13 + lo);
    const g = Game.create({ fen: C.START, goal: { type: "mate" } });
    while (!g.over && g.hist.length < 140) {
      const lv = (g.s.turn === "w") === hiWhite ? hi : lo;
      Game.play(g, E.pick(g.s, lv, { type: "mate" }, rng, { budget: 700 }));
    }
    const hc = hiWhite ? "w" : "b";
    if (g.over && g.over.winner) { if (g.over.winner === hc) { W++; score++; } else Lo++; continue; }
    D++;
    const diff = C.material(g.s, hc) - C.material(g.s, C.other(hc));
    score += diff >= 3 ? 1 : diff <= -3 ? 0 : 0.5;
  }
  console.log(`봇 ${hi} vs 봇 ${lo}: ${Math.round((score / N) * 100)}% (승 ${W} 무 ${D} 패 ${Lo})`);
}
