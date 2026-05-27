# EPL X 자동화 MVP 배포 문서

## 필요한 계정

- Vercel 프로젝트: Vite 프론트엔드와 `/api/*` 서버리스 함수 배포
- Supabase Free 프로젝트: Postgres 테이블 저장소
- X Developer 앱: user timeline 조회용 bearer token
- Upstage Solar API key: AI 분류와 한국어 브리핑 생성
- Slack 앱: 발행 채널과 검수 채널 Incoming Webhook 2개
- 외부 스케줄러: cron-job.org 또는 GitHub Actions로 `/api/collect`를 15분마다 호출

## 환경변수

- `SUPABASE_URL`: Supabase 프로젝트 URL. `https://프로젝트ref.supabase.co` 형태를 권장하며, `/rest/v1`이 붙은 API URL도 코드에서 처리한다.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key. 서버에서만 사용한다.
- `X_BEARER_TOKEN`: X API bearer token
- `UPSTAGE_API_KEY`: Upstage API key
- `UPSTAGE_MODEL`: 선택값. 기본값은 `solar-pro3`
- `UPSTAGE_BASE_URL`: 선택값. 기본값은 `https://api.upstage.ai/v1`
- `SLACK_PUBLISH_WEBHOOK_URL`: 발행 채널 Incoming Webhook
- `SLACK_REVIEW_WEBHOOK_URL`: 검수 채널 Incoming Webhook
- `CRON_SECRET`: `/api/collect` 호출용 shared secret
- `ADMIN_TOKEN`: `/api/admin/*` 호출용 bearer token
- `X_MAX_RESULTS`: 선택값. source별 수집 개수이며 기본값은 `20`

## Supabase 신규 설정

1. Supabase SQL Editor를 연다.
2. `supabase/schema.sql`을 실행한다.
3. 기자 source를 넣는다.

```sql
insert into public.sources (handle, x_user_id, name, tier, active, notes) values
  ('FabrizioRomano', null, 'Fabrizio Romano', 1, true, '예시 source'),
  ('David_Ornstein', null, 'David Ornstein', 1, true, '예시 source'),
  ('SkySportsNews', null, 'Sky Sports News', 2, true, '예시 source')
on conflict (handle) do update set
  x_user_id = coalesce(excluded.x_user_id, public.sources.x_user_id),
  name = excluded.name,
  tier = excluded.tier,
  active = excluded.active,
  notes = excluded.notes,
  updated_at = now();
```

`x_user_id`를 모르면 `null`로 둔다. collector가 첫 실행 때 username lookup을 통해 저장한다. 같은 예시는 `supabase/source-seed.example.sql`에도 있다.

## 기존 Supabase 업그레이드

이미 테이블이 있다면 drop하지 않는다. 먼저 중복을 확인한다.

```sql
select raw_post_id, count(*)
from public.content_items
group by raw_post_id
having count(*) > 1;
```

결과가 없으면 `supabase/migrations/20260527_p2_briefing_fields.sql`을 실행한다. 실행 후 `content_items`에 아래 필드가 있는지 확인한다.

- `summary_short_ko`
- `summary_detail_ko`
- `briefing_status`
- `review_reason`

기존 `summary_ko`, `news_type`은 호환용으로 남긴다. 신규 코드와 UI는 `summary_short_ko`, `summary_detail_ko`, `briefing_status`, `review_reason`을 우선 사용한다.

그 다음 `supabase/migrations/20260527_p3_conservative_aliases.sql`을 실행한다. 이 마이그레이션은 `City`, `United`, `AFC`, `Reds`, `Blues`처럼 너무 넓은 club alias를 비활성화해 `@TheAthleticFC` 같은 문자열 때문에 첼시가 잘못 태그되는 문제를 막는다.

## Source 입력 방식

MVP에서는 기자 계정을 코드에 넣지 않는다. 사용자가 직접 `sources` row를 관리한다.

| 필드 | 필수 | 설명 |
|---|---|---|
| `handle` | 필수 | `@` 없이 입력하는 X handle |
| `tier` | 필수 | 내부 우선순위. 숫자가 낮을수록 우선 |
| `active` | 필수 | 수집 대상이면 `true` |
| `x_user_id` | 선택 | 모르면 `null` |
| `name` | 선택 | 관리자 화면 표시용 이름 |
| `notes` | 선택 | 운영 메모 |

## Vercel 설정

1. 이 repository를 Vercel에 연결한다.
2. 위 환경변수를 전부 등록한다.
3. 배포한다.
4. `/admin`을 열고 `ADMIN_TOKEN`을 입력한다.
5. `Run collection`으로 수동 수집을 실행한다.

## 외부 Cron

- Method: `POST`
- URL: `https://YOUR_DOMAIN/api/collect`
- Header: `Authorization: Bearer CRON_SECRET_VALUE`
- Interval: 15분

Vercel Hobby Cron은 15분 루프에 쓰지 않는다. Hobby Cron은 제한이 있어 외부 Cron이 `/api/collect`를 호출하는 방식으로 운영한다.

## Slack 검증

발행 채널은 아래 알림을 받아야 한다.

- 자동 발행된 정보성 글
- 관리자가 승인한 글

검수 채널은 아래 알림을 받아야 한다.

- 검수 큐에 들어간 글
- collector/source 오류

Slack 알림 실패는 MVP에서 재시도하지 않는다. 대신 `audit_events`에 `slack_notify_failed`로 남긴다.

## 운영 검증

- `/api/feed`는 `published` item만 반환한다.
- `/api/admin/items`는 `Authorization: Bearer ADMIN_TOKEN`으로 호출했을 때 대시보드 count와 검수 item을 반환한다.
- `/api/collect`는 X 전역 `raw_post_id` 기준으로 idempotent해야 하며, 같은 X 글을 중복 저장하면 안 된다.
- 실제 X 글 하나가 수집, Upstage Solar 분류, 한국어 브리핑 생성, Supabase 저장, 검수/발행 라우팅, 관리자/피드 표시까지 이어져야 한다.
- 첫 실제 수집 후 `content_items.ai_result.briefing`의 `title`, `summary_short`, `summary_detail`, `status`, `tags`를 확인한다.
- 첫 실제 수집 후 `content_items.summary_short_ko`, `summary_detail_ko`, `briefing_status`, `review_reason`을 확인한다.
- 분류, source fetch, Slack, 관리자 검수 동작이 애매하면 `audit_events`를 확인한다.

## Collector Smoke Test

배포 후 Cron을 켜기 전에 수동으로 collector를 1회 실행한다.

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

오류 source가 있어도 collector는 가능한 source를 계속 처리한다.

```json
{
  "ok": true,
  "summary": {
    "sources": 2,
    "fetched": 0,
    "inserted": 0,
    "errors": [
      {
        "source": "codex_p3_bad_source",
        "message": "One or more parameters to your request was invalid."
      }
    ]
  }
}
```

검증 후 확인 쿼리:

```sql
select event_type, payload, created_at
from public.audit_events
order by created_at desc
limit 20;
```
