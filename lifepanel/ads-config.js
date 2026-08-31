// Public advertising configuration only. Never place secrets, tax, payment, or identity data here.
globalThis.LIFEPANEL_ADS_CONFIG = Object.freeze({
  provider: "google-adsense",
  enabled: false,
  publisherId: "ca-pub-2476023536699107",
  slots: Object.freeze({
    resourceInline: "4822559136",
    resourceFooter: "4822559136",
  }),
  autoAdsEligible: true,
  formats: Object.freeze(["responsive-inline", "responsive-wide", "auto-ads"]),
  googleCertifiedCmp: true,
  siteApproved: false,
  personalizedAds: false,
  allowedOrigins: Object.freeze([
    "https://hanksleekorea-boop.github.io",
    "http://127.0.0.1:8880",
  ]),
});
