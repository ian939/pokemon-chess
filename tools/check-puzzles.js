/* 퍼즐 데이터 검증: node tools/check-puzzles.js [--show]
 * 모든 FEN 이 읽히는지, 정답이 있는지(그리고 너무 많지 않은지) 엔진으로 다시 확인한다. */
const C = require("../js/rules.js");
const A = require("../js/analyze.js");
const P = require("../js/puzzle.js");
const PZ = require("../data/puzzles.js");
const show = process.argv.includes("--show");
let fail = 0;
const bad = (id, why) => { fail++; console.log("  ✗", id, why); };
function draw(s) {
  const rows = [];
  for (let r = 7; r >= 0; r--) { let row = r + 1 + " "; for (let f = 0; f < 8; f++) row += (s.b[r * 8 + f] || "·") + " "; rows.push(row); }
  return rows.join("\n") + "\n  a b c d e f g h";
}
for (const [k, list] of Object.entries(PZ)) {
  for (const p of list) {
    let s;
    try { s = C.parse(p.fen); } catch (e) { bad(p.id, "FEN"); continue; }
    if (s.kings.w >= 0 && s.kings.b >= 0 && C.inCheck(s, C.other(s.turn))) bad(p.id, "둘 차례가 아닌 쪽이 체크");
    if (k === "C2") { const a = P.tapAnswer(p); if (!a.length) bad(p.id, "정답 없음"); }
    if (p.check) {
      const ms = C.moves(s);
      const ok = ms.filter((m) => P.checkMove(p, s, m).ok);
      if (!ok.length) bad(p.id, "정답 수 없음");
      if (p.check === "mate" && ok.length > 2) bad(p.id, "메이트가 " + ok.length + "개");
      if (p.check !== "escape" && ok.length === ms.length) bad(p.id, "아무 수나 정답");
      if (p.answers && ok.length !== p.answers.length) bad(p.id, "정답 수 중 둘 수 없는 수가 있음");
      if (p.check === "mate2") {
        // 첫 수 뒤 상대가 무엇을 해도 한 수 메이트가 있어야 한다
        for (const m of ok) {
          const t = C.make(s, m);
          if (!C.moves(t).every((r) => A.mateIn1(C.make(t, r)).length)) bad(p.id, "두 수 메이트가 아님 " + C.uci(m));
        }
      }
      if (p.kind && "fork pin skewer".includes(p.kind) && ok.some((m) => A.tacticOf(s, m) !== p.kind)) bad(p.id, "정답이 " + p.kind + " 모양이 아님");
      if (show && list.indexOf(p) < 2) console.log(`\n${p.id} (${p.check}) 정답: ${ok.map(C.uci).join(", ")}\n${draw(s)}`);
    }
    if (k === "C10" && P.castleWhy(s, p.side) !== p.answer) bad(p.id, "캐슬링 답 다름");
    if (k === "C11" && P.classify(s) !== p.answer) bad(p.id, "분류 다름");
    if (show && (k === "C10" || k === "C11" || k === "C4" || k === "C2") && list.indexOf(p) < 1) console.log(`\n${p.id} 답 ${p.answer || P.tapAnswer(p).map(C.name)} ${p.side || ""} ${p.arrow || ""}\n${draw(s)}`);
  }
}
console.log(fail ? `\n실패 ${fail}` : "\n퍼즐 " + Object.values(PZ).flat().length + "개 모두 통과");
process.exit(fail ? 1 : 0);
