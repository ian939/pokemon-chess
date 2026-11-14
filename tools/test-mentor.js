/* 멘토 시험: node tools/test-mentor.js
 * 준비한 판마다 피카츄가 기대한 종류의 말을 하는지, 그리고 그 말이 '참'인지(가리키는 수를 실제로 둬서) 확인한다.
 * 틀린 설명이 가장 나쁜 버그다. */
const C = require("../js/rules.js");
const A = require("../js/analyze.js");
const M = require("../js/mentor.js");
let fail = 0;
const eq = (name, got, want) => { if (got === want) console.log("  ok ", name, "→", got); else { fail++; console.log("  FAIL", name, "got", got, "want", want); } };

const cases = [
  ["한 수 메이트 (퀸 h7)", "6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1", "mate1"],
  ["체크 당함", "4k3/8/8/8/8/8/8/r3K3 w - - 0 1", "check"],
  ["상대가 메이트 노림 (뒷줄)", "6k1/8/8/8/8/8/5PPP/r5K1 w - - 0 1", "check"],
  ["뒷줄 메이트 위협", "3r2k1/8/8/8/8/8/5PPP/6K1 w - - 0 1", "threatMate"],
  ["루카리오가 노려짐 (지켜지는 상대 폰)", "4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1", "threat"],
  ["노리는 폰을 먼저 잡기", "4k3/8/8/3p4/4Q3/8/8/4K3 w - - 0 1", "canTake"],
  ["공짜 망나뇽", "4k3/8/8/3r4/8/8/3Q4/4K3 w - - 0 1", "canTake"],
  ["진화 직전", "4k3/1P6/8/8/8/8/8/4K3 w - - 0 1", "promoMine"],
  ["첫 수: 가운데", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "open"],
];
for (const [name, fen, want] of cases) {
  const s = C.parse(fen);
  const r = M.turnStart(s, { type: "mate" }, "full", {});
  eq(name, r && r.kind, want);
  if (r) console.log("       피카츄:", r.say.join(" "));
  // 참인지 확인
  if (r && r.kind === "mate1") { const m = A.mateIn1(s)[0]; const t = C.make(s, m); if (!(C.inCheck(t) && !C.moves(t).length)) { fail++; console.log("  FAIL 메이트 아님"); } }
  if (r && r.kind === "canTake") { const sq = C.sq(r.rings[0]); const caps = C.moves(s).filter((m) => m.to === sq && m.cap); if (!caps.some((m) => A.gain(s, m) >= 1)) { fail++; console.log("  FAIL 공짜 아님"); } }
}

console.log("\n큰 실수 경고");
{
  // 루카리오를 상대 폰 앞에 내주는 수
  const s = C.parse("4k3/8/8/4p3/8/8/8/3QK3 w - - 0 1");
  const vals = A.moveValues(s);
  const bad = C.fromUci(s, "d1d4");
  const w = M.warn(s, bad, vals, "full");
  eq("퀸을 폰 앞에 → 경고", w && w.kind, "warn");
  if (w) console.log("       피카츄:", w.say.join(" "), "/ 상대 대답", C.uci(w.refute));
  const ok = C.fromUci(s, "d1d3");
  eq("안전한 수 → 경고 없음", M.warn(s, ok, vals, "full"), null);
  const s3 = C.parse("r5k1/8/8/8/8/8/5PPP/6K1 w - - 0 1");
  const v3 = A.moveValues(s3);
  const w3 = M.warn(s3, C.fromUci(s3, "h2h3"), v3, "full");
  eq("뒷줄 비워 두면 → (h3 은 오히려 안전) 경고 없음", w3, null);
  const w4 = M.warn(s3, C.fromUci(s3, "g1h1"), v3, "full");
  eq("킹이 h1 구석 → 메이트 경고", w4 && w4.kind, "warnMate");
}

console.log("\n힌트");
{
  const s = C.parse("4k3/8/8/3r4/8/8/3Q4/4K3 w - - 0 1");
  const best = A.hintMove(s);
  eq("힌트 수 = 망나뇽 잡기", C.uci(best), "d2d5");
  eq("힌트 3단계 이유", M.hint(s, null, 3, best).say[0], "상대 망나뇽을 잡을 수 있어!");
}

console.log("\n규칙에 어긋난 수 설명");
{
  const s = C.parse("4k3/8/8/8/8/8/4B3/r3K3 w - - 0 1");
  eq("체크 중 다른 말", M.illegal(s, C.sq("e2"), C.sq("d3")), "아직 체크야! 피카츄를 먼저 구해야 해.");
  const p = C.parse("4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1");
  eq("핀 걸린 팬텀", M.illegal(p, C.sq("e2"), C.sq("d3")), "그 친구가 움직이면 피카츄가 노려져서 못 움직여.");
}

console.log("\n리오르(폰) 설명");
{
  const s = C.parse("8/8/8/8/8/4p3/4P3/8 w - - 0 1");
  eq("앞이 막힘", M.illegal(s, C.sq("e2"), C.sq("e3")), "앞에 누가 있으면 리오르는 못 가. 잡을 때만 비스듬히 가!");
  eq("두 칸도 막힘", M.illegal(s, C.sq("e2"), C.sq("e4")), "앞에 누가 있으면 리오르는 못 가. 잡을 때만 비스듬히 가!");
  eq("빈 대각선", M.illegal(s, C.sq("e2"), C.sq("d3")), "리오르는 잡을 때만 비스듬히 갈 수 있어.");
}

console.log(fail ? `\n실패 ${fail}` : "\n모두 통과");
process.exit(fail ? 1 : 0);
