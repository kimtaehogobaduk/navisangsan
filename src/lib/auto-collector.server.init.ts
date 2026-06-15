import { startAutoCollector } from "./auto-collector.server";

if (process.env.ENABLE_AUTO_COLLECTOR === "true") {
  startAutoCollector().catch(console.error);
} else {
  console.log("[AutoCollector] 서버 시작 자동 실행 비활성화 — 관리자 수동 실행만 사용");
}
