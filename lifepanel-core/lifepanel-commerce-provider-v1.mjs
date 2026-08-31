import {
  LIFEPANEL_COMMERCE_VERSION,
  createVerifiedCommerceEvent,
  getCommercePlan,
} from "./lifepanel-commerce-v1.mjs";

export const COMMERCE_PROVIDER_CONTRACT_VERSION = "lifepanel.commerce-provider.v1";
export const SUPPORTED_COMMERCE_PROVIDERS = Object.freeze(["app-store", "google-play", "approved-web"]);
export const MAX_PROVIDER_BODY_BYTES = 65_536;

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${label} must be a non-empty string`);
  return value.trim();
}

function requireProvider(provider) {
  const value = requireString(provider, "provider");
  if (!SUPPORTED_COMMERCE_PROVIDERS.includes(value)) throw new RangeError("unsupported commerce provider");
  return value;
}

export function createServerCheckoutRequest({ planId, accountReference, idempotencyKey, returnUrl }) {
  const plan = getCommercePlan(planId);
  if (plan.id === "free") throw new RangeError("free plan does not create checkout");
  const safeReturnUrl = new URL(requireString(returnUrl, "return URL"));
  if (safeReturnUrl.protocol !== "https:") throw new RangeError("return URL must use HTTPS");
  return {
    version: COMMERCE_PROVIDER_CONTRACT_VERSION,
    execution: "server-only",
    planId: plan.id,
    accountReference: requireString(accountReference, "account reference"),
    idempotencyKey: requireString(idempotencyKey, "idempotency key"),
    returnUrl: safeReturnUrl.toString(),
    canonicalAmountMinor: plan.candidatePrice.amountMinor,
    canonicalCurrency: plan.candidatePrice.currency,
    trustClientAmount: false,
    rawPaymentMethod: null,
  };
}

export function createReceiptVerificationRequest({ provider, accountReference, receiptSha256, requestedAt = new Date().toISOString() }) {
  const digest = requireString(receiptSha256, "receipt SHA-256").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new TypeError("receipt SHA-256 must be 64 hex characters");
  return {
    version: COMMERCE_PROVIDER_CONTRACT_VERSION,
    execution: "server-only",
    provider: requireProvider(provider),
    accountReference: requireString(accountReference, "account reference"),
    receiptSha256: digest,
    requestedAt: new Date(requestedAt).toISOString(),
    persistRawReceipt: false,
  };
}

export async function verifyProviderNotification({ provider, contentType, rawBody, verifySignature, receivedAt = new Date().toISOString() }) {
  requireProvider(provider);
  if (contentType !== "application/json") throw new TypeError("provider content type must be application/json");
  if (typeof rawBody !== "string" || Buffer.byteLength(rawBody, "utf8") > MAX_PROVIDER_BODY_BYTES) {
    throw new RangeError("provider body is missing or too large");
  }
  if (typeof verifySignature !== "function") throw new TypeError("server signature verifier is required");
  const signatureValid = await verifySignature(rawBody);
  if (signatureValid !== true) throw new TypeError("provider signature verification failed");
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new TypeError("provider body must be valid JSON");
  }
  return createVerifiedCommerceEvent({
    eventId: body.eventId,
    type: body.type,
    accountReference: body.accountReference,
    planId: body.planId,
    occurredAt: body.occurredAt,
    verifiedAt: receivedAt,
    validUntil: body.validUntil || null,
  });
}

export function createCommerceAuditRecord({ provider, event, outcome, recordedAt = new Date().toISOString() }) {
  requireProvider(provider);
  if (!event || event.version !== LIFEPANEL_COMMERCE_VERSION || event.source !== "verified-provider") {
    throw new TypeError("verified commerce event required");
  }
  if (!["applied", "duplicate-ignored", "stale-ignored", "rejected"].includes(outcome)) {
    throw new RangeError("invalid commerce audit outcome");
  }
  return {
    version: COMMERCE_PROVIDER_CONTRACT_VERSION,
    provider,
    eventId: event.eventId,
    eventType: event.type,
    accountReference: event.accountReference,
    outcome,
    recordedAt: new Date(recordedAt).toISOString(),
    rawReceipt: null,
    rawPaymentMethod: null,
  };
}
