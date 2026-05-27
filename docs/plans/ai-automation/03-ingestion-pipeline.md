# P3 수집 파이프라인

## 목표

직접 선정한 기자 계정에서 X 글을 수집하고, 중복 제거, AI 분류, 저장, 발행/검수/폐기 라우팅을 수행한다.

P3 작업을 시작하기 전에 `docs/plans/ai-automation/07-p3-preflight-guide.md`를 따라 실제 Supabase, X API, Upstage Solar, Slack, Vercel 환경변수를 준비한다.

## 흐름

1. 외부 Cron이 `POST /api/collect`를 호출한다.
2. API가 `CRON_SECRET`을 검증한다.
3. 활성화된 `sources`를 불러온다.
4. 각 source의 X user timeline을 조회한다.
5. retweet과 reply는 제외한다.
6. X 전역 post id인 `raw_post_id` 기준으로 중복을 제거한다.
7. P1 콘텐츠 계약에 맞춰 Upstage Solar로 분류한다.
8. 결과를 `content_items`에 저장한다.
9. `published` 또는 `review` 항목은 Slack 알림을 보낸다.
10. `sources.last_seen_post_id`를 갱신한다.
11. audit event를 기록한다.

## 작업 목록

| ID | 작업 | 완료 조건 |
|---|---|---|
| P3-T1 | X timeline fetch 검증 | 배포 환경에서 설정된 source의 글을 1개 이상 조회할 수 있음 |
| P3-T2 | idempotency 검증 | collector를 두 번 실행해도 중복 row가 생기지 않음 |
| P3-T3 | source cursor 검증 | source 처리가 성공한 뒤 `last_seen_post_id`가 갱신됨 |
| P3-T4 | 오류 처리 검증 | X/Upstage Solar/Supabase 실패가 audit event로 남음 |
| P3-T5 | 라우팅 검증 | 루머/부인/업데이트도 정보성이 있으면 publish, 미디어 의존/감상/팀 불확실 글은 review로 감 |
| P3-T6 | collector smoke test 문서화 | 수동 curl과 예상 응답이 문서화됨 |
| P3-T7 | 실제 X 글 AI 요약 검증 | 실제 source 글 1개가 Upstage Solar를 거쳐 `briefing.title`, `summary_short`, `summary_detail`, `status`, `tags`로 저장됨 |

## 종료 조건

- 수동 collector 실행이 insert 또는 skip을 예측 가능하게 수행한다.
- 한 source 실패가 전체 source 처리를 중단하지 않는다.
- 라우팅 결과가 P1 규칙과 일치한다.
- 실제 X 글에서 생성된 한국어 요약이 원문 밖 내용을 추가하지 않고 P1 콘텐츠 계약을 따른다.

## Collector Smoke Test

배포 URL과 `CRON_SECRET`을 준비한 뒤 아래를 실행한다.

```powershell
$CRON_SECRET="여기에_CRON_SECRET"
Invoke-RestMethod `
  -Method Post `
  -Uri "https://배포_URL/api/collect" `
  -Headers @{ Authorization = "Bearer $CRON_SECRET" }
```

정상 응답 예시:

```json
{
  "ok": true,
  "summary": {
    "sources": 1,
    "fetched": 1,
    "inserted": 1,
    "skipped": 0,
    "published": 0,
    "review": 1,
    "discarded": 0,
    "errors": []
  }
}
```

확인 기준:

- `status`가 HTTP 200이다.
- `summary.sources`가 active source 수와 일치한다.
- 신규 글이 있으면 `inserted`가 증가한다.
- 신규 글이 없으면 `fetched=0` 또는 `skipped` 중심으로 끝날 수 있다.
- source 하나가 실패해도 전체 응답은 `ok=true`이고 `summary.errors`에 실패 source가 들어간다.
- 실패는 `audit_events`의 `collector_source_failed` 또는 `collector_run_completed` payload에서 확인한다.

## P3-T7 실제 검증 기록

2026-05-27에 Vercel 배포 환경과 live Supabase에서 실제 X source를 수집해 검증했다.

- 과거 보수 정책에서는 `RUMOUR`와 일부 `CONFIRMED` 글도 `status="review"`로 저장됐지만, 현재 정책에서는 팀 확정과 텍스트 정보성이 충분하면 자동 발행할 수 있다.
- `David_Ornstein` source에서 Liverpool 관련 글이 `team_tags=["LIV"]`, `briefing_status="RUMOUR"`로 저장되는 것을 확인함.
- `SkySportsPL` source에서 Arsenal 관련 글이 `team_tags=["ARS"]`, `briefing_status="CONFIRMED"`로 저장되는 것을 확인함.
- `@TheAthleticFC` 안에 포함된 `CFC` 문자열이 첼시로 오탐되는 문제를 발견해 alias 매칭을 단어/해시태그 경계 기반으로 보강함.
- `City`, `United`, `AFC`, `Reds`, `Blues` 같은 넓은 club alias는 live `team_aliases`에서 `active=false`로 정리함.
- Upstage Solar가 `first title in 22 years`를 원문 밖 역사 맥락으로 확장하지 않도록 프롬프트를 강화하고, 폐기 row에는 Solar가 만든 추정 요약 대신 원문 기반 중립 브리핑을 저장하도록 보강함.
