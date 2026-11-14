/* rules.js — 체스 규칙 엔진 (화면을 모른다, Node 로 시험: node tools/test-rules.js)
 *
 * FIDE 규칙 그대로: 체크·메이트·스테일메이트·캐슬링·앙파상·프로모션·50수·3회 반복·말 부족.
 * 미션·미니게임용으로 "킹이 없는 판"도 받는다 — 그 편에 킹이 없으면 체크 검사를 건너뛴다.
 *
 * 칸 번호: 0 = a1, 7 = h1, 56 = a8, 63 = h8 (위로 갈수록 +8). 흰(w) = 아이 편, 아래에서 위로.
 * 말 글자: 대문자 흰 PNBRQK, 소문자 검정 pnbrqk.
 * 수: { from, to, p(움직인 말), cap(잡힌 말|null), promo(PNBRQ 대문자|null), flag: ''|'2'(두 칸)|'ep'|'K'|'Q'(캐슬링) }
 */
(function (root) {
  "use strict";
  const FILES = "abcdefgh";
  const sq = (n) => FILES.indexOf(n[0]) + (n.charCodeAt(1) - 49) * 8;
  const name = (i) => FILES[i & 7] + ((i >> 3) + 1);
  const colorOf = (p) => (!p ? null : p < "a" ? "w" : "b");
  const typeOf = (p) => (p ? p.toUpperCase() : null);
  const other = (c) => (c === "w" ? "b" : "w");
  const VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  // ---------- 미리 계산한 표 ----------
  const KN = [], KG = [], RAYS = []; // RAYS[sq][d]: d 0~3 곧은 방향, 4~7 대각선
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const KNJ = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const inB = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
  for (let s = 0; s < 64; s++) {
    const f = s & 7, r = s >> 3;
    KN[s] = []; KG[s] = []; RAYS[s] = [];
    for (const [df, dr] of KNJ) if (inB(f + df, r + dr)) KN[s].push((r + dr) * 8 + f + df);
    for (const [df, dr] of DIRS) {
      if (inB(f + df, r + dr)) KG[s].push((r + dr) * 8 + f + df);
      const ray = [];
      for (let x = f + df, y = r + dr; inB(x, y); x += df, y += dr) ray.push(y * 8 + x);
      RAYS[s].push(ray);
    }
  }

  // ---------- FEN ----------
  function findKings(s) {
    s.kings = { w: -1, b: -1 };
    for (let i = 0; i < 64; i++) {
      if (s.b[i] === "K") s.kings.w = i;
      else if (s.b[i] === "k") s.kings.b = i;
    }
    return s;
  }
  function parse(fen) {
    const parts = String(fen).trim().split(/\s+/);
    const rows = parts[0].split("/");
    if (rows.length !== 8) throw new Error("bad fen: " + fen);
    const b = new Array(64).fill(null);
    for (let i = 0; i < 8; i++) {
      let f = 0;
      const r = 7 - i;
      for (const c of rows[i]) {
        if (c >= "1" && c <= "8") f += +c;
        else {
          if (!"pnbrqkPNBRQK".includes(c) || f > 7) throw new Error("bad fen: " + fen);
          b[r * 8 + f] = c;
          f++;
        }
      }
      if (f !== 8) throw new Error("bad fen: " + fen);
    }
    return findKings({
      b,
      turn: parts[1] === "b" ? "b" : "w",
      castle: parts[2] && parts[2] !== "-" ? parts[2] : "",
      ep: parts[3] && parts[3] !== "-" ? sq(parts[3]) : -1,
      half: +(parts[4] || 0),
      full: +(parts[5] || 1),
    });
  }
  function board(s) {
    const rows = [];
    for (let r = 7; r >= 0; r--) {
      let row = "", n = 0;
      for (let f = 0; f < 8; f++) {
        const p = s.b[r * 8 + f];
        if (!p) n++;
        else { if (n) row += n; n = 0; row += p; }
      }
      if (n) row += n;
      rows.push(row);
    }
    return rows.join("/");
  }
  const posKey = (s) => board(s) + " " + s.turn + " " + (s.castle || "-") + " " + (s.ep >= 0 ? name(s.ep) : "-");
  const fen = (s) => posKey(s) + " " + s.half + " " + s.full;

  // ---------- 공격 ----------
  /** by 편이 칸 t 를 노리고 있는가 */
  function attacked(s, t, by) {
    const b = s.b, w = by === "w", f = t & 7;
    if (w) {
      if (t >= 8) { if (f > 0 && b[t - 9] === "P") return true; if (f < 7 && b[t - 7] === "P") return true; }
    } else if (t < 56) { if (f > 0 && b[t + 7] === "p") return true; if (f < 7 && b[t + 9] === "p") return true; }
    const N = w ? "N" : "n", K = w ? "K" : "k", R = w ? "R" : "r", B = w ? "B" : "b", Q = w ? "Q" : "q";
    for (const x of KN[t]) if (b[x] === N) return true;
    for (const x of KG[t]) if (b[x] === K) return true;
    for (let d = 0; d < 8; d++) {
      for (const x of RAYS[t][d]) {
        const p = b[x];
        if (p) { if (p === Q || p === (d < 4 ? R : B)) return true; break; }
      }
    }
    return false;
  }
  /** 칸 t 를 노리는 by 편 말들의 칸 목록 */
  function attackers(s, t, by) {
    const b = s.b, w = by === "w", f = t & 7, out = [];
    if (w) {
      if (t >= 8) { if (f > 0 && b[t - 9] === "P") out.push(t - 9); if (f < 7 && b[t - 7] === "P") out.push(t - 7); }
    } else if (t < 56) { if (f > 0 && b[t + 7] === "p") out.push(t + 7); if (f < 7 && b[t + 9] === "p") out.push(t + 9); }
    const N = w ? "N" : "n", K = w ? "K" : "k", R = w ? "R" : "r", B = w ? "B" : "b", Q = w ? "Q" : "q";
    for (const x of KN[t]) if (b[x] === N) out.push(x);
    for (const x of KG[t]) if (b[x] === K) out.push(x);
    for (let d = 0; d < 8; d++) {
      for (const x of RAYS[t][d]) {
        const p = b[x];
        if (p) { if (p === Q || p === (d < 4 ? R : B)) out.push(x); break; }
      }
    }
    return out;
  }
  const inCheck = (s, c) => { c = c || s.turn; return s.kings[c] >= 0 && attacked(s, s.kings[c], other(c)); };

  // ---------- 수 만들기 ----------
  function pseudo(s, promos, caps) {
    promos = promos || "QRBN";
    const out = [], b = s.b, us = s.turn, w = us === "w";
    const add = (from, to, p, cap, flag) => { if (!caps || cap) out.push({ from, to, p, cap: cap || null, promo: null, flag: flag || "" }); };
    const addP = (from, to, p, cap) => {
      if ((to >> 3) === (w ? 7 : 0)) for (const c of promos) out.push({ from, to, p, cap: cap || null, promo: c, flag: "" });
      else add(from, to, p, cap);
    };
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p || colorOf(p) !== us) continue;
      const T = p.toUpperCase();
      if (T === "P") {
        const dir = w ? 8 : -8, r = i >> 3, f = i & 7, one = i + dir;
        if (one < 0 || one > 63) continue;
        if (!b[one]) {
          addP(i, one, p, null);
          if (r === (w ? 1 : 6) && !b[one + dir]) add(i, one + dir, p, null, "2");
        }
        for (const df of [-1, 1]) {
          if (f + df < 0 || f + df > 7) continue;
          const t = one + df, q = b[t];
          if (q && colorOf(q) !== us) addP(i, t, p, q);
          else if (t === s.ep && !q) add(i, t, p, w ? "p" : "P", "ep");
        }
      } else if (T === "N" || T === "K") {
        for (const t of (T === "N" ? KN : KG)[i]) {
          const q = b[t];
          if (!q || colorOf(q) !== us) add(i, t, p, q);
        }
        if (T === "K" && s.castle && !caps) {
          const them = other(us), home = w ? 4 : 60, R = w ? "R" : "r";
          if (i === home) {
            if (s.castle.includes(w ? "K" : "k") && b[home + 3] === R && !b[home + 1] && !b[home + 2] &&
              !attacked(s, home, them) && !attacked(s, home + 1, them) && !attacked(s, home + 2, them)) add(i, home + 2, p, null, "K");
            if (s.castle.includes(w ? "Q" : "q") && b[home - 4] === R && !b[home - 1] && !b[home - 2] && !b[home - 3] &&
              !attacked(s, home, them) && !attacked(s, home - 1, them) && !attacked(s, home - 2, them)) add(i, home - 2, p, null, "Q");
          }
        }
      } else {
        const d0 = T === "B" ? 4 : 0, d1 = T === "R" ? 4 : 8;
        for (let d = d0; d < d1; d++) {
          for (const t of RAYS[i][d]) {
            const q = b[t];
            if (!q) add(i, t, p, null);
            else { if (colorOf(q) !== us) add(i, t, p, q); break; }
          }
        }
      }
    }
    return out;
  }

  function make(s, m) {
    const b = s.b.slice(), w = s.turn === "w";
    b[m.to] = m.promo ? (w ? m.promo : m.promo.toLowerCase()) : m.p;
    b[m.from] = null;
    if (m.flag === "ep") b[m.to + (w ? -8 : 8)] = null;
    else if (m.flag === "K") { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = null; }
    else if (m.flag === "Q") { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = null; }
    let c = s.castle;
    if (c) {
      if (m.p === "K") c = c.replace("K", "").replace("Q", "");
      else if (m.p === "k") c = c.replace("k", "").replace("q", "");
      for (const x of [m.from, m.to]) {
        if (x === 7) c = c.replace("K", "");
        else if (x === 0) c = c.replace("Q", "");
        else if (x === 63) c = c.replace("k", "");
        else if (x === 56) c = c.replace("q", "");
      }
    }
    const kings = { w: s.kings.w, b: s.kings.b };
    if (m.p === "K") kings.w = m.to; else if (m.p === "k") kings.b = m.to;
    return {
      b, turn: w ? "b" : "w", castle: c,
      ep: m.flag === "2" ? (m.from + m.to) >> 1 : -1,
      half: m.p === "P" || m.p === "p" || m.cap ? 0 : s.half + 1,
      full: s.full + (w ? 0 : 1), kings,
    };
  }

  /** 합법 수. 그 편에 킹이 없으면 체크 검사 없이 전부. opt.caps = 잡기·프로모션만 */
  function moves(s, opt) {
    const ps = pseudo(s, opt && opt.promos, opt && opt.caps);
    if (s.kings[s.turn] < 0) return ps;
    const us = s.turn, them = other(us);
    return ps.filter((m) => { const t = make(s, m); return !attacked(t, t.kings[us], them); });
  }
  /** 체크를 무시한 수 (아이가 '규칙에 어긋나는 수'를 둘 때 왜 안 되는지 설명하려고) */
  const pseudoMoves = (s, opt) => pseudo(s, opt && opt.promos);

  function insufficient(s) {
    if (s.kings.w < 0 || s.kings.b < 0) return false;
    const rest = [];
    for (let i = 0; i < 64; i++) {
      const p = s.b[i];
      if (!p || p === "K" || p === "k") continue;
      const T = p.toUpperCase();
      if (T !== "B" && T !== "N") return false;
      rest.push([T, ((i >> 3) + (i & 7)) & 1]);
    }
    if (rest.length <= 1) return true;
    return rest.every((x) => x[0] === "B" && x[1] === rest[0][1]);
  }

  /** 판 상태. keys = 지금까지의 posKey 목록 (반복 판정용) */
  function status(s, keys) {
    const ms = moves(s, { promos: "Q" });
    if (!ms.length) {
      if (s.kings[s.turn] < 0) return { over: true, result: "nomoves" };
      return inCheck(s) ? { over: true, result: "mate", winner: other(s.turn) } : { over: true, result: "stalemate" };
    }
    if (s.half >= 100) return { over: true, result: "fifty" };
    if (keys) {
      const k = posKey(s);
      let n = 0;
      for (const x of keys) if (x === k) n++;
      if (n >= 3) return { over: true, result: "repetition" };
    }
    if (insufficient(s)) return { over: true, result: "material" };
    return { over: false };
  }

  const uci = (m) => name(m.from) + name(m.to) + (m.promo ? m.promo.toLowerCase() : "");
  function fromUci(s, u, opt) {
    return moves(s, opt).find((m) => uci(m) === u) || null;
  }
  function perft(s, d) {
    if (d === 0) return 1;
    const ms = moves(s);
    if (d === 1) return ms.length;
    let n = 0;
    for (const m of ms) n += perft(make(s, m), d - 1);
    return n;
  }
  function material(s, c) {
    let n = 0;
    for (const p of s.b) if (p && colorOf(p) === c) n += VALUE[typeOf(p)];
    return n;
  }
  const isLight = (i) => (((i >> 3) + (i & 7)) & 1) === 1;

  const Chess = {
    FILES, START, VALUE, KN, KG, RAYS, sq, name, colorOf, typeOf, other, parse, fen, posKey, board,
    attacked, attackers, inCheck, moves, pseudoMoves, make, status, insufficient, uci, fromUci, perft, material, isLight,
  };
  root.Chess = Chess;
  if (typeof module !== "undefined") module.exports = Chess;
})(typeof window !== "undefined" ? window : globalThis);
