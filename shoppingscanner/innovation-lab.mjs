import { calculateInternationalLandedCost, createEncryptedSyncPlan, createQualityReport, createSharedDecision, evaluateRevenueDiversification, localizeProduct, networkTrustMode, normalizeDiscoveryInput, recordSavings, simpleExperiencePolicy, sustainabilityPassport, verifyReviewProvenance } from './stage2-expansion-core.mjs';

const $ = selector => document.querySelector(selector);
const show = (selector, text, warn = false) => { const node = $(selector); node.textContent = text; node.dataset.state = warn ? 'warn' : 'ok'; };
const n = selector => { const value = $(selector).value; return value === '' ? null : Number(value); };

$('#discovery-type').addEventListener('change', event => {
  const type = event.target.value; $('#photo-consent').closest('label').hidden = type !== 'photo'; $('#discovery-value-label').hidden = type === 'photo';
});
$('#discovery-type').dispatchEvent(new Event('change'));
$('#discovery-run').addEventListener('click', () => {
  const type = $('#discovery-type').value;
  const result = normalizeDiscoveryInput(type === 'photo' ? { type, consent: $('#photo-consent').checked, mime: 'image/jpeg', size: 500000 } : { type, value: $('#discovery-value').value });
  show('#discovery-result', result.ok ? `${result.code} · 원본 보존 ${result.originalRetained ? '예' : '아니오'} · 실패 시 ${result.fallback} 대체` : `${result.code} · 텍스트 입력으로 계속할 수 있습니다.`, !result.ok);
});

$('#access-run').addEventListener('click', () => {
  const simple = simpleExperiencePolicy({ enabled: $('#simple-mode').checked });
  const network = $('#network-mode').value;
  const trust = networkTrustMode({ online: network !== 'offline', effectiveType: network === 'offline' ? 'unknown' : network, downlink: network === '2g' ? .2 : 10, lastVerifiedAt: '2026-08-09T08:00:33Z' });
  document.body.dataset.simple = String(simple.enabled);
  show('#access-result', `${simple.enabled ? '단순' : '표준'} 화면 · 핵심 행동 최대 ${simple.maxPrimaryActions}개 · ${trust.mode} · 라이브 주장 ${trust.mayClaimLive ? '가능' : '금지'} · 오래됨 표시 ${trust.staleDisclosureRequired ? '필수' : '조건부'}`);
});

$('#global-run').addEventListener('click', () => {
  const locale = $('#locale').value;
  const localized = localizeProduct({ title: '검증 원문 상품', translations: { 'en-US': { title: 'Verified source product' }, 'th-TH': { title: 'สินค้าจากแหล่งที่ตรวจสอบแล้ว' }, 'ja-JP': { title: '検証済みソース商品' } } }, locale);
  const total = calculateInternationalLandedCost({ country: $('#country').value, currency: 'USD', targetCurrency: 'KRW', exchangeRate: n('#intl-rate'), exchangeRateObservedAt: '2026-08-31T00:00:00Z', exchangeRateSource: 'UI synthetic fixture — not live', itemAmount:n('#intl-item'), internationalShipping:n('#intl-ship'), duty:n('#intl-duty'), tax:n('#intl-tax'), brokerage:n('#intl-broker'), localDelivery:n('#intl-local') });
  show('#global-result', total.calculable ? `${localized.title} · 시험 환산 총액 ₩${total.convertedTotal.toLocaleString('ko-KR')} · 실제 결제 전 판매처 확인 필수` : `${localized.title} · 미확인: ${total.missing.join(', ') || '환율 출처/시각'} · 총액 확정 금지`, !total.calculable);
});

$('#sync-run').addEventListener('click', () => {
  const enabled = $('#sync-enabled').checked;
  const plan = createEncryptedSyncPlan({ enabled, recoveryKeyId: enabled ? 'device-generated-demo' : null, deviceIds: enabled ? ['this-device'] : [] });
  const ids = $('#share-products').value.split(',').map(value => value.trim()).filter(Boolean);
  const share = createSharedDecision({ title: $('#share-title').value, candidates: ids.map(productId => ({ productId })), criteria: ['총비용', '근거 신뢰'] });
  show('#sync-result', `${plan.enabled ? 'AES-256-GCM 선택 동기화' : '동기화 OFF·로컬 정본'} · 제외 ${plan.excludedScopes.length}종 · 공동결정 ${share.completion} · 결제/민감정보 포함 없음`);
});

$('#quality-run').addEventListener('click', () => {
  const report = createQualityReport({ type: $('#report-type').value, severity: 'high', productId: 'ui-selected-product', description: $('#report-description').value });
  const review = verifyReviewProvenance({ sourceUrl: $('#review-source').value, authoredAt: '2026-08-31T00:00:00Z', authorType: 'user', verificationStatus: 'unverified', interests: [] });
  const revenue = evaluateRevenueDiversification([{ type:'affiliate', amount:0, evidenceStatus:'forecast' }, { type:'contextual_ads', amount:0, evidenceStatus:'forecast' }]);
  show('#quality-result', `${report.accepted ? '익명 신고 접수 가능' : '신고 입력 보완 필요'} · 목표 ${report.targetHours}시간 · 리뷰 ${review.publishable ? '출처 구조 통과' : `차단(${review.failures.join(',')})`} · 수익 ${revenue.state}`, !report.accepted || !review.publishable);
});

$('#value-run').addEventListener('click', () => {
  const verified = $('#purchase-verified').checked;
  const savings = recordSavings({ savedPrice:n('#saved-price'), paidPrice:n('#paid-price'), purchaseVerified:verified, purchaseEvidenceId:verified?'ui-receipt-demo':null, purchasedAt:verified?'2026-08-31T00:00:00Z':null });
  const repair = $('#repair-verified').checked;
  const passport = sustainabilityPassport(repair ? { repairability:{value:'공식 점수 확인',sourceId:'official'}, evidence:{official:{url:'https://official.example/repair',observedAt:'2026-08-31T00:00:00Z'}} } : {});
  show('#value-result', `${savings.claimable ? `검증 가능 절약 ₩${savings.amount.toLocaleString('ko-KR')}` : '구매 증거 없어 절약액 주장 금지'} · 수리성 ${passport.supported ? '출처 연결' : '미확인'} · 친환경 단정 ${passport.greenClaimAllowed ? '가능' : '금지'}`, !savings.claimable || !passport.supported);
});

window.ShoppingScannerStage2Lab = Object.freeze({ version:'v1', syntheticOnly:true, actualUsers:0, actualMerchants:0 });
