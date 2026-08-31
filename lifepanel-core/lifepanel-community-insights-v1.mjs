export const COMMUNITY_INSIGHTS_VERSION = "lifepanel.community-insights.v1";
export const COMMUNITY_DOMAINS = Object.freeze([
  ["health", "몸·에너지", "Body & energy"], ["work", "시간·집중", "Time & focus"],
  ["creation", "일·역할", "Work & roles"], ["learning", "학습·성장", "Learning & growth"],
  ["home", "집·생활", "Home & daily life"], ["relationships", "관계·돌봄", "Relationships & care"],
  ["money", "돈·자원", "Money & resources"], ["recovery", "회복·여가", "Recovery & leisure"],
].map(([id, ko, en]) => Object.freeze({ id, ko, en })));
const domainIds = COMMUNITY_DOMAINS.map((domain) => domain.id);
const minutes = [3, 5, 10, 15, 25];

export function createSyntheticCommunityDataset(count = 1000) {
  if (!Number.isInteger(count) || count < 100) throw new TypeError("community sample requires at least 100 virtual people");
  return Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
    energy: (index % 5) + 1,
    availableMinutes: minutes[Math.floor(index / 5) % minutes.length],
    interestDomainIds: Object.freeze([...new Set([domainIds[index % 8], domainIds[(index * 3 + 2) % 8], domainIds[(index * 5 + 5) % 8]])]),
  })));
}

function distribution(records) {
  const counts = Object.fromEntries(domainIds.map((id) => [id, 0]));
  for (const record of records) for (const id of record.interestDomainIds) if (id in counts) counts[id] += 1;
  return Object.freeze(domainIds.map((domainId) => Object.freeze({ domainId, count: counts[domainId], percent: Math.round(counts[domainId] / records.length * 100) })).sort((a, b) => b.percent - a.percent || a.domainId.localeCompare(b.domainId)));
}

export function buildCommunityInsights({ records, selectedDomainIds = [], energy = 3, minCohort = 30 } = {}) {
  if (!Array.isArray(records) || records.length < 100) throw new TypeError("insufficient community sample");
  if (/(email|phone|name|address|account|location|note|memo)/.test(JSON.stringify(records).toLowerCase())) throw new TypeError("community aggregates must not contain personal fields");
  const selected = [...new Set(selectedDomainIds)].filter((id) => domainIds.includes(id)).slice(0, 2);
  let similar = records.filter((record) => Math.abs(record.energy - Number(energy)) <= 1 && (!selected.length || selected.some((id) => record.interestDomainIds.includes(id))));
  let broadened = false;
  if (similar.length < minCohort) { similar = records.filter((record) => !selected.length || selected.some((id) => record.interestDomainIds.includes(id))); broadened = true; }
  if (similar.length < minCohort) { similar = records; broadened = true; }
  const peers = distribution(similar);
  return Object.freeze({
    version: COMMUNITY_INSIGHTS_VERSION, provenance: "synthetic-illustrative", isRealUserAverage: false,
    generatedFrom: records.length, cohortSize: similar.length, minimumCohort: minCohort, broadened,
    overall: distribution(records), similar: peers,
    comparisons: Object.freeze(selected.map((domainId) => { const percent = peers.find((item) => item.domainId === domainId)?.percent || 0; return Object.freeze({ domainId, peerInterestPercent: percent, message: percent >= 50 ? "often-shared" : percent >= 30 ? "sometimes-shared" : "less-common" }); })),
    privacy: Object.freeze({ personalFields: 0, externalRequests: 0, individualProfiles: false, ranking: false }),
  });
}
export const SYNTHETIC_COMMUNITY_1000 = createSyntheticCommunityDataset(1000);
