# packages/kayak — 라이브러리 규칙

> 루트 `AGENTS.md`의 규칙에 더해 이 패키지에서 지킬 것.

## 공개 표면

- 공개 이름은 `src/index.ts`(브라우저)와 `src/node.ts`(Node)의 export뿐이다. 타입은 각 파일 끝 `export type`에 적은 것만 d.ts에 이름으로 나간다(`dts-bundle.config.json`의 `exportReferencedTypes: false`). 내부 타입 이름을 바꿔도 사용자가 깨지지 않는다.
- `test/api/entry.test.js`가 export 이름 목록을, `test/api/dts/`의 소비자 픽스처가 d.ts를 고정한다(`npm run build`가 strict로 컴파일).
- 공개 타입에 TS 4.2+ 전용 기능을 쓰지 않는다(호스트 Edicus가 TS 3.8).
- 출력 파일 이름(`dist/m1textbox.min.js`, `m1textbox.mjs`, `m1textbox_node.min.js`, d.ts 2개)은 호스트가 복사하는 이름이라 바꾸지 않는다.

## 엔진(`src/engine`) 수정

- 고치기 전에 그 동작을 고정하는 테스트가 있는지 본다. 없으면 먼저 특성 테스트를 쓴다(`test/engine/textbox/helpers.js`의 가짜 tb, `test/snapshot/helpers.js`의 실제 textbox).
- 렌더링이 바뀌면 `test/snapshot`이 실패한다. 의도한 변경일 때만 갱신한다 → `.claude/skills/update-snapshots`.

## 함정

- `useDefineForClassFields: false`(`tsconfig.base.json`): 초기값 없는 class 필드 선언은 런타임 코드를 내지 않는다. 생성자 대입 순서와 schema 모드의 "속성 없음"이 여기에 기댄다. 끄지 않는다.
- `src/types/*.d.ts`는 타입 없는 패키지(opentype.js, bezier-js, loglevel, he)의 shim이다. tsconfig `paths`로 연결되며 Vite/Vitest는 paths를 무시한다(런타임은 실제 패키지). ambient가 아니라 모듈 파일이어야 d.ts 번들에 들어간다.
- 이 패키지에는 `"type"` 필드가 없다(UMD `.js` 번들이 CommonJS로 읽혀야 함). 그래서 Vite 설정은 `vite.config.mts`/`vite.config.node.mts`다. `.ts`로 바꾸면 CommonJS로 로드된다.
- opentype.js는 `patches/opentype.js+1.3.4.patch`(hasChar 수정)가 postinstall로 적용된 상태를 전제한다. 버전을 올리면 패치를 다시 확인한다.
- 의존성은 루트 `node_modules`로 올라간다. 이 패키지의 `node_modules`에 패키지가 생기면 버전 충돌을 의심한다(패치가 루트 사본에만 적용됨). `.vite`, `.vite-temp`(Vite/Vitest 캐시)만 있는 것은 정상이다.
- 런타임 의존성은 정확한 버전으로 고정돼 있고, shortid의 하위 nanoid는 루트 `overrides`로 2.0.3이다(`docs/decisions.md`).
- `test/engine/segment/legacy/`와 `parity_*.test.js`는 seglayer/seglayer_par 통합용 기준본이다. legacy 코드는 고치지 않고(lint도 제외), 통합이 끝나면 함께 지운다.
- 스냅샷 헬퍼는 shortid로 만든 id를 정규화하고, 모든 폰트 요청을 `test/fixtures/fonts/KoPubDotumMedium.ttf`로 돌린다. 폰트별 차이는 스냅샷에 나타나지 않는다.
- 테스트 환경은 jsdom 11이다. `transform` 같은 CSS 속성을 저장하지 않으므로 HTML 덤프에 나오지 않는다. jsdom을 올리면 스냅샷이 바뀐다(`docs/roadmap.md`).
