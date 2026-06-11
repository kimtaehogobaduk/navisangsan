/**
 * 자동 입시 정보 수집 시스템
 * - 앱이 켜져 있든 꺼져 있든 API 엔드포인트를 통해 계속 동작
 * - Groq(웹검색/빠른분석) + Cerebras(깊이 있는 요약) 결합
 * - training_docs 테이블에 자동 저장 → AI 프롬프트에 실시간 반영
 */

const COLLECTION_TOPICS = [
  {
    id: "suneung-2026",
    category: "수능",
    query: "2026학년도 수능 출제 경향 국어 수학 영어 탐구 변화",
    title: "2026학년도 수능 출제 경향 분석",
  },
  {
    id: "snu-2026",
    category: "대학별 입시",
    query: "서울대학교 2026학년도 수시 정시 입시요강 학종 지역균형 모집인원",
    title: "서울대 2026 입시 정보",
  },
  {
    id: "yonsei-korea-2026",
    category: "대학별 입시",
    query: "연세대 고려대 2026학년도 수시 학종 논술 교과 정시 수능최저",
    title: "연대·고대 2026 입시 정보",
  },
  {
    id: "medical-2026",
    category: "의대약대",
    query: "의과대학 2026 수시 정시 합격선 수능최저 경쟁률",
    title: "의대 2026 입시 정보",
  },
  {
    id: "goeyo-highschool",
    category: "정책변경",
    query: "2025 고교학점제 선택과목 내신 5등급 대입 반영",
    title: "고교학점제 5등급제 대입 반영 방식",
  },
  {
    id: "essay-trend",
    category: "자기소개서",
    query: "2026학년도 대학 자기소개서 항목 변화 학종 서류평가",
    title: "자기소개서 트렌드 2025-2026",
  },
  {
    id: "saengbu-trend",
    category: "생기부",
    query: "생활기록부 세부능력특기사항 2025 2026 작성 가이드 대학 평가",
    title: "생기부 세특 최신 트렌드",
  },
  {
    id: "nsu-strategy",
    category: "수능",
    query: "N수생 재수 삼수 2026 정시 전략 합격 비율 주요대학",
    title: "N수생 정시 전략 2025-2026",
  },
];

let collectionTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function collectOneTopic(topic: typeof COLLECTION_TOPICS[0]) {
  const { groqWebSearch } = await import("./groq.server");
  const { cerebrasChat } = await import("./cerebras.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Groq로 웹 검색 + 빠른 분석
  let rawInfo = "";
  try {
    rawInfo = await groqWebSearch(topic.query);
  } catch (e) {
    console.warn(`[AutoCollector] Groq 검색 실패 (${topic.id}):`, e instanceof Error ? e.message : e);
    // 실패 시 Cerebras로 자체 지식 기반 생성
    rawInfo = await cerebrasChat({
      messages: [
        {
          role: "system",
          content: "너는 한국 대입 전문가다. 최신 입시 정보를 구체적인 수치와 함께 정리한다.",
        },
        { role: "user", content: `${topic.query}에 대해 최신 정보를 정리해줘.` },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    });
  }

  // Cerebras로 입시 관점에서 심층 정리
  const summarized = await cerebrasChat({
    messages: [
      {
        role: "system",
        content: `너는 한국 입시 전문가다. 주어진 정보를 학생·학부모·컨설턴트에게 유용한 형태로 재정리한다.
반드시 아래 JSON 형식만 출력. 다른 텍스트 없음.
{"title":"제목(60자 이내)","content":"핵심 입시 정보 (500~1500자, 불릿·수치·전략 포함)","importance":3}
importance: 1(낮음)~5(매우높음)`,
      },
      {
        role: "user",
        content: `주제: ${topic.title}\n\n수집된 정보:\n${rawInfo.slice(0, 3000)}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 2000,
  });

  const m = summarized.match(/\{[\s\S]*\}/);
  const parsed = m ? (JSON.parse(m[0]) as { title: string; content: string; importance?: number }) : null;

  const docTitle = parsed?.title ?? topic.title;
  const docContent = parsed?.content ?? rawInfo.slice(0, 2000);

  // training_docs에 upsert (source_url을 unique key로 활용)
  const sourceKey = `auto-collect::${topic.id}`;
  const { data: existing } = await supabaseAdmin
    .from("training_docs")
    .select("id")
    .eq("source_url", sourceKey)
    .maybeSingle();

  if (existing?.id) {
    await supabaseAdmin
      .from("training_docs")
      .update({
        title: docTitle,
        content: docContent,
        category: topic.category,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("training_docs").insert({
      category: topic.category,
      title: docTitle,
      content: docContent,
      source_type: "auto",
      source_url: sourceKey,
    });
  }

  console.log(`[AutoCollector] ✓ ${topic.id} 수집 완료`);
}

async function runCollection() {
  if (isRunning) return;
  isRunning = true;
  console.log("[AutoCollector] 자동 수집 시작…");
  
  for (const topic of COLLECTION_TOPICS) {
    try {
      await collectOneTopic(topic);
    } catch (e) {
      console.error(`[AutoCollector] ${topic.id} 실패:`, e instanceof Error ? e.message : e);
    }
    // rate limit 방지: 5초 간격
    await new Promise((r) => setTimeout(r, 5000));
  }
  
  isRunning = false;
  console.log("[AutoCollector] 자동 수집 완료");
}

export async function startAutoCollector(): Promise<void> {
  if (collectionTimer) return;

  // 앱 시작 후 30초 뒤 첫 수집 (서버 초기화 완료 후)
  setTimeout(() => {
    runCollection().catch(console.error);
  }, 30_000);

  // 이후 6시간마다 자동 갱신
  collectionTimer = setInterval(() => {
    runCollection().catch(console.error);
  }, 6 * 60 * 60 * 1000);

  console.log("[AutoCollector] 자동 수집기 등록됨 (6시간 주기)");
}

export async function triggerManualCollection(): Promise<{ ok: boolean; message: string }> {
  if (isRunning) return { ok: false, message: "이미 수집 중입니다." };
  runCollection().catch(console.error);
  return { ok: true, message: "수집을 시작했습니다." };
}
