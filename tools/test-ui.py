"""화면 시험: python tools/test-ui.py [--shots]
?test 모드(목소리·기다림 없음)로 실제 화면을 끝까지 눌러 본다.
  여섯 말 스쿨 전부 → 개념 수업 12개 → 배지 8개 → 리그 한 판(+돌아보기) → 도감 · 어른 화면
콘솔 오류가 하나라도 나면 실패. --shots 면 단계마다 tools/shots/*.png 저장.
"""
import http.server
import pathlib
import socketserver
import sys
import threading
import time

from playwright.sync_api import sync_playwright

for s in (sys.stdout, sys.stderr):
    try:
        s.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = "--shots" in sys.argv
OUT = ROOT / "tools" / "shots"
PORT = 8765


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


DRIVER = r"""
window.__step = function () {
  const P = __T.P();
  const q = (s) => document.querySelector(s);
  const modal = q('.layer.modal [data-v="next"]');
  if (modal) { modal.click(); return 'modal'; }
  const goBtn = q('#tools [data-t="go"]'), backBtn = q('#tools [data-t="back"]');
  if (goBtn && backBtn) { goBtn.click(); return 'warn-go'; }
  if (P.busy && P.busy()) return 'busy';
  if (P.kind === 'choice') { const b = q(`#tools [data-t="${P.answer}"]`); if (b) { b.click(); return 'choice'; } }
  if (P.kind === 'mission') { const m = School.firstStep(P.st()); if (!m) return 'nosol'; P.onDown(m.from); P.onDown(m.to); return 'mission'; }
  if (P.kind === 'game') {
    const g = P.g;
    if (!g.over && g.s.turn === 'w') {
      const m = P.goal.type === 'stars' ? School.raceBot(g, Math.random, 'hard') : Engine.pick(g.s, 5, P.goal);
      P.onDown(m.from); P.onDown(m.to); return 'game';
    }
  }
  if (P.kind === 'puzzle') { const s = P.s(); const ok = Chess.moves(s).find((m) => Puzzle.checkMove(P.pz, s, m).ok); if (ok) { P.onDown(ok.from); P.onDown(ok.to); return 'puzzle'; } }
  if (P.kind === 'tap') { for (const a of P.answer) P.onDown(a); return 'tap'; }
  if (P.kind === 'setup') {
    const st = Chess.parse(Chess.START);
    for (let i = 0; i < 16; i++) { const k = st.b[i]; if (P.need[k] > 0) { P.pick(k); P.onDown(i); } }
    return 'setup';
  }
  // 캐슬링 직접 두기
  if (P.onDown && q('#info') && /두 칸/.test(q('#info').textContent)) { P.onDown(4); P.onDown(6); P.onDown(4); P.onDown(2); return 'castle'; }
  const prim = q('#tools .btn.primary[data-t]');
  if (prim) { prim.click(); return 'btn:' + prim.dataset.t; }
  return 'idle';
};
"""


def main():
    httpd = serve()
    errors = []
    t0 = time.time()
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        page = br.new_page(viewport={"width": 1180, "height": 820}, has_touch=True)
        page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        page.goto(f"http://127.0.0.1:{PORT}/index.html?test")
        page.wait_for_selector(".home")
        page.add_script_tag(content=DRIVER)
        shot_n = [0]

        def shot(name):
            if SHOTS:
                OUT.mkdir(exist_ok=True)
                shot_n[0] += 1
                page.screenshot(path=str(OUT / f"{shot_n[0]:02d}-{name}.png"))

        def drive(until, limit=4000, name=""):
            """until(page) 가 참이 될 때까지 __step 을 돌린다"""
            last = None
            idle = 0
            for i in range(limit):
                if until():
                    return i
                r = page.evaluate("__step()")
                if r in ("idle", "busy", "nosol"):
                    idle += 1
                    page.wait_for_timeout(40)
                else:
                    idle = 0
                if r == "nosol":
                    raise SystemExit(f"[{name}] 미션 풀이 없음")
                if idle > 400:
                    shot("stuck-" + name)
                    raise SystemExit(f"[{name}] 멈춤 (마지막 {last}) 말: {page.evaluate('__T.lastSay()')}")
                last = r
            shot("limit-" + name)
            raise SystemExit(f"[{name}] 한도 초과")

        shot("home")
        page.evaluate("__T.Store.data.settings.unlockAll = true")
        on_list = lambda: page.evaluate("document.querySelector('#app').classList.contains('screen-list')")

        # 1) 여섯 말
        for p in ["R", "B", "Q", "K", "N", "P"]:
            page.evaluate(f"void __T.startPiece('{p}')")
            page.wait_for_timeout(50)
            if p == "R":
                shot("meet-R")
            n = drive(on_list, name="piece-" + p)
            done = page.evaluate(f"__T.Store.data.school['{p}'] && __T.Store.data.school['{p}'].stage")
            print(f"말 {p}: 단계 {done}/6 ({n} 걸음)")
            assert done == 6, p
        shot("school-done")

        # 2) 개념 수업
        for c in ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11", "C12"]:
            page.evaluate(f"void __T.startConcept('{c}')")
            page.wait_for_timeout(50)
            if c in ("C2", "C10"):
                for _ in range(len(page.evaluate(f"Content.CONCEPTS.find(x=>x.id==='{c}').intro"))):
                    page.evaluate("__step()")
                page.wait_for_timeout(50)
                shot("lesson-" + c)
            drive(on_list, name="lesson-" + c)
            st = page.evaluate(f"__T.Store.data.concepts['{c}']")
            print(f"수업 {c}: {st}")
            assert st, c

        # 3) 배지
        for b in range(1, 9):
            page.evaluate(f"void __T.startBadge(Content.BADGES[{b - 1}])")
            page.wait_for_timeout(50)
            if b == 8:
                page.evaluate("__step()")
                for _ in range(6):
                    page.evaluate("__step()")
                    page.wait_for_timeout(60)
                shot("badge-8-game")
            tries = 0
            while not page.evaluate(f"!!__T.Store.data.badges[{b}]") and tries < 6:
                drive(lambda: on_list() or page.evaluate(f"!!__T.Store.data.badges[{b}]"), name=f"badge-{b}")
                tries += 1
                if on_list() and not page.evaluate(f"!!__T.Store.data.badges[{b}]"):
                    page.evaluate(f"void __T.startBadge(Content.BADGES[{b - 1}])")
            print(f"배지 {b}: {page.evaluate(f'__T.Store.data.badges[{b}]')} (시도 {tries})")
            drive(on_list, name=f"badge-{b}-out")

        # 4) 리그 한 판
        page.evaluate("__T.Store.data.settings.unlockAll = false")
        page.evaluate("__T.renderLeague()")
        shot("league")
        page.click('[data-v="match"]')
        page.wait_for_timeout(50)
        page.evaluate("__step()")
        for _ in range(8):
            page.evaluate("__step()")
            page.wait_for_timeout(80)
        shot("league-game")
        drive(lambda: page.evaluate("!!document.querySelector('.rank-box')"), name="league-game")
        page.wait_for_timeout(300)
        shot("rank-change")
        lg = page.evaluate("__T.Store.data.league")
        print(f"리그: {lg['rank']}위 {lg['wins']}승 {lg['losses']}패 {lg['draws']}무")
        drive(lambda: page.evaluate("document.querySelector('.league') !== null"), name="league-after")
        shot("league-after")

        # 5) 도감 · 어른 화면
        for tab in ["pieces", "trainers", "badges", "moments"]:
            page.evaluate(f"__T.renderDex('{tab}')")
            shot("dex-" + tab)
        page.evaluate("__T.renderParentPage()")
        shot("parent")
        # 진짜 체스 말 모양
        page.evaluate("__T.Store.data.settings.skin = 'chess'")
        page.evaluate("void __T.startPiece('Q', 3)")
        page.wait_for_timeout(100)
        shot("skin-chess")
        # 세로 화면
        page.set_viewport_size({"width": 820, "height": 1180})
        page.evaluate("__T.Store.data.settings.skin = 'poke'")
        page.evaluate("void __T.startBadge(Content.BADGES[7])")
        page.evaluate("__step()")
        page.wait_for_timeout(200)
        shot("portrait")
        br.close()
    httpd.shutdown()
    print(f"\n걸린 시간 {time.time() - t0:.0f}초")
    if errors:
        print("\n오류:")
        for e in errors[:20]:
            print(" ", e)
        sys.exit(1)
    print("화면 시험 통과 (콘솔 오류 없음)")


if __name__ == "__main__":
    main()
