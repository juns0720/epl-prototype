# P1 콘텐츠 계약

## 목표

AI 출력 형식을 고정해서 이후 단계가 추측 없이 동작하게 만든다.

이 단계에서 정렬할 대상:

- `content.md`
- `docs/ai-automation-guidelines.md`
- `api/_lib/ai.js`
- `supabase/schema.sql`
- `/admin` 표시 필드
- `/api/feed` 매핑

## 필수 AI 출력 계약

AI는 아래 형태의 구조화 JSON 하나만 반환해야 한다.

```json
{
  "is_target_relevant": true,
  "teams": ["MUN"],
  "decision": "publish",
  "confidence": 0.91,
  "review_reason": null,
  "is_informative": true,
  "requires_visual_context": false,
  "is_journalist_opinion": false,
  "team_resolution": "certain",
  "evidence": ["tweet text evidence"],
  "briefing": {
    "title": "한국어 제목",
    "summary_short": "한국어 2-3문장 요약",
    "summary_detail": "한국어 4-5문장 상세 요약",
    "tags": ["MUN"],
    "status": "OFFICIAL"
  },
  "entities": {
    "players": [],
    "clubs": [],
    "competitions": [],
    "journalists": []
  }
}
```

허용되는 `decision`:

- `publish`
- `review`
- `discard`

허용되는 `briefing.status`:

- `OFFICIAL`
- `RUMOUR`
- `UPDATE`
- `CONFIRMED`
- `DENIED`

## 한국어 브리핑 필수 규칙

- 사용자에게 보이는 모든 생성 문구는 한국어여야 한다.
- 원본 X 글에 명시된 사실만 사용한다.
- 팬 반응, 배경 설명, 출처 신뢰도 평가, 논쟁 구도, 감정 표현을 추가하지 않는다.
- 과장, 클릭베이트, 느낌표, 이모지를 쓰지 않는다.
- 확정되지 않은 내용은 추정/보도 표현으로 쓴다.

## 자동 발행 규칙

자동 발행은 오피셜 여부가 아니라 "대상 팀이 확실하고, 본문 텍스트만으로 전달할 정보가 있는가"를 기준으로 한다.

`decision=publish`는 아래 조건을 모두 만족할 때 가능하다.

- `is_target_relevant=true`
- `teams`에 대상 팀이 1개 이상 있다.
- 직접 팀명 또는 `team_aliases`로 팀이 확정되어 `team_resolution=certain`이다.
- 본문 텍스트만으로 전달할 정보가 있어 `is_informative=true`다.
- 이미지, 영상, 링크, 인용 글을 봐야 의미가 파악되는 글이 아니다.
- 기자 개인의 감상이나 의견이 중심인 글이 아니다.
- `briefing.status`는 `OFFICIAL`, `CONFIRMED`, `UPDATE`, `RUMOUR`, `DENIED` 모두 가능하다.
- `confidence >= 0.70`
- `review_reason=null`
- `evidence`가 원본 X 글의 텍스트 근거를 담고 있다.

그 외에는 `review` 또는 `discard`로 보낸다.

## 작업 목록

| ID | 작업 | 완료 조건 |
|---|---|---|
| P1-T1 | `content.md` 규칙을 `docs/ai-automation-guidelines.md`에 병합 | 가이드에 한국어 전용, 원 트윗 사실만, 추가 금지 표현, 배경 추가 금지 규칙이 명시됨 |
| P1-T2 | `api/_lib/ai.js`의 AI JSON 계약 수정 | 스키마에 nested `briefing` 객체가 포함됨 |
| P1-T3 | fallback classifier 출력 형태 수정 | Upstage Solar 키가 없어도 동일한 계약 형태를 반환함 |
| P1-T4 | 자동 발행 정책 수정 | 오피셜 여부가 아니라 팀 확정, 정보성, 미디어 의존 여부, 감상 여부를 사용함 |
| P1-T5 | feed/admin 매핑 수정 | UI가 title, short summary, detail summary, briefing status를 사용함 |
| P1-T6 | 팀 추론/분류 평가셋 추가 | 최소 8개 케이스가 직접 팀 언급, 선수만 언급, 감독만 언급, 추상 표현, 비대상 팀, 오피셜, 루머, 미디어 중심 글의 예상 team, decision, status를 명시함 |

## P1 평가셋

정식 평가셋은 `docs/ai-automation-guidelines.md`의 `평가셋` 섹션을 기준으로 한다. P1 완료 전 아래 범주가 모두 포함되어야 한다.

| 범주 | 기대 확인 |
|---|---|
| 직접 팀 언급 | 대상 6개 팀 직접 언급 시 해당 팀으로 태그된다. |
| 선수만 언급 | `team_aliases`에 있는 선수명으로만 팀을 추론할 수 있다. |
| 감독만 언급 | `team_aliases`에 있는 감독명으로 팀을 확정할 수 있으면 자동 발행 후보가 된다. |
| 추상 표현 | 대상 팀 가능성이 있어도 정보나 팀이 불확실하면 `review`가 된다. |
| 비대상 팀 | 레알, PSG 등 비대상 팀만 있으면 `discard`가 된다. |
| 오피셜 | 구단 공식 발표 또는 명확한 확정 표현은 자동 발행 후보가 된다. |
| 루머 | talks, interested, could, monitoring 등도 팀이 확실하고 정보가 있으면 자동 발행 후보가 된다. |
| 부인/무산 | denied, rejected, collapsed 등도 팀이 확실하고 정보가 있으면 자동 발행 후보가 된다. |
| 미디어 중심 | 사진/영상 중심이고 텍스트가 부족하면 검수 큐로 간다. |

## 종료 조건

- `npm run build` 통과.
- API 문법 검사 통과.
- 기존 mock 피드 fallback 유지.
- 직접 팀 언급, 선수만 언급, 감독만 언급, 추상 표현, 비대상 팀, 오피셜, 루머, 미디어 중심 글을 포함한 평가 케이스가 문서화됨.
