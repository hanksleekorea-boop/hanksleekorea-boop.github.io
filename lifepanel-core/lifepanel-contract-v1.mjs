export const LIFEPANEL_CONTRACT_VERSION = "lifepanel.contract.v1";
export const LEGACY_WEDOIT_STORAGE_KEY = "wedoit.app.v6";
export const LIFEPANEL_LEGACY_IMPORT_VERSION = "lifepanel.legacy-import.v1";
export const LIFEPANEL_LEGACY_IMPORT_STORAGE_KEY = "lifepanel.alpha.legacy-import.v1";
export const LIFEPANEL_LEGACY_ROLLBACK_VERSION = "lifepanel.legacy-rollback.v1";
export const LIFEPANEL_LEGACY_ROLLBACK_STORAGE_KEY = "lifepanel.alpha.legacy-import.rollback.v1";

export const LIFEPANEL_DOMAINS = Object.freeze([
  { id: "health", label: "건강" },
  { id: "relationships", label: "관계" },
  { id: "work", label: "일" },
  { id: "learning", label: "배움" },
  { id: "money", label: "돈" },
  { id: "home", label: "집" },
  { id: "creation", label: "창작" },
  { id: "recovery", label: "회복" },
]);

export const LOCK_PRIVACY_LEVELS = Object.freeze(["obscured", "general", "detailed"]);
export const LOCK_PRIVACY_DEFAULT = "obscured";
export const LOCK_PRIVACY_STORAGE_KEY = "lifepanel.alpha.lock-privacy.v1";
export const SENSITIVE_SUPPORT_TOPICS = Object.freeze(["crisis", "medical", "financial"]);
export const ACTIVE_SESSION_KINDS = Object.freeze(["focus", "rest", "routine"]);
export const SUGGESTION_VISIBILITY = Object.freeze(["visible", "disabled"]);
export const STARTER_PURPOSES = Object.freeze(["balance", "focus", "recovery", "connection"]);
export const STARTER_ROLES = Object.freeze(["self", "caregiver", "learner", "maker"]);
export const STARTER_LANGUAGES = Object.freeze(["ko-KR", "en-US"]);
export const BOUNDARY_KINDS = Object.freeze(["safety", "capacity", "privacy"]);
export const BOUNDARY_STATES = Object.freeze(["open", "guarded", "blocked"]);
export const CHECK_IN_MOODS = Object.freeze(["drained", "steady", "hopeful"]);
export const MOVE_CHOICE_KINDS = Object.freeze(["complete", "shrink", "defer", "rest", "ask-help"]);
export const MOVE_CHOICE_VERSION = "lifepanel.move-choice.v1";

const domainIds = new Set(LIFEPANEL_DOMAINS.map((domain) => domain.id));
const legacyAreaDomains = Object.freeze({
  health: "health",
  mind: "recovery",
  growth: "learning",
  work: "work",
  relationship: "relationships",
  finance: "money",
  life: "home",
  experience: "creation",
});
const legacyPurposeDomains = Object.freeze({
  relationships: "connection",
  work: "focus",
  learning: "focus",
  recovery: "recovery",
  health: "recovery",
  home: "balance",
  money: "balance",
  creation: "balance",
});

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeEnergy(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
    throw new RangeError("energy must be an integer from 1 to 5");
  }
  return numeric;
}

export function createEmptyLifePanel(nowIso = new Date().toISOString()) {
  return {
    version: LIFEPANEL_CONTRACT_VERSION,
    updatedAt: nowIso,
    domains: Object.fromEntries(
      LIFEPANEL_DOMAINS.map(({ id }) => [id, { direction: "", signals: [], moves: [] }]),
    ),
    boundaries: [],
    latestCheckIn: null,
    activeSession: null,
    privacy: { lockScreen: "obscured" },
  };
}

export function createStarterProfile({ purposeId, roleId, language, timeZone, updatedAt }) {
  if (!STARTER_PURPOSES.includes(purposeId)) throw new RangeError("invalid starter purpose");
  if (!STARTER_ROLES.includes(roleId)) throw new RangeError("invalid starter role");
  if (!STARTER_LANGUAGES.includes(language)) throw new RangeError("invalid starter language");
  try {
    new Intl.DateTimeFormat(language, { timeZone }).format(new Date());
  } catch {
    throw new RangeError("invalid starter time zone");
  }
  return {
    purposeId,
    roleId,
    language,
    timeZone,
    updatedAt: updatedAt || new Date().toISOString(),
  };
}

export function createSignal({ domainId, title, attention = "normal", detail = "", updatedAt }) {
  if (!domainIds.has(domainId)) throw new RangeError("unknown LifePanel domain");
  if (!["low", "normal", "high"].includes(attention)) throw new RangeError("invalid signal attention");
  return {
    id: `signal:${domainId}:${requireString(title, "title").toLowerCase().replace(/\s+/g, "-")}`,
    domainId,
    title: requireString(title, "title"),
    attention,
    detail: typeof detail === "string" ? detail.trim() : "",
    updatedAt: updatedAt || new Date().toISOString(),
  };
}

export function createBoundary({ id, kind, label, state = "guarded", note = "", updatedAt }) {
  if (!BOUNDARY_KINDS.includes(kind)) throw new RangeError("invalid boundary kind");
  if (!BOUNDARY_STATES.includes(state)) throw new RangeError("invalid boundary state");
  return {
    id: requireString(id, "boundary id"),
    kind,
    label: requireString(label, "boundary label"),
    state,
    note: typeof note === "string" ? note.trim() : "",
    updatedAt: updatedAt || new Date().toISOString(),
  };
}

export function createCheckIn({ energy, load, mood, checkedAt }) {
  const normalizedLoad = normalizeEnergy(load);
  if (!CHECK_IN_MOODS.includes(mood)) throw new RangeError("invalid check-in mood");
  return {
    energy: normalizeEnergy(energy),
    load: normalizedLoad,
    mood,
    checkedAt: checkedAt || new Date().toISOString(),
  };
}

export function createMove({ domainId, title, minutes = 3, reason = "", when = "now", energyCost = 2, boundaryIds = [] }) {
  if (!domainIds.has(domainId)) throw new RangeError("unknown LifePanel domain");
  const duration = Number(minutes);
  if (!Number.isInteger(duration) || duration < 1 || duration > 120) {
    throw new RangeError("minutes must be an integer from 1 to 120");
  }
  const normalizedEnergyCost = normalizeEnergy(energyCost);
  if (!Array.isArray(boundaryIds) || boundaryIds.some((id) => typeof id !== "string" || id.trim() === "")) {
    throw new TypeError("boundary ids must be non-empty strings");
  }
  return {
    id: `move:${domainId}:${requireString(title, "title").toLowerCase().replace(/\s+/g, "-")}`,
    domainId,
    title: requireString(title, "title"),
    minutes: duration,
    reason: typeof reason === "string" ? reason.trim() : "",
    when: requireString(when, "when"),
    energyCost: normalizedEnergyCost,
    boundaryIds: Object.freeze(boundaryIds.map((id) => id.trim())),
  };
}

export function recordMoveChoice({ move, choice, chosenAt, note = "" }) {
  if (!move || typeof move.id !== "string" || typeof move.title !== "string") {
    throw new TypeError("move choice requires a valid move");
  }
  const moveMinutes = Number(move.minutes);
  if (!Number.isInteger(moveMinutes) || moveMinutes < 1 || moveMinutes > 120) {
    throw new TypeError("move choice requires valid move minutes");
  }
  if (!MOVE_CHOICE_KINDS.includes(choice)) throw new RangeError("invalid move choice");
  const selectedAt = new Date(chosenAt || new Date().toISOString());
  if (Number.isNaN(selectedAt.getTime())) throw new TypeError("move choice time must be a valid date");
  const reducedMinutes = choice === "shrink" ? Math.max(1, Math.ceil(moveMinutes / 2)) : null;
  const messages = {
    complete: `“${move.title}”을(를) 완료로 기록했습니다. 점수나 벌점은 없습니다.`,
    shrink: `“${move.title}”을(를) ${reducedMinutes}분으로 줄였습니다.`,
    defer: `“${move.title}”을(를) 미뤘습니다. 벌점 없이 나중에 다시 고를 수 있습니다.`,
    rest: "휴식을 선택했습니다. 벌점 없이 쉬어도 됩니다.",
    "ask-help": "도움 요청을 선택했습니다. 누구에게 요청할지는 직접 고르며 자동으로 전송하지 않습니다.",
  };
  return {
    version: MOVE_CHOICE_VERSION,
    moveId: move.id,
    choice,
    chosenAt: selectedAt.toISOString(),
    penalty: 0,
    judgement: "none",
    note: typeof note === "string" ? note.trim() : "",
    adjustedMove: choice === "shrink" ? { ...move, minutes: reducedMinutes } : null,
    message: messages[choice],
  };
}

export function createActiveSession({ kind, title, startedByUser = false, startedAt, endsAt = null }) {
  if (!ACTIVE_SESSION_KINDS.includes(kind)) throw new RangeError("invalid active session kind");
  if (startedByUser !== true) throw new TypeError("active sessions must be started by the user");
  return {
    kind,
    title: requireString(title, "title"),
    startedByUser,
    startedAt: startedAt || new Date().toISOString(),
    endsAt,
  };
}

export function suggestNextMoves({ moves = [], energy = 3, limit = 3 }) {
  const normalizedEnergy = normalizeEnergy(energy);
  const normalizedLimit = Math.max(1, Math.min(3, Number.isInteger(limit) ? limit : 3));
  const ordered = [...moves].sort((left, right) => left.minutes - right.minutes || left.title.localeCompare(right.title));
  const suitable = normalizedEnergy <= 2 ? ordered.filter((move) => move.minutes <= 5) : ordered;
  return (suitable.length ? suitable : ordered).slice(0, normalizedLimit).map((move) => ({
    ...move,
    explanation: move.reason || (normalizedEnergy <= 2 ? "에너지가 낮아 작은 행동부터 제안합니다." : "지금 끝낼 수 있는 다음 행동입니다."),
  }));
}

export function generateNextMoves({ moves = [], checkIn, directionDomainIds = [], boundaries = [], limit = 3 }) {
  const normalizedCheckIn = createCheckIn(checkIn);
  const normalizedLimit = Math.max(1, Math.min(3, Number.isInteger(limit) ? limit : 3));
  const activeBoundaries = new Map(boundaries.map((boundary) => [boundary.id, createBoundary(boundary)]));
  const allowed = moves.filter((move) => !move.boundaryIds?.some((id) => activeBoundaries.get(id)?.state === "blocked"));
  const lowEnergy = normalizedCheckIn.energy <= 2 || normalizedCheckIn.load >= 4 || normalizedCheckIn.mood === "drained";
  const capacitySafe = lowEnergy ? allowed.filter((move) => move.energyCost <= 2 && move.minutes <= 5) : allowed;
  const candidates = capacitySafe.length ? capacitySafe : allowed;
  const ordered = [...candidates].sort((left, right) => {
    const leftDirection = directionDomainIds.includes(left.domainId) ? 0 : 1;
    const rightDirection = directionDomainIds.includes(right.domainId) ? 0 : 1;
    const leftTime = left.when === "now" ? 0 : 1;
    const rightTime = right.when === "now" ? 0 : 1;
    const leftEnergy = lowEnergy && left.energyCost > 2 ? 1 : 0;
    const rightEnergy = lowEnergy && right.energyCost > 2 ? 1 : 0;
    return leftDirection - rightDirection || leftTime - rightTime || leftEnergy - rightEnergy || left.minutes - right.minutes || left.title.localeCompare(right.title);
  });
  return ordered.slice(0, normalizedLimit).map((move) => ({
    ...move,
    explanation: move.reason || "지금 상태와 직접 고른 방향을 기준으로 제안합니다.",
    decisionOrder: ["safety", "direction", "time", "energy"],
  }));
}

export function createSuggestionCard({ move, sourceLabel, sourceUpdatedAt, uncertainty, alternative, suggestionsEnabled = true }) {
  if (suggestionsEnabled !== true) {
    return {
      visibility: "disabled",
      message: "추천을 껐습니다. 필요할 때 다시 켤 수 있습니다.",
    };
  }
  if (!move || typeof move.title !== "string") throw new TypeError("suggestion move is required");
  const explanation = requireString(move.explanation || move.reason, "suggestion explanation");
  const normalizedSource = requireString(sourceLabel, "suggestion source label");
  const normalizedUncertainty = requireString(uncertainty, "suggestion uncertainty");
  const normalizedAlternative = requireString(alternative, "suggestion alternative");
  const updated = new Date(sourceUpdatedAt);
  if (!sourceUpdatedAt || Number.isNaN(updated.getTime())) {
    throw new TypeError("suggestion source updated time must be a valid date");
  }
  return {
    visibility: "visible",
    moveId: move.id,
    title: move.title,
    minutes: move.minutes,
    explanation,
    sourceLabel: normalizedSource,
    sourceUpdatedAt: updated.toISOString(),
    uncertainty: normalizedUncertainty,
    alternative: normalizedAlternative,
    controls: Object.freeze({ canStart: true, canDismiss: true, canDisable: true }),
  };
}

export function createLockScreenPayload({ move, privacy = "obscured", isStale = false }) {
  if (!LOCK_PRIVACY_LEVELS.includes(privacy)) throw new RangeError("invalid lock privacy level");
  if (!move || typeof move.title !== "string") return { title: "LifePanel", body: "지금의 한 걸음을 고르세요.", privacy: "obscured" };
  if (privacy === "obscured" || isStale) {
    return { title: "LifePanel", body: "지금의 한 걸음을 고르세요.", privacy: "obscured" };
  }
  if (privacy === "general") {
    const domainLabel = LIFEPANEL_DOMAINS.find((domain) => domain.id === move.domainId)?.label;
    return {
      title: "LifePanel",
      body: domainLabel ? `${domainLabel} · 다음 행동이 준비되었습니다.` : "다음 행동이 준비되었습니다.",
      privacy: "general",
    };
  }
  return { title: "LifePanel", body: move.title, privacy: "detailed" };
}

export function createLockPrivacyPreference({ level = LOCK_PRIVACY_DEFAULT, confirmedDetailed = false, updatedAt } = {}) {
  if (!LOCK_PRIVACY_LEVELS.includes(level)) throw new RangeError("invalid lock privacy level");
  if (level === "detailed" && confirmedDetailed !== true) {
    throw new TypeError("detailed lock privacy requires explicit confirmation");
  }
  const updated = new Date(updatedAt || new Date().toISOString());
  if (Number.isNaN(updated.getTime())) throw new TypeError("lock privacy update time must be valid");
  return {
    version: "lifepanel.lock-privacy.v1",
    level,
    confirmedDetailed: level === "detailed",
    updatedAt: updated.toISOString(),
  };
}

export function readLockPrivacyPreference(storage) {
  try {
    const raw = storage?.getItem?.(LOCK_PRIVACY_STORAGE_KEY);
    const value = raw ? JSON.parse(raw) : null;
    if (!value || value.version !== "lifepanel.lock-privacy.v1") return createLockPrivacyPreference();
    return createLockPrivacyPreference(value);
  } catch {
    return createLockPrivacyPreference();
  }
}

export function saveLockPrivacyPreference(storage, preference) {
  if (!storage || typeof storage.setItem !== "function") throw new TypeError("lock privacy storage must provide setItem");
  const normalized = createLockPrivacyPreference(preference);
  storage.setItem(LOCK_PRIVACY_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function createSensitiveSupportGuidance({ topic, isImmediateDanger = false } = {}) {
  if (!SENSITIVE_SUPPORT_TOPICS.includes(topic)) throw new RangeError("invalid sensitive support topic");
  if (typeof isImmediateDanger !== "boolean") throw new TypeError("immediate danger must be boolean");
  const shared = {
    topic,
    isImmediateDanger,
    privacy: "사용자가 직접 선택하기 전에는 어떤 내용도 외부로 보내거나 비밀 신고하지 않습니다.",
    prohibited: Object.freeze(["diagnosis", "trade-instruction", "secret-reporting"]),
  };
  if (isImmediateDanger) {
    return {
      ...shared,
      title: "지금 안전을 먼저 확인하세요",
      message: "즉시 위험하다면 지역 응급 서비스나 가까운 믿을 수 있는 사람에게 직접 연락하세요.",
      nextAction: "안전한 장소로 이동하고 직접 도움을 요청합니다.",
    };
  }
  const guidance = {
    crisis: {
      title: "혼자 견디지 않아도 됩니다",
      message: "LifePanel은 위기를 판단하거나 진단하지 않습니다. 믿을 수 있는 사람 또는 지역의 공식 도움 기관과 직접 연결하세요.",
      nextAction: "지금 연락할 사람이나 공식 도움 기관 한 곳을 직접 고릅니다.",
    },
    medical: {
      title: "의료 판단은 전문가와 확인하세요",
      message: "LifePanel은 증상을 진단하거나 치료를 지시하지 않습니다. 면허가 있는 의료 전문가 또는 공식 의료기관에 확인하세요.",
      nextAction: "증상과 발생 시각을 적고 의료 전문가에게 직접 문의합니다.",
    },
    financial: {
      title: "금융 결정은 확인 뒤 진행하세요",
      message: "LifePanel은 매수·매도·대출 실행을 지시하지 않습니다. 공식 자료와 자격 있는 전문가를 직접 확인하세요.",
      nextAction: "결정 전에 비용·위험·철회 조건을 공식 자료에서 확인합니다.",
    },
  };
  return { ...shared, ...guidance[topic] };
}

export function createLegacyContinuity(legacyState, importedAt = new Date().toISOString()) {
  if (!legacyState || legacyState.schemaVersion !== 6 || !Array.isArray(legacyState.goals) || !Array.isArray(legacyState.events)) {
    return null;
  }
  const importedDate = new Date(importedAt);
  if (Number.isNaN(importedDate.getTime())) throw new TypeError("legacy import time must be a valid date");
  const eventsByGoal = new Map();
  for (const event of legacyState.events) {
    if (!event || typeof event.goalId !== "string") continue;
    const prior = eventsByGoal.get(event.goalId) || { count: 0, value: 0, lastRecordedAt: 0 };
    prior.count += 1;
    prior.value += Number.isFinite(Number(event.value)) ? Number(event.value) : 0;
    prior.lastRecordedAt = Math.max(prior.lastRecordedAt, Number(event.occurredAt) || 0);
    eventsByGoal.set(event.goalId, prior);
  }
  const goals = legacyState.goals.map((goal, index) => {
    const legacyGoalId = typeof goal?.id === "string" && goal.id.trim() ? goal.id.trim() : `legacy-goal-${index + 1}`;
    const records = eventsByGoal.get(legacyGoalId) || { count: 0, value: 0, lastRecordedAt: 0 };
    const contract = goal?.measurementContract && typeof goal.measurementContract === "object" ? goal.measurementContract : {};
    return {
      legacyGoalId,
      name: typeof goal?.name === "string" && goal.name.trim() ? goal.name.trim().slice(0, 80) : "이름 없는 기존 목표",
      domainId: legacyAreaDomains[goal?.areaId] || "health",
      status: goal?.status === "active" ? "active" : "paused",
      createdAt: Number(goal?.createdAt) || 0,
      metric: typeof contract.metric === "string" ? contract.metric : "check",
      unit: typeof contract.unit === "string" ? contract.unit : "회",
      target: Number.isFinite(Number(contract.target)) ? Number(contract.target) : null,
      period: typeof contract.period === "string" ? contract.period : "day",
      recordCount: records.count,
      recordedValue: records.value,
      lastRecordedAt: records.lastRecordedAt || null,
    };
  });
  const firstActiveGoal = goals.find((goal) => goal.status === "active") || goals[0] || null;
  return {
    version: LIFEPANEL_LEGACY_IMPORT_VERSION,
    source: LEGACY_WEDOIT_STORAGE_KEY,
    mode: "copied-without-changing-source",
    importedAt: importedDate.toISOString(),
    sourceRevision: Number(legacyState.revision) || 0,
    sourceGoalCount: goals.length,
    sourceEventCount: legacyState.events.length,
    recommendedPurposeId: firstActiveGoal ? legacyPurposeDomains[firstActiveGoal.domainId] : "balance",
    goals,
  };
}

export function createLegacyMappingPreview(legacyState, { excludedGoalIds = [] } = {}) {
  const continuity = createLegacyContinuity(legacyState, "1970-01-01T00:00:00.000Z");
  if (!continuity) return null;
  const excluded = new Set(Array.isArray(excludedGoalIds) ? excludedGoalIds.filter((id) => typeof id === "string") : []);
  return {
    version: LIFEPANEL_LEGACY_IMPORT_VERSION,
    source: LEGACY_WEDOIT_STORAGE_KEY,
    mode: "read-only-preview",
    sourceRevision: continuity.sourceRevision,
    sourceGoalCount: continuity.sourceGoalCount,
    sourceEventCount: continuity.sourceEventCount,
    includedGoalCount: continuity.goals.filter((goal) => !excluded.has(goal.legacyGoalId)).length,
    excludedGoalIds: continuity.goals.filter((goal) => excluded.has(goal.legacyGoalId)).map((goal) => goal.legacyGoalId),
    mappings: continuity.goals.map((goal) => ({
      legacyGoalId: goal.legacyGoalId,
      sourceName: goal.name,
      targetDomainId: goal.domainId,
      targetName: goal.name,
      recordCount: goal.recordCount,
      included: !excluded.has(goal.legacyGoalId),
    })),
    note: "미리보기는 기존 WeDoIt 원본을 수정하거나 LifePanel 사본을 저장하지 않습니다.",
  };
}

export function createSelectedLegacyContinuity(legacyState, { excludedGoalIds = [], importedAt = new Date().toISOString() } = {}) {
  const preview = createLegacyMappingPreview(legacyState, { excludedGoalIds });
  if (!preview) return null;
  const excluded = new Set(preview.excludedGoalIds);
  const selectedGoalEntries = legacyState.goals.map((goal, index) => ({
    goal,
    legacyGoalId: typeof goal?.id === "string" && goal.id.trim() ? goal.id.trim() : `legacy-goal-${index + 1}`,
  })).filter(({ legacyGoalId }) => !excluded.has(legacyGoalId));
  const selectedGoals = selectedGoalEntries.map(({ goal }) => goal);
  const selectedGoalIds = new Set(selectedGoalEntries.map(({ legacyGoalId }) => legacyGoalId));
  const selectedEvents = legacyState.events.filter((event) => selectedGoalIds.has(event?.goalId));
  const continuity = createLegacyContinuity({
    ...legacyState,
    goals: selectedGoals,
    events: selectedEvents,
  }, importedAt);
  return {
    ...continuity,
    sourceGoalCount: preview.sourceGoalCount,
    sourceEventCount: preview.sourceEventCount,
    copiedGoalCount: selectedGoals.length,
    copiedEventCount: selectedEvents.length,
    excludedGoalIds: preview.excludedGoalIds,
  };
}

export function isLegacyContinuity(value) {
  return Boolean(
    value
    && value.version === LIFEPANEL_LEGACY_IMPORT_VERSION
    && value.source === LEGACY_WEDOIT_STORAGE_KEY
    && value.mode === "copied-without-changing-source"
    && Array.isArray(value.goals)
    && STARTER_PURPOSES.includes(value.recommendedPurposeId),
  );
}

function requireStorage(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new TypeError("legacy continuity storage must provide getItem and setItem");
  }
  return storage;
}

export function readSavedLegacyContinuity(storage) {
  const target = requireStorage(storage);
  try {
    const saved = target.getItem(LIFEPANEL_LEGACY_IMPORT_STORAGE_KEY);
    const value = saved ? JSON.parse(saved) : null;
    return isLegacyContinuity(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveLegacyContinuityCopy(storage, continuity) {
  const target = requireStorage(storage);
  if (!isLegacyContinuity(continuity)) {
    throw new TypeError("legacy continuity copy must be valid");
  }
  const previousRaw = target.getItem(LIFEPANEL_LEGACY_IMPORT_STORAGE_KEY);
  let previous = null;
  try {
    const parsed = previousRaw ? JSON.parse(previousRaw) : null;
    previous = isLegacyContinuity(parsed) ? parsed : null;
  } catch {
    previous = null;
  }
  const rollback = {
    version: LIFEPANEL_LEGACY_ROLLBACK_VERSION,
    createdAt: new Date().toISOString(),
    previous,
  };
  target.setItem(LIFEPANEL_LEGACY_ROLLBACK_STORAGE_KEY, JSON.stringify(rollback));
  try {
    target.setItem(LIFEPANEL_LEGACY_IMPORT_STORAGE_KEY, JSON.stringify(continuity));
    const saved = readSavedLegacyContinuity(target);
    if (!saved) throw new TypeError("legacy continuity copy did not save");
    return saved;
  } catch (error) {
    if (previousRaw !== null) {
      target.setItem(LIFEPANEL_LEGACY_IMPORT_STORAGE_KEY, previousRaw);
    } else if (typeof target.removeItem === "function") {
      target.removeItem(LIFEPANEL_LEGACY_IMPORT_STORAGE_KEY);
    }
    throw error;
  }
}

export function rollbackLegacyContinuityCopy(storage) {
  const target = requireStorage(storage);
  if (typeof target.removeItem !== "function") {
    throw new TypeError("legacy continuity rollback storage must provide removeItem");
  }
  const current = readSavedLegacyContinuity(target);
  if (!current) return { status: "nothing-to-rollback", continuity: null };

  let previous = null;
  try {
    const raw = target.getItem(LIFEPANEL_LEGACY_ROLLBACK_STORAGE_KEY);
    const rollback = raw ? JSON.parse(raw) : null;
    if (rollback?.version === LIFEPANEL_LEGACY_ROLLBACK_VERSION && isLegacyContinuity(rollback.previous)) {
      previous = rollback.previous;
    }
  } catch {
    previous = null;
  }

  if (previous) {
    target.setItem(LIFEPANEL_LEGACY_IMPORT_STORAGE_KEY, JSON.stringify(previous));
  } else {
    target.removeItem(LIFEPANEL_LEGACY_IMPORT_STORAGE_KEY);
  }
  target.removeItem(LIFEPANEL_LEGACY_ROLLBACK_STORAGE_KEY);
  return {
    status: previous ? "restored-previous-copy" : "removed-copy",
    continuity: previous,
  };
}

export function previewLegacyWeDoIt(legacyGoal) {
  return {
    source: "legacy-wedoit",
    mode: "read-only-preview",
    compass: {
      direction: typeof legacyGoal?.title === "string" ? legacyGoal.title : "가져온 목표",
      note: "기존 WeDoIt 자료는 원본을 바꾸지 않고 미리보기로만 해석합니다.",
    },
  };
}
