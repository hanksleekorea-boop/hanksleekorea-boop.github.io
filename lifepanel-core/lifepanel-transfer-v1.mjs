import {
  createLockPrivacyPreference,
  isLegacyContinuity,
  LIFEPANEL_LEGACY_IMPORT_STORAGE_KEY,
  LOCK_PRIVACY_STORAGE_KEY,
  MOVE_CHOICE_VERSION,
} from "./lifepanel-contract-v1.mjs";

export const LIFEPANEL_TRANSFER_VERSION = "lifepanel.transfer.v1";
export const LIFEPANEL_TRANSFER_RECEIPTS_STORAGE_KEY = "lifepanel.alpha.transfer-receipts.v1";
export const LIFEPANEL_TRANSFER_STAGING_STORAGE_KEY = "lifepanel.alpha.transfer-staging.v1";
export const LIFEPANEL_PROFILE_STORAGE_KEY = "lifepanel.alpha.profile";
export const LIFEPANEL_MOVE_CHOICES_STORAGE_KEY = "lifepanel.alpha.move-choices.v1";

const RESTORE_KEYS = Object.freeze([
  ["profile", LIFEPANEL_PROFILE_STORAGE_KEY],
  ["legacyContinuity", LIFEPANEL_LEGACY_IMPORT_STORAGE_KEY],
  ["moveChoices", LIFEPANEL_MOVE_CHOICES_STORAGE_KEY],
  ["privacyPreference", LOCK_PRIVACY_STORAGE_KEY],
]);

function requireTransferStorage(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function" || typeof storage.removeItem !== "function") {
    throw new TypeError("transfer storage must provide getItem, setItem, and removeItem");
  }
  return storage;
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) throw new Error("SHA-256 is unavailable in this environment");
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new TypeError("transfer payload must be an object");
  if (payload.profile !== null && (typeof payload.profile !== "object" || Array.isArray(payload.profile))) {
    throw new TypeError("transfer profile must be an object or null");
  }
  if (payload.legacyContinuity !== null && !isLegacyContinuity(payload.legacyContinuity)) {
    throw new TypeError("transfer legacy continuity must be valid or null");
  }
  if (!Array.isArray(payload.moveChoices) || payload.moveChoices.some((choice) => choice?.version !== MOVE_CHOICE_VERSION)) {
    throw new TypeError("transfer move choices must be a valid array");
  }
  if (payload.privacyPreference !== null && payload.privacyPreference !== undefined) {
    createLockPrivacyPreference(payload.privacyPreference);
  }
  return payload;
}

export async function createLifePanelTransferBundle({
  profile = null,
  legacyContinuity = null,
  moveChoices = [],
  privacyPreference = null,
  exportedAt = new Date().toISOString(),
} = {}) {
  const timestamp = new Date(exportedAt);
  if (Number.isNaN(timestamp.getTime())) throw new TypeError("transfer export time must be a valid date");
  const payload = validatePayload({ profile, legacyContinuity, moveChoices, privacyPreference });
  return {
    version: LIFEPANEL_TRANSFER_VERSION,
    exportedAt: timestamp.toISOString(),
    payloadSha256: await sha256Hex(canonicalize(payload)),
    payload,
  };
}

export async function validateLifePanelTransferBundle(bundle) {
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) throw new TypeError("transfer bundle must be an object");
  if (bundle.version !== LIFEPANEL_TRANSFER_VERSION) throw new TypeError("transfer bundle version is unsupported or stale");
  if (Number.isNaN(new Date(bundle.exportedAt).getTime())) throw new TypeError("transfer bundle export time is invalid");
  const payload = validatePayload(bundle.payload);
  const expected = await sha256Hex(canonicalize(payload));
  if (typeof bundle.payloadSha256 !== "string" || bundle.payloadSha256 !== expected) {
    throw new TypeError("transfer bundle is corrupt");
  }
  return { valid: true, payloadSha256: expected, payload };
}

function readReceipts(storage) {
  try {
    const value = JSON.parse(storage.getItem(LIFEPANEL_TRANSFER_RECEIPTS_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function restoreRaw(storage, key, raw) {
  if (raw === null) storage.removeItem(key);
  else storage.setItem(key, raw);
}

export async function restoreLifePanelTransferBundle(storage, bundle) {
  const target = requireTransferStorage(storage);
  const validated = await validateLifePanelTransferBundle(bundle);
  const receipts = readReceipts(target);
  if (receipts.includes(validated.payloadSha256)) {
    return { status: "duplicate", writes: 0, payloadSha256: validated.payloadSha256, restoredKeys: [] };
  }

  const protectedKeys = [
    ...RESTORE_KEYS.map(([, key]) => key),
    LIFEPANEL_TRANSFER_RECEIPTS_STORAGE_KEY,
    LIFEPANEL_TRANSFER_STAGING_STORAGE_KEY,
  ];
  const before = new Map(protectedKeys.map((key) => [key, target.getItem(key)]));
  const restoredKeys = [];
  try {
    target.setItem(LIFEPANEL_TRANSFER_STAGING_STORAGE_KEY, JSON.stringify(bundle));
    for (const [payloadKey, storageKey] of RESTORE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(validated.payload, payloadKey)) continue;
      const value = validated.payload[payloadKey];
      if (value === null || (payloadKey === "moveChoices" && value.length === 0)) target.removeItem(storageKey);
      else target.setItem(storageKey, JSON.stringify(value));
      restoredKeys.push(storageKey);
    }
    target.setItem(LIFEPANEL_TRANSFER_RECEIPTS_STORAGE_KEY, JSON.stringify([...receipts, validated.payloadSha256].slice(-20)));
    target.removeItem(LIFEPANEL_TRANSFER_STAGING_STORAGE_KEY);
    return { status: "restored", writes: restoredKeys.length, payloadSha256: validated.payloadSha256, restoredKeys };
  } catch (error) {
    for (const key of protectedKeys) restoreRaw(target, key, before.get(key));
    throw error;
  }
}
