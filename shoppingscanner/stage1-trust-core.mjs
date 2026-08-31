const freeze = value => Object.freeze(value);
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const nonNegative = value => Number.isInteger(value) && value >= 0;
const dateMs = value => typeof value === 'string' ? Date.parse(value) : NaN;
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const median = values => {
  const ordered = values.filter(finite).sort((a, b) => a - b);
  if (!ordered.length) return null;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};

export const normalizeIdentityText = value => String(value ?? '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[\s._/()-]+/g, '')
  .replace(/[^\p{L}\p{N}]/gu, '');

export function isValidGtin(value) {
  if (!/^[0-9]{8,14}$/.test(String(value ?? ''))) return false;
  const digits = [...String(value)].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export function evaluateProductIdentity(left, right) {
  const keys = ['manufacturer', 'modelNumber', 'optionKey'];
  const normalized = source => Object.fromEntries(keys.map(key => [key, normalizeIdentityText(source?.[key])])) ;
  const a = normalized(left);
  const b = normalized(right);
  const leftGtins = new Set((left?.gtins ?? []).filter(isValidGtin));
  const rightGtins = new Set((right?.gtins ?? []).filter(isValidGtin));
  const sharedGtin = [...leftGtins].some(gtin => rightGtins.has(gtin));
  const conflicts = [];

  if (leftGtins.size && rightGtins.size && !sharedGtin) conflicts.push('gtin');
  for (const key of ['modelNumber', 'optionKey']) if (a[key] && b[key] && a[key] !== b[key]) conflicts.push(key);
  if (conflicts.length) return freeze({ decision: 'SEPARATE', confidence: 0, code: 'IDENTITY_CONFLICT', conflicts });
  if (sharedGtin && a.modelNumber === b.modelNumber && a.optionKey === b.optionKey) {
    return freeze({ decision: 'AUTO_MATCH', confidence: 0.995, code: 'GTIN_MODEL_OPTION_EXACT', conflicts: [] });
  }
  if (a.manufacturer && a.manufacturer === b.manufacturer && a.modelNumber && a.modelNumber === b.modelNumber && a.optionKey && a.optionKey === b.optionKey) {
    return freeze({ decision: 'REVIEW', confidence: 0.94, code: 'MODEL_OPTION_REVIEW', conflicts: [] });
  }
  if (a.modelNumber && a.modelNumber === b.modelNumber && a.optionKey && a.optionKey === b.optionKey) {
    return freeze({ decision: 'REVIEW', confidence: 0.88, code: 'MODEL_OPTION_WEAK', conflicts: [] });
  }
  return freeze({ decision: 'SEPARATE', confidence: 0, code: 'INSUFFICIENT_IDENTITY', conflicts: [] });
}

const CATEGORY_SIGNALS = freeze({
  digital: ['스마트폰', '갤럭시', '아이폰', '이어폰', '헤드폰', '카메라', '충전기'],
  computer: ['노트북', '모니터', '키보드', '마우스', '그래픽카드', 'ssd', '태블릿'],
  appliances: ['냉장고', '세탁기', '청소기', '에어컨', '전자레인지', '공기청정기'],
  fashion: ['원피스', '셔츠', '바지', '재킷', '코트', '니트', '티셔츠'],
  fashion_goods: ['가방', '신발', '지갑', '벨트', '모자', '시계', '안경'],
  beauty: ['크림', '로션', '세럼', '샴푸', '립스틱', '마스크팩', '선크림'],
  food: ['쌀', '김치', '과자', '커피', '라면', '생수', '주스'],
  living: ['프라이팬', '냄비', '수납', '세제', '휴지', '침구', '의자'],
  baby: ['기저귀', '분유', '유모차', '카시트', '젖병', '아기'],
  sports: ['골프', '등산', '자전거', '러닝', '캠핑', '요가', '낚시'],
  auto_tools: ['타이어', '엔진오일', '공구', '드릴', '와이퍼', '차량용'],
  books: ['도서', '책', '수험서', '교재', '문제집', '앨범', '음반'],
  pets: ['강아지', '고양이', '사료', '간식', '배변', '캣타워'],
  travel: ['호텔', '리조트', '항공', '숙박', '투어', '입장권'],
  giftcards: ['상품권', '쿠폰', '이용권', '기프티콘'],
  overseas: ['해외직구', '직구', '해외배송'],
});

export function auditCategory(product) {
  const title = normalizeIdentityText(product?.title);
  const scores = Object.entries(CATEGORY_SIGNALS).map(([category, signals]) => ({
    category,
    score: signals.reduce((sum, signal) => sum + (title.includes(normalizeIdentityText(signal)) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score || a.category.localeCompare(b.category));
  const best = scores[0];
  if (!best || best.score === 0) return freeze({ status: 'REVIEW', expected: null, confidence: 0, reason: 'NO_CATEGORY_SIGNAL' });
  if (best.category === product?.categoryKey) return freeze({ status: 'CONSISTENT', expected: best.category, confidence: clamp(best.score / 3, 0, 1), reason: 'TITLE_SIGNAL_MATCH' });
  return freeze({ status: 'REVIEW', expected: best.category, confidence: clamp(best.score / 3, 0, 1), reason: 'TITLE_SIGNAL_CONFLICT' });
}

export function freshnessReceipt(observedAt, now = new Date().toISOString(), limits = {}) {
  const observed = dateMs(observedAt);
  const current = dateMs(now);
  if (!Number.isFinite(observed) || !Number.isFinite(current) || observed > current) return freeze({ state: 'unknown', ageHours: null, observedAt: observedAt ?? null, nextRefreshDueAt: null });
  const freshHours = limits.freshHours ?? 6;
  const staleHours = limits.staleHours ?? 24;
  const ageHours = Math.round(((current - observed) / 36e5) * 10) / 10;
  const state = ageHours <= freshHours ? 'fresh' : ageHours <= staleHours ? 'aging' : 'stale';
  return freeze({ state, ageHours, observedAt, nextRefreshDueAt: new Date(observed + freshHours * 36e5).toISOString() });
}

const COST_COMPONENTS = freeze([
  ['shippingState', 'shippingAmount'],
  ['optionCostState', 'optionCostAmount'],
  ['taxState', 'taxAmount'],
  ['installationState', 'installationAmount'],
  ['couponState', 'couponAmount'],
  ['returnCostState', 'returnCostAmount'],
]);

export function calculateLandedCost(offer) {
  if (!plain(offer) || !nonNegative(offer.basePrice)) return freeze({ calculable: false, total: null, knownTotal: null, unknown: ['basePrice'], conditional: [] });
  let knownTotal = offer.basePrice;
  const unknown = [];
  const conditional = [];
  for (const [stateKey, amountKey] of COST_COMPONENTS) {
    const state = offer[stateKey] ?? 'unknown';
    const amount = offer[amountKey];
    if (state === 'included') continue;
    if (state === 'known_extra' || state === 'known') {
      if (nonNegative(amount)) knownTotal += amount;
      else unknown.push(stateKey);
      continue;
    }
    if (state === 'discount') {
      if (nonNegative(amount)) knownTotal -= amount;
      else unknown.push(stateKey);
      continue;
    }
    if (state === 'conditional') conditional.push(stateKey);
    else unknown.push(stateKey);
  }
  const calculable = unknown.length === 0 && conditional.length === 0;
  return freeze({ calculable, total: calculable ? Math.max(0, knownTotal) : null, knownTotal: Math.max(0, knownTotal), unknown, conditional });
}

const BAIT_TERMS = /케이스|보호필름|악세사리|액세서리|공기계아님|요금제|월\s*납부|렌탈|상담|예약금|부품용|본품미포함/i;

export function detectBaitOffer(offer, peerPrices = []) {
  const reasons = [];
  const price = offer?.basePrice;
  if (!nonNegative(price) || price === 0) reasons.push('INVALID_OR_ZERO_PRICE');
  if (finite(price) && price > 0 && price < 100) reasons.push('MICRO_PRICE');
  if (BAIT_TERMS.test(String(offer?.title ?? ''))) reasons.push('BAIT_TERM');
  if (offer?.optionCostState === 'unknown') reasons.push('OPTION_COST_UNKNOWN');
  const peerMedian = median(peerPrices.filter(value => finite(value) && value > 0));
  if (finite(price) && peerMedian !== null && peerMedian >= 1000 && price < peerMedian * 0.25) reasons.push('PEER_PRICE_OUTLIER');
  return freeze({ flagged: reasons.length > 0, severity: reasons.includes('INVALID_OR_ZERO_PRICE') || reasons.includes('MICRO_PRICE') || reasons.includes('PEER_PRICE_OUTLIER') ? 'critical' : reasons.length ? 'warning' : 'none', reasons, peerMedian });
}

export function stockTrust(offer, now = new Date().toISOString()) {
  const freshness = freshnessReceipt(offer?.observedAt, now);
  const sourceQuality = ['contract', 'api_terms', 'licensed_feed'].includes(offer?.rightsBasis) && ['api', 'feed'].includes(offer?.ingestionMethod);
  const known = ['in_stock', 'out_of_stock', 'preorder'].includes(offer?.stockState);
  const confidence = known && freshness.state === 'fresh' && sourceQuality ? 'high' : known && freshness.state !== 'stale' ? 'medium' : 'low';
  return freeze({ state: known ? offer.stockState : 'unknown', confidence, observedAt: offer?.observedAt ?? null, arrival: offer?.arrivalEstimate ?? null, freshness });
}

export function normalizePolicies(input = {}) {
  const normalize = (value, fields) => {
    if (!plain(value)) return freeze({ status: 'unknown', source: null, updatedAt: null, fields: {} });
    const extracted = Object.fromEntries(fields.map(key => [key, value[key] ?? null]));
    const complete = Boolean(value.source && Number.isFinite(dateMs(value.updatedAt)) && fields.every(key => Object.hasOwn(value, key)));
    return freeze({ status: complete ? 'verified' : 'partial', source: value.source ?? null, updatedAt: value.updatedAt ?? null, fields: freeze(extracted) });
  };
  return freeze({
    return: normalize(input.return, ['windowDays', 'feeState', 'feeAmount']),
    warranty: normalize(input.warranty, ['months', 'provider']),
    installation: normalize(input.installation, ['available', 'costState', 'costAmount']),
  });
}

export function sellerRisk(evidence = {}) {
  const reasons = [];
  let risk = 50;
  if (evidence.officialSeller === true) risk -= 25;
  if (evidence.identityVerified === true) risk -= 15;
  if (finite(evidence.rating) && evidence.rating >= 4.5 && (evidence.ratingCount ?? 0) >= 100) risk -= 10;
  if (evidence.counterfeitReports > 0) { risk += Math.min(35, evidence.counterfeitReports * 7); reasons.push('COUNTERFEIT_REPORTS'); }
  if (evidence.policyMissing === true) { risk += 15; reasons.push('POLICY_MISSING'); }
  if (evidence.identityVerified !== true) reasons.push('IDENTITY_UNVERIFIED');
  if (!evidence.source || !Number.isFinite(dateMs(evidence.observedAt))) reasons.push('EVIDENCE_MISSING');
  risk = Math.round(clamp(risk));
  return freeze({ score: risk, level: risk >= 70 ? 'high' : risk >= 40 ? 'medium' : 'low', reasons, source: evidence.source ?? null, observedAt: evidence.observedAt ?? null });
}

export const semanticTokens = value => [...new Set(String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean))];

export function semanticSearchScore(query, product, synonyms = {}) {
  const expanded = new Set();
  for (const token of semanticTokens(query)) {
    expanded.add(token);
    for (const synonym of synonyms[token] ?? []) expanded.add(String(synonym).toLowerCase());
  }
  const haystack = new Set(semanticTokens([product?.title, product?.brand, product?.modelNumber, ...(product?.keywords ?? [])].join(' ')));
  let matches = 0;
  for (const token of expanded) if (haystack.has(token) || [...haystack].some(value => value.includes(token) || token.includes(value))) matches += 1;
  return freeze({ score: expanded.size ? Math.round((matches / expanded.size) * 100) : 0, matches, queryTokens: [...expanded] });
}

export function diffSpecs(left = {}, right = {}) {
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  return freeze(keys.map(key => freeze({ key, left: left[key] ?? null, right: right[key] ?? null, different: JSON.stringify(left[key] ?? null) !== JSON.stringify(right[key] ?? null) })));
}

export function summarizePriceHistory(observations = [], now = new Date().toISOString()) {
  const valid = observations.filter(row => row?.status === 'valid' && nonNegative(row.observedPrice) && Number.isFinite(dateMs(row.observedAt))).sort((a, b) => dateMs(a.observedAt) - dateMs(b.observedAt));
  const duplicateKeys = new Set();
  const unique = valid.filter(row => {
    const key = `${row.sellerOfferId}|${row.observedAt}|${row.observedPrice}`;
    if (duplicateKeys.has(key)) return false;
    duplicateKeys.add(key);
    return true;
  });
  const result = { current: unique.at(-1) ?? null, periods: {}, gaps: [] };
  for (const days of [30, 90, 365]) {
    const cutoff = dateMs(now) - days * 864e5;
    const rows = unique.filter(row => dateMs(row.observedAt) >= cutoff);
    const prices = rows.map(row => row.observedPrice);
    result.periods[days] = freeze({ count: rows.length, low: prices.length ? Math.min(...prices) : null, high: prices.length ? Math.max(...prices) : null, median: median(prices) });
  }
  for (let index = 1; index < unique.length; index += 1) {
    const hours = (dateMs(unique[index].observedAt) - dateMs(unique[index - 1].observedAt)) / 36e5;
    if (hours > 36) result.gaps.push(freeze({ from: unique[index - 1].observedAt, to: unique[index].observedAt, hours: Math.round(hours * 10) / 10 }));
  }
  return freeze({ ...result, periods: freeze(result.periods), gaps: freeze(result.gaps), observationCount: unique.length });
}

export function evaluateAlert(subscription, previous, current) {
  if (subscription?.pausedAt || subscription?.deletedAt || !current) return freeze({ trigger: false, reason: 'INACTIVE_OR_NO_DATA' });
  let trigger = false;
  let reason = 'NO_CHANGE';
  if (subscription.alertType === 'target_price' && finite(subscription.threshold) && current.observedPrice <= subscription.threshold) { trigger = true; reason = 'TARGET_REACHED'; }
  if (subscription.alertType === 'percent_drop' && previous?.observedPrice > 0 && current.observedPrice <= previous.observedPrice * (1 - subscription.threshold / 100)) { trigger = true; reason = 'PERCENT_DROP'; }
  if (subscription.alertType === 'restock' && previous?.stockState === 'out_of_stock' && current.stockState === 'in_stock') { trigger = true; reason = 'RESTOCKED'; }
  if (subscription.alertType === 'new_seller' && previous?.sellerOfferId !== current.sellerOfferId) { trigger = true; reason = 'NEW_SELLER'; }
  if (subscription.alertType === 'delivery_change' && previous?.arrivalEstimate !== current.arrivalEstimate) { trigger = true; reason = 'DELIVERY_CHANGED'; }
  return freeze({ trigger, reason, oneClickUnsubscribe: true });
}

export function dealTruthScore({ offer, peerPrices = [], history = [], seller = {}, policies = {} } = {}) {
  const freshness = freshnessReceipt(offer?.observedAt);
  const bait = detectBaitOffer(offer, peerPrices);
  const cost = calculateLandedCost(offer ?? {});
  const sellerResult = sellerRisk(seller);
  const policy = normalizePolicies(policies);
  const historySummary = summarizePriceHistory(history);
  let score = 100;
  if (freshness.state === 'aging') score -= 10;
  if (freshness.state === 'stale' || freshness.state === 'unknown') score -= 30;
  if (bait.flagged) score -= bait.severity === 'critical' ? 35 : 15;
  if (!cost.calculable) score -= 15;
  score -= Math.round(sellerResult.score * 0.2);
  if (Object.values(policy).some(item => item.status === 'unknown')) score -= 10;
  if (historySummary.observationCount < 2) score -= 10;
  score = Math.round(clamp(score));
  return freeze({ score, label: score >= 80 ? 'strong' : score >= 60 ? 'caution' : 'weak', freshness, bait, cost, seller: sellerResult, policy, history: historySummary, recommendation: score >= 80 ? '근거가 충분한 편' : '판매처에서 핵심 조건 재확인 필요' });
}

export function buildEvidencePassport(input = {}) {
  const claims = [];
  const unknown = [];
  if (input.product?.title) claims.push(freeze({ claim: 'product_identity', value: input.product.title, source: input.product.source ?? null, observedAt: input.product.observedAt ?? null }));
  if (input.offer?.basePrice !== undefined) claims.push(freeze({ claim: 'observed_price', value: input.offer.basePrice, source: input.offer.source ?? null, observedAt: input.offer.observedAt ?? null }));
  for (const field of ['shipping', 'tax', 'stock', 'return', 'warranty']) if (!input.evidence?.[field]) unknown.push(field);
  const compensation = input.compensation ?? freeze({ affiliate: false, advertising: false, rankingImpact: false });
  return freeze({
    schema: 'shopping-scanner-evidence-passport/v1',
    recommendation: input.recommendation ?? null,
    reasonsFor: freeze([...(input.reasonsFor ?? [])]),
    reasonsAgainst: freeze([...(input.reasonsAgainst ?? [])]),
    claims: freeze(claims),
    unknown: freeze(unknown),
    compensation: freeze({ affiliate: compensation.affiliate === true, advertising: compensation.advertising === true, rankingImpact: false }),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  });
}

export function evaluateDecisionStudio(criteria = {}, candidates = []) {
  const weights = freeze({ price: 1, trust: 1, delivery: 1, warranty: 1, sustainability: 1, ...(criteria.weights ?? {}) });
  const required = new Set(criteria.required ?? []);
  const scored = candidates.map(candidate => {
    const missingRequired = [...required].filter(key => candidate[key] === undefined || candidate[key] === null);
    const components = Object.entries(weights).map(([key, weight]) => ({ key, weight, value: finite(candidate[key]) ? clamp(candidate[key]) : null }));
    const known = components.filter(item => item.value !== null);
    const totalWeight = known.reduce((sum, item) => sum + item.weight, 0);
    const score = totalWeight ? Math.round(known.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight) : 0;
    return freeze({ id: candidate.id, score, eligible: missingRequired.length === 0, missingRequired, components: freeze(components), compensationExcluded: true });
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || String(a.id).localeCompare(String(b.id)));
  return freeze(scored);
}

export function createOwnershipReceipt(action, scope, now = new Date().toISOString()) {
  if (!['export', 'delete'].includes(action) || !Array.isArray(scope) || !scope.length) throw new Error('INVALID_OWNERSHIP_RECEIPT');
  return freeze({ schema: 'shopping-scanner-ownership-receipt/v1', action, scope: freeze([...new Set(scope)].sort()), completedAt: now, verified: true, serverDataIncluded: false, note: '기기 안 자료 작업 결과이며 서버 자료는 별도 확인이 필요합니다.' });
}

export function consentPolicy({ gpc = false, region = 'unknown', explicit = {} } = {}) {
  const strict = gpc || region === 'unknown' || region === 'eea_uk_ch';
  return freeze({
    analytics: strict ? false : explicit.analytics === true,
    advertising: strict ? false : explicit.advertising === true,
    affiliate: explicit.affiliate === true,
    gpcHonored: gpc === true,
    requiredPrompt: region === 'eea_uk_ch' && !gpc,
    essentialOnly: strict,
  });
}

export function neutralRank(candidates = [], weights = {}) {
  if (Object.keys(weights).some(key => /commission|affiliate|ad|revenue/i.test(key))) throw new Error('COMPENSATION_WEIGHT_FORBIDDEN');
  const allowed = freeze({ relevance: 0.45, trust: 0.35, totalCost: 0.2, ...weights });
  return freeze(candidates.map(candidate => {
    const score = Object.entries(allowed).reduce((sum, [key, weight]) => sum + clamp(candidate[key] ?? 0) * weight, 0);
    return freeze({ ...candidate, organicScore: Math.round(score * 100) / 100 });
  }).sort((a, b) => b.organicScore - a.organicScore || String(a.id).localeCompare(String(b.id))));
}

export function evaluateOperations(signals = {}, targets = {}) {
  const required = ['publicUrl', 'catalog', 'support', 'backup', 'recovery'];
  const failures = required.filter(key => signals[key] !== 'pass');
  const availability = finite(signals.availability) ? signals.availability : null;
  const rtoHours = finite(signals.rtoHours) ? signals.rtoHours : null;
  if (availability === null || availability < (targets.availability ?? 99.9)) failures.push('availability');
  if (rtoHours === null || rtoHours > (targets.rtoHours ?? 4)) failures.push('rtoHours');
  return freeze({ ready: failures.length === 0, failures: freeze([...new Set(failures)]), availability, rtoHours });
}

export function checkApiRequest(request = {}, policy = {}) {
  const failures = [];
  const method = String(request.method ?? 'GET').toUpperCase();
  if (!(policy.methods ?? ['GET']).includes(method)) failures.push('METHOD_NOT_ALLOWED');
  if (policy.sameOrigin === true && request.origin !== policy.origin) failures.push('ORIGIN_REJECTED');
  if ((request.bodyBytes ?? 0) > (policy.maxBodyBytes ?? 65536)) failures.push('BODY_TOO_LARGE');
  if ((request.requestsInWindow ?? 0) > (policy.maxRequests ?? 60)) failures.push('RATE_LIMITED');
  if (request.botScore !== undefined && request.botScore < (policy.minBotScore ?? 0.2)) failures.push('BOT_REJECTED');
  return freeze({ allowed: failures.length === 0, failures: freeze(failures) });
}

export function evaluateExperiment({ consent = false, control = {}, treatment = {}, limits = {} } = {}) {
  const failures = [];
  if (!consent) failures.push('RESEARCH_CONSENT_REQUIRED');
  for (const metric of ['taskSuccess', 'trust', 'accessibility', 'performance']) {
    if (!finite(control[metric]) || !finite(treatment[metric])) { failures.push(`${metric.toUpperCase()}_MISSING`); continue; }
    const allowedDrop = limits[metric] ?? 0;
    if (treatment[metric] < control[metric] - allowedDrop) failures.push(`${metric.toUpperCase()}_REGRESSION`);
  }
  return freeze({ allowed: failures.length === 0, failures: freeze(failures), darkPatternFree: failures.length === 0 });
}
