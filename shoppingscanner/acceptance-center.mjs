import { buildAcceptanceQueue, createReceiptTemplate, summarizeAcceptanceExecution, validateAcceptanceReceipt } from './acceptance-execution-core.mjs';

const [stage1, development] = await Promise.all([
  fetch('/shoppingscanner/stage1-readiness.json', { cache: 'no-store' }).then(response => response.json()),
  fetch('/shoppingscanner/development-readiness.json', { cache: 'no-store' }).then(response => response.json()),
]);
const queue = buildAcceptanceQueue(stage1, development);
const official = { stage1Ready: stage1.counts.actualAcceptanceReady, stage1Total: 27, stage2Ready: 0, stage2Total: 13 };
const summary = summarizeAcceptanceExecution(queue, official);
const byId = id => document.getElementById(id);
const target = byId('receipt-target');

for (const item of queue) target.add(new Option(`${item.id} · ${item.name}`, item.id));

function renderQueue() {
  const stage = byId('stage-filter').value;
  const query = byId('queue-search').value.trim().toLowerCase();
  const rows = queue.filter(item => (stage === 'all' || String(item.stage) === stage) && `${item.id} ${item.name} ${item.missing.join(' ')}`.toLowerCase().includes(query));
  byId('acceptance-queue').innerHTML = rows.map(item => `<article class="ac-item"><span class="ac-badge ${item.stage === 2 ? 'locked' : ''}">${item.stage}단계 · ${item.stage === 2 ? '1단계 수락 전 잠금' : '우선 실행'}</span><h3>${item.id} · ${item.name}</h3><p>필요 발급자: ${item.actor}</p><ul>${item.missing.map(text => `<li>${text}</li>`).join('')}</ul></article>`).join('');
  byId('queue-summary').textContent = `${rows.length}/${queue.length}개 표시 · 1단계 ${summary.stage1Waiting} · 2단계 ${summary.stage2Waiting}`;
}

function selectedRequirement() { return queue.find(item => item.id === target.value); }
function makeTemplate() { byId('receipt-json').value = JSON.stringify(createReceiptTemplate(selectedRequirement()), null, 2); byId('receipt-result').textContent = '실제 발급자·출처·측정·독립 검토값을 채우세요. 합성값은 거부됩니다.'; }

byId('stage-filter').addEventListener('change', renderQueue);
byId('queue-search').addEventListener('input', renderQueue);
target.addEventListener('change', makeTemplate);
byId('make-template').addEventListener('click', makeTemplate);
byId('download-template').addEventListener('click', () => {
  const blob = new Blob([byId('receipt-json').value], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `shopping-scanner-${target.value}-acceptance-receipt.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
});
byId('validate-receipt').addEventListener('click', () => {
  try {
    const receipt = JSON.parse(byId('receipt-json').value);
    const result = validateAcceptanceReceipt(receipt, selectedRequirement(), { stage1Accepted: official.stage1Ready === official.stage1Total });
    byId('receipt-result').textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    byId('receipt-result').textContent = JSON.stringify({ result: 'REJECTED', officialAcceptanceChanged: false, errors: ['INVALID_JSON', error.message] }, null, 2);
  }
});

renderQueue();
makeTemplate();
