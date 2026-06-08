import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const ProfileSchema = z
  .object({
    name: z.string().optional(),
    grade: z.string().optional(),
    region: z.string().optional(),
    internalGrade: z.string().optional(),
    mockGrade: z.string().optional(),
    interests: z.array(z.string()).optional(),
    targetUniversity: z.string().optional(),
    targetMajor: z.string().optional(),
    trackType: z.string().optional(),
    notes: z.string().optional(),
  })
  .partial();

function profileBlock(p?: z.infer<typeof ProfileSchema>): string {
  if (!p) return "(학생 프로필 정보 없음)";
  const lines = [
    p.name && `이름: ${p.name}`,
    p.grade && `학년: ${p.grade}${p.trackType ? ` (${p.trackType})` : ""}`,
    p.region && `지역: ${p.region}`,
    p.internalGrade && `내신 평균: ${p.internalGrade}등급`,
    p.mockGrade && `모의고사 평균: ${p.mockGrade}등급`,
    p.interests?.length && `관심 분야: ${p.interests.join(", ")}`,
    (p.targetUniversity || p.targetMajor) &&
      `목표: ${p.targetUniversity ?? ""} ${p.targetMajor ?? ""}`.trim(),
    p.notes && `메모: ${p.notes}`,
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : "(학생 프로필 정보 없음)";
}

// ============ AI Coach Chat ============
export const aiCoachChat = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      messages: z.array(MessageSchema).min(1),
      profile: ProfileSchema.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { cerebrasChat } = await import("./cerebras.server");
    const system = `너는 NAVI의 AI 진로 코치다. 한국 입시(고교학점제, 수시 학생부종합/교과/논술, 정시, 생활기록부 세부능력특기사항)에 정통하다.
대치동 컨설팅 수준의 전략을 친근하고 명확하게 제공한다. 항상 한국어로 답하고, 구조화된 답변(번호/굵은 항목/실행 액션)을 사용한다.
모르는 정보는 단정하지 말고 추가로 어떤 정보가 필요한지 묻는다. 학생을 격려하되 현실적인 조언을 한다.

[학생 프로필]
${profileBlock(data.profile)}`;

    const reply = await cerebrasChat({
      messages: [{ role: "system", content: system }, ...data.messages],
      temperature: 0.5,
      max_tokens: 1200,
    });
    return { reply };
  });

// ============ 생기부 AI 빌더 ============
export const buildSaengbu = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      profile: ProfileSchema.optional(),
      subject: z.string().min(1, "과목/단원 입력"),
      activity: z.string().min(1, "활동 내용 입력"),
      targetMajor: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { cerebrasChat } = await import("./cerebras.server");
    const major = data.targetMajor || data.profile?.targetMajor || "지망 학과";

    const system = `너는 한국 고교 생활기록부(생기부) 세부능력특기사항(세특) 작성 전문가다.
대치동 입시컨설팅 수준의 세특 문구를 작성한다. 다음 규칙을 엄수한다:
1) 학생 주체적 행동/탐구/사고과정이 드러나야 한다.
2) 목표 학과 합격 키워드를 자연스럽게 녹인다.
3) 한 문장은 너무 길지 않게, 평가자가 한눈에 읽히게 구조화한다.
4) 과장/허위 금지. 활동 내용 기반으로만 작성한다.
5) 출력은 반드시 한국어.

다음 3가지를 출력한다:
[1] 추천 세특 문구 (500~700자)
[2] 평가 포인트 (왜 이 문구가 ${major}에 유리한지 3가지)
[3] 후속 탐구 아이디어 (다음 학기 연계 활동 3개)`;

    const user = `[학생 프로필]\n${profileBlock(data.profile)}\n\n[과목/단원] ${data.subject}\n[활동 내용]\n${data.activity}\n\n[목표 학과] ${major}\n\n위 정보로 세특을 작성해줘.`;

    const reply = await cerebrasChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.6,
      max_tokens: 1800,
    });
    return { reply };
  });

// ============ 전형 분석 / 로드맵 ============
export const analyzeJeonhyeong = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      profile: ProfileSchema.optional(),
      question: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { cerebrasChat } = await import("./cerebras.server");
    const system = `너는 한국 대입 전형 분석 전문가다. 학생 프로필을 보고 다음을 한국어로 출력한다:

[1] 현 상황 진단 (3줄)
[2] 수시 전략 — 학생부종합/교과/논술 각각의 적합도(★ 1~5) + 한 줄 사유
[3] 정시 전략 — 현재 모의고사 기준 지원 가능권/적정/도전 대학 예시 (대학명 4~6개)
[4] 추천 지원 조합 (수시 6장 가상 예시 + 정시 비중)
[5] 다음 30일 액션 플랜 (5개 항목, 체크리스트 형식)

근거 없는 단정은 피하고, 일반적인 입시 데이터/전형 기조 기반으로 작성. 정확한 합격선은 매년 변동 가능성을 명시.`;

    const user = `[학생 프로필]\n${profileBlock(data.profile)}\n\n[학생 질문]\n${data.question ?? "내 상황에 맞는 전형 분석과 로드맵을 짜줘."}`;

    const reply = await cerebrasChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 2000,
    });
    return { reply };
  });

// ============ 월별 학습 로드맵 ============
export const generateRoadmap = createServerFn({ method: "POST" })
  .inputValidator(z.object({ profile: ProfileSchema.optional() }))
  .handler(async ({ data }) => {
    const { cerebrasChat } = await import("./cerebras.server");
    const system = `너는 한국 입시 학습 코치다. 학생 프로필 기반으로 향후 3개월 월별 실행 로드맵을 만든다.
출력 형식 (반드시 JSON):
{
  "months": [
    {
      "title": "1개월차: ...",
      "focus": "이번 달 핵심 목표 한 줄",
      "tasks": ["과제1", "과제2", "과제3", "과제4"]
    }
  ]
}
JSON 외 어떤 텍스트도 출력하지 마라.`;

    const user = `[학생 프로필]\n${profileBlock(data.profile)}`;
    const reply = await cerebrasChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    // try to parse
    try {
      const start = reply.indexOf("{");
      const end = reply.lastIndexOf("}");
      const parsed = JSON.parse(reply.slice(start, end + 1)) as {
        months: Array<{ title: string; focus: string; tasks: string[] }>;
      };
      return { months: parsed.months };
    } catch {
      return { months: [] as Array<{ title: string; focus: string; tasks: string[] }> };
    }
  });
