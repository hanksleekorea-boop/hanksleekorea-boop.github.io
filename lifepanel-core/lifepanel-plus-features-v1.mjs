export const LIFEPANEL_PLUS_FEATURES_VERSION = "lifepanel.plus-features.v1";

export const PLUS_FEATURES = Object.freeze([
  Object.freeze({ id: "all-domains", label: "8개 영역 포트폴리오", paymentRequired: false }),
  Object.freeze({ id: "advanced-widgets", label: "고급 패널 구성", paymentRequired: false }),
  Object.freeze({ id: "portable-sync", label: "여러 기기 안전 합치기", paymentRequired: false }),
  Object.freeze({ id: "long-experiments", label: "7~365일 장기 실험", paymentRequired: false }),
  Object.freeze({ id: "task-breakdown", label: "기기 안 작업 쪼개기", paymentRequired: false }),
  Object.freeze({ id: "care-circle", label: "가족·돌봄 협업 계획", paymentRequired: false }),
  Object.freeze({ id: "expert-share", label: "전문가 제한 공유", paymentRequired: false }),
]);

export const SHARE_SCOPES = Object.freeze(["chosen-domains", "experiment-summary", "weekly-reflection", "requested-support"]);
export const WIDGET_SURFACES = Object.freeze(["today-focus", "next-move", "experiment", "weekly-reflection", "recovery", "circle"]);
const blockedKey = /(password|secret|token|cookie|private.?key|precise.?location|contact.?list|raw.?audio|diagnosis|bank.?account)/i;

const clone = (value) => JSON.parse(JSON.stringify(value));
const text = (value, max, label) => {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${label} is required`);
  return normalized.slice(0, max);
};
const iso = (value, label) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${label} must be ISO date-time`);
  return parsed.toISOString();
};
const unique = (values) => [...new Set(values || [])];

export function createDomainPortfolio(domainIds = [], knownDomainIds = []) {
  const known = new Set(knownDomainIds);
  const selected = unique(domainIds).filter((id) => known.has(id));
  if (selected.length > 8) throw new RangeError("A portfolio may contain at most 8 domains");
  return Object.freeze({ version: LIFEPANEL_PLUS_FEATURES_VERSION, domainIds: Object.freeze(selected), maximum: 8 });
}

export function createWidgetLayout({ surfaceIds = [], privacy = "general", columns = 2 } = {}) {
  const surfaces = unique(surfaceIds).filter((id) => WIDGET_SURFACES.includes(id));
  if (!surfaces.length || surfaces.length > 6) throw new RangeError("Choose between 1 and 6 widget surfaces");
  if (!["obscured", "general"].includes(privacy)) throw new RangeError("Detailed private data is not allowed on widgets");
  if (![1, 2, 3].includes(Number(columns))) throw new RangeError("Widget columns must be 1, 2, or 3");
  return Object.freeze({ version: LIFEPANEL_PLUS_FEATURES_VERSION, surfaceIds: Object.freeze(surfaces), privacy, columns: Number(columns), showsSensitiveDetails: false });
}

export function createLongExperiment({ id, title, days, stopCondition, successSignal, createdAt = new Date().toISOString() }) {
  const durationDays = Number(days);
  if (!Number.isInteger(durationDays) || durationDays < 7 || durationDays > 365) throw new RangeError("Experiment days must be between 7 and 365");
  return Object.freeze({
    version: LIFEPANEL_PLUS_FEATURES_VERSION,
    id: text(id, 80, "experiment id"),
    title: text(title, 120, "experiment title"),
    days: durationDays,
    stopCondition: text(stopCondition, 240, "stop condition"),
    successSignal: text(successSignal, 240, "success signal"),
    createdAt: iso(createdAt, "created at"),
    checkIns: Object.freeze([]),
    status: "active",
  });
}

export function recordExperimentCheckIn(experiment, { date, outcome, note = "" }) {
  if (!experiment || experiment.version !== LIFEPANEL_PLUS_FEATURES_VERSION) throw new TypeError("Invalid experiment");
  if (!['helped', 'neutral', 'too-much', 'skipped'].includes(outcome)) throw new RangeError("Unknown experiment outcome");
  const day = iso(`${String(date).slice(0, 10)}T00:00:00.000Z`, "check-in date").slice(0, 10);
  const next = [...experiment.checkIns.filter((item) => item.date !== day), { date: day, outcome, note: String(note || "").trim().slice(0, 240) }]
    .sort((a, b) => a.date.localeCompare(b.date));
  return Object.freeze({ ...experiment, checkIns: Object.freeze(next) });
}

export function createTaskBreakdown({ goal, availableMinutes = 15, energy = 3 } = {}) {
  const title = text(goal, 160, "goal");
  const minutes = Math.max(5, Math.min(120, Number(availableMinutes) || 15));
  const energyLevel = Math.max(1, Math.min(5, Number(energy) || 3));
  const firstMinutes = energyLevel <= 2 ? 2 : Math.min(5, Math.max(3, Math.floor(minutes / 4)));
  const steps = [
    { id: "finish", title: `“${title}”의 오늘 끝 기준을 한 문장으로 적기`, minutes: 2, optional: false },
    { id: "prepare", title: "필요한 한 가지 도구나 화면만 준비하기", minutes: 2, optional: false },
    { id: "start", title: `${firstMinutes}분 동안 가장 작은 첫 조각만 실행하기`, minutes: firstMinutes, optional: false },
    { id: "review", title: "계속·줄이기·쉬기 중 하나를 직접 고르기", minutes: 1, optional: false },
  ];
  if (minutes >= 25 && energyLevel >= 3) steps.splice(3, 0, { id: "focus", title: "방해 요소 하나를 치우고 한 조각 더 진행하기", minutes: Math.min(15, minutes - firstMinutes - 5), optional: true });
  return Object.freeze({
    version: LIFEPANEL_PLUS_FEATURES_VERSION,
    goal: title,
    availableMinutes: minutes,
    energy: energyLevel,
    processing: "on-device-rules",
    externalTransmission: false,
    steps: Object.freeze(steps.map(Object.freeze)),
    safety: "자동 결정이 아닙니다. 언제든 줄이기·쉬기·도움 요청을 선택할 수 있습니다.",
  });
}

function sanitizeRecords(records = {}) {
  const output = {};
  for (const [key, record] of Object.entries(records)) {
    if (!key.startsWith("lifepanel.") || blockedKey.test(key)) continue;
    if (!record || typeof record !== "object") continue;
    const valueText = typeof record.value === "string" ? record.value : JSON.stringify(record.value ?? null);
    if (valueText.length > 256 * 1024) continue;
    output[key] = Object.freeze({ value: valueText, updatedAt: iso(record.updatedAt, `${key} updatedAt`), deleted: record.deleted === true });
  }
  return output;
}

export function createPortableSnapshot({ deviceId, records = {}, exportedAt = new Date().toISOString() }) {
  return Object.freeze({
    version: LIFEPANEL_PLUS_FEATURES_VERSION,
    kind: "portable-snapshot",
    deviceId: text(deviceId, 80, "device id"),
    exportedAt: iso(exportedAt, "exported at"),
    records: Object.freeze(sanitizeRecords(records)),
  });
}

export function comparePortableSnapshots(localSnapshot, incomingSnapshot) {
  const local = createPortableSnapshot(localSnapshot);
  const incoming = createPortableSnapshot(incomingSnapshot);
  const keys = unique([...Object.keys(local.records), ...Object.keys(incoming.records)]);
  const summary = { localOnly: 0, incomingOnly: 0, same: 0, newerLocal: 0, newerIncoming: 0, conflicts: 0 };
  for (const key of keys) {
    const a = local.records[key]; const b = incoming.records[key];
    if (!a) summary.incomingOnly += 1;
    else if (!b) summary.localOnly += 1;
    else if (a.value === b.value && a.deleted === b.deleted) summary.same += 1;
    else if (a.updatedAt > b.updatedAt) summary.newerLocal += 1;
    else if (b.updatedAt > a.updatedAt) summary.newerIncoming += 1;
    else summary.conflicts += 1;
  }
  return Object.freeze({ version: LIFEPANEL_PLUS_FEATURES_VERSION, local, incoming, summary: Object.freeze(summary), requiresExplicitApply: true });
}

export function mergePortableSnapshots(comparison, { conflictPolicy = "keep-local", confirmed = false } = {}) {
  if (!confirmed) return Object.freeze({ ok: false, status: "confirmation-required" });
  if (!comparison?.requiresExplicitApply) throw new TypeError("Compare snapshots before applying");
  if (!['keep-local', 'keep-incoming'].includes(conflictPolicy)) throw new RangeError("Unknown conflict policy");
  const merged = {};
  const keys = unique([...Object.keys(comparison.local.records), ...Object.keys(comparison.incoming.records)]);
  for (const key of keys) {
    const a = comparison.local.records[key]; const b = comparison.incoming.records[key];
    if (!a) merged[key] = b;
    else if (!b) merged[key] = a;
    else if (a.updatedAt > b.updatedAt) merged[key] = a;
    else if (b.updatedAt > a.updatedAt) merged[key] = b;
    else merged[key] = conflictPolicy === "keep-incoming" ? b : a;
  }
  return Object.freeze({ ok: true, status: "merged", records: Object.freeze(clone(merged)), appliedAutomatically: false });
}

export function createCareCirclePlan({ name, members = [], sharedRoutines = [], emergencyMonitoring = false } = {}) {
  const normalizedMembers = unique(members.map((member) => String(member || "").trim()).filter(Boolean)).slice(0, 8);
  if (normalizedMembers.length < 2) throw new RangeError("A care plan needs 2 to 8 aliases");
  if (emergencyMonitoring) throw new RangeError("LifePanel does not provide emergency monitoring");
  return Object.freeze({
    version: LIFEPANEL_PLUS_FEATURES_VERSION,
    name: text(name, 80, "care circle name"),
    members: Object.freeze(normalizedMembers),
    sharedRoutines: Object.freeze(unique(sharedRoutines.map((item) => String(item || "").trim().slice(0, 120)).filter(Boolean)).slice(0, 12)),
    visibility: "invite-only",
    emergencyMonitoring: false,
    boundaries: Object.freeze(["공개 순위 없음", "건강 진단 없음", "위치 추적 없음", "응답이 없다고 자동 신고하지 않음"]),
  });
}

export function createLimitedShareGrant({ id, recipientAlias, scopes = [], expiresAt, createdAt = new Date().toISOString() }) {
  const allowed = unique(scopes).filter((scope) => SHARE_SCOPES.includes(scope));
  if (!allowed.length) throw new RangeError("Choose at least one allowed share scope");
  const created = iso(createdAt, "created at");
  const expires = iso(expiresAt, "expires at");
  const days = (new Date(expires) - new Date(created)) / 86400000;
  if (days <= 0 || days > 30) throw new RangeError("A share grant must expire within 30 days");
  return Object.freeze({ version: LIFEPANEL_PLUS_FEATURES_VERSION, id: text(id, 80, "grant id"), recipientAlias: text(recipientAlias, 60, "recipient alias"), scopes: Object.freeze(allowed), createdAt: created, expiresAt: expires, revokedAt: null, status: "active" });
}

export function revokeLimitedShareGrant(grant, revokedAt = new Date().toISOString()) {
  if (!grant || grant.version !== LIFEPANEL_PLUS_FEATURES_VERSION) throw new TypeError("Invalid share grant");
  return Object.freeze({ ...grant, revokedAt: iso(revokedAt, "revoked at"), status: "revoked" });
}

export function createLimitedSharedView(grant, source = {}, now = new Date().toISOString()) {
  if (!grant || grant.version !== LIFEPANEL_PLUS_FEATURES_VERSION) throw new TypeError("Invalid share grant");
  if (grant.status !== "active" || grant.revokedAt || new Date(grant.expiresAt) <= new Date(iso(now, "now"))) return Object.freeze({ ok: false, status: "unavailable" });
  const data = {};
  for (const scope of grant.scopes) if (Object.hasOwn(source, scope)) data[scope] = clone(source[scope]);
  return Object.freeze({ ok: true, status: "available", recipientAlias: grant.recipientAlias, expiresAt: grant.expiresAt, data: Object.freeze(data), excludedByDefault: Object.freeze(["raw notes", "contacts", "precise location", "account identifiers", "health details"]) });
}

export function plusFeatureReadiness() {
  return Object.freeze({ version: LIFEPANEL_PLUS_FEATURES_VERSION, implemented: PLUS_FEATURES.length, total: PLUS_FEATURES.length, percent: 100, paymentIntegrated: false, externalOperationsVerified: false });
}
