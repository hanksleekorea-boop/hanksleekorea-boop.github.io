# LifePanel 공통 핵심

웹 조종석과 Android/iOS의 작은 표면이 함께 사용하는, 외부 통신 없는 자료 계약이다.

- `lifepanel-contract-v1.mjs`: 첫 설정·방향·신호·설명 가능한 다음 행동·진행 중 세션·잠금 화면 안전 요약.
- 이 계약은 **로컬 우선**이며 서버·건강 데이터·계정·광고·분석 값을 포함하지 않는다.
- 잠금 화면은 숨김·일반·상세 3단계이며 오래된 정보는 설정과 무관하게 숨긴다.
- 잠금 화면 기본값은 숨김이며 상세 제목을 기기 안에 저장하려면 사용자가 노출을 명시적으로 확인해야 한다.
- 위기·의료·금융 안내는 진단·치료 지시·거래 실행 지시·비밀 신고를 하지 않고, 사용자가 직접 고르는 공식 도움 경로만 제시한다.
- 추천은 이유·사용한 자료·자료 시각이 모두 있어야 보이고, 사용자가 전체 또는 하나씩 끌 수 있다.
- 첫 설정은 사용자가 직접 고른 목적·역할·언어·시간대만 저장한다.
- `lifepanel-commerce-v1.mjs`: 무료·Plus 후보 상품, 구매 전 고지, 중복 이벤트 방지, 검증된 공급자 사건만 반영하는 권리·취소·환불·복원 계약이다. 공급자 연결 전에는 실제 결제를 만들지 않는다.
- `lifepanel-commerce-provider-v1.mjs`: 서버에서만 실행할 결제창 요청·영수증 해시·서명 알림·최소 감사 기록 계약이다. 브라우저 금액과 위조 알림은 신뢰하지 않는다.

검사:

```powershell
& "C:\Users\x13\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" 40_TESTS/test_lifepanel_contract_v1.mjs
& "C:\Users\x13\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" 40_TESTS/test_lifepanel_commerce_contract_v1.mjs
& "C:\Users\x13\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" 40_TESTS/test_lifepanel_commerce_provider_v1.mjs
```
