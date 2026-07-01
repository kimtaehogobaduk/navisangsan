# NAVI 대규모 개선 계획 (11개 요구사항)

Cerebras API 키 7개 + Research 키 2개 추가 완료 (총 chat 10개, research 3개). 아래 순서로 진행합니다.

## 1. AI 자동 카테고라이징 (요구 1)

- `src/lib/training-jobs.functions.ts` 요약 프롬프트를 확장: `{title, content, category, tags[], relatedKeywords[]}` JSON을 요구.
- 카테고리 enum: `수시`, `정시`, `학종`, `교과`, `논술`, `학습법`, `과목별`, `대학정보`, `진로`, `기타`.
- 기존 `training_docs`를 재분류하는 서버 함수 `reclassifyAllDocs` 추가 → 관리자 패널에 "전체 재분류" 버튼.
- 관리자 패널의 수동 카테고리 선택 UI 제거, 표시만 유지.

## 2. 상시 백그라운드 실행 (요구 2)

- pg_cron으로 `/api/public/process-training`을 매 분 호출하도록 스케줄 등록 (지금은 유저 트리거 의존).
- 큐가 비었으면 자동 수집(auto-collector)도 트리거되게 5분 주기 cron 추가.

## 3. 파일탐색기 + 마인드맵 UI (요구 3)

- `src/routes/admin.tsx`에 새 탭 "자료 탐색기":
  - 좌측: 카테고리 트리(폴더 아이콘), 우측: 파일 리스트(제목/출처/태그).
  - 상단 토글로 "마인드맵" 뷰 전환 — 태그·relatedKeywords 공유 기준으로 노드 연결(간단한 SVG force graph, 기존 `MindMap.tsx` 재활용).

## 4. 진단·로드맵 클라우드 동기화 (요구 4)

- `user_data` 테이블에 이미 스키마 있음. `src/lib/cloud-sync.ts`를 확장:
  - `saveProfile/saveRoadmap/saveDiagnosis`가 로컬 + (로그인 시) `user_data` upsert.
  - 앱 부팅 시 로그인되어 있으면 서버 값과 로컬 병합(최근 updated_at 우선).
- `/dashboard`, `/roadmap`, `/onboarding` 진입 시 sync 훅 호출.

## 5. 선택과목 확장 (요구 5)

- `src/routes/onboarding.tsx`(또는 subjects.tsx)에서 선택과목 목록을 대폭 확장(2015/2022 개정 공통·일반·진로·융합 전과목).
- 각 과목군마다 "직접 입력" 필드 추가 → `electiveSubjects`에 병합.
- 새 과목군을 만들 수 있는 필드 추가

## 6. Cerebras 키 확장 (요구 6) ✅

- 완료: chat 10개, research 3개.

## 7. 학년별 자소서/탐구 분기 (요구 7)

- `/jasoseo` 라우트: 고3(2학기) 이외는 "탐구 주제 추천" 모드로 전환.
- 최신 기술 트렌드 + 진로 연계 탐구 추천을 위한 새 서버함수 `suggestResearch` (`groqWebSearch` 활용).

## 8. 현실적 입시 전략 (요구 8)

- `training_docs`에 "과목별 우선순위/난이도/전략" 시드 추가(한국사, 사탐, 과탐 등).
- `analyzeJeonhyeong`, 로드맵 생성 프롬프트에 "학년/과목별 상대 중요도" 가이드 삽입.

## 9. 환각 감소 (요구 9)

- EBS 등 강의/강사 추천 프롬프트에 "실제로 확인되지 않은 강사·강의명은 생성 금지, 대신 과목·유형만 안내" 강제.
- 모든 리서치 응답에 "출처 불명은 명시" 규칙 + 낮은 temperature(0.1~0.2).
- 학습자료 기반 RAG 필수: `training_docs`에서 관련 문서 top-k 검색해 컨텍스트로 주입.

## 10. AI 코칭 초기화 + 동기화 (요구 10)

- `/coach`에 "대화 초기화" 버튼.
- 대화 히스토리 로컬 저장 + `user_data` 키 `coach.history`로 클라우드 동기화.

## 11. 코드 정리 (요구 11)

- 사용 안 하는 파일 스캔(`.agents/memory/dead-files.md` 갱신).
- 중복 유틸 통합, 미사용 import 제거, TypeScript 에러 0 유지.
- 완료 후 재귀 리뷰 2회.

## 기술 세부사항

- 카테고리·태그 스키마 변경: `training_docs`에 `tags text[]`, `related_keywords text[]` 컬럼 추가 migration.
- `user_data` 활용 키: `profile`, `roadmap`, `diagnosis`, `coach.history`, `coach.settings`.
- pg_cron 등록: `training-tick` 매분, `auto-collect-tick` 5분마다.
- 프롬프트 온도: 요약 0.1, 리서치 0.4, 코칭 0.15.
- 재분류 배치는 50개씩 처리, 실패 시 재시도.

승인해 주시면 위 순서대로 한 번에 높은 퀄리티로 구현하겠습니다. 무슨 일이 있더라도 한번에 끝내겠습니다. 오류가 발생하지 않도록 하겠습니다. 