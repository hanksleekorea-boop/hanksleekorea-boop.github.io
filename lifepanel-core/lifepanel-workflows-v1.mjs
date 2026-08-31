export const LIFEPANEL_WORKFLOW_VERSION = "lifepanel.workflow.v1";
export const CAPTURE_MODES = Object.freeze(["text", "voice-note"]);
export const SESSION_ACTIONS = Object.freeze(["pause", "resume", "end"]);
export const EXPRESSION_STYLES = Object.freeze(["minimal", "warm", "analytical"]);

const DOMAIN_IDS = Object.freeze(["health", "relationships", "work", "learning", "money", "home", "creation", "recovery"]);

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${label} must be a non-empty string`);
  return value.trim();
}

function requireDate(value, label) {
  const date = new Date(value || new Date().toISOString());
  if (Number.isNaN(date.getTime())) throw new TypeError(`${label} must be a valid date`);
  return date;
}

function requireTimeZone(value) {
  const timeZone = requireString(value, "time zone");
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  } catch {
    throw new RangeError("invalid time zone");
  }
  return timeZone;
}

function localDateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function createInboxItem({ id, mode = "text", text, createdAt }) {
  if (!CAPTURE_MODES.includes(mode)) throw new RangeError("invalid capture mode");
  const normalizedText = requireString(text, "capture text");
  return {
    version: LIFEPANEL_WORKFLOW_VERSION,
    id: requireString(id, "capture id"),
    mode,
    text: normalizedText.slice(0, 1000),
    createdAt: requireDate(createdAt, "capture time").toISOString(),
    storage: "device-only",
    status: "inbox",
  };
}

export function mergeOfflineRecords(current = [], incoming = []) {
  if (!Array.isArray(current) || !Array.isArray(incoming)) throw new TypeError("offline records must be arrays");
  const merged = new Map();
  for (const record of [...current, ...incoming]) {
    const id = requireString(record?.id, "offline record id");
    const updatedAt = requireDate(record?.updatedAt, "offline record time").toISOString();
    const prior = merged.get(id);
    if (!prior || new Date(updatedAt) >= new Date(prior.updatedAt)) merged.set(id, { ...record, id, updatedAt });
  }
  return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function startFocusSession({ id, title, kind = "focus", startedAt }) {
  if (!['focus', 'rest', 'routine'].includes(kind)) throw new RangeError("invalid session kind");
  const timestamp = requireDate(startedAt, "session start time").toISOString();
  return {
    version: LIFEPANEL_WORKFLOW_VERSION,
    id: requireString(id, "session id"),
    title: requireString(title, "session title"),
    kind,
    status: "running",
    startedAt: timestamp,
    updatedAt: timestamp,
    events: [{ action: "start", at: timestamp }],
  };
}

export function transitionFocusSession(session, action, at) {
  if (!session || session.version !== LIFEPANEL_WORKFLOW_VERSION) throw new TypeError("valid session is required");
  if (!SESSION_ACTIONS.includes(action)) throw new RangeError("invalid session action");
  const allowed = { running: ["pause", "end"], paused: ["resume", "end"], ended: [] };
  if (!allowed[session.status]?.includes(action)) throw new RangeError("invalid session transition");
  const status = action === "pause" ? "paused" : action === "resume" ? "running" : "ended";
  const updatedAt = requireDate(at, "session transition time").toISOString();
  return { ...session, status, updatedAt, events: [...session.events, { action, at: updatedAt }] };
}

export function createSessionSurfacePayload(session) {
  if (!session || !["running", "paused", "ended"].includes(session.status)) throw new TypeError("valid session is required");
  const statusLabels = { running: "진행 중", paused: "일시정지", ended: "종료" };
  const payload = Object.freeze({ sessionId: session.id, title: session.title, status: session.status, statusLabel: statusLabels[session.status], updatedAt: session.updatedAt });
  return { app: payload, widget: payload, ribbon: payload };
}

export function evaluateEnergyBudget({ available, moves = [], ignoreWarning = false }) {
  const capacity = Number(available);
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 10) throw new RangeError("available energy must be an integer from 0 to 10");
  if (!Array.isArray(moves)) throw new TypeError("energy moves must be an array");
  const planned = moves.reduce((total, move) => {
    const cost = Number(move?.energyCost);
    if (!Number.isInteger(cost) || cost < 1 || cost > 5) throw new RangeError("move energy cost must be an integer from 1 to 5");
    return total + cost;
  }, 0);
  const overBudget = planned > capacity;
  return {
    available: capacity,
    planned,
    remaining: capacity - planned,
    overBudget,
    ignoredByUser: overBudget && ignoreWarning === true,
    message: overBudget ? "가용 에너지보다 계획이 큽니다. 줄이거나 경고를 무시할 수 있습니다." : "현재 에너지 안에서 가능한 계획입니다.",
  };
}

export function createTimeWindow({ id, label, startsAt, endsAt, timeZone }) {
  const start = requireDate(startsAt, "time window start");
  const end = requireDate(endsAt, "time window end");
  if (end <= start) throw new RangeError("time window end must be after start");
  const zone = requireTimeZone(timeZone);
  const startDay = localDateKey(start, zone);
  const endDay = localDateKey(end, zone);
  return {
    id: requireString(id, "time window id"),
    label: requireString(label, "time window label"),
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    timeZone: zone,
    localDay: startDay,
    crossesMidnight: startDay !== endDay,
  };
}

export function buildDayTimeline(windows = []) {
  if (!Array.isArray(windows)) throw new TypeError("time windows must be an array");
  const sorted = [...windows].sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
  return sorted.map((window, index) => {
    const prior = sorted[index - 1];
    const start = new Date(window.startsAt);
    const priorEnd = prior ? new Date(prior.endsAt) : null;
    const conflict = Boolean(priorEnd && start < priorEnd);
    const gapMinutes = priorEnd && start > priorEnd ? Math.round((start - priorEnd) / 60000) : 0;
    return { ...window, conflict, gapMinutes, state: conflict ? "conflict" : gapMinutes > 0 ? "gap-after" : "scheduled" };
  });
}

export function calculatePersonalBaseline({ entries = [], currentValue, now }) {
  if (!Array.isArray(entries)) throw new TypeError("baseline entries must be an array");
  const current = Number(currentValue);
  if (!Number.isFinite(current)) throw new TypeError("current baseline value must be numeric");
  const reference = requireDate(now, "baseline reference time");
  const lowerBound = reference.getTime() - (7 * 24 * 60 * 60 * 1000);
  const recent = entries.filter((entry) => {
    const at = new Date(entry?.at).getTime();
    return Number.isFinite(Number(entry?.value)) && at >= lowerBound && at <= reference.getTime();
  });
  if (recent.length < 3) return { status: "insufficient", sampleSize: recent.length, message: "최근 7일 표본이 부족해 비교하지 않습니다." };
  const average = recent.reduce((sum, entry) => sum + Number(entry.value), 0) / recent.length;
  const delta = current - average;
  const change = Math.abs(delta) < 0.01 ? "no-change" : delta > 0 ? "higher" : "lower";
  return { status: "ready", sampleSize: recent.length, average, current, delta, change, message: change === "no-change" ? "최근 나의 기준선과 변화가 없습니다." : `최근 나의 7일 평균보다 ${change === "higher" ? "높습니다" : "낮습니다"}.` };
}

export function createSmallExperiment({ id, hypothesis, action, durationDays, startedAt }) {
  const duration = Number(durationDays);
  if (!Number.isInteger(duration) || duration < 1 || duration > 30) throw new RangeError("experiment duration must be from 1 to 30 days");
  return {
    version: LIFEPANEL_WORKFLOW_VERSION,
    id: requireString(id, "experiment id"),
    hypothesis: requireString(hypothesis, "experiment hypothesis"),
    action: requireString(action, "experiment action"),
    durationDays: duration,
    startedAt: requireDate(startedAt, "experiment start time").toISOString(),
    status: "running",
    result: null,
  };
}

export function finishSmallExperiment(experiment, { result, endedAt }) {
  if (!experiment || experiment.version !== LIFEPANEL_WORKFLOW_VERSION) throw new TypeError("valid experiment is required");
  return {
    ...experiment,
    status: "finished",
    result: requireString(result, "experiment result"),
    endedAt: requireDate(endedAt, "experiment end time").toISOString(),
    conclusion: "관찰된 변화는 관련이 있을 수 있으나 원인으로 단정하지 않습니다.",
  };
}

export function createLifeOverview({ openDomainIds = [] }) {
  if (!Array.isArray(openDomainIds) || openDomainIds.length > 2) throw new RangeError("at most two life domains may be open");
  const unique = [...new Set(openDomainIds)];
  if (unique.some((id) => !DOMAIN_IDS.includes(id))) throw new RangeError("unknown life domain");
  return DOMAIN_IDS.map((id) => ({ id, state: unique.includes(id) ? "open" : "locked" }));
}

export function createPermissionControl({ id, label, reason, state = "off" }) {
  if (!['off', 'on'].includes(state)) throw new RangeError("invalid permission state");
  return { id: requireString(id, "permission id"), label: requireString(label, "permission label"), reason: requireString(reason, "permission reason"), state, canDisable: true, canDelete: true };
}

export function updatePermissionControl(control, action) {
  if (!control?.canDisable || !control?.canDelete) throw new TypeError("valid permission control is required");
  if (!['enable', 'disable', 'delete'].includes(action)) throw new RangeError("invalid permission action");
  if (action === "delete") return { ...control, state: "off", deleted: true };
  return { ...control, state: action === "enable" ? "on" : "off", deleted: false };
}

export function summarizeWeek(blocks = []) {
  if (!Array.isArray(blocks)) throw new TypeError("weekly blocks must be an array");
  return blocks.reduce((summary, block) => ({
    minutes: summary.minutes + Number(block.minutes || 0),
    energySpent: summary.energySpent + Number(block.energyCost || 0),
    completed: summary.completed + (block.completed ? 1 : 0),
    total: summary.total + 1,
  }), { minutes: 0, energySpent: 0, completed: 0, total: 0 });
}

export function createWeeklyAdjustment({ experimentId, weekStart, confirmed = false }) {
  const start = requireDate(weekStart, "week start").toISOString();
  return {
    experimentId: requireString(experimentId, "weekly experiment id"),
    weekStart: start,
    status: confirmed ? "applied" : "preview",
    requiresPreview: true,
    applied: confirmed === true,
  };
}

export function formatAdaptiveExpression({ status, nextAction, protection }, style = "minimal") {
  if (!EXPRESSION_STYLES.includes(style)) throw new RangeError("invalid expression style");
  const data = {
    status: requireString(status, "expression status"),
    nextAction: requireString(nextAction, "expression next action"),
    protection: requireString(protection, "expression protection"),
  };
  const text = {
    minimal: `${data.status} · ${data.nextAction} · ${data.protection}`,
    warm: `${data.status}. 지금은 ${data.nextAction}. ${data.protection}`,
    analytical: `상태: ${data.status} / 다음: ${data.nextAction} / 보호: ${data.protection}`,
  }[style];
  return { style, data, text };
}
