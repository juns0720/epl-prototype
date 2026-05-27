# AI 자동화 진행 보드

이 파일은 전체 작업 보드다. 모든 개발 세션은 여기서 시작한다.

## 사용 방법

1. `현재 커서`를 확인한다.
2. 현재 커서에 적힌 작업 하나만 진행한다.
3. 매핑된 `상세 문서`를 연다.
4. 매핑된 `주요 파일`을 읽는다.
5. 해당 작업을 구현한다.
6. 적힌 `완료 조건`을 확인한다.
7. 완료되면 이 파일의 체크박스를 `[x]`로 바꾼다.
8. `현재 커서`를 다음 미완료 작업으로 옮긴다.

기억으로 다음 작업을 고르지 않는다. 사용자가 우선순위를 바꾸지 않는 한 이 보드에서 가장 앞에 있는 미완료 작업부터 진행한다.

## 현재 커서

- 현재 단계: `P5 피드 발행`
- 현재 작업: `P5-T1`
- 상세 문서: `docs/plans/ai-automation/05-feed-publishing.md`
- 목표: `/api/feed`가 P1 briefing 필드를 사용해 발행된 글을 공급하는지 정렬한다.`

## 상태 표기

- `[ ]`: 대기
- `[~]`: 진행 중
- `[x]`: 완료
- `[!]`: 막힘

## 공통 기준 문서

제품 의도, AI 출력, 브리핑 문구를 건드리는 작업이면 아래 문서를 읽는다.

- `content.md`
- `REAX_기획서.md`
- `docs/ai-automation-guidelines.md`
- `docs/deployment-mvp.md`
- `docs/plans/ai-automation/07-p3-preflight-guide.md`

구현을 건드리는 작업이면 아래 파일 중 작업에 매핑된 파일을 읽는다.

- `api/_lib/ai.js`
- `api/_lib/feed.js`
- `api/collect.js`
- `api/feed.js`
- `api/admin/items.js`
- `api/admin/review.js`
- `supabase/schema.sql`
- `src/epl/AdminDashboard.jsx`
- `src/epl/usePublishedPosts.js`
- `src/epl/EPLFeed.jsx`
- `src/epl/DesktopLayout.jsx`

---

# 전체 체크리스트

## P0 마스터 로드맵

상세 문서: `docs/plans/ai-automation/00-master-roadmap.md`

| 상태 | 작업 | 주요 파일 | 완료 조건 |
|---|---|---|---|
| [x] | P0-T1 단계 로드맵 작성 | `00-master-roadmap.md` | 아키텍처, 단계 게이트, MVP 제외 범위가 문서화됨 |
| [x] | P0-T2 작업 보드 작성 | `99-progress.md` | 모든 단계의 작업이 이 파일에서 보임 |

## P1 콘텐츠 계약

상세 문서: `docs/plans/ai-automation/01-content-contract.md`

| 상태 | 작업 | 주요 파일 | 완료 조건 |
|---|---|---|---|
| [x] | P1-T1 `content.md` 규칙을 가이드에 병합 | `content.md`, `docs/ai-automation-guidelines.md` | 가이드에 한국어 전용, 원 트윗 사실만, 추가 금지 표현, 배경 추가 금지 규칙이 명시됨 |
| [x] | P1-T2 AI JSON 계약 수정 | `api/_lib/ai.js` | 구조화 출력에 `briefing.title`, `summary_short`, `summary_detail`, `tags`, `status`가 포함됨 |
| [x] | P1-T3 fallback classifier 출력 형태 수정 | `api/_lib/ai.js` | Upstage Solar 키가 없어도 같은 계약을 반환함 |
| [x] | P1-T4 자동 발행 정책 수정 | `api/_lib/ai.js` | publish 기준이 팀 확정, 정보성, 미디어 의존 여부, 감상 여부를 사용함 |
| [x] | P1-T5 feed/admin 매핑 수정 | `api/_lib/feed.js`, `src/epl/AdminDashboard.jsx` | feed/admin이 제목, 짧은 요약, 상세 요약, briefing status를 사용함 |
| [x] | P1-T6 팀 추론/분류 평가셋 추가 | `docs/ai-automation-guidelines.md`, `01-content-contract.md` | 최소 8개 케이스가 직접 팀 언급, 선수만 언급, 감독만 언급, 추상 표현, 비대상 팀, 오피셜, 루머, 미디어 중심 글의 예상 팀/decision/status를 명시함 |

P1 종료 확인:

- `npm run build`
- `api/**/*.js` 문법 검사
- API 데이터가 비어 있어도 mock 피드가 동작함

## P2 데이터 모델

상세 문서: `docs/plans/ai-automation/02-data-model.md`

| 상태 | 작업 | 주요 파일 | 완료 조건 |
|---|---|---|---|
| [x] | P2-T1 P1 필드에 맞게 스키마 수정 | `supabase/schema.sql` | 스키마에 `summary_short_ko`, `summary_detail_ko`, `briefing_status`, `review_reason`이 포함됨 |
| [x] | P2-T2 마이그레이션 안내 추가 | `docs/deployment-mvp.md`, `02-data-model.md`, `supabase/migrations/20260527_p2_briefing_fields.sql` | 기존 DB 업그레이드 경로가 문서화됨 |
| [x] | P2-T3 기자 X 계정 리스트업 입력 방식 확정 | `docs/deployment-mvp.md`, `supabase/schema.sql`, `02-data-model.md` | 사용자가 직접 작성할 source 목록 형식과 필수 필드가 명시됨 |
| [x] | P2-T4 source seed 예시 추가 | `docs/deployment-mvp.md`, `supabase/source-seed.example.sql` | Fabrizio, Ornstein, Sky Sports 예시가 문서화됨 |
| [x] | P2-T5 alias 유지보수 규칙 추가 | `docs/ai-automation-guidelines.md`, `02-data-model.md` | 선수/감독 alias 생명주기가 명확함 |
| [x] | P2-T6 중복 방지 규칙 검증 | `supabase/schema.sql`, `api/collect.js` | 같은 X 글이 중복 content row를 만들 수 없음 |

P2 종료 확인:

- 새 Supabase 프로젝트에서 스키마 실행 가능
- API 코드와 문서가 같은 필드명을 사용
- 삭제되거나 이름이 바뀐 필드를 코드가 참조하지 않음

## P3 수집 파이프라인

상세 문서: `docs/plans/ai-automation/03-ingestion-pipeline.md`

| 상태 | 작업 | 주요 파일 | 완료 조건 |
|---|---|---|---|
| [x] | P3-T1 X timeline fetch 검증 | `api/_lib/x.js`, `api/collect.js` | 배포 환경에서 설정된 source를 조회할 수 있음 |
| [x] | P3-T2 idempotency 검증 | `api/collect.js`, `supabase/schema.sql` | collector를 두 번 실행해도 중복 row가 생기지 않음 |
| [x] | P3-T3 source cursor 검증 | `api/collect.js`, `api/_lib/x.js` | 성공한 source의 `last_seen_post_id`가 갱신됨 |
| [x] | P3-T4 오류 처리 검증 | `api/collect.js`, `api/_lib/audit.js`, `api/_lib/slack.js` | X/Upstage Solar/Supabase 실패가 audit event로 남음 |
| [x] | P3-T5 라우팅 검증 | `api/_lib/ai.js`, `api/collect.js` | 루머/부인/업데이트도 정보성이 있으면 publish, 미디어 의존/감상/팀 불확실 글은 review로 감 |
| [x] | P3-T6 collector smoke test 문서화 | `docs/deployment-mvp.md`, `03-ingestion-pipeline.md` | 수동 curl과 예상 응답이 문서화됨 |
| [x] | P3-T7 실제 X 글 AI 요약 검증 | `api/collect.js`, `api/_lib/ai.js`, Supabase `content_items` | 실제 source 글 1개가 Upstage Solar를 거쳐 briefing 제목/짧은 요약/상세 요약/status/tags로 저장됨 |

P3 종료 확인:

- 수동 collector 실행 결과가 insert 또는 skip으로 예측 가능함
- 한 source 실패가 전체 source 처리를 중단하지 않음
- 결정 결과가 P1 규칙과 일치함
- 실제 X 글에서 생성된 한국어 요약이 원문 밖 내용을 추가하지 않고 P1 콘텐츠 계약을 따름

## P4 관리자 검수

상세 문서: `docs/plans/ai-automation/04-admin-review.md`

| 상태 | 작업 | 주요 파일 | 완료 조건 |
|---|---|---|---|
| [x] | P4-T1 UI 필드를 P1/P2와 정렬 | `src/epl/AdminDashboard.jsx`, `api/admin/items.js` | 관리자 화면이 short/detail summary와 briefing status를 표시함 |
| [x] | P4-T2 empty/error 상태 추가 | `src/epl/AdminDashboard.jsx` | 토큰 없음, API 오류, 빈 큐 상태가 이해 가능함 |
| [x] | P4-T3 approve flow 추가 | `api/admin/review.js`, `api/_lib/slack.js` | 승인 시 published 필드가 갱신되고 Slack 발행 알림이 감 |
| [x] | P4-T4 reject flow 추가 | `api/admin/review.js`, `src/epl/AdminDashboard.jsx` | 반려 시 `rejected`가 되고 reviewer note가 저장됨 |
| [x] | P4-T5 update flow 추가 | `api/admin/review.js`, `src/epl/AdminDashboard.jsx` | save가 발행 없이 한국어 문구만 수정함 |
| [x] | P4-T6 관리자 반응형 레이아웃 검증 | `src/epl/AdminDashboard.jsx` | 데스크톱/모바일 폭에서 UI 겹침이 없음 |

P4 종료 확인:

- 관리자가 DB 직접 접근 없이 review item을 발행할 수 있음
- 관리자가 DB 직접 접근 없이 부적절한 item을 반려할 수 있음
- item이 없어도 관리자 페이지가 로드됨

## P5 피드 발행

상세 문서: `docs/plans/ai-automation/05-feed-publishing.md`

| 상태 | 작업 | 주요 파일 | 완료 조건 |
|---|---|---|---|
| [ ] | P5-T1 `/api/feed` 매핑 수정 | `api/_lib/feed.js`, `api/feed.js` | P1 briefing 필드를 사용함 |
| [ ] | P5-T2 mock fallback 유지 | `src/epl/usePublishedPosts.js`, `src/epl/EPLFeed.jsx`, `src/epl/DesktopLayout.jsx` | `/api/feed` 실패 또는 빈 응답이어도 피드가 렌더됨 |
| [ ] | P5-T3 데스크톱 피드 확인 | `src/epl/DesktopLayout.jsx` | 발행된 live item이 desktop layout에 표시됨 |
| [ ] | P5-T4 모바일 피드 확인 | `src/epl/EPLFeed.jsx` | 발행된 live item이 mobile feed에 표시됨 |
| [ ] | P5-T5 팀 필터 확인 | `api/_lib/feed.js`, `src/epl/DesktopLayout.jsx` | 발행된 team tag가 기존 필터와 동작함 |

P5 종료 확인:

- feed 컴포넌트를 수동 수정하지 않아도 live published content가 표시됨
- 기존 mock/demo 경험이 유지됨

## P6 배포와 운영 검증

상세 문서: `docs/plans/ai-automation/06-deployment-ops.md`

| 상태 | 작업 | 주요 파일 | 완료 조건 |
|---|---|---|---|
| [ ] | P6-T1 fresh build 검증 | 전체 코드 | `npm run build` 통과 |
| [ ] | P6-T2 API 문법 검증 | `api/**/*.js` | API 파일 문법 검사 통과 |
| [ ] | P6-T3 Supabase 검증 | `supabase/schema.sql`, Supabase 프로젝트 | 테이블이 존재하고 seed source가 active 상태임 |
| [ ] | P6-T4 수동 수집 검증 | 배포된 `/api/collect` | collector가 summary를 반환하고 audit event를 생성함 |
| [ ] | P6-T5 Slack 검증 | Slack webhooks | 두 Slack 채널이 예상 메시지를 받음 |
| [ ] | P6-T6 Cron 검증 | 외부 Cron | Cron이 15분마다 collector를 호출함 |
| [ ] | P6-T7 중복 검증 | 배포 collector + Supabase | collector 재실행 시 중복 row가 생기지 않음 |
| [ ] | P6-T8 실제 수집-요약-feed E2E 검증 | 배포 collector + Supabase + `/admin` + `/api/feed` | 실제 X 글 1개가 수집, AI 요약, 저장, 검수/발행, 화면 노출까지 이어짐 |

P6 종료 확인:

- source에서 feed까지 하나의 item이 생성됨
- 실제 item의 `briefing.title`, `summary_short`, `summary_detail`, `status`, `tags`가 P1 규칙과 일치함
- 루머/부인/업데이트도 팀과 정보가 확실하면 자동 발행됨
- 팀 불확실, 미디어 의존, 정보 없음, 기자 감상 글이 검수 큐에 들어감
- 승인한 검수 item이 피드에 표시됨
- 높은 확신의 informative item이 자동 발행될 수 있음
- 실패가 관리자 source 상태 또는 audit event에 드러남

---

# 구현 상태

## 현재 작업 트리에 이미 구현된 것

- Vercel 스타일 API endpoint:
  - `/api/collect`
  - `/api/feed`
  - `/api/admin/items`
  - `/api/admin/review`
- Supabase REST, X API, Upstage Solar, Slack, audit event, auth token helper.
- 초기 Supabase schema.
- 초기 `/admin` 대시보드와 검수 UI.
- 기존 Reax 피드가 `/api/feed`를 먼저 시도하고 실패 시 mock fallback 사용.
- config 호환성 수정 후 로컬 `npm run build` 통과.
- P1 콘텐츠 계약 정렬:
  - AI structured output이 nested `briefing` 계약을 사용함.
  - fallback classifier도 같은 계약을 반환함.
  - 자동 발행 기준이 팀 확정, 정보성, confidence, evidence, media-heavy 여부, 기자 감상 여부를 함께 사용함.
  - feed/admin/Slack 매핑이 `briefing.title`, `summary_short`, `summary_detail`, `status`, `tags`를 우선 사용함.
- P2 데이터 모델 정렬:
  - `content_items`에 `summary_short_ko`, `summary_detail_ko`, `briefing_status`, `review_reason` 필드가 추가됨.
  - 기존 DB 업그레이드용 migration SQL이 추가됨.
  - 기자 source 입력 방식과 seed 예시가 문서화됨.
  - alias stale 처리 규칙이 문서화됨.
  - collector 중복 기준이 X 전역 `raw_post_id`로 정렬됨.
- P3 수집 파이프라인 검증:
  - Vercel 배포 환경에서 실제 X source를 수집하고 Supabase에 저장함.
  - Upstage Solar가 실제 X 글을 briefing 제목/짧은 요약/상세 요약/status/tags로 변환함.
  - `@TheAthleticFC` 안의 `CFC`처럼 문자열 내부 alias가 팀 태그로 오탐되지 않게 보수 매칭을 추가함.
  - live `team_aliases`의 넓은 club alias를 비활성화하고 오탐 테스트 row를 정리함.
- P4 관리자 검수 정렬:
  - 관리자 카드가 `title_ko`, `summary_short_ko`, `summary_detail_ko`, `briefing_status`, `team_tags`를 우선 사용함.
  - `team_tags=[]`도 정규화된 결과로 인정해 과거 `ai_result`의 오탐 태그가 다시 보이지 않게 함.
  - 토큰 없음, API 오류, 빈 큐, 수집/저장/승인/반려 결과 메시지를 UI에서 구분함.
  - 반려 메모 입력과 서버 검증을 추가해 `review_note`가 저장됨.
  - 배포된 `/api/admin/review`로 update/reject/approve 플로우를 실제 Supabase 테스트 row에 대해 검증함.
  - 승인 플로우에서 `published_at`, `reviewed_by`가 저장되고 `slack_notify_failed` audit 이벤트가 없음을 확인함.
  - 모바일 390px, 데스크톱 1440px CDP 캡처에서 관리자 화면 가로 overflow가 없음을 확인함.

## 남은 빈틈

- 외부 Cron 15분 반복 검증은 아직 하지 않음.
- 발행된 live item이 기존 모바일/데스크톱 피드에 노출되는 E2E 검증은 P5/P6에서 진행해야 함.

## 결정 기록

- 스크래핑이 아니라 X API를 사용한다.
- MVP 저장소는 Supabase Free를 사용한다.
- AI 출력은 Upstage Solar Chat Completions와 서버 측 JSON 정규화/보수 정책을 사용한다.
- Slack Incoming Webhook 2개를 사용한다.
- 15분 수집은 외부 Cron으로 실행한다.
- 자동 발행은 오피셜 여부가 아니라 대상 팀 확정과 텍스트 정보성을 기준으로 처리한다.
- live 데이터가 비어 있거나 API가 실패할 수 있으므로 mock feed fallback을 유지한다.

## 막힌 점

- 현재 막힌 점 없음.
