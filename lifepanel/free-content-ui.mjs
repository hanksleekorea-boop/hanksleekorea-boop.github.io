import {
  EMPTY_STATES,
  ERROR_STATES,
  FAQ_ITEMS,
  FREE_SCENARIOS,
  RECOVERY_MOVES,
  REFLECTION_OUTCOMES,
  REFLECTION_PROMPTS,
  STARTER_EXAMPLES,
  validateFreeStage1Content,
} from "../lifepanel-core/lifepanel-free-content-v1.mjs";
import {
  clearLifePanelLocalData,
  LIFEPANEL_LAST_EXPORT_KEY,
  LIFEPANEL_REFLECTIONS_KEY,
  LIFEPANEL_SCENARIO_KEY,
  listLifePanelStorageKeys,
} from "../lifepanel-core/lifepanel-data-control-v1.mjs";

const query = (selector) => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`missing free-content element: ${selector}`);
  return element;
};

function readJson(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "없음" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function initFreeContentUI({ onScenarioSelect, onReset } = {}) {
  const validation = validateFreeStage1Content();
  const scenarioList = query("#scenario-list");
  const scenarioStatus = query("#scenario-status");
  const starterExampleList = query("#starter-example-list");
  const reflectionPanel = query("#reflection-panel");
  const reflectionChoices = query("#reflection-choices");
  const reflectionStatus = query("#reflection-status");
  const faqList = query("#faq-list");
  const recoveryLibrary = query("#recovery-library");
  const errorGuideList = query("#error-guide-list");
  const dataStatus = query("#data-protection-status");
  const deleteDialog = query("#delete-life-data-dialog");
  const deleteConfirm = query("#confirm-delete-life-data");
  let selectedScenarioId = readJson(LIFEPANEL_SCENARIO_KEY)?.scenarioId || "start-stuck";
  let activeMove = null;

  function renderScenarios() {
    scenarioList.replaceChildren();
    for (const scenario of FREE_SCENARIOS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scenario-button";
      button.dataset.scenarioId = scenario.id;
      button.setAttribute("aria-pressed", String(scenario.id === selectedScenarioId));
      const title = document.createElement("strong");
      title.textContent = scenario.title;
      const prompt = document.createElement("span");
      prompt.textContent = scenario.prompt;
      button.append(title, prompt);
      button.addEventListener("click", () => selectScenario(scenario.id));
      scenarioList.append(button);
    }
  }

  function selectScenario(scenarioId, { initial = false } = {}) {
    const scenario = FREE_SCENARIOS.find((row) => row.id === scenarioId);
    if (!scenario) return;
    selectedScenarioId = scenario.id;
    try { localStorage.setItem(LIFEPANEL_SCENARIO_KEY, JSON.stringify({ scenarioId, selectedAt: new Date().toISOString() })); } catch { /* selection still works in memory */ }
    renderScenarios();
    renderExamples();
    scenarioStatus.textContent = `“${scenario.title}”에 맞는 첫 행동을 위에 먼저 보여 드립니다. 언제든 다른 상황을 고를 수 있습니다.`;
    onScenarioSelect?.(scenario, { initial });
  }

  function renderExamples() {
    const examples = STARTER_EXAMPLES.filter((row) => row.scenarioId === selectedScenarioId);
    const fallback = STARTER_EXAMPLES.slice(0, 3);
    starterExampleList.replaceChildren();
    for (const example of (examples.length ? examples : fallback)) {
      const item = document.createElement("li");
      item.textContent = example.text;
      starterExampleList.append(item);
    }
  }

  function renderFaq() {
    faqList.replaceChildren();
    for (const item of FAQ_ITEMS) {
      const details = document.createElement("details");
      details.id = item.id;
      const summary = document.createElement("summary");
      summary.textContent = item.question;
      const answer = document.createElement("p");
      answer.textContent = item.answer;
      details.append(summary, answer);
      faqList.append(details);
    }
  }

  function renderRecoveryLibrary() {
    recoveryLibrary.replaceChildren();
    const labels = { shrink: "더 작게", defer: "미루기", rest: "휴식", "ask-help": "도움 요청" };
    for (const kind of Object.keys(labels)) {
      const group = document.createElement("section");
      const heading = document.createElement("h3");
      heading.textContent = labels[kind];
      const list = document.createElement("ul");
      for (const row of RECOVERY_MOVES.filter((item) => item.kind === kind)) {
        const item = document.createElement("li");
        const title = document.createElement("strong");
        title.textContent = row.title;
        const instruction = document.createElement("span");
        instruction.textContent = row.instruction;
        item.append(title, instruction);
        list.append(item);
      }
      group.append(heading, list);
      recoveryLibrary.append(group);
    }
  }

  function renderErrorGuide() {
    errorGuideList.replaceChildren();
    for (const row of ERROR_STATES) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = row.whatHappened;
      const impact = document.createElement("p");
      impact.textContent = `자료 영향: ${row.dataImpact}`;
      const next = document.createElement("p");
      next.textContent = `다음 행동: ${row.nextAction}`;
      details.append(summary, impact, next);
      errorGuideList.append(details);
    }
  }

  function renderDataStatus(message = "") {
    const keys = listLifePanelStorageKeys(localStorage);
    const lastExport = readJson(LIFEPANEL_LAST_EXPORT_KEY);
    const exportedAt = new Date(lastExport?.exportedAt);
    const ageDays = Number.isNaN(exportedAt.getTime()) ? null : Math.floor((Date.now() - exportedAt.getTime()) / 86400000);
    const protection = ageDays === null ? "위험 · 아직 보호 사본 없음" : ageDays <= 7 ? "안전 · 7일 이내 보호 사본 있음" : `주의 · 마지막 사본 ${ageDays}일 전`;
    dataStatus.textContent = `${message ? `${message} · ` : ""}${protection} · LifePanel 저장 영역 ${keys.length}개 · 마지막 사본 ${formatDate(lastExport?.exportedAt)} · 기존 WeDoIt 원본은 삭제 대상이 아닙니다.`;
  }

  function showReflection({ moveTitle, choice }) {
    activeMove = { moveTitle, choice };
    reflectionPanel.hidden = false;
    reflectionChoices.replaceChildren();
    for (const [index, row] of REFLECTION_OUTCOMES.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiet-button";
      button.textContent = row.label;
      button.addEventListener("click", () => {
        const records = readJson(LIFEPANEL_REFLECTIONS_KEY, []);
        const next = [...records, { outcomeId: row.id, moveTitle: activeMove.moveTitle, choice: activeMove.choice, recordedAt: new Date().toISOString() }].slice(-50);
        try {
          localStorage.setItem(LIFEPANEL_REFLECTIONS_KEY, JSON.stringify(next));
          reflectionStatus.textContent = `${row.explanation} ${REFLECTION_PROMPTS[index].prompt} 답하지 않아도 됩니다. 정답이나 점수는 없습니다.`;
        } catch {
          reflectionStatus.textContent = "돌아보기는 확인했지만 기기 저장에는 실패했습니다. 다른 자료는 바뀌지 않았습니다.";
        }
      });
      reflectionChoices.append(button);
    }
    reflectionPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  query("#skip-reflection").addEventListener("click", () => {
    reflectionPanel.hidden = true;
    reflectionStatus.textContent = "돌아보기를 건너뛰었습니다. 기록과 벌점은 없습니다.";
  });
  query("#open-delete-life-data").addEventListener("click", () => {
    deleteConfirm.checked = false;
    query("#delete-life-data-now").disabled = true;
    deleteDialog.showModal();
  });
  deleteConfirm.addEventListener("change", () => { query("#delete-life-data-now").disabled = !deleteConfirm.checked; });
  query("#cancel-delete-life-data").addEventListener("click", () => deleteDialog.close());
  query("#delete-life-data-now").addEventListener("click", () => {
    const result = clearLifePanelLocalData(localStorage);
    deleteDialog.close();
    renderDataStatus(`LifePanel 자료 ${result.removed}개를 이 브라우저에서 지웠습니다`);
    scenarioStatus.textContent = EMPTY_STATES.find((row) => row.id === "empty-history").action;
    onReset?.(result);
  });
  window.addEventListener("lifepanel:backup-created", () => renderDataStatus("새 사본을 만들었습니다"));

  query("#start-now").addEventListener("click", () => query("#scenario-heading").scrollIntoView({ behavior: "smooth", block: "start" }));
  query("#try-example").addEventListener("click", () => selectScenario("low-energy"));

  renderScenarios();
  renderExamples();
  renderFaq();
  renderRecoveryLibrary();
  renderErrorGuide();
  renderDataStatus(validation.pass ? "1단계 콘텐츠 검사 통과" : "콘텐츠 검사가 필요합니다");
  selectScenario(selectedScenarioId, { initial: true });
  return Object.freeze({ showReflection, renderDataStatus, selectScenario });
}
