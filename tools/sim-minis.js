/* 미니 대결·배지가 이길 만한지: node tools/sim-minis.js [판 수=20]
 * 흰(아이 자리)을 봇 5(잘 두는 아이) / 봇 3(서툰 아이)로 두게 하고 승률을 본다.
 * 봇 5 가 거의 못 이기면 판이 너무 어렵고, 봇 3 도 늘 이기면 너무 쉽다. */
const C = require("../js/rules.js");
const Game = require("../js/game.js");
const E = require("../js/engine.js");
const School = require("../js/school.js");
const Ct = require("../data/content.js");
const N = +(process.argv[2] || 20);

function run(cfg, whiteLv, bot, seed) {
  const g = Game.create(cfg), rng = E.mulberry(seed);
  while (!g.over && g.hist.length < 300) {
    let m;
    if (g.s.turn === "w") {
      if (cfg.goal.type === "stars") m = School.raceBot(g, rng, whiteLv >= 5 ? "hard" : "easy", "w");
      else m = E.pick(g.s, whiteLv, cfg.goal, rng);
    } else if (typeof bot === "string") m = School.raceBot(g, rng, bot === "raceEasy" ? "easy" : "normal");
    else m = E.pick(g.s, bot, cfg.goal, rng);
    if (!m) break;
    Game.play(g, m);
  }
  return g.over;
}
const list = [
  ...Object.entries(Ct.BATTLES).filter(([, b]) => b.fen).map(([k, b]) => ["대결 " + k + " " + b.title, b]),
  ...Ct.BADGES.map((b) => ["배지 " + b.id + " " + b.title, b]),
];
for (const [name, b] of list) {
  const cfg = { fen: b.fen, goal: b.goal };
  const res = {};
  for (const lv of [5, 3]) {
    let w = 0, d = 0;
    for (let i = 0; i < N; i++) {
      const o = run(cfg, lv, b.bot, 100 + i);
      if (o && o.winner === "w") w++; else if (!o || !o.winner) d++;
    }
    res[lv] = `${Math.round((w / N) * 100)}%` + (d ? `(무${d})` : "");
  }
  console.log(`${name.padEnd(22)} 봇5 흰 승 ${res[5].padEnd(9)} 봇3 흰 승 ${res[3]}`);
}
