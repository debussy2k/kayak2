# 결정 기록

> 언제 읽나: 구조·규칙·도구를 바꾸고 싶을 때(이미 정한 것인지, 왜 그렇게 정했는지 확인). 새 결정을 하면 여기에 더한다.

형식: 날짜 — 결정. 이유.

## kayak2 재구성 (2026-10-11, 설계: docs/specs/2026-10-11-kayak2-restructure-design.md)

- 새 git 저장소로 시작하고 이전 커밋에 Kayak 원본 커밋(f4b6604)을 적는다. 10년치 관련 없는 이력을 끌고 오지 않기 위해. 원본 이력은 Kayak 저장소에 있다.
- npm workspaces. 라이브러리는 `packages/kayak`, 앱은 `apps/`(첫 앱을 만들 때 workspaces에 `"apps/*"` 추가).
- 엔진(`src/engine/`)과 공개 진입점(`src/index.ts`, `src/node.ts`)을 나눈다. 앞으로 API 재설계를 `src/api/`에 만들고 지금 API를 `kayak/legacy`로 병행하기 위해(둘 다 아직 없다 — `docs/roadmap.md` 1).
- 출력 파일 이름은 Kayak과 같게 두고 ESM(`m1textbox.mjs`)을 더한다. 호스트를 옮길 때 복사 이름이 같도록.
- `packages/kayak`에는 `"type": "module"`을 두지 않는다. UMD `.js` 번들을 Node가 ESM으로 해석하지 않도록. 그래서 Vite 설정 파일은 `vite.config.mts`, `vite.config.node.mts`로 ESM을 고정한다.
- Node 24 LTS를 Volta로 고정(루트 `volta.node` 24.21.0, 하위 패키지 `volta.extends`). Node 20은 2026-04 지원 종료.
- 런타임 의존성은 Kayak과 같은 정확한 버전으로 고정한다. shortid의 하위 nanoid도 루트 `overrides`로 2.0.3에 고정한다(새로 설치하면 2.1.11이 잡혀 번들 코드가 달라짐).
- ESLint는 지금, Prettier 일괄 포맷은 API 재설계 직전. 엔진·shim·테스트는 위반 규칙 14개를 끈 상태로 시작하고 lint 때문에 고치지 않는다(`eslint.config.js`에 규칙별 건수와 이유).
- 테스트 어설션은 vitest `expect`만 쓴다. Kayak의 `should`를 쓰던 `TB_Dom.test.js`는 같은 의미의 `expect`로 바꿨다.
- 이번 단계에서 호스트 배포는 하지 않는다. Kayak이 계속 공급하고 API 재설계 뒤 전환한다.
- 지시 파일은 `AGENTS.md`가 원본이고 `CLAUDE.md`가 가져온다. 여러 AI 도구가 같은 지시를 쓰도록.
- 주 페르소나는 사내 서비스 엔지니어, 책을 만드는 사람은 배경 고객(`docs/personas.md`).

## Kayak에서 이어지는 결정

- 2026-10-06 — 타입·구조 변경과 동작 변경은 한 커밋(PR)에 섞지 않는다. 회귀를 찾기 쉽게.
- 2026-10-06 — 작업 중 원본 결함을 발견하면 고친다. 기존 동작에 큰 영향이 있으면 고치지 않고 `docs/issues.md`에 올린다.
- 2026-10-06 — 렌더링 스냅샷(`test/snapshot`)이 동작 동일성의 기준이다. 의도한 변경일 때만 갱신하고 이유를 남긴다.
- 2026-10-06 — seglayer/seglayer_par 통합은 별도 작업으로, parity 테스트로 검증한다.
- 2026-10-07 — `useDefineForClassFields: false`. 생성자 대입 순서와 schema 모드의 "속성 없음"을 유지하기 위해.
- 2026-10-08 — d.ts의 공개 이름을 최소화한다(`exportReferencedTypes: false`, 진입점의 `export type`만). 내부 타입 이름을 바꿔도 호스트가 깨지지 않게.
- 2026-10-08 — 호스트 TypeScript 버전: Edicus 3.8, edicus-book 3.7, edicus-prepress 2.6, edicus-resource는 JS. 공개 타입에 TS 4.2+ 전용 기능을 쓰지 않는다.
- 2023-12-16 — opentype.js 1.3.4에 hasChar() 수정을 patch-package로 덧붙인다(1.3.4 릴리스에 upstream 수정이 빠져 있음).
- 2026-10-04 — IE11 지원 종료, 출력 문법 ES2015. jQuery 의존성 제거(`TextBox.$element` → `TextBox.element`).
- 테스트는 네트워크를 쓰지 않는다. 폰트는 저장소 안의 KoPubDotumMedium(재배포 허용)으로 대체한다.

## Kayak과의 동등성 (2026-10-11)

Kayak f4b6604를 빌드한 산출물과 비교했다.

- `m1textbox.d.ts`, `m1textbox_node.d.ts`: 바이트 같음.
- `m1textbox.min.js`, `m1textbox_node.min.js`: 다름. 원인은 두 가지였다. (1) shortid의 하위 nanoid 2.0.3 → 2.1.11(런타임 코드), (2) Vite 8.3.2가 허용하는 rolldown 1.2.12 → 1.2.13(minifier 출력). 둘 다 Kayak 버전으로 맞추면 바이트 같음을 확인했다. 폴더 구조, ESM 출력 추가, tsconfig `extends`, Node 20↔24는 하나씩 바꿔 보아 영향이 없었다.
- 결정: nanoid는 2.0.3으로 고정했다. rolldown은 빌드 도구 patch라 고정하지 않았다. 남은 차이는 minifier가 같은 코드를 다르게 접는 것(예: `if (…) { …; return; }` ↔ 삼항식)이며, 빌드된 `m1textbox_node.min.js`로 렌더링 스냅샷 19개(4 files)를 돌려 Kayak 스냅샷과 같음을 확인했다.
- exports: `require('kayak/node')`와 `import('kayak')`(→ `dist/m1textbox.mjs`)가 Kayak과 같은 export 이름(각 5개, 8개)을 준다.
- 테스트: 38 files / 531 tests (Kayak `test/`와 같은 수), Windows 깨끗한 클론에서도 통과. 스냅샷 92개 바이트 같음.

## 개발 의존성 업그레이드 (2026-10-11)

- @types/node 20.19.43 → 24.19.2: 적용.
- jsdom 11.7.0 → 30.1.2: 되돌림. 렌더링 스냅샷 14개와 platform_utils 테스트 2개가 실패한다. 스냅샷 차이는 HTML 덤프의 inline style뿐이다 — 새 jsdom(cssstyle)이 jsdom 11이 버리던 `transform`, `transform-origin`, `border`, `user-select`를 저장하고 `padding-left`/`height` 순서를 바꾼다. 나머지 1개는 legacy Edge UA 판별 테스트(기대 16, 실제 false, 원인 미확인). 스냅샷 갱신과 legacy Edge 경로 처리는 결정이 필요하다(`docs/roadmap.md` 6).
