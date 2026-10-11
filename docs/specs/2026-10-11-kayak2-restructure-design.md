# kayak2 재구성 설계

- 날짜: 2026-10-11
- 상태: 검토 대기
- 원본: Kayak `main` f4b6604 (PR #38까지). `docs/ts-migration/issues.md`만 `feat/svelte-playground` 1a027db의 것(#21 포함)을 쓴다.

## 1. 목적

Kayak은 10년 된 텍스트 엔진이며 최근 TypeScript 전환(전체 strict)을 마쳤다. kayak2는 이 엔진을 새 저장소로 옮겨
앞으로의 작업 — 일관되고 쓰기 쉬운 공개 API 재설계, 다단 같은 전문 기능 추가 — 을 하기 좋은 구조로 만든다.
개발은 Claude Code로 AI를 활용해 하므로 저장소를 처음부터 AI가 읽고 검증하기 쉽게 구성한다.

Kayak 저장소는 그대로 둔다. 호스트(Edicus 등)는 API 재설계가 끝날 때까지 Kayak의 번들을 계속 받는다.

## 2. 범위

**이번 단계(이전)에 하는 것**
- 필요한 소스·테스트·픽스처·문서만 옮긴다. 공개 API와 렌더링 결과는 바꾸지 않는다.
- npm workspaces 구조, 최신 빌드 설정(ESM 출력 추가), ESLint, Volta로 Node 24 고정.
- AI 친화 구성: `AGENTS.md`, `.claude/`, `docs/`의 안내 문서와 페르소나.
- 쓰지 않는 의존성 삭제, 테스트용 jsdom 업그레이드(별도 커밋).

**하지 않는 것** (10절 로드맵)
- 공개 API 재설계, 전문 기능, 결함 수정(issues.md), seglayer 통합, 런타임 의존성 교체, Prettier 일괄 포맷, playground, 호스트 배포.

## 3. 저장소 구조

```
kayak2/
  AGENTS.md                   AI 작업 지시 원본
  CLAUDE.md                   "@AGENTS.md" 한 줄
  package.json                private, workspaces ["packages/*", "apps/*"], 루트 스크립트(check/test/build/lint/typecheck), volta(node 24)
  tsconfig.base.json          공통 컴파일 옵션
  eslint.config.js
  .gitattributes, .gitignore
  patches/                    opentype.js+1.3.4.patch (workspaces는 의존성을 루트 node_modules로 올리므로 루트에 둔다)
  .claude/
    settings.json
    agents/reviewer.md
    skills/{verify,update-snapshots,record-issue}/SKILL.md
  packages/kayak/
    AGENTS.md                 라이브러리 규칙
    package.json              name "kayak", private, exports, volta.extends → 루트 ("type" 필드 없음 — 5절)
    tsconfig.json             tsconfig.base.json 확장
    vite.config.ts            브라우저 번들 + vitest 설정
    vite.config.node.ts       Node 번들
    dts-bundle.config.json
    src/
      index.ts                브라우저 공개 진입점 (Kayak src/entry.ts)
      node.ts                 Node 공개 진입점 (Kayak src/entry_node.ts)
      types/                  외부 패키지 shim과 전역 선언 (Kayak src/types)
      engine/                 내부 구현. Kayak의 segment, geometry, textbox, css를 내부 구조 그대로
    test/
      engine/                 엔진 단위·특성 테스트
      snapshot/               렌더링 스냅샷 (동작 동일성의 기준)
      api/                    공개 진입점 테스트와 d.ts 소비자 픽스처
      fixtures/               샘플 json, 폰트
  apps/                       비워 둠 (.gitkeep). 새 playground 자리
  docs/
    architecture.md, glossary.md, personas.md, decisions.md, roadmap.md, issues.md
    usage/                    현재 API 사용 문서
    specs/, plans/
```

**경계의 이유.** 공개 API 재설계는 `src/api/`에 `engine/`을 감싸는 층으로 만들 예정이다.
진입점(`index.ts`, `node.ts`)만 공개 이름을 정하므로 엔진 내부 이름을 바꿔도 사용자가 깨지지 않는다.
재설계 중에는 지금 API를 `kayak/legacy` 하위 경로로 남길 수 있도록 package.json `exports`를 처음부터 쓴다.
테스트도 같은 경계로 나눠, API가 바뀌면 `test/api`와 스냅샷 헬퍼만 고치면 되게 한다.

## 4. 이전 대상

| Kayak | kayak2 | 비고 |
|---|---|---|
| `src/entry.ts` | `packages/kayak/src/index.ts` | import 경로만 고침 |
| `src/entry_node.ts` | `packages/kayak/src/node.ts` | 〃 |
| `src/types/` | `packages/kayak/src/types/` | |
| `src/{segment,geometry,textbox,css}/` | `packages/kayak/src/engine/{…}/` | 디렉터리째 옮기므로 내부 상대 import는 그대로 |
| `test/{segment,geometry,textbox}/` | `packages/kayak/test/engine/{…}/` | `__snapshots__` 함께 |
| `test/TB_*.test.js` (3개) | `packages/kayak/test/engine/textbox/` | |
| `test/entry.test.js` | `packages/kayak/test/api/` | |
| `test/dts/` | `packages/kayak/test/api/dts/` | |
| `test/snapshot/` | `packages/kayak/test/snapshot/` | `__snapshots__` 함께, 내용 수정 없음 |
| `test/kayak_json_samples/`, InDesign 샘플 중 테스트가 참조하는 것 | `packages/kayak/test/fixtures/` | 참조 여부는 grep으로 확인해 옮긴다 |
| `ngtester/src/assets/KoPubDotumMedium.ttf` | `packages/kayak/test/fixtures/fonts/` | 헬퍼 2곳의 경로 수정 |
| `patches/opentype.js+1.3.4.patch` | `patches/` | |
| `docs/usage/` | `docs/usage/` | 머리에 "현재(legacy) API 문서" 표시 |
| `docs/ts-migration/issues.md` | `docs/issues.md` | playground 브랜치 사본 |
| `.gitattributes` | `.gitattributes` | 스냅샷 줄바꿈 보존 |

**옮기지 않는 것**: `src/clipper-v6.4.2.2`(import하는 곳 없음), `src/geometry/TB_Test.js`, `src/textbox/TB_HtmlLineFactory.js`(빌드 범위 밖),
`playground/`, `ngtester/`, `components/`, `js/`, `server/`, `c++/`, `font-encode/`, 루트의 테스트용 html/js·json, gruntfile·bower·esdoc·`app.js`,
`COPY-TO-*.bat`(호스트 배포는 이번 범위 밖), `docs/superpowers/`(이전 이력. 필요한 결정은 `docs/decisions.md`에 요약).
parity 테스트와 `test/segment/legacy/`는 seglayer 통합의 안전망이라 **옮긴다**.

## 5. 빌드와 패키지

**출력** (`packages/kayak/dist/`)

| 파일 | 형식 | |
|---|---|---|
| `m1textbox.min.js` | UMD, 전역 `M1TextBox` | Kayak과 같음 |
| `m1textbox.mjs` | ESM | 신규. workspace 안의 앱과 앞으로의 소비자용 |
| `m1textbox_node.min.js` | UMD (Node) | Kayak과 같음 |
| `m1textbox.d.ts`, `m1textbox_node.d.ts` | dts-bundle-generator | Kayak과 같음 |

파일 이름을 바꾸지 않는 것은 나중에 호스트를 kayak2로 옮길 때 복사 대상 이름이 같도록 하기 위함이다.

**"type" 필드**: 루트 package.json만 `"type": "module"`(eslint.config.js 등 설정 파일용)이다. `packages/kayak`에는 두지 않는다. 두면 UMD 번들(`.js`)을 Node가 ESM으로 해석해 `require('kayak/node')`가 아무것도 내보내지 않는다. ESM 번들은 확장자 `.mjs`로 구분한다.

**exports**: `"."` → types `m1textbox.d.ts`, import `m1textbox.mjs`, default `m1textbox.min.js`; `"./node"` → types `m1textbox_node.d.ts`, default `m1textbox_node.min.js`.

**TypeScript**: 5.9, Kayak tsconfig의 옵션을 그대로 `tsconfig.base.json`으로 (strict, `useDefineForClassFields: false`, `moduleResolution: bundler`, shim `paths`).
**Vite 8 / Vitest 4**: Kayak 설정을 `.ts`로 옮긴다. define(`LOG_LEVEL`, `process.env.NODE_ENV`), `cssMinify: false`, `target: es2015` 유지.
**Node 24 LTS (Volta)**: 루트 package.json에 `volta pin node@24`로 정확한 버전을 고정한다. 하위 패키지(`packages/*`, 앞으로의 `apps/*`)는 `"volta": { "extends": "../../package.json" }`로 루트를 따른다. npm은 Node에 포함된 것을 쓴다. `engines`에도 `node >=24`를 적어 Volta가 없는 환경에서 알 수 있게 한다. (이 PC에 Volta 2.0.2가 있고 기본은 Node 20.20.2 — kayak2 안에서는 Volta가 고정된 Node 24를 자동으로 받아 쓴다)
**npm** workspaces. lockfile 커밋.

**ESLint 9** (flat config + typescript-eslint)
- `src/engine/**`: 지금 코드가 통과하는 수준으로 시작한다. recommended에서 위반이 있는 규칙은 끄고 규칙마다 이유를 주석으로 남긴다. 엔진 코드를 lint 때문에 고치지 않는다.
- 그 밖(`src/index.ts`, `src/node.ts`, 앞으로의 `src/api/**`, 설정 파일): recommended 전체.

**의존성**
- 런타임 유지: bezier-js, css-element-queries, events, he, immutable, lodash, loglevel, opentype.js, redux, redux-undo, shortid.
- 삭제: immer(import 없음). express·body-parser·pdfkit·grunt·should·diff·svelte·colorpicker·esdoc는 처음부터 가져오지 않는다.
- jsdom 11 → 최신: **별도 커밋**. 스냅샷이 바뀌면 멈추고 원인을 보고한다.

## 6. 검증 기준 (완료 조건)

1. 깨끗한 클론에서 `npm ci`가 성공하고 opentype.js 패치가 적용된다.
2. `npm run check`(typecheck + lint + test)가 통과한다. 테스트 수가 Kayak `main`과 같다.
3. 스냅샷 파일이 Kayak `main`과 바이트 단위로 같다. 테스트는 `-u` 없이, 새 스냅샷을 쓰지 않는 모드(`--ci`)로 통과해야 한다.
4. `npm run build`가 성공하고 `test/api/dts` 소비자 픽스처가 통과한다. 생성된 d.ts와 UMD 번들을 Kayak `main`의 것과 비교해, 차이가 있으면 모두 원인을 설명할 수 있어야 한다.
5. jsdom 업그레이드 뒤에도 3이 성립한다.
6. 새 Claude Code 세션에 kayak2만 열고 "구조를 설명하고 검사를 돌려라"라고 했을 때, `AGENTS.md`와 `docs/`만으로 해낸다.
7. 최종 리뷰를 reviewer 서브에이전트(Fable)로 받는다.

## 7. AI 친화 구성

**원칙.** 하네스가 자동으로 읽어 주는 것은 지시 파일뿐이다. 지시 파일은 짧은 규칙과 "어디를 읽을지"만 담고 세부는 문서로 뺀다.
확인은 명령 하나로 끝나야 한다. 프로젝트 결정은 개인 메모리가 아니라 저장소 문서에 둔다.

**`AGENTS.md`** (100줄 안팎) — 사용자가 말한 "agent.md"를 여러 AI 도구가 함께 쓰는 관례 이름으로 만든다. Claude Code는 `CLAUDE.md`의 `@AGENTS.md`로 읽는다.
1. 프로젝트 한 줄 설명과 사용자(사내 서비스 엔지니어)
2. 명령어: `npm run check`, 단일 테스트, 빌드
3. 폴더 지도와 경계 (`engine/` 내부, 진입점·`api/` 공개)
4. 반드시 지킬 규칙: 동작 변경과 구조 변경은 커밋을 나눈다 / 스냅샷은 이유 없이 갱신하지 않는다 / 공개 API 변경은 사람에게 묻는다 / 테스트는 네트워크를 쓰지 않는다 / 결과를 확인하기 전에 됐다고 말하지 않는다 / 결함을 발견하면 issues.md에 올린다
5. 개발 역할(페르소나 C)과 판단 기준 요약 → `docs/personas.md`
6. 문서별 "언제 읽나" 목록
7. 커밋·PR 규칙 (한국어 메시지)

**`packages/kayak/AGENTS.md`**: 진입점에서만 공개 이름을 정한다(`exportReferencedTypes: false`) / 엔진 수정은 특성 테스트 먼저 / 스냅샷 갱신 절차 / shim·`useDefineForClassFields` 같은 함정.

**`.claude/`**
- `settings.json`: 확인 명령(`npm run check|test|typecheck|lint|build`, git 조회)을 권한 허용 목록에. 훅은 두지 않는다(필요해지면 추가).
- `agents/reviewer.md`: 최종 리뷰어. `model: fable`. 기준은 동작 보존, 공개 API 영향, 페르소나 적합성, 검증 증거.
- `skills/verify`: check를 돌리고 실패를 해석하는 절차. `skills/update-snapshots`: 의도적 렌더링 변경 시 절차와 PR 본문 양식. `skills/record-issue`: issues.md 양식.

**`docs/`** — 문서마다 첫 줄에 "언제 읽나"를 둔다.
- `architecture.md`: 모듈 지도, 데이터 흐름(원고 → 속성 레이어(segment) → 줄 나눔·레이아웃 → SVG/DOM 렌더), 플랫폼 경계(브라우저/Node).
- `glossary.md`: 한국어 조판 용어 ↔ 코드 이름 (장평 = LetterScaleX, 자간 = LetterSpacing, 행간, 문단 속성 등).
- `personas.md`: 8절.
- `decisions.md`: 결정 기록. Kayak 시절 결정 중 유효한 것(공개 이름 최소화, 호스트 TS 버전 제약, 결함 처리 규칙, 동작/타입 변경 분리 등)과 이 문서의 결정.
- `roadmap.md`: 10절.

## 8. 페르소나

**주 페르소나 — 책 만들기 서비스를 만드는 사내 엔지니어** (kayak2의 직접 사용자. API·문서·오류 처리의 기준)

| | 하는 일 | 엔진에 바라는 것 |
|---|---|---|
| 에디터 엔지니어 (Edicus 등) | 브라우저에서 원고를 입력하고 꾸미는 편집 화면 | 조판을 몰라도 쓰는 API, 일관된 이름과 동작, 서식 상태 읽기·쓰기, 변경 이벤트, 되돌리기, 붙여넣은 원고 정리 |
| 출력·서버 엔지니어 (prepress, resource 등) | Node에서 InDesign 데이터 변환, 화면과 같은 출력 | 브라우저 없이 같은 결과, 폰트 로딩 실패가 오류로 드러남(무한 대기·`alert()` 없음), 예측 가능한 직렬화 형식 |

공통: 웹·서버 개발에 능숙하지만 조판 전문가는 아니다. 엔진 내부를 읽지 않고 타입과 문서로 쓴다.
사내 팀이므로 npm 공개 배포는 하지 않고, 깨지는 API 변경은 호스트 팀과 맞춰 옮긴다. 대신 변경은 `docs/decisions.md`와 변경 기록에 남긴다.

**배경 — 서비스의 고객, 책을 만드는 사람.** 원고를 꾸미고 레이아웃을 잡는다. 중심은 초보~고급 초반이다.
초보는 손대지 않아도 보기 좋은 기본값, 중급은 문단 스타일의 일관성, 고급 초반은 장평·커닝·글줄 경로 같은 세밀한 제어가 필요하다.
다단 같은 전문 기능도 추가할 예정이다.

**설계 원칙.** 단순한 일은 단순하게 — 기본값만으로 좋은 결과가 나와야 한다. 전문 기능은 선택해서 켜는 방식으로 얹고, 기본 API를 복잡하게 만들지 않는다.

**판단 순서.** ① 사내 엔지니어가 이 API를 쉽게, 틀리지 않게 쓸 수 있는가 → ② 그 엔지니어가 고객에게 필요한 기능을 만들 수 있는가.

**개발 역할 (AI).** 한글 조판 규칙, OpenType 폰트, SVG 렌더링을 아는 텍스트 엔진 엔지니어. 기존 동작을 지키고, 근거를 확인한 뒤 주장하며,
사용자에게 보이는 결정은 위 기준으로 판단하고, 공개 API는 묻고 바꾼다.

## 9. 진행 방식

구현 계획(`docs/plans/`)을 따로 쓰고 승인받은 뒤 실행한다. 큰 순서:
1. 준비: Volta로 Node 24 고정(`node -v` 확인), 저장소 뼈대(workspaces, tsconfig, vite/vitest, dts, patch-package).
2. 이전: 소스·테스트·픽스처 복사와 경로 수정. 커밋 메시지에 Kayak 원본 커밋 해시를 적는다.
3. 검증: 6절 1~4.
4. ESLint 도입, 의존성 정리, jsdom 업그레이드 (각각 커밋, 매번 스냅샷 확인).
5. AI 구성과 문서: `AGENTS.md`, `.claude/`, `docs/`.
6. 6절 6(새 세션 시험)과 7(최종 리뷰).

GitHub 원격 저장소는 지시가 있을 때 만든다.

## 10. 로드맵 (이번 범위 밖)

1. **공개 API 재설계** — `src/api/`, 지금 API는 `kayak/legacy`로 유지, 호스트 팀과 전환.
2. **전문 기능 (다단 등)** — 지금 레이아웃은 텍스트 상자 하나를 전제한다. 다단은 여러 영역으로 이어지는 흐름이 필요하므로, API 재설계 때 "영역/흐름" 개념이 들어갈 자리를 미리 고려한다.
3. seglayer/seglayer_par 통합 (parity 테스트 재사용 후 legacy 삭제).
4. issues.md 결함 수정.
5. 런타임 의존성 현대화: shortid → nanoid, css-element-queries 제거(ResizeObserver), redux/immutable 정리, lodash → lodash-es.
6. Prettier 일괄 포맷 (API 재설계 직전, 커밋 하나).
7. 새 playground (`apps/playground`).
8. 호스트 배포를 kayak2로 전환.

## 11. 결정 기록

| 결정 | 이유 |
|---|---|
| 새 git 저장소, 첫 이전 커밋에 Kayak 해시 기록 | 10년치 관련 없는 이력을 끌고 오지 않음. 원본은 Kayak에서 추적 가능 |
| npm workspaces (`packages/kayak` + `apps/`) | playground를 같은 저장소에 새로 만들 예정 |
| 이번 단계에서 호스트 배포 안 함 | API 재설계 뒤 한 번에 전환 |
| ESLint 지금, Prettier는 API 재설계 직전 | 일괄 포맷은 거의 모든 줄을 바꿈 |
| Node 24 LTS, Volta로 고정 | Node 20은 2026-04 지원 종료. Volta는 사용자가 쓰는 도구이고 폴더에 들어가면 버전이 자동으로 맞춰짐 |
| GitHub 원격은 지시가 있을 때 | 외부 작업 |
| 엔진/공개 API 폴더 분리, `exports` 사용 | API 재설계와 legacy 병행 |
| 출력 파일 이름 유지 + ESM 추가 | 호스트 전환 시 복사 이름 동일 |
| `AGENTS.md` 원본 + `CLAUDE.md` 가져오기 | 여러 AI 도구가 같은 지시를 씀 |
| 주 페르소나는 사내 서비스 엔지니어, 책 만드는 사람은 배경 | 사용자 지시 |

## 12. 위험과 대응

- **patch-package와 workspaces**: 의존성이 루트로 올라가므로 패치와 postinstall을 루트에 둔다. 1단계에서 패치 적용을 확인한다.
- **스냅샷의 경로 의존**: 스냅샷이나 헬퍼가 파일 경로를 담고 있으면 이동으로 깨진다. 스냅샷이 아니라 헬퍼를 고친다.
- **줄바꿈**: Windows에서 스냅샷 바이트 비교가 줄바꿈 때문에 어긋나지 않도록 `.gitattributes`를 그대로 가져온다.
- **jsdom 업그레이드**: 레이아웃 계산이 jsdom에 기대는 부분이 있어 스냅샷이 바뀔 수 있다. 별도 커밋으로 두고, 바뀌면 멈추고 보고한다.
- **Node 버전**: 하위 패키지에서 명령을 실행할 때 `volta.extends`가 빠지면 Volta가 기본 Node 20을 쓴다. 각 하위 package.json에 extends를 두고, 1단계에서 루트와 `packages/kayak` 양쪽의 `node -v`를 확인한다.
