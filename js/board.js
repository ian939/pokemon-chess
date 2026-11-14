/* board.js — 체스판 그리기·조작·연출 (plan §9.2~9.3)
 *
 * const b = Board.create(el, { onDown(sq), onMove(from, to) })
 * b.set(state, { ace })          말 다시 그리기 (ace = 상대 킹 대신 보여 줄 포켓몬 번호)
 * b.marks({ sel, dots, caps, risky, red, stars, rings, ticks, frozen, last, check, glow, arrows })
 * await b.slide(from, to)        말이 미끄러지는 연출 (판 상태는 그 뒤 set 으로 바꾼다)
 * b.shake(sq) / b.flash(sq)
 * 아이는 늘 흰(아래쪽). 누르고 → 누르기가 기본, 끌어서 놓기도 된다.
 */
(function (root) {
  "use strict";
  const C = root.Chess;
  const DEX = { K: 25, Q: 448, R: 149, B: 94, N: 865, P: 447 };
  const GLYPH = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };
  const GLYPH_W = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" };
  const pos = (i) => ({ x: i & 7, y: 7 - (i >> 3) });

  function create(el, h) {
    el.classList.add("board");
    el.innerHTML = "";
    const squares = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const i = (7 - y) * 8 + x;
        const d = document.createElement("div");
        d.className = "sq " + (C.isLight(i) ? "light" : "dark");
        d.style.left = x * 12.5 + "%";
        d.style.top = y * 12.5 + "%";
        d.dataset.sq = i;
        let coord = "";
        if (y === 7) coord += `<i class="cf">${"abcdefgh"[x]}</i>`;
        if (x === 0) coord += `<i class="cr">${8 - y}</i>`;
        d.innerHTML = coord + '<div class="mk"></div>';
        el.appendChild(d);
        squares[i] = d;
      }
    }
    const layer = document.createElement("div");
    layer.className = "pieces";
    el.appendChild(layer);
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "arrows");
    svg.setAttribute("viewBox", "0 0 8 8");
    svg.innerHTML = `<defs>
      <marker id="ahR" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#e5484d"/></marker>
      <marker id="ahG" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#2fa84f"/></marker>
      <marker id="ahB" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#2f6fd6"/></marker></defs><g></g>`;
    el.appendChild(svg);

    const b = { el, squares, layer, svg, state: null, opt: {}, pieceEls: {}, skin: "poke" };

    b.pieceHTML = function (p) {
      const w = p < "a", T = p.toUpperCase();
      if (b.skin === "chess") return `<span class="cg ${w ? "w" : "b"}">${w ? GLYPH_W[T] : GLYPH[T]}</span>`;
      const dex = !w && T === "K" && b.opt.ace ? b.opt.ace : DEX[T];
      return `<img src="assets/sprites/${dex}.png" alt="" draggable="false"><span class="glyph">${w ? GLYPH_W[T] : GLYPH[T]}</span>`;
    };
    b.set = function (s, opt) {
      b.state = s;
      if (opt) b.opt = Object.assign({}, b.opt, opt);
      layer.innerHTML = "";
      b.pieceEls = {};
      for (let i = 0; i < 64; i++) {
        const p = s.b[i];
        if (!p) continue;
        const d = document.createElement("div");
        const w = p < "a";
        d.className = "pc " + (w ? "w" : "b") + (p.toUpperCase() === "K" ? " king" : "");
        const { x, y } = pos(i);
        d.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
        d.innerHTML = b.pieceHTML(p);
        layer.appendChild(d);
        b.pieceEls[i] = d;
      }
    };
    b.marks = function (m) {
      m = m || {};
      const set = (k) => new Set((m[k] || []).map((x) => (typeof x === "string" ? C.sq(x) : x)));
      const dots = set("dots"), caps = set("caps"), risky = set("risky"), red = set("red"), stars = set("stars"), rings = set("rings"), ticks = set("ticks"), frozen = set("frozen"), moved = set("moved");
      const last = set("last");
      for (let i = 0; i < 64; i++) {
        const d = squares[i];
        d.classList.toggle("sel", m.sel === i);
        d.classList.toggle("last", last.has(i));
        d.classList.toggle("red", red.has(i));
        d.classList.toggle("check", m.check === i);
        d.classList.toggle("glow", m.glow === i);
        d.classList.toggle("ring", rings.has(i));
        let h = "";
        if (stars.has(i)) h += '<span class="star">⭐</span>';
        if (dots.has(i)) h += `<span class="dot${risky.has(i) ? " risky" : ""}"></span>`;
        if (caps.has(i)) h += `<span class="capring${risky.has(i) ? " risky" : ""}"></span>`;
        if (ticks.has(i)) h += '<span class="tick">✓</span>';
        if (frozen.has(i)) h += '<span class="zzz">💤</span>';
        if (moved.has(i)) h += '<span class="zzz">👣</span>';
        d.querySelector(".mk").innerHTML = h;
      }
      // 고른 말: 통통 뛰기
      for (const [k, d] of Object.entries(b.pieceEls)) d.classList.toggle("picked", +k === m.sel);
      const g = svg.querySelector("g");
      g.innerHTML = "";
      for (const a of m.arrows || []) {
        const f = typeof a[0] === "string" ? C.sq(a[0]) : a[0], t = typeof a[1] === "string" ? C.sq(a[1]) : a[1];
        const p1 = pos(f), p2 = pos(t);
        const x1 = p1.x + 0.5, y1 = p1.y + 0.5, x2 = p2.x + 0.5, y2 = p2.y + 0.5;
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const k = (len - 0.38) / len;
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", x1); line.setAttribute("y1", y1);
        line.setAttribute("x2", x1 + (x2 - x1) * k); line.setAttribute("y2", y1 + (y2 - y1) * k);
        const col = a[2] === "red" ? "#e5484d" : a[2] === "blue" ? "#2f6fd6" : "#2fa84f";
        line.setAttribute("stroke", col);
        line.setAttribute("stroke-width", "0.17");
        line.setAttribute("stroke-linecap", "round");
        line.setAttribute("opacity", a[3] === "ghost" ? "0.55" : "0.85");
        if (a[3] === "ghost") line.setAttribute("stroke-dasharray", "0.25 0.18");
        line.setAttribute("marker-end", `url(#ah${a[2] === "red" ? "R" : a[2] === "blue" ? "B" : "G"})`);
        g.appendChild(line);
      }
    };
    b.slide = function (from, to, opt) {
      const d = b.pieceEls[from];
      if (!d) return Promise.resolve();
      const victim = b.pieceEls[to];
      const { x, y } = pos(to);
      d.classList.add("moving");
      if (opt && opt.ghost) d.classList.add("ghost");
      d.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
      if (victim && victim !== d) victim.classList.add("caught");
      const ms = root.TEST ? 10 : 280;
      return new Promise((r) => setTimeout(r, ms));
    };
    b.shake = function (sq) {
      const d = b.pieceEls[sq] || squares[sq];
      if (!d) return;
      d.classList.remove("shake");
      void d.offsetWidth;
      d.classList.add("shake");
    };
    b.flash = function (sq, cls) {
      const d = squares[sq];
      d.classList.remove("flash");
      void d.offsetWidth;
      d.classList.add(cls || "flash");
      setTimeout(() => d.classList.remove(cls || "flash"), 900);
    };

    // ---------- 손가락 ----------
    let drag = null;
    const sqAt = (cx, cy) => {
      const r = el.getBoundingClientRect();
      const x = Math.floor(((cx - r.left) / r.width) * 8), y = Math.floor(((cy - r.top) / r.height) * 8);
      if (x < 0 || x > 7 || y < 0 || y > 7) return -1;
      return (7 - y) * 8 + x;
    };
    el.addEventListener("pointerdown", (e) => {
      if (b.locked) return;
      const sq = sqAt(e.clientX, e.clientY);
      if (sq < 0) return;
      const took = h.onDown && h.onDown(sq);
      if (took && b.pieceEls[sq]) {
        drag = { sq, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, el: b.pieceEls[sq] };
        try { el.setPointerCapture(e.pointerId); } catch (er) { /* */ }
      }
    });
    el.addEventListener("pointermove", (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) < 12) return;
      drag.moved = true;
      const r = el.getBoundingClientRect(), cell = r.width / 8;
      const { x, y } = pos(drag.sq);
      drag.el.classList.add("dragging");
      drag.el.style.transform = `translate(${x * 100 + (dx / cell) * 100}%, ${y * 100 + (dy / cell) * 100}%) scale(1.15)`;
    });
    const up = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const d = drag;
      drag = null;
      if (!d.moved) return;
      d.el.classList.remove("dragging");
      const { x, y } = pos(d.sq);
      d.el.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
      const to = sqAt(e.clientX, e.clientY);
      if (to >= 0 && to !== d.sq && h.onDrop) h.onDrop(d.sq, to);
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", (e) => { if (drag) { const { x, y } = pos(drag.sq); drag.el.classList.remove("dragging"); drag.el.style.transform = `translate(${x * 100}%, ${y * 100}%)`; } drag = null; });
    return b;
  }

  root.Board = { create, DEX, GLYPH, GLYPH_W };
})(window);
