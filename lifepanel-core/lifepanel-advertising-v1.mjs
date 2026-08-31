export const LIFEPANEL_ADVERTISING_VERSION = "lifepanel.advertising.v1";
export const LIFEPANEL_AD_CONSENT_KEY = "lifepanel.alpha.ad-consent.v1";
export const LIFEPANEL_AD_MODES = Object.freeze(["off", "limited"]);

const PUBLISHER_ID = /^ca-pub-\d{16}$/;
const SLOT_ID = /^\d{10}$/;
const SAFE_SURFACES = new Set(["resource-inline", "resource-footer"]);
const BLOCKED_CONTEXT = /(health|medical|diagnosis|finance|bank|crisis|danger|privacy|delete|account|location|relationship-detail)/i;

function freezeResult(value) {
  return Object.freeze(value);
}

export function createAdConsent(mode = "off", now = new Date().toISOString()) {
  if (!LIFEPANEL_AD_MODES.includes(mode)) throw new TypeError("Unsupported advertising consent mode");
  return freezeResult({
    version: LIFEPANEL_ADVERTISING_VERSION,
    mode,
    personalizedAds: false,
    sensitiveDataTargeting: false,
    analyticsEnabled: false,
    updatedAt: new Date(now).toISOString(),
  });
}

export function readAdConsent(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(LIFEPANEL_AD_CONSENT_KEY) || "null");
    if (parsed?.version === LIFEPANEL_ADVERTISING_VERSION && LIFEPANEL_AD_MODES.includes(parsed.mode)) {
      return createAdConsent(parsed.mode, parsed.updatedAt);
    }
  } catch { /* fail closed */ }
  return createAdConsent("off");
}

export function saveAdConsent(storage, consent) {
  const safe = createAdConsent(consent?.mode || "off", consent?.updatedAt || new Date().toISOString());
  storage?.setItem?.(LIFEPANEL_AD_CONSENT_KEY, JSON.stringify(safe));
  return safe;
}

export function validateAdvertisingConfig(config = {}, origin = "https://example.invalid") {
  const raw = JSON.stringify(config || {}).toLowerCase();
  if (/(client_secret|private_key|refresh_token|access_token|password|cookie)/.test(raw)) {
    throw new TypeError("Advertising browser configuration must not contain secrets");
  }
  const errors = [];
  if (config.provider !== "google-adsense") errors.push("provider must be google-adsense");
  if (!Array.isArray(config.allowedOrigins) || !config.allowedOrigins.includes(origin)) errors.push("origin is not allowed");
  if (config.enabled) {
    if (!PUBLISHER_ID.test(String(config.publisherId || ""))) errors.push("valid public publisher id is required");
    if (!SLOT_ID.test(String(config.slots?.resourceInline || ""))) errors.push("valid resource-inline slot id is required");
    if (!SLOT_ID.test(String(config.slots?.resourceFooter || ""))) errors.push("valid resource-footer slot id is required");
    if (config.googleCertifiedCmp !== true) errors.push("Google-certified CMP must be enabled before ads");
    if (config.personalizedAds !== false) errors.push("personalized ads are not supported");
    if (config.siteApproved !== true) errors.push("AdSense site approval is required before ads");
  }
  return freezeResult({
    ok: errors.length === 0,
    enabled: config.enabled === true,
    errors: Object.freeze(errors),
    state: config.enabled ? (errors.length ? "blocked" : "ready") : "provider-not-configured",
  });
}

export function createAdRuntimePlan({ config = {}, consent, origin, surface = "resource-inline", context = "general", globalPrivacyControl = false } = {}) {
  const validation = validateAdvertisingConfig(config, origin);
  const safeConsent = createAdConsent(consent?.mode || "off", consent?.updatedAt || new Date().toISOString());
  const blockers = [];
  if (!validation.ok || !validation.enabled) blockers.push(validation.state);
  if (safeConsent.mode !== "limited") blockers.push("user-disabled");
  if (globalPrivacyControl === true) blockers.push("global-privacy-control");
  if (!SAFE_SURFACES.has(surface)) blockers.push("surface-not-allowed");
  if (BLOCKED_CONTEXT.test(String(context))) blockers.push("sensitive-context");
  return freezeResult({
    version: LIFEPANEL_ADVERTISING_VERSION,
    ready: blockers.length === 0,
    blockers: Object.freeze(blockers),
    requestMode: "limited",
    personalizedAds: false,
    usesLifePanelProfile: false,
    usesHealthFinanceRelationshipData: false,
    globalPrivacyControl: globalPrivacyControl === true,
    surface,
  });
}

export function getAdvertisingReadiness(config = {}, origin = "https://example.invalid") {
  const validation = validateAdvertisingConfig(config, origin);
  const gates = Object.freeze({
    providerContract: true,
    noSensitiveTargeting: true,
    consentReversible: true,
    appWorksWithoutAds: true,
    publicPublisherId: PUBLISHER_ID.test(String(config.publisherId || "")),
    publicInlineAdUnit: SLOT_ID.test(String(config.slots?.resourceInline || "")),
    publicFooterAdUnit: SLOT_ID.test(String(config.slots?.resourceFooter || "")),
    multipleResponsiveFormats: Array.isArray(config.formats) && config.formats.includes("responsive-inline") && config.formats.includes("responsive-wide") && config.formats.includes("auto-ads"),
    certifiedCmp: config.googleCertifiedCmp === true,
    liveProviderApproved: config.siteApproved === true,
    runtimeEnabled: validation.enabled && validation.ok,
  });
  const passed = Object.values(gates).filter(Boolean).length;
  return freezeResult({ version: LIFEPANEL_ADVERTISING_VERSION, gates, passed, total: Object.keys(gates).length, percent: Math.round((passed / Object.keys(gates).length) * 100), liveAdsReady: Object.values(gates).every(Boolean) });
}
