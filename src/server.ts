import { initDb } from "@/lib/db.server";
import { startAutoCollector } from "@/lib/auto-collector.server";

initDb().catch(console.error);
startAutoCollector().catch(console.error);

export { default } from "@tanstack/react-start/server-entry";
