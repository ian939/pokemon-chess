/* mentor.js — 피카츄가 무슨 말을 할지 고른다 (화면을 모른다, Node 시험: node tools/test-mentor.js)
 *
 * 돌려주는 말: { say:[문장…], arrows:[[from,to,'red'|'green']], rings:[칸], glow:칸, kind }
 * 아이는 늘 흰. 우선순위는 plan §6.2 — 위에서부터 먼저 걸리는 것 하나만 말한다.
 */
(function (root) {
  "use strict";
  const C = root.Chess || require("./rules.js");
  const A = root.Analyze || require("./analyze.js");
  const V = root.VoiceLines || require("./voice-lines.js");
  const { L, T } = V;

  const isMateGoal = (goal) => !goal || goal.type === "mate" || goal.type === "mateIn";
  const msg = (kind, say, extra) => Object.assign({ kind, say: say.filter(Boolean), arrows: [], rings: [] }, extra || {});

  /**
   * 내 차례가 시작될 때 (상대가 막 둔 뒤).
   * help: 'full' | 'half' | 'ask' | 'none'.  ctx: { tipsSaid:Set } 같은 말을 되풀이하지 않게
   */
  function turnStart(s, goal, help, ctx) {
    if (help === "none" || help === "ask") return null;
    ctx = ctx || {};
    const mateGoal = isMateGoal(goal);
    const hasKings = s.kings.w >= 0 && s.kings.b >= 0;
    if (mateGoal && hasKings) {
      // 1. 한 수 메이트
      const m1 = A.mateIn1(s);
      if (m1.length) {
        // 이기는 끝내기에서 많이 도와줄 땐 메이트 수까지 화살표로 (끝까지 안내)
        const show = help === "full" && A.winningEndgame(s);
        return msg("mate1", [L.mate1], { glow: m1[0].from, arrows: show ? [[C.name(m1[0].from), C.name(m1[0].to), "green"]] : [] });
      }
      // 2. 체크 당함
      if (C.inCheck(s)) {
        const ch = A.checkers(s);
        return msg("check", [T.checkBy(s.b[ch[0]]), L.checkHow], { arrows: ch.map((c) => [C.name(c), C.name(s.kings.w), "red"]) });
      }
      // 3. 상대가 메이트를 노림
      const tm = A.threatMate(s);
      if (tm.length) return msg("threatMate", [L.threatMate], { arrows: [[C.name(tm[0].from), C.name(tm[0].to), "red"]] });
    }
    // 3-1. 앙파상 기회 (바로 이번 수에만): 손해가 아니면 알려 준다 — 빈칸으로 잡는 거라 '공짜 잡기' 보다 먼저 설명
    if (help !== "ask") {
      const ep = C.moves(s).find((m) => m.flag === "ep" && A.gain(s, m) >= 0);
      if (ep) {
        const victim = (ep.from & ~7) | (ep.to & 7);
        return msg("enPassant", [L.epChance1, L.epChance2], { arrows: [[C.name(ep.from), C.name(ep.to), "green"]], rings: [C.name(victim)] });
      }
    }
    // 4. 내 말이 위험 — 단, 노리는 상대를 공짜로 먼저 잡을 수 있으면 그걸 말한다
    const hang = A.hanging(s, "w");
    const fc0 = A.freeCaptures(s);
    if (hang.length) {
      const h = hang[0];
      const first = fc0.find((f) => f.m.to === h.by && f.gain >= 1);
      if (first) return msg("canTake", [T.canTake(first.m.cap), first.undefended ? L.noGuard : L.goodTrade], { rings: [C.name(first.m.to)] });
      return msg("threat", [T.threat(h.byPiece, h.piece), h.undefended ? L.protect : L.hurtTrade], { arrows: [[C.name(h.by), C.name(h.sq), "red"]], rings: [C.name(h.sq)] });
    }
    // 5. 공짜로(이득 보며) 잡을 수 있음
    const fc = fc0;
    if (fc.length) {
      const f = fc[0];
      return msg("canTake", [T.canTake(f.m.cap), f.undefended ? L.noGuard : L.goodTrade], { rings: [C.name(f.m.to)] });
    }
    // 6. 이기는 끝내기 → 체크메이트까지 안내 (반 도움이면 동그라미만, 화살표는 없음)
    if (mateGoal && hasKings) {
      const eg = endgameGuide(s, help, ctx);
      if (eg) return eg;
    }
    if (help === "half") return null;
    // 7. 진화
    const pm = A.promoNext(s, "w");
    if (pm.length) return msg("promoMine", [L.promoMine], { rings: [C.name(pm[0].to)] });
    const pt = A.promoNext(s, "b");
    if (pt.length) return msg("promoTheirs", [L.promoTheirs], { arrows: [[C.name(pt[0].from), C.name(pt[0].to), "red"]] });
    if (mateGoal && hasKings) {
      // 8. 첫 걸음 세 약속
      const tips = ctx.tipsSaid || new Set();
      if (s.full <= 10 && C.material(s, "w") >= 30) {
        const centerPawn = [27, 28].some((i) => s.b[i] === "P") || [35, 36].some((i) => s.b[i] === "P");
        if (!centerPawn && !tips.has("open1")) { tips.add("open1"); return msg("open", [L.open1], { rings: ["d4", "e4"] }); }
        const und = A.undeveloped(s, "w");
        if (und.length >= 2 && s.full >= 3 && !tips.has("open2" + und.length)) { tips.add("open2" + und.length); return msg("open", [L.open2], { rings: und.map(C.name) }); }
        if (s.castle.includes("K") && und.length <= 1 && !tips.has("open3") && C.moves(s).some((m) => m.flag === "K")) { tips.add("open3"); return msg("open", [L.open3], { glow: s.kings.w }); }
      }
    }
    // 10. 응원 (가끔)
    if (ctx.rng && ctx.rng() < 0.35) return msg("cheer", [[L.cheer1, L.cheer2, L.cheer3, L.cheer4][Math.floor(ctx.rng() * 4)]]);
    return null;
  }

  /**
   * 이기는 끝내기에서 체크메이트까지 안내 (plan §6.2-9, 사용자 요청 2026-11-15).
   * 파란 동그라미 = 상대 대장이 도망갈 칸, 초록 화살표 = 칸을 줄이는 수 (help 'full' 일 때만 화살표).
   * 같은 말을 매번 하지 않게: 처음 두 번은 설명, 그 뒤는 세 턴에 한 번 짧게.
   */
  function endgameGuide(s, help, ctx) {
    const eg = A.winningEndgame(s);
    if (!eg) return null;
    const n = (ctx.egTurns = (ctx.egTurns || 0) + 1);
    const best = help === "full" ? A.mateGuideMove(s) : null;
    const arrows = best ? [[C.name(best.from), C.name(best.to), "green"]] : [];
    const rings = eg.kingSquares.map(C.name);
    let say = [];
    if (n <= 1) say = [L.endgame, L.mateGuide];
    else if (eg.far && !(ctx.kingTipAt > n - 4)) { ctx.kingTipAt = n; say = [L.mateKingHelp]; }
    else if (n % 3 === 0) say = [best ? L.mateGuideArrow : L.mateGuide];
    return msg("endgameGuide", say, { rings, arrows, glow: best ? best.from : undefined, quiet: !say.length });
  }

  /**
   * 비기는 수 막기 (사용자 요청 2026-11-15): 스테일메이트를 만드는 수, 앞서 있는데 같은 자리를 세 번 만드는 수.
   * keys = 지금까지의 posKey 목록. 돌려주는 값 { kind, say } 또는 null
   */
  function drawWarn(s, m, keys) {
    if (s.kings.w < 0 || s.kings.b < 0) return null;
    if (A.makesStalemate(s, m)) return { kind: "warnStalemate", say: [L.warnStalemate, L.warnAsk] };
    if (keys && C.material(s, "w") - C.material(s, "b") >= 3) {
      const k = C.posKey(C.make(s, m));
      if (keys.filter((x) => x === k).length >= 2) return { kind: "warnRepeat", say: [L.warnRepeat, L.warnAsk] };
    }
    return null;
  }
  /** 상대가 둔 수 m 으로 내 말이 잡혔으면 그 말 */
  function afterTheirs(before, m, after) {
    if (m.flag === "ep") return msg("epTheirs", [L.epTheirs]);
    if (m.promo) return msg("theirEvolved", [L.theirEvolved]);
    if (m.cap && m.cap !== "k") return msg("lost", [T.lost(m.cap)]);
    return null;
  }

  /** 내가 둔 수 m 뒤 칭찬·앞일 (help 'full' 일 때만 자세히) */
  function afterMine(before, m, after, goal, help) {
    if (help === "none") return null;
    if (m.promo) return msg("evolved", [L.evolved]);
    if (m.flag === "ep") return msg("epMine", [L.epMine]);
    if (m.cap && A.gain(before, m) >= 1) return msg("took", [T.took(m.cap)]);
    if (after.kings.b >= 0 && C.inCheck(after)) return msg("gaveCheck", [L.gaveCheck]);
    if (help !== "full") return null;
    if (m.flag === "K" || m.flag === "Q") return msg("castled", [L.castled]);
    // 다음에 잡을 수 있게 된 말 (지금 이 말이 새로 노리는 상대)
    const pass = A.pass(after);
    const fc = A.freeCaptures(pass).filter((f) => f.m.from === m.to);
    if (fc.length && !A.hanging(after, "w").some((h) => h.sq === m.to)) {
      return msg("next", [T.next(fc[0].m.cap)], { arrows: [[C.name(m.to), C.name(fc[0].m.to), "green"]] });
    }
    if (isMateGoal(goal) && before.full <= 10) {
      if ("NB".includes(m.p) && (m.from >> 3) === 0) return msg("developed", [L.developed]);
      if (m.p === "P" && [27, 28].includes(m.to)) return msg("center", [L.center]);
    }
    return null;
  }

  /**
   * 큰 실수 미리 보기 (plan §6.1-D): 수 m 이 ⚡3 이상 손해거나 메이트를 당하면 경고.
   * values = Analyze.moveValues(s) 결과. 돌려주는 값 { say, refute(상대의 대답 수) } 또는 null
   */
  function warn(s, m, values, help) {
    if (!values || !values.length || help === "none") return null;
    const u = C.uci(m);
    const mine = values.find((x) => C.uci(x.m) === u);
    if (!mine) return null;
    const best = values[0].v;
    const mateDanger = mine.v <= -90;
    if (help === "ask" && !mateDanger) return null;
    if (!mateDanger && best - mine.v < 3) return null;
    const refute = A.refutation(s, m);
    if (!refute) return null;
    if (mateDanger) return { say: [L.warnMate, L.warnAsk], refute, kind: "warnMate" };
    const t = C.make(s, m);
    const lostPiece = t.b[refute.to];
    if (refute.cap && lostPiece) return { say: [T.warn(refute.p, lostPiece), L.warnAsk], refute, kind: "warn" };
    return null;
  }

  /** 힌트 (plan §6.1 💡): 1 어떤 말 · 2 어디로 · 3 이유 */
  function hint(s, goal, level, best) {
    if (!best) return null;
    if (level === 1) return msg("hint1", [T.moveIt(best.p)], { glow: best.from });
    if (level === 2) return msg("hint2", [L.hint2], { glow: best.from, rings: [C.name(best.to)], arrows: [[C.name(best.from), C.name(best.to), "green"]] });
    // 3단계: 이유
    const t = C.make(s, best);
    let why;
    if (t.kings.b >= 0 && C.inCheck(t) && !C.moves(t).length) why = L.hintMate;
    else if (best.cap && A.gain(s, best) >= 1) why = T.canTake(best.cap);
    else {
      const before = A.hanging(s, "w");
      const after = A.hanging(t, "w");
      if (before.length && !after.some((h) => h.sq === (best.from === before[0].sq ? best.to : before[0].sq))) why = T.safeNow(s.b[before[0].sq]);
      else if (t.kings.b >= 0 && C.inCheck(t)) why = L.hintCheck;
      else why = L.hintGood;
    }
    return msg("hint3", [why], { glow: best.from, arrows: [[C.name(best.from), C.name(best.to), "green"]] });
  }

  /** 규칙에 어긋나는 칸을 눌렀을 때 */
  function illegal(s, from, to) {
    const pm = C.pseudoMoves(s).find((m) => m.from === from && m.to === to);
    if (!pm) {
      // 리오르(폰)의 헷갈리는 규칙은 따로 설명한다
      const p = s.b[from];
      if (p && p.toUpperCase() === "P") {
        const dir = p === "P" ? 8 : -8, df = (to & 7) - (from & 7);
        if (df === 0 && (to === from + dir || to === from + 2 * dir) && (s.b[from + dir] || s.b[to])) return L.pawnBlocked;
        if (Math.abs(df) === 1 && to === from + dir + df && !s.b[to]) return L.pawnDiagEmpty;
      }
      return L.illegal;
    }
    if (C.inCheck(s)) return L.stillCheck;
    if (pm.p === "K") return L.kingDanger;
    return L.pinned;
  }

  const Mentor = { turnStart, endgameGuide, drawWarn, afterTheirs, afterMine, warn, hint, illegal };
  root.Mentor = Mentor;
  if (typeof module !== "undefined") module.exports = Mentor;
})(typeof window !== "undefined" ? window : globalThis);
