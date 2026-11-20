/* voice-lines.js — 피카츄 멘토와 안내의 모든 한국어 말
 * 여기 있는 말은 tools/gen-voice.py 가 Edge TTS 로 미리 녹음한다 (말을 바꾸면 다시 돌릴 것).
 * 한 번에 두 문장 이내. 말과 화면 글은 똑같이 쓴다.
 */
(function (root) {
  "use strict";
  // 받침이 있으면 a, 없으면 b
  function josa(w, a, b) {
    const c = w.charCodeAt(w.length - 1);
    if (c < 0xac00 || c > 0xd7a3) return w + b;
    const jong = (c - 0xac00) % 28;
    if (a === "으로") return w + (jong && jong !== 8 ? "으로" : "로");
    return w + (jong ? a : b);
  }
  const I = (w) => josa(w, "이", "가");
  const UL = (w) => josa(w, "을", "를");
  const RO = (w) => josa(w, "으로", "로");
  const EUN = (w) => josa(w, "은", "는");

  // 체스 말 ↔ 포켓몬 (plan §3.1)
  const NAMES = { K: "피카츄", Q: "루카리오", R: "망나뇽", B: "팬텀", N: "창파나이트", P: "리오르" };
  const CHESS = { K: "킹", Q: "퀸", R: "룩", B: "비숍", N: "나이트", P: "폰" };
  /** 말 글자 → 부르는 이름. 우리 편은 그냥 이름, 상대는 "상대 ○○", 상대 킹은 "상대 대장" */
  function who(p) {
    const T = p.toUpperCase();
    if (p === T) return NAMES[T];
    return T === "K" ? "상대 대장" : "상대 " + NAMES[T];
  }
  const OURS = ["Q", "R", "B", "N", "P"]; // 잡힐 수 있는 우리 말
  const THEIRS = ["q", "r", "b", "n", "p", "k"];

  // 빈칸 있는 말 (틀). 녹음은 가능한 조합을 전부 미리 만든다
  const T = {
    threat: (att, tgt) => `앗, ${I(who(att))} 우리 ${UL(who(tgt))} 노리고 있어!`,
    canTake: (tgt) => `${UL(who(tgt))} 잡을 수 있어!`,
    took: (tgt) => `잘했어! ${UL(who(tgt))} 잡았어!`,
    lost: (tgt) => `앗, 우리 ${I(who(tgt))} 잡혔어.`,
    next: (tgt) => `좋아! 다음에 ${UL(who(tgt))} 잡을 수 있겠어.`,
    warn: (att, tgt) => `거기 두면 ${I(who(att))} 우리 ${UL(who(tgt))} 잡아 버려.`,
    checkBy: (att) => `체크! ${I(who(att))} 피카츄를 노리고 있어.`,
    moveIt: (p) => `${UL(who(p))} 움직여 볼까?`,
    safeNow: (p) => `그러면 우리 ${I(who(p))} 안전해져.`,
    saveIt: (p) => `우리 ${UL(who(p))} 구해 주자!`,
  };
  function expand() {
    const out = [];
    for (const a of THEIRS) for (const t of OURS) { out.push(T.threat(a, t)); out.push(T.warn(a, t)); }
    for (const t of THEIRS) if (t !== "k") { out.push(T.canTake(t)); out.push(T.took(t)); out.push(T.next(t)); out.push(T.checkBy(t)); }
    for (const t of OURS) { out.push(T.lost(t)); out.push(T.safeNow(t)); out.push(T.saveIt(t)); }
    for (const p of ["K", ...OURS]) out.push(T.moveIt(p));
    return out;
  }

  const L = {
    // 멘토 — 내 차례
    mate1: "체크메이트할 수 있는 수가 있어! 찾아볼래?",
    checkHow: "도망가기, 막기, 잡기 중에 골라 보자.",
    threatMate: "조심! 상대가 다음에 체크메이트를 노리고 있어.",
    noGuard: "지켜 주는 친구가 없어.",
    goodTrade: "주는 것보다 얻는 게 더 많아.",
    hurtTrade: "잡히면 손해야. 도망가거나 친구가 지켜 주자!",
    protect: "도망가거나 친구가 지켜 주자!",
    promoMine: "리오르가 끝줄에 닿으면 루카리오로 진화해!",
    promoTheirs: "상대 리오르가 진화하려고 해! 막아야 해.",
    open1: "가운데 칸을 차지하자.",
    open2: "아직 집에 있는 친구를 꺼내자.",
    open3: "캐슬링으로 피카츄를 안전하게 숨기자.",
    endgame: "이제 상대 대장을 구석으로 몰아서 체크메이트하자!",
    mateGuide: "파란 동그라미는 상대 대장이 도망갈 칸이야. 그 칸을 줄여 보자!",
    mateGuideArrow: "초록 화살표처럼 몰아 보자!",
    mateKingHelp: "피카츄도 같이 가야 해! 대장끼리 가까이 가면 체크메이트하기 쉬워.",
    epChance1: "상대 리오르가 두 칸 뛰어서 바로 옆에 왔어!",
    epChance2: "지금만 비스듬히 잡을 수 있어. 앙파상이라고 해.",
    epMine: "앙파상 성공! 옆으로 지나간 리오르를 잡았어!",
    epTheirs: "앗, 상대가 앙파상으로 우리 리오르를 잡았어! 두 칸 뛰어서 옆에 서면 이렇게 잡힐 수 있어.",
    warnStalemate: "잠깐! 그러면 상대 대장이 갈 곳이 없는데 체크가 아니라서 비겨 버려.",
    warnRepeat: "잠깐! 같은 자리를 세 번 만들면 비겨 버려. 다른 수를 찾아보자.",
    cheer1: "잘하고 있어!",
    cheer2: "천천히 생각해 봐.",
    cheer3: "어떤 친구를 움직일까?",
    cheer4: "좋은 수를 찾아보자!",
    // 멘토 — 내가 둔 뒤
    gaveCheck: "체크! 상대 대장이 도망가야 해.",
    castled: "캐슬링 성공! 피카츄가 안전해졌어.",
    developed: "좋아, 친구를 꺼냈어!",
    center: "좋아, 가운데를 차지했어!",
    evolved: "리오르가 루카리오로 진화했어!",
    theirEvolved: "상대 리오르가 진화했어!",
    // 큰 실수 미리 보기
    warnMate: "거기 두면 체크메이트를 당해!",
    warnAsk: "그래도 둘래?",
    // 힌트
    hint2: "여기로 가 보자!",
    hintMate: "이 수면 체크메이트야!",
    hintCheck: "체크를 걸 수 있어.",
    hintGood: "좋은 자리로 가는 수야.",
    noHint: "힌트를 다 썼어. 스스로 생각해 보자!",
    // 규칙에 어긋난 수
    illegal: "거기는 못 가.",
    stillCheck: "아직 체크야! 피카츄를 먼저 구해야 해.",
    kingDanger: "피카츄는 위험한 칸에 못 가!",
    pinned: "그 친구가 움직이면 피카츄가 노려져서 못 움직여.",
    notYours: "그건 상대 친구야. 우리 친구를 눌러 봐.",
    sleeping: "쿨쿨… 이 친구는 지금 자고 있어.",
    // 판 결과
    win: "체크메이트! 이겼어!",
    lose: "아쉽다… 다시 해 보자!",
    draw: "비겼어! 좋은 승부였어.",
    stalemate: "스테일메이트! 갈 곳이 없는데 체크가 아니라서 비겼어.",
    winRace: "이겼어! 대단해!",
    loseRace: "아쉽다! 한 번 더 해 볼까?",
    promoWin: "진화 성공! 이겼어!",
    promoLose: "상대가 먼저 진화했어. 다시 해 보자!",
    huntWin: "다 잡았어! 이겼어!",
    huntLose: "상대 리오르가 끝까지 가 버렸어. 다시 해 보자!",
    pointsWin: "⚡ 점수가 더 많아! 이겼어!",
    pointsLose: "⚡ 점수가 모자랐어. 다시 해 보자!",
    mateInFail: "시간이 다 됐어. 사다리처럼 한 줄씩 밀어 보자!",
    starsWin: "별을 더 많이 주웠어! 이겼어!",
    starsLose: "상대가 별을 더 많이 주웠어. 다시 해 보자!",
    // 스쿨
    starsGo: "별을 모두 주워 보자!",
    starsDarkGo: "이번엔 길 표시가 없어. 적은 걸음으로 별을 주워 봐!",
    captureGo: "상대 친구들을 모두 잡아 보자!",
    frozenTip: "잠자는 우리 친구는 넘어갈 수 없어.",
    safeGo: "빨간 칸은 상대가 노리는 칸이야. 거기 가면 잡혀!",
    safeDarkGo: "이번엔 빨간 칸이 안 보여. 잡히지 않게 별을 주워!",
    kingSafeGo: "피카츄는 위험한 칸에 들어갈 수 없어. 별을 주워 보자!",
    crossGo: "위험한 칸을 피해서 맨 위 줄까지 가 보자!",
    pawnBlockGo: "앞이 막히면 리오르는 못 가! 비스듬히 상대를 잡아서 별이 있는 줄로 가 보자.",
    pawnCaptureGo: "앞이 막혔어! 옆에 있는 리오르가 비스듬히 잡아 줄 수 있어.",
    pawnBlocked: "앞에 누가 있으면 리오르는 못 가. 잡을 때만 비스듬히 가!",
    pawnDiagEmpty: "리오르는 잡을 때만 비스듬히 갈 수 있어.",
    caught: "앗, 잡혔어! 다시 해 보자.",
    allStars: "다 주웠어! 대단해!",
    allCaptured: "다 잡았어! 대단해!",
    crossed: "도착! 피카츄가 무사히 건넜어!",
    star3: "가장 짧은 길이야! 별 세 개!",
    star2: "잘했어! 조금 더 짧은 길도 있어.",
    star1: "해냈어! 다음엔 더 짧은 길을 찾아보자.",
    stageDone: "이번 단계 끝! 다음으로 가자!",
    pieceDone: "와, 이 친구를 다 배웠어! 도감에 등록됐어!",
    battleGo: "이제 진짜 대결이야! 이겨 보자!",
    // 개념 수업
    right: "맞았어!",
    wrong: "다시 생각해 보자.",
    tapMore: "아직 더 있어!",
    tapWrong: "그 친구는 못 잡아.",
    tapDone: "전부 찾았어!",
    notCapture: "잡는 수를 찾아보자.",
    badTrade: "그 친구를 잡으면 다시 잡혀서 손해야.",
    stillHanging: "아직 위험해. 다른 방법을 찾아보자.",
    noCheck: "그건 체크가 아니야.",
    onlyCheck: "체크는 맞는데, 상대 대장이 도망갈 수 있어.",
    noMate: "체크메이트가 아니야. 다시 찾아보자.",
    howRun: "도망가기로 구했어!",
    howCapture: "먼저 잡아서 구했어!",
    howBlock: "가로막아서 구했어!",
    howGuard: "친구가 지켜 줘서 구했어!",
    escRun: "피카츄가 도망갔어!",
    escCapture: "체크하는 말을 잡았어!",
    escBlock: "가로막아서 피카츄를 지켰어!",
    castleShortQ: "짧은 쪽 캐슬링, 할 수 있을까?",
    castleLongQ: "긴 쪽 캐슬링, 할 수 있을까?",
    castleOk: "할 수 있어! 피카츄를 두 칸 옮겨 봐.",
    castleBetween: "사이에 친구가 있어서 못 해.",
    castleCheck: "체크일 때는 캐슬링을 못 해.",
    castleThrough: "피카츄가 지나가는 칸이 노려져서 못 해.",
    castleMoved: "피카츄나 망나뇽이 이미 움직여서 못 해.",
    castleDone: "캐슬링 성공!",
    clsMate: "맞아, 체크메이트야! 체크인데 갈 곳이 없어.",
    clsStalemate: "스테일메이트야! 체크가 아닌데 갈 곳이 없어.",
    clsPlay: "아직 둘 수 있어! 상대 대장이 갈 칸이 남아 있어.",
    tradeGain: "작은 점수를 주고 큰 점수를 얻으니까 이득이야!",
    tradeLoss: "큰 점수를 주고 작은 점수를 얻으니까 손해야!",
    tradeEven: "같은 점수끼리 바꾸니까 똑같아!",
    goalCenter: "가운데 약속 성공!",
    goalDevelop: "친구 꺼내기 약속 성공!",
    goalCastle: "캐슬링 약속 성공!",
    goalAll: "세 약속을 모두 지켰어! 정말 멋져!",
    lockedPiece: "앞의 친구를 먼저 배우자!",
    lockedLesson: "앞의 수업을 먼저 끝내자!",
    lockedBadge: "먼저 수업을 끝내야 열려!",
    lockedLeague: "배지를 여덟 개 모으면 열려!",
    // 기술 수업 · 기술 기회
    tFork: "더블 어택 성공! 두 친구를 한꺼번에 노렸어!",
    tPin: "묶었어! 이제 그 친구는 마음대로 못 움직여!",
    tSkewer: "꿰뚫기 성공! 뒤에 있는 친구를 잡을 수 있어!",
    tBackrank: "뒷줄 체크메이트 성공!",
    t2First: "좋아! 이제 상대가 어떻게 하는지 보자.",
    t2Now: "이제 체크메이트할 차례야!",
    t2Mate: "두 수 메이트 성공!",
    notBest: "음, 더 크게 이득 보는 수가 있어. 다시 찾아보자.",
    tacticFork: "더블 어택 기회가 있어! 한 번에 둘을 노려 봐.",
    tacticPin: "그림자 묶기 기회가 있어! 상대를 묶어 봐.",
    tacticSkewer: "꿰뚫기 기회가 있어! 뒤에 숨은 친구를 노려 봐.",
    // 클래스 · 토너먼트
    techGate: "새 클래스에서는 먼저 새 기술을 배워야 해!",
    welcomeSuper: "슈퍼 클래스에 온 걸 환영해! 이제 피카츄는 위험할 때만 도와줄게.",
    welcomeHyper: "하이퍼 클래스야! 이제 피카츄는 물어볼 때만 도와줄게. 힌트 버튼을 눌러!",
    welcomeMaster: "마스터즈 에이트에 들어왔어! 이제부터는 혼자 힘으로 해 보자. 피카츄가 옆에서 응원할게!",
    promoHyper: "승급! 하이퍼 클래스로 올라갔어!",
    promoMaster: "마스터즈 에이트 진출! 세계 여덟 명 안에 들었어!",
    tNext: "다음 라운드 진출!",
    tLose: "아쉽다! 이 라운드는 다시 도전할 수 있어.",
    champion: "우승! 이제 월드 챔피언이야!",
    championHello: "챔피언 방어전이야! 연습 대결이라 순위는 그대로야.",
    hyperDrop: "이번엔 순위가 조금 내려갔어. 다시 올라가 보자!",
    rivalIntro: "라이벌 채두야! 이기면 순위표에서 채두를 앞지를 수 있어!",
    rivalWin: "라이벌 채두를 이겼어! 이제 채두가 우리 뒤에서 따라와!",
    leagueHello: "월드 챔피언십에 온 걸 환영해! 이겨서 순위를 올려 보자!",
    superSoon: "슈퍼 클래스는 곧 열려! 그동안 다시 대결해서 실력을 키우자.",
    reviewDone: "돌아보기 끝!",
    retry: "다시 해 보자!",
    exitAsk: "그만할까?",
    pickPiece: "우리 친구를 먼저 눌러 봐.",
    lessonDone: "수업 끝! 정말 잘했어!",
    reviewFirst: "새 수업 전에 지난번 문제를 먼저 풀어 보자!",
    setupGo: "아래 친구를 눌러서 제자리에 세워 보자!",
    setupWrong: "거기가 아니야. 다시 찾아보자!",
    setupDone: "판 차리기 끝!",
    // 배지·리그
    badgeGet: "배지를 얻었어!",
    allBadges: "배지를 다 모았어! 이제 월드 챔피언십에 나갈 수 있어!",
    rankUp: "순위가 올랐어!",
    rankSame: "이번엔 순위가 그대로야.",
    promoClass: "승급! 슈퍼 클래스로 올라갔어!",
    newsHello: "오늘의 순위 소식이에요!",
    reviewTime: "방금 판을 같이 돌아보자.",
    reviewBest: "이 수가 제일 멋졌어!",
    reviewRetry: "여기서 더 좋은 수가 있었어. 찾아볼래?",
    reviewGood: "맞아, 그 수가 좋아! 도장 하나!",
    reviewTryAgain: "음, 다른 수를 찾아보자.",
    saved: "나중에 이어서 두자!",
    updateNew: "새 버전이 나왔어요!",
    welcome: "안녕! 나는 피카츄야. 같이 체스를 배우자!",
  };

  const VoiceLines = { L, T, NAMES, CHESS, who, josa, I, UL, RO, EUN, expand, OURS, THEIRS };
  root.VoiceLines = VoiceLines;
  if (typeof module !== "undefined") module.exports = VoiceLines;
})(typeof window !== "undefined" ? window : globalThis);
