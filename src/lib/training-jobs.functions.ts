import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function extractYoutubeUrls(input: string): string[] {
  const matches = input.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[A-Za-z0-9_\-?=&%]+/g);
  return (matches ?? []).map((u) => u.replace(/[)\],.]+$/g, ""));
}

export const queueYoutubeJobsFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      urls: z.array(z.string().min(1)).min(1).max(1000),
      category: z.string().min(1).max(60).default("기타"),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = data.urls
      .flatMap((u) => extractYoutubeUrls(u.trim()))
      .filter(Boolean)
      .map((u) => extractYoutubeId(u))
      .filter((id): id is string => !!id)
      .filter((id, index, arr) => arr.indexOf(id) === index)
      .map((id) => ({
        job_type: "youtube",
        url: `https://www.youtube.com/watch?v=${id}`,
        category: data.category,
        status: "pending",
      }));
    if (!rows.length) return { queued: 0, skipped: data.urls.length };
    const { error } = await supabaseAdmin.from("training_jobs").insert(rows);
    if (error) throw new Error(error.message);
    return { queued: rows.length, skipped: data.urls.length - rows.length };
  });

export const listTrainingJobsFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: jobs } = await supabaseAdmin
      .from("training_jobs")
      .select("id, url, status, error, category, created_at, processed_at, doc_id")
      .order("created_at", { ascending: false })
      .limit(200);
    const { data: counts } = await supabaseAdmin
      .from("training_jobs")
      .select("status");
    const summary = { pending: 0, processing: 0, done: 0, failed: 0 } as Record<string, number>;
    for (const r of counts ?? []) summary[r.status] = (summary[r.status] ?? 0) + 1;
    return { jobs: jobs ?? [], summary };
  });

export const cancelTrainingJobFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("training_jobs")
      .update({ status: "cancelled", processed_at: new Date().toISOString(), error: "사용자 취소" })
      .eq("id", data.id)
      .in("status", ["pending", "processing", "failed"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTrainingJobFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("training_jobs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTrainingDocsFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("training_docs")
      .select("id, category, title, content, source_type, source_url, created_at")
      .order("created_at", { ascending: false });
    return { docs: data ?? [] };
  });

export const saveTrainingDocFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      category: z.string().min(1).max(60),
      title: z.string().min(1).max(200),
      content: z.string().min(1).max(100000),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("training_docs")
        .update({ category: data.category, title: data.title, content: data.content })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("training_docs")
        .insert({ category: data.category, title: data.title, content: data.content, source_type: "manual" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id as string };
    }
  });

export const deleteTrainingDocFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("training_docs").delete().eq("id", data.id);
    return { ok: true };
  });

export const clearFailedJobsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("training_jobs").delete().in("status", ["done", "failed"]);
    return { ok: true };
  });