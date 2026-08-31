const freeze = value => Object.freeze(value);
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const date = value => text(value) && Number.isFinite(Date.parse(value));
const nonNegative = value => Number.isFinite(value) && value >= 0;
const supportedLanguages = new Set(['ko-KR', 'en-US', 'th-TH', 'ja-JP']);
const supportedCountries = new Set(['KR', 'US', 'TH', 'JP']);

export function normalizeDiscoveryInput(input = {}) {
  const type = input.type;
  if (!['barcode', 'photo', 'link', 'text'].includes(type)) return freeze({ ok: false, code: 'INPUT_TYPE_UNSUPPORTED', fallback: 'text' });
  if (type === 'barcode') {
    const value = String(input.value ?? '').replace(/[^0-9]/g, '');
    const ok = [8, 12, 13, 14].includes(value.length);
    return freeze({ ok, type, value: ok ? value : '', code: ok ? 'BARCODE_READY' : 'BARCODE_INVALID', originalRetained: false, fallback: 'text' });
  }
  if (type === 'link') {
    try {
      const url = new URL(String(input.value ?? ''));
      const ok = url.protocol === 'https:' && !url.username && !url.password;
      return freeze({ ok, type, value: ok ? `${url.origin}${url.pathname}` : '', code: ok ? 'LINK_READY_QUERY_STRIPPED' : 'LINK_REJECTED', originalRetained: false, fallback: 'text' });
    } catch { return freeze({ ok: false, type, value: '', code: 'LINK_INVALID', originalRetained: false, fallback: 'text' }); }
  }
  if (type === 'photo') {
    const consent = input.consent === true;
    const mime = String(input.mime ?? '');
    const size = Number(input.size ?? 0);
    const ok = consent && ['image/jpeg', 'image/png', 'image/webp'].includes(mime) && size > 0 && size <= 8_000_000;
    return freeze({ ok, type, value: ok ? 'memory-only-image' : '', code: ok ? 'PHOTO_MEMORY_ONLY_READY' : consent ? 'PHOTO_INVALID' : 'PHOTO_CONSENT_REQUIRED', processing: 'on-device-or-ephemeral', originalRetained: false, synchronized: false, fallback: 'text' });
  }
  const value = String(input.value ?? '').trim().slice(0, 200);
  return freeze({ ok: value.length >= 2, type, value, code: value.length >= 2 ? 'TEXT_READY' : 'TEXT_TOO_SHORT', originalRetained: false, fallback: 'text' });
}

export function discoveryDecision(candidates = [], input = {}) {
  const normalized = normalizeDiscoveryInput(input);
  if (!normalized.ok) return freeze({ decision: 'FALLBACK_TEXT', exact: null, candidates: freeze([]), ...normalized });
  const safe = candidates.filter(row => plain(row) && text(row.id)).map(row => ({ id: String(row.id), gtin: String(row.gtin ?? ''), canonicalUrl: String(row.canonicalUrl ?? ''), score: Number(row.score ?? 0), title: String(row.title ?? '') }));
  const exact = normalized.type === 'barcode' ? safe.find(row => row.gtin === normalized.value) : normalized.type === 'link' ? safe.find(row => row.canonicalUrl === normalized.value) : null;
  if (exact) return freeze({ decision: 'EXACT', exact: freeze(exact), candidates: freeze([exact]), input: normalized });
  const ranked = safe.filter(row => row.score >= 0.5).sort((a, b) => b.score - a.score).slice(0, 3).map(freeze);
  return freeze({ decision: ranked.length ? 'CANDIDATES' : 'NO_MATCH', exact: null, candidates: freeze(ranked), input: normalized });
}

export function simpleExperiencePolicy(options = {}) {
  const enabled = options.enabled === true;
  return freeze({ enabled, density: enabled ? 'low' : 'standard', maxPrimaryActions: enabled ? 3 : 7, sentencesPerStep: enabled ? 2 : 5, destructiveConfirmation: true, undoSeconds: 30, largeTargets: enabled, motion: enabled ? 'none' : 'reduced-when-requested', helpAlwaysVisible: enabled });
}

export function networkTrustMode(input = {}) {
  const online = input.online !== false;
  const effectiveType = String(input.effectiveType ?? 'unknown');
  const slow = !online || ['slow-2g', '2g'].includes(effectiveType) || Number(input.downlink ?? 10) < 0.5;
  const lastVerifiedAt = date(input.lastVerifiedAt) ? input.lastVerifiedAt : null;
  return freeze({ mode: !online ? 'offline' : slow ? 'low-speed' : 'standard', prioritize: freeze(['identity', 'observed-price', 'freshness', 'merchant-link']), defer: slow ? freeze(['photos', 'reviews', 'recommendations']) : freeze([]), lastVerifiedAt, staleDisclosureRequired: !online || !lastVerifiedAt, mayClaimLive: online && !slow && Boolean(lastVerifiedAt), targetFirstCoreMs: 3000 });
}

const glossary = freeze({
  'ko-KR': freeze({ shipping: '배송', warranty: '보증', refurbished: '리퍼비시', unknown: '미확인' }),
  'en-US': freeze({ shipping: 'Shipping', warranty: 'Warranty', refurbished: 'Refurbished', unknown: 'Unknown' }),
  'th-TH': freeze({ shipping: 'การจัดส่ง', warranty: 'การรับประกัน', refurbished: 'สินค้าปรับสภาพ', unknown: 'ไม่ทราบ' }),
  'ja-JP': freeze({ shipping: '配送', warranty: '保証', refurbished: '整備済み', unknown: '未確認' }),
});

export function localizeProduct(product = {}, language = 'ko-KR') {
  const locale = supportedLanguages.has(language) ? language : 'ko-KR';
  const translations = plain(product.translations) ? product.translations : {};
  const translated = plain(translations[locale]) ? translations[locale] : {};
  const sourceTitle = text(product.title) ? product.title.trim() : null;
  return freeze({ locale, title: text(translated.title) ? translated.title.trim() : sourceTitle, titleState: text(translated.title) ? 'verified-translation' : sourceTitle ? 'source-language' : 'unknown', attributes: plain(translated.attributes) ? freeze({ ...translated.attributes }) : freeze({}), glossary: glossary[locale], machineGenerated: false, unsupportedFieldsStayUnknown: true });
}

export function calculateInternationalLandedCost(input = {}) {
  const country = String(input.country ?? '').toUpperCase();
  const currency = String(input.currency ?? '').toUpperCase();
  const targetCurrency = String(input.targetCurrency ?? '').toUpperCase();
  const rate = input.exchangeRate;
  const rateKnown = nonNegative(rate) && rate > 0 && date(input.exchangeRateObservedAt) && text(input.exchangeRateSource);
  const components = ['itemAmount', 'internationalShipping', 'duty', 'tax', 'brokerage', 'localDelivery'];
  const missing = components.filter(key => !nonNegative(input[key]));
  const sourceTotal = missing.length ? null : components.reduce((sum, key) => sum + input[key], 0);
  const converted = sourceTotal !== null && rateKnown ? Math.round(sourceTotal * rate * 100) / 100 : null;
  return freeze({ country, countrySupported: supportedCountries.has(country), currency, targetCurrency, exchangeRate: rateKnown ? rate : null, exchangeRateObservedAt: rateKnown ? input.exchangeRateObservedAt : null, exchangeRateSource: rateKnown ? input.exchangeRateSource : null, components: freeze(Object.fromEntries(components.map(key => [key, nonNegative(input[key]) ? input[key] : null]))), missing: freeze(missing), calculable: sourceTotal !== null && rateKnown, sourceTotal, convertedTotal: converted, guarantee: false, finalMerchantCheckoutRequired: true });
}

const syncExcluded = freeze(['rawSearchQueries', 'cameraOriginals', 'fullMerchantVisitHistory', 'paymentData']);
export function createEncryptedSyncPlan(input = {}) {
  const enabled = input.enabled === true;
  const recoveryKeyPresent = text(input.recoveryKeyId);
  const devices = Array.isArray(input.deviceIds) ? [...new Set(input.deviceIds.filter(text).map(String))].slice(0, 10) : [];
  return freeze({ enabled, defaultOff: true, localCanonical: true, algorithm: enabled ? 'AES-256-GCM' : null, kdf: enabled ? 'PBKDF2-SHA256-250000-or-platform-keystore' : null, recoveryReady: enabled && recoveryKeyPresent, deviceIds: freeze(devices), synchronizedScopes: enabled ? freeze(['savedProducts', 'comparisons', 'decisionCriteria', 'notes']) : freeze([]), excludedScopes: syncExcluded, accountDeletionDeletesRemoteCiphertext: true, providerCanReadPlaintext: false });
}

export function mergeEncryptedSnapshots(local = {}, remote = {}, choices = {}) {
  const keys = [...new Set([...Object.keys(local), ...Object.keys(remote)])].filter(key => !syncExcluded.includes(key)).sort();
  const merged = {};
  const conflicts = [];
  for (const key of keys) {
    const left = local[key]; const right = remote[key];
    if (JSON.stringify(left) === JSON.stringify(right) || right === undefined) merged[key] = left;
    else if (left === undefined) merged[key] = right;
    else if (choices[key] === 'local') merged[key] = left;
    else if (choices[key] === 'remote') merged[key] = right;
    else conflicts.push(key);
  }
  return freeze({ ready: conflicts.length === 0, merged: freeze(merged), conflicts: freeze(conflicts), previewRequired: conflicts.length > 0, dataLossDetected: false, excludedScopes: syncExcluded });
}

export function createSharedDecision(input = {}) {
  const candidates = Array.isArray(input.candidates) ? input.candidates.filter(row => plain(row) && text(row.productId)).slice(0, 20).map(row => freeze({ productId: String(row.productId), label: String(row.label ?? '').slice(0, 100) })) : [];
  const criteria = Array.isArray(input.criteria) ? input.criteria.filter(text).map(value => String(value).slice(0, 80)).slice(0, 10) : [];
  const comments = Array.isArray(input.comments) ? input.comments.filter(row => plain(row) && text(row.text)).slice(0, 100).map(row => freeze({ alias: String(row.alias ?? '참여자').slice(0, 30), text: String(row.text).slice(0, 500), at: date(row.at) ? row.at : null })) : [];
  return freeze({ schema: 'shopping-scanner-shared-decision/v1', title: String(input.title ?? '공유 결정').slice(0, 80), candidates: freeze(candidates), criteria: freeze(criteria), comments: freeze(comments), includesPaymentData: false, includesSensitiveProfile: false, completion: candidates.length >= 2 && criteria.length >= 1 ? 'ready-to-decide' : 'draft', ownerCanRevoke: true });
}

export function evaluateRevenueDiversification(streams = []) {
  const valid = streams.filter(row => plain(row) && ['affiliate', 'contextual_ads', 'sponsorship_no_data', 'donation'].includes(row.type) && nonNegative(row.amount));
  const actual = valid.filter(row => row.evidenceStatus === 'verified');
  const total = actual.reduce((sum, row) => sum + row.amount, 0);
  const shares = total ? Object.fromEntries(actual.map(row => [row.type, Math.round(row.amount / total * 10000) / 100])) : {};
  const maxShare = Math.max(0, ...Object.values(shares));
  return freeze({ actualRevenueTotal: total, shares: freeze(shares), largestSharePercent: total ? maxShare : null, diversified: total > 0 && maxShare < 60, state: total ? 'actual-evidence' : 'forecast-only-no-actual-revenue', rankingInfluenceAllowed: false, personalDataSaleAllowed: false });
}

export function createMerchantCorrection(input = {}) {
  const fields = Array.isArray(input.fields) ? [...new Set(input.fields.filter(value => ['identity', 'offer', 'stock', 'shipping', 'policy', 'seller'].includes(value)))] : [];
  const evidence = Array.isArray(input.evidence) ? input.evidence.filter(row => plain(row) && text(row.url) && date(row.observedAt)).slice(0, 10) : [];
  const verifiedMerchant = input.merchantVerified === true;
  return freeze({ accepted: verifiedMerchant && text(input.merchantId) && fields.length > 0 && evidence.length > 0, state: !verifiedMerchant ? 'merchant-verification-required' : evidence.length === 0 ? 'evidence-required' : fields.length === 0 ? 'field-required' : 'queued', merchantId: text(input.merchantId) ? input.merchantId : null, fields: freeze(fields), evidenceCount: evidence.length, targetMedianHours: 24, automaticPublish: false, auditTrailRequired: true });
}

export function createQualityReport(input = {}) {
  const type = input.type;
  const validType = ['mismatch', 'bait', 'broken_link', 'stale', 'policy'].includes(type);
  const severity = ['low', 'medium', 'high', 'critical'].includes(input.severity) ? input.severity : 'medium';
  const accepted = validType && text(input.productId) && text(input.description) && input.description.trim().length >= 10;
  return freeze({ accepted, type: validType ? type : null, productId: text(input.productId) ? String(input.productId) : null, severity, state: accepted ? 'received-anonymous' : 'rejected-invalid', targetHours: ['high', 'critical'].includes(severity) ? 24 : 72, reward: accepted ? freeze({ kind: 'non-cash-quality-credit', promisedValue: false, eligibleAfterVerification: true }) : null, personalDataRequired: false, statusTokenIssued: accepted });
}

export function verifyReviewProvenance(review = {}) {
  const interests = Array.isArray(review.interests) ? review.interests.filter(text).map(String) : [];
  const failures = [];
  if (!text(review.sourceUrl)) failures.push('SOURCE_MISSING');
  else { try { if (new URL(review.sourceUrl).protocol !== 'https:') failures.push('SOURCE_INVALID'); } catch { failures.push('SOURCE_INVALID'); } }
  if (!date(review.authoredAt)) failures.push('AUTHORED_AT_MISSING');
  if (!['expert', 'verified-user', 'user', 'merchant'].includes(review.authorType)) failures.push('AUTHOR_TYPE_INVALID');
  if (!['verified', 'unverified', 'disputed'].includes(review.verificationStatus)) failures.push('VERIFICATION_STATUS_INVALID');
  if (!Array.isArray(review.interests)) failures.push('INTEREST_DISCLOSURE_MISSING');
  return freeze({ publishable: failures.length === 0, failures: freeze(failures), sourceUrl: text(review.sourceUrl) ? review.sourceUrl : null, authoredAt: date(review.authoredAt) ? review.authoredAt : null, updatedAt: date(review.updatedAt) ? review.updatedAt : null, authorType: review.authorType ?? null, verificationStatus: review.verificationStatus ?? null, interests: freeze(interests), affiliateInfluenceOnScore: false });
}

export function recordSavings(input = {}) {
  const savedPrice = nonNegative(input.savedPrice) ? input.savedPrice : null;
  const paidPrice = nonNegative(input.paidPrice) ? input.paidPrice : null;
  const purchaseVerified = input.purchaseVerified === true && text(input.purchaseEvidenceId) && date(input.purchasedAt);
  const amount = purchaseVerified && savedPrice !== null && paidPrice !== null ? Math.max(0, savedPrice - paidPrice) : null;
  return freeze({ claimable: purchaseVerified && amount !== null, amount, currency: text(input.currency) ? input.currency : 'KRW', savedPrice, paidPrice, purchaseVerified, evidenceId: purchaseVerified ? input.purchaseEvidenceId : null, exaggerationBlocked: true });
}

export function regretPreventionLedger(entries = []) {
  const allowed = new Set(['return', 'repurchase', 'repair', 'warranty', 'usage-period']);
  const safe = entries.filter(row => plain(row) && allowed.has(row.type) && date(row.at)).slice(0, 100).map(row => freeze({ type: row.type, at: row.at, evidenceId: text(row.evidenceId) ? row.evidenceId : null, note: String(row.note ?? '').slice(0, 300) }));
  const verified = safe.filter(row => row.evidenceId).length;
  return freeze({ entries: freeze(safe), verifiedCount: verified, regretSignals: safe.filter(row => ['return', 'repair', 'repurchase'].includes(row.type)).length, conclusion: safe.length ? 'user-controlled-evidence-ledger' : 'insufficient-data', noBehavioralDiagnosis: true });
}

export function sustainabilityPassport(input = {}) {
  const keys = ['repairability', 'expectedLifeYears', 'energyUse', 'usedAvailability', 'refurbishedAvailability'];
  const evidence = plain(input.evidence) ? input.evidence : {};
  const signals = {};
  for (const key of keys) {
    const item = plain(input[key]) ? input[key] : null;
    signals[key] = item && text(item.value) && text(item.sourceId) && plain(evidence[item.sourceId]) && text(evidence[item.sourceId].url) && date(evidence[item.sourceId].observedAt) ? freeze({ state: 'verified-source', value: item.value, sourceId: item.sourceId }) : freeze({ state: 'unknown', value: null, sourceId: null });
  }
  const verified = Object.values(signals).filter(row => row.state === 'verified-source').length;
  return freeze({ signals: freeze(signals), coveragePercent: Math.round(verified / keys.length * 100), greenClaimAllowed: verified === keys.length, supported: verified > 0, missingStayUnknown: true, rankingPenaltyForUnknown: false });
}

export const STAGE2_ENGINEERING_IDS = freeze(['I16','I19','I23','I24','I25','I26','I32','I33','I34','I35','I36','I37','I38']);
