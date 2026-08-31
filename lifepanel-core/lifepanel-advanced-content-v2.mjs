export const ADVANCED_CONTENT_VERSION = "2.0.0";

const minutes = [1, 3, 5, 10, 15, 25];

const domainBlueprints = [
  ["health", "몸·에너지", "Body & energy", [["water", "물 한 잔 천천히 마시기", "drink a glass of water slowly"], ["stretch", "앉은 자리에서 몸 펴기", "stretch where you are"], ["air", "창가에서 숨 고르기", "pause for fresh air"], ["meal", "다음 식사 준비 한 가지 하기", "prepare one part of your next meal"], ["walk", "편한 속도로 움직이기", "move at a comfortable pace"], ["rest", "눈과 몸 쉬게 하기", "rest your eyes and body"]]],
  ["work", "시간·집중", "Time & focus", [["start", "가장 작은 시작점 열기", "open the smallest starting point"], ["single", "할 일 하나만 남기기", "leave only one task visible"], ["timer", "짧은 집중 구간 만들기", "make a short focus block"], ["close", "열린 작업 하나 닫기", "close one open task"], ["plan", "다음 행동 한 줄 적기", "write one next action"], ["buffer", "일정 사이 여백 만들기", "make a buffer between plans"]]],
  ["creation", "일·역할", "Work & roles", [["role", "오늘 맡은 역할 하나 고르기", "choose one role for today"], ["boundary", "하지 않을 일 하나 정하기", "choose one thing not to do"], ["draft", "완성 전 초안 만들기", "make a draft before polishing"], ["handoff", "전달할 내용을 세 줄로 적기", "write a three-line handoff"], ["review", "끝낸 일 하나 확인하기", "review one finished item"], ["reset", "작업 자리를 다음 시작에 맞추기", "reset your workspace for the next start"]]],
  ["learning", "학습·성장", "Learning & growth", [["question", "궁금한 질문 하나 적기", "write one question you have"], ["read", "자료 한 부분 읽기", "read one small section"], ["recall", "기억나는 것을 먼저 적기", "write what you remember first"], ["practice", "작은 예제 하나 풀기", "try one small example"], ["explain", "배운 것을 쉬운 말로 설명하기", "explain what you learned simply"], ["next", "다음 학습 지점 표시하기", "mark the next learning point"]]],
  ["home", "집·생활", "Home & daily life", [["surface", "눈앞의 한 구역 비우기", "clear one area in view"], ["laundry", "세탁 한 단계만 진행하기", "do one laundry step"], ["dish", "그릇 몇 개만 정리하기", "put away a few dishes"], ["prepare", "내일 필요한 것 하나 준비하기", "prepare one thing for tomorrow"], ["repair", "작은 불편 하나 기록하기", "note one small household friction"], ["comfort", "쉬기 좋은 자리를 만들기", "make one spot comfortable"]]],
  ["relationships", "관계·돌봄", "Relationships & care", [["hello", "안부 한 문장 보내기", "send a one-line hello"], ["listen", "답보다 먼저 들어주기", "listen before offering an answer"], ["thanks", "고마운 점 하나 전하기", "share one specific thank-you"], ["request", "도움 요청을 작게 적기", "write a small help request"], ["boundary", "가능한 범위를 분명히 말하기", "state what you can offer"], ["care", "돌봄 뒤 내 회복도 예약하기", "plan recovery after caring"]]],
  ["money", "돈·자원", "Money & resources", [["notice", "오늘 쓴 금액 하나 기록하기", "note one amount spent today"], ["pause", "구매 전 잠깐 멈추기", "pause before a purchase"], ["bill", "예정된 납부 하나 확인하기", "check one upcoming bill"], ["cancel", "쓰지 않는 항목 하나 살펴보기", "review one unused item"], ["plan", "이번 주 한도를 적어 보기", "write a simple weekly limit"], ["help", "공식 상담 경로 찾아 적기", "note an official support route"]]],
  ["recovery", "회복·여가", "Recovery & leisure", [["quiet", "알림 없이 쉬는 구간 만들기", "make a notification-free pause"], ["music", "좋아하는 소리 하나 듣기", "listen to one sound you enjoy"], ["outside", "바깥 풍경 바라보기", "look at an outdoor view"], ["play", "결과 없는 놀이 하기", "play without an outcome"], ["release", "오늘 미뤄도 될 일 정하기", "choose one thing that can wait"], ["sleep", "잠들기 전 화면 줄이기", "reduce screen time before sleep"]]],
];

const safetyByDomain = {
  health: { ko: "통증·호흡곤란·즉시 위험이 있으면 멈추고 지역 응급 도움을 선택하세요.", en: "Stop and seek local emergency help for pain, breathing trouble, or immediate danger." },
  money: { ko: "금융 결정이나 거래 지시가 아닙니다. 계약 전 공식 조건을 직접 확인하세요.", en: "This is not financial or trading advice. Verify official terms before committing." },
  relationships: { ko: "위협이나 통제가 느껴지면 직접 대면보다 안전한 도움 경로를 우선하세요.", en: "If you feel threatened or controlled, prioritize a safe support route over confrontation." },
};
const defaultSafety = { ko: "불편하거나 안전하지 않으면 즉시 멈추고 더 작은 행동이나 도움 요청을 고르세요.", en: "Stop if this feels unsafe or uncomfortable; choose a smaller step or ask for help." };

const sizeLabel = {
  ko: ["아주 작게", "가볍게", "짧게", "천천히"],
  en: ["tiny", "light", "short", "steady"],
};

export const ADVANCED_DOMAINS = Object.freeze(domainBlueprints.map(([id, ko, en]) => Object.freeze({ id, locales: Object.freeze({ ko: Object.freeze({ label: ko }), en: Object.freeze({ label: en }) }) })));

export const ADVANCED_MOVES = Object.freeze(domainBlueprints.flatMap(([domainId, domainKo, domainEn, concepts], domainIndex) => concepts.flatMap(([conceptId, ko, en], conceptIndex) => [0, 1, 2, 3].map((variant) => {
  const duration = minutes[(conceptIndex + variant + domainIndex) % minutes.length];
  const safety = safetyByDomain[domainId] || defaultSafety;
  return Object.freeze({
    id: `v2-${domainId}-${conceptId}-${variant + 1}`,
    domainId,
    minutes: duration,
    energy: Math.min(5, 1 + Math.floor(duration / 6)),
    tags: Object.freeze([conceptId, duration <= 5 ? "low-time" : "deep", domainId]),
    locales: Object.freeze({
      ko: Object.freeze({ title: `${duration}분 동안 ${ko}`, reason: `${domainKo} 영역을 ${sizeLabel.ko[variant]} 돌보는 선택입니다. 완료하지 않아도 불이익이 없습니다.`, alternative: `부담되면 1분만 하거나 오늘은 쉬기로 바꾸세요.`, safety: safety.ko }),
      en: Object.freeze({ title: `${en} for ${duration} minutes`, reason: `A ${sizeLabel.en[variant]} option for ${domainEn}. There is no penalty for stopping.`, alternative: `If this feels too much, try one minute or choose rest today.`, safety: safety.en }),
    }),
  });
}))));

export const ADVANCED_SCENARIOS = Object.freeze(domainBlueprints.flatMap(([domainId, domainKo, domainEn, concepts]) => concepts.slice(0, 3).map(([conceptId, ko, en], index) => Object.freeze({
  id: `scenario-${domainId}-${index + 1}`,
  domainId,
  firstActionId: `v2-${domainId}-${conceptId}-1`,
  locales: Object.freeze({
    ko: Object.freeze({ title: `${domainKo}에서 시작이 막힐 때`, description: `지금은 ${ko}부터 작게 시작합니다.` }),
    en: Object.freeze({ title: `When starting feels hard in ${domainEn}`, description: `Begin gently: ${en}.` }),
  }),
}))));

export const ADVANCED_EXPERIMENTS = Object.freeze(domainBlueprints.flatMap(([domainId, domainKo, domainEn, concepts]) => [0, 1].map((index) => Object.freeze({
  id: `experiment-${domainId}-${index + 1}`,
  domainId,
  days: index === 0 ? 21 : 30,
  actionIds: Object.freeze([`v2-${domainId}-${concepts[index][0]}-2`, `v2-${domainId}-${concepts[index + 2][0]}-2`]),
  locales: Object.freeze({
    ko: Object.freeze({ title: `${domainKo} ${index === 0 ? 21 : 30}일 작은 실험`, description: "성공 횟수보다 어떤 조건에서 도움이 됐는지 살펴봅니다.", stopCondition: "불편·피로·위험 신호가 커지면 바로 중단합니다.", reflection: "어떤 날에 더 쉬웠고, 다음에는 무엇을 줄일까요?" }),
    en: Object.freeze({ title: `${index === 0 ? 21 : 30}-day ${domainEn} experiment`, description: "Notice when it helped instead of chasing a success count.", stopCondition: "Stop immediately if discomfort, fatigue, or risk increases.", reflection: "When was it easier, and what could be smaller next time?" }),
  }),
}))));

export const ADVANCED_WEEKLY_STORIES = Object.freeze(domainBlueprints.flatMap(([domainId, domainKo, domainEn, concepts]) => [0, 1, 2, 3].map((index) => Object.freeze({
  id: `weekly-${domainId}-${index + 1}`,
  domainId,
  sample: "illustrative",
  period: "example-week",
  locales: Object.freeze({
    ko: Object.freeze({ title: `${domainKo} 예시 주간 ${index + 1}`, summary: `가상 예시입니다. ${concepts[index][1]}를 시도한 뒤 더 작은 크기가 잘 맞았다고 기록했습니다.`, evidence: "실사용 통계가 아닌 설명용 예시" }),
    en: Object.freeze({ title: `${domainEn} sample week ${index + 1}`, summary: `Illustrative only: after trying to ${concepts[index][2]}, the person noted that a smaller size fit better.`, evidence: "Illustrative copy, not real usage statistics" }),
  }),
}))));

const faqTopics = [
  ["추천을 꼭 따라야 하나요?", "Do I have to follow a suggestion?", "아니요. 끄기·숨기기·더 작게·쉬기를 언제든 고를 수 있습니다.", "No. You can disable, hide, shrink, or rest at any time."],
  ["결과가 점수에 반영되나요?", "Does the result affect a score?", "점수·연속 기록·순위·벌점이 없습니다.", "There are no scores, streaks, ranks, or penalties."],
  ["어떤 정보로 바뀌나요?", "What changes suggestions?", "직접 고른 영역·시간·에너지와 기록한 결과만 사용합니다.", "Only your chosen domains, time, energy, and recorded outcomes are used."],
  ["자료는 어디에 있나요?", "Where is my data?", "기본값은 이 브라우저입니다. 수동 클라우드 사본은 연결 후 직접 눌러야만 생성됩니다.", "The default is this browser. A cloud copy is created only when you connect and explicitly request it."],
  ["위험한 상황에는 어떻게 하나요?", "What about a risky situation?", "앱 판단을 따르지 말고 지역 응급기관·공식 전문가·신뢰할 사람에게 직접 도움을 요청하세요.", "Do not rely on the app; contact local emergency services, a qualified professional, or a trusted person."],
];

export const ADVANCED_FAQ = Object.freeze(domainBlueprints.flatMap(([domainId, domainKo, domainEn]) => faqTopics.map((topic, index) => Object.freeze({
  id: `faq-${domainId}-${index + 1}`,
  domainId,
  locales: Object.freeze({ ko: Object.freeze({ question: `${domainKo}: ${topic[0]}`, answer: topic[2] }), en: Object.freeze({ question: `${domainEn}: ${topic[1]}`, answer: topic[3] }) }),
}))));

export const ADVANCED_TONES = Object.freeze([
  { id: "calm", locales: { ko: { label: "차분하게", note: "판단 없이 한 단계씩" }, en: { label: "Calm", note: "One non-judgmental step at a time" } } },
  { id: "direct", locales: { ko: { label: "간결하게", note: "필요한 정보만" }, en: { label: "Direct", note: "Only what is needed" } } },
  { id: "warm", locales: { ko: { label: "따뜻하게", note: "부담을 낮추는 표현" }, en: { label: "Warm", note: "Language that lowers pressure" } } },
  { id: "light-game", locales: { ko: { label: "가벼운 놀이처럼", note: "순위·연속 기록·손실 없음" }, en: { label: "Light and playful", note: "No ranks, streaks, or loss" } } },
].map(Object.freeze));

export const CONTEXT_COPY = Object.freeze({
  season: { ko: "계절과 날씨는 직접 선택할 때만 참고합니다.", en: "Season and weather are used only when you choose them." },
  weekend: { ko: "주말에는 회복과 관계 행동을 먼저 볼 수 있습니다.", en: "On weekends, you may place recovery and relationship actions first." },
  shift: { ko: "교대 일정은 시계 시간보다 깨어 있는 구간을 기준으로 봅니다.", en: "For shift work, use awake periods rather than clock time." },
  travel: { ko: "여행 중에는 위치를 수집하지 않고 직접 고른 시간대만 사용합니다.", en: "During travel, location is not collected; only your chosen time zone is used." },
});

export const SUFFICIENCY_STATES = Object.freeze({
  none: { ko: "기록 없음", en: "No records" },
  insufficient: { ko: "아직 부족함", en: "Not enough yet" },
  sufficient: { ko: "비교 가능", en: "Ready to compare" },
  stale: { ko: "오래되어 다시 확인 필요", en: "Stale; check again" },
});

export function localize(item, locale = "ko") {
  return item?.locales?.[locale] || item?.locales?.ko || null;
}

export function searchAdvancedMoves({ query = "", locale = "ko", domainIds = [] } = {}) {
  const normalized = String(query).trim().toLocaleLowerCase(locale === "ko" ? "ko-KR" : "en-US");
  const selected = new Set(domainIds.slice(0, 2));
  return ADVANCED_MOVES.filter((move) => {
    if (selected.size && !selected.has(move.domainId)) return false;
    if (!normalized) return true;
    const copy = localize(move, locale);
    return [copy.title, copy.reason, copy.alternative, ...move.tags].join(" ").toLocaleLowerCase().includes(normalized);
  });
}

export function validateAdvancedContent() {
  const errors = [];
  const expected = [["domains", ADVANCED_DOMAINS, 8], ["moves", ADVANCED_MOVES, 192], ["scenarios", ADVANCED_SCENARIOS, 24], ["experiments", ADVANCED_EXPERIMENTS, 16], ["weeklyStories", ADVANCED_WEEKLY_STORIES, 32], ["faq", ADVANCED_FAQ, 40], ["tones", ADVANCED_TONES, 4]];
  for (const [name, list, count] of expected) if (list.length !== count) errors.push(`${name}: expected ${count}, got ${list.length}`);
  const ids = new Set();
  for (const list of expected.map(([, value]) => value)) for (const item of list) {
    if (!item.id || ids.has(item.id)) errors.push(`duplicate or missing id: ${item.id || "(empty)"}`);
    ids.add(item.id);
    if (!item.locales?.ko || !item.locales?.en) errors.push(`missing locale: ${item.id}`);
  }
  const moveIds = new Set(ADVANCED_MOVES.map((item) => item.id));
  for (const scenario of ADVANCED_SCENARIOS) if (!moveIds.has(scenario.firstActionId)) errors.push(`broken scenario action: ${scenario.id}`);
  for (const experiment of ADVANCED_EXPERIMENTS) for (const id of experiment.actionIds) if (!moveIds.has(id)) errors.push(`broken experiment action: ${experiment.id}`);
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), counts: Object.freeze(Object.fromEntries(expected.map(([name, list]) => [name, list.length]))) });
}
