"""게임 목소리를 Microsoft Edge TTS 로 미리 녹음한다. (길찾기·사다리 도구를 고쳐 씀)

    pip install edge-tts
    python tools/gen-voice.py          # 새로 생긴 말만 녹음
    python tools/gen-voice.py --list   # 녹음할 말만 보기
    python tools/gen-voice.py --all    # 전부 다시

녹음하는 말 (node 로 js 파일을 읽어 모은다)
  · js/voice-lines.js 의 L 문장 + 틀(T) 을 모든 말 조합으로 펼친 것
  · data/content.js 의 말 친구 이야기·미니 대결·개념 수업·배지 안내·트레이너 대사
목소리: 피카츄·안내 ko-KR-SunHiNeural · 남자 트레이너 대사 ko-KR-InJoonNeural
결과: assets/voice/<열쇠 md5 10자>.mp3 + assets/voice/voice.js (window.VOICE = { 열쇠: 파일 })
  열쇠 = app.js 의 Voice.key() 와 똑같이 (소문자, 기호·이모지 빼기)
쓰지 않게 된 mp3 는 지운다. 말을 바꾸면 이 스크립트를 다시 돌릴 것.
"""
import asyncio
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import unicodedata

for s in (sys.stdout, sys.stderr):
    try:
        s.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "voice"
KO, MAN = "ko-KR-SunHiNeural", "ko-KR-InJoonNeural"
EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️‍⚡]")


def key(s):
    s = EMOJI.sub("", s).strip()
    s = unicodedata.normalize("NFC", "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c)))
    s = s.lower()
    s = re.sub("[’‘`]", "'", s)
    s = re.sub("[^a-z0-9'가-힣]+", " ", s)
    return s.strip()


def collect():
    js = r"""
    const V = require('./js/voice-lines.js'), Ct = require('./data/content.js');
    const ko = new Set([...Object.values(V.L), ...V.expand()]);
    for (const p of Object.values(Ct.PIECES)) { p.story.forEach(x => ko.add(x)); }
    for (const b of Object.values(Ct.BATTLES)) ko.add(b.say);
    for (const c of Ct.CONCEPTS) { c.intro.forEach(x => ko.add(x.say)); if (c.task.say) ko.add(c.task.say); }
    for (const b of Ct.BADGES) ko.add(b.say);
    const man = new Set();
    const MEN = ['n1', 'n3', 'n4', 'n6', 'volkner', 'raihan', 'steven', 'leon'];
    for (const [id, t] of Object.entries(Ct.TRAINERS)) for (const x of [t.hello, t.bye]) if (x) (MEN.includes(id) ? man : ko).add(x);
    console.log(JSON.stringify({ ko: [...ko], man: [...man] }));
    """
    r = subprocess.run(["node", "-e", js], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        raise SystemExit(r.stderr)
    d = json.loads(r.stdout)
    items = {}
    for t in d["ko"]:
        k = key(t)
        if k:
            items.setdefault(k, (t, KO, "-3%"))
    for t in d["man"]:
        k = key(t)
        if k:
            items[k] = (t, MAN, "-3%")
    return items


async def record(text, voice, rate, dst):
    import edge_tts
    err = None
    for attempt in range(4):
        try:
            await edge_tts.Communicate(EMOJI.sub("", text).strip(), voice, rate=rate).save(str(dst))
            if dst.stat().st_size > 500:
                return True
        except Exception as e:  # 서버가 가끔 끊는다
            err = e
            await asyncio.sleep(1.5 * (attempt + 1))
    print("  ✗", text, str(err)[:80])
    if dst.exists():
        dst.unlink()
    return False


async def main():
    items = collect()
    if "--list" in sys.argv:
        for k, (t, v, _) in sorted(items.items()):
            print(v.split("-")[2][:6], t)
        print(len(items), "개")
        return
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.mp3"):
        if f.stat().st_size < 500:
            f.unlink()
    index, todo = {}, []
    for k, (t, v, rate) in items.items():
        f = hashlib.md5((k + "|" + v).encode("utf-8")).hexdigest()[:10] + ".mp3"
        index[k] = f
        if "--all" in sys.argv or not (OUT / f).exists():
            todo.append((t, v, rate, OUT / f))
    print(f"말 {len(items)}개 · 새로 녹음 {len(todo)}개")
    sem = asyncio.Semaphore(6)

    async def one(args):
        async with sem:
            return await record(*args)

    done = await asyncio.gather(*(one(a) for a in todo))
    print(f"녹음 {sum(done)}/{len(todo)}")
    keep = set(index.values())
    for f in OUT.glob("*.mp3"):
        if f.name not in keep:
            f.unlink()
    index = {k: f for k, f in index.items() if (OUT / f).exists()}
    (OUT / "voice.js").write_text("window.VOICE = " + json.dumps(index, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + ";\n", encoding="utf-8")
    size = sum(f.stat().st_size for f in OUT.glob("*.mp3"))
    print(f"assets/voice: {len(index)}개 · {size / 1e6:.1f}MB")


if __name__ == "__main__":
    asyncio.run(main())
