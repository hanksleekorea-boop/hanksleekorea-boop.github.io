import { ADVANCED_DOMAINS, ADVANCED_EXPERIMENTS, ADVANCED_FAQ, ADVANCED_MOVES, ADVANCED_TONES, ADVANCED_WEEKLY_STORIES, CONTEXT_COPY, localize, searchAdvancedMoves } from "../lifepanel-core/lifepanel-advanced-content-v2.mjs";
import { createPreferenceState, explainSufficiency, rankAdvancedMoves } from "../lifepanel-core/lifepanel-personalization-v2.mjs";
import { buildCommunityInsights, COMMUNITY_DOMAINS, SYNTHETIC_COMMUNITY_1000 } from "../lifepanel-core/lifepanel-community-insights-v1.mjs";
import { createManualBackupService, createSafeCircle, validateGoogleProviderConfig } from "../lifepanel-core/lifepanel-advanced-services-v2.mjs?v=25";
import { createGoogleDriveProvider } from "../lifepanel-core/lifepanel-google-drive-provider-v1.mjs";

const KEY = "lifepanel.alpha.advanced.v2";
const $ = (selector) => document.querySelector(selector);
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const text = (selector, value) => { const node = $(selector); if (node) node.textContent = value; };
const L = {
  ko: { title: "내가 고른 두 영역을 더 깊게 살펴보기", summary: "192개 행동을 검색하고 추천 이유를 확인합니다. 계정 연결 전에도 핵심 기능은 기기 안에서 작동합니다.", all: "전체 8개 영역", selected: (n) => `${n}개 영역 · 최대 2개`, matches: (n) => `${n}개 중 상위 6개`, why: "이유", alt: "대안·안전 경계", hide: "이 행동 숨기기", impact: (a, b) => `${a} 대신 ${b} 행동이 검색·추천 상단에 옵니다. 기존 자료는 삭제되지 않습니다.`, saved: "기기에 실험 선택을 저장했습니다.", circle: "기기 안 미리보기 모임을 만들었습니다. 구성원 1명 · 기본 공유 0개", empty: "공유할 행동 제목을 직접 입력하세요.", shared: "제목과 응원 요청 여부만 기기 안에서 공유했습니다.", closed: "모임을 닫고 공유를 중단했습니다." },
  en: { title: "Explore two areas you choose", summary: "Search 192 actions and see why their order changed. Core features work on-device before account connection.", all: "All 8 domains", selected: (n) => `${n} domains · maximum 2`, matches: (n) => `Top 6 of ${n}`, why: "Why", alt: "Alternative & safety", hide: "Hide this action", impact: (a, b) => `${b} actions replace ${a} near the top. Existing data is not deleted.`, saved: "Saved the experiment on this device.", circle: "Created a device-only preview circle. 1 member · 0 fields shared by default", empty: "Enter an action title yourself.", shared: "Shared only the title and encouragement request on this device.", closed: "Closed the circle and stopped sharing." },
};

export function initAdvancedUI() {
  if (!$("#advanced-hub")) return Object.freeze({ mounted: false });
  const stored = load();
  let locale = stored.locale === "en" ? "en" : "ko";
  let domains = [...new Set(stored.activeDomainIds || [])].filter((id) => ADVANCED_DOMAINS.some((domain) => domain.id === id)).slice(0, 2);
  let hidden = [...new Set(stored.disabledMoveIds || [])];
  let outcomes = stored.outcomes || {};
  let storyIndex = Number(stored.storyIndex) || 0;
  let pending = null;
  let circle = null;
  let lastPreviewMemberId = null;
  const config = validateGoogleProviderConfig(globalThis.LIFEPANEL_GOOGLE_PROVIDER_CONFIG || {}, location.origin);
  let adapter = globalThis.LIFEPANEL_GOOGLE_PROVIDER_ADAPTER;
  let cloudAdapter = null;
  let backup = createManualBackupService();
  let providerReady = false;
  let currentOwnerId = null;
  let pendingCloudSnapshot = null;
  const collectBackupPayload = () => {
    const records = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("lifepanel.")) records[key] = localStorage.getItem(key);
    }
    return { schemaVersion: 2, records, recordCount: Object.keys(records).length };
  };
  const refreshProvider = () => {
    if (!adapter && config.mode === "google-drive-appdata" && config.clientId && globalThis.google?.accounts?.oauth2) {
      try { adapter = createGoogleDriveProvider({ config, origin: location.origin }); } catch { adapter = null; }
    }
    cloudAdapter = adapter?.backupAdapter || null;
    providerReady = Boolean(config.ok && adapter && typeof adapter.connect === "function" && cloudAdapter && ["putLatest", "getLatest", "deleteLatest"].every((method) => typeof cloudAdapter[method] === "function"));
    backup = createManualBackupService({ adapter: cloudAdapter });
    if ($("#advanced-google-connect")) {
      $("#advanced-google-connect").disabled = !providerReady;
      text("#advanced-account-state", providerReady ? (locale === "ko" ? "연결 가능 · 로그아웃" : "Ready · signed out") : (locale === "ko" ? "설정되지 않음" : "Not configured"));
    }
  };
  refreshProvider();
  $("#google-gis")?.addEventListener("load", refreshProvider, { once: true });
  const save = () => localStorage.setItem(KEY, JSON.stringify({ locale, activeDomainIds: domains, disabledMoveIds: hidden, outcomes, storyIndex, selectedExperimentId: $("#advanced-experiment-select")?.value || null }));
  const domainLabel = (id) => localize(ADVANCED_DOMAINS.find((d) => d.id === id), locale)?.label || id;
  const communityDomainLabel = (id) => { const item = COMMUNITY_DOMAINS.find((domain) => domain.id === id); return item ? item[locale === "ko" ? "ko" : "en"] : id; };

  function renderCommunityInsights() {
    const result = buildCommunityInsights({ records: SYNTHETIC_COMMUNITY_1000, selectedDomainIds: domains, energy: Number($("#advanced-energy").value) });
    const renderList = (selector, rows) => {
      const root = $(selector); root.replaceChildren();
      for (const row of rows.slice(0, 5)) { const li = document.createElement("li"); const label = document.createElement("span"); label.textContent = communityDomainLabel(row.domainId); const value = document.createElement("strong"); value.textContent = `${row.percent}%`; li.append(label, value); root.append(li); }
    };
    renderList("#community-overall-list", result.overall); renderList("#community-similar-list", result.similar);
    text("#community-provenance", locale === "ko" ? `설명용 가상 기준 ${result.generatedFrom.toLocaleString()}명 · 실제 사용자 평균 아님` : `${result.generatedFrom.toLocaleString()} illustrative virtual people · not real-user statistics`);
    text("#community-cohort-status", locale === "ko" ? `비슷한 집단 ${result.cohortSize}명 · 선택 영역과 에너지 범위 기준` : `Similar cohort ${result.cohortSize} · chosen domains and energy range`);
    const comparison = $("#community-comparison-list"); comparison.replaceChildren();
    for (const item of result.comparisons) { const li = document.createElement("li"); const meaning = item.message === "often-shared" ? "많이 함께 관심을 둠" : item.message === "sometimes-shared" ? "어느 정도 함께 관심을 둠" : "비교적 드문 관심"; li.textContent = locale === "ko" ? `${communityDomainLabel(item.domainId)} · 비슷한 집단의 ${item.peerInterestPercent}% · ${meaning}` : `${communityDomainLabel(item.domainId)} · ${item.peerInterestPercent}% of similar people`; comparison.append(li); }
    if (!result.comparisons.length) { const li = document.createElement("li"); li.textContent = locale === "ko" ? "관심 영역을 고르면 비슷한 집단과 비교 이유를 보여 줍니다." : "Choose an interest domain to see an explained comparison."; comparison.append(li); }
  }

  function renderDomains() {
    const root = $("#advanced-domains"); root.replaceChildren();
    for (const domain of ADVANCED_DOMAINS) {
      const label = document.createElement("label"); label.className = "advanced-domain-choice";
      const input = document.createElement("input"); input.type = "checkbox"; input.value = domain.id; input.checked = domains.includes(domain.id);
      input.addEventListener("change", () => {
        if (!input.checked) { domains = domains.filter((id) => id !== domain.id); save(); render(); return; }
        if (domains.length < 2) { domains.push(domain.id); save(); render(); return; }
        input.checked = false; pending = { from: domains[0], to: domain.id };
        text("#advanced-domain-dialog-copy", L[locale].impact(domainLabel(pending.from), domainLabel(pending.to))); $("#advanced-domain-dialog").showModal();
      });
      const span = document.createElement("span"); span.textContent = localize(domain, locale).label; label.append(input, span); root.append(label);
    }
  }

  function renderMoves() {
    const state = createPreferenceState({ enabled: $("#advanced-personalization").checked, activeDomainIds: domains, minutes: Number($("#advanced-minutes").value), energy: Number($("#advanced-energy").value), disabledMoveIds: hidden, outcomes });
    const matches = searchAdvancedMoves({ query: $("#advanced-search").value, locale, domainIds: domains }).filter((move) => !hidden.includes(move.id));
    const ids = new Set(matches.map((move) => move.id));
    const ranked = rankAdvancedMoves(state, { locale, limit: ADVANCED_MOVES.length }).filter((item) => ids.has(item.move.id)).slice(0, 6);
    text("#advanced-impact", `${domains.length ? L[locale].selected(domains.length) : L[locale].all} · ${L[locale].matches(matches.length)}`);
    const root = $("#advanced-move-list"); root.replaceChildren();
    for (const item of ranked) {
      const li = document.createElement("li"); li.className = "advanced-move";
      const h = document.createElement("h4"); h.textContent = item.copy.title;
      const why = document.createElement("p"); why.textContent = `${L[locale].why}: ${item.reasons.join(" · ")}`;
      const details = document.createElement("details"); const summary = document.createElement("summary"); summary.textContent = L[locale].alt; const p = document.createElement("p"); p.textContent = `${item.copy.alternative} ${item.copy.safety}`;
      const effect = document.createElement("p"); effect.textContent = `${locale === "ko" ? "기대 효과" : "Expected effect"}: ${item.move.expectedEffect[locale] || item.move.expectedEffect.ko}`;
      const skip = document.createElement("p"); skip.textContent = `${locale === "ko" ? "하지 않아도 되는 경우" : "Skip when"}: ${item.move.skipWhen[locale] || item.move.skipWhen.ko}`;
      const source = document.createElement("p"); source.className = "suggestion-source"; source.textContent = `${locale === "ko" ? "근거" : "Source"}: ${item.move.source[locale] || item.move.source.ko} · ${locale === "ko" ? "검토일" : "Reviewed"} ${item.move.reviewedAt}`;
      details.append(summary, p, effect, skip, source);
      const row = document.createElement("div"); row.className = "advanced-outcomes";
      [["helped", locale === "ko" ? "도움 됨" : "Helped"], ["neutral", locale === "ko" ? "보통" : "Neutral"], ["too-much", locale === "ko" ? "부담됨" : "Too much"]].forEach(([value, label]) => { const button = document.createElement("button"); button.type = "button"; button.className = "quiet-button"; button.textContent = label; button.addEventListener("click", () => { outcomes[item.move.id] = value; save(); renderMoves(); }); row.append(button); });
      const hide = document.createElement("button"); hide.type = "button"; hide.className = "dismiss-button"; hide.textContent = L[locale].hide; hide.addEventListener("click", () => { hidden.push(item.move.id); save(); renderMoves(); });
      li.append(h, why, details, row, hide); root.append(li);
    }
    const records = Object.entries(outcomes).map(([moveId, outcome]) => ({ moveId, outcome, recordedAt: new Date().toISOString() }));
    const sufficiency = explainSufficiency(records, locale);
    text("#advanced-sufficiency", `${locale === "ko" ? "개인화 근거" : "Personalization evidence"}: ${sufficiency.label} · ${records.length}/5`);
  }

  function renderSelects() {
    const tone = $("#advanced-tone"); const toneValue = tone.value || "calm"; tone.replaceChildren(...ADVANCED_TONES.map((item) => { const option = document.createElement("option"); option.value = item.id; const copy = localize(item, locale); option.textContent = `${copy.label} · ${copy.note}`; return option; })); tone.value = toneValue;
    const experiment = $("#advanced-experiment-select"); const experimentValue = experiment.value || stored.selectedExperimentId || ADVANCED_EXPERIMENTS[0].id; experiment.replaceChildren(...ADVANCED_EXPERIMENTS.map((item) => { const option = document.createElement("option"); option.value = item.id; option.textContent = localize(item, locale).title; return option; })); experiment.value = ADVANCED_EXPERIMENTS.some((item) => item.id === experimentValue) ? experimentValue : ADVANCED_EXPERIMENTS[0].id;
    const chosen = ADVANCED_EXPERIMENTS.find((item) => item.id === experiment.value); const copy = localize(chosen, locale); text("#advanced-experiment-copy", `${copy.description} ${locale === "ko" ? "중단:" : "Stop:"} ${copy.stopCondition} ${locale === "ko" ? "돌아보기:" : "Reflect:"} ${copy.reflection}`);
  }

  function renderStory() { const copy = localize(ADVANCED_WEEKLY_STORIES[storyIndex % 32], locale); text("#advanced-story-copy", `${copy.title} — ${copy.summary} (${copy.evidence})`); }
  function renderFaq() { const root = $("#advanced-faq-list"); root.replaceChildren(...ADVANCED_FAQ.map((item) => { const copy = localize(item, locale); const details = document.createElement("details"); const summary = document.createElement("summary"); summary.textContent = copy.question; const p = document.createElement("p"); p.textContent = copy.answer; details.append(summary, p); return details; })); }
  function renderContext() { const root = $("#advanced-context-list"); root.replaceChildren(...Object.values(CONTEXT_COPY).map((item) => { const li = document.createElement("li"); li.textContent = item[locale]; return li; })); }

  function render() {
    document.documentElement.lang = locale;
    text("#advanced-title", L[locale].title); text("#advanced-summary", L[locale].summary);
    const replacements = locale === "ko" ? {
      "#advanced-eyebrow": "2단계 · 탐색과 연결", "#advanced-language-label": "표시 언어", "#advanced-explorer-eyebrow": "영역 검색 · 최대 2개", "#advanced-explorer-title": "행동 탐색기", "#advanced-domain-help": "영역 교체 전 영향을 보여 줍니다. 선택하지 않으면 전체에서 찾습니다.", "#advanced-search-label": "행동 검색", "#advanced-minutes-label": "가능한 시간", "#advanced-energy-label": "에너지",
      "#advanced-personal-eyebrow": "설명 가능한 개인화", "#advanced-personal-title": "왜 이 순서인지 먼저 보기", "#advanced-personal-copy": "직접 고른 영역·시간·에너지와 결과만 사용합니다. 성격·직업·건강 상태를 추정하지 않습니다.", "#advanced-personalization-label": "개인화 순서 사용", "#advanced-tone-label": "표현 방식", "#advanced-context-summary": "주말·교대·여행 안내",
      "#community-insights-eyebrow": "사람들의 관심 지도 · 개인 식별 없음", "#community-insights-title": "다른 삶을 엿보고, 나와 비슷한 흐름 보기", "#community-insights-copy": "현재는 실제 사용자 통계가 아닌 1,000명 가상 표본입니다. 개인 프로필·메모·계정·위치는 수집하지 않으며 순위를 만들지 않습니다.", "#community-overall-title": "전체 관심사 평균", "#community-similar-title": "나와 비슷한 가상 집단", "#community-refresh": "현재 선택으로 다시 비교",
      "#advanced-experiment-eyebrow": "21·30일 작은 실험", "#advanced-experiment-title": "중단 조건이 먼저인 실험", "#advanced-experiment-save": "기기에 실험 선택 저장", "#advanced-story-eyebrow": "주간 사례 · 설명용 예시", "#advanced-story-title": "실제 통계로 오해하지 않는 사례", "#advanced-next-story": "다른 예시",
      "#advanced-account-eyebrow": "선택 계정 · 수동 최신 사본 1개", "#advanced-account-title": "Google 연결과 자료 소유권", "#advanced-account-copy": "연결하지 않아도 사용할 수 있습니다. Google 보호본은 운영 설정과 실제 계정 검증이 모두 끝났을 때만 열립니다.", "#advanced-account-state-label": "계정 상태", "#advanced-backup-state-label": "클라우드 사본", "#advanced-upload-label": "자동 업로드", "#advanced-backup-state": "생성되지 않음", "#advanced-upload-state": "0회 · 사용 안 함", "#advanced-google-connect": "Google로 연결", "#advanced-backup-now": "최신 사본 직접 저장", "#advanced-compare-backup": "보호본 비교", "#advanced-apply-backup": "비교한 보호본 적용", "#advanced-delete-backup": "클라우드 사본 삭제", "#advanced-backup-preview-title": "저장 대상 미리보기", "#advanced-account-status": "외부 설정 전에는 어떤 자료도 전송하지 않습니다.",
      "#advanced-circle-eyebrow": "초대 전용 · 2–8명 · 순위 없음", "#advanced-circle-title": "안전한 응원 모임 미리보기", "#advanced-circle-copy": "현재는 이 브라우저 안에서 계약을 검증하는 미리보기입니다. 공개 검색·자동 초대·외부 전송은 없습니다.", "#advanced-create-circle": "기기 안 모임 만들기", "#advanced-invite-circle": "일회용 초대 만들기", "#advanced-leave-circle": "모임 닫기", "#advanced-member-label": "미리보기 구성원 별칭", "#advanced-add-member": "기기 안 미리보기에 초대", "#advanced-share-label": "나눌 행동 제목", "#advanced-share-encouragement-label": "응원 요청 포함", "#advanced-share-circle": "공유 범위 확인 후 올리기", "#advanced-faq-summary": "2단계 도움말 40개 보기", "#advanced-domain-dialog-title": "영역을 바꾸면 무엇이 달라지나요?", "#advanced-domain-cancel": "취소", "#advanced-domain-confirm": "이 영역으로 바꾸기"
    } : {
      "#advanced-eyebrow": "Stage 2 · Explore and connect", "#advanced-language-label": "Display language", "#advanced-explorer-eyebrow": "Domain search · maximum 2", "#advanced-explorer-title": "Action explorer", "#advanced-domain-help": "See the impact before replacing a domain. Choose none to search all.", "#advanced-search-label": "Search actions", "#advanced-minutes-label": "Available time", "#advanced-energy-label": "Energy",
      "#advanced-personal-eyebrow": "Explainable personalization", "#advanced-personal-title": "See why the order changed", "#advanced-personal-copy": "Only chosen domains, time, energy, and outcomes are used. Personality, occupation, and health are not inferred.", "#advanced-personalization-label": "Use personalized ordering", "#advanced-tone-label": "Tone", "#advanced-context-summary": "Weekend, shift, and travel notes",
      "#community-insights-eyebrow": "Interest map · no individual identification", "#community-insights-title": "Explore other lives and compare similar patterns", "#community-insights-copy": "This currently uses 1,000 virtual examples, not real-user statistics. It collects no profile, note, account, or location and creates no ranking.", "#community-overall-title": "Overall interests", "#community-similar-title": "Virtual people with similar choices", "#community-refresh": "Compare current choices",
      "#advanced-experiment-eyebrow": "Small 21/30-day experiment", "#advanced-experiment-title": "An experiment with a stop condition first", "#advanced-experiment-save": "Save experiment on this device", "#advanced-story-eyebrow": "Weekly story · illustrative example", "#advanced-story-title": "Examples clearly labeled as non-statistical", "#advanced-next-story": "Another example",
      "#advanced-account-eyebrow": "Optional account · one manual latest backup", "#advanced-account-title": "Google connection and data ownership", "#advanced-account-copy": "The app works without an account. Sign-in and cloud backup stay closed until an operator configures a production service.", "#advanced-account-state-label": "Account state", "#advanced-backup-state-label": "Cloud backup", "#advanced-upload-label": "Automatic upload", "#advanced-backup-state": "Not created", "#advanced-upload-state": "0 · disabled", "#advanced-google-connect": "Connect with Google", "#advanced-backup-now": "Save latest backup manually", "#advanced-compare-backup": "Compare backup", "#advanced-apply-backup": "Apply compared backup", "#advanced-delete-backup": "Delete cloud backup", "#advanced-backup-preview-title": "Preview backup scope", "#advanced-account-status": "Nothing is sent before the external service is configured.",
      "#advanced-circle-eyebrow": "Invite-only · 2–8 people · no ranking", "#advanced-circle-title": "Safe encouragement circle preview", "#advanced-circle-copy": "This browser-only preview verifies the contract. There is no public discovery, automatic invitation, or external transfer.", "#advanced-create-circle": "Create device-only circle", "#advanced-invite-circle": "Create one-time invite", "#advanced-leave-circle": "Close circle", "#advanced-member-label": "Preview member alias", "#advanced-add-member": "Invite into device preview", "#advanced-share-label": "Action title to share", "#advanced-share-encouragement-label": "Ask for encouragement", "#advanced-share-circle": "Review scope and share", "#advanced-faq-summary": "View 40 stage-two help topics", "#advanced-domain-dialog-title": "What changes when a domain is replaced?", "#advanced-domain-cancel": "Cancel", "#advanced-domain-confirm": "Replace domain"
    };
    Object.entries(replacements).forEach(([selector, value]) => text(selector, value));
    $("#advanced-search").placeholder = locale === "ko" ? "예: 쉬기, 집중" : "e.g. rest, focus";
    $("#advanced-share-title").placeholder = locale === "ko" ? "직접 고른 제목만 공유" : "Only a title you choose";
    $("#advanced-member-alias").placeholder = locale === "ko" ? "실제 연락처 대신 별칭" : "Alias, not real contact details";
    [...$("#advanced-minutes").options].forEach((option) => { option.textContent = locale === "ko" ? `${option.value}분` : `${option.value} min`; });
    text("#advanced-account-state", providerReady ? (locale === "ko" ? "연결 가능 · 로그아웃" : "Ready · signed out") : (locale === "ko" ? "설정되지 않음" : "Not configured"));
    renderDomains(); renderSelects(); renderStory(); renderFaq(); renderContext(); renderMoves(); renderCommunityInsights();
  }

  $("#advanced-language").value = locale; $("#advanced-language").addEventListener("change", (event) => { locale = event.target.value === "en" ? "en" : "ko"; save(); render(); });
  ["#advanced-search", "#advanced-minutes", "#advanced-energy", "#advanced-personalization"].forEach((selector) => $(selector).addEventListener(selector === "#advanced-search" ? "input" : "change", renderMoves));
  $("#advanced-experiment-select").addEventListener("change", renderSelects); $("#advanced-experiment-save").addEventListener("click", () => { save(); text("#advanced-experiment-status", L[locale].saved); });
  $("#advanced-next-story").addEventListener("click", () => { storyIndex = (storyIndex + 1) % 32; save(); renderStory(); });
  $("#advanced-domain-cancel").addEventListener("click", () => { pending = null; $("#advanced-domain-dialog").close(); });
  $("#advanced-domain-confirm").addEventListener("click", () => { if (pending) domains = [domains[1], pending.to]; pending = null; save(); $("#advanced-domain-dialog").close(); render(); });
  $("#community-refresh").addEventListener("click", renderCommunityInsights);
  $("#advanced-google-connect").disabled = !providerReady;
  text("#advanced-account-state", providerReady ? (locale === "ko" ? "연결 가능 · 로그아웃" : "Ready · signed out") : (locale === "ko" ? "설정되지 않음" : "Not configured"));
  text("#advanced-backup-preview", JSON.stringify({ schemaVersion: 2, included: ["preferences", "choices", "optional reflections"], excluded: ["secrets", "contacts", "precise location", "raw audio"], automaticUpload: false }, null, 2));
  $("#advanced-google-connect").addEventListener("click", async () => { if (!providerReady) return; text("#advanced-account-state", locale === "ko" ? "연결 중" : "Connecting"); try { const profile = await adapter.connect(); currentOwnerId = String(profile?.ownerId || profile?.sub || "").trim() || null; if (!currentOwnerId) throw new Error("Missing account boundary"); text("#advanced-account-state", locale === "ko" ? "연결됨" : "Connected"); ["#advanced-backup-now", "#advanced-compare-backup", "#advanced-delete-backup"].forEach((selector) => { $(selector).disabled = false; }); } catch { currentOwnerId = null; text("#advanced-account-state", locale === "ko" ? "오류 · 전송 없음" : "Error · nothing sent"); } });
  $("#advanced-backup-now").addEventListener("click", async () => { if (!currentOwnerId) return; const result = await backup.saveLatest({ ownerId: currentOwnerId, payload: collectBackupPayload(), confirmed: true }); text("#advanced-account-status", result.ok ? (locale === "ko" ? `${result.snapshot.payload.recordCount}개 LifePanel 항목을 최신 보호본으로 저장했습니다.` : `Saved ${result.snapshot.payload.recordCount} LifePanel records as the latest backup.`) : result.status); });
  $("#advanced-compare-backup").addEventListener("click", async () => { if (!currentOwnerId) return; const result = await backup.restoreLatest({ viewerOwnerId: currentOwnerId, ownerId: currentOwnerId, confirmed: true }); if (!result.ok) { pendingCloudSnapshot = null; $("#advanced-apply-backup").disabled = true; text("#advanced-account-status", result.status); return; } pendingCloudSnapshot = result.snapshot; const remoteCount = Number(result.snapshot.payload?.recordCount || Object.keys(result.snapshot.payload?.records || {}).length); const localCount = collectBackupPayload().recordCount; $("#advanced-apply-backup").disabled = false; text("#advanced-account-status", locale === "ko" ? `비교 완료: 원격 ${remoteCount}개·현재 기기 ${localCount}개. 아직 적용하지 않았습니다.` : `Compared: ${remoteCount} remote and ${localCount} local records. Nothing has been applied yet.`); });
  $("#advanced-apply-backup").addEventListener("click", () => { if (!pendingCloudSnapshot) return; const records = pendingCloudSnapshot.payload?.records || {}; let applied = 0; for (const [key, value] of Object.entries(records)) { if (!key.startsWith("lifepanel.") || typeof value !== "string") continue; localStorage.setItem(key, value); applied += 1; } pendingCloudSnapshot = null; $("#advanced-apply-backup").disabled = true; text("#advanced-account-status", locale === "ko" ? `${applied}개 항목을 적용했습니다. 화면을 새로 열면 반영됩니다.` : `Applied ${applied} records. Reopen the page to refresh the view.`); });
  $("#advanced-delete-backup").addEventListener("click", async () => { if (!currentOwnerId) return; const approved = globalThis.confirm(locale === "ko" ? "Google Drive 앱 전용 최신 보호본을 삭제할까요? 이 기기의 로컬 자료는 유지됩니다." : "Delete the latest app-only Google Drive backup? Local data on this device will remain."); if (!approved) return; const result = await backup.deleteLatest({ viewerOwnerId: currentOwnerId, ownerId: currentOwnerId, confirmed: true }); pendingCloudSnapshot = null; $("#advanced-apply-backup").disabled = true; text("#advanced-account-status", result.status); });
  $("#advanced-create-circle").addEventListener("click", () => { circle = createSafeCircle({ ownerId: "local-owner", name: "LifePanel preview" }); ["#advanced-invite-circle", "#advanced-leave-circle", "#advanced-share-circle", "#advanced-add-member", "#advanced-create-challenge"].forEach((selector) => { $(selector).disabled = false; }); text("#advanced-circle-status", L[locale].circle); });
  $("#advanced-invite-circle").addEventListener("click", () => { const id = `invite-${Date.now().toString(36)}`; if (circle?.createInvite("local-owner", id).ok) text("#advanced-circle-status", `${locale === "ko" ? "기기 안 일회용 초대" : "Device-only one-time invite"}: ${id}`); });
  $("#advanced-add-member").addEventListener("click", () => { const alias = $("#advanced-member-alias").value.trim(); if (!alias) return text("#advanced-circle-status", locale === "ko" ? "실제 연락처가 아닌 별칭을 입력하세요." : "Enter an alias, not real contact details."); const memberId = `preview-${Date.now().toString(36)}`; const inviteId = `preview-invite-${Date.now().toString(36)}`; const invited = circle?.createInvite("local-owner", inviteId); const joined = invited?.ok ? circle.join(memberId, inviteId) : invited; if (!joined?.ok) return text("#advanced-circle-status", locale === "ko" ? "모임은 최대 8명입니다." : "The circle is limited to 8 people."); lastPreviewMemberId = memberId; $("#advanced-quiet-cheer").disabled = false; const li = document.createElement("li"); li.textContent = alias; const report = document.createElement("button"); report.type = "button"; report.className = "quiet-button"; report.textContent = locale === "ko" ? "신고 기록" : "Record report"; report.addEventListener("click", () => { circle.report("local-owner", memberId, "preview-report"); text("#advanced-circle-status", locale === "ko" ? "신고를 기기 안에만 기록했습니다." : "Recorded the report on this device only."); }); const block = document.createElement("button"); block.type = "button"; block.className = "dismiss-button"; block.textContent = locale === "ko" ? "차단" : "Block"; block.addEventListener("click", () => { circle.block("local-owner", memberId); if (lastPreviewMemberId === memberId) { lastPreviewMemberId = null; $("#advanced-quiet-cheer").disabled = true; } li.remove(); text("#advanced-circle-status", locale === "ko" ? "구성원을 차단했습니다." : "Blocked the member."); }); li.append(" ", report, " ", block); $("#advanced-circle-members").append(li); $("#advanced-member-alias").value = ""; text("#advanced-circle-status", locale === "ko" ? `미리보기 구성원 ${circle.memberCount()}명` : `${circle.memberCount()} preview members`); });
  $("#advanced-cheer-notifications").addEventListener("change", (event) => { const result = circle?.setEncouragementNotifications("local-owner", event.target.checked); text("#advanced-circle-status", result ? (event.target.checked ? "응원 알림을 켰습니다. 언제든 끌 수 있습니다." : "응원 알림을 껐습니다.") : "먼저 모임을 만들어 주세요."); });
  $("#advanced-quiet-cheer").addEventListener("click", () => { const result = lastPreviewMemberId ? circle?.encourage("local-owner", lastPreviewMemberId, "take-your-time") : null; text("#advanced-circle-status", result?.ok ? "압박 문구 없이 ‘천천히 해도 돼’ 응원을 기기 안에 기록했습니다." : "먼저 미리보기 구성원을 추가해 주세요."); });
  $("#advanced-create-challenge").addEventListener("click", () => { const result = circle?.createChallenge("local-owner", { title: $("#advanced-challenge-title").value, actionTitle: $("#advanced-challenge-action").value, days: 7 }); text("#advanced-circle-status", result?.ok ? "공개 순위 없이 7일 도전을 만들었습니다. 구성원은 서로 다른 행동으로 참여할 수 있습니다." : "도전 이름과 내 행동을 입력해 주세요."); });
  $("#advanced-share-circle").addEventListener("click", () => { const actionTitle = $("#advanced-share-title").value.trim(); if (!actionTitle) return text("#advanced-circle-status", L[locale].empty); const result = circle?.share("local-owner", { actionTitle, encouragementRequested: $("#advanced-share-encouragement").checked }); if (!result?.ok) return; const li = document.createElement("li"); li.textContent = result.share.actionTitle; const stop = document.createElement("button"); stop.type = "button"; stop.className = "dismiss-button"; stop.textContent = locale === "ko" ? "공유 중단" : "Stop sharing"; stop.addEventListener("click", () => { circle.stopSharing("local-owner", result.share.id); li.remove(); }); li.append(" ", stop); $("#advanced-circle-feed").append(li); text("#advanced-circle-status", L[locale].shared); });
  $("#advanced-leave-circle").addEventListener("click", () => { circle?.leave("local-owner"); circle = null; lastPreviewMemberId = null; $("#advanced-circle-feed").replaceChildren(); $("#advanced-circle-members").replaceChildren(); ["#advanced-invite-circle", "#advanced-leave-circle", "#advanced-share-circle", "#advanced-add-member", "#advanced-quiet-cheer", "#advanced-create-challenge"].forEach((selector) => { $(selector).disabled = true; }); text("#advanced-circle-status", L[locale].closed); });
  render();
  return Object.freeze({ mounted: true, getState: () => ({ locale, activeDomainIds: [...domains], disabledMoveIds: [...hidden] }) });
}
