/* bot-worker.js — 센 봇(4~8)이 생각하는 동안 화면이 멈추지 않게 따로 계산한다 (Web Worker).
 * 받는 것: { id, fen, level, goal, seed, budget }  →  돌려주는 것: { id, uci }
 * 열쇠: 이 파일 주소의 ?v= 를 그대로 붙여 불러 캐시가 섞이지 않게 한다. */
/* global importScripts, Chess, Engine */
const V = self.location.search || "";
importScripts("rules.js" + V, "game.js" + V, "engine.js" + V);
self.onmessage = function (e) {
  const d = e.data;
  let uci = null;
  try {
    const s = Chess.parse(d.fen);
    const m = Engine.pick(s, d.level, d.goal, Engine.mulberry(d.seed), { budget: d.budget });
    uci = m ? Chess.uci(m) : null;
  } catch (err) {
    uci = null;
  }
  self.postMessage({ id: d.id, uci });
};
