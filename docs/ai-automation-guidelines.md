# EPL X AI 자동화 가이드라인

이 문서는 수집된 X 글을 AI가 어떻게 분류하고, 어떤 글을 자동 발행하며, 어떤 글을 검수 큐로 보내야 하는지 정의한다. 개발자는 `docs/plans/ai-automation/99-progress.md`에서 작업을 고른 뒤 이 문서를 기준 계약으로 확인한다.

## 대상 범위

자동화 대상 팀은 아래 6개뿐이다.

| 코드 | 팀 |
|---|---|
| `MUN` | 맨체스터 유나이티드 |
| `MCI` | 맨체스터 시티 |
| `LIV` | 리버풀 |
| `ARS` | 아스날 |
| `TOT` | 토트넘 |
| `CHE` | 첼시 |

대상 6개 팀과 연결되지 않는 글은 `discard`다. 레알 마드리드, 바르셀로나, PSG, 바이에른 뮌헨, 도르트문트, 인터 밀란, AC 밀란 등 비대상 팀만 포함된 글도 `discard`다.

## 팀 태깅 원칙

- 팀명이 직접 언급되면 해당 팀을 태그한다.
- 팀명이 없어도 선수, 감독, 별칭이 `team_aliases`에서 대상 팀과 명확히 연결되면 해당 팀을 태그한다.
- `team_aliases` 확인 후에도 팀을 확정할 수 없으면 자동 발행하지 않고 `review`로 보낸다.
- AI가 대상 팀을 추정했지만 로컬 팀명/alias 근거가 없으면 폐기하지 않고 `review`로 보낸다.
- 대상 팀 간 이적이면 현재 팀과 행선지 팀을 모두 태그할 수 있다.
- 비대상 팀에서 대상 팀으로 이적하는 내용이면 대상 팀만 태그한다.
- 대상 팀 선수가 행선지 없이 이탈, 방출, 부상, 계약, 거취로 언급되면 현재 소속 대상 팀을 태그한다.
- 선수/감독 alias가 오래됐거나 소속이 애매하면 자동 발행하지 않고 `review`로 보낸다.

## AI 출력 계약

AI는 항상 아래 구조의 JSON 하나만 반환해야 한다.

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
    "status": "RUMOUR"
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

- `OFFICIAL`: 구단 공식 발표, 선수 또는 구단이 직접 확인한 내용
- `CONFIRMED`: 신뢰도 높은 기자가 완료, 계약 체결, Here we go 등 확정적 표현을 쓴 내용
- `UPDATE`: 진행 상황, 일정 변화, 협상 업데이트
- `RUMOUR`: 관심, 접촉, 검토, 가능성, 협상 초기 단계
- `DENIED`: 부인, 결렬, 거절, 무산

보조 판단 필드:

- `is_informative`: 본문 텍스트만으로 전달할 정보가 있으면 `true`
- `requires_visual_context`: 이미지, 영상, 링크 카드, 인용 글을 봐야 의미가 파악되면 `true`
- `is_journalist_opinion`: 기자 개인의 감상, 평가, 농담, 반응이 중심이면 `true`
- `team_resolution`: 팀이 확실하면 `certain`, 불확실하면 `ambiguous`, 대상 팀 근거가 없으면 `none`

## 한국어 브리핑 규칙

사용자에게 보이는 모든 생성 문구는 한국어여야 한다.

반드시 지켜야 할 규칙:

- 원본 X 글에 명시된 사실만 사용한다.
- 번역체가 아니라 한국 스포츠 기사 톤으로 간결하게 쓴다.
- 확정되지 않은 내용은 "~로 알려졌다", "~로 전해진다", "~가능성이 있다"처럼 보도 표현을 쓴다.
- 제목은 사실 중심으로 짧게 쓴다.
- 짧은 요약은 2-3문장, 상세 요약은 4-5문장으로 쓴다.
- `briefing.title`, `briefing.summary_short`, `briefing.summary_detail`에는 각각 한글이 포함되어야 한다.
- 원문 영어를 `summary_short`나 `summary_detail`에 그대로 복사하지 않는다.
- 서버는 한글이 없는 브리핑 필드를 발견하면 한국어 fallback 문구로 바꾸고 자동 발행을 막는다.

금지되는 표현:

- 팬 반응, 기대감, 여론, 논쟁 구도
- 원문에 없는 배경 설명이나 맥락 추가
- 원문에 없는 인명, 시즌, 기록, 과거 감독/선수 이름
- `author_handle`만 보고 `~에 따르면`, `~보도에 따르면` 같은 출처 문구를 추가하는 문장
- 기자 신뢰도 평가
- 성공/실패/충격/대형/전격 같은 감정적 판단
- 클릭베이트, 느낌표, 이모지
- 이미지나 영상에만 있는 내용을 본 것처럼 단정하는 문장

팀명 한국어 표기는 아래를 기본으로 쓴다.

| 코드 | 표기 |
|---|---|
| `MUN` | 맨유 |
| `MCI` | 맨시티 |
| `LIV` | 리버풀 |
| `ARS` | 아스널 |
| `TOT` | 토트넘 |
| `CHE` | 첼시 |

## 자동 발행 정책

자동 발행은 오피셜 여부가 아니라 "대상 팀이 확실하고, 본문 텍스트만으로 전달할 정보가 있는가"를 기준으로 한다.

`decision=publish`는 아래 조건을 모두 만족할 때 허용한다.

- 직접 팀명 또는 `team_aliases`로 대상 6개 팀 중 1개 이상이 확정된다.
- 원문 텍스트만으로 이적, 계약, 부상, 라인업, 감독, 협상, 관심, 부인, 무산, 발표 등 전달할 정보가 있다.
- `briefing.status`가 `OFFICIAL`, `CONFIRMED`, `UPDATE`, `RUMOUR`, `DENIED` 중 하나다.
- 루머, 관심, 협상, 부인, 무산, 거절도 정보가 전달되면 자동 발행할 수 있다.
- `confidence >= 0.70`
- `review_reason=null`
- `evidence`에 원본 X 텍스트 근거가 1개 이상 있다.
- 이미지, 영상, 링크 카드, 인용 글을 봐야 의미가 파악되는 글이 아니다.
- 기자 개인의 감상이나 의견이 중심인 글이 아니다.
- 한국어 제목, 짧은 요약, 상세 요약이 정상 생성됐다.

하나라도 만족하지 못하면 `publish`를 막고 `review` 또는 `discard`로 보낸다.

## 검수 큐 정책

아래 글은 검수 큐로 보낸다.

- `team_aliases` 확인 후에도 팀이 확실하지 않은 글
- AI가 대상 팀 가능성을 말하지만 로컬 alias 근거가 부족한 글
- 이미지, 영상, 링크 카드, 인용 글을 봐야 의미가 파악되는 글
- 텍스트가 너무 짧거나 `Soon`, `Watch this`, `Big news soon`처럼 전달 정보가 부족한 글
- 기자 개인의 감상, 평가, 농담, 반응이 중심인 글
- 한국어 브리핑이 영어로 나오거나 원문을 그대로 복사한 글
- Upstage Solar 호출 실패나 환경변수 누락으로 fallback classifier가 처리한 글
- 로컬 팀명/alias 근거가 있는데 Solar가 폐기 판단을 한 글

## 폐기 정책

아래 글은 저장하더라도 발행/검수 대상이 아닌 `discarded`가 된다.

- 대상 6개 팀과 연결되지 않는 글
- 비대상 팀만 포함된 글
- 일반 축구 잡담, 밈, 광고성 글
- 이미 처리된 같은 X 글
- 팀 추론 근거도 없고 AI도 대상 팀 관련성을 주장하지 않는 글

## Alias 유지보수 규칙

- 기자 X 계정은 사용자가 직접 `sources`에 등록한다.
- 선수, 감독, 별칭은 `team_aliases`에 수동 등록한다.
- alias는 현재 소속과 팀 연결이 명확할 때만 active 상태로 둔다.
- `CFC`, `LFC`, `MCFC`, `THFC`, `MUFC`처럼 짧은 영문 alias는 단어, 해시태그, 멘션 경계가 있을 때만 매칭한다.
- `City`, `United`, `AFC`, `Reds`, `Blues`처럼 여러 팀이나 일반 문장에 걸릴 수 있는 넓은 club alias는 active로 두지 않는다.
- `@TheAthleticFC`처럼 문자열 안에 `CFC`가 포함되는 경우는 첼시 근거로 보지 않는다.
- 이적, 감독 교체 등으로 alias가 오래되면 삭제하지 말고 `active=false`로 바꾼다.
- 비활성화 사유는 `notes`에 남기고, 마지막 확인 시점은 `last_verified_at`에 남긴다.
- 선수/감독 alias를 추가할 때는 해당 alias가 왜 특정 대상 팀으로 연결되는지 `notes`에 짧게 적는다.

## 평가셋

P1/P3 검증에서는 최소 아래 케이스를 사용한다. 실제 텍스트는 샘플이며, 기대값과 다른 결과가 나오면 AI 프롬프트나 alias를 수정한다.

| 케이스 | 입력 예시 | 기대 팀 | 기대 decision | 기대 status | 이유 |
|---|---|---:|---|---|---|
| 직접 팀 언급 오피셜 | `Manchester United officially announce new contract for Kobbie Mainoo.` | `MUN` | `publish` | `OFFICIAL` | 대상 팀 직접 언급과 공식 발표가 있음 |
| 직접 팀 언급 루머 | `Arsenal are in talks to sign a new striker this summer.` | `ARS` | `publish` | `RUMOUR` | 대상 팀이 명확하고 talks라는 정보가 전달됨 |
| 선수만 언급 | `Sesko deal could move this week.` | alias 기준 | `publish` | `RUMOUR` | alias가 한 대상 팀으로 확정되면 정보성 루머로 발행 가능 |
| 감독만 언급 | `Postecoglou has approved the club's plan for the next window.` | `TOT` | `publish` | `UPDATE` | 감독 alias로 팀이 확정되고 계획 승인 정보가 있음 |
| 추상 표현 | `Big decision expected soon around the winger's future.` | 없음 | `review` | `UPDATE` | 대상 팀 가능성이 있더라도 팀과 정보가 불확실함 |
| 비대상 팀 | `Real Madrid monitoring PSG winger before the summer window.` | 없음 | `discard` | `RUMOUR` | 대상 6개 팀과 연결되지 않음 |
| 확정 보도 | `Here we go, Chelsea have signed the documents for the transfer.` | `CHE` | `publish` | `CONFIRMED` | 확정적 표현과 대상 팀이 있음 |
| 미디어 중심 | `Soon.`과 사진 또는 영상만 포함 | 추론 가능 시 해당 팀 | `review` | `UPDATE` | 이미지/영상을 봐야 의미가 파악됨 |
| 부인/무산 | `Liverpool deny reports of an agreement for the player.` | `LIV` | `publish` | `DENIED` | 부인도 전달할 정보가 있으므로 발행 가능 |
| 기자 감상 | `I think Tottenham should walk away from this deal.` | `TOT` | `review` | `UPDATE` | 정보 전달보다 기자 개인 의견이 중심임 |
| 대상 팀 간 이적 | `Manchester City and Chelsea discussed a possible swap deal.` | `MCI`, `CHE` | `publish` | `RUMOUR` | 두 대상 팀이 모두 확실하고 협상 정보가 있음 |

## 관리자 검수 체크리스트

- 태그된 팀이 단순 상대팀이 아니라 글의 핵심 주체인지 확인한다.
- 팀명이 없을 경우 `team_aliases` 근거가 실제로 현재 소속과 맞는지 본다.
- 원문 텍스트만으로 제목과 요약을 만들 수 있는지 확인한다.
- 사진/영상 맥락을 AI가 임의로 본 것처럼 쓰지 않았는지 확인한다.
- 한국어 문구가 과장되거나 번역체이면 수정 후 승인한다.
- 부정확하거나 대상 팀과 무관하면 반려한다.
