import {
  createBoundary,
  createCheckIn,
  createLegacyContinuity,
  createLegacyMappingPreview,
  createLockPrivacyPreference,
  createLockScreenPayload,
  createMove,
  createSensitiveSupportGuidance,
  createStarterProfile,
  createSuggestionCard,
  createSelectedLegacyContinuity,
  generateNextMoves,
  LEGACY_WEDOIT_STORAGE_KEY,
  MOVE_CHOICE_VERSION,
  readSavedLegacyContinuity,
  readLockPrivacyPreference,
  recordMoveChoice,
  rollbackLegacyContinuityCopy,
  saveLegacyContinuityCopy,
  saveLockPrivacyPreference,
} from "../lifepanel-core/lifepanel-contract-v1.mjs";
import {
  createLifePanelTransferBundle,
  restoreLifePanelTransferBundle,
} from "../lifepanel-core/lifepanel-transfer-v1.mjs";
import { FREE_MOVES } from "../lifepanel-core/lifepanel-free-content-v1.mjs";
import { LIFEPANEL_LAST_EXPORT_KEY } from "../lifepanel-core/lifepanel-data-control-v1.mjs";
import { initFreeContentUI } from "./free-content-ui.mjs";
import { initWorkflowPanels } from "./workflows-ui.mjs";
import { initAdvancedUI } from "./advanced-ui.mjs";
import { initPlusUI } from "./plus-ui.mjs";

const moves = FREE_MOVES.map((content) => Object.freeze({
  ...createMove(content),
  catalogId: content.id,
  alternative: content.alternative,
  safety: content.safety,
}));

const boundaries = [
  createBoundary({ id: "private-screen", kind: "privacy", label: "잠금 화면 기본 숨김", state: "guarded" }),
];

const directionDomains = {
  balance: ["recovery", "health", "home"],
  focus: ["work", "learning"],
  recovery: ["recovery", "health"],
  connection: ["relationships"],
};

const energy = document.querySelector("#energy");
const load = document.querySelector("#load");
const mood = document.querySelector("#mood");
const applyCheckIn = document.querySelector("#apply-checkin");
const checkInStatus = document.querySelector("#checkin-status");
const connectionStatus = document.querySelector("#connection-status");
const skipLink = document.querySelector(".skip-link");
const mainContent = document.querySelector("#main-content");
const focusTitle = document.querySelector("#focus-title");
const signalTitle = document.querySelector("#signal-title");
const signalDetail = document.querySelector("#signal-detail");
const moveList = document.querySelector("#move-list");
const preview = document.querySelector("#lock-preview");
const privacyLevel = document.querySelector("#privacy-level");
const stalePreview = document.querySelector("#stale-preview");
const privacyState = document.querySelector("#privacy-state");
const confirmDetailedPrivacy = document.querySelector("#confirm-detailed-privacy");
const savePrivacy = document.querySelector("#save-privacy");
const privacySaveStatus = document.querySelector("#privacy-save-status");
const safetyTopic = document.querySelector("#safety-topic");
const immediateDanger = document.querySelector("#immediate-danger");
const showSafetyGuidance = document.querySelector("#show-safety-guidance");
const safetyGuidance = document.querySelector("#safety-guidance");
const doneMessage = document.querySelector("#done-message");
const suggestionToggle = document.querySelector("#suggestion-toggle");
const suggestionStatus = document.querySelector("#suggestion-status");
const starterPurpose = document.querySelector("#starter-purpose");
const starterRole = document.querySelector("#starter-role");
const starterLanguage = document.querySelector("#starter-language");
const starterTimeZone = document.querySelector("#starter-timezone");
const setupStatus = document.querySelector("#setup-status");
const saveStatus = document.querySelector("#save-status");
const legacyCard = document.querySelector("#legacy-card");
const legacySummary = document.querySelector("#legacy-summary");
const legacyGoals = document.querySelector("#legacy-goals");
const legacyStatus = document.querySelector("#legacy-status");
const importLegacy = document.querySelector("#import-legacy");
const rollbackLegacy = document.querySelector("#rollback-legacy");
const exportLifePanel = document.querySelector("#export-lifepanel");
const chooseLifePanelRestore = document.querySelector("#choose-lifepanel-restore");
const lifePanelRestoreFile = document.querySelector("#lifepanel-restore-file");
const transferStatus = document.querySelector("#transfer-status");
const releaseState = document.querySelector("#release-state");
const mobileReadiness = document.querySelector("#mobile-readiness");
const desktopReadiness = document.querySelector("#desktop-readiness");
const desktopShortcuts = document.querySelector("#desktop-shortcuts");
const dismissedMoveIds = new Set();
const profileStorageKey = "lifepanel.alpha.profile";
const moveChoiceStorageKey = "lifepanel.alpha.move-choices.v1";
let sourceUpdatedAt = new Date().toISOString();
let suggestionsEnabled = localStorage.getItem("lifepanel.alpha.suggestions") !== "off";
let selectedScenarioFirstActionId = "work-write-one-line";
let freeContentUI;
const purposeCopy = {
  balance: { title: "오늘은 삶의 균형을 가볍게 되찾습니다.", label: "직접 고른 균형 목적" },
  focus: { title: "오늘은 가장 중요한 한 가지에 집중합니다.", label: "직접 고른 집중 목적" },
  recovery: { title: "오늘은 회복을 먼저 챙깁니다.", label: "직접 고른 회복 목적" },
  connection: { title: "오늘은 중요한 관계를 한 걸음 돌봅니다.", label: "직접 고른 관계 목적" },
};

function defaultProfile() {
  return createStarterProfile({
    purposeId: "balance",
    roleId: "self",
    language: "ko-KR",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
}

function readStoredProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem(profileStorageKey) || "null");
    return stored ? createStarterProfile(stored) : defaultProfile();
  } catch {
    return defaultProfile();
  }
}

function renderSaveStatus() {
  const stored = readJson(profileStorageKey);
  const savedAt = new Date(stored?.updatedAt);
  if (!stored || Number.isNaN(savedAt.getTime())) {
    saveStatus.textContent = "아직 저장한 설정이 없습니다. 기본 설정은 지금 열린 화면에서만 보여 드립니다.";
    return;
  }
  const label = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(savedAt);
  saveStatus.textContent = `마지막 설정 저장: ${label} · 이 기기 안에만 저장됩니다.`;
}

function readJson(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function readMoveChoiceHistory() {
  const records = readJson(moveChoiceStorageKey);
  if (!Array.isArray(records)) return [];
  return records.filter((record) => (
    record
    && record.version === MOVE_CHOICE_VERSION
    && typeof record.moveId === "string"
    && record.penalty === 0
    && record.judgement === "none"
  ));
}

let moveChoiceHistory = readMoveChoiceHistory();
const latestMoveChoiceById = new Map();
for (const record of moveChoiceHistory) latestMoveChoiceById.set(record.moveId, record);
const adjustedMoveById = new Map();
function rebuildMoveChoiceState() {
  latestMoveChoiceById.clear();
  adjustedMoveById.clear();
  dismissedMoveIds.clear();
  for (const record of moveChoiceHistory) latestMoveChoiceById.set(record.moveId, record);
  for (const [moveId, record] of latestMoveChoiceById) {
    if (record.choice === "shrink" && record.adjustedMove?.id === moveId) {
      adjustedMoveById.set(moveId, record.adjustedMove);
    } else {
      dismissedMoveIds.add(moveId);
    }
  }
}
rebuildMoveChoiceState();

function saveMoveChoice(record) {
  moveChoiceHistory = [...moveChoiceHistory, record].slice(-50);
  localStorage.setItem(moveChoiceStorageKey, JSON.stringify(moveChoiceHistory));
}

let legacySourceState = readJson(LEGACY_WEDOIT_STORAGE_KEY);

function readLegacyContinuity() {
  const imported = readSavedLegacyContinuity(localStorage);
  if (imported) return { state: imported, mode: "imported" };
  const preview = createLegacyContinuity(legacySourceState);
  return preview ? { state: preview, mode: "available" } : { state: null, mode: "none" };
}

let profile = readStoredProfile();
const savedPrivacy = readLockPrivacyPreference(localStorage);
privacyLevel.value = savedPrivacy.level;
let latestCheckIn = createCheckIn({ energy: 3, load: 3, mood: "steady" });
let legacyContinuity = readLegacyContinuity();

function legacyMoves() {
  if (legacyContinuity.mode !== "imported") return [];
  return legacyContinuity.state.goals
    .filter((goal) => goal.status === "active")
    .map((goal) => createMove({
      domainId: goal.domainId,
      title: goal.name,
      minutes: goal.metric === "minutes" ? Math.max(1, Math.min(5, Math.floor(goal.target || 3))) : 3,
      energyCost: 2,
      reason: `기존 WeDoIt 목표 “${goal.name}”을(를) LifePanel의 다음 행동으로 이어 봅니다.`,
    }));
}

function currentMoves() {
  const sourceMoves = [...moves, ...legacyMoves()].map((move) => adjustedMoveById.get(move.id) || move);
  const generated = generateNextMoves({
    moves: sourceMoves,
    checkIn: latestCheckIn,
    directionDomainIds: directionDomains[profile.purposeId],
    boundaries,
    limit: 3,
  })
    .filter((move) => !dismissedMoveIds.has(move.id));
  const preferredSource = sourceMoves.find((move) => move.catalogId === selectedScenarioFirstActionId && !dismissedMoveIds.has(move.id));
  const [preferred] = preferredSource ? generateNextMoves({
    moves: [preferredSource],
    checkIn: latestCheckIn,
    directionDomainIds: directionDomains[profile.purposeId],
    boundaries,
    limit: 1,
  }) : [];
  return [preferred, ...generated].filter((move, index, rows) => move && rows.findIndex((row) => row?.id === move.id) === index).slice(0, 3);
}

function renderLegacyContinuity() {
  const { state, mode } = legacyContinuity;
  legacyCard.hidden = !state;
  if (!state) return;
  const visibleGoals = mode === "imported" ? state.goals : state.goals;
  const copiedLabel = mode === "imported" ? ` · 선택 사본 ${state.copiedGoalCount ?? state.goals.length}개` : "";
  legacySummary.textContent = `기존 WeDoIt 목표 ${state.sourceGoalCount}개와 기록 ${state.sourceEventCount}개를 찾았습니다${copiedLabel}. 원본은 그대로 둡니다.`;
  legacyGoals.replaceChildren();
  for (const goal of visibleGoals) {
    const item = document.createElement("li");
    const label = document.createElement("label");
    const include = document.createElement("input");
    include.type = "checkbox";
    include.checked = true;
    include.disabled = mode === "imported";
    include.dataset.legacyGoalId = goal.legacyGoalId;
    const title = document.createElement("strong");
    title.textContent = goal.name;
    const detail = document.createElement("span");
    detail.textContent = `기존 기록 ${goal.recordCount}건 · ${goal.domainId} 영역 대응${goal.status === "active" ? " · 다음 행동 후보" : " · 일시정지 유지"}`;
    label.append(include, title);
    item.append(label, detail);
    legacyGoals.append(item);
  }
  importLegacy.disabled = mode === "imported";
  importLegacy.textContent = mode === "imported" ? "선택한 목표 사본 사용 중" : "선택한 목표 사본 만들기";
  rollbackLegacy.hidden = mode !== "imported";
  legacyStatus.textContent = mode === "imported"
    ? "기존 자료의 사본을 LifePanel에 저장했습니다. 원본 WeDoIt 자료는 바꾸지 않았습니다."
    : "대응 영역을 확인하고 제외할 목표의 선택을 끈 뒤, 새 LifePanel 사본을 만드세요.";
}

function renderTodayContext() {
  focusTitle.textContent = purposeCopy[profile.purposeId].title;
  if (latestCheckIn.energy <= 2 || latestCheckIn.load >= 4 || latestCheckIn.mood === "drained") {
    signalTitle.textContent = "에너지가 낮아도 괜찮아요";
    signalDetail.textContent = "5분 이내의 작은 행동만 먼저 보여 드립니다. 쉬는 것을 선택해도 됩니다.";
  } else if (latestCheckIn.energy >= 4 && latestCheckIn.load <= 3) {
    signalTitle.textContent = "움직일 여지가 있어요";
    signalDetail.textContent = "지금 목적에 맞는 한 행동을 고르고, 더 할지는 끝난 뒤 다시 정합니다.";
  } else {
    signalTitle.textContent = "잠깐 멈춰도 괜찮아요";
    signalDetail.textContent = "지금 할 수 있는 만큼만 고릅니다. 다음 행동 뒤에 계속할지 다시 정할 수 있습니다.";
  }
}

function renderConnectionStatus() {
  const online = navigator.onLine;
  connectionStatus.textContent = online
    ? "인터넷 연결됨 · 오늘 패널의 오프라인 사본을 준비합니다."
    : "인터넷이 끊겼습니다 · 마지막으로 준비된 오늘 패널을 계속 보여 드립니다.";
}

function prepareOfflineCopy() {
  renderConnectionStatus();
  window.addEventListener("online", renderConnectionStatus);
  window.addEventListener("offline", renderConnectionStatus);
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./service-worker.js").then(() => {
    if (navigator.onLine) {
      connectionStatus.textContent = "인터넷 연결됨 · 오늘 패널의 오프라인 사본이 준비되었습니다.";
    }
  }).catch(() => {
    connectionStatus.textContent = "오프라인 사본을 준비하지 못했습니다. 현재 열린 화면은 계속 사용할 수 있습니다.";
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    releaseState.textContent = "새 LifePanel 판이 준비되었습니다 · 현재 저장된 자료는 그대로입니다.";
    refreshDesktopReadiness();
  });
}

skipLink.addEventListener("click", (event) => {
  event.preventDefault();
  mainContent.focus({ preventScroll: true });
  mainContent.scrollIntoView({ block: "start" });
  window.history.replaceState(null, "", "#main-content");
});

function renderLock(move = currentMoves()[0]) {
  const privacy = privacyLevel.value;
  const payload = createLockScreenPayload({ move, privacy, isStale: stalePreview.checked });
  preview.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = payload.title;
  const body = document.createElement("span");
  body.textContent = payload.body;
  preview.append(title, body);
  const labels = { obscured: "숨김", general: "일반", detailed: "상세" };
  privacyState.textContent = `잠금 화면: ${payload.privacy === "obscured" && stalePreview.checked ? "오래되어 숨김" : labels[payload.privacy]}`;
  privacySaveStatus.textContent = privacy === savedPrivacy.level
    ? `저장된 공개 수준: ${labels[savedPrivacy.level]} · 이 기기 안에서만 사용합니다.`
    : "저장하지 않은 변경은 미리보기에만 적용됩니다.";
}

function renderSafetyGuidance() {
  const guidance = createSensitiveSupportGuidance({
    topic: safetyTopic.value,
    isImmediateDanger: immediateDanger.checked,
  });
  safetyGuidance.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = guidance.title;
  const message = document.createElement("p");
  message.textContent = guidance.message;
  const next = document.createElement("p");
  next.textContent = `다음 행동: ${guidance.nextAction}`;
  const privacy = document.createElement("p");
  privacy.textContent = guidance.privacy;
  safetyGuidance.append(title, message, next, privacy);
}

function renderMoves() {
  const suggestions = currentMoves();
  moveList.replaceChildren();
  suggestionToggle.textContent = suggestionsEnabled ? "추천 끄기" : "추천 다시 켜기";
  suggestionToggle.setAttribute("aria-pressed", String(!suggestionsEnabled));
  if (!suggestionsEnabled) {
    const disabledCard = createSuggestionCard({ suggestionsEnabled: false });
    suggestionStatus.textContent = disabledCard.message;
    renderLock(undefined);
    return;
  }
  suggestionStatus.textContent = suggestions.length
    ? "추천마다 이유·사용한 자료·갱신 시각을 확인하거나, 하나씩 숨길 수 있습니다."
    : "지금 추천을 모두 숨겼습니다. ‘다시 고르기’를 누르면 되돌아옵니다.";
  for (const move of suggestions) {
    const card = createSuggestionCard({
      move,
      sourceLabel: `에너지 ${latestCheckIn.energy}·부담 ${latestCheckIn.load}·기분 ${mood.options[mood.selectedIndex].text}, ${purposeCopy[profile.purposeId].label}`,
      sourceUpdatedAt,
      uncertainty: "현재 직접 입력한 상태만 사용하므로 실제 시간·환경과 다를 수 있습니다.",
      alternative: move.alternative || "이 행동을 더 작게 줄이거나, 미루기·휴식·도움 요청을 선택할 수 있습니다.",
      suggestionsEnabled,
    });
    const item = document.createElement("li");
    item.className = "move-item";
    const text = document.createElement("div");
    text.className = "move-text";
    const name = document.createElement("strong");
    name.textContent = card.title;
    const duration = document.createElement("small");
    duration.textContent = `${card.minutes}분`;
    const explanation = document.createElement("details");
    explanation.className = "suggestion-explanation";
    const explanationTitle = document.createElement("summary");
    explanationTitle.textContent = "왜 이 행동인가";
    const reason = document.createElement("p");
    reason.textContent = card.explanation;
    const source = document.createElement("p");
    source.className = "suggestion-source";
    source.textContent = `사용한 자료: ${card.sourceLabel} · 갱신 ${new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(card.sourceUpdatedAt))}`;
    const uncertainty = document.createElement("p");
    uncertainty.textContent = `불확실성: ${card.uncertainty}`;
    const alternative = document.createElement("p");
    alternative.textContent = `대안: ${card.alternative}`;
    explanation.append(explanationTitle, reason, source, uncertainty, alternative);
    text.append(name, duration, explanation);
    const actions = document.createElement("div");
    actions.className = "move-actions";
    const choiceLabel = document.createElement("label");
    choiceLabel.className = "move-choice";
    const choiceTitle = document.createElement("span");
    choiceTitle.textContent = "이 행동 선택";
    const choiceSelect = document.createElement("select");
    choiceSelect.setAttribute("aria-label", `${card.title} 선택`);
    for (const [value, label] of [
      ["complete", "완료"],
      ["shrink", "더 작게"],
      ["defer", "미루기"],
      ["rest", "휴식"],
      ["ask-help", "도움 요청"],
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      choiceSelect.append(option);
    }
    choiceLabel.append(choiceTitle, choiceSelect);
    const applyChoice = document.createElement("button");
    applyChoice.className = "move-button";
    applyChoice.type = "button";
    applyChoice.textContent = "선택 적용";
    applyChoice.addEventListener("click", () => {
      const record = recordMoveChoice({ move, choice: choiceSelect.value });
      let saved = true;
      try {
        saveMoveChoice(record);
      } catch {
        saved = false;
      }
      if (record.adjustedMove) {
        adjustedMoveById.set(record.moveId, record.adjustedMove);
      } else {
        dismissedMoveIds.add(record.moveId);
      }
      doneMessage.textContent = `${record.message} ${saved ? "이 선택은 기기 안에만 기록했습니다." : "선택은 반영했지만 기기 안 기록은 저장하지 못했습니다."}`;
      freeContentUI?.showReflection({ moveTitle: move.title, choice: record.choice });
      renderMoves();
    });
    const dismissButton = document.createElement("button");
    dismissButton.className = "dismiss-button";
    dismissButton.type = "button";
    dismissButton.textContent = "이 추천 숨기기";
    dismissButton.addEventListener("click", () => {
      dismissedMoveIds.add(card.moveId);
      doneMessage.textContent = `“${card.title}” 추천을 숨겼습니다.`;
      renderMoves();
    });
    actions.append(choiceLabel, applyChoice, dismissButton);
    item.append(text, actions);
    moveList.append(item);
  }
  renderLock(suggestions[0]);
}

applyCheckIn.addEventListener("click", () => {
  latestCheckIn = createCheckIn({ energy: Number(energy.value), load: Number(load.value), mood: mood.value });
  dismissedMoveIds.clear();
  sourceUpdatedAt = new Date().toISOString();
  checkInStatus.textContent = `에너지 ${latestCheckIn.energy}·부담 ${latestCheckIn.load}·기분 ${mood.options[mood.selectedIndex].text}을 반영했습니다.`;
  renderTodayContext();
  renderMoves();
});
privacyLevel.addEventListener("change", () => {
  if (privacyLevel.value !== "detailed") confirmDetailedPrivacy.checked = false;
  renderLock();
});
stalePreview.addEventListener("change", () => renderLock());
savePrivacy.addEventListener("click", () => {
  try {
    const preference = createLockPrivacyPreference({
      level: privacyLevel.value,
      confirmedDetailed: confirmDetailedPrivacy.checked,
    });
    Object.assign(savedPrivacy, saveLockPrivacyPreference(localStorage, preference));
    renderLock();
  } catch {
    privacySaveStatus.textContent = "상세 제목 노출을 확인해야 저장할 수 있습니다. 기존 저장값은 바뀌지 않았습니다.";
  }
});
showSafetyGuidance.addEventListener("click", renderSafetyGuidance);
suggestionToggle.addEventListener("click", () => {
  suggestionsEnabled = !suggestionsEnabled;
  localStorage.setItem("lifepanel.alpha.suggestions", suggestionsEnabled ? "on" : "off");
  doneMessage.textContent = suggestionsEnabled ? "추천을 다시 켰습니다." : "추천을 껐습니다. 직접 고른 내용은 바뀌지 않습니다.";
  renderMoves();
});
document.querySelector("#refresh-moves").addEventListener("click", () => {
  dismissedMoveIds.clear();
  sourceUpdatedAt = new Date().toISOString();
  doneMessage.textContent = "지금 에너지에 맞춰 다음 행동을 다시 골랐습니다.";
  renderMoves();
});

const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
for (const timeZone of [...new Set([deviceTimeZone, "UTC", "Asia/Seoul", "Asia/Bangkok", "America/Los_Angeles"])]) {
  const option = document.createElement("option");
  option.value = timeZone;
  option.textContent = timeZone === deviceTimeZone ? `${timeZone} · 이 기기` : timeZone;
  starterTimeZone.append(option);
}
starterPurpose.value = profile.purposeId;
starterRole.value = profile.roleId;
starterLanguage.value = profile.language;
starterTimeZone.value = profile.timeZone;
if (starterTimeZone.value !== profile.timeZone) {
  const option = document.createElement("option");
  option.value = profile.timeZone;
  option.textContent = profile.timeZone;
  starterTimeZone.append(option);
  starterTimeZone.value = profile.timeZone;
}

document.querySelector("#save-profile").addEventListener("click", () => {
  profile = createStarterProfile({
    purposeId: starterPurpose.value,
    roleId: starterRole.value,
    language: starterLanguage.value,
    timeZone: starterTimeZone.value,
  });
  localStorage.setItem(profileStorageKey, JSON.stringify(profile));
  sourceUpdatedAt = new Date().toISOString();
  dismissedMoveIds.clear();
  const languageLabel = starterLanguage.options[starterLanguage.selectedIndex].textContent;
  setupStatus.textContent = `${languageLabel} · ${profile.timeZone} 설정을 기기 안에 저장했습니다.`;
  renderSaveStatus();
  renderTodayContext();
  renderMoves();
});

importLegacy.addEventListener("click", () => {
  if (!legacyContinuity.state || legacyContinuity.mode === "imported") return;
  try {
    const controls = [...legacyGoals.querySelectorAll("input[data-legacy-goal-id]")];
    const excludedGoalIds = controls.filter((control) => !control.checked).map((control) => control.dataset.legacyGoalId);
    const mappingPreview = createLegacyMappingPreview(legacySourceState, { excludedGoalIds });
    if (!mappingPreview || mappingPreview.includedGoalCount < 1) {
      legacyStatus.textContent = "최소 한 개 목표를 선택해야 사본을 만들 수 있습니다. 원본은 바뀌지 않았습니다.";
      return;
    }
    const selectedCopy = createSelectedLegacyContinuity(legacySourceState, { excludedGoalIds });
    const savedCopy = saveLegacyContinuityCopy(localStorage, selectedCopy);
    if (!savedCopy) throw new TypeError("legacy continuity copy did not save");
    legacyContinuity = { state: savedCopy, mode: "imported" };
    if (!localStorage.getItem(profileStorageKey)) {
      profile = createStarterProfile({
        ...profile,
        purposeId: legacyContinuity.state.recommendedPurposeId,
      });
      localStorage.setItem(profileStorageKey, JSON.stringify(profile));
      starterPurpose.value = profile.purposeId;
      renderSaveStatus();
    }
    setupStatus.textContent = "기존 목표를 새 LifePanel 흐름에 이어 붙였습니다. 직접 고른 설정은 언제든 바꿀 수 있습니다.";
    doneMessage.textContent = "기존 WeDoIt 자료의 사본을 만들었습니다. 원본 기록은 바꾸지 않았습니다.";
    renderLegacyContinuity();
    renderTodayContext();
    renderMoves();
  } catch {
    legacyStatus.textContent = "기존 자료 사본을 저장하지 못했습니다. 원본 WeDoIt 자료는 그대로 남아 있습니다.";
  }
});

rollbackLegacy.addEventListener("click", () => {
  try {
    const result = rollbackLegacyContinuityCopy(localStorage);
    legacyContinuity = readLegacyContinuity();
    if (!localStorage.getItem(profileStorageKey)) {
      profile = readStoredProfile();
      starterPurpose.value = profile.purposeId;
    }
    legacyStatus.textContent = result.status === "restored-previous-copy"
      ? "직전 LifePanel 사본으로 되돌렸습니다. WeDoIt 원본은 바뀌지 않았습니다."
      : "LifePanel 사본을 제거했습니다. WeDoIt 원본은 그대로 남아 있습니다.";
    doneMessage.textContent = "가져온 사본을 되돌렸습니다. 기존 원본의 개수·값·시각은 건드리지 않았습니다.";
    renderLegacyContinuity();
    renderTodayContext();
    renderMoves();
  } catch {
    legacyStatus.textContent = "사본을 되돌리지 못했습니다. 현재 사본과 WeDoIt 원본은 그대로 남아 있습니다.";
  }
});

exportLifePanel.addEventListener("click", async () => {
  try {
    const bundle = await createLifePanelTransferBundle({
      profile: readJson(profileStorageKey),
      legacyContinuity: readSavedLegacyContinuity(localStorage),
      moveChoices: readMoveChoiceHistory(),
      privacyPreference: readLockPrivacyPreference(localStorage),
    });
    const blob = new Blob([`${JSON.stringify(bundle, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lifepanel-${bundle.version}-${bundle.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    try {
      localStorage.setItem(LIFEPANEL_LAST_EXPORT_KEY, JSON.stringify({ exportedAt: bundle.exportedAt, version: bundle.version, sha256Prefix: bundle.payloadSha256.slice(0, 12) }));
    } catch { /* download remains valid even when status storage is unavailable */ }
    window.dispatchEvent(new CustomEvent("lifepanel:backup-created"));
    transferStatus.textContent = `${bundle.version} 사본을 만들었습니다. SHA-256 ${bundle.payloadSha256.slice(0, 12)}…`;
  } catch {
    transferStatus.textContent = "사본을 만들지 못했습니다. 기기 안의 기존 자료는 바뀌지 않았습니다.";
  }
});

chooseLifePanelRestore.addEventListener("click", () => lifePanelRestoreFile.click());
lifePanelRestoreFile.addEventListener("change", async () => {
  const [file] = lifePanelRestoreFile.files;
  if (!file) return;
  try {
    const bundle = JSON.parse(await file.text());
    const result = await restoreLifePanelTransferBundle(localStorage, bundle);
    if (result.status === "duplicate") {
      transferStatus.textContent = "이미 복원한 같은 SHA-256 사본입니다. 중복으로 쓰지 않았습니다.";
      return;
    }
    profile = readStoredProfile();
    starterPurpose.value = profile.purposeId;
    starterRole.value = profile.roleId;
    starterLanguage.value = profile.language;
    starterTimeZone.value = profile.timeZone;
    legacySourceState = readJson(LEGACY_WEDOIT_STORAGE_KEY);
    legacyContinuity = readLegacyContinuity();
    moveChoiceHistory = readMoveChoiceHistory();
    Object.assign(savedPrivacy, readLockPrivacyPreference(localStorage));
    privacyLevel.value = savedPrivacy.level;
    confirmDetailedPrivacy.checked = false;
    rebuildMoveChoiceState();
    transferStatus.textContent = `판번호와 SHA-256을 확인하고 ${result.writes}개 LifePanel 영역을 복원했습니다.`;
    renderSaveStatus();
    renderLegacyContinuity();
    renderTodayContext();
    renderMoves();
  } catch (error) {
    const reason = /stale|version/i.test(error?.message) ? "지원하지 않는 낡은 판입니다." : "손상되었거나 형식이 맞지 않는 사본입니다.";
    transferStatus.textContent = `${reason} 기존 LifePanel 자료는 바꾸지 않았습니다.`;
  } finally {
    lifePanelRestoreFile.value = "";
  }
});

function focusPanel(selector) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  const heading = target.querySelector("h2");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

function refreshDesktopReadiness() {
  const savedProfile = Boolean(readJson(profileStorageKey));
  const privacyReady = Boolean(readLockPrivacyPreference(localStorage));
  const offlineReady = "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller);
  const storageLabel = savedProfile && privacyReady ? "설정·보호 저장 준비" : "기본값 사용 중 · 저장 전에도 계속 사용할 수 있음";
  const offlineLabel = offlineReady ? "오프라인 사본 제어 중" : "오프라인 사본 준비 중";
  desktopReadiness.textContent = `${storageLabel} · ${offlineLabel} · 복구는 사용자가 고른 JSON 사본만 적용합니다.`;
  releaseState.textContent = `LifePanel v1.0 공개판 · ${offlineLabel} · 광고는 동의·운영 설정 전 외부 요청 없음`;
}

function refreshMobileReadiness() {
  const width = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
  const height = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);
  const orientation = width > height ? "가로" : "세로";
  const compact = width <= 640 ? "작은 화면 한 손 배치" : "넓은 모바일·태블릿 배치";
  const offlineLabel = "serviceWorker" in navigator && navigator.serviceWorker.controller ? "오프라인 사본 제어 중" : "오프라인 사본 준비 중";
  mobileReadiness.textContent = `${compact} · ${orientation} ${width}×${height}px · ${offlineLabel} · 자료 복구는 사용자가 고른 JSON 사본만 적용합니다.`;
  releaseState.textContent = `LifePanel v1.0 공개판 · ${offlineLabel} · 광고는 동의·운영 설정 전 외부 요청 없음`;
}

function isEditableTarget(target) {
  return target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
}

document.querySelector("#desktop-jump-now").addEventListener("click", () => focusPanel("#now-surface"));
document.querySelector("#desktop-jump-weekly").addEventListener("click", () => focusPanel("#weekly-surface"));
document.querySelector("#desktop-open-transfer").addEventListener("click", () => focusPanel("#transfer-card"));
document.querySelector("#desktop-export").addEventListener("click", () => exportLifePanel.click());
document.querySelector("#data-export-lifepanel").addEventListener("click", () => exportLifePanel.click());
document.querySelector("#desktop-readiness-check").addEventListener("click", refreshDesktopReadiness);
document.querySelector("#desktop-open-shortcuts").addEventListener("click", () => desktopShortcuts.showModal());
document.querySelector("#desktop-close-shortcuts").addEventListener("click", () => desktopShortcuts.close());
document.querySelector("#mobile-jump-now").addEventListener("click", () => focusPanel("#now-surface"));
document.querySelector("#mobile-open-transfer").addEventListener("click", () => focusPanel("#transfer-card"));
document.querySelector("#mobile-open-session").addEventListener("click", () => focusPanel("#session-title"));
document.querySelector("#mobile-readiness-check").addEventListener("click", refreshMobileReadiness);
window.addEventListener("resize", refreshMobileReadiness);
window.addEventListener("orientationchange", refreshMobileReadiness);
document.addEventListener("keydown", (event) => {
  if (isEditableTarget(event.target)) return;
  const shortcuts = { "1": "#now-surface", "2": "#weekly-surface", "3": "#transfer-card" };
  if (event.altKey && shortcuts[event.key]) {
    event.preventDefault();
    focusPanel(shortcuts[event.key]);
    return;
  }
  if (event.key === "?" && !event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    desktopShortcuts.showModal();
  }
});

renderTodayContext();
renderSaveStatus();
renderLegacyContinuity();
renderMoves();
renderSafetyGuidance();
prepareOfflineCopy();
initWorkflowPanels();
initAdvancedUI();
initPlusUI();
freeContentUI = initFreeContentUI({
  onScenarioSelect(scenario, { initial = false } = {}) {
    selectedScenarioFirstActionId = scenario.firstActionId;
    profile = createStarterProfile({ ...profile, purposeId: scenario.purposeId });
    starterPurpose.value = profile.purposeId;
    dismissedMoveIds.clear();
    sourceUpdatedAt = new Date().toISOString();
    renderTodayContext();
    renderMoves();
    if (!initial) focusPanel("#move-title");
  },
  onReset() {
    doneMessage.textContent = "LifePanel 전용 자료를 지웠습니다. 기존 WeDoIt 원본은 유지했습니다. 화면을 새 상태로 다시 엽니다.";
    window.setTimeout(() => window.location.reload(), 700);
  },
});
refreshDesktopReadiness();
refreshMobileReadiness();
