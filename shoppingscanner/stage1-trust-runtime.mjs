import { buildEvidencePassport, calculateLandedCost, detectBaitOffer, freshnessReceipt } from './stage1-trust-core.mjs';

const panel = document.querySelector('#stage1-trust-panel');
const currency = new Intl.NumberFormat('ko-KR');
const stateLabel = Object.freeze({ fresh: '최신 범위', aging: '갱신 필요', stale: '오래된 자료', unknown: '시각 미확인' });

function safeProduct(input) {
  return Object.freeze({
    id: String(input?.id ?? ''),
    title: String(input?.title ?? ''),
    price: Number.isInteger(input?.price) && input.price >= 0 ? input.price : null,
    source: input?.source === '11st' ? '11번가 공개 목록' : '출처 미확인',
    observedAt: input?.capturedAt ?? input?.observedAt ?? null,
    sourceMerchantCount: 1,
  });
}

function render(input) {
  if (!panel) return;
  const product = safeProduct(input);
  const freshness = freshnessReceipt(product.observedAt);
  const offer = {
    basePrice: product.price,
    title: product.title,
    observedAt: product.observedAt,
    shippingState: 'unknown', shippingAmount: null,
    optionCostState: 'unknown', optionCostAmount: null,
    taxState: 'unknown', taxAmount: null,
    installationState: 'unknown', installationAmount: null,
    couponState: 'unknown', couponAmount: null,
    returnCostState: 'unknown', returnCostAmount: null,
  };
  const cost = calculateLandedCost(offer);
  const bait = detectBaitOffer(offer, []);
  const passport = buildEvidencePassport({
    product: { title: product.title, source: product.source, observedAt: product.observedAt },
    offer: { basePrice: product.price, source: product.source, observedAt: product.observedAt },
    recommendation: '판매처 재확인 전 후보',
    reasonsFor: ['원본 판매처 상품 번호와 관측 가격이 있음'],
    reasonsAgainst: ['단일 판매처 스냅샷', 'GTIN·모델·옵션 미확인', '총비용·재고·정책 미확인'],
    compensation: { affiliate: false, advertising: false, rankingImpact: false },
  });
  const dangerous = bait.severity === 'critical';
  const level = freshness.state === 'fresh' && !dangerous ? 'safe' : 'caution';
  panel.dataset.freshness = freshness.state;
  panel.dataset.bait = bait.flagged ? bait.severity : 'none';
  panel.dataset.totalCost = cost.calculable ? 'known' : 'unknown';
  panel.dataset.multiRetailer = 'unavailable';
  panel.innerHTML = `
    <div class="s1t-head"><div><span>1단계 신뢰 영수증</span><h3 id="stage1-trust-title">이 후보를 지금 믿을 수 있는 범위</h3></div><b class="s1t-badge" data-level="${level}">${stateLabel[freshness.state]}</b></div>
    <p class="s1t-summary">확인된 사실과 아직 없는 자료를 분리했습니다. 자료가 없으면 최저가·재고 있음·무료배송으로 추정하지 않습니다.</p>
    <div class="s1t-grid">
      <div class="s1t-item"><b>관측 상품가</b><strong>${product.price === null ? '확인 불가' : `₩${currency.format(product.price)}`}</strong><small>${product.source} · ${product.observedAt ? new Date(product.observedAt).toLocaleString('ko-KR') : '시각 미상'}</small></div>
      <div class="s1t-item"><b>상품 정체성</b><strong>검토 필요</strong><small>GTIN·제조사 모델·옵션 원자료가 없어 동일상품 자동 병합 금지</small></div>
      <div class="s1t-item"><b>다중 판매처</b><strong>현재 제공 안 함</strong><small>이 후보에는 11번가 스냅샷 한 곳만 있으며 가격비교로 표시하지 않음</small></div>
      <div class="s1t-item"><b>총비용</b><strong>${cost.calculable ? `₩${currency.format(cost.total)}` : '확정 불가'}</strong><small>배송·설치·세금·쿠폰·반품비 자료가 모두 있어야 합계 제공</small></div>
    </div>
    ${bait.flagged ? `<p class="s1t-warning"><b>유인가 검토 필요:</b> ${bait.reasons.join(' · ')}. 판매처에서 본품·옵션·약정 조건을 확인하세요.</p>` : '<p class="s1t-warning">현재 가격만으로 실제 할인 또는 최저가라고 판정하지 않습니다. 가격 이력과 여러 판매처 총비용이 필요합니다.</p>'}
    <p class="s1t-evidence"><b>추천 근거 여권:</b> 찬성 ${passport.reasonsFor.length}개 · 반대 ${passport.reasonsAgainst.length}개 · 미확인 ${passport.unknown.length}개 · 제휴/광고 순위 영향 없음. <a href="/quality-status/">전체 데이터 품질 상태</a></p>`;
  panel.hidden = false;
}

window.addEventListener('shopping-scanner-product-detail', event => render(event.detail?.product));
window.ShoppingScannerStage1Trust = Object.freeze({ version: 'v1', render, strictMissingData: true, compensationRankingImpact: false });
