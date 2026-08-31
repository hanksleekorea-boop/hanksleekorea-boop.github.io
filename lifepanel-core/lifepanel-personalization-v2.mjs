import { ADVANCED_MOVES, localize, SUFFICIENCY_STATES } from "./lifepanel-advanced-content-v2.mjs";

export const PERSONALIZATION_VERSION = "2.0.0";
const allowedMinutes = [1, 3, 5, 10, 15, 25];

export function createPreferenceState(input = {}) {
  return Object.freeze({
    enabled: input.enabled !== false,
    activeDomainIds: Object.freeze([...new Set(input.activeDomainIds || [])].slice(0, 2)),
    minutes: allowedMinutes.includes(Number(input.minutes)) ? Number(input.minutes) : 5,
    energy: Math.max(1, Math.min(5, Number(input.energy) || 3)),
    disabledMoveIds: Object.freeze([...new Set(input.disabledMoveIds || [])]),
    recentMoveIds: Object.freeze((input.recentMoveIds || []).slice(-12)),
    outcomes: Object.freeze({ ...(input.outcomes || {}) }),
  });
}

export function recordOutcome(state, moveId, outcome) {
  const allowed = new Set(["helped", "neutral", "too-much", "skipped"]);
  if (!allowed.has(outcome)) throw new TypeError("Unsupported outcome");
  return createPreferenceState({ ...state, outcomes: { ...state.outcomes, [moveId]: outcome }, recentMoveIds: [...state.recentMoveIds, moveId] });
}

export function getSufficiencyState(records = [], now = Date.now()) {
  if (!records.length) return "none";
  const latest = Math.max(...records.map((item) => new Date(item.recordedAt || 0).getTime()));
  if (!Number.isFinite(latest) || now - latest > 1000 * 60 * 60 * 24 * 30) return "stale";
  return records.length >= 5 ? "sufficient" : "insufficient";
}

export function explainSufficiency(records, locale = "ko", now = Date.now()) {
  const state = getSufficiencyState(records, now);
  return Object.freeze({ state, label: SUFFICIENCY_STATES[state][locale] });
}

export function rankAdvancedMoves(stateInput = {}, { locale = "ko", limit = 6 } = {}) {
  const state = createPreferenceState(stateInput);
  const disabled = new Set(state.disabledMoveIds);
  const domains = new Set(state.activeDomainIds);
  const recentCounts = state.recentMoveIds.reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {});
  const candidates = ADVANCED_MOVES.filter((move) => !disabled.has(move.id) && (!domains.size || domains.has(move.domainId)) && (recentCounts[move.id] || 0) < 2);
  const ranked = candidates.map((move) => {
    const reasons = [];
    let score = 0;
    if (domains.has(move.domainId)) { score += 30; reasons.push(locale === "ko" ? "직접 연 영역" : "A domain you opened"); }
    const timeGap = Math.abs(move.minutes - state.minutes);
    score += Math.max(0, 18 - timeGap);
    reasons.push(locale === "ko" ? `고른 시간 ${state.minutes}분과 가까움` : `Close to your chosen ${state.minutes} minutes`);
    if (move.energy <= state.energy) { score += 12; reasons.push(locale === "ko" ? "직접 고른 에너지 범위 안" : "Within your chosen energy level"); }
    const outcome = state.outcomes[move.id];
    if (outcome === "helped") { score += 8; reasons.push(locale === "ko" ? "도움 됐다고 직접 기록함" : "You recorded that it helped"); }
    if (outcome === "too-much") { score -= 20; reasons.push(locale === "ko" ? "부담됐다고 직접 기록함" : "You recorded that it felt too much"); }
    score -= (recentCounts[move.id] || 0) * 12;
    return Object.freeze({ move, score: state.enabled ? score : 0, reasons: Object.freeze(state.enabled ? reasons : [locale === "ko" ? "개인화 꺼짐 · 기본 순서" : "Personalization off · default order"]), copy: localize(move, locale) });
  });
  return Object.freeze(ranked.sort((a, b) => b.score - a.score || a.move.id.localeCompare(b.move.id)).slice(0, limit));
}
