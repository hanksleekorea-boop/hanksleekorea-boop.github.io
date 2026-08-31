import {
  LIFEPANEL_COMMERCE_MODE,
  commercialReadinessScore,
  createCheckoutDisclosure,
  createRestoreRequest,
} from "../lifepanel-core/lifepanel-commerce-v1.mjs";
import { inspectWebCheckoutReadiness } from "../lifepanel-core/lifepanel-web-checkout-readiness-v1.mjs";

const restoreButton = document.querySelector("#commerce-restore");
const status = document.querySelector("#commerce-status");
const checkoutButton = document.querySelector("#commerce-checkout");
const readinessStatus = document.querySelector("#commerce-readiness");
const webReadinessButton = document.querySelector("#commerce-web-readiness");
const webReadinessStatus = document.querySelector("#commerce-web-readiness-status");
const disclosure = createCheckoutDisclosure("plus-monthly");
const readiness = commercialReadinessScore({ providerAdapterContractVerified: true });

checkoutButton.title = disclosure.lines[0];
checkoutButton.dataset.commerceMode = LIFEPANEL_COMMERCE_MODE;
checkoutButton.dataset.readinessScore = String(readiness.score);
readinessStatus.textContent = `유료화 개발 준비도 ${readiness.score}/${readiness.maximum} · 실제 구매·환불 실증 전 출시 차단`;

restoreButton.addEventListener("click", () => {
  const request = createRestoreRequest({
    accountReference: "local-preview-no-account",
    provider: "not-connected",
  });
  status.textContent = request.mayCharge
    ? "복원 요청을 중단했습니다. 돈을 청구하지 않는 복원만 허용합니다."
    : "현재 복원할 실제 구매가 없습니다. 출시 뒤 같은 스토어 계정에서 ‘구매 복원’을 누르면 돈을 청구하지 않고 권리만 확인합니다.";
});

webReadinessButton.addEventListener("click", () => {
  const report = inspectWebCheckoutReadiness();
  webReadinessStatus.textContent = report.message;
});
