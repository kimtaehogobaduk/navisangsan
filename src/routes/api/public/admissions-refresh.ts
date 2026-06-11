import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/admissions-refresh")({
  server: {
    handlers: {
      POST: async () => {
        const { triggerManualRefresh } = await import("@/lib/admissions.worker");
        // fire and forget — pg_cron call should not block on long AI work
        triggerManualRefresh().catch((e) => console.error("[admissions-refresh]", e));
        return Response.json({ ok: true, started: true });
      },
      GET: async () => Response.json({ ok: true, hint: "POST to trigger admissions refresh" }),
    },
  },
});
