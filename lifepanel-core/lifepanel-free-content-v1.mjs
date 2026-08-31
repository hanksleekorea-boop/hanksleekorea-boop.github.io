export const LIFEPANEL_FREE_CONTENT_VERSION = "lifepanel-free-content-v1.0.0";

const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze(row)));

export const FREE_SCENARIOS = freezeRows([
  { id: "start-stuck", title: "시작이 막힐 때", prompt: "해야 할 일은 알지만 손이 움직이지 않아요.", purposeId: "focus", areaId: "time-focus", firstActionId: "work-write-one-line" },
  { id: "too-many-things", title: "할 일이 너무 많을 때", prompt: "무엇부터 해야 할지 모르겠어요.", purposeId: "balance", areaId: "time-focus", firstActionId: "work-pick-one" },
  { id: "low-energy", title: "에너지가 낮을 때", prompt: "지금은 힘을 많이 쓰기 어려워요.", purposeId: "recovery", areaId: "body-energy", firstActionId: "recovery-water" },
  { id: "after-break", title: "쉬고 돌아왔을 때", prompt: "며칠 쉬어서 다시 시작하기 부담스러워요.", purposeId: "recovery", areaId: "body-energy", firstActionId: "recovery-open-only" },
  { id: "before-focus", title: "집중 전에", prompt: "짧게 몰입할 준비를 하고 싶어요.", purposeId: "focus", areaId: "time-focus", firstActionId: "work-clear-one-spot" },
  { id: "body-stiff", title: "몸이 굳었을 때", prompt: "오래 앉아 있어 몸을 가볍게 풀고 싶어요.", purposeId: "recovery", areaId: "body-energy", firstActionId: "health-shoulder-roll" },
  { id: "day-close", title: "하루를 닫을 때", prompt: "오늘을 정리하고 내일 부담을 줄이고 싶어요.", purposeId: "balance", areaId: "time-focus", firstActionId: "work-tomorrow-one" },
  { id: "need-kindness", title: "자책이 커질 때", prompt: "못한 일보다 다시 움직일 여지를 찾고 싶어요.", purposeId: "recovery", areaId: "body-energy", firstActionId: "recovery-kind-sentence" },
]);

const actionGroups = {
  recovery: [
    ["water", "물 한 잔 마시기", 1, 1, "몸에 가장 작은 회복 신호를 보냅니다."],
    ["open-only", "하던 화면만 열어 보기", 1, 1, "완료가 아니라 재접속만 목표로 둡니다."],
    ["kind-sentence", "나에게 괜찮다는 한 문장 쓰기", 3, 1, "평가를 멈추고 다음 선택의 여지를 만듭니다."],
    ["slow-breath", "천천히 세 번 숨 쉬기", 1, 1, "속도를 잠시 낮춰 현재 상태를 알아차립니다."],
    ["look-far", "먼 곳을 20초 바라보기", 1, 1, "가까운 화면에서 눈과 주의를 잠시 떼어 냅니다."],
    ["quiet-minute", "소리 없이 1분 앉아 있기", 1, 1, "아무것도 해결하지 않아도 되는 짧은 틈을 만듭니다."],
    ["name-feeling", "지금 기분 한 단어 고르기", 1, 1, "감정을 판단하지 않고 이름만 붙입니다."],
    ["warm-drink", "따뜻한 음료 준비하기", 5, 2, "예측 가능한 작은 돌봄으로 전환합니다."],
    ["close-one-tab", "불필요한 창 하나 닫기", 1, 1, "주의를 빼앗는 자극을 하나만 줄입니다."],
    ["rest-permission", "5분 쉬어도 된다고 적기", 1, 1, "휴식을 실패가 아닌 선택으로 명확히 합니다."],
    ["light-change", "조명이나 커튼 조절하기", 3, 1, "환경을 몸이 편한 쪽으로 조금 바꿉니다."],
    ["stop-point", "오늘 멈출 지점 한 줄 정하기", 3, 2, "끝을 정해 과도한 진행 부담을 줄입니다."],
  ],
  health: [
    ["shoulder-roll", "어깨를 천천히 다섯 번 돌리기", 1, 1, "오래 유지한 자세를 무리 없이 바꿉니다."],
    ["walk-three", "안전한 곳에서 3분 걷기", 3, 2, "짧은 움직임으로 몸의 상태를 전환합니다."],
    ["stand-once", "자리에서 한 번 일어나기", 1, 1, "운동 목표 없이 자세만 바꿉니다."],
    ["neck-gentle", "목을 편한 범위에서 움직이기", 1, 1, "통증을 참지 않고 가동 범위만 확인합니다."],
    ["window-air", "창가에서 공기 느끼기", 3, 1, "환경 변화를 이용해 짧게 환기합니다."],
    ["hand-release", "손을 펴고 힘 빼기", 1, 1, "키보드와 휴대폰 사용 뒤 긴장을 낮춥니다."],
    ["posture-reset", "발을 바닥에 두고 자세 다시 잡기", 1, 1, "지탱되는 감각을 확인해 앉은 자세를 정리합니다."],
    ["snack-check", "배고픔과 목마름 확인하기", 1, 1, "추정하지 않고 기본적인 몸 신호를 확인합니다."],
    ["sunlight", "바깥빛 5분 보기", 5, 2, "가능한 환경에서 낮의 빛을 접합니다."],
    ["gentle-stretch", "편한 동작 하나로 몸 늘리기", 3, 2, "강도를 높이지 않고 굳은 부분을 살핍니다."],
    ["screen-distance", "화면을 팔 길이만큼 조정하기", 1, 1, "읽기 편한 거리와 각도를 다시 맞춥니다."],
    ["rest-eyes", "눈을 감고 1분 쉬기", 1, 1, "시각 자극을 잠시 줄입니다."],
  ],
  work: [
    ["write-one-line", "가장 작은 일 한 줄 적기", 3, 1, "모호한 부담을 눈에 보이는 행동으로 바꿉니다."],
    ["pick-one", "오늘 꼭 필요한 한 가지 고르기", 3, 2, "동시에 해결하려는 부담을 한 선택으로 줄입니다."],
    ["clear-one-spot", "책상 위 한 곳 비우기", 5, 2, "시작에 필요한 공간만 확보합니다."],
    ["timer-five", "5분 타이머로 첫 조각 시작하기", 5, 2, "오래 해야 한다는 압박 없이 시작합니다."],
    ["tomorrow-one", "내일 첫 행동 한 줄 남기기", 3, 1, "다시 시작할 때의 결정 비용을 줄입니다."],
    ["close-distraction", "방해되는 알림 하나 끄기", 1, 1, "집중 시간 동안 들어오는 자극을 하나 줄입니다."],
    ["define-done", "끝났다는 기준 한 문장 쓰기", 3, 2, "과업이 끝없이 커지는 것을 막습니다."],
    ["open-file", "필요한 파일 하나만 열기", 1, 1, "준비 행동을 최소 단위로 제한합니다."],
    ["send-draft", "완벽하지 않은 초안 저장하기", 5, 2, "완성 압박보다 다음 수정 가능성을 남깁니다."],
    ["split-next", "큰 일을 다음 두 조각으로 나누기", 5, 2, "지금과 나중에 할 일을 분리합니다."],
    ["focus-ten", "한 가지에만 10분 쓰기", 10, 3, "짧고 명확한 집중 구간을 만듭니다."],
    ["shutdown-list", "열린 일 세 개만 적고 닫기", 5, 2, "기억하려는 부담을 밖으로 옮깁니다."],
  ],
  learning: [
    ["one-sentence", "배울 것 한 문장 고르기", 3, 1, "학습 범위를 한 문장으로 좁힙니다."],
    ["read-one", "한 문단만 읽기", 3, 1, "분량보다 다시 연결하는 것을 우선합니다."],
    ["question-one", "궁금한 점 하나 적기", 3, 1, "수동적으로 읽기 전에 탐색 방향을 만듭니다."],
    ["recall-three", "기억나는 것 세 단어 쓰기", 3, 2, "정답 확인 전 현재 기억을 꺼내 봅니다."],
    ["example-one", "개념의 내 예시 하나 만들기", 5, 2, "새 정보를 익숙한 상황과 연결합니다."],
    ["bookmark-next", "다음에 볼 위치 표시하기", 1, 1, "중단 뒤 되돌아오는 길을 남깁니다."],
    ["explain-simple", "쉬운 말로 한 문장 설명하기", 5, 2, "이해한 범위와 빈 곳을 확인합니다."],
    ["review-five", "지난 내용 5분만 훑기", 5, 2, "새 내용을 더하기 전 연결을 회복합니다."],
    ["practice-one", "연습 문제 하나 풀기", 10, 3, "작은 실제 적용으로 이해를 확인합니다."],
    ["note-source", "출처와 확인일 함께 적기", 3, 1, "나중에 다시 검증할 수 있는 흔적을 남깁니다."],
    ["compare-two", "두 개념의 차이 한 줄 쓰기", 5, 2, "비슷한 내용을 구분해 기억을 선명하게 합니다."],
    ["stop-learning", "오늘 학습 종료 문장 남기기", 3, 1, "더 해야 한다는 압박 대신 다음 지점을 정합니다."],
  ],
};

export const FREE_MOVES = freezeRows(Object.entries(actionGroups).flatMap(([domainId, rows]) => rows.map(([suffix, title, minutes, energyCost, reason]) => ({
  id: `${domainId}-${suffix}`,
  domainId,
  areaId: domainId === "health" || domainId === "recovery" ? "body-energy" : "time-focus",
  title,
  minutes,
  energyCost,
  reason,
  alternative: minutes > 1 ? "부담되면 1분 또는 한 동작으로 줄여도 됩니다." : "지금 하지 않고 미루기·휴식·도움 요청을 골라도 됩니다.",
  safety: domainId === "health" ? "통증·어지럼·불편이 생기면 즉시 멈추고 필요한 전문 도움을 선택하세요." : "점수와 벌점은 없으며 언제든 중단할 수 있습니다.",
}))));

export const RECOVERY_MOVES = freezeRows([
  ["shrink", "한 단계만 남기기", "원래 행동에서 첫 동작 하나만 합니다."],
  ["shrink", "시간을 1분으로 줄이기", "끝내려 하지 않고 1분 뒤 다시 고릅니다."],
  ["shrink", "제목만 쓰기", "내용 대신 시작 표시만 남깁니다."],
  ["shrink", "도구만 꺼내기", "실행하지 않고 필요한 도구만 준비합니다."],
  ["shrink", "선택지만 두 개로 줄이기", "결정할 후보를 두 개만 남깁니다."],
  ["defer", "오늘 저녁으로 미루기", "다시 볼 시간을 정하고 지금 목록에서 내립니다."],
  ["defer", "내일 첫 행동으로 옮기기", "내일 시작 문장과 함께 보류합니다."],
  ["defer", "이번 주 보관함에 넣기", "급하지 않은 일을 주간 검토 때 다시 봅니다."],
  ["defer", "조건이 갖춰질 때까지 기다리기", "필요한 사람·자료·장소를 함께 적습니다."],
  ["defer", "하지 않기로 결정하기", "가치가 낮은 일은 이유 한 줄과 함께 내려놓습니다."],
  ["rest", "눈 감고 1분 쉬기", "시각 자극을 줄이고 아무것도 해결하지 않습니다."],
  ["rest", "물과 호흡부터 챙기기", "기본 상태를 확인한 뒤 계속할지 고릅니다."],
  ["rest", "화면에서 5분 떨어지기", "기기 알림을 끄고 짧게 자리를 옮깁니다."],
  ["rest", "오늘은 여기서 멈추기", "멈춘 지점만 남기고 남은 일을 벌점 없이 닫습니다."],
  ["rest", "가벼운 움직임 고르기", "통증 없는 범위에서 자세만 바꿉니다."],
  ["ask-help", "질문 한 문장 만들기", "상대가 답하기 쉬운 구체적인 질문을 적습니다."],
  ["ask-help", "함께 10분 요청하기", "결과 대신 짧은 동행 시간을 부탁합니다."],
  ["ask-help", "자료 위치 물어보기", "막힌 원인이 정보라면 위치나 담당자를 확인합니다."],
  ["ask-help", "안전한 사람에게 상태 알리기", "원하는 도움 범위와 연락 방법을 직접 고릅니다."],
  ["ask-help", "전문 도움 경로 확인하기", "의료·위기·금융 판단은 적절한 지역 전문기관에 직접 확인합니다."],
].map(([kind, title, instruction], index) => ({ id: `recovery-${kind}-${String(index + 1).padStart(2, "0")}`, kind, title, instruction, autoSend: false })));

export const STARTER_EXAMPLES = freezeRows([
  { id: "example-water", scenarioId: "low-energy", text: "물 한 잔 마시고 계속할지 다시 고르기" },
  { id: "example-one-line", scenarioId: "start-stuck", text: "가장 작은 일 한 줄만 적기" },
  { id: "example-pick-one", scenarioId: "too-many-things", text: "오늘 꼭 필요한 한 가지 고르기" },
  { id: "example-return", scenarioId: "after-break", text: "하던 화면만 열고 바로 닫아도 괜찮기" },
  { id: "example-shoulders", scenarioId: "body-stiff", text: "어깨를 편한 범위에서 다섯 번 돌리기" },
  { id: "example-tomorrow", scenarioId: "day-close", text: "내일 첫 행동 한 줄 남기기" },
]);

export const REFLECTION_PROMPTS = freezeRows([
  ["fit", "이 행동의 크기는 지금 나에게 맞았나요?"], ["energy", "하기 전과 뒤의 에너지는 어떻게 달랐나요?"],
  ["friction", "가장 막혔던 한 지점은 무엇이었나요?"], ["support", "다음에는 어떤 도움이 있으면 쉬울까요?"],
  ["repeat", "이 행동을 다시 쓴다면 언제가 좋을까요?"], ["shrink", "더 작게 만든다면 무엇만 남길까요?"],
  ["stop", "오늘 충분하다고 정할 지점은 어디인가요?"], ["notice", "몸이나 마음에서 알아차린 신호가 있나요?"],
  ["next", "다음에 돌아올 수 있도록 남길 한 문장은 무엇인가요?"],
].map(([id, prompt]) => ({ id: `reflection-${id}`, prompt, optional: true })));

export const REFLECTION_OUTCOMES = freezeRows([
  { id: "outcome-helpful", label: "도움 됨", explanation: "지금 상태에 맞았다고 기록합니다." },
  { id: "outcome-too-big", label: "너무 큼", explanation: "다음에는 더 작은 행동을 먼저 보여 줄 근거로 남깁니다." },
  { id: "outcome-not-now", label: "지금은 아님", explanation: "실패로 보지 않고 다른 때 다시 고를 수 있게 남깁니다." },
]);

export const WEEKLY_STORY_PATTERNS = freezeRows([
  ["started", "이번 주에는 {count}번 다시 시작했습니다."], ["small", "작게 줄인 선택이 {count}번 있었습니다."],
  ["rest", "휴식을 고른 {count}번도 계획의 일부였습니다."], ["defer", "미룬 일 {count}개에 다시 볼 자리를 남겼습니다."],
  ["help", "도움을 요청할 문장을 {count}번 만들었습니다."], ["energy-low", "에너지가 낮은 날에는 짧은 행동을 더 자주 골랐습니다."],
  ["focus", "집중 행동은 {minutes}분만큼 쌓였습니다."], ["recovery", "회복 행동은 {count}번 선택되었습니다."],
  ["return", "쉬었다 돌아온 뒤 첫 행동을 남겼습니다."], ["steady", "크게 몰아치기보다 {days}일에 나누어 움직였습니다."],
  ["unfinished", "끝내지 않은 선택에도 벌점은 없습니다. 다음 주에 다시 고를 수 있습니다."], ["empty", "기록이 적은 주입니다. 한 번의 상태 확인부터 다시 시작할 수 있습니다."],
].map(([id, template]) => ({ id: `weekly-${id}`, template, judgement: "none" })));

export const EMPTY_STATES = freezeRows([
  ["moves", "아직 고른 행동이 없습니다.", "지금 상태를 확인하고 작은 행동 하나를 골라 보세요."],
  ["history", "아직 기록이 없습니다.", "완료하지 않아도 선택만 남길 수 있습니다."],
  ["weekly", "이번 주 이야기를 만들 기록이 부족합니다.", "오늘 한 번의 상태 확인부터 시작하세요."],
  ["inbox", "빠른 수집함이 비어 있습니다.", "기억할 한 줄이 생기면 기기 안에 담으세요."],
  ["backup", "아직 만든 사본이 없습니다.", "중요한 기록 전에는 JSON 사본을 내려받으세요."],
  ["restore", "복원할 파일을 고르지 않았습니다.", "내가 만든 LifePanel JSON 파일만 선택하세요."],
  ["experiment", "진행 중인 작은 실험이 없습니다.", "결과를 단정하지 않는 7일 실험 하나를 시작할 수 있습니다."],
  ["session", "집중 세션을 시작하지 않았습니다.", "원할 때 직접 시작하세요. 자동 시작은 없습니다."],
  ["legacy", "이어 쓸 기존 목표가 없습니다.", "새 LifePanel 행동을 바로 사용할 수 있습니다."],
  ["search", "맞는 도움말을 찾지 못했습니다.", "다른 단어로 찾거나 전체 질문을 펼쳐 보세요."],
].map(([id, title, action]) => ({ id: `empty-${id}`, title, action })));

export const ERROR_STATES = freezeRows([
  ["storage", "기기 저장소에 쓰지 못했습니다.", "기존 자료는 바꾸지 않았습니다.", "공간과 사이트 저장 권한을 확인하고 다시 시도하세요."],
  ["export", "사본을 만들지 못했습니다.", "기기 안 기존 자료는 그대로입니다.", "브라우저 다운로드 권한을 확인하세요."],
  ["import-format", "파일 형식이 맞지 않습니다.", "가져오기 전 상태를 유지했습니다.", "LifePanel에서 내보낸 JSON인지 확인하세요."],
  ["import-version", "지원하지 않는 판의 사본입니다.", "현재 자료를 덮어쓰지 않았습니다.", "같거나 더 새로운 공개판에서 다시 내보내세요."],
  ["import-integrity", "사본의 무결성 확인에 실패했습니다.", "현재 자료는 바뀌지 않았습니다.", "원본 사본을 다시 선택하세요."],
  ["offline-first", "첫 방문이라 오프라인 화면이 없습니다.", "입력 자료는 만들지 않았습니다.", "한 번 인터넷에 연결해 공개판을 열어 주세요."],
  ["network", "인터넷 연결이 끊겼습니다.", "이미 준비된 기기 안 기능은 계속 쓸 수 있습니다.", "연결 뒤 새 판 확인을 다시 시도하세요."],
  ["permission", "브라우저가 요청을 허용하지 않았습니다.", "권한이 필요한 자료는 수집하지 않았습니다.", "사이트 설정에서 직접 허용하거나 이 기능을 건너뛰세요."],
  ["invalid-value", "입력값을 사용할 수 없습니다.", "마지막으로 확인된 값은 유지했습니다.", "표시된 범위 안의 값을 다시 골라 주세요."],
  ["duplicate", "같은 사본을 이미 복원했습니다.", "중복 기록을 만들지 않았습니다.", "현재 자료를 계속 사용하거나 다른 사본을 고르세요."],
  ["delete-cancel", "전체 삭제를 취소했습니다.", "어떤 자료도 지우지 않았습니다.", "필요하면 사본을 먼저 만든 뒤 다시 선택하세요."],
  ["unknown", "예상하지 못한 문제가 생겼습니다.", "가능한 경우 마지막 저장 상태를 유지했습니다.", "새로 고침 뒤에도 반복되면 도움말의 진단 정보를 확인하세요."],
].map(([id, whatHappened, dataImpact, nextAction]) => ({ id: `error-${id}`, whatHappened, dataImpact, nextAction })));

export const FAQ_ITEMS = freezeRows([
  ["what", "LifePanel은 무엇인가요?", "지금 상태를 확인하고 부담 없는 다음 행동을 고르는 개인 생활 패널입니다."],
  ["score", "점수나 연속 기록이 있나요?", "없습니다. 완료·축소·미루기·휴식·도움 요청 모두 벌점 없이 기록됩니다."],
  ["account", "가입해야 하나요?", "현재 1단계 무료판은 계정 없이 이 브라우저에서 바로 씁니다."],
  ["storage", "자료는 어디에 저장되나요?", "직접 저장한 설정과 기록은 현재 브라우저의 기기 안 저장소에 보관됩니다."],
  ["sync", "다른 기기와 자동 동기화되나요?", "아닙니다. JSON 사본을 직접 내보내고 복원해야 합니다."],
  ["backup", "자료를 잃지 않으려면 어떻게 하나요?", "정기적으로 판번호 사본을 내려받아 내가 관리하는 안전한 위치에 보관하세요."],
  ["delete", "내 자료를 어떻게 지우나요?", "내 자료 보호 센터에서 LifePanel 자료 전체 삭제를 선택할 수 있습니다. 기존 WeDoIt 원본은 지우지 않습니다."],
  ["offline", "인터넷 없이 쓸 수 있나요?", "온라인에서 한 번 연 뒤 준비된 화면과 기기 안 기능을 오프라인에서 쓸 수 있습니다."],
  ["install", "앱처럼 설치할 수 있나요?", "지원 브라우저의 홈 화면에 추가 또는 앱 설치 메뉴를 사용하세요."],
  ["recommend", "추천은 무엇을 사용하나요?", "직접 고른 목적과 현재 입력한 에너지·부담·기분만 사용합니다."],
  ["ai", "의료나 금융 판단을 해 주나요?", "아닙니다. 진단·치료·매수·매도 판단을 대신하지 않습니다."],
  ["help", "도움 요청을 누르면 자동 연락되나요?", "아닙니다. 문장을 준비할 뿐 외부로 자동 전송하지 않습니다."],
  ["privacy", "잠금 화면에 자세한 내용이 보이나요?", "기본값은 숨김이며 상세 제목은 사용자가 위험을 확인하고 저장할 때만 표시됩니다."],
  ["stale", "오래된 추천은 어떻게 되나요?", "잠금 화면에서는 자동으로 숨기고 본 화면에서는 현재 상태를 다시 확인하도록 안내합니다."],
  ["language", "영어를 완전히 지원하나요?", "설정 항목은 있으나 1단계 콘텐츠 정본은 한국어입니다. 영어 전체 번역은 알려진 제한입니다."],
  ["price", "무료판에 결제가 있나요?", "현재 무료판은 실제 결제를 받지 않습니다."],
  ["browser", "어떤 기기에서 쓸 수 있나요?", "최신 모바일·PC 브라우저를 대상으로 하며 일부 설치·알림 동작은 운영체제마다 다릅니다."],
  ["restore", "복원하면 기존 자료가 바로 바뀌나요?", "판번호와 SHA-256을 확인한 올바른 사본만 적용하며 실패하면 기존 상태를 되돌립니다."],
  ["legacy", "기존 WeDoIt 자료는 어떻게 되나요?", "선택한 목표의 LifePanel 사본만 만들고 원본 키는 수정하거나 삭제하지 않습니다."],
  ["support", "문제가 생기면 무엇을 보내야 하나요?", "비밀값과 개인 기록을 제외하고 브라우저·운영체제·발생 시각·화면 이름·오류 문구를 준비하세요."],
].map(([id, question, answer]) => ({ id: `faq-${id}`, question, answer })));

export const EXPRESSION_STYLES = freezeRows([
  { id: "minimal", label: "간결하게", example: "물 한 잔 · 1분" },
  { id: "warm", label: "따뜻하게", example: "지금은 물 한 잔이면 충분해요 · 1분" },
  { id: "analytical", label: "근거와 함께", example: "에너지 2를 반영한 저부담 행동 · 물 한 잔 · 1분" },
]);

export const FREE_STAGE1_CONTENT_COUNTS = Object.freeze({
  scenarios: 8, moves: 48, recoveryMoves: 20, starterExamples: 6, reflectionOutcomes: 3, reflections: 9,
  weeklyStories: 12, emptyStates: 10, errorStates: 12, faqs: 20, expressionStyles: 3,
});

export function movesForScenario(scenarioId) {
  const scenario = FREE_SCENARIOS.find((row) => row.id === scenarioId);
  if (!scenario) return [];
  const first = FREE_MOVES.find((row) => row.id === scenario.firstActionId);
  return [first, ...FREE_MOVES.filter((row) => row.areaId === scenario.areaId && row.id !== scenario.firstActionId)].filter(Boolean);
}

export function validateFreeStage1Content() {
  const collections = {
    scenarios: FREE_SCENARIOS, moves: FREE_MOVES, recoveryMoves: RECOVERY_MOVES,
    starterExamples: STARTER_EXAMPLES, reflectionOutcomes: REFLECTION_OUTCOMES, reflections: REFLECTION_PROMPTS,
    weeklyStories: WEEKLY_STORY_PATTERNS, emptyStates: EMPTY_STATES,
    errorStates: ERROR_STATES, faqs: FAQ_ITEMS, expressionStyles: EXPRESSION_STYLES,
  };
  const errors = [];
  for (const [name, expected] of Object.entries(FREE_STAGE1_CONTENT_COUNTS)) {
    if (collections[name].length !== expected) errors.push(`${name}: expected ${expected}, got ${collections[name].length}`);
  }
  const ids = Object.values(collections).flatMap((rows) => rows.map((row) => row.id));
  if (new Set(ids).size !== ids.length) errors.push("content ids must be globally unique");
  const moveIds = new Set(FREE_MOVES.map((row) => row.id));
  for (const scenario of FREE_SCENARIOS) if (!moveIds.has(scenario.firstActionId)) errors.push(`${scenario.id}: missing first action`);
  for (const move of FREE_MOVES) {
    if (!Number.isInteger(move.minutes) || move.minutes < 1 || move.minutes > 25) errors.push(`${move.id}: invalid minutes`);
    if (!Number.isInteger(move.energyCost) || move.energyCost < 1 || move.energyCost > 5) errors.push(`${move.id}: invalid energy`);
    if (!move.reason || !move.alternative || !move.safety) errors.push(`${move.id}: incomplete guidance`);
  }
  return Object.freeze({ pass: errors.length === 0, version: LIFEPANEL_FREE_CONTENT_VERSION, counts: Object.freeze(Object.fromEntries(Object.entries(collections).map(([key, rows]) => [key, rows.length]))), errors: Object.freeze(errors) });
}
