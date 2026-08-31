export const ADVANCED_SERVICES_VERSION = "2.0.0";
export const ACCOUNT_STATES = Object.freeze(["not-configured", "signed-out", "connecting", "connected", "expired", "error"]);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function assertOwner(ownerId) {
  if (!String(ownerId || "").trim()) throw new TypeError("ownerId is required");
  return String(ownerId).trim();
}
function assertNoSecret(config) {
  const raw = JSON.stringify(config || {}).toLowerCase();
  if (["client_secret", "clientsecret", "service_account", "private_key", "refresh_token"].some((key) => raw.includes(key))) throw new TypeError("Secrets must not be present in browser configuration");
}

export function validateGoogleProviderConfig(config = {}, origin = "https://example.invalid") {
  assertNoSecret(config);
  const errors = [];
  if (!config.clientId || !String(config.clientId).endsWith(".apps.googleusercontent.com")) errors.push("public Google clientId is missing");
  if (config.mode !== "google-drive-appdata" && (!config.endpoint || !String(config.endpoint).startsWith("https://"))) errors.push("HTTPS backup endpoint is missing");
  const allowed = new Set(config.allowedOrigins || []);
  if (!allowed.has(origin)) errors.push("current origin is not allowed");
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), state: errors.length ? "not-configured" : "signed-out" });
}

const blockedKey = /(password|secret|token|cookie|private.?key|precise.?location|contact.?list|raw.?audio|diagnosis|bank.?account)/i;
function sanitize(value, path = "root") {
  if (Array.isArray(value)) return value.map((item, index) => sanitize(item, `${path}.${index}`));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (blockedKey.test(key)) continue;
    output[key] = sanitize(item, `${path}.${key}`);
  }
  return output;
}

export function canAccessOwnedResource(viewerOwnerId, resourceOwnerId) {
  return Boolean(viewerOwnerId && resourceOwnerId && String(viewerOwnerId) === String(resourceOwnerId));
}

export function createManualBackupService({ adapter = null } = {}) {
  let autoUploadCount = 0;
  return Object.freeze({
    get autoUploadCount() { return autoUploadCount; },
    async saveLatest({ ownerId, payload, confirmed = false }) {
      const owner = assertOwner(ownerId);
      if (!confirmed) return Object.freeze({ ok: false, status: "confirmation-required" });
      if (!adapter?.putLatest) return Object.freeze({ ok: false, status: "provider-not-configured" });
      const snapshot = Object.freeze({ schemaVersion: 2, ownerId: owner, savedAt: new Date().toISOString(), payload: sanitize(clone(payload || {})) });
      await adapter.putLatest(owner, clone(snapshot));
      return Object.freeze({ ok: true, status: "saved", snapshot });
    },
    async restoreLatest({ viewerOwnerId, ownerId, confirmed = false }) {
      if (!confirmed) return Object.freeze({ ok: false, status: "confirmation-required" });
      if (!canAccessOwnedResource(viewerOwnerId, ownerId)) return Object.freeze({ ok: false, status: "forbidden" });
      if (!adapter?.getLatest) return Object.freeze({ ok: false, status: "provider-not-configured" });
      const snapshot = await adapter.getLatest(String(ownerId));
      if (!snapshot) return Object.freeze({ ok: false, status: "not-found" });
      if (!canAccessOwnedResource(viewerOwnerId, snapshot.ownerId)) return Object.freeze({ ok: false, status: "forbidden" });
      return Object.freeze({ ok: true, status: "restored", snapshot: clone(snapshot) });
    },
    async deleteLatest({ viewerOwnerId, ownerId, confirmed = false }) {
      if (!confirmed) return Object.freeze({ ok: false, status: "confirmation-required" });
      if (!canAccessOwnedResource(viewerOwnerId, ownerId)) return Object.freeze({ ok: false, status: "forbidden" });
      if (!adapter?.deleteLatest) return Object.freeze({ ok: false, status: "provider-not-configured" });
      await adapter.deleteLatest(String(ownerId));
      return Object.freeze({ ok: true, status: "deleted" });
    },
  });
}

export function createMemoryBackupAdapter() {
  const records = new Map();
  return Object.freeze({
    async putLatest(ownerId, snapshot) { records.set(ownerId, clone(snapshot)); },
    async getLatest(ownerId) { return records.has(ownerId) ? clone(records.get(ownerId)) : null; },
    async deleteLatest(ownerId) { records.delete(ownerId); },
    count() { return records.size; },
  });
}

export function createSafeCircle({ ownerId, name = "My circle", maxMembers = 8 } = {}) {
  const owner = assertOwner(ownerId);
  if (maxMembers < 2 || maxMembers > 8) throw new RangeError("Circle size must be between 2 and 8");
  let closed = false;
  const members = new Map([[owner, { ownerId: owner, role: "owner", blocked: false }]]);
  const invites = new Map();
  const shares = [];
  const reports = [];
  const assertActive = () => { if (closed) throw new Error("Circle is closed"); };
  return Object.freeze({
    id: `circle-${owner}`,
    name: String(name).slice(0, 60),
    visibility: "invite-only",
    ranking: "disabled",
    defaultSharedFields: Object.freeze([]),
    memberCount: () => members.size,
    createInvite(actorId, inviteId) { assertActive(); if (actorId !== owner) return { ok: false, status: "forbidden" }; if (members.size >= maxMembers) return { ok: false, status: "full" }; const id = String(inviteId || "").trim(); if (!id) return { ok: false, status: "invalid" }; invites.set(id, { active: true }); return { ok: true, inviteId: id }; },
    revokeInvite(actorId, inviteId) { if (actorId !== owner) return { ok: false, status: "forbidden" }; const invite = invites.get(inviteId); if (!invite) return { ok: false, status: "not-found" }; invite.active = false; return { ok: true, status: "revoked" }; },
    join(memberId, inviteId) { assertActive(); const invite = invites.get(inviteId); if (!invite?.active) return { ok: false, status: "invalid-invite" }; if (members.size >= maxMembers) return { ok: false, status: "full" }; const id = assertOwner(memberId); invite.active = false; members.set(id, { ownerId: id, role: "member", blocked: false }); return { ok: true, status: "joined" }; },
    share(actorId, input = {}) { assertActive(); const member = members.get(actorId); if (!member || member.blocked) return { ok: false, status: "forbidden" }; const allowed = { actionTitle: String(input.actionTitle || "").slice(0, 120), completed: input.completed === true, encouragementRequested: input.encouragementRequested === true };
      if (!allowed.actionTitle) return { ok: false, status: "empty" }; const share = { id: `share-${shares.length + 1}`, ownerId: actorId, ...allowed, createdAt: new Date().toISOString(), visible: true }; shares.push(share); return { ok: true, share: clone(share) }; },
    stopSharing(actorId, shareId) { const share = shares.find((item) => item.id === shareId); if (!share || share.ownerId !== actorId) return { ok: false, status: "forbidden" }; share.visible = false; return { ok: true, status: "hidden" }; },
    block(actorId, targetId) { const actor = members.get(actorId); const target = members.get(targetId); if (!actor || !target || actorId === targetId) return { ok: false, status: "invalid" }; target.blocked = true; return { ok: true, status: "blocked" }; },
    report(actorId, targetId, reason = "other") { if (!members.has(actorId) || !members.has(targetId) || actorId === targetId) return { ok: false, status: "invalid" }; reports.push({ actorId, targetId, reason: String(reason).slice(0, 120) }); return { ok: true, status: "recorded-locally" }; },
    leave(actorId) { if (!members.has(actorId)) return { ok: false, status: "not-member" }; if (actorId === owner) { closed = true; members.clear(); shares.forEach((item) => { item.visible = false; }); return { ok: true, status: "closed" }; } members.delete(actorId); shares.filter((item) => item.ownerId === actorId).forEach((item) => { item.visible = false; }); return { ok: true, status: "left" }; },
    snapshot(viewerId) { if (!members.has(viewerId) || closed) return { ok: false, status: "forbidden" }; return { ok: true, circle: { name: String(name).slice(0, 60), visibility: "invite-only", ranking: "disabled", members: [...members.values()].map(({ ownerId: id, role }) => ({ ownerId: id, role })), shares: shares.filter((item) => item.visible).map(clone) } }; },
  });
}
