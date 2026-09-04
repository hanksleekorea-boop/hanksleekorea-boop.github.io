const element = id => document.getElementById(id);
const setText = (id,value) => { element(id).textContent=value; };
let requirements=[];
function render(){
  const filter=element('status-filter').value;
  const selected=requirements.filter(row=>filter==='all'||row.status===filter);
  element('requirements').replaceChildren(...selected.map(row=>{
    const tr=document.createElement('tr');
    for(const value of [row.id,row.name,row.status==='ACCEPTED'?'실제 수락 완료':'실제 증거 대기']){const td=document.createElement('td');td.textContent=value;tr.append(td);}
    tr.lastChild.className=row.status==='ACCEPTED'?'pass':'wait';return tr;
  }));
  setText('filter-count',`${selected.length}개 표시 / 전체 ${requirements.length}개`);
}
element('status-filter').addEventListener('change',render);
async function json(path){const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw new Error('RESULT_UNAVAILABLE');return response.json();}
try{
  const [report,personas]=await Promise.all([json('/shoppingscanner/content-stage3-readiness.json'),json('/shoppingscanner/content-persona-summary.json')]);
  if(report.schema!=='shopping-scanner-content-stage3-readiness/v1'||report.stage3?.requirements?.length!==12||personas.synthetic!==true)throw new Error('RESULT_INVALID');
  const reqs=report.stage3.requirements;
  if(new Set(reqs.map(row=>row.id)).size!==12||reqs.some(row=>!['ACCEPTED','WAITING_EVIDENCE'].includes(row.status))||reqs.filter(row=>row.status==='ACCEPTED').length!==report.stage3.accepted)throw new Error('RESULT_INVALID');
  if(![report.stages?.stage1,report.stages?.stage2,report.overallContentCompletionPercent].every(value=>Number.isFinite(value)&&value>=0&&value<=100)||!report.metrics||!report.publication)throw new Error('RESULT_INVALID');
  if(report.overallContentCompletionPercent===100&&(report.stage3.accepted!==12||report.evidenceTrust?.verified!==true||report.publication.currentContentVerified!==true))throw new Error('UNSUPPORTED_COMPLETION');
  requirements=report.stage3.requirements;render();
  setText('stage1',`${report.stages.stage1}%`);setText('stage2',`${report.stages.stage2}%`);setText('stage3',`${report.stage3.accepted}/12`);setText('overall',`${report.overallContentCompletionPercent}%`);
  const m=report.metrics;
  setText('review-summary',`사람 1차 검수 ${m.firstReviews}/300 · 고위험 독립 검수 ${m.highRiskReviews}/${m.highRiskRequired} · 일반 표본 ${m.auditReviews}/${m.auditRequired} · 문서 ${m.documentReviews}/${m.documentsRequired}`);
  setText('persona-summary',`합성 ${personas.passed}/${personas.total} 통과 · 실제 참여자 ${m.realUsers}명`);
  setText('publication-status',report.publication.currentContentVerified?'현재 콘텐츠와 공개판의 일치 증거가 검증되었습니다.':'현재 콘텐츠가 공개판에 반영됐다는 최종 증거는 아직 없습니다.');
  setText('checked-at',`판정 시각: ${report.evaluatedAt} · 자료가 바뀌면 새 증거가 필요합니다.`);
  setText('load-state',report.overallContentCompletionPercent===100?'모든 필수 콘텐츠 조건이 실제 증거로 수락되었습니다.':'내부 구현과 별개로 실제 증거 조건이 남아 있습니다.');
}catch{
  requirements=[];render();
  for(const id of ['stage1','stage2','stage3','overall'])setText(id,'미확인');
  setText('review-summary','검수 상태 미확인');setText('persona-summary','합성 검사 상태 미확인');setText('publication-status','공개판 동일성 미확인');setText('checked-at','');
  setText('load-state','결과를 불러오지 못했습니다. 완료 여부는 미확인입니다. 연결을 확인한 뒤 다시 열어 주세요.');
}
