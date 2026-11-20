/* ranking.js — 살아 있는 세계 순위표 (plan §7.3) (화면을 모른다, Node 시험)
 *
 * - 다른 트레이너들은 날짜를 씨앗으로 날마다 조금씩 오르내린다 (저장할 필요 없음).
 * - 내 순위는 이겨야만 오른다. 라이벌 채두는 늘 내 순위 ±10% 안에서 앞서거니 뒤서거니.
 */
(function (root) {
  "use strict";
  const Ct = root.Content || require("../data/content.js");
  const E = root.Engine || require("./engine.js");

  const V = root.VoiceLines || require("./voice-lines.js");
  const dayOf = (t) => Math.floor(((t || Date.now()) + 9 * 3600e3) / 86400e3); // 한국 시간 날짜
  let ROSTER = null;
  function roster() {
    if (ROSTER) return ROSTER;
    const rng = E.mulberry(777);
    ROSTER = [];
    const n = 160;
    for (let i = 0; i < n; i++) {
      const [cls, sprite] = Ct.ROSTER_CLASSES[Math.floor(rng() * Ct.ROSTER_CLASSES.length)];
      const nm = Ct.ROSTER_NAMES[Math.floor(rng() * Ct.ROSTER_NAMES.length)];
      // 9위 ~ 5000위 사이에 고르게(로그) 흩어 놓는다
      const base = Math.round(Math.exp(Math.log(9) + (Math.log(5200) - Math.log(9)) * (i + rng() * 0.8) / n));
      ROSTER.push({ id: "r" + i, name: cls + " " + nm, sprite, base, phase: rng() * 6.28, speed: 0.4 + rng() * 0.8 });
    }
    return ROSTER;
  }
  /** 그날의 순위 (마스터즈 에이트 1~8 고정 + 나머지) */
  function today(day) {
    const list = roster().map((r) => ({ ...r, rank: Math.max(9, Math.round(r.base * (1 + 0.06 * Math.sin(day * r.speed + r.phase)))) }));
    list.sort((a, b) => a.rank - b.rank);
    for (let i = 1; i < list.length; i++) if (list[i].rank <= list[i - 1].rank) list[i].rank = list[i - 1].rank + 1;
    const masters = Ct.MASTERS.map((id, i) => ({ id, name: Ct.TRAINERS[id].name, sprite: Ct.TRAINERS[id].sprite, rank: i + 1, master: true }));
    return masters.concat(list);
  }
  /** 라이벌 채두의 순위 */
  function rival(day, myRank, wins, beat) {
    let k = Math.sin(day * 1.3 + wins * 2.1) * 0.09 + Math.sin(day * 0.37) * 0.02;
    if (beat) k = Math.abs(k) * 0.6 + 0.02; // 라이벌전에서 이긴 뒤엔 내 바로 뒤에서 따라온다
    return Math.max(9, Math.round(myRank * (1 + k)) + (k === 0 ? 1 : 0));
  }
  /** 내 둘레 순위표: 위 4명, 나, 아래 4명 (라이벌 포함) */
  function board(day, me) {
    if (me.rank <= 8) {
      // 마스터즈 에이트 안: 금랑은 9위로 밀리고, 나머지 일곱 명 사이에 아이가 들어간다 (단독 목록)
      const ms = Ct.MASTERS.filter((x) => x !== "raihan").map((id) => ({ id, name: Ct.TRAINERS[id].name, sprite: Ct.TRAINERS[id].sprite, master: true }));
      ms.splice(me.rank - 1, 0, { id: "me", name: me.name, me: true });
      return { near: ms.map((x, i) => Object.assign(x, { rank: i + 1 })), masters: [], rival: null };
    }
    const all = today(day).filter((x) => !x.master);
    const rv = { id: "bea", name: "채두", sprite: "bea", rank: rival(day, me.rank, me.wins, me.rivalBeat), rival: true };
    if (rv.rank === me.rank) rv.rank += 1;
    const pool = all.filter((x) => x.rank !== rv.rank && x.rank !== me.rank).concat([rv]);
    pool.sort((a, b) => a.rank - b.rank);
    const above = pool.filter((x) => x.rank < me.rank).slice(-4);
    const below = pool.filter((x) => x.rank > me.rank).slice(0, 4);
    return { near: [...above, { id: "me", name: me.name, rank: me.rank, me: true }, ...below], masters: today(day).filter((x) => x.master), rival: rv };
  }
  /** 순위가 old → new 로 오를 때 앞지른 트레이너들 */
  function passed(day, oldRank, newRank, wins) {
    const rv = rival(day, oldRank, wins);
    const list = today(day).filter((x) => !x.master && x.rank < oldRank && x.rank > newRank);
    if (rv < oldRank && rv > newRank) list.push({ id: "bea", name: "채두", sprite: "bea", rank: rv, rival: true });
    return list.sort((a, b) => a.rank - b.rank);
  }
  /** 오늘의 순위 소식 (글로만, 목소리는 "오늘의 순위 소식이에요!") */
  function news(day, me) {
    const rng = E.mulberry(day * 31 + 7);
    const all = today(day).filter((x) => !x.master);
    const rv = rival(day, me.rank, me.wins, me.rivalBeat), rvY = rival(day - 1, me.rank, me.wins, me.rivalBeat);
    const out = [];
    if (me.rivalBeat && me.rivalBeatDay === day) out.push(`라이벌전 결과: ${V.I(me.name)} 채두를 이겼어요! 채두가 "다음엔 내가 이긴다"며 연습하러 갔대요.`);
    if (rv < me.rank && rvY >= me.rank) out.push(`채두가 ${V.UL(me.name)} 앞질렀어요! 다시 따라잡아 볼까요?`);
    else if (rv > me.rank && rvY <= me.rank) out.push(`${V.I(me.name)} 채두를 앞질렀어요! 채두가 이를 갈고 있어요.`);
    else if (rv < rvY) out.push(`채두가 ${1 + Math.floor(rng() * 3)}연승! ${rv.toLocaleString()}위로 올라갔어요.`);
    else out.push(`채두는 지금 ${rv.toLocaleString()}위. 열심히 연습 중이래요.`);
    const mover = all[Math.floor(rng() * all.length)];
    const upBy = 3 + Math.floor(rng() * 40);
    out.push(`${V.I(mover.name)} ${upBy}계단 올라 ${mover.rank.toLocaleString()}위가 됐어요.`);
    const m = Ct.MASTERS[Math.floor(rng() * 3)];
    out.push(`${V.I(Ct.TRAINERS[m].name)} ${rng() < 0.5 ? "또 방어에 성공했어요" : "도전자를 물리쳤어요"}. 마스터즈 에이트는 아직 그대로!`);
    return out;
  }

  const Ranking = { dayOf, roster, today, rival, board, passed, news };
  root.Ranking = Ranking;
  if (typeof module !== "undefined") module.exports = Ranking;
})(typeof window !== "undefined" ? window : globalThis);
