import { ADVANCED_DOMAINS, localize } from "../lifepanel-core/lifepanel-advanced-content-v2.mjs";
import {
  SHARE_SCOPES,
  WIDGET_SURFACES,
  comparePortableSnapshots,
  createCareCirclePlan,
  createDomainPortfolio,
  createLimitedShareGrant,
  createLimitedSharedView,
  createLongExperiment,
  createPortableSnapshot,
  createTaskBreakdown,
  createWidgetLayout,
  mergePortableSnapshots,
  plusFeatureReadiness,
  revokeLimitedShareGrant,
} from "../lifepanel-core/lifepanel-plus-features-v1.mjs";

const KEY = "lifepanel.alpha.plus.v1";
const $ = (selector) => document.querySelector(selector);
const setStatus = (selector, value) => { const node = $(selector); if (node) node.textContent = value; };
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const save = (state) => localStorage.setItem(KEY, JSON.stringify(state));
const id = (prefix) => `${prefix}-${Date.now().toString(36)}`;
const tomorrow = (days) => new Date(Date.now() + days * 86400000).toISOString();

function currentRecords() {
  const capturedAt = new Date().toISOString(); const records = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("lifepanel.")) records[key] = { value: localStorage.getItem(key), updatedAt: capturedAt, deleted: false };
  }
  return records;
}

export function initPlusUI() {
  if (!$("#plus-lab")) return Object.freeze({ mounted: false });
  const state = read(); let comparison = null; let grant = state.grant || null;
  const readiness = plusFeatureReadiness();
  setStatus("#plus-readiness", `결제 제외 고급 기능 ${readiness.implemented}/${readiness.total} 구현 · 현재 무료로 사용`);

  const domainRoot = $("#plus-domains");
  for (const domain of ADVANCED_DOMAINS) {
    const label = document.createElement("label"); label.className = "advanced-domain-choice";
    const input = document.createElement("input"); input.type = "checkbox"; input.value = domain.id; input.checked = (state.domainIds || []).includes(domain.id);
    const span = document.createElement("span"); span.textContent = localize(domain, "ko").label; label.append(input, span); domainRoot.append(label);
  }
  $("#plus-save-domains").addEventListener("click", () => {
    const selected = [...domainRoot.querySelectorAll("input:checked")].map((node) => node.value);
    const portfolio = createDomainPortfolio(selected, ADVANCED_DOMAINS.map((domain) => domain.id));
    state.domainIds = portfolio.domainIds; save(state); setStatus("#plus-domain-status", `${portfolio.domainIds.length}/8개 영역을 기기에 저장했습니다.`);
  });

  $("#plus-breakdown").addEventListener("click", () => {
    try {
      const plan = createTaskBreakdown({ goal: $("#plus-goal").value, availableMinutes: $("#plus-goal-minutes").value, energy: $("#plus-goal-energy").value });
      const root = $("#plus-step-list"); root.replaceChildren(...plan.steps.map((step) => { const li = document.createElement("li"); li.textContent = `${step.minutes}분 · ${step.title}${step.optional ? " · 선택" : ""}`; return li; }));
      setStatus("#plus-breakdown-status", `기기 안 규칙으로 ${plan.steps.length}단계 생성 · 외부 전송 0회`);
    } catch (error) { setStatus("#plus-breakdown-status", error.message); }
  });

  $("#plus-save-experiment").addEventListener("click", () => {
    try {
      const experiment = createLongExperiment({ id: id("experiment"), title: $("#plus-experiment-title").value, days: $("#plus-experiment-days").value, stopCondition: $("#plus-experiment-stop").value, successSignal: $("#plus-experiment-success").value });
      state.experiment = experiment; save(state); setStatus("#plus-experiment-status", `${experiment.days}일 실험을 저장했습니다. 중단 조건: ${experiment.stopCondition}`);
    } catch (error) { setStatus("#plus-experiment-status", error.message); }
  });

  const widgetRoot = $("#plus-widget-surfaces");
  const widgetLabels = { "today-focus": "오늘 초점", "next-move": "다음 행동", experiment: "실험", "weekly-reflection": "주간 돌아보기", recovery: "회복", circle: "응원 모임" };
  for (const surface of WIDGET_SURFACES) { const label = document.createElement("label"); label.className = "advanced-domain-choice"; const input = document.createElement("input"); input.type = "checkbox"; input.value = surface; const span = document.createElement("span"); span.textContent = widgetLabels[surface]; label.append(input, span); widgetRoot.append(label); }
  $("#plus-preview-widget").addEventListener("click", () => {
    try {
      const layout = createWidgetLayout({ surfaceIds: [...widgetRoot.querySelectorAll("input:checked")].map((node) => node.value), privacy: $("#plus-widget-privacy").value, columns: $("#plus-widget-columns").value });
      const root = $("#plus-widget-preview"); root.style.setProperty("--widget-columns", layout.columns); root.replaceChildren(...layout.surfaceIds.map((surface) => { const article = document.createElement("article"); article.textContent = widgetLabels[surface]; return article; }));
      state.widget = layout; save(state); setStatus("#plus-widget-status", `${layout.surfaceIds.length}개 패널 · 상세 민감정보 표시 0개`);
    } catch (error) { setStatus("#plus-widget-status", error.message); }
  });

  $("#plus-copy-snapshot").addEventListener("click", () => {
    const snapshot = createPortableSnapshot({ deviceId: "this-browser", records: currentRecords() });
    $("#plus-snapshot-json").value = JSON.stringify(snapshot, null, 2); setStatus("#plus-sync-status", `${Object.keys(snapshot.records).length}개 LifePanel 항목 사본을 만들었습니다. 자동 적용하지 않습니다.`);
  });
  $("#plus-compare-snapshot").addEventListener("click", () => {
    try {
      const incoming = JSON.parse($("#plus-snapshot-json").value); const local = createPortableSnapshot({ deviceId: "this-browser", records: currentRecords() });
      comparison = comparePortableSnapshots(local, incoming); $("#plus-apply-snapshot").disabled = false;
      setStatus("#plus-sync-status", `비교 완료 · 들어올 항목 ${comparison.summary.incomingOnly + comparison.summary.newerIncoming} · 충돌 ${comparison.summary.conflicts} · 아직 적용 0건`);
    } catch { comparison = null; $("#plus-apply-snapshot").disabled = true; setStatus("#plus-sync-status", "올바른 LifePanel 기기 사본인지 확인하세요."); }
  });
  $("#plus-apply-snapshot").addEventListener("click", () => {
    if (!comparison || !confirm("비교 결과를 현재 기기의 LifePanel 자료에 적용할까요? 다른 서비스 자료는 바꾸지 않습니다.")) return;
    const result = mergePortableSnapshots(comparison, { conflictPolicy: $("#plus-conflict-policy").value, confirmed: true });
    for (const [key, record] of Object.entries(result.records)) { if (record.deleted) localStorage.removeItem(key); else localStorage.setItem(key, record.value); }
    comparison = null; $("#plus-apply-snapshot").disabled = true; setStatus("#plus-sync-status", `${Object.keys(result.records).length}개 LifePanel 항목을 명시적으로 적용했습니다.`);
  });

  $("#plus-save-care").addEventListener("click", () => {
    try {
      const members = $("#plus-care-members").value.split(","); const routines = $("#plus-care-routines").value.split("\n");
      const plan = createCareCirclePlan({ name: $("#plus-care-name").value, members, sharedRoutines: routines }); state.care = plan; save(state);
      setStatus("#plus-care-status", `${plan.members.length}명·공유 루틴 ${plan.sharedRoutines.length}개 · 위치 추적과 긴급 감시 없음`);
    } catch (error) { setStatus("#plus-care-status", error.message); }
  });

  $("#plus-create-share").addEventListener("click", () => {
    try {
      const scopes = [...document.querySelectorAll("[name='plus-share-scope']:checked")].map((node) => node.value);
      grant = createLimitedShareGrant({ id: id("share"), recipientAlias: $("#plus-share-recipient").value, scopes, createdAt: new Date().toISOString(), expiresAt: tomorrow(Number($("#plus-share-days").value)) });
      const view = createLimitedSharedView(grant, { "chosen-domains": state.domainIds || [], "experiment-summary": state.experiment ? { title: state.experiment.title, days: state.experiment.days, status: state.experiment.status } : null, "weekly-reflection": null, "requested-support": $("#plus-share-support").value.trim() || null });
      state.grant = grant; save(state); $("#plus-revoke-share").disabled = false; $("#plus-share-output").textContent = JSON.stringify({ grant, view }, null, 2);
      setStatus("#plus-share-status", `${grant.scopes.length}개 범위만 ${$("#plus-share-days").value}일 동안 공유하는 사본을 만들었습니다.`);
    } catch (error) { setStatus("#plus-share-status", error.message); }
  });
  $("#plus-revoke-share").disabled = !grant || grant.status !== "active";
  $("#plus-revoke-share").addEventListener("click", () => { if (!grant) return; grant = revokeLimitedShareGrant(grant); state.grant = grant; save(state); $("#plus-revoke-share").disabled = true; setStatus("#plus-share-status", "공유 권한을 철회했습니다. 새 조회는 차단됩니다."); });

  return Object.freeze({ mounted: true, readiness });
}

if (typeof document !== "undefined") initPlusUI();
