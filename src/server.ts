// TanStack Start server entry.
// Server-only initialization (DB, background jobs) runs here — never in start.ts.
import "@/lib/db.server.init";
import "@/lib/auto-collector.server.init";

export { default } from "@tanstack/react-start/server-entry";
