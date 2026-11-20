/* puzzle.js — 개념 수업 퍼즐 판정 (화면을 모른다, Node 시험)
 *
 * 퍼즐 종류
 *   tap     : { fen, piece:'d4' } 이 말이 잡을 수 있는 상대 말을 모두 누르기
 *   move    : { fen, check:'free'|'save'|'check'|'escape'|'mate' } 알맞은 수 두기
 *   choice  : { fen, q, options:[...], answer, arrow? } 고르기
 *   setup   : 판 차리기 (C1)
 */
(function (root) {
  "use strict";
  const C = root.Chess || require("./rules.js");
  const A = root.Analyze || require("./analyze.js");

  /** tap 퍼즐의 정답 칸들 */
  function tapAnswer(p) {
    const s = C.parse(p.fen), from = C.sq(p.piece);
    return C.pseudoMoves(s).filter((m) => m.from === from && m.cap).map((m) => m.to).sort((a, b) => a - b);
  }

  /** 아이가 둔 수가 맞는가 → { ok, how } (how = 어떻게 맞혔는지, 피카츄가 말해 줌) */
  function checkMove(p, s, m) {
    switch (p.check) {
      case "free": {
        if (!m.cap) return { ok: false, how: "notCapture" };
        const g = A.gain(s, m);
        return g >= 1 ? { ok: true, how: "free" } : { ok: false, how: "badTrade", gain: g };
      }
      case "save": {
        const g = A.gain(s, m);
        if (g < 0) return { ok: false, how: "stillHanging" };
        return { ok: true, how: saveHow(s, m) };
      }
      case "check":
        return C.inCheck(C.make(s, m)) ? { ok: true, how: "check" } : { ok: false, how: "noCheck" };
      case "escape":
        return { ok: true, how: escapeHow(s, m) };
      case "answers": // 기술 퍼즐: 엔진이 미리 구한 정답 수
      case "mate2": // 두 수 메이트의 첫 수 (두 번째 수는 'mate' 로 따로 본다)
        return (p.answers || []).includes(C.uci(m)) ? { ok: true, how: p.kind || "answers" } : { ok: false, how: "notBest" };
      case "mate":
        return C.inCheck(C.make(s, m)) && C.moves(C.make(s, m)).length === 0 ? { ok: true, how: "mate" } : { ok: false, how: C.inCheck(C.make(s, m)) ? "onlyCheck" : "noMate" };
      default:
        return { ok: false };
    }
  }
  /** 위험한 말을 어떻게 구했나: run 도망 · capture 먼저 잡기 · block 막기 · guard 지켜 주기 */
  function saveHow(s, m) {
    const h = A.hanging(s, s.turn);
    if (!h.length) return "guard";
    const top = h[0];
    if (m.from === top.sq) return "run";
    if (m.to === top.by) return "capture";
    const t = C.make(s, m);
    if (!C.attackers(t, top.sq, C.other(s.turn)).includes(top.by)) return "block";
    return "guard";
  }
  /** 체크를 어떻게 벗어났나: run 도망 · capture 잡기 · block 막기 */
  function escapeHow(s, m) {
    const ch = A.checkers(s);
    if (m.p.toUpperCase() === "K") return ch.includes(m.to) ? "capture" : "run";
    if (ch.includes(m.to)) return "capture";
    return "block";
  }
  /** 규칙에 어긋난 수를 둘 때 이유: check 체크를 안 막음 · pinned 움직이면 킹이 노려짐 · kingDanger 킹이 위험한 칸으로 */
  function illegalWhy(s, m) {
    if (C.inCheck(s)) return "stillCheck";
    if (m.p.toUpperCase() === "K") return "kingDanger";
    return "pinned";
  }

  /** 캐슬링 판정: ok / between / check / through / moved */
  function castleWhy(s, side) {
    const w = s.turn === "w", home = w ? 4 : 60;
    const right = w ? (side === "K" ? "K" : "Q") : side === "K" ? "k" : "q";
    if (!s.castle.includes(right)) return "moved";
    const between = side === "K" ? [home + 1, home + 2] : [home - 1, home - 2, home - 3];
    if (between.some((i) => s.b[i])) return "between";
    if (C.inCheck(s)) return "check";
    const pass = side === "K" ? [home + 1, home + 2] : [home - 1, home - 2];
    if (pass.some((i) => C.attacked(s, i, C.other(s.turn)))) return "through";
    return "ok";
  }
  /** 검정 차례 판의 상태: mate / stalemate / check / play */
  function classify(s) {
    const n = C.moves(s).length, chk = C.inCheck(s);
    if (!n) return chk ? "mate" : "stalemate";
    return chk ? "check" : "play";
  }

  const Puzzle = { tapAnswer, checkMove, saveHow, escapeHow, illegalWhy, castleWhy, classify };
  root.Puzzle = Puzzle;
  if (typeof module !== "undefined") module.exports = Puzzle;
})(typeof window !== "undefined" ? window : globalThis);
