import { getCommercePlan } from "./lifepanel-commerce-v1.mjs";

export const WEB_CHECKOUT_READINESS_VERSION = "lifepanel.web-checkout-readiness.v1";
export const WEB_CHECKOUT_PROVIDER = "approved-web";

const REQUIRED_SANDBOX_EVIDENCE = Object.freeze([
  "purchase",
  "cancellation",
  "refund",
  "restore",
]);

function isHttpsUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function rejectSensitiveConfiguration(options) {
  for (const key of Object.keys(options)) {
    if (key !== "serverSecretStorage" && /(secret|token|api.?key|private.?key)/i.test(key)) {
      throw new TypeError("web checkout readiness accepts configuration evidence, not secrets");
    }
  }
}

export function inspectWebCheckoutReadiness(options = {}) {
  rejectSensitiveConfiguration(options);
  const {
    provider = null,
    serverCheckoutUrl = null,
    webhookUrl = null,
    customerPortalUrl = null,
    serverSecretStorage = false,
    webhookSignatureVerification = false,
    sandboxEvidence = {},
  } = options;
  const plan = getCommercePlan("plus-monthly");
  const gates = [
    { id: "approved-provider", ready: provider === WEB_CHECKOUT_PROVIDER, label: "승인된 웹 결제 공급자" },
    { id: "server-checkout", ready: isHttpsUrl(serverCheckoutUrl), label: "HTTPS 서버 결제 경로" },
    { id: "server-webhook", ready: isHttpsUrl(webhookUrl) && webhookSignatureVerification === true, label: "서명 검증 웹훅" },
    { id: "server-secrets", ready: serverSecretStorage === true, label: "서버 전용 비밀 저장소" },
    { id: "customer-portal", ready: isHttpsUrl(customerPortalUrl), label: "공급자 고객 포털" },
    ...REQUIRED_SANDBOX_EVIDENCE.map((id) => ({ id: `sandbox-${id}`, ready: sandboxEvidence[id] === true, label: `sandbox ${id} 증거` })),
  ];
  const blocked = gates.filter((gate) => !gate.ready);
  return {
    version: WEB_CHECKOUT_READINESS_VERSION,
    planId: plan.id,
    candidatePrice: plan.candidatePrice,
    mode: blocked.length === 0 ? "preflight-ready-still-disabled" : "blocked-provider-not-connected",
    checkoutButtonDisabled: true,
    mayCharge: false,
    opensProvider: false,
    storesPaymentMethod: false,
    gates,
    blockedGateIds: blocked.map((gate) => gate.id),
    message: blocked.length === 0
      ? "사전점검은 준비됐지만 실제 결제는 별도 출시 승인과 공개 검증 전까지 꺼져 있습니다."
      : `실제 결제는 꺼져 있습니다. 남은 관문: ${blocked.map((gate) => gate.label).join(", ")}`,
  };
}
