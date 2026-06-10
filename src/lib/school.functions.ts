import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SchoolResearch = {
  school_name: string;
  region: string | null;
  tier: "최상위" | "상위" | "중위" | "일반" | "미확인";
  type: string; // 영재고/과학고/외고/자사고/일반고/학군지일반고 등
  district_note: string; // 학군지 여부 등
  internal_competition: string; // 내신 경쟁 강도 설명
  grade_to_university: string; // 내신 등급별 진학 예상
  notes: string; // 기타 핵심 특징
  sources: string[];
};

function schoolKey(school: string, region?: string) {
  return `${(region ?? "").trim()}|${school.trim()}`.toLowerCase();
}

async function firecrawlSearch(query: string): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return "";
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, limit: 5, lang: "ko", country: "kr" }),
    });
    if (!res.ok) return "";
    const j = (await res.json()) as { data?: { web?: Array<{ title?: string; description?: string; url?: string }> } };
    const items = j.data?.web ?? [];
    return items
      .map((i, idx) => `[${idx + 1}] ${i.title ?? ""}\n${i.description ?? ""}\n출처: ${i.url ?? ""}`)
      .join("\n\n");
  } catch {
    return "";
  }
}

export const researchSchoolFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      school: z.string().min(1).max(120),
      region: z.string().max(120).optional(),
      force: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }): Promise<SchoolResearch | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = schoolKey(data.school, data.region);

    if (!data.force) {
      const { data: existing } = await supabaseAdmin
        .from("school_research")
        .select("data")
        .eq("school_key", key)
        .maybeSingle();
      if (existing?.data) return existing.data as SchoolResearch;
    }

    const { cerebrasResearchChat } = await import("./cerebras.server");
    const queries = [
      `${data.region ?? ""} ${data.school} 학교 수준 내신 경쟁 대학 진학 실적`.trim(),
      `${data.school} 입시 후기 내신 등급 진학`,
    ];
    const searchBlocks = await Promise.all(queries.map((q) => firecrawlSearch(q)));
    const webContext = searchBlocks.filter(Boolean).join("\n\n---\n\n").slice(0, 6000);

    const sys = `너는 한국 고교 입시 분석가다. 주어진 웹 검색 결과와 일반 지식을 종합해 학교 한 곳을 분석한다.
반드시 다음 JSON 한 개만 출력. 다른 텍스트 금지.
{
 "school_name": "...",
 "region": "...",
 "tier": "최상위|상위|중위|일반|미확인",
 "type": "영재고|과학고|외고|국제고|자사고|특목고|학군지 일반고|일반고|특성화고|기타",
 "district_note": "학군지 여부 및 지역 특징 한 문장",
 "internal_competition": "내신 경쟁 강도. 일반고 동일 등급 대비 가중치 해석 포함 2~3문장",
 "grade_to_university": "내신 1등급→어디, 2등급→어디, 3등급→어디 형태로 4~6줄 구체 대학명",
 "notes": "이 학교만의 강점/특이사항 1~2문장",
 "sources": ["url1","url2"]
}`;
    const user = `[학교] ${data.school}\n[지역] ${data.region ?? "미상"}\n\n[웹 검색 결과]\n${webContext || "(검색 결과 없음 — 일반 지식으로만 답)"}\n`;

    let parsed: SchoolResearch | null = null;
    try {
      const raw = await cerebrasResearchChat({
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      });
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]) as SchoolResearch;
    } catch (e) {
      console.error("[school research] AI 실패", e);
    }
    if (!parsed) return null;
    parsed.school_name = data.school;
    parsed.region = data.region ?? null;

    await supabaseAdmin
      .from("school_research")
      .upsert(
        {
          school_key: key,
          school_name: data.school,
          region: data.region ?? null,
          data: parsed,
        },
        { onConflict: "school_key" },
      );
    return parsed;
  });

export const getSchoolResearchFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ school: z.string().min(1), region: z.string().optional() }))
  .handler(async ({ data }): Promise<SchoolResearch | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("school_research")
      .select("data")
      .eq("school_key", schoolKey(data.school, data.region))
      .maybeSingle();
    return (row?.data as SchoolResearch | null) ?? null;
  });