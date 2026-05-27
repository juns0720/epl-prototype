# EPL X AI 자동화 가이드라인

이 문서는 수집된 X 글을 AI가 어떻게 분류하고, 어떤 글만 자동 발행하며, 어떤 글을 검수 큐로 보내야 하는지 정의한다. 개발자는 `docs/plans/ai-automation/99-progress.md`에서 작업을 고른 뒤 이 문서를 기준 계약으로 확인한다.

## 대상 범위

자동화 대상 팀은 아래 6개뿐이다.

| 코드  | 팀                  |
| ----- | ------------------- |
| `MUN` | 맨체스터 유나이티드 |
| `MCI` | 맨체스터 시티       |
| `LIV` | 리버풀              |
| `ARS` | 아스날              |
| `TOT` | 토트넘              |
| `CHE` | 첼시                |

대상 6개 팀과 연결되지 않는 글은 모두 `discard`다. 레알 마드리드, 바르셀로나, PSG, 바이에른 뮌헨, 도르트문트, 인터 밀란, AC 밀란 등 비대상 팀만 포함된 글도 `discard`다.

## 팀 태깅 원칙

- 팀명이 직접 언급되면 해당 팀을 태그한다.
- 팀명이 없어도 선수, 감독, 별칭이 `team_aliases`에서 대상 팀과 명확히 연결되면 해당 팀을 태그한다.
- AI가 만든 팀 태그는 로컬 팀명/alias 매칭 근거가 있을 때만 인정한다.
- 로컬 팀명/alias 매칭 근거가 없으면 AI가 대상 팀을 추정해도 `discard`한다.
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

- `OFFICIAL`: 구단 공식 발표, 선수 또는 구단이 직접 확인한 내용
- `CONFIRMED`: 신뢰도 높은 기자가 완료, 계약 체결, Here we go 등 확정적 표현을 쓴 내용
- `UPDATE`: 진행 상황, 일정 변화, 협상 업데이트
- `RUMOUR`: 관심, 접촉, 검토, 가능성, 협상 초기 단계
- `DENIED`: 부인, 결렬, 거절, 무산

## 한국어 브리핑 규칙

사용자에게 보이는 모든 생성 문구는 한국어여야 한다.

반드시 지켜야 할 규칙:

- 원본 X 글에 명시된 사실만 사용한다.
- 번역체가 아니라 한국 스포츠 기사 톤으로 간결하게 쓴다.
- 확정되지 않은 내용은 "~로 알려졌다", "~로 전해진다", "~가능성이 있다"처럼 보도 표현을 쓴다.
- 제목은 사실 중심으로 짧게 쓴다.
- 짧은 요약은 2-3문장, 상세 요약은 4-5문장으로 쓴다.

금지되는 표현:

- 팬 반응, 기대감, 여론, 논쟁 구도
- 원문에 없는 배경 설명이나 맥락 추가
- 기자 신뢰도 평가
- 성공/실패/충격/대형/전격 같은 감정적 판단
- 클릭베이트, 느낌표, 이모지
- 이미지나 영상에만 있는 내용을 본 것처럼 단정하는 문장

## 자동 발행 정책

`decision=publish`는 아래 조건을 모두 만족할 때만 허용한다.

- `is_target_relevant=true`
- `teams`에 대상 6개 팀 중 1개 이상이 있다.
- `briefing.status`가 `OFFICIAL` 또는 `CONFIRMED`다.
- 원문 텍스트에 공식 발표, 계약 완료, 확정 보도, here we go 등 서버가 인정하는 명시적 확정 키워드가 있다.
- `confidence >= 0.85`
- `review_reason=null`
- `evidence`에 원본 X 텍스트 근거가 1개 이상 있다.
- 원문 텍스트만으로 의미가 충분하다.
- 사진, 영상, 짧은 캡션 중심 글이 아니다.

하나라도 만족하지 못하면 `publish`를 막고 `review` 또는 `discard`로 보낸다.

## 검수 큐 정책

아래 글은 검수 큐로 보낸다.

- 선수명 또는 감독명만 있고 팀 추론이 alias에 의존하는 글
- 대상 팀 여러 개가 등장하지만 핵심 팀이 불명확한 글
- 사진, 영상, 링크 카드가 핵심이고 텍스트가 짧은 글
- 요약을 만들기 위해 원문 밖 맥락이 필요한 글
- `briefing.status`가 `RUMOUR`, `UPDATE`, `DENIED`인 글
- Upstage Solar 호출 실패나 환경변수 누락으로 fallback classifier가 처리한 글
- 기자의 `Understand`, `sources say`, `clear stance`, `no intention`처럼 보도/입장 전달에 가까운 글은 Solar가 `OFFICIAL`로 판단해도 검수 큐로 보낸다.
- 로컬 팀명/alias 근거가 있는데 Solar가 폐기 판단을 해도 최종 폐기 전 검수 큐로 보낸다.

## 폐기 정책

아래 글은 저장하더라도 발행/검수 대상이 아닌 `discarded`가 된다.

- 대상 6개 팀과 연결되지 않는 글
- 비대상 팀만 포함된 글
- 일반 축구 잡담, 경기 감상, 밈, 광고성 글
- 이미 처리된 같은 X 글
- 팀 추론 근거가 없는 선수/감독 단독 언급

## Alias 유지보수 규칙

- 기자 X 계정은 사용자가 직접 `sources`에 등록한다.
- 선수, 감독, 별칭은 `team_aliases`에 수동 등록한다.
- alias는 현재 소속과 팀 연결이 명확할 때만 active 상태로 둔다.
- 이적, 감독 교체 등으로 alias가 오래되면 삭제하지 말고 `active=false`로 바꾼다.
- 비활성화 사유는 `notes`에 남기고, 마지막 확인 시점은 `last_verified_at`에 남긴다.
- 선수/감독 alias를 추가할 때는 해당 alias가 왜 특정 대상 팀으로 연결되는지 `notes`에 짧게 적는다.
- alias만으로 팀을 추론한 글은 `OFFICIAL` 또는 `CONFIRMED`라도 보수적으로 검수 큐로 보낼 수 있다.

## 평가셋

P1 검증에서는 최소 아래 케이스를 사용한다. 실제 텍스트는 샘플이며, 기대값과 다른 결과가 나오면 AI 프롬프트나 alias를 수정한다.

| 케이스            | 입력 예시                                                               |              기대 팀 | 기대 decision | 기대 status | 이유                                                           |
| ----------------- | ----------------------------------------------------------------------- | -------------------: | ------------- | ----------- | -------------------------------------------------------------- |
| 직접 팀 언급      | `Manchester United officially announce new contract for Kobbie Mainoo.` |                `MUN` | `publish`     | `OFFICIAL`  | 대상 팀 직접 언급과 공식 발표가 있음                           |
| 직접 팀 언급 루머 | `Arsenal are in talks to sign a new striker this summer.`               |                `ARS` | `review`      | `RUMOUR`    | 대상 팀이 명확하지만 talks는 루머                              |
| 선수만 언급       | `Sesko deal could move this week.`                                      |                `MUN` | `review`      | `RUMOUR`    | `Sesko -> MUN` alias가 있을 때만 팀 추론 가능하며 could는 루머 |
| 감독만 언급       | `Postecoglou has approved the club's plan for the next window.`         |                `TOT` | `review`      | `UPDATE`    | 감독 alias로 팀 추론하지만 원문 팀명이 없음                    |
| 추상 표현         | `Big decision expected soon around the winger's future.`                |                 없음 | `discard`     | `UPDATE`    | 대상 팀이나 alias 근거가 없음                                  |
| 비대상 팀         | `Real Madrid monitoring PSG winger before the summer window.`           |                 없음 | `discard`     | `RUMOUR`    | 대상 6개 팀과 연결되지 않음                                    |
| 확정 보도         | `Here we go, Chelsea have signed the documents for the transfer.`       |                `CHE` | `publish`     | `CONFIRMED` | 확정적 표현과 대상 팀이 있음                                   |
| 미디어 중심       | `Soon.`과 사진 또는 영상만 포함                                         | 추론 가능 시 해당 팀 | `review`      | `UPDATE`    | 텍스트 근거가 부족해 자동 발행 금지                            |
| 부인/무산         | `Liverpool deny reports of an agreement for the player.`                |                `LIV` | `review`      | `DENIED`    | 대상 팀이 있지만 발행 전 검수가 필요                           |
| 대상 팀 간 이적   | `Manchester City and Chelsea discussed a possible swap deal.`           |         `MCI`, `CHE` | `review`      | `RUMOUR`    | 대상 팀 둘 다 태그하지만 possible은 루머                       |

## 관리자 검수 체크리스트

- 태그된 팀이 단순 상대팀이 아니라 글의 핵심 주체인지 확인한다.
- `OFFICIAL` 또는 `CONFIRMED`가 정말 원문 텍스트로 확인되는지 본다.
- 원문 밖 정보가 제목이나 요약에 섞이지 않았는지 확인한다.
- 사진/영상 맥락을 AI가 임의로 본 것처럼 쓰지 않았는지 확인한다.
- 한국어 문구가 과장되거나 번역체이면 수정 후 승인한다.
- 부정확하거나 대상 팀과 무관하면 반려한다.
