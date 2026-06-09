/**
 * 입시 정보 자동화 백그라운드 워커
 * - 서버 시작 시 DB 초기화 및 첫 수집 실행
 * - 이후 REFRESH_INTERVAL_MS 마다 자동 갱신
 * - 각 카테고리를 Cerebras AI로 분석·정리 후 PostgreSQL 저장
 */

import { initDb, upsertAdmissionsInfo, getLastFetchedAt } from "./db.server";

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6시간

type BatchDef = {
  id: string;
  targetGrade: "고2이하" | "고3n수" | "공통";
  infoType: string;
  prompt: string;
};

const BATCHES: BatchDef[] = [
  {
    id: "top-universities",
    targetGrade: "고3n수",
    infoType: "모집요강",
    prompt: `아래 각 대학의 2025~2026학년도 입시 정보를 각각 1개 항목씩 JSON 배열로 정리:
1. 서울대학교 (수시 학종/지역균형, 정시 나군, 모집인원, 최저 수능)
2. 연세대학교 (학종/논술/교과, 정시 가군, 수능최저)
3. 고려대학교 (학종/논술/교과, 정시 나군, 수능최저)
4. KAIST/POSTECH (학종 위주, 수능무관, 과학올림피아드)
5. 서강대/성균관대/한양대 (수시/정시 주요전형, 수능최저)
각 항목 key는 대학명 영문으로.`,
  },
  {
    id: "medical-schools",
    targetGrade: "고3n수",
    infoType: "의대약대",
    prompt: `아래 각 분야의 2025~2026학년도 입시 정보를 각각 1개 항목씩 JSON 배열로 정리:
1. 의과대학 수시 전형 (학종/교과, 서울주요의대 수능최저)
2. 의과대학 정시 전형 (주요의대 수능 합격선, N수 비율)
3. 약학대학 입시 (PEET 폐지 이후 약대 직접지원 현황, 학점인정)
4. 한의과대학/치의학대학원 입시 정보
각 항목 key는 분야명 영문으로.`,
  },
  {
    id: "suneung-nsu",
    targetGrade: "공통",
    infoType: "수능",
    prompt: `아래 각 주제의 입시 정보를 각각 1개 항목씩 JSON 배열로 정리:
1. 2025학년도 수능 국어/수학/영어 난이도 및 1등급 컷
2. 2026학년도 수능 출제 예상 및 변화 (EBS 연계율, 킬러문항)
3. N수생(재수/삼수) 정시 전략 및 주요대 N수 합격 비율
4. 탐구과목 선택 전략 (이과: 물화생지, 문과: 사탐)
각 항목 key는 주제명 영문으로.`,
  },
  {
    id: "new-policy-고2이하",
    targetGrade: "고2이하",
    infoType: "정책변경",
    prompt: `아래 각 주제의 입시 정보를 각각 1개 항목씩 JSON 배열로 정리:
1. 2022 개정 교육과정 5등급제 내신 (A~E등급, 대입 반영 방식 변화)
2. 고교학점제 전면시행 이후 선택과목 이수 및 대입 전략
3. 과학고/영재학교/자사고 고입 전형 및 대입 연계 전략
4. 교육부 2025~2026 대입 정책 변화 (수시 6회 제한, 학생부 변화)
각 항목 key는 주제명 영문으로.`,
  },
];

type AiInfoItem = {
  key: string;
  title: string;
  summary: string;
  bullets: string[];
  universities: string[];
  importance: number;
};

function parseInfoArray(raw: string): AiInfoItem[] {
  try {
    // 마크다운 코드 블록 제거
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").trim();

    const s = cleaned.indexOf("[");
    const e = cleaned.lastIndexOf("]");
    if (s === -1 || e === -1) {
      console.warn("[AdmissionsWorker] JSON 배열 없음 — 원본:", cleaned.slice(0, 300));
      return [];
    }
    const parsed = JSON.parse(cleaned.slice(s, e + 1));
    return Array.isArray(parsed) ? (parsed as AiInfoItem[]) : [];
  } catch (err) {
    console.warn("[AdmissionsWorker] JSON 파싱 실패:", err, "— 원본:", raw.slice(0, 300));
    return [];
  }
}

async function runBatch(batch: BatchDef): Promise<void> {
  const { cerebrasChat } = await import("./cerebras.server");

  const SYSTEM = `한국 대입 입시 전문가. 아래 주제를 분석해 JSON 배열로만 출력. 다른 텍스트 없음.
형식: [{"key":"고유키","title":"제목","summary":"2-3문장 핵심 요약","bullets":["핵심포인트1","핵심포인트2","핵심포인트3","핵심포인트4","핵심포인트5"],"universities":["해당대학명들"],"importance":5}]
key: 영문+숫자 고유 식별자, importance: 1-5 (5=매우중요), universities: 해당 없으면 []
정확한 수치(합격선, 모집인원 등) 반드시 포함. 최소 3~5개 항목 생성.`;

  const raw = await cerebrasChat({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: batch.prompt },
    ],
    temperature: 0.2,
    max_tokens: 2000,
  });

  const items = parseInfoArray(raw);
  if (!items.length) {
    console.warn(`[AdmissionsWorker] 배치 ${batch.id} 빈 결과`);
    return;
  }

  await upsertAdmissionsInfo(
    items.map((item) => ({
      topic_key: `${batch.id}::${item.key}`,
      title: item.title,
      summary: item.summary,
      bullets: Array.isArray(item.bullets) ? item.bullets : [],
      target_grade: batch.targetGrade,
      universities: Array.isArray(item.universities) ? item.universities : [],
      info_type: batch.infoType,
      importance: Number(item.importance) || 3,
    }))
  );
  console.log(`[AdmissionsWorker] ✓ ${batch.id} — ${items.length}개 저장`);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runAllBatches(): Promise<void> {
  console.log("[AdmissionsWorker] 입시 정보 수집 시작…");
  for (let i = 0; i < BATCHES.length; i++) {
    try {
      await runBatch(BATCHES[i]);
    } catch (err) {
      console.error(`[AdmissionsWorker] 배치 ${BATCHES[i].id} 실패:`, err);
    }
    // rate limit 방지: 배치 사이 8초 대기
    if (i < BATCHES.length - 1) await delay(8000);
  }
  console.log("[AdmissionsWorker] 입시 정보 수집 완료");
}

let workerTimer: ReturnType<typeof setInterval> | null = null;

export async function startAdmissionsWorker(): Promise<void> {
  if (workerTimer) return; // 이미 실행 중

  try {
    await initDb();

    // 마지막 수집 시간 확인
    const lastFetched = await getLastFetchedAt();
    const now = Date.now();
    const ageMs = lastFetched ? now - new Date(lastFetched).getTime() : Infinity;

    if (ageMs > REFRESH_INTERVAL_MS) {
      // 즉시 첫 수집 (비동기 — 서버 시작 블록 안 함)
      runAllBatches().catch(console.error);
    } else {
      const remainingMs = REFRESH_INTERVAL_MS - ageMs;
      console.log(`[AdmissionsWorker] 데이터 최신 상태 — ${Math.round(remainingMs / 60000)}분 후 갱신 예정`);
    }

    // 주기적 갱신 예약
    workerTimer = setInterval(() => {
      runAllBatches().catch(console.error);
    }, REFRESH_INTERVAL_MS);

    console.log("[AdmissionsWorker] 워커 시작됨 (6시간 주기 자동 갱신)");
  } catch (err) {
    console.error("[AdmissionsWorker] 초기화 실패:", err);
  }
}

export async function triggerManualRefresh(): Promise<void> {
  await runAllBatches();
}
