/* 규칙 엔진 시험: node tools/test-rules.js
 * perft = 정해진 깊이까지 가능한 수의 개수. 표준 위치 값과 맞으면 앙파상·캐슬링·프로모션·핀까지 맞다는 뜻이다. */
const C = require("../js/rules.js");
let fail = 0;
const eq = (name, got, want) => {
  if (got === want) console.log("  ok ", name, got);
  else { fail++; console.log("  FAIL", name, "got", got, "want", want); }
};

console.log("perft");
const P = [
  [C.START, [20, 400, 8902, 197281]],
  ["r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862]],
  ["8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238]],
  ["r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
  ["rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62379]],
  ["r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10", [46, 2079, 89890]],
];
for (const [f, vals] of P) {
  const s = C.parse(f);
  vals.forEach((v, i) => eq(f.slice(0, 20) + "… d" + (i + 1), C.perft(s, i + 1), v));
}

console.log("상태");
eq("바보 메이트", C.status(C.parse("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3")).result, "mate");
eq("스테일메이트", C.status(C.parse("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")).result, "stalemate");
eq("킹끼리 = 말 부족", C.status(C.parse("8/8/4k3/8/8/3K4/8/8 w - - 0 1")).result, "material");
eq("킹+나이트 = 말 부족", C.status(C.parse("8/8/4k3/8/8/3KN3/8/8 w - - 0 1")).result, "material");
eq("킹+룩은 계속", C.status(C.parse("8/8/4k3/8/8/3KR3/8/8 w - - 0 1")).over, false);
eq("50수", C.status(C.parse("8/8/4k3/8/8/3KR3/8/8 w - - 100 80")).result, "fifty");
{
  let s = C.parse("8/8/4k3/8/8/3K4/8/R7 w - - 0 1");
  const keys = [C.posKey(s)];
  for (const u of ["d3d4", "e6e7", "d4d3", "e7e6", "d3d4", "e6e7", "d4d3", "e7e6"]) { s = C.make(s, C.fromUci(s, u)); keys.push(C.posKey(s)); }
  eq("3회 반복", C.status(s, keys).result, "repetition");
}

console.log("킹 없는 판 (미션·미니게임)");
{
  const s = C.parse("8/pppppppp/8/8/8/8/PPPPPPPP/8 w - - 0 1");
  eq("폰 전쟁 첫 수 개수", C.moves(s).length, 16);
  eq("킹 없음 → 체크 아님", C.inCheck(s), false);
  const r = C.parse("8/8/8/8/3R4/8/8/8 w - - 0 1");
  eq("룩 혼자 d4 = 14칸", C.moves(r).length, 14);
  const n = C.parse("8/8/8/8/8/8/8/N7 w - - 0 1");
  eq("나이트 a1 = 2칸", C.moves(n).length, 2);
  const k = C.parse("8/8/8/2r5/8/8/8/4K3 w - - 0 1");
  eq("킹은 노려진 칸에 못 감 (c 줄 막힘)", C.moves(k).map(C.uci).sort().join(","), "e1d1,e1d2,e1e2,e1f1,e1f2");
}

console.log("특수 수");
{
  let s = C.parse("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
  const ep = C.fromUci(s, "e5d6");
  eq("앙파상 가능", !!ep && ep.flag, "ep");
  s = C.make(s, ep);
  eq("앙파상 뒤 d5 비움", s.b[C.sq("d5")], null);
  s = C.parse("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  const ck = C.fromUci(s, "e1g1");
  eq("짧은 캐슬링", ck && ck.flag, "K");
  const t = C.make(s, ck);
  eq("캐슬링 뒤 룩 f1", t.b[C.sq("f1")], "R");
  eq("캐슬링 뒤 권리", t.castle, "kq");
  s = C.parse("r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1");
  eq("f1 노려짐 → 짧은 캐슬링만 금지", C.moves(s).filter((m) => m.flag).map((m) => m.flag).join(), "Q");
  s = C.parse("r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1");
  eq("체크 중 캐슬링 금지", C.moves(s).some((m) => m.flag === "K" || m.flag === "Q"), false);
  s = C.parse("r3k2r/8/8/8/8/8/8/R3K1rR w KQkq - 0 1");
  eq("룩 앞에 말 → 캐슬링 금지", C.moves(s).some((m) => m.flag === "K"), false);
  s = C.parse("8/4P3/8/8/8/8/8/4k2K w - - 0 1");
  eq("프로모션 4가지", C.moves(s).filter((m) => m.promo).length, 4);
}

console.log(fail ? `\n실패 ${fail}개` : "\n모두 통과");
process.exit(fail ? 1 : 0);
