/* 스쿨 미션 생성기 시험: node tools/check-school.js [씨앗 개수=30]
 * 모든 말 × 모든 단계에서 판이 만들어지는지, 풀리는지, 만드는 데 오래 걸리지 않는지 본다. */
const School = require("../js/school.js");
const N = +(process.argv[2] || 30);
const KINDS = { R: ["stars", "starsDark", "capture", "safe"], B: ["stars", "starsDark", "capture", "safe"], Q: ["stars", "starsDark", "capture", "safe"],
  K: ["stars", "starsDark", "capture", "safe", "cross"], N: ["stars", "starsDark", "capture", "safe"], P: ["stars", "pawnBlock", "capture", "safe"] };
let fail = 0;
for (const [p, kinds] of Object.entries(KINDS)) {
  for (const k of kinds) {
    let slow = 0, pars = [];
    for (let seed = 1; seed <= N; seed++) {
      const t0 = Date.now();
      try {
        const ms = School.gen(p, k, seed);
        slow = Math.max(slow, Date.now() - t0);
        // 다시 풀어 보기 (생성기가 준 par 와 같아야 함)
        const par = School.solve(ms, 14);
        if (par !== ms.par) { fail++; console.log("  par 불일치", p, k, seed, par, ms.par); }
        pars.push(ms.par);
      } catch (e) { fail++; console.log("  ✗", p, k, seed, e.message); }
    }
    const avg = (pars.reduce((a, b) => a + b, 0) / pars.length).toFixed(1);
    console.log(`${p} ${k.padEnd(9)} par 평균 ${avg} (${Math.min(...pars)}~${Math.max(...pars)})  가장 느린 생성 ${slow}ms${slow > 1500 ? "  ← 느림" : ""}`);
    if (slow > 3000) fail++;
  }
}
console.log(fail ? `\n실패 ${fail}` : "\n통과");
process.exit(fail ? 1 : 0);
