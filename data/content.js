/* content.js — 스쿨·개념 수업·배지·트레이너·순위표 데이터 (plan §3~§8)
 * 말(narration)은 전부 목소리로 녹음된다 → 바꾸면 python tools/gen-voice.py
 */
(function (root) {
  "use strict";

  // ---------- 내 말 (plan §3.1) ----------
  const PIECES = {
    R: { name: "망나뇽", dex: 149, chess: "룩", glyph: "♜", value: 5,
      story: ["망나뇽은 하늘을 곧게 나는 친구야.", "앞으로, 뒤로, 옆으로 쭉 날아가. 하지만 비스듬히는 못 가!", "체스에서는 이 친구를 룩이라고 불러."],
      tip: "망나뇽은 앞뒤 옆으로 쭉 날아가!" },
    B: { name: "팬텀", dex: 94, chess: "비숍", glyph: "♝", value: 3,
      story: ["팬텀은 그림자를 타고 다니는 친구야.", "비스듬히만 쭉 미끄러져. 그래서 평생 같은 색 칸에서만 살아!", "체스에서는 이 친구를 비숍이라고 불러."],
      tip: "팬텀은 비스듬히 가. 같은 색 칸에서만 다녀!" },
    Q: { name: "루카리오", dex: 448, chess: "퀸", glyph: "♛", value: 9,
      story: ["루카리오는 우리 팀에서 제일 센 에이스야.", "망나뇽처럼 곧게, 팬텀처럼 비스듬히, 어디로든 쭉 갈 수 있어!", "체스에서는 이 친구를 퀸이라고 불러."],
      tip: "루카리오는 어느 쪽으로든 쭉 가!" },
    K: { name: "피카츄", dex: 25, chess: "킹", glyph: "♚", value: 0,
      story: ["피카츄는 우리 팀의 대장이야.", "한 칸씩만 걸을 수 있어. 그리고 위험한 칸에는 절대 못 들어가!", "체스에서는 이 친구를 킹이라고 불러. 꼭 지켜야 해!"],
      tip: "피카츄는 한 칸씩만 걸어!" },
    N: { name: "창파나이트", dex: 865, chess: "나이트", glyph: "♞", value: 3,
      story: ["창파나이트는 용감한 기사야.", "ㄱ자 모양으로 뛰어. 두 칸 가고 옆으로 한 칸!", "다른 친구를 뛰어넘을 수 있는 건 이 친구뿐이야. 체스에서는 나이트라고 불러."],
      tip: "창파나이트는 ㄱ자로 뛰어. 다른 친구를 뛰어넘을 수 있어!" },
    P: { name: "리오르", dex: 447, chess: "폰", glyph: "♟", value: 1,
      story: ["리오르는 작지만 용감한 친구야.", "앞으로 한 칸씩만 가. 처음 걸을 때만 두 칸도 갈 수 있어! 뒤로는 못 가.", "잡을 때는 비스듬히 앞으로 잡아. 끝줄에 닿으면 루카리오로 진화해! 체스에서는 폰이라고 불러."],
      tip: "리오르는 앞으로만 가. 잡을 때만 비스듬히!" },
  };
  const ORDER = ["R", "B", "Q", "K", "N", "P"]; // 쉬운 말부터 (plan §1.2)

  /** 말 하나를 배우는 단계 (plan §4.1). n = 판 수 */
  function stagesFor(p) {
    const twice = p === "N" || p === "P";
    const list = [
      { kind: "meet", title: "만나기" },
      { kind: "stars", title: "별 줍기", n: twice ? 4 : 3 },
      // 폰은 ③ 을 '앞이 막혔어'로 바꾼다: 앞이 막히면 못 가고, 잡을 때만 비스듬히 (사용자 확정 2026-11-14)
      p === "P" ? { kind: "pawnBlock", title: "앞이 막혔어", n: 4 } : { kind: "starsDark", title: "빛 끄고 별 줍기", n: twice ? 4 : 3 },
      { kind: "capture", title: "잡기", n: 3 },
      { kind: "safe", title: "안전한 칸", n: 3 },
      { kind: "battle", title: "미니 대결" },
    ];
    return list;
  }
  // ⑥ 미니 대결 (plan §4.2)
  const BATTLES = {
    R: { title: "망나뇽의 사냥", say: "리오르 넷이 끝줄까지 가기 전에 망나뇽으로 모두 잡아 보자!", fen: "8/p1p1p1p1/8/8/8/8/8/3R4 w - - 0 1", goal: { type: "captureAll", hunter: "w" }, bot: 2 },
    B: { title: "팬텀의 그림자 사냥", say: "리오르 셋이 끝줄까지 가기 전에 팬텀으로 모두 잡아 보자!", fen: "8/1p1p1p2/8/8/8/8/8/2B5 w - - 0 1", goal: { type: "captureAll", hunter: "w" }, bot: 2 },
    Q: { title: "루카리오의 대활약", say: "리오르 여섯이 끝줄까지 가기 전에 루카리오로 모두 잡아 보자!", fen: "8/pp1pp1pp/8/8/8/8/8/3Q4 w - - 0 1", goal: { type: "captureAll", hunter: "w" }, bot: 2 },
    K: { title: "피카츄의 모험", say: "위험한 칸을 피해서 맨 위 줄까지 가 보자!", mission: "cross" },
    N: { title: "창파나이트 별 경주", say: "상대 창파나이트와 번갈아 뛰면서 별을 더 많이 주워 보자!", fen: "6n1/8/8/8/8/8/8/1N6 w - - 0 1", goal: { type: "stars", stars: ["c3", "e4", "d5", "f6", "b5", "g4", "d3"] }, bot: "raceEasy" },
    P: { title: "리오르 전쟁", say: "리오르끼리 경주야! 먼저 끝줄에 닿아서 진화하면 이겨!", fen: "8/pppppppp/8/8/8/8/PPPPPPPP/8 w - - 0 1", goal: { type: "promote" }, bot: 2 },
  };

  // ---------- 개념 수업 (plan §4.3, 스텝 메서드 순서) ----------
  const CONCEPTS = [
    { id: "C1", title: "판 차리기", icon: "🏁",
      intro: [
        { say: "체스판은 밝은 칸과 어두운 칸이 번갈아 있어. 오른쪽 아래 칸은 언제나 밝은 칸이야.", fen: "8/8/8/8/8/8/8/8 w - - 0 1", ring: ["h1"] },
        { say: "망나뇽은 구석, 그 옆에 창파나이트, 그 옆에 팬텀이 서.", fen: "8/8/8/8/8/8/8/RNB2BNR w - - 0 1" },
        { say: "루카리오는 자기 색 칸에 서고, 피카츄는 그 옆에 서. 리오르들은 앞줄에 쭉!", fen: "8/8/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1", ring: ["d1"] },
      ],
      task: { type: "setup" } },
    { id: "C2", title: "노리기", icon: "🎯",
      intro: [{ say: "내 친구가 갈 수 있는 칸에 상대가 있으면, 그 상대를 잡을 수 있어. 이걸 노린다고 해." }],
      task: { type: "tap", pool: "C2", n: 5, say: "빛나는 친구가 잡을 수 있는 상대를 모두 눌러 봐!" } },
    { id: "C3", title: "공짜로 잡기", icon: "🎁",
      intro: [{ say: "지켜 주는 친구가 없는 상대는 잡아도 다시 잡히지 않아. 공짜로 잡는 거야!" }, { say: "하지만 지켜 주는 친구가 있으면, 잡고 나서 내 친구가 잡힐 수 있어. 조심!" }],
      task: { type: "move", pool: "C3", n: 5, say: "공짜로 잡을 수 있는 상대를 찾아서 잡아 봐!" } },
    { id: "C4", title: "에너지 점수", icon: "⚡",
      intro: [{ say: "친구마다 에너지 점수가 있어. 리오르는 1, 창파나이트와 팬텀은 3, 망나뇽은 5, 루카리오는 9야." }, { say: "작은 점수를 주고 큰 점수를 얻으면 이득이야!" }],
      task: { type: "trade", pool: "C4", n: 5, say: "화살표처럼 잡으면, 상대 리오르가 다시 잡아. 이득일까?" } },
    { id: "C5", title: "지키기", icon: "🛡️",
      intro: [{ say: "내 친구가 노려지면 구하는 방법이 네 가지 있어." }, { say: "도망가기, 가로막기, 다른 친구가 지켜 주기, 그리고 노리는 상대를 먼저 잡기!" }],
      task: { type: "move", pool: "C5", n: 5, say: "노려지고 있는 우리 친구를 구해 줘!" } },
    { id: "C6", title: "체크", icon: "⚠️",
      intro: [{ say: "상대 대장을 노리는 걸 체크라고 해." }, { say: "체크를 당하면 다음 수에 꼭 대장을 구해야 해." }],
      task: { type: "move", pool: "C6", n: 5, say: "상대 대장에게 체크를 걸어 봐!" } },
    { id: "C7", title: "체크 벗어나기", icon: "🏃",
      intro: [{ say: "피카츄가 체크를 당하면 세 가지 방법이 있어." }, { say: "도망가기, 가로막기, 체크하는 말을 잡기!" }],
      task: { type: "move", pool: "C7", n: 5, say: "피카츄가 체크야! 구해 줘!" } },
    { id: "C8", title: "체크메이트 (1)", icon: "👑",
      intro: [{ say: "체크인데 도망도, 막기도, 잡기도 안 되면 체크메이트야." }, { say: "체크메이트를 하면 게임에서 이겨!" }],
      task: { type: "move", pool: "C8", n: 5, say: "한 번에 체크메이트하는 수를 찾아 봐!" } },
    { id: "C9", title: "체크메이트 (2)", icon: "🪜",
      intro: [{ say: "망나뇽 둘이면 사다리처럼 한 줄씩 밀어서 체크메이트할 수 있어." }, { say: "루카리오는 피카츄와 같이 상대 대장을 구석으로 몰아!" }],
      task: { type: "move", pool: "C9", n: 6, say: "체크메이트하는 수를 찾아 봐!" } },
    { id: "C10", title: "캐슬링", icon: "🏰",
      intro: [
        { say: "캐슬링은 피카츄가 망나뇽 뒤로 숨는 특별한 수야. 피카츄가 두 칸 가고, 망나뇽이 넘어와.", fen: "4k3/8/8/8/8/8/PPPPPPPP/R3K2R w KQ - 0 1", arrows: [["e1", "g1"], ["h1", "f1"]] },
        { say: "하지만 안 될 때가 있어. 사이에 친구가 있을 때, 체크일 때, 지나가는 칸이 노려질 때, 이미 움직였을 때!" },
      ],
      task: { type: "castle", pool: "C10", n: 5 } },
    { id: "C11", title: "비김 (스테일메이트)", icon: "🤝",
      intro: [{ say: "상대 대장이 갈 곳이 없는데 체크가 아니면, 스테일메이트라서 비겨." }, { say: "이기고 있을 때는 상대가 움직일 칸을 남겨 줘야 해!" }],
      task: { type: "classify", pool: "C11", n: 5, say: "이 판은 어떤 상태일까?" } },
    { id: "C12", title: "첫 걸음 세 약속", icon: "🌟",
      intro: [{ say: "게임을 시작할 때 세 가지 약속이 있어." }, { say: "가운데를 차지하기, 친구들 꺼내기, 캐슬링으로 피카츄 숨기기!" }],
      task: { type: "opening" } },
  ];

  // ---------- 배지 (plan §5) ----------
  const BADGES = [
    { id: 1, title: "리오르 전쟁", icon: "🥊", need: "P", say: "리오르끼리 경주! 먼저 진화하면 이겨!", fen: "8/pppppppp/8/8/8/8/PPPPPPPP/8 w - - 0 1", goal: { type: "promote" }, bot: 2 },
    { id: 2, title: "망나뇽 사냥", icon: "🐉", need: "C2", say: "망나뇽 둘로 리오르 다섯을 모두 잡아! 끝줄에 닿게 하면 안 돼.", fen: "8/1pp1pp1p/8/8/8/8/8/R6R w - - 0 1", goal: { type: "captureAll", hunter: "w" }, bot: 2 },
    { id: 3, title: "나이트 달리기", icon: "⭐", need: "C3", say: "창파나이트 둘이서 별을 더 많이 주워 봐!", fen: "1n4n1/8/8/8/8/8/8/1N4N1 w - - 0 1", goal: { type: "stars", stars: ["c3", "f3", "d4", "e5", "c6", "f6", "b4", "g5", "d6"] }, bot: "race" },
    { id: 4, title: "말 사냥 대회", icon: "⚡", need: "C4", say: "열다섯 번씩 두고 나서 ⚡ 점수가 많은 쪽이 이겨! 공짜 말을 노려 봐.", fen: "rnbq1bnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQ1BNR w - - 0 1", goal: { type: "points", plies: 30 }, bot: 3 },
    { id: 5, title: "피카츄와 리오르", icon: "⚡", need: "C7", say: "피카츄도 같이 싸워! 먼저 리오르를 진화시키면 이겨.", fen: "4k3/1pppp3/8/8/8/8/1PPPP3/4K3 w - - 0 1", goal: { type: "promote" }, bot: 3 },
    { id: 6, title: "메이트 연습장", icon: "🪜", need: "C9", say: "망나뇽 둘로 스무 번 안에 체크메이트해 봐!", fen: "4k3/8/8/8/8/8/8/R3K2R w - - 0 1", goal: { type: "mateIn", plies: 40 }, bot: 5 },
    { id: 7, title: "반쪽 체스", icon: "🏰", need: "C10", say: "루카리오, 팬텀, 창파나이트 없이 두는 체스야. 체크메이트하면 이겨!", fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1", goal: { type: "mate" }, bot: 2 },
    { id: 8, title: "첫 진짜 체스", icon: "🏆", need: "C12", say: "이제 진짜 체스야! 피카츄가 옆에서 도와줄게.", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", goal: { type: "mate" }, bot: 1 },
  ];
  const BADGE_ICON = ["", "🔴", "🔵", "🟡", "🟢", "🟣", "🟠", "⚪", "🌈"];

  // ---------- 월드 챔피언십 (plan §7) ----------
  const CLASSES = [
    { id: "normal", name: "노멀 클래스", ball: "⚪", top: 1000, open: true },
    { id: "super", name: "슈퍼 클래스", ball: "🔵", top: 100, open: false },
    { id: "hyper", name: "하이퍼 클래스", ball: "🟡", top: 9, open: false },
    { id: "master", name: "마스터 클래스", ball: "🟣", top: 1, open: false },
  ];
  const START_RANK = 3200;
  const NORMAL_STEPS = [2700, 2300, 1800, 1450, 1150]; // 노멀에서 이길 때마다 순위 (5승, 3번째 = 라이벌전이라 크게)
  const PROMO_RANK = 999;

  const TRAINERS = {
    n1: { name: "반바지 꼬마 민수", sprite: "youngster", ace: 19, aceName: "꼬렛", bot: 1, hello: "처음이라 떨려! 잘 부탁해!", bye: "좋은 승부였어! 다음엔 이길 거야!" },
    n2: { name: "짧은치마 하나", sprite: "lass", ace: 39, aceName: "푸린", bot: 1, hello: "푸린이랑 같이 열심히 할게!", bye: "와, 너 정말 잘한다!" },
    n3: { name: "곤충채집 소년 준호", sprite: "bugcatcher", ace: 10, aceName: "캐터피", bot: 2, hello: "잡을 수 있으면 다 잡아 버릴 거야!", bye: "으악, 내가 졌어!" },
    n4: { name: "캠핑보이 태호", sprite: "camper", ace: 16, aceName: "구구", bot: 2, hello: "캠핑장에서 연습 많이 했다고!", bye: "좋은 승부였어. 더 연습할게!" },
    n5: { name: "피크닉걸 소라", sprite: "picnicker", ace: 52, aceName: "나옹", bot: 2, hello: "나옹이 반짝반짝 응원해 줄 거야!", bye: "너한테 많이 배웠어!" },
    n6: { name: "수영선수 바다", sprite: "swimmer", ace: 129, aceName: "잉어킹", bot: 2, hello: "잉어킹을 얕보면 안 돼!", bye: "잉어킹도 언젠가 갸라도스가 될 거야!" },
    korrina: { name: "코르니", sprite: "korrina", ace: 701, aceName: "루차불", bot: 3, promo: true, hello: "승급전이야! 공짜 말은 절대 안 놓쳐!", bye: "대단해! 슈퍼 클래스에서 만나자!" },
    bea: { name: "채두", sprite: "bea", ace: 68, aceName: "괴력몬", bot: 2, rival: true, hello: "너도 챔피언을 노리는구나. 라이벌 승부다! 지지 않아!", bye: "…좋은 승부였다. 다음엔 내가 이긴다.", win: "후후, 이번엔 내가 이겼다. 다시 도전해!" },
    volkner: { name: "전진", sprite: "volkner", ace: 466, aceName: "에레키블", bot: 4, promo: true },
    marnie: { name: "마리", sprite: "marnie", ace: 861, aceName: "오롱털", bot: 4 },
    iris: { name: "아이리스", sprite: "iris", ace: 612, aceName: "액스라이즈", bot: 5 },
    raihan: { name: "금랑", sprite: "raihan", ace: 884, aceName: "두랄루돈", bot: 6, promo: true },
    steven: { name: "성호", sprite: "steven", ace: 376, aceName: "메타그로스", bot: 6 },
    cynthia: { name: "난천", sprite: "cynthia", ace: 445, aceName: "한카리아스", bot: 7 },
    leon: { name: "단델", sprite: "leon", ace: 6, aceName: "리자몽", bot: 8 },
    lance: { name: "목호", sprite: "lance", ace: 130, aceName: "갸라도스" },
    diantha: { name: "카르네", sprite: "diantha", ace: 282, aceName: "가디안" },
    alain: { name: "알랭", sprite: "alain", ace: 248, aceName: "마기라스" },
  };
  // 노멀 클래스 상대 순서: 이긴 수만큼 다음 상대, 4승 뒤 승급전
  const NORMAL_LINE = ["n1", "n2", "bea", "n3", "n4"]; // 가운데 = 라이벌 채두와의 라이벌전 (사용자 요청 2026-11-15)
  const NORMAL_PROMO = "korrina";
  const NORMAL_EXTRA = ["n5", "n6"]; // 어른 모드 '상대 고르기'에만 나오는 연습 상대
  const MASTERS = ["leon", "cynthia", "lance", "diantha", "steven", "alain", "iris", "raihan"]; // 1~8위

  // 순위표에 나오는 이름 없는 트레이너들 (날마다 조금씩 오르내린다)
  const ROSTER_CLASSES = [
    ["반바지 꼬마", "youngster"], ["짧은치마", "lass"], ["곤충채집 소년", "bugcatcher"], ["캠핑보이", "camper"], ["피크닉걸", "picnicker"],
    ["수영선수", "swimmer"], ["등산가", "hiker"], ["포켓몬 마니아", "pokefan"], ["포켓몬 애호가", "pokefanf"], ["엘리트 트레이너", "acetrainer"],
    ["엘리트 트레이너", "acetrainerf"], ["학생", "schoolkid"], ["아가씨", "beauty"],
  ];
  const ROSTER_NAMES = ["민준", "서연", "도윤", "하은", "시우", "지유", "주원", "서아", "하준", "아린", "지호", "윤서", "은우", "채원", "선우", "다인",
    "유준", "수아", "건우", "예린", "우진", "소율", "현우", "나은", "준서", "하린", "로운", "지아", "태윤", "가온", "이안", "봄", "한결", "새봄", "누리", "보라"];

  const Content = { PIECES, ORDER, stagesFor, BATTLES, CONCEPTS, BADGES, BADGE_ICON, CLASSES, START_RANK, NORMAL_STEPS, PROMO_RANK, TRAINERS, NORMAL_LINE, NORMAL_PROMO, NORMAL_EXTRA, MASTERS, ROSTER_CLASSES, ROSTER_NAMES };
  root.Content = Content;
  if (typeof module !== "undefined") module.exports = Content;
})(typeof window !== "undefined" ? window : globalThis);
