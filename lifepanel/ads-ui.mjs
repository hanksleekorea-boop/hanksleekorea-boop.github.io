import {
  createAdConsent,
  createAdRuntimePlan,
  getAdvertisingReadiness,
  LIFEPANEL_AD_CONSENT_KEY,
  readAdConsent,
  saveAdConsent,
} from "../lifepanel-core/lifepanel-advertising-v1.mjs?v=19";

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

function loadGoogleAds(config, plans) {
  if (!plans.some((plan) => plan.ready) || document.querySelector('script[data-lifepanel-ad-provider="google-adsense"]')) return false;
  const adQueue = (globalThis.adsbygoogle = globalThis.adsbygoogle || []);
  adQueue.requestNonPersonalizedAds = 1;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.dataset.lifepanelAdProvider = "google-adsense";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(config.publisherId)}`;
  script.addEventListener("load", () => {
    try {
      plans.filter((plan) => plan.ready).forEach(() => adQueue.push({}));
      setText("#ad-runtime-status", "반응형 제한 광고 요청 준비됨 · LifePanel 개인 기록은 사용하지 않음");
    }
    catch { setText("#ad-runtime-status", "광고를 불러오지 못했지만 LifePanel 기능은 정상입니다."); }
  });
  script.addEventListener("error", () => setText("#ad-runtime-status", "광고 공급자 연결 실패 · LifePanel 기능은 정상입니다."));
  document.head.append(script);
  return true;
}

function render(config, consent) {
  const origin = location.origin;
  const globalPrivacyControl = navigator.globalPrivacyControl === true;
  const readiness = getAdvertisingReadiness(config, origin);
  const slots = [...document.querySelectorAll("[data-lifepanel-ad-surface]")];
  const plans = slots.map((slot) => createAdRuntimePlan({
    config,
    consent,
    origin,
    surface: slot.dataset.lifepanelAdSurface,
    context: "general",
    globalPrivacyControl,
  }));
  setText("#ad-consent-status", globalPrivacyControl
    ? "브라우저의 개인정보 보호 신호(GPC) 감지 · 광고 요청 0"
    : consent.mode === "limited" ? "제한 광고 허용 · 언제든 변경 가능" : "광고 꺼짐 · 외부 광고 요청 0");
  setText("#ad-readiness-status", `광고 운영 준비 ${readiness.passed}/${readiness.total} · ${readiness.liveAdsReady ? "실송출 가능" : "공급자 승인 대기"}`);
  slots.forEach((slot, index) => {
    const plan = plans[index];
    slot.replaceChildren();
    slot.dataset.adState = plan.ready ? "ready" : "blocked";
    if (plan.ready) {
      const ad = document.createElement("ins");
      ad.className = "adsbygoogle";
      ad.style.display = "block";
      ad.dataset.adClient = config.publisherId;
      ad.dataset.adSlot = config.slots[slot.dataset.adSlotKey];
      ad.dataset.adFormat = "auto";
      ad.dataset.fullWidthResponsive = "true";
      slot.append(ad);
    } else {
      const message = document.createElement("p");
      message.textContent = globalPrivacyControl
        ? "브라우저가 개인정보 판매·공유 거부 신호를 보내 광고 요청을 차단했습니다."
        : readiness.liveAdsReady ? "광고가 꺼져 있습니다." : "현재 광고 심사·운영 설정 전입니다. 외부 광고 요청은 없습니다.";
      slot.append(message);
      setText("#ad-runtime-status", "외부 광고 요청 0 · 핵심 기능 정상");
    }
  });
  if (plans.some((plan) => plan.ready)) {
    setText("#ad-runtime-status", "반응형 제한 광고 공급자를 연결하는 중입니다.");
    loadGoogleAds(config, plans);
  }
  return { readiness, plans };
}

export function initAdsUI() {
  const root = document.querySelector("#advertising-controls");
  if (!root) return false;
  const config = globalThis.LIFEPANEL_ADS_CONFIG || {};
  let consent = readAdConsent(localStorage);
  const refresh = () => render(config, consent);
  document.querySelector("#ad-consent-limited")?.addEventListener("click", () => {
    consent = saveAdConsent(localStorage, createAdConsent("limited"));
    refresh();
  });
  document.querySelector("#ad-consent-off")?.addEventListener("click", () => {
    consent = saveAdConsent(localStorage, createAdConsent("off"));
    refresh();
  });
  document.querySelector("#ad-consent-reset")?.addEventListener("click", () => {
    localStorage.removeItem(LIFEPANEL_AD_CONSENT_KEY);
    consent = createAdConsent("off");
    refresh();
  });
  refresh();
  return true;
}
