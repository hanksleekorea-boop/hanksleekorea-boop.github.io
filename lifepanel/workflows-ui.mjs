import {
  buildDayTimeline,
  calculatePersonalBaseline,
  createInboxItem,
  createLifeOverview,
  createPermissionControl,
  createSessionSurfacePayload,
  createSmallExperiment,
  createTimeWindow,
  createWeeklyAdjustment,
  evaluateEnergyBudget,
  finishSmallExperiment,
  formatAdaptiveExpression,
  mergeOfflineRecords,
  startFocusSession,
  summarizeWeek,
  transitionFocusSession,
  updatePermissionControl,
} from "../lifepanel-core/lifepanel-workflows-v1.mjs";
import { WEEKLY_STORY_PATTERNS } from "../lifepanel-core/lifepanel-free-content-v1.mjs";

const captureKey = "lifepanel.alpha.inbox.v1";
const sessionKey = "lifepanel.alpha.session.v1";
const experimentKey = "lifepanel.alpha.experiment.v1";
const weeklyKey = "lifepanel.alpha.weekly-adjustment.v1";
const offlineKey = "lifepanel.alpha.workflow-roundtrip.v1";

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function query(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`missing workflow element: ${selector}`);
  return element;
}

export function initWorkflowPanels() {
  const captureMode = query("#capture-mode");
  const captureText = query("#capture-text");
  const captureStatus = query("#capture-status");
  const captureList = query("#capture-list");
  let captures = readJson(captureKey, []);

  function renderCaptures() {
    captureList.replaceChildren();
    for (const item of captures.slice(-3).reverse()) {
      const row = document.createElement("li");
      row.textContent = `${item.mode === "voice-note" ? "음성 메모 문구" : "글"} · ${item.text}`;
      captureList.append(row);
    }
  }

  query("#save-capture").addEventListener("click", () => {
    try {
      const item = createInboxItem({ id: `capture-${Date.now()}`, mode: captureMode.value, text: captureText.value });
      captures = [...captures, item].slice(-50);
      writeJson(captureKey, captures);
      captureText.value = "";
      captureStatus.textContent = "기기 안 오프라인 수집함에 저장했습니다. 외부 전송은 없습니다.";
      renderCaptures();
    } catch {
      captureStatus.textContent = "담을 내용을 한 글자 이상 입력해 주세요.";
    }
  });
  query("#cancel-capture").addEventListener("click", () => {
    captureText.value = "";
    captureStatus.textContent = "입력을 취소했습니다. 저장된 자료는 바꾸지 않았습니다.";
  });
  renderCaptures();

  let session = readJson(sessionKey, null);
  const sessionStatus = query("#session-status");
  const sessionButtons = {
    start: query("#start-session"), pause: query("#pause-session"), resume: query("#resume-session"), end: query("#end-session"),
  };
  function renderSession() {
    const active = session && session.status !== "ended";
    sessionButtons.start.disabled = Boolean(active);
    sessionButtons.pause.disabled = !active || session.status !== "running";
    sessionButtons.resume.disabled = !active || session.status !== "paused";
    sessionButtons.end.disabled = !active;
    if (!session) return;
    const surfaces = createSessionSurfacePayload(session);
    for (const [surface, target] of [["app", "#session-app"], ["widget", "#session-widget"], ["ribbon", "#session-ribbon"]]) {
      query(target).textContent = `${surfaces[surface].title} · ${surfaces[surface].statusLabel}`;
    }
    sessionStatus.textContent = `${session.title} · ${surfaces.app.statusLabel} · 앱·위젯·상단 상태가 같습니다.`;
  }
  function saveSession() { writeJson(sessionKey, session); renderSession(); }
  sessionButtons.start.addEventListener("click", () => { session = startFocusSession({ id: `session-${Date.now()}`, title: "작은 집중 10분" }); saveSession(); });
  sessionButtons.pause.addEventListener("click", () => { session = transitionFocusSession(session, "pause"); saveSession(); });
  sessionButtons.resume.addEventListener("click", () => { session = transitionFocusSession(session, "resume"); saveSession(); });
  sessionButtons.end.addEventListener("click", () => { session = transitionFocusSession(session, "end"); saveSession(); });
  renderSession();

  const budgetStatus = query("#budget-status");
  function selectedBudgetMoves() {
    return [...document.querySelectorAll(".budget-move:checked")].map((input) => ({ energyCost: Number(input.dataset.energyCost) }));
  }
  function renderBudget(ignoreWarning = false) {
    const result = evaluateEnergyBudget({ available: Number(query("#energy-budget").value), moves: selectedBudgetMoves(), ignoreWarning });
    budgetStatus.textContent = `${result.message} 계획 ${result.planned} / 가용 ${result.available}${result.ignoredByUser ? " · 사용자가 경고를 확인하고 유지했습니다." : ""}`;
  }
  query("#evaluate-budget").addEventListener("click", () => renderBudget(false));
  query("#ignore-budget").addEventListener("click", () => renderBudget(true));

  const timelineList = query("#timeline-list");
  function renderTimeline() {
    const timeZone = query("#timeline-zone").value;
    const windows = [
      createTimeWindow({ id: "morning", label: "집중 20분", startsAt: "2026-08-11T02:00:00Z", endsAt: "2026-08-11T02:20:00Z", timeZone }),
      createTimeWindow({ id: "overlap", label: "짧은 정리", startsAt: "2026-08-11T02:15:00Z", endsAt: "2026-08-11T02:30:00Z", timeZone }),
      createTimeWindow({ id: "rest", label: "휴식", startsAt: "2026-08-11T03:00:00Z", endsAt: "2026-08-11T03:05:00Z", timeZone }),
    ];
    timelineList.replaceChildren();
    for (const entry of buildDayTimeline(windows)) {
      const row = document.createElement("li");
      row.dataset.state = entry.state;
      row.textContent = `${entry.label} · ${entry.conflict ? "시간 충돌" : entry.gapMinutes ? `앞에 빈 시간 ${entry.gapMinutes}분` : "예정"}`;
      timelineList.append(row);
    }
  }
  query("#timeline-zone").addEventListener("change", renderTimeline);
  renderBudget(false);
  renderTimeline();

  const baselineStatus = query("#baseline-status");
  query("#check-baseline").addEventListener("click", () => {
    const now = new Date();
    const entries = [1, 2, 3, 4, 5].map((daysAgo) => ({ value: 3, at: new Date(now.getTime() - daysAgo * 86400000).toISOString() }));
    baselineStatus.textContent = calculatePersonalBaseline({ entries, currentValue: Number(query("#current-baseline").value), now }).message;
  });
  let experiment = readJson(experimentKey, null);
  const experimentStatus = query("#experiment-status");
  query("#start-experiment").addEventListener("click", () => {
    experiment = createSmallExperiment({ id: `experiment-${Date.now()}`, hypothesis: "아침 5분 걷기와 집중의 관련성", action: "아침 5분 걷기", durationDays: 7 });
    writeJson(experimentKey, experiment);
    experimentStatus.textContent = "7일 실험을 시작했습니다. 결과 전에는 효과를 단정하지 않습니다.";
  });
  query("#finish-experiment").addEventListener("click", () => {
    if (!experiment || experiment.status !== "running") { experimentStatus.textContent = "먼저 실험을 시작해 주세요."; return; }
    experiment = finishSmallExperiment(experiment, { result: "집중이 조금 쉬웠다고 기록함" });
    writeJson(experimentKey, experiment);
    experimentStatus.textContent = experiment.conclusion;
  });

  const domainControls = [...document.querySelectorAll("#life-domain-controls input")];
  const lifeList = query("#life-list");
  const lifeStatus = query("#life-status");
  function renderLifeOverview(changed) {
    let selected = domainControls.filter((control) => control.checked).map((control) => control.value);
    if (selected.length > 2 && changed) { changed.checked = false; selected = domainControls.filter((control) => control.checked).map((control) => control.value); lifeStatus.textContent = "한 번에 두 영역까지만 열 수 있습니다."; }
    const labels = { health: "건강", relationships: "관계", work: "일", learning: "배움", money: "돈", home: "집", creation: "창작", recovery: "회복" };
    lifeList.replaceChildren();
    for (const domain of createLifeOverview({ openDomainIds: selected })) {
      const row = document.createElement("li");
      row.textContent = `${labels[domain.id]} · ${domain.state === "open" ? "열림" : "잠김"}`;
      lifeList.append(row);
    }
  }
  for (const control of domainControls) control.addEventListener("change", () => renderLifeOverview(control));
  renderLifeOverview();

  let permission = createPermissionControl({ id: "calendar", label: "일정", reason: "빈 시간과 충돌을 보여 주기 위해" });
  const permissionStatus = query("#permission-status");
  function applyPermission(action) {
    permission = updatePermissionControl(permission, action);
    permissionStatus.textContent = action === "delete" ? "일정 연결 자료를 기기에서 삭제했습니다." : `일정 연결 ${permission.state === "on" ? "켜짐" : "꺼짐"} · 이유: ${permission.reason}`;
  }
  query("#enable-calendar").addEventListener("click", () => applyPermission("enable"));
  query("#disable-calendar").addEventListener("click", () => applyPermission("disable"));
  query("#delete-calendar").addEventListener("click", () => applyPermission("delete"));

  const expressionStyle = query("#expression-style");
  function renderExpression() {
    query("#expression-preview").textContent = formatAdaptiveExpression({ status: "차분함", nextAction: "물 한 잔", protection: "잠금 화면 숨김" }, expressionStyle.value).text;
  }
  expressionStyle.addEventListener("change", renderExpression);
  renderExpression();

  function toggleBodyClass(buttonSelector, className) {
    const button = query(buttonSelector);
    button.addEventListener("click", () => {
      const active = document.body.classList.toggle(className);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  toggleBodyClass("#toggle-large-text", "large-text");
  toggleBodyClass("#toggle-contrast", "high-contrast");

  const week = summarizeWeek([{ minutes: 20, energyCost: 2, completed: true }, { minutes: 15, energyCost: 3, completed: false }, { minutes: 5, energyCost: 1, completed: true }]);
  query("#week-minutes").textContent = `${week.minutes}분`;
  query("#week-energy").textContent = String(week.energySpent);
  query("#week-results").textContent = `${week.completed}/${week.total}`;
  query("#weekly-story").textContent = `최근 7일 · 표본 ${week.total}개 · ${WEEKLY_STORY_PATTERNS[0].template.replace("{count}", String(week.completed))} 끝내지 않은 선택에도 벌점은 없습니다.`;
  const weeklyStatus = query("#weekly-status");
  const applyWeek = query("#apply-week");
  let weeklyPreview = null;
  query("#preview-week").addEventListener("click", () => {
    weeklyPreview = createWeeklyAdjustment({ experimentId: query("#weekly-experiment").value, weekStart: new Date(), confirmed: false });
    weeklyStatus.textContent = `${weeklyPreview.experimentId} · 다음 주 적용 전 미리보기입니다.`;
    applyWeek.disabled = false;
  });
  applyWeek.addEventListener("click", () => {
    if (!weeklyPreview) return;
    const applied = createWeeklyAdjustment({ experimentId: weeklyPreview.experimentId, weekStart: weeklyPreview.weekStart, confirmed: true });
    writeJson(weeklyKey, applied);
    weeklyStatus.textContent = `${applied.experimentId} 실험 1개를 다음 주에 적용했습니다.`;
    applyWeek.disabled = true;
  });

  const priorOffline = readJson(offlineKey, []);
  const heartbeat = { id: "workflow-state", updatedAt: "2026-08-11T00:00:00.000Z", version: 1 };
  const mergedOffline = mergeOfflineRecords(priorOffline, [heartbeat, heartbeat]);
  writeJson(offlineKey, mergedOffline);
  query("#offline-status").textContent = `오프라인 왕복 후보 ${mergedOffline.length}건 · 중복 없이 저장했습니다. 실제 기기 재부팅은 별도 미확인입니다.`;
}
