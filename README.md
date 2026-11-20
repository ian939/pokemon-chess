# 포켓몬 체스 챔피언십

6살이 **진짜 체스**를 배우는 아이패드 웹게임. 포켓몬은 흥미를 붙이는 옷이고 규칙은 FIDE 체스 그대로다.
기획·근거는 [plan.md](plan.md) (§0 이 구현 확정본).

- 주소: https://ian939.github.io/pokemon-chess/
- 흐름: 🏫 포켓몬 스쿨(말 6개 × 6단계 → 개념 수업 12개) → 🏅 배지 8개 → 🏆 월드 챔피언십(노멀 → 슈퍼 → 하이퍼 → 마스터즈 에이트 토너먼트 → 👑 챔피언, 클래스마다 기술 수업 먼저)
- 피카츄 멘토: 상대 수의 뜻 · 지금 중요한 것 · 위험한 칸(빨간 테두리) · 큰 실수 미리 보기 · 둔 뒤 칭찬, 💡 힌트 3단계, 판 끝 돌아보기

## 구조 (바닐라 JS, 빌드 없음)

| 파일 | 하는 일 | 시험 |
|---|---|---|
| `js/rules.js` | 체스 규칙 엔진 (킹 없는 판도 받음) | `node tools/test-rules.js` (perft 표준값) |
| `js/game.js` | 한 판 진행 + 미니게임 승리 조건 (mate·promote·captureAll·points·mateIn·stars) | |
| `js/engine.js` · `js/bot-worker.js` | 평가·탐색·봇 1~8 (봇 4~ 는 Web Worker, 시간 제한) | `node tools/sim-bots.js`, `sim-minis.js`, `sim-strong.js`, `sim-endgame.js` |
| `js/analyze.js` · `js/mentor.js` | 멘토용 판 읽기 · 무슨 말을 할지 | `node tools/test-mentor.js` |
| `js/school.js` | 스쿨 미션 무작위 생성 + BFS 풀이 | `node tools/check-school.js` |
| `js/puzzle.js` · `data/puzzles.js` | 개념 수업 퍼즐 판정 · 퍼즐 데이터(자동 생성) | `node tools/check-puzzles.js` |
| `js/ranking.js` | 살아 있는 순위표 (날짜 씨앗) | |
| `js/voice-lines.js` · `data/content.js` | 모든 말 · 스쿨/수업/배지/트레이너 데이터 | |
| `js/board.js` · `js/app.js` | 판 화면 · 전체 화면 | `python tools/test-ui.py [--shots]` |

- 퍼즐 다시 만들기: `node tools/gen-puzzles.js` (씨앗 고정 — 퍼즐 id 에 아이 기록이 붙으니 함부로 바꾸지 말 것)
- 말을 바꾸면 `python tools/gen-voice.py` (Edge TTS, 새 말만 녹음)
- 배포: `index.html` 의 `APP_VERSION` 과 모든 `?v=` 를 같이 올려 push (패드 캐시 때문)

## 패드

확대·복사 잠금(`js/lock.js` + `css/lock.css` + viewport), 누르는 것 44px 이상, 버전 표시 + 새 버전 자동 감지,
음성은 `<audio>` 요소(효과음만 Web Audio), 마이크 안 씀. 기록은 localStorage(`pokechess.v1`).

그림: 포켓몬 PokeAPI 도트, 트레이너 Pokémon Showdown 도트. 글꼴 갈무리11(OFL).
