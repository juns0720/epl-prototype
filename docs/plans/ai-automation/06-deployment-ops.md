# P6 배포와 운영 검증

## 목표

무료 서버 중심 인프라에 MVP를 배포하고, 수집부터 피드 노출까지 전체 루프가 실제로 동작하는지 증명한다.

## 필수 환경변수

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `X_BEARER_TOKEN`
- `UPSTAGE_API_KEY`
- `UPSTAGE_MODEL`
- `UPSTAGE_BASE_URL`
- `SLACK_PUBLISH_WEBHOOK_URL`
- `SLACK_REVIEW_WEBHOOK_URL`
- `CRON_SECRET`
- `ADMIN_TOKEN`
- `X_MAX_RESULTS`

## 배포 순서

1. Supabase 스키마를 실행한다.
2. 초기 source를 넣는다.
3. Vercel 환경변수를 등록한다.
4. Vercel 프로젝트를 배포한다.
5. `/admin`을 연다.
6. 수동 수집을 실행한다.
7. Supabase row 생성을 확인한다.
8. 실제 X 글이 Upstage Solar 요약을 거쳐 `content_items.ai_result.briefing`에 저장됐는지 확인한다.
9. 관리자 검수 큐 또는 피드에서 같은 글이 보이는지 확인한다.
10. Slack review/publish 알림을 확인한다.
11. 15분 주기의 외부 Cron을 설정한다.
12. 중복 수집 테스트를 실행한다.

## 작업 목록

| ID | 작업 | 완료 조건 |
|---|---|---|
| P6-T1 | fresh build 검증 | `npm run build` 통과 |
| P6-T2 | API 문법 검증 | API 파일 문법 검사 통과 |
| P6-T3 | Supabase 검증 | 테이블이 존재하고 seed source가 active 상태임 |
| P6-T4 | 수동 수집 검증 | `/api/collect`가 summary를 반환하고 audit event를 생성함 |
| P6-T5 | Slack 검증 | 두 Slack 채널이 예상 메시지를 받음 |
| P6-T6 | Cron 검증 | 외부 Cron이 15분마다 collector를 호출함 |
| P6-T7 | 중복 검증 | collector 재실행 시 중복 row가 생기지 않음 |
| P6-T8 | 실제 수집-요약-feed E2E 검증 | 실제 X 글 1개가 수집, AI 요약, 저장, 검수/발행, `/api/feed` 또는 `/admin` 노출까지 이어짐 |

## 종료 조건

- source에서 feed까지 하나의 item이 생성된다.
- 실제 item의 `briefing.title`, `summary_short`, `summary_detail`, `status`, `tags`가 P1 규칙과 일치한다.
- 루머/부인/업데이트도 팀과 정보가 확실하면 자동 발행된다.
- 팀 불확실, 미디어 의존, 정보 없음, 기자 감상 글이 검수 큐에 들어간다.
- 승인한 검수 item이 피드에 표시된다.
- 높은 확신의 informative item이 자동 발행될 수 있다.
- 실패가 관리자 source 상태 또는 audit event에 드러난다.
