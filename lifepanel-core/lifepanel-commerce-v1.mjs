export const LIFEPANEL_COMMERCE_VERSION = "lifepanel.commerce.v1";
export const LIFEPANEL_COMMERCE_MODE = "provider-not-connected";
export const COMMERCE_EVENT_TYPES = Object.freeze([
  "checkout-created",
  "purchase-approved",
  "renewal-approved",
  "grace-started",
  "purchase-expired",
  "purchase-refunded",
  "purchase-revoked",
]);

export const LIFEPANEL_PLANS = Object.freeze([
  Object.freeze({
    id: "free",
    label: "무료",
    billingPeriod: "none",
    candidatePrice: Object.freeze({ currency: "KRW", amountMinor: 0, includesTax: true }),
    available: true,
    benefits: Object.freeze(["오늘 조종석", "기기 안 저장", "판번호 사본 내보내기·복원"]),
  }),
  Object.freeze({
    id: "plus-monthly",
    label: "Plus 월간",
    billingPeriod: "month",
    candidatePrice: Object.freeze({ currency: "KRW", amountMinor: 4900, includesTax: true }),
    available: false,
    benefits: Object.freeze(["8개 영역 포트폴리오", "고급 패널 구성", "안전한 여러 기기 자료 합치기", "7~365일 실험", "기기 안 작업 쪼개기", "가족·돌봄 계획", "전문가 제한 공유"]),
  }),
]);

const planById = new Map(LIFEPANEL_PLANS.map((plan) => [plan.id, plan]));

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function requireIso(value, label) {
  const text = requireString(value, label);
  if (Number.isNaN(new Date(text).getTime())) throw new TypeError(`${label} must be ISO date-time`);
  return new Date(text).toISOString();
}

export function getCommercePlan(planId) {
  const plan = planById.get(planId);
  if (!plan) throw new RangeError("unknown commerce plan");
  return plan;
}

export function formatCandidatePrice(planId, locale = "ko-KR") {
  const plan = getCommercePlan(planId);
  if (plan.candidatePrice.amountMinor === 0) return "무료";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: plan.candidatePrice.currency,
    maximumFractionDigits: 0,
  }).format(plan.candidatePrice.amountMinor);
}

export function createCheckoutDisclosure(planId) {
  const plan = getCommercePlan(planId);
  if (plan.id === "free") {
    return {
      version: LIFEPANEL_COMMERCE_VERSION,
      planId: plan.id,
      chargeable: false,
      title: "무료판은 결제 없이 계속 사용할 수 있습니다.",
      lines: ["자동 갱신 없음", "결제 수단 수집 없음", "언제든 기기 자료를 내보내거나 삭제 가능"],
    };
  }
  return {
    version: LIFEPANEL_COMMERCE_VERSION,
    planId: plan.id,
    chargeable: false,
    title: `${plan.label} · 출시 후보 ${formatCandidatePrice(plan.id)}/월`,
    lines: [
      "현재 결제 공급자가 연결되지 않아 실제 구매할 수 없음",
      "출시 뒤 결제창의 현지 통화·세금 포함 최종 금액이 우선",
      "월 단위 자동 갱신 후보이며 다음 결제 전 스토어에서 취소 가능",
      "구매 복원·환불·취소 결과는 검증된 공급자 응답으로만 권리에 반영",
    ],
  };
}

export function createPurchaseIntent({ planId, idempotencyKey, accountReference, createdAt = new Date().toISOString() }) {
  const plan = getCommercePlan(planId);
  if (!plan.available || plan.id === "free") throw new RangeError("plan is not available for purchase");
  return {
    version: LIFEPANEL_COMMERCE_VERSION,
    mode: LIFEPANEL_COMMERCE_MODE,
    planId: plan.id,
    idempotencyKey: requireString(idempotencyKey, "idempotency key"),
    accountReference: requireString(accountReference, "account reference"),
    createdAt: requireIso(createdAt, "created at"),
    status: "blocked-provider-not-connected",
    amountMinor: plan.candidatePrice.amountMinor,
    currency: plan.candidatePrice.currency,
    rawPaymentMethod: null,
  };
}

export function createEmptyEntitlement(accountReference) {
  return {
    version: LIFEPANEL_COMMERCE_VERSION,
    accountReference: requireString(accountReference, "account reference"),
    planId: "free",
    status: "free",
    validUntil: null,
    lastVerifiedAt: null,
    processedEventIds: [],
  };
}

export function createVerifiedCommerceEvent({
  eventId,
  type,
  accountReference,
  planId = "plus-monthly",
  occurredAt,
  verifiedAt,
  validUntil = null,
}) {
  if (!COMMERCE_EVENT_TYPES.includes(type)) throw new RangeError("unknown commerce event type");
  const plan = getCommercePlan(planId);
  if (plan.id === "free") throw new RangeError("paid event requires paid plan");
  return {
    version: LIFEPANEL_COMMERCE_VERSION,
    eventId: requireString(eventId, "event id"),
    type,
    source: "verified-provider",
    accountReference: requireString(accountReference, "account reference"),
    planId: plan.id,
    occurredAt: requireIso(occurredAt, "occurred at"),
    verifiedAt: requireIso(verifiedAt, "verified at"),
    validUntil: validUntil ? requireIso(validUntil, "valid until") : null,
  };
}

function nextStatus(type) {
  if (["purchase-approved", "renewal-approved"].includes(type)) return "active";
  if (type === "grace-started") return "grace";
  if (type === "purchase-expired") return "expired";
  if (type === "purchase-refunded") return "refunded";
  if (type === "purchase-revoked") return "revoked";
  return "pending";
}

export function applyVerifiedCommerceEvent(entitlement, event) {
  if (!entitlement || entitlement.version !== LIFEPANEL_COMMERCE_VERSION) {
    throw new TypeError("invalid entitlement");
  }
  if (!event || event.version !== LIFEPANEL_COMMERCE_VERSION || event.source !== "verified-provider") {
    throw new TypeError("unverified commerce event");
  }
  if (entitlement.accountReference !== event.accountReference) throw new RangeError("account mismatch");
  if (entitlement.processedEventIds.includes(event.eventId)) {
    return { entitlement, outcome: "duplicate-ignored" };
  }
  if (entitlement.lastVerifiedAt && new Date(event.verifiedAt) < new Date(entitlement.lastVerifiedAt)) {
    return { entitlement, outcome: "stale-ignored" };
  }
  const status = nextStatus(event.type);
  return {
    outcome: "applied",
    entitlement: {
      ...entitlement,
      planId: status === "expired" || status === "refunded" || status === "revoked" ? "free" : event.planId,
      status,
      validUntil: status === "active" || status === "grace" ? event.validUntil : null,
      lastVerifiedAt: event.verifiedAt,
      processedEventIds: [...entitlement.processedEventIds, event.eventId].slice(-100),
    },
  };
}

export function canUsePaidFeatures(entitlement, nowIso = new Date().toISOString()) {
  if (!entitlement || !["active", "grace"].includes(entitlement.status)) return false;
  if (!entitlement.validUntil) return entitlement.status === "grace";
  return new Date(entitlement.validUntil) > new Date(requireIso(nowIso, "now"));
}

export function createRestoreRequest({ accountReference, provider, requestedAt = new Date().toISOString() }) {
  return {
    version: LIFEPANEL_COMMERCE_VERSION,
    accountReference: requireString(accountReference, "account reference"),
    provider: requireString(provider, "provider"),
    requestedAt: requireIso(requestedAt, "requested at"),
    mode: "read-only-provider-query",
    mayCharge: false,
    rawPaymentMethod: null,
  };
}

export function commercialReadinessScore({ providerAdapterContractVerified = false, providerConnected = false, realPurchaseVerified = false } = {}) {
  const verified = {
    productAndCandidatePrice: 15,
    checkoutAndIdempotencyContract: 25,
    cancelRefundRestoreContract: 20,
    accessibleDisclosureUi: 15,
    privacyAndPaymentDataBoundary: 10,
    providerAdapterContract: providerAdapterContractVerified ? 10 : 0,
    livePurchaseAndRefundEvidence: providerConnected && realPurchaseVerified ? 5 : 0,
  };
  return {
    version: LIFEPANEL_COMMERCE_VERSION,
    score: Object.values(verified).reduce((sum, value) => sum + value, 0),
    maximum: 100,
    verified,
    launchBlocked: verified.livePurchaseAndRefundEvidence < 5,
  };
}
