import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function normalizeAiError(error: unknown): never {
  const message = error instanceof Error ? error.message : "AI 요청 처리 중 오류가 발생했습니다.";
  throw new Error(message);
}

// 모든 AI 응답에 강제할 마크다운/HTML 서식 규칙
const FORMAT_RULES = `[출력 서식 규칙 — 반드시 준수]
응답은 반드시 GitHub-Flavored Markdown + 일부 HTML 으로 작성한다. 클라이언트가 자동 렌더링하므로 마크다운 기호를 그대로 출력해야 한다.
- 큰 제목: # 제목  /  중제목: ## 제목  /  소제목: ### 제목
- 볼드: **굵게**  /  이탤릭(기울임): *기울임*  /  취소선: ~~취소~~
- 밑줄: <u>밑줄</u>  /  색 강조: <span style="color:#22d3ee">중요</span> (HEX 사용)
- 인용/팁 박스: > 인용 내용 (여러 줄 가능)
- 리스트: - 항목  또는  1. 항목,  체크리스트: - [ ] 할 일 / - [x] 완료
- 표: | 헤더1 | 헤더2 |\n|---|---|\n| 값1 | 값2 |  형식 (정렬 가능한 데이터는 반드시 표로)
- 코드: \`inline\`  또는  \`\`\`언어\n블록\n\`\`\`
- 별표 강조 항목: ⭐, ⭐⭐, ⭐⭐⭐ 처럼 이모지 별로 시각화
- 구분선: --- 한 줄
- 텍스트 크기는 헤딩 레벨(#,##,###,####)로 조절. 핵심은 헤딩 + 볼드 + 색으로 강조.
- HTML 은 <u>, <span style="color:...">, <br/> 만 허용. 그 외 태그/스크립트 금지.`;

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
    try {
      const { cerebrasChat } = await import("./cerebras.server");
      const system = `너는 NAVI의 AI 진로 코치다. 한국 입시(고교학점제, 수시 학생부종합/교과/논술, 정시, 생활기록부 세부능력특기사항)에 정통하다.
대치동 컨설팅 수준의 전략을 친근하고 명확하게 제공한다. 항상 한국어로 답하고, 구조화된 답변(번호/굵은 항목/실행 액션)을 사용한다.
모르는 정보는 단정하지 말고 추가로 어떤 정보가 필요한지 묻는다. 학생을 격려하되 현실적인 조언을 한다.

${FORMAT_RULES}

[학생 프로필]
${profileBlock(data.profile)}`;

      const reply = await cerebrasChat({
        messages: [{ role: "system", content: system }, ...data.messages],
        temperature: 0.5,
        max_tokens: 1200,
      });
      return { reply };
    } catch (error) {
      normalizeAiError(error);
    }
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
    try {
      const { cerebrasChat } = await import("./cerebras.server");
      const major = data.targetMajor || data.profile?.targetMajor || "지망 학과";

      const system = `너는 한국 고교 생활기록부(생기부) 세부능력특기사항(세특) 작성 전문가다.
대치동 입시컨설팅 수준의 세특 문구를 작성한다. 다음 규칙을 엄수한다:
1) 학생 주체적 행동/탐구/사고과정이 드러나야 한다.
2) 목표 학과 합격 키워드를 자연스럽게 녹인다.
3) 한 문장은 너무 길지 않게, 평가자가 한눈에 읽히게 구조화한다.
4) 과장/허위 금지. 활동 내용 기반으로만 작성한다.
5) 출력은 반드시 한국어.

${FORMAT_RULES}

출력 구조 (반드시 이 마크다운 구조 사용):
## ✍️ 추천 세특 문구
> (500~700자, 한 단락 또는 두 단락. 핵심 키워드는 **볼드**, 학과 연결 키워드는 <span style="color:#22d3ee">색 강조</span>)

## 🎯 평가 포인트 — ${major}
| # | 포인트 | 왜 유리한가 |
|---|---|---|
| 1 | ... | ... |
| 2 | ... | ... |
| 3 | ... | ... |

## 🚀 후속 탐구 아이디어
- [ ] 아이디어 1 — 한 줄 설명
- [ ] 아이디어 2 — 한 줄 설명
- [ ] 아이디어 3 — 한 줄 설명`;

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
    } catch (error) {
      normalizeAiError(error);
    }
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
    try {
      const { cerebrasChat } = await import("./cerebras.server");
      const system = `너는 한국 대입 전형 분석 전문가다. 학생 프로필을 보고 한국어로 분석한다.

${FORMAT_RULES}

출력 구조 (반드시 이 마크다운 구조 사용):
## 📊 현 상황 진단
> 3줄 요약. 핵심 수치는 **볼드**.

## 🎯 수시 전략
| 전형 | 적합도 | 사유 |
|---|---|---|
| 학생부종합 | ⭐⭐⭐⭐ | ... |
| 학생부교과 | ⭐⭐⭐ | ... |
| 논술 | ⭐⭐ | ... |

## 🏛️ 정시 전략
- **지원 가능권**: 대학명 2~3개
- **적정**: 대학명 2~3개
- **도전**: 대학명 2~3개

## 🧩 추천 지원 조합 (수시 6장 + 정시 비중)
| 카드 | 대학·학과 | 전형 | 비고 |
|---|---|---|---|
| 1 | ... | ... | ... |

정시 비중: **OO%** 권장.

## ✅ 다음 30일 액션 플랜
- [ ] 항목 1
- [ ] 항목 2
- [ ] 항목 3
- [ ] 항목 4
- [ ] 항목 5

---
*정확한 합격선은 매년 변동 가능성이 있음.*`;

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
    } catch (error) {
      normalizeAiError(error);
    }
  });

// ============ 월별 학습 로드맵 ============
export const generateRoadmap = createServerFn({ method: "POST" })
  .inputValidator(z.object({ profile: ProfileSchema.optional() }))
  .handler(async ({ data }) => {
    try {
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
    } catch (error) {
      normalizeAiError(error);
    }
  });
