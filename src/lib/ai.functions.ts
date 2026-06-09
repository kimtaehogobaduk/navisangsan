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

const SubjectGradeSchema = z.object({
  grade: z.string().optional(),
  percentile: z.string().optional(),
});

const MockSubjectGradesSchema = z.object({
  korean: SubjectGradeSchema.optional(),
  math: SubjectGradeSchema.optional(),
  english: SubjectGradeSchema.optional(),
  society: SubjectGradeSchema.optional(),
  science: SubjectGradeSchema.optional(),
  history: SubjectGradeSchema.optional(),
});

const InternalYearRecordSchema = z.object({
  year: z.string(),
  korean: z.string().optional(),
  math: z.string().optional(),
  english: z.string().optional(),
  society: z.string().optional(),
  science: z.string().optional(),
  history: z.string().optional(),
  electives: z.array(z.object({ subject: z.string(), grade: z.string() })).optional(),
});

const ProfileSchema = z
  .object({
    name: z.string().optional(),
    grade: z.string().optional(),
    school: z.string().optional(),
    region: z.string().optional(),
    mockGrades: MockSubjectGradesSchema.optional(),
    internalYears: z.array(InternalYearRecordSchema).optional(),
    electiveSubjects: z.array(z.object({ subject: z.string(), grade: z.string().optional() })).optional(),
    interests: z.array(z.string()).optional(),
    customInterest: z.string().optional(),
    targetUniversity: z.string().optional(),
    targetMajor: z.string().optional(),
    trackType: z.string().optional(),
    notes: z.string().optional(),
    internalGrade: z.string().optional(),
    mockGrade: z.string().optional(),
  })
  .partial();

const MOCK_LABELS: Record<string, string> = {
  korean: "국어", math: "수학", english: "영어",
  society: "사회", science: "과학", history: "한국사",
};

function profileBlock(p?: z.infer<typeof ProfileSchema>): string {
  if (!p) return "(학생 프로필 정보 없음)";
  const lines: string[] = [];

  if (p.name) lines.push(`이름: ${p.name}`);
  if (p.grade) lines.push(`학년: ${p.grade}${p.trackType ? ` (${p.trackType})` : ""}`);
  if (p.school) lines.push(`학교: ${p.school}`);
  else if (p.region) lines.push(`지역: ${p.region}`);

  if (p.mockGrades) {
    const mockLines: string[] = [];
    const strong: string[] = [];
    const mid: string[] = [];
    const weak: string[] = [];
    for (const [key, label] of Object.entries(MOCK_LABELS)) {
      const sg = p.mockGrades[key as keyof typeof p.mockGrades];
      if (sg?.grade) {
        const g = parseInt(sg.grade);
        const pct = sg.percentile ? `(백분위 ${sg.percentile}%)` : "";
        mockLines.push(`${label} ${sg.grade}등급${pct}`);
        if (g <= 2) strong.push(`${label}(${sg.grade})`);
        else if (g <= 4) mid.push(`${label}(${sg.grade})`);
        else weak.push(`${label}(${sg.grade})`);
      }
    }
    if (mockLines.length) {
      lines.push(`\n[모의고사 성적]\n${mockLines.join(" | ")}`);
      const analysis: string[] = [];
      if (strong.length) analysis.push(`■ 강점(1~2등급): ${strong.join(", ")}`);
      if (mid.length) analysis.push(`■ 보완 가능(3~4등급): ${mid.join(", ")}`);
      if (weak.length) analysis.push(`■ 집중 관리(5등급~): ${weak.join(", ")}`);
      if (analysis.length) {
        lines.push(`[과목별 강점/약점 분석]\n${analysis.join("\n")}`);
        const track = p.trackType;
        if (track === "이과" && weak.some(w => w.startsWith("수학") || w.startsWith("과학")))
          lines.push("→ 이과 지망이나 수학/과학 집중 보완이 시급함");
        else if (track === "문과" && weak.some(w => w.startsWith("국어") || w.startsWith("사회")))
          lines.push("→ 문과 지망이나 국어/사회 집중 보완이 시급함");
      }
    }
  } else if (p.mockGrade) {
    lines.push(`모의고사 평균: ${p.mockGrade}등급`);
  }

  if (p.internalYears?.length) {
    lines.push("\n[내신 성적]");
    for (const yr of p.internalYears) {
      const subs = [
        yr.korean && `국어 ${yr.korean}`,
        yr.math && `수학 ${yr.math}`,
        yr.english && `영어 ${yr.english}`,
        yr.society && `사회 ${yr.society}`,
        yr.science && `과학 ${yr.science}`,
        yr.history && `한국사 ${yr.history}`,
      ].filter(Boolean);
      const elStr = yr.electives?.map(e => `${e.subject} ${e.grade}`).join(", ");
      lines.push(`${yr.year}: ${subs.join(" / ")}${elStr ? ` | 선택: ${elStr}` : ""}`);
    }
  } else if (p.internalGrade) {
    lines.push(`내신 평균: ${p.internalGrade}등급`);
  }

  if (p.electiveSubjects?.length) {
    const elStr = p.electiveSubjects.map(e => e.grade ? `${e.subject}(${e.grade}등급)` : e.subject).join(", ");
    lines.push(`\n선택과목: ${elStr}`);
  }

  const allInterests = [...(p.interests ?? []), ...(p.customInterest ? [p.customInterest] : [])];
  if (allInterests.length) lines.push(`관심 분야: ${allInterests.join(", ")}`);
  if (p.targetUniversity || p.targetMajor)
    lines.push(`목표: ${p.targetUniversity ?? ""} ${p.targetMajor ?? ""}`.trim());
  if (p.notes) lines.push(`메모: ${p.notes}`);

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

// ============ 월별 학습 로드맵 (공부 전략 + 생기부 전략 분리 호출) ============
export const generateRoadmap = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      profile: ProfileSchema.optional(),
      trainingContext: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { cerebrasChat } = await import("./cerebras.server");
      const training = data.trainingContext ? `\n[추가 지식]\n${data.trainingContext}` : "";
      const profileStr = profileBlock(data.profile);

      type AiTask = {
        title: string;
        detail: string;
        category: string;
        week: number;
        priority: string;
        hours: number;
        tips: string[];
      };

      // JSON 배열만 파싱하는 헬퍼
      function parseTaskArray(raw: string, monthIdx: number, prefix: string): import("./roadmap").RoadmapTask[] {
        try {
          const s = raw.indexOf("[");
          const e = raw.lastIndexOf("]");
          if (s === -1 || e === -1) return [];
          const arr = JSON.parse(raw.slice(s, e + 1)) as AiTask[];
          return arr.map((t, i) => ({
            id: `m${monthIdx}-${prefix}-t${i}`,
            title: String(t.title ?? ""),
            detail: String(t.detail ?? ""),
            category: (["academics","exam","records","essay","activity","mental"].includes(t.category)
              ? t.category : "academics") as import("./roadmap").RoadmapTask["category"],
            week: Number(t.week) >= 1 && Number(t.week) <= 4 ? Number(t.week) : 1,
            priority: (["high","medium","low"].includes(t.priority)
              ? t.priority : "medium") as import("./roadmap").RoadmapTask["priority"],
            estimatedHours: Number(t.hours) || 2,
            tips: Array.isArray(t.tips) ? t.tips.map(String) : [],
          }));
        } catch {
          return [];
        }
      }

      // 시스템 프롬프트 — 매우 짧고 명확하게
      const SYSTEM = `입시 코치. JSON 배열만 출력. 다른 텍스트 금지.
형식: [{"title":"제목","detail":"구체적 방법 2문장","category":"academics","week":1,"priority":"high","hours":2,"tips":["팁1","팁2"]}]
category 값: academics(내신)/exam(수능)/records(생기부세특)/essay(자소서면접)/activity(과외활동)/mental(멘탈건강)
priority: high/medium/low, week: 1~4, hours: 숫자${training}`;

      const MONTH_META = [
        { idx: 0, label: "1개월차", theme: "#6366f1",
          studyFocus: "기초 점검 — 내신·수능 취약단원 진단 및 학습 전략 수립",
          recordFocus: "생기부 방향 설계 — 세특 주제 선정 및 첫 탐구 시작" },
        { idx: 1, label: "2개월차", theme: "#8b5cf6",
          studyFocus: "본격 실행 — 내신 심화 + 수능 기출 집중 풀이",
          recordFocus: "생기부 구체화 — 세특 초안 작성 및 활동 실행" },
        { idx: 2, label: "3개월차", theme: "#06b6d4",
          studyFocus: "마무리 점검 — 모의고사 분석 + 부족 단원 반복",
          recordFocus: "생기부 완성 — 자소서 준비 및 활동 마무리 정리" },
      ];

      const months: import("./roadmap").RoadmapMonth[] = [];
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

      // 6개 호출 완전 순차 처리 + 호출 사이 1초 딜레이 — rate limit 방지
      for (let mi = 0; mi < MONTH_META.length; mi++) {
        const meta = MONTH_META[mi];
        const studyUser = `학생: ${profileStr}\n\n[${meta.label} 공부 전략: ${meta.studyFocus}]\n내신(academics), 수능(exam), 멘탈(mental) 과제 각 주 2개씩 총 8개를 JSON 배열로 출력.`;
        const recordUser = `학생: ${profileStr}\n\n[${meta.label} 생기부 전략: ${meta.recordFocus}]\n생기부세특(records), 자소서(essay), 과외활동(activity) 과제 각 주 2개씩 총 8개를 JSON 배열로 출력.`;

        if (mi > 0) await delay(1200); // 앞 달 처리 후 대기
        const studyReply = await cerebrasChat({
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: studyUser }],
          temperature: 0.3, max_tokens: 900,
        });
        await delay(1200); // 공부 → 생기부 사이 대기
        const recordReply = await cerebrasChat({
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: recordUser }],
          temperature: 0.3, max_tokens: 900,
        });

        const studyTasks = parseTaskArray(studyReply, meta.idx, "study");
        const recordTasks = parseTaskArray(recordReply, meta.idx, "record");
        const allTasks = [...studyTasks, ...recordTasks];

        if (!allTasks.length) continue;

        months.push({
          title: `${meta.label}: ${meta.studyFocus.split("—")[0].trim()}`,
          focus: meta.studyFocus.split("—")[1]?.trim() ?? meta.studyFocus,
          studyFocus: meta.studyFocus,
          recordFocus: meta.recordFocus,
          theme: meta.theme,
          milestones: [
            meta.studyFocus.split("—")[1]?.trim() ?? "학습 계획 수립",
            meta.recordFocus.split("—")[1]?.trim() ?? "생기부 전략 수립",
            "다음 달 준비 완료",
          ],
          tasks: allTasks,
        });
      }

      if (!months.length) throw new Error("로드맵 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return { months };
    } catch (error) {
      normalizeAiError(error);
    }
  });

// ============ 고교학점제 선택과목 추천 ============
export const recommendSubjects = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      profile: ProfileSchema.optional(),
      currentSubjects: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { cerebrasChat } = await import("./cerebras.server");
      const system = `너는 한국 고교학점제 선택과목 전략 전문가다. 학생 프로필과 목표 학과를 바탕으로 최적의 선택과목 조합을 추천한다.

${FORMAT_RULES}

출력 구조 (반드시 이 마크다운 구조 사용):

## 📚 선택과목 추천 전략
> 1~2줄 핵심 전략 요약. **목표 학과명**과 **계열**을 명시.

## ✅ 추천 선택과목 조합
| 구분 | 과목명 | 이수 이유 | 우선도 |
|---|---|---|---|
| 일반선택 | ... | ... | ⭐⭐⭐ |
| 진로선택 | ... | ... | ⭐⭐⭐ |
| 융합선택 | ... | ... | ⭐⭐ |

## 🚫 피해야 할 과목 조합
- **과목명**: 이유 (목표 학과 불이익)

## 🏛️ 대학별 선호 과목
| 대학 계열 | 핵심 이수 과목 | 미이수 시 불이익 |
|---|---|---|
| ... | ... | ... |

## 💡 세특 연계 전략
> 선택과목에서 **생기부 세특**을 어떻게 연결할지 3가지 팁.
- 팁 1
- 팁 2
- 팁 3

---
*고교학점제 적용 학년도에 따라 이수 가능 과목이 다를 수 있음.*`;

      const user = `[학생 프로필]\n${profileBlock(data.profile)}\n\n[현재 수강 중인 과목]\n${data.currentSubjects || "미입력"}\n\n위 학생에게 최적의 고교학점제 선택과목 조합을 추천해줘.`;

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

// ============ 커리큘럼 허브 (강의 + 도서 + 공모전) ============
export const generateCurriculum = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      profile: ProfileSchema.optional(),
      tab: z.enum(["lecture", "book", "contest"]),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { cerebrasChat } = await import("./cerebras.server");

      const tabPrompts: Record<string, string> = {
        lecture: `너는 EBS 강의 큐레이터다. 학생 프로필에 맞는 EBS 강의를 추천한다.

${FORMAT_RULES}

출력 구조:
## 🎬 EBS 추천 강의 목록

### 📌 우선 수강 (이번 달)
| 강의명 | 과목 | 강사 | 추천 이유 |
|---|---|---|---|
| ... | ... | ... | ... |

### 📖 병행 수강 (다음 달)
| 강의명 | 과목 | 강사 | 추천 이유 |
|---|---|---|---|
| ... | ... | ... | ... |

## 💡 학습 전략
> EBS 강의를 **생기부 세특**에 어떻게 연결할지 2~3가지 구체적 방법.
- 방법 1
- 방법 2
- 방법 3`,

        book: `너는 청소년 독서 큐레이터다. 학생 프로필·관심 분야·목표 학과에 맞는 책을 추천한다.

${FORMAT_RULES}

출력 구조:
## 📚 맞춤 추천 도서

### 🔥 필독 (목표 학과 직결)
| 도서명 | 저자 | 핵심 내용 | 세특 활용 포인트 |
|---|---|---|---|
| ... | ... | ... | ... |

### 🌱 교양 확장 (배경지식)
| 도서명 | 저자 | 핵심 내용 | 세특 활용 포인트 |
|---|---|---|---|
| ... | ... | ... | ... |

## 📝 독서록 세특 연결 전략
> 독서 활동을 **생기부**에 녹이는 3가지 방법.
- 방법 1
- 방법 2
- 방법 3`,

        contest: `너는 공모전 전략 전문가다. 학생 프로필에 맞는 공모전을 추천하고, 각 공모전을 생기부 어느 항목에 활용할 수 있는지 전략을 제시한다.

${FORMAT_RULES}

출력 구조:
## 🏆 맞춤 공모전 전략

### ⭐ 즉시 도전 가능 (난이도 하~중)
| 공모전명 | 주최 | 대상 | 마감 시기 | 생기부 활용 항목 |
|---|---|---|---|---|
| ... | ... | ... | ... | 세특/자율활동/진로활동 |

### 🚀 목표 도전 (난이도 중~상)
| 공모전명 | 주최 | 대상 | 마감 시기 | 생기부 활용 항목 |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

## 🎯 공모전 → 생기부 활용 가이드
> 공모전 수상·참가 경험을 **생기부 각 항목**에 어떻게 녹일지 구체적 전략.

| 공모전 결과 | 생기부 항목 | 기재 전략 |
|---|---|---|
| 수상 | 수상경력 | ... |
| 참가 | 세특 | ... |
| 탐구 연계 | 진로활동 | ... |

## ⚡ 즉시 실행 체크리스트
- [ ] 항목 1
- [ ] 항목 2
- [ ] 항목 3`,
      };

      const user = `[학생 프로필]\n${profileBlock(data.profile)}\n\n위 학생에게 맞는 내용을 추천해줘.`;

      const reply = await cerebrasChat({
        messages: [
          { role: "system", content: tabPrompts[data.tab] },
          { role: "user", content: user },
        ],
        temperature: 0.5,
        max_tokens: 2000,
      });
      return { reply };
    } catch (error) {
      normalizeAiError(error);
    }
  });

// ============ 자소서 AI 피드백 ============
export const reviewJasoseo = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      profile: ProfileSchema.optional(),
      question: z.string().min(1, "자소서 문항 입력"),
      essay: z.string().min(1, "자소서 내용 입력"),
      targetUniversity: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { cerebrasChat } = await import("./cerebras.server");
      const system = `너는 대입 자기소개서(자소서) 첨삭 전문가다. 대치동 최상위 컨설턴트 수준으로 첨삭한다.

${FORMAT_RULES}

출력 구조 (반드시 이 마크다운 구조 사용):

## 🔍 종합 평가
> 2~3줄 총평. **강점**과 **핵심 개선 포인트** 명시.

점수: <span style="color:#22d3ee">**OO점 / 100점**</span>

## ✅ 잘된 점 (Keep)
| # | 항목 | 근거 문장 |
|---|---|---|
| 1 | ... | "..." |
| 2 | ... | "..." |

## 🔧 개선 필요 (Fix)
| # | 문제 | 현재 문장 | 개선 방향 |
|---|---|---|---|
| 1 | ... | "..." | ... |
| 2 | ... | "..." | ... |

## ✍️ 핵심 문장 리라이팅
> 가장 중요한 개선이 필요한 문장 1~2개를 직접 다시 써줌.

**원문**: "..."
**개선**: "..."

## 🎯 합격 키워드 분석 — ${data.targetUniversity || data.profile?.targetUniversity || "목표 대학"}
- **포함된 키워드**: ...
- **추가해야 할 키워드**: <span style="color:#22d3ee">키워드1</span>, <span style="color:#22d3ee">키워드2</span>

## 📝 최종 체크리스트
- [ ] 글자 수 적정 (800~1500자 내외)
- [ ] 학생 주체성이 드러나는가
- [ ] 지원 동기가 구체적인가
- [ ] 목표 학과 연결 키워드 포함
- [ ] 과장·거짓 내용 없음`;

      const user = `[학생 프로필]\n${profileBlock(data.profile)}\n\n[지원 대학/학과]\n${data.targetUniversity || data.profile?.targetUniversity || "미입력"} ${data.profile?.targetMajor || ""}\n\n[자소서 문항]\n${data.question}\n\n[작성 내용]\n${data.essay}\n\n위 자소서를 첨삭해줘.`;

      const reply = await cerebrasChat({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        max_tokens: 2500,
      });
      return { reply };
    } catch (error) {
      normalizeAiError(error);
    }
  });

// ============ 면접 시뮬레이터 ============
export const interviewChat = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      messages: z.array(MessageSchema).min(1),
      profile: ProfileSchema.optional(),
      interviewType: z.enum(["general", "subject", "situational"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { cerebrasChat } = await import("./cerebras.server");
      const typeLabel = {
        general: "인성·일반 면접",
        subject: "전공 적성 면접",
        situational: "상황 제시형 면접",
      }[data.interviewType ?? "general"];

      const system = `너는 대학 입시 면접관이다. 학생을 상대로 실제 ${typeLabel} 면접을 진행한다.

[면접 진행 방식]
1. 첫 메시지에서는 면접 시작을 알리고 첫 번째 질문을 한다.
2. 학생이 답하면 답변에 대한 간략한 피드백(1~2줄)을 주고 다음 질문으로 넘어간다.
3. 질문은 학생 프로필·목표 학과에 맞게 심층적으로 구성한다.
4. 피드백은 면접관 시각으로 솔직하게: 잘한 점 + 보완점을 항상 같이 말한다.
5. 5~7개 질문 후 종합 피드백으로 마무리한다.

[답변 형식]
- 면접관 질문은 **볼드**로 강조
- 피드백은 > 인용 블록으로 표시
- 종합 피드백 시: 점수(OO/100), 강점 3가지, 개선점 3가지

항상 한국어로, 실제 면접처럼 진행한다.

[학생 프로필]
${profileBlock(data.profile)}`;

      const reply = await cerebrasChat({
        messages: [{ role: "system", content: system }, ...data.messages],
        temperature: 0.6,
        max_tokens: 1000,
      });
      return { reply };
    } catch (error) {
      normalizeAiError(error);
    }
  });

// ============ 학부모 주간 리포트 ============
export const generateParentReport = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      profile: ProfileSchema.optional(),
      progress: z.number().optional(),
      completedTasks: z.array(z.string()).optional(),
      pendingTasks: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { cerebrasChat } = await import("./cerebras.server");
      const system = `너는 학부모용 자녀 입시 현황 리포터다. 자녀의 입시 준비 상황을 학부모가 이해하기 쉽게 설명한다.

${FORMAT_RULES}

출력 구조 (반드시 이 마크다운 구조 사용):

## 📋 주간 입시 현황 리포트

### 👤 자녀 현황 요약
> 학년·목표·현재 상황을 **학부모 시각**에서 2~3줄 요약.

### 📈 이번 주 진행률
진행률: <span style="color:#22d3ee">**OO%**</span>

**완료한 항목** ✅
- ...

**남은 항목** ⏳
- ...

### 🎯 다음 주 우선 과제
| 우선순위 | 과제 | 예상 소요 시간 | 중요도 |
|---|---|---|---|
| 1 | ... | ... | ⭐⭐⭐ |
| 2 | ... | ... | ⭐⭐ |

### 💬 학부모님께 드리는 조언
> 이 시기 학부모님이 자녀에게 해줄 수 있는 **구체적 지원 방법** 3가지.
1. ...
2. ...
3. ...

### ⚠️ 주의사항
> 이번 달 놓치면 안 되는 입시 일정이나 체크포인트.

---
*본 리포트는 AI가 생성한 참고용 자료입니다.*`;

      const completedStr = data.completedTasks?.join(", ") || "없음";
      const pendingStr = data.pendingTasks?.join(", ") || "없음";
      const user = `[자녀 프로필]\n${profileBlock(data.profile)}\n\n[현재 진행률] ${data.progress ?? 0}%\n[완료 과제] ${completedStr}\n[미완료 과제] ${pendingStr}\n\n학부모님을 위한 주간 리포트를 작성해줘.`;

      const reply = await cerebrasChat({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        max_tokens: 1800,
      });
      return { reply };
    } catch (error) {
      normalizeAiError(error);
    }
  });
