// Public runtime configuration only. Never place client secrets, refresh tokens, or private keys here.
globalThis.LIFEPANEL_GOOGLE_PROVIDER_CONFIG = Object.freeze({
  mode: "google-drive-appdata",
  clientId: "",
  allowedOrigins: Object.freeze([
    "https://hanksleekorea-boop.github.io",
    "http://127.0.0.1:8880",
  ]),
});
