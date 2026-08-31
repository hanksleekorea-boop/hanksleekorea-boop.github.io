export const ACCEPTANCE_RECEIPT_SCHEMA = 'shopping-scanner-acceptance-receipt/v1';

const actorFor = text => {
  if (/판매처|오퍼|재고|정책|seller|merchant/i.test(text)) return 'verified_merchant_or_data_rights_owner';
  if (/법률|legal/i.test(text)) return 'independent_legal_reviewer';
  if (/보안|암호|server|서버/i.test(text)) return 'independent_security_or_server_operator';
  if (/Android|iPhone|TalkBack|VoiceOver|카메라|실기기|저속망/i.test(text)) return 'physical_device_tester';
  if (/사람|사용자|고령|공유|번역|골드셋|라벨/i.test(text)) return 'consented_human_reviewer_or_participant';
  if (/운영|감시|복구|지원|SLA|처리/i.test(text)) return 'named_service_operator';
  if (/환율|관세|수리성|에너지|리뷰|수익|정산/i.test(text)) return 'authoritative_source_or_finance_operator';
  return 'independent_evidence_issuer';
};

export function buildAcceptanceQueue(stage1Ledger, developmentLedger) {
  const stage1 = stage1Ledger.initiatives
    .filter(row => row.acceptance === 'WAITING_EXTERNAL')
    .map(row => ({
      id: row.id,
      stage: 1,
      name: row.name,
      missing: [...row.missing],
      actor: actorFor(`${row.name} ${row.missing.join(' ')}`),
      state: 'WAITING_EXTERNAL',
    }));
  const stage2 = developmentLedger.stage2.initiatives.map(row => ({
    id: row.id,
    stage: 2,
    name: row.name,
    missing: [...row.externalAcceptanceMissing],
    actor: actorFor(`${row.name} ${row.externalAcceptanceMissing.join(' ')}`),
    state: 'WAITING_EXTERNAL',
  }));
  return [...stage1, ...stage2].sort((a, b) => a.stage - b.stage || a.id.localeCompare(b.id));
}

export function createReceiptTemplate(requirement, observedAt = new Date().toISOString()) {
  return {
    schema: ACCEPTANCE_RECEIPT_SCHEMA,
    initiativeId: requirement.id,
    stage: requirement.stage,
    realWorld: true,
    synthetic: false,
    observedAt,
    issuer: { name: '', role: requirement.actor, organization: '' },
    source: { uri: '', rightsOrConsent: '', capturedAt: observedAt },
    claims: requirement.missing.map(text => ({
      requirement: text,
      result: 'pass',
      measuredValue: '',
      method: '',
      artifactSha256: '',
    })),
    reviewer: { name: '', independent: true, reviewedAt: '' },
    declaration: '실제 관측·권리·동의를 갖춘 증거이며 합성 자료가 아닙니다.',
  };
}

const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validSource = value => typeof value === 'string' && (/^https:\/\//i.test(value) || /^urn:sha256:[a-f0-9]{64}$/i.test(value));
const sha256 = value => /^[a-f0-9]{64}$/i.test(String(value || ''));

export function validateAcceptanceReceipt(receipt, requirement, { stage1Accepted = false } = {}) {
  const errors = [];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) errors.push('RECEIPT_OBJECT_REQUIRED');
  if (receipt?.schema !== ACCEPTANCE_RECEIPT_SCHEMA) errors.push('SCHEMA_MISMATCH');
  if (receipt?.initiativeId !== requirement.id || receipt?.stage !== requirement.stage) errors.push('INITIATIVE_STAGE_MISMATCH');
  if (receipt?.realWorld !== true || receipt?.synthetic !== false) errors.push('REAL_WORLD_NON_SYNTHETIC_REQUIRED');
  if (!validDate(receipt?.observedAt)) errors.push('OBSERVED_AT_REQUIRED');
  if (!receipt?.issuer?.name || receipt?.issuer?.role !== requirement.actor) errors.push('VERIFIED_ISSUER_REQUIRED');
  if (!validSource(receipt?.source?.uri) || !receipt?.source?.rightsOrConsent || !validDate(receipt?.source?.capturedAt)) errors.push('SOURCE_RIGHTS_CONSENT_REQUIRED');
  if (!Array.isArray(receipt?.claims) || receipt.claims.length !== requirement.missing.length) errors.push('CLAIM_COUNT_MISMATCH');
  for (const missing of requirement.missing) {
    const claim = receipt?.claims?.find(row => row?.requirement === missing);
    if (!claim || claim.result !== 'pass' || claim.measuredValue === '' || !claim.method || !sha256(claim.artifactSha256)) errors.push(`CLAIM_EVIDENCE_REQUIRED:${missing}`);
  }
  if (!receipt?.reviewer?.name || receipt?.reviewer?.independent !== true || !validDate(receipt?.reviewer?.reviewedAt)) errors.push('INDEPENDENT_REVIEW_REQUIRED');
  const validCandidate = errors.length === 0;
  const stageLocked = requirement.stage === 2 && stage1Accepted !== true;
  return {
    result: validCandidate ? (stageLocked ? 'VALID_CANDIDATE_STAGE_LOCKED' : 'VALID_CANDIDATE_REQUIRES_OFFICIAL_REVIEW') : 'REJECTED',
    validCandidate,
    stageLocked,
    officialAcceptanceChanged: false,
    errors,
  };
}

export function summarizeAcceptanceExecution(queue, official = { stage1Ready: 11, stage1Total: 27, stage2Ready: 0, stage2Total: 13 }) {
  return {
    engineering: { ready: 40, total: 40, percent: 100 },
    official,
    waitingExternal: queue.length,
    stage1Waiting: queue.filter(row => row.stage === 1).length,
    stage2Waiting: queue.filter(row => row.stage === 2).length,
    stage2LockedUntilStage1OfficiallyAccepted: official.stage1Ready !== official.stage1Total,
    syntheticNeverCounts: true,
  };
}
