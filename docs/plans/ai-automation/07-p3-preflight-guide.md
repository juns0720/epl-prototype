# P3 사전작업 상세 가이드

이 문서는 P3 수집 파이프라인 검증 전에 사용자가 직접 해야 하는 외부 서비스 설정 절차다. 목표는 실제 X 글 1개를 수집해서 Upstage Solar 요약, Supabase 저장, Slack 알림, 관리자 화면 노출까지 확인할 수 있는 상태를 만드는 것이다.

## 절대 규칙

- API key와 webhook URL은 Git에 커밋하지 않는다.
- `.env.local`은 로컬 테스트용으로만 쓰고 공유하지 않는다.
- 처음부터 Cron을 켜지 않는다. 반드시 수동 수집이 성공한 뒤 Cron을 연결한다.
- 처음에는 기자 source를 1개만 `active=true`로 둔다.
- 처음에는 `X_MAX_RESULTS=5`로 작게 시작한다.

## 준비물 체크리스트

| 준비물 | 어디서 얻는가 | 프로젝트 환경변수 |
|---|---|---|
| Supabase Project URL | Supabase Project Settings | `SUPABASE_URL` |
| Supabase service role key | Supabase Project Settings | `SUPABASE_SERVICE_ROLE_KEY` |
| X API bearer token | X Developer Portal | `X_BEARER_TOKEN` |
| Upstage API key | Upstage Console API Keys | `UPSTAGE_API_KEY` |
| Slack 발행 webhook | Slack App Incoming Webhooks | `SLACK_PUBLISH_WEBHOOK_URL` |
| Slack 검수 webhook | Slack App Incoming Webhooks | `SLACK_REVIEW_WEBHOOK_URL` |
| collector 비밀키 | 직접 생성 | `CRON_SECRET` |
| 관리자 비밀키 | 직접 생성 | `ADMIN_TOKEN` |

비밀키는 PowerShell에서 아래처럼 만들 수 있다.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

위 명령을 두 번 실행해서 하나는 `CRON_SECRET`, 하나는 `ADMIN_TOKEN`으로 쓴다.

## 1. Supabase 프로젝트 만들기

1. Supabase에 로그인한다.
2. New project를 만든다.
3. 프로젝트가 준비되면 SQL Editor를 연다.
4. 이 repo의 `supabase/schema.sql` 내용을 전부 복사한다.
5. SQL Editor에 붙여넣고 실행한다.
6. 실행 후 아래 쿼리로 테이블이 생겼는지 확인한다.

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('sources', 'team_aliases', 'content_items', 'audit_events')
order by table_name;
```

정상이라면 4개 테이블이 보여야 한다.

## 2. 기존 Supabase를 쓰는 경우

이미 예전 schema를 적용한 프로젝트가 있으면 `schema.sql`을 다시 전체 실행하지 않는다.

먼저 중복 X 글이 있는지 확인한다.

```sql
select raw_post_id, count(*)
from public.content_items
group by raw_post_id
having count(*) > 1;
```

결과가 없으면 `supabase/migrations/20260527_p2_briefing_fields.sql` 내용을 SQL Editor에서 실행한다.

실행 후 아래 쿼리로 새 필드를 확인한다.

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'content_items'
  and column_name in ('summary_short_ko', 'summary_detail_ko', 'briefing_status', 'review_reason')
order by column_name;
```

## 3. 기자 source 넣기

처음 검증에서는 source를 1개만 넣는다. `x_user_id`는 몰라도 된다. collector가 X username lookup으로 채운다.

```sql
insert into public.sources (handle, x_user_id, name, tier, active, notes) values
  ('FabrizioRomano', null, 'Fabrizio Romano', 1, true, 'P3 첫 검증용 source')
on conflict (handle) do update set
  x_user_id = coalesce(excluded.x_user_id, public.sources.x_user_id),
  name = excluded.name,
  tier = excluded.tier,
  active = excluded.active,
  notes = excluded.notes,
  updated_at = now();
```

확인:

```sql
select id, handle, x_user_id, name, tier, active, last_seen_post_id, last_checked_at, last_error
from public.sources
order by tier asc, handle asc;
```

`active`가 `true`여야 한다.

## 4. Supabase 환경변수 얻기

Supabase Project Settings에서 아래 값을 찾는다.

- Project URL 또는 API URL -> `SUPABASE_URL`
- service role key -> `SUPABASE_SERVICE_ROLE_KEY`

주의:

- `SUPABASE_URL`은 `https://프로젝트ref.supabase.co` 형태가 가장 좋다.
- Supabase 화면에서 복사한 값이 `https://프로젝트ref.supabase.co/rest/v1`처럼 `/rest/v1`까지 포함되어 있어도 현재 코드는 처리할 수 있다.
- `anon key`가 아니라 `service role key`를 써야 한다.
- service role key는 서버에서만 사용한다.
- 이 값을 프론트엔드 코드에 직접 넣지 않는다.

## 5. X API bearer token 준비

1. X Developer Portal에 들어간다.
2. Project/App을 만든다.
3. Keys and tokens 영역에서 bearer token을 발급하거나 regenerate한다.
4. 값을 `X_BEARER_TOKEN`으로 저장한다.

PowerShell에서 username lookup이 되는지 먼저 확인한다.

```powershell
$env:X_BEARER_TOKEN="여기에_X_BEARER_TOKEN"
Invoke-RestMethod `
  -Uri "https://api.x.com/2/users/by/username/FabrizioRomano?user.fields=username,name,verified" `
  -Headers @{ Authorization = "Bearer $env:X_BEARER_TOKEN" }
```

정상 응답 예시 형태:

```json
{
  "data": {
    "id": "330262748",
    "name": "Fabrizio Romano",
    "username": "FabrizioRomano"
  }
}
```

그 다음 timeline 조회를 확인한다.

```powershell
$xUserId="위_응답의_data.id"
Invoke-RestMethod `
  -Uri "https://api.x.com/2/users/$xUserId/tweets?max_results=5&exclude=retweets,replies&tweet.fields=created_at,public_metrics,attachments,referenced_tweets&expansions=attachments.media_keys&media.fields=media_key,type,url,preview_image_url,width,height" `
  -Headers @{ Authorization = "Bearer $env:X_BEARER_TOKEN" }
```

`data` 배열이 오면 P3-T1의 핵심 외부 조건은 준비된 것이다. `403`, `429`, plan 관련 오류가 오면 X API 플랜/권한 문제다.

## 6. Upstage Solar API key 준비

1. Upstage Console에 로그인한다.
2. API Keys 화면에서 새 key를 만들거나 기본 key를 복사한다.
3. 값을 `UPSTAGE_API_KEY`로 저장한다.
4. `UPSTAGE_MODEL`은 우선 `solar-pro3`로 둔다.
5. `UPSTAGE_BASE_URL`은 기본값 `https://api.upstage.ai/v1`을 사용한다.

간단 확인:

```powershell
$env:UPSTAGE_API_KEY="여기에_UPSTAGE_API_KEY"
Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.upstage.ai/v1/chat/completions" `
  -Headers @{
    Authorization = "Bearer $env:UPSTAGE_API_KEY"
    "Content-Type" = "application/json"
  } `
  -Body '{"model":"solar-pro3","messages":[{"role":"user","content":"ping"}],"stream":false}'
```

모델 권한 오류가 나면 Vercel 환경변수의 `UPSTAGE_MODEL`을 계정에서 사용 가능한 모델로 바꾼다. 예비 후보는 `solar-pro2`, `solar-mini`다.

## 7. Slack webhook 2개 만들기

Slack에서 채널을 2개 만든다.

- 발행 채널 예시: `#epl-publish`
- 검수 채널 예시: `#epl-review`

Slack App 설정:

1. Slack API Apps 페이지에서 앱을 만든다.
2. Features > Incoming Webhooks로 간다.
3. Activate Incoming Webhooks를 켠다.
4. Add New Webhook to Workspace를 누른다.
5. 발행 채널을 선택하고 URL을 복사한다.
6. 다시 Add New Webhook to Workspace를 눌러 검수 채널 URL도 만든다.

환경변수 매핑:

- 발행 채널 URL -> `SLACK_PUBLISH_WEBHOOK_URL`
- 검수 채널 URL -> `SLACK_REVIEW_WEBHOOK_URL`

PowerShell 테스트:

```powershell
$env:SLACK_REVIEW_WEBHOOK_URL="여기에_검수_webhook_URL"
Invoke-RestMethod `
  -Method Post `
  -Uri $env:SLACK_REVIEW_WEBHOOK_URL `
  -ContentType "application/json" `
  -Body '{"text":"EPL automation review webhook test"}'
```

검수 채널에 메시지가 오면 성공이다. 발행 webhook도 같은 방식으로 테스트한다.

## 8. Vercel 환경변수 등록

Vercel 프로젝트에서 Settings > Environment Variables로 간다.

아래 값을 등록한다.

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
X_BEARER_TOKEN=...
UPSTAGE_API_KEY=...
UPSTAGE_MODEL=solar-pro3
UPSTAGE_BASE_URL=https://api.upstage.ai/v1
SLACK_PUBLISH_WEBHOOK_URL=...
SLACK_REVIEW_WEBHOOK_URL=...
CRON_SECRET=...
ADMIN_TOKEN=...
X_MAX_RESULTS=5
```

환경 선택:

- 현재 브랜치 `faeture/ai-aut`로 테스트하면 Preview 환경에도 값을 넣는다.
- main 배포까지 테스트하려면 Production 환경에도 값을 넣는다.
- 잘 모르겠으면 Preview, Production 둘 다 체크한다.

환경변수를 바꾼 뒤에는 반드시 redeploy한다. 이미 떠 있는 deployment는 새 env를 자동으로 다시 읽지 않을 수 있다.

## 9. 첫 수동 수집 실행

Vercel 배포 URL이 있다고 가정한다.

브라우저 방식:

1. `https://배포_URL/admin`으로 간다.
2. `ADMIN_TOKEN` 입력칸에 값을 넣는다.
3. `CRON_SECRET` 입력칸에 값을 넣는다.
4. `Run collection`을 누른다.
5. 화면 메시지에 `수집 완료`가 나오는지 확인한다.

PowerShell 방식:

```powershell
$CRON_SECRET="여기에_CRON_SECRET"
Invoke-RestMethod `
  -Method Post `
  -Uri "https://배포_URL/api/collect" `
  -Headers @{ Authorization = "Bearer $CRON_SECRET" }
```

성공 응답은 대략 아래 형태다.

```json
{
  "ok": true,
  "summary": {
    "sources": 1,
    "fetched": 5,
    "inserted": 1,
    "skipped": 0,
    "review": 1,
    "published": 0,
    "discarded": 0,
    "errors": []
  }
}
```

`inserted`가 0이어도 항상 실패는 아니다. 이미 처리된 글이면 `skipped`가 늘 수 있다.

## 10. Supabase에서 결과 확인

수집 후 SQL Editor에서 확인한다.

```sql
select
  raw_post_id,
  raw_author_handle,
  status,
  briefing_status,
  title_ko,
  summary_short_ko,
  summary_detail_ko,
  review_reason,
  team_tags,
  created_at
from public.content_items
order by created_at desc
limit 10;
```

확인할 것:

- `raw_post_id`가 있다.
- `title_ko`가 한국어다.
- `summary_short_ko`가 비어 있지 않다.
- `summary_detail_ko`가 비어 있지 않다.
- `briefing_status`가 `OFFICIAL`, `CONFIRMED`, `UPDATE`, `RUMOUR`, `DENIED` 중 하나다.
- 대상 6개 팀이 아니면 `discarded`로 가야 한다.
- 루머/부인/업데이트도 팀과 정보가 확실하면 `published`로 갈 수 있다.
- 팀 불확실, 미디어 의존, 정보 없음, 기자 감상 글은 `review`로 가야 한다.

audit도 확인한다.

```sql
select event_type, source_id, content_item_id, payload, created_at
from public.audit_events
order by created_at desc
limit 20;
```

## 11. 중복 수집 확인

바로 한 번 더 `/api/collect`를 실행한다.

기대값:

- 같은 X 글이 다시 `content_items`에 추가되지 않는다.
- 응답에서 `skipped`가 늘거나 `inserted`가 0에 가까워진다.
- 아래 쿼리가 아무 row도 반환하지 않아야 한다.

```sql
select raw_post_id, count(*)
from public.content_items
group by raw_post_id
having count(*) > 1;
```

## 12. Cron 연결은 마지막에 한다

수동 수집, Supabase 저장, Slack 알림, 관리자 화면 확인이 끝난 뒤에만 외부 Cron을 설정한다.

외부 Cron 설정값:

- Method: `POST`
- URL: `https://배포_URL/api/collect`
- Header: `Authorization: Bearer CRON_SECRET_VALUE`
- Interval: 15분

## 문제 해결 표

| 증상 | 확인할 것 | 조치 |
|---|---|---|
| `/api/collect`가 401 | `CRON_SECRET` | 요청 header가 `Authorization: Bearer 값`인지 확인 |
| `/api/admin/items`가 401 | `ADMIN_TOKEN` | `/admin`에 입력한 값과 Vercel env 값 비교 |
| Supabase 500 | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | anon key를 넣지 않았는지 확인 |
| X username lookup 실패 | `X_BEARER_TOKEN`, X plan | `GET /2/users/by/username/...` 단독 테스트 |
| X timeline 403/429 | X API 권한/제한 | plan, rate limit, app 권한 확인 |
| Upstage Solar 오류 | `UPSTAGE_API_KEY`, `UPSTAGE_MODEL`, `UPSTAGE_BASE_URL` | key와 모델 접근 권한 확인 |
| Slack 메시지 없음 | webhook URL | PowerShell webhook 단독 테스트 |
| 수집은 됐는데 전부 discarded | 대상 팀/alias | `team_aliases`에 선수/감독 alias가 있는지 확인 |
| 팀이 잘못 붙음 | stale alias | 해당 alias를 `active=false`로 바꾸고 `notes`에 사유 기록 |
| 같은 글이 중복됨 | DB unique/migration | `raw_post_id` unique index 존재 여부 확인 |

## P3 시작 가능 조건

아래가 모두 끝나면 P3-T1을 진행할 수 있다.

- Supabase 테이블 4개가 존재한다.
- `sources`에 active source가 1개 이상 있다.
- X username lookup 테스트가 성공한다.
- X user timeline 테스트가 성공한다.
- Vercel Preview 또는 Production에 모든 환경변수가 등록되어 있다.
- `/admin`에 접속할 수 있다.
- Cron은 아직 켜지 않았다.

## 참고 공식 문서

- X User lookup: https://docs.x.com/x-api/users/get-user-by-username
- X User Posts timeline: https://docs.x.com/x-api/posts/user-posts-timeline-by-user-id
- Supabase Database/SQL Editor: https://supabase.com/docs/guides/database/overview
- Vercel environment variables: https://docs.vercel.com/docs/builds
- Slack Incoming Webhooks: https://api.slack.com/messaging/webhooks
- Upstage Console API keys: https://console.upstage.ai/api-keys?api=chat
