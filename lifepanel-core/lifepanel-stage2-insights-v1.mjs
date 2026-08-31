export const STAGE2_INSIGHTS_VERSION = "lifepanel.stage2-insights.v1";
export const TREND_WINDOWS = Object.freeze([30, 90, 365]);

const DAY = 86_400_000;
const PII_KEY = /(email|phone|name|address|account|location|note|memo|token|cookie)/i;

function at(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("record time is invalid");
  return date;
}

function clean(records = [], now = new Date()) {
  if (!Array.isArray(records)) throw new TypeError("records must be an array");
  const end = at(now);
  return records.map((record, index) => ({
    id: String(record?.id || `record-${index}`),
    at: at(record?.at || record?.createdAt),
    completed: record?.completed === true,
    minutes: Math.max(0, Math.min(1440, Number(record?.minutes) || 0)),
    energy: Number.isFinite(Number(record?.energy)) ? Math.max(1, Math.min(5, Number(record.energy))) : null,
    domainId: String(record?.domainId || "unknown").slice(0, 40),
  })).filter((record) => record.at <= end);
}

function inWindow(records, now, days) {
  const lower = at(now).getTime() - days * DAY;
  return records.filter((record) => record.at.getTime() >= lower);
}

export function buildWeeklyBrief({ records = [], now = new Date(), nextAction = "2분 행동 하나 고르기" } = {}) {
  const week = inWindow(clean(records, now), now, 7);
  if (!week.length) return Object.freeze({ version: STAGE2_INSIGHTS_VERSION, status: "insufficient", sampleSize: 0, message: "최근 7일 자료가 없어 변화를 해석하지 않습니다.", nextAction, causalClaim: false });
  const completed = week.filter((record) => record.completed).length;
  const energy = week.filter((record) => record.energy !== null);
  const relatedCandidate = week.length >= 3 && energy.length >= 3
    ? "완료한 날과 에너지 기록이 함께 움직였는지 더 관찰할 수 있습니다."
    : "관련 후보를 말하기에는 자료가 부족합니다.";
  return Object.freeze({
    version: STAGE2_INSIGHTS_VERSION,
    status: week.length >= 3 ? "ready" : "limited",
    sampleSize: week.length,
    completed,
    completionRate: Math.round(completed / week.length * 100),
    minutes: Math.round(week.reduce((sum, record) => sum + record.minutes, 0)),
    relatedCandidate,
    nextAction: String(nextAction).slice(0, 120),
    message: `최근 7일 ${week.length}개 기록 중 ${completed}개를 마쳤습니다.`,
    causalClaim: false,
  });
}

export function buildLongTrend({ records = [], now = new Date(), windowDays = 30 } = {}) {
  const days = Number(windowDays);
  if (!TREND_WINDOWS.includes(days)) throw new RangeError("trend window must be 30, 90, or 365 days");
  const rows = inWindow(clean(records, now), now, days);
  const minimum = days === 30 ? 7 : days === 90 ? 14 : 30;
  if (rows.length < minimum) return Object.freeze({ version: STAGE2_INSIGHTS_VERSION, windowDays: days, status: "insufficient", sampleSize: rows.length, minimumSample: minimum, conclusion: null, message: `${days}일 추세에는 최소 ${minimum}개 기록이 필요합니다.`, causalClaim: false });
  const midpoint = at(now).getTime() - days * DAY / 2;
  const first = rows.filter((record) => record.at.getTime() < midpoint);
  const second = rows.filter((record) => record.at.getTime() >= midpoint);
  const rate = (part) => part.length ? part.filter((record) => record.completed).length / part.length : 0;
  const delta = Math.round((rate(second) - rate(first)) * 100);
  const direction = Math.abs(delta) < 5 ? "stable" : delta > 0 ? "higher" : "lower";
  return Object.freeze({ version: STAGE2_INSIGHTS_VERSION, windowDays: days, status: "ready", sampleSize: rows.length, minimumSample: minimum, direction, deltaPercentagePoints: delta, conclusion: `기간 전반과 후반의 완료 기록 비율이 ${Math.abs(delta)}%p ${direction === "stable" ? "범위에서 비슷했습니다" : direction === "higher" ? "높았습니다" : "낮았습니다"}.`, causalClaim: false, caveat: "관찰된 관련이며 원인이나 효과를 뜻하지 않습니다." });
}

export function designSmallExperiment({ title, action, stopCondition, successSignal, observationCount = 0, days = 21 } = {}) {
  const duration = Number(days);
  if (![21, 30].includes(duration)) throw new RangeError("experiment must be 21 or 30 days");
  for (const [label, value] of Object.entries({ title, action, stopCondition, successSignal })) if (!String(value || "").trim()) throw new TypeError(`${label} is required`);
  const sufficient = Number(observationCount) >= 7;
  return Object.freeze({ version: STAGE2_INSIGHTS_VERSION, title: String(title).trim().slice(0, 120), action: String(action).trim().slice(0, 160), stopCondition: String(stopCondition).trim().slice(0, 240), successSignal: String(successSignal).trim().slice(0, 240), days: duration, observationCount: Math.max(0, Number(observationCount) || 0), recommendationAllowed: sufficient, conclusion: sufficient ? "시험을 시작할 수 있지만 결과는 관련 후보로만 기록합니다." : null, message: sufficient ? "중단 조건을 먼저 확인한 뒤 시작할 수 있습니다." : "기초 관찰 7개 전에는 시작을 권하지 않습니다.", causalClaim: false });
}

export function buildCohortComparison({ records = [], provenance = "synthetic-illustrative", consent = false, minimumCohort = 30 } = {}) {
  if (!Array.isArray(records)) throw new TypeError("cohort records must be an array");
  if (PII_KEY.test(JSON.stringify(records).toLowerCase())) throw new TypeError("cohort rows must not contain personal fields");
  const real = provenance === "real-consented-aggregate";
  const open = records.length >= minimumCohort && (!real || consent === true);
  return Object.freeze({ version: STAGE2_INSIGHTS_VERSION, provenance, isRealUserAggregate: real, cohortSize: records.length, minimumCohort, status: open ? "ready" : "closed", reason: open ? null : real && !consent ? "consent-required" : "minimum-cohort-not-met", individualRowsExposed: false, ranking: false, label: real ? "동의한 실제 사용자 집계" : "설명용 가상 표본 · 실제 사용자 평균 아님" });
}
