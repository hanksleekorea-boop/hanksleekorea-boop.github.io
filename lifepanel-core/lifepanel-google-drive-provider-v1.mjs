export const GOOGLE_DRIVE_PROVIDER_VERSION = "1.0.0";
export const GOOGLE_DRIVE_SCOPE = "openid profile https://www.googleapis.com/auth/drive.appdata";
export const GOOGLE_DRIVE_BACKUP_NAME = "lifepanel-latest-v2.json";
const MAX_BACKUP_BYTES = 512 * 1024;

function freezeResult(value) { return Object.freeze(value); }
function requireOwner(actual, expected) {
  if (!actual || !expected || String(actual) !== String(expected)) throw new Error("Account boundary mismatch");
}
function encodeQuery(value) { return encodeURIComponent(String(value)); }
function utf8Size(value) { return new TextEncoder().encode(value).byteLength; }

export function validateDriveProviderConfig(config = {}, origin = "https://invalid.example") {
  const raw = JSON.stringify(config).toLowerCase();
  if (["client_secret", "clientsecret", "private_key", "refresh_token", "service_account"].some((key) => raw.includes(key))) throw new TypeError("Browser configuration must not contain secrets");
  const errors = [];
  if (!String(config.clientId || "").endsWith(".apps.googleusercontent.com")) errors.push("public Google clientId is missing");
  if (!(config.allowedOrigins || []).includes(origin)) errors.push("current origin is not allowed");
  if (origin !== "http://localhost" && !origin.startsWith("http://127.0.0.1") && !origin.startsWith("https://")) errors.push("HTTPS origin is required");
  return freezeResult({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export function createGoogleDriveProvider({ config, origin = location.origin, googleApi = globalThis.google, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const checked = validateDriveProviderConfig(config, origin);
  if (!checked.ok) throw new TypeError(checked.errors.join("; "));
  if (!googleApi?.accounts?.oauth2?.initTokenClient) throw new Error("Google Identity Services is unavailable");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");

  let state = "signed-out";
  let accessToken = null;
  let expiresAt = 0;
  let ownerId = null;
  let tokenClient = null;
  const listeners = new Set();
  const setState = (next) => { state = next; listeners.forEach((listener) => listener(state)); };
  const clearSession = (next = "signed-out") => { accessToken = null; expiresAt = 0; ownerId = null; setState(next); };

  function authHeaders(extra = {}) {
    if (!accessToken || now() >= expiresAt) { clearSession("expired"); throw new Error("Google session expired"); }
    return { Authorization: `Bearer ${accessToken}`, ...extra };
  }

  async function request(url, options = {}) {
    const response = await fetchImpl(url, { ...options, headers: authHeaders(options.headers || {}) });
    if (response.status === 401 || response.status === 403) { clearSession("expired"); throw new Error("Google session expired or denied"); }
    if (!response.ok) throw new Error(`Google Drive request failed (${response.status})`);
    return response;
  }

  async function listLatestFiles() {
    const query = `name='${GOOGLE_DRIVE_BACKUP_NAME}' and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeQuery(query)}&fields=${encodeQuery("files(id,name,modifiedTime,size)")}&orderBy=${encodeQuery("modifiedTime desc")}&pageSize=10`;
    const response = await request(url);
    const payload = await response.json();
    return Array.isArray(payload.files) ? payload.files : [];
  }

  const backupAdapter = freezeResult({
    async putLatest(expectedOwnerId, snapshot) {
      requireOwner(ownerId, expectedOwnerId);
      const body = JSON.stringify(snapshot);
      if (utf8Size(body) > MAX_BACKUP_BYTES) throw new RangeError("Backup exceeds 512 KiB");
      const existing = await listLatestFiles();
      if (existing[0]) {
        await request(`https://www.googleapis.com/upload/drive/v3/files/${encodeQuery(existing[0].id)}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": "application/json; charset=utf-8" }, body });
        for (const duplicate of existing.slice(1)) await request(`https://www.googleapis.com/drive/v3/files/${encodeQuery(duplicate.id)}`, { method: "DELETE" });
        return freezeResult({ id: existing[0].id, replaced: true });
      }
      const boundary = `lifepanel_${Math.random().toString(36).slice(2)}`;
      const metadata = JSON.stringify({ name: GOOGLE_DRIVE_BACKUP_NAME, parents: ["appDataFolder"], appProperties: { schema: "lifepanel-backup-v2" } });
      const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${body}\r\n--${boundary}--`;
      const response = await request("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: multipart });
      return freezeResult({ ...(await response.json()), replaced: false });
    },
    async getLatest(expectedOwnerId) {
      requireOwner(ownerId, expectedOwnerId);
      const files = await listLatestFiles();
      if (!files[0]) return null;
      const response = await request(`https://www.googleapis.com/drive/v3/files/${encodeQuery(files[0].id)}?alt=media`);
      const snapshot = await response.json();
      requireOwner(snapshot.ownerId, expectedOwnerId);
      return snapshot;
    },
    async deleteLatest(expectedOwnerId) {
      requireOwner(ownerId, expectedOwnerId);
      const files = await listLatestFiles();
      for (const file of files) await request(`https://www.googleapis.com/drive/v3/files/${encodeQuery(file.id)}`, { method: "DELETE" });
      return freezeResult({ deleted: files.length });
    },
  });

  async function loadOwner() {
    const response = await request("https://www.googleapis.com/oauth2/v3/userinfo");
    const profile = await response.json();
    if (!profile.sub) throw new Error("Google account identifier is missing");
    ownerId = String(profile.sub);
    setState("connected");
    return freezeResult({ ownerId, displayName: String(profile.name || "Google user").slice(0, 80) });
  }

  return freezeResult({
    backupAdapter,
    get state() { return state; },
    get ownerId() { return ownerId; },
    onStateChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async connect() {
      setState("connecting");
      return new Promise((resolve, reject) => {
        tokenClient ||= googleApi.accounts.oauth2.initTokenClient({
          client_id: config.clientId,
          scope: GOOGLE_DRIVE_SCOPE,
          callback: async (tokenResponse) => {
            if (tokenResponse?.error || !tokenResponse?.access_token) { clearSession("error"); reject(new Error(tokenResponse?.error || "Google connection was cancelled")); return; }
            accessToken = tokenResponse.access_token;
            expiresAt = now() + Math.max(60, Number(tokenResponse.expires_in) || 3600) * 1000 - 30_000;
            try { resolve(await loadOwner()); } catch (error) { clearSession("error"); reject(error); }
          },
          error_callback: () => { clearSession("error"); reject(new Error("Google popup could not complete")); },
        });
        tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
      });
    },
    disconnect() {
      const token = accessToken;
      clearSession("signed-out");
      if (token && googleApi.accounts.oauth2.revoke) googleApi.accounts.oauth2.revoke(token, () => {});
    },
  });
}
