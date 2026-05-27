# P2 데이터 모델

## 목표

수집 파이프라인을 확장하기 전에 Supabase 테이블이 P1 콘텐츠 계약과 운영 요구사항을 정확히 담도록 만든다.

## 테이블 정의

### `sources`

직접 선정한 기자 X 계정을 저장한다.

필수 필드:

- `handle`
- `x_user_id`
- `name`
- `tier`
- `active`
- `notes`
- `last_seen_post_id`
- `last_checked_at`
- `last_error`

### `team_aliases`

팀 추론에 사용하는 클럽, 선수, 감독, 문맥 alias를 저장한다.

필수 필드:

- `team_code`
- `alias`
- `entity_type`
- `active`
- `notes`
- `last_verified_at`

### `content_items`

원본 X 글, AI 결과, 검수 상태, 발행 문구를 저장한다.

P1 이후 필요한 필드:

- 원문 필드: `raw_post_id`, `raw_url`, `raw_text`, `raw_created_at`, `raw_author_handle`
- 워크플로우 필드: `status`, `confidence`, `team_tags`, `review_reason`
- AI 필드: `ai_result`, `briefing_status`
- 발행 필드: `title_ko`, `summary_short_ko`, `summary_detail_ko`, `published_at`

호환 필드:

- `news_type`: 기존 코드/데이터와 호환을 위해 남겨둔다. 신규 판단 기준은 `briefing_status`다.
- `summary_ko`: 기존 데이터와 호환을 위해 남겨둔다. 신규 표시 기준은 `summary_short_ko`다.

중복 방지 기준:

- X post id는 전역 id이므로 `raw_post_id`를 unique로 둔다.
- collector는 insert 전에 `raw_post_id`로 기존 row를 조회한다.
- `source_id`가 바뀌거나 source row가 삭제되어도 같은 X 글은 다시 저장하지 않는다.

### `audit_events`

시스템 이벤트와 관리자 액션을 저장한다.

필수 이벤트 타입:

- `collector_run_completed`
- `collector_source_failed`
- `content_classified`
- `admin_approve`
- `admin_reject`
- `admin_update`
- `slack_notify_failed`

## 작업 목록

| ID | 작업 | 완료 조건 |
|---|---|---|
| P2-T1 | P1 필드에 맞게 `supabase/schema.sql` 수정 | 새 스키마에 short/detail summary와 briefing status 필드가 있음 |
| P2-T2 | 마이그레이션 안내 추가 | 기존 DB를 드롭하지 않고 업그레이드하는 경로가 문서화됨 |
| P2-T3 | 기자 X 계정 리스트업 입력 방식 확정 | 사용자가 직접 작성할 source 목록 형식과 필수 필드가 명시됨 |
| P2-T4 | source seed 예시 추가 | Fabrizio, Ornstein, Sky Sports 예시 row가 문서화됨 |
| P2-T5 | alias 유지보수 규칙 추가 | 선수/감독 alias의 추가, 비활성화, stale 처리 기준이 명확함 |
| P2-T6 | 중복 방지 규칙 확인 | 같은 X 글이 중복 content row를 만들 수 없음 |

## 기자 X 계정 리스트업 기준

MVP에서는 기자 계정을 코드에 하드코딩하지 않는다. 사용자가 직접 `sources` 테이블에 row를 추가하는 방식으로 관리한다.

사용자가 작성할 source 목록 형식:

| 필드 | 필수 | 예시 | 설명 |
|---|---|---|---|
| `handle` | 필수 | `FabrizioRomano` | `@` 없이 입력한다. |
| `tier` | 필수 | `1` | 내부 신뢰도/우선순위. 숫자가 낮을수록 우선순위가 높다. |
| `active` | 필수 | `true` | 수집 대상이면 `true`, 임시 중단이면 `false`. |
| `x_user_id` | 선택 | `null` | 모르면 비워둔다. collector가 username lookup 후 저장한다. |
| `name` | 선택 | `Fabrizio Romano` | 관리자 화면 표시용 이름. |
| `notes` | 선택 | `transfer source` | 운영자가 남기는 메모. |

필수 입력 요약:

- `handle`: X handle. 예: `FabrizioRomano`
- `tier`: 신뢰도 구분. 예: `1`, `2`
- `active`: 수집 여부. 예: `true`

선택 입력:

- `x_user_id`: 알고 있으면 입력한다. 모르면 collector가 username lookup으로 채운다.
- `name`: 표시용 이름.

초기 MVP에서 source 관리 UI는 필수가 아니다. 운영자가 Supabase SQL 또는 seed 문서로 직접 관리한다.

예시 seed는 `supabase/source-seed.example.sql`에 둔다.

## 기존 DB 마이그레이션

이미 Supabase 테이블을 만든 상태라면 `supabase/schema.sql`을 다시 전체 실행하지 않는다. 아래 순서로 업그레이드한다.

1. `content_items.raw_post_id` 중복 여부를 먼저 확인한다.

```sql
select raw_post_id, count(*)
from public.content_items
group by raw_post_id
having count(*) > 1;
```

2. 중복이 없으면 `supabase/migrations/20260527_p2_briefing_fields.sql`을 실행한다.
3. `content_items`에 아래 필드가 생겼는지 확인한다.
   - `summary_short_ko`
   - `summary_detail_ko`
   - `briefing_status`
   - `review_reason`
4. 기존 `summary_ko`, `news_type` 값이 신규 필드로 backfill됐는지 확인한다.
5. collector를 한 번 수동 실행하고 신규 row가 새 필드를 채우는지 확인한다.

## Source Seed 예시

아래 예시는 형식 확인용이다. 실제 운영 전 계정 handle과 수집 권한을 확인한다.

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

## Alias 유지보수 기준

- `team_aliases.entity_type`은 `club`, `player`, `manager`, `journalist_hint`, `keyword` 중 하나로 둔다.
- 선수/감독 alias는 현재 대상 팀과 연결이 명확할 때만 `active=true`로 둔다.
- 이적, 임대 종료, 감독 교체 등으로 연결이 오래되면 삭제하지 않고 `active=false`로 바꾼다.
- 비활성화 사유는 `notes`에 적고, 마지막 확인일은 `last_verified_at`에 남긴다.
- alias가 한 대상 팀으로 명확히 연결되면 자동 발행 후보로 둘 수 있다. alias가 오래됐거나 여러 팀으로 해석될 수 있으면 검수 큐로 보낸다.

## 종료 조건

- 새 Supabase 프로젝트에 스키마를 실행할 수 있다.
- 기존 row를 삭제하지 않고 업그레이드할 수 있다.
- API 코드와 문서가 같은 필드명을 사용한다.
- 같은 `raw_post_id`가 중복 row를 만들 수 없다.
