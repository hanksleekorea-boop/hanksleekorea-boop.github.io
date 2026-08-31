import { buildLongTrend, buildWeeklyBrief } from "../lifepanel-core/lifepanel-stage2-insights-v1.mjs?v=24";

const CHOICE_KEY = "lifepanel.alpha.move-choices.v1";
const $ = (selector) => {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`missing stage2 element: ${selector}`);
  return node;
};

function readChoices() {
  try {
    const rows = JSON.parse(localStorage.getItem(CHOICE_KEY) || "[]");
    return Array.isArray(rows) ? rows.filter((row) => row?.chosenAt).map((row, index) => ({ id: `${row.moveId}-${index}`, at: row.chosenAt, completed: row.choice === "complete", minutes: row.adjustedMove?.minutes || 0, domainId: String(row.moveId || "unknown").split("-")[0] })) : [];
  } catch { return []; }
}

function illustrativeRecords() {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, index) => ({ id: `illustrative-${index}`, at: new Date(now - index * 86400000).toISOString(), completed: index % 3 !== 0, minutes: 5, energy: index % 5 + 1, domainId: "illustrative" }));
}

export function initStage2UI() {
  const weekly = $("#stage2-weekly-brief");
  const related = $("#stage2-related-candidate");
  const next = $("#stage2-next-action");
  const status = $("#stage2-trend-status");
  const windowSelect = $("#stage2-trend-window");

  function render(records, illustrative = false) {
    const brief = buildWeeklyBrief({ records });
    const trend = buildLongTrend({ records, windowDays: Number(windowSelect.value) });
    weekly.textContent = brief.message;
    related.textContent = brief.relatedCandidate || "관련 후보를 말하지 않습니다.";
    next.textContent = brief.nextAction;
    const prefix = illustrative ? "설명용 가상 기록 · 실제 사용자 평균 아님" : "내 기기 기록";
    status.textContent = trend.status === "ready" ? `${prefix} · ${trend.conclusion} ${trend.caveat}` : `${prefix} · ${trend.message} 결론을 표시하지 않습니다.`;
  }

  $("#stage2-refresh-insights").addEventListener("click", () => render(readChoices()));
  $("#stage2-demo-insights").addEventListener("click", () => render(illustrativeRecords(), true));
  windowSelect.addEventListener("change", () => render(readChoices()));
  render(readChoices());
}
