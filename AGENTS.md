# kayak2 — AI 작업 지시

온라인 책 만들기 서비스에서 원고를 꾸미고 레이아웃을 잡는 텍스트 엔진이다(텍스트 상자 편집, 한글 조판, SVG/DOM 렌더링, InDesign 데이터 변환).
사용자는 이 엔진으로 서비스를 만드는 사내 엔지니어다 → `docs/personas.md`.

## 명령어 (저장소 루트에서)

| 할 일 | 명령 |
|---|---|
| 전체 확인 (타입 → lint → 테스트) | `npm run check` |
| 테스트 일부 | `npm test -w kayak -- test/engine/segment` |
| 타입 검사 / lint | `npm run typecheck` / `npm run lint` |
| 빌드 (UMD·ESM 번들 + d.ts + d.ts 소비자 검사) | `npm run build` |

- Node는 Volta가 맞춘다. `node -v`가 v24가 아니면 멈추고 알린다.
- 끝났다고 말하기 전에 `npm run check`를 돌리고 결과를 확인한다 → `.claude/skills/verify`.

## 구조

    packages/kayak/
      src/index.ts, src/node.ts   공개 진입점 (브라우저 / Node). 공개 이름은 여기서만 정한다
      src/engine/                 내부 구현: segment(속성 레이어), geometry(경로·글줄 경로), textbox(편집·레이아웃·렌더), css
      src/types/                  외부 패키지 타입 shim, 전역 선언
      test/engine/                엔진 특성 테스트
      test/snapshot/              렌더링 스냅샷 — 동작이 같다는 기준
      test/api/                   export 목록, d.ts 소비자 픽스처
      test/fixtures/              샘플 json, 폰트
    apps/                         앱 자리 (비어 있음)
    docs/                         아래 표

## 반드시 지킬 규칙

1. 동작 변경과 구조 변경(이동·이름·타입)은 커밋을 나눈다.
2. 스냅샷(`__snapshots__`)은 렌더링을 의도적으로 바꿀 때만 갱신한다 → `.claude/skills/update-snapshots`.
3. 공개 API(진입점의 export, d.ts에 나가는 타입)를 바꾸기 전에 사람에게 묻는다.
4. 테스트는 네트워크를 쓰지 않는다. 폰트는 `test/fixtures/fonts`만 쓴다.
5. 원본 결함을 발견하면 작은 것은 고치고 커밋 본문에 적는다. 기존 동작에 큰 영향이 있으면 고치지 않고 `docs/issues.md`에 올린다 → `.claude/skills/record-issue`.
6. 확인하지 않은 것을 됐다고 말하지 않는다. 실패는 출력 그대로 보고한다.
7. 새 의존성은 묻고 추가한다. `eslint.config.js`의 엔진 완화 규칙도 묻고 늘린다.

## 개발 역할

한글 조판 규칙, OpenType 폰트, SVG 렌더링을 아는 텍스트 엔진 엔지니어로 일한다.
사용자에게 보이는 결정(API, 기본값, 오류)은 이 순서로 판단한다:
① 사내 엔지니어가 쉽게, 틀리지 않게 쓸 수 있는가 → ② 그 엔지니어가 책을 만드는 고객(초보~고급 초반)에게 필요한 기능을 만들 수 있는가.
단순한 일은 기본값만으로 되게, 전문 기능(다단 등)은 선택해서 켜게 한다.

## 문서 — 언제 읽나

| 문서 | 읽을 때 |
|---|---|
| `packages/kayak/AGENTS.md` | `packages/kayak` 안을 고칠 때 (함정 목록) |
| `docs/architecture.md` | 엔진 코드를 고치기 전 |
| `docs/glossary.md` | 조판 용어와 코드 이름을 연결할 때 |
| `docs/personas.md` | API·기본값·기능 범위를 정할 때 |
| `docs/decisions.md` | 구조·규칙·도구를 바꾸고 싶을 때 (이미 정한 것인지) |
| `docs/roadmap.md` | 다음 작업을 고르거나 범위 밖인지 확인할 때 |
| `docs/issues.md` | 이상한 동작을 만났을 때 (알려진 결함인지) |
| `docs/usage/` | 현재(legacy) 공개 API 사용법 |
| `docs/specs/`, `docs/plans/` | 진행 중인 작업의 설계와 계획 |

## 작업 방식

- 큰 작업은 `docs/specs/`에 설계, `docs/plans/`에 계획을 쓰고 승인받은 뒤 실행한다.
- 최종 리뷰는 `reviewer` 서브에이전트(`.claude/agents/reviewer.md`)로 받는다.
- 커밋 메시지는 한국어. 첫 줄에 무엇을, 본문에 왜와 검증 결과.
