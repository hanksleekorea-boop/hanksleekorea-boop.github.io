export const CIRCLE_PROVIDER_VERSION = "1.0.0";
const MAX_MEMBERS = 8;
const allowedShareKeys = new Set(["actionTitle", "completed", "encouragementRequested"]);

function cleanEndpoint(value) {
  const url = new URL(String(value || ""));
  if (url.protocol !== "https:") throw new TypeError("Circle endpoint must use HTTPS");
  return url.href.replace(/\/$/, "");
}
function safeText(value, max) { return String(value || "").trim().slice(0, max); }
function assertId(value, label) { const id = safeText(value, 100); if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new TypeError(`${label} is invalid`); return id; }

export function validateCircleProviderConfig(config = {}) {
  const raw = JSON.stringify(config).toLowerCase();
  if (["client_secret", "private_key", "service_token", "admin_token"].some((key) => raw.includes(key))) throw new TypeError("Circle browser configuration must not contain secrets");
  const errors = [];
  try { cleanEndpoint(config.endpoint); } catch (error) { errors.push(error.message); }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export function sanitizeCircleShare(input = {}) {
  const output = {};
  for (const [key, value] of Object.entries(input)) if (allowedShareKeys.has(key)) output[key] = value;
  output.actionTitle = safeText(output.actionTitle, 120);
  output.completed = output.completed === true;
  output.encouragementRequested = output.encouragementRequested === true;
  if (!output.actionTitle) throw new TypeError("Action title is required");
  return Object.freeze(output);
}

export function createRemoteCircleService({ endpoint, authorizedFetch } = {}) {
  const base = cleanEndpoint(endpoint);
  if (typeof authorizedFetch !== "function") throw new TypeError("authorizedFetch is required");
  async function call(path, options = {}) {
    const response = await authorizedFetch(`${base}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    if (response.status === 401) throw new Error("Account session expired");
    if (response.status === 403) throw new Error("Circle access denied");
    if (response.status === 409) throw new Error("Circle state changed; refresh before retrying");
    if (!response.ok) throw new Error(`Circle request failed (${response.status})`);
    return response.status === 204 ? null : response.json();
  }
  return Object.freeze({
    create(name) { return call("/v1/circles", { method: "POST", body: JSON.stringify({ name: safeText(name, 60), maxMembers: MAX_MEMBERS, visibility: "invite-only", ranking: "disabled" }) }); },
    read(circleId) { return call(`/v1/circles/${assertId(circleId, "circleId")}`); },
    createInvite(circleId, expiresInMinutes = 60) { const duration = Math.max(5, Math.min(1440, Number(expiresInMinutes) || 60)); return call(`/v1/circles/${assertId(circleId, "circleId")}/invites`, { method: "POST", body: JSON.stringify({ expiresInMinutes: duration, oneTime: true }) }); },
    revokeInvite(circleId, inviteId) { return call(`/v1/circles/${assertId(circleId, "circleId")}/invites/${assertId(inviteId, "inviteId")}`, { method: "DELETE" }); },
    join(inviteToken) { const token = safeText(inviteToken, 256); if (token.length < 32) throw new TypeError("Invite token is invalid"); return call("/v1/invites/join", { method: "POST", body: JSON.stringify({ inviteToken: token }) }); },
    share(circleId, input) { return call(`/v1/circles/${assertId(circleId, "circleId")}/shares`, { method: "POST", body: JSON.stringify(sanitizeCircleShare(input)) }); },
    stopSharing(circleId, shareId) { return call(`/v1/circles/${assertId(circleId, "circleId")}/shares/${assertId(shareId, "shareId")}`, { method: "DELETE" }); },
    report(circleId, targetMemberId, reason) { return call(`/v1/circles/${assertId(circleId, "circleId")}/reports`, { method: "POST", body: JSON.stringify({ targetMemberId: assertId(targetMemberId, "targetMemberId"), reason: safeText(reason, 120) || "other" }) }); },
    block(circleId, targetMemberId) { return call(`/v1/circles/${assertId(circleId, "circleId")}/blocks`, { method: "POST", body: JSON.stringify({ targetMemberId: assertId(targetMemberId, "targetMemberId") }) }); },
    setEncouragementNotifications(circleId, enabled) { return call(`/v1/circles/${assertId(circleId, "circleId")}/preferences`, { method: "POST", body: JSON.stringify({ encouragementNotifications: enabled === true }) }); },
    encourage(circleId, targetMemberId, kind = "with-you") { return call(`/v1/circles/${assertId(circleId, "circleId")}/encouragements`, { method: "POST", body: JSON.stringify({ targetMemberId: assertId(targetMemberId, "targetMemberId"), kind: safeText(kind, 40) }) }); },
    createChallenge(circleId, input = {}) { return call(`/v1/circles/${assertId(circleId, "circleId")}/challenges`, { method: "POST", body: JSON.stringify({ title: safeText(input.title, 80), actionTitle: safeText(input.actionTitle, 120), days: Math.max(1, Math.min(30, Number(input.days) || 7)), ranking: "disabled" }) }); },
    joinChallenge(circleId, challengeId, actionTitle) { return call(`/v1/circles/${assertId(circleId, "circleId")}/challenges/${assertId(challengeId, "challengeId")}/join`, { method: "POST", body: JSON.stringify({ actionTitle: safeText(actionTitle, 120) }) }); },
    leave(circleId) { return call(`/v1/circles/${assertId(circleId, "circleId")}/members/me`, { method: "DELETE" }); },
  });
}
