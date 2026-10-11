# kayak2 이전 구현 계획

> **실행 완료 (2026-10-11).** 이 문서는 실행 당시의 기록이다. scratchpad 경로, `C:\webdev\Kayak` 읽기 같은 지시는 그때의 작업용이며 지금 유효한 지시가 아니다. 실행 중 계획과 달리 정한 것과 결과는 `docs/decisions.md`에 있다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kayak `main`(f4b6604)의 엔진·테스트를 동작 변화 없이 `C:\webdev\kayak2`의 npm workspaces 저장소로 옮기고, AI가 읽고 검증하기 쉬운 구성(AGENTS.md, .claude/, docs/)을 갖춘다.

**Architecture:** `packages/kayak` 하나에 엔진(`src/engine/`)과 공개 진입점(`src/index.ts`, `src/node.ts`)을 나눠 둔다. 파일 이동과 import 경로 수정은 스크립트로 기계적으로 하고, 스냅샷 파일을 바이트 그대로 가져와 통과시키는 것으로 동작 동일성을 증명한다. 빌드 산출물(UMD 2개, d.ts 2개)은 Kayak과 비교한다.

**Tech Stack:** Node 24.21.0(Volta), npm 11 workspaces, TypeScript 5.9.3, Vite 8.3.2, Vitest 4.1.11, dts-bundle-generator 9.5.1, patch-package 8.0.1, ESLint 10 + typescript-eslint 8.

**Spec:** `docs/specs/2026-10-11-kayak2-restructure-design.md`

## Global Constraints

- 원본은 Kayak 커밋 **f4b6604**(`main`). `docs/issues.md`만 **1a027db**(`feat/svelte-playground`)의 `docs/ts-migration/issues.md`.
- `C:\webdev\Kayak`은 **읽기만** 한다. 체크아웃·브랜치·파일 수정 금지. 원본은 `git -c core.autocrlf=false -C C:/webdev/Kayak archive <커밋>`으로 꺼낸다.
- Node는 Volta로 루트에 `24.21.0` 고정, `packages/kayak`은 `"volta": { "extends": "../../package.json" }`.
- 루트 package.json만 `"type": "module"`. `packages/kayak`에는 `"type"` 필드를 두지 않는다.
- workspaces는 `["packages/*"]`. `apps/`는 README만 두고, 첫 앱을 만들 때 `"apps/*"`를 더한다(설계 문서 3절의 `apps/*`를 앱이 생길 때로 미룸 — 빈 폴더 glob 문제를 피하기 위함).
- 런타임 의존성은 Kayak lock과 **같은 정확한 버전**: bezier-js 2.2.5, css-element-queries 0.4.0, events 3.3.0, he 1.1.1, immutable 3.8.2, lodash 4.17.11, loglevel 1.6.1, opentype.js 1.3.4, redux 4.0.0, redux-undo 1.0.0-beta9-9-7, shortid 2.2.14.
- 개발 의존성(Task 1~5): typescript 5.9.3, vite 8.3.2, vitest 4.1.11, dts-bundle-generator 9.5.1, patch-package 8.0.1, jsdom 11.7.0, @types/lodash 4.17.25, @types/shortid 2.2.0, @types/node 20.19.43. (jsdom·@types/node 업그레이드는 Task 6에서만)
- 출력 파일: `dist/m1textbox.min.js`(UMD), `dist/m1textbox.mjs`(ESM), `dist/m1textbox_node.min.js`(UMD), `dist/m1textbox.d.ts`, `dist/m1textbox_node.d.ts`. 전역/UMD 이름 `M1TextBox`.
- 스냅샷 파일은 **어떤 Task에서도 갱신하지 않는다**(`-u` 금지). Task 6에서 바뀌면 되돌리고 보고한다.
- 기준 테스트 수: **38 files / 531 tests** (2026-10-11 Kayak의 `test/` 파일만 실행해 측정, 전부 통과. playground 테스트와 함께 돌렸을 때 `entry.test.js`가 5초 시간 초과로 1건 실패한 적이 있다).
- 커밋 메시지는 한국어, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 명령은 Git Bash 기준. `SCR`은 세션 scratchpad: `SCR=/c/Users/harry/AppData/Local/Temp/claude/c--webdev-Kayak/a433b3ee-19bd-404f-b16d-0e6e90d50622/scratchpad`.

## Review Focus

1. 하위 폴더에서 명령을 실행하면 Volta가 기본 Node 20을 쓸 수 있다 → `packages/kayak`에서도 `node -v`가 `v24.21.0`이어야 한다. (Task 1 Step 6)
2. 스냅샷 경로나 픽스처 경로가 틀리면 `toMatchFileSnapshot`이 새 파일을 쓰고 **통과해 버린다** → 테스트 뒤 `git status --porcelain`이 비어 있고 스냅샷 파일 수가 92개여야 한다. (Task 3 Step 8)
3. 샘플 폴더 경로가 틀리면 `kayak_json.test.js`가 테스트를 0개 만들고 통과한다 → 테스트 수가 정확히 531이어야 한다. (Task 3 Step 7)
4. Windows(autocrlf) 깨끗한 클론에서 스냅샷이 CRLF로 체크아웃되면 바이트 비교가 실패한다 → 새 클론에서 `npm ci && npm test`. (Task 4 Step 5)
5. `exports` 맵이 틀리면 `require('kayak/node')`·`import('kayak')`가 실패하거나 빈 객체를 준다 → 실제로 불러 export 이름을 확인. (Task 4 Step 4)

---

### Task 1: 저장소 뼈대 (workspaces, Volta, 의존성, 패치)

**Files:**
- Create: `C:/webdev/kayak2/package.json`, `.gitignore`, `.gitattributes`, `tsconfig.base.json`, `patches/opentype.js+1.3.4.patch`, `apps/README.md`
- Create: `packages/kayak/package.json`, `packages/kayak/tsconfig.json`

**Interfaces:**
- Produces: 루트 스크립트 `check`, `typecheck`, `lint`(Task 5에서 채움), `test`, `build`. 패키지 스크립트 `build`, `build:dev`, `build:types`, `check:types-dist`, `typecheck`, `test`, `test:watch`. 패키지 이름 `kayak`.

- [ ] **Step 1: `.gitattributes`, `.gitignore` 작성**

`C:/webdev/kayak2/.gitattributes`:
```
# patch-package 패치는 체크아웃 환경(core.autocrlf)과 상관없이 LF로 유지
patches/*.patch text eol=lf
# 스냅샷 파일은 vitest가 바이트 비교하므로 체크아웃 환경과 상관없이 LF로 유지
packages/*/test/**/__snapshots__/** text eol=lf
*.ttf binary
*.otf binary
```

`C:/webdev/kayak2/.gitignore`:
```
node_modules/
dist/
*.tsbuildinfo
/tmp
font_download/
```

- [ ] **Step 2: 루트 `package.json` 작성 후 Volta 고정**

```json
{
  "name": "kayak2",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "engines": { "node": ">=24" },
  "scripts": {
    "postinstall": "patch-package",
    "check": "npm run typecheck && npm run lint && npm test",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "echo \"lint: Task 5에서 설정\"",
    "test": "npm test --workspaces --if-present",
    "build": "npm run build --workspaces --if-present"
  },
  "devDependencies": {
    "patch-package": "8.0.1"
  }
}
```
Run: `cd /c/webdev/kayak2 && volta pin node@24.21.0`
Expected: package.json에 `"volta": { "node": "24.21.0" }`가 생긴다.

- [ ] **Step 3: `tsconfig.base.json` 작성**

```jsonc
{
    // 타입 검사만 한다 (noEmit). 트랜스파일은 Vite(esbuild/rolldown)가 맡는다. Kayak tsconfig에서 옮김.
    // useDefineForClassFields:false — 초기화자 없는 class 필드 선언(`x: T;`)은 런타임 코드를 내지 않는다.
    // 생성자 본문의 대입 순서와 "schema 모드에서는 속성이 없다" 같은 원본 동작을 유지하기 위함. 끄지 않는다.
    "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "lib": ["ES2020", "DOM", "DOM.Iterable"],
        "allowJs": true,
        "checkJs": false,
        "noEmit": true,
        "isolatedModules": true,
        "esModuleInterop": true,
        "allowSyntheticDefaultImports": true,
        "forceConsistentCasingInFileNames": true,
        "skipLibCheck": true,
        "strict": true,
        "useDefineForClassFields": false
    }
}
```

- [ ] **Step 4: `packages/kayak/package.json`, `packages/kayak/tsconfig.json` 작성**

`packages/kayak/package.json`:
```json
{
  "name": "kayak",
  "version": "2.0.0-alpha.0",
  "private": true,
  "license": "UNLICENSED",
  "author": "Harry Hyeonsoo Jung <harry@motion1.co.kr>",
  "description": "온라인 책 만들기 서비스용 텍스트 엔진 (텍스트 상자 편집, 한글 조판, SVG 렌더링)",
  "main": "./dist/m1textbox.min.js",
  "types": "./dist/m1textbox.d.ts",
  "exports": {
    ".": {
      "types": "./dist/m1textbox.d.ts",
      "import": "./dist/m1textbox.mjs",
      "default": "./dist/m1textbox.min.js"
    },
    "./node": {
      "types": "./dist/m1textbox_node.d.ts",
      "default": "./dist/m1textbox_node.min.js"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist"],
  "volta": { "extends": "../../package.json" },
  "scripts": {
    "build": "vite build && vite build -c vite.config.node.ts && npm run build:types",
    "build:dev": "vite build --mode development && vite build -c vite.config.node.ts --mode development",
    "build:types": "dts-bundle-generator --config dts-bundle.config.json && npm run check:types-dist",
    "check:types-dist": "tsc -p test/api/dts/tsconfig.json",
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "bezier-js": "2.2.5",
    "css-element-queries": "0.4.0",
    "events": "3.3.0",
    "he": "1.1.1",
    "immutable": "3.8.2",
    "lodash": "4.17.11",
    "loglevel": "1.6.1",
    "opentype.js": "1.3.4",
    "redux": "4.0.0",
    "redux-undo": "1.0.0-beta9-9-7",
    "shortid": "2.2.14"
  },
  "devDependencies": {
    "@types/lodash": "4.17.25",
    "@types/node": "20.19.43",
    "@types/shortid": "2.2.0",
    "dts-bundle-generator": "9.5.1",
    "jsdom": "11.7.0",
    "typescript": "5.9.3",
    "vite": "8.3.2",
    "vitest": "4.1.11"
  }
}
```

`packages/kayak/tsconfig.json`:
```jsonc
{
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
        "types": ["vite/client", "node"],
        // 타입 선언이 없는 패키지를 src/types의 shim으로 매핑한다. Vite/Vitest는 paths를 무시한다(런타임은 실제 패키지).
        // ambient `declare module`이 아니라 모듈 파일이어야 dts-bundle-generator가 d.ts에 인라인한다.
        "paths": {
            "opentype.js": ["./src/types/opentype.js.d.ts"],
            "bezier-js": ["./src/types/bezier-js.d.ts"],
            "loglevel": ["./src/types/loglevel.d.ts"],
            "he": ["./src/types/he.d.ts"]
        }
    },
    "include": ["src/**/*"]
}
```

- [ ] **Step 5: 패치와 `apps/README.md`를 넣고 설치**

```bash
cd /c/webdev/kayak2
mkdir -p patches apps
git -c core.autocrlf=false -C /c/webdev/Kayak show f4b6604:patches/opentype.js+1.3.4.patch > patches/opentype.js+1.3.4.patch
cat > apps/README.md <<'EOF'
# apps

kayak 라이브러리를 쓰는 앱(새 playground 등)을 둘 자리다. 첫 앱을 만들 때 루트 package.json의 `workspaces`에 `"apps/*"`를 더한다.
EOF
npm install
```
Expected: 설치 끝에 patch-package가 `opentype.js@1.3.4 ✔`를 출력한다. `package-lock.json`이 생긴다.

- [ ] **Step 6: Node 버전과 패치 적용 확인**

```bash
cd /c/webdev/kayak2 && node -v
cd /c/webdev/kayak2/packages/kayak && node -v
grep -c "charToGlyphIndex(c) > 0" /c/webdev/kayak2/node_modules/opentype.js/dist/opentype.js
ls /c/webdev/kayak2/packages/kayak/node_modules 2>/dev/null | head
```
Expected: 두 `node -v` 모두 `v24.21.0`. grep 결과 1 이상. `packages/kayak/node_modules`가 없거나 비어 있음(의존성이 루트로 올라감 — 패치가 루트 사본에 적용되었다는 뜻).
하나라도 다르면 멈추고 보고한다.

- [ ] **Step 7: 커밋**

```bash
cd /c/webdev/kayak2
git add .gitattributes .gitignore package.json package-lock.json tsconfig.base.json patches apps packages/kayak/package.json packages/kayak/tsconfig.json
git commit -F - <<'EOF'
저장소 뼈대: npm workspaces, Volta(Node 24.21.0), 의존성, opentype.js 패치

런타임 의존성은 Kayak f4b6604의 lock과 같은 정확한 버전으로 고정했다.
patches/opentype.js+1.3.4.patch는 Kayak f4b6604에서 그대로 가져왔다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: 소스 이전과 빌드 설정

**Files:**
- Create: `$SCR/import-from-kayak.mjs` (이전 스크립트, 저장소에 넣지 않음)
- Create: `packages/kayak/src/**` (Kayak `src/`에서 복사), `packages/kayak/vite.config.ts`, `packages/kayak/vite.config.node.ts`, `packages/kayak/dts-bundle.config.json`

**Interfaces:**
- Consumes: Task 1의 패키지 스크립트와 tsconfig.
- Produces: `packages/kayak/src/index.ts`(값 8개 + 타입 7개 export), `packages/kayak/src/node.ts`(값 5개 + 타입 7개), `src/engine/{segment,geometry,textbox,css}`, `src/types`. 이전 스크립트 사용법 `node $SCR/import-from-kayak.mjs <원본 폴더> <kayak2 루트> <src|test>` — Task 3도 쓴다.

- [ ] **Step 1: 원본을 scratchpad로 꺼낸다**

```bash
SCR=/c/Users/harry/AppData/Local/Temp/claude/c--webdev-Kayak/a433b3ee-19bd-404f-b16d-0e6e90d50622/scratchpad
rm -rf "$SCR/kayak-f4b6604" && mkdir -p "$SCR/kayak-f4b6604"
git -c core.autocrlf=false -C /c/webdev/Kayak archive f4b6604 | tar -x -C "$SCR/kayak-f4b6604"
ls "$SCR/kayak-f4b6604/src"
```
Expected: `clipper-v6.4.2.2 css entry.ts entry_node.ts geometry segment textbox types`

- [ ] **Step 2: 이전 스크립트 작성**

`$SCR/import-from-kayak.mjs`:
```js
// Kayak 원본 폴더의 파일을 kayak2 구조로 복사하고, 복사한 .ts/.js 안의 상대 import 경로를 새 위치에 맞게 고친다.
// 사용법: node import-from-kayak.mjs <원본 폴더> <kayak2 루트> <src|test>
import fs from 'node:fs';
import path from 'node:path';

const [, , SRC, DST, GROUP] = process.argv;
if (!SRC || !DST || !['src', 'test'].includes(GROUP)) {
    console.error('사용법: node import-from-kayak.mjs <원본 폴더> <kayak2 루트> <src|test>');
    process.exit(2);
}
const P = 'packages/kayak';

// Kayak 경로(저장소 기준, '/') → kayak2 경로. null = 의도적으로 옮기지 않음. undefined = 규칙 없음(옮기지 않고 보고).
const RULES = [
    [/^src\/clipper-v6\.4\.2\.2\//, null],
    [/^src\/geometry\/TB_Test\.js$/, null],
    [/^src\/textbox\/TB_HtmlLineFactory\.js$/, null],
    [/^src\/entry\.ts$/, `${P}/src/index.ts`],
    [/^src\/entry_node\.ts$/, `${P}/src/node.ts`],
    [/^src\/types\/(.+)$/, `${P}/src/types/$1`],
    [/^src\/(segment|geometry|textbox|css)\/(.+)$/, `${P}/src/engine/$1/$2`],
    [/^test\/(segment|geometry|textbox)\/(.+)$/, `${P}/test/engine/$1/$2`],
    [/^test\/(TB_[^/]+\.test\.js)$/, `${P}/test/engine/textbox/$1`],
    [/^test\/entry\.test\.js$/, `${P}/test/api/entry.test.js`],
    [/^test\/dts\/(.+)$/, `${P}/test/api/dts/$1`],
    [/^test\/snapshot\/(.+)$/, `${P}/test/snapshot/$1`],
    [/^test\/kayak_json_samples\/(.+)$/, `${P}/test/fixtures/kayak_json_samples/$1`],
    [/^test\/ind-json-conv-sample\/ind_textframe\.json$/, `${P}/test/fixtures/indesign/ind_textframe.json`],
    [/^test_data\/gradient-fill\/gradient-fill-indesign\.json$/, `${P}/test/fixtures/indesign/gradient-fill-indesign.json`],
    [/^ngtester\/src\/assets\/KoPubDotumMedium\.ttf$/, `${P}/test/fixtures/fonts/KoPubDotumMedium.ttf`],
    [/^test_data\/font-samples\/otf\/Museo500-Regular\.otf$/, `${P}/test/fixtures/fonts/Museo500-Regular.otf`],
    [/^dist\/(.+)$/, `${P}/dist/$1`],
];

function mapPath(rel) {
    for (const [re, to] of RULES) {
        if (re.test(rel)) return to === null ? null : rel.replace(re, to);
    }
    return undefined;
}

function walk(dir, base = dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) walk(abs, base, out);
        else out.push(path.relative(base, abs).split(path.sep).join('/'));
    }
    return out;
}

const all = walk(SRC);
const candidates = GROUP === 'src'
    ? all.filter(f => f.startsWith('src/'))
    : all.filter(f => f.startsWith('test/')).concat([
        'test_data/gradient-fill/gradient-fill-indesign.json',
        'ngtester/src/assets/KoPubDotumMedium.ttf',
        'test_data/font-samples/otf/Museo500-Regular.otf',
    ]);

const exists = new Set(all);
const EXTS = ['', '.ts', '.js', '.d.ts', '/index.ts', '/index.js'];

// 원본 파일 oldRel 안의 상대 지정자 spec을 새 위치 newRel 기준으로 바꾼다.
function rewriteSpec(oldRel, newRel, spec) {
    const [p, query] = spec.split('?');
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(oldRel), p));
    let newTarget, addedExt = '';
    if (target.startsWith('dist/')) {
        newTarget = mapPath(target);
    } else {
        const ext = EXTS.find(x => exists.has(target + x));
        if (ext === undefined) throw new Error(`${oldRel}: '${spec}'의 대상 파일이 원본에 없음`);
        addedExt = ext;
        newTarget = mapPath(target + ext);
        if (!newTarget) throw new Error(`${oldRel}: '${spec}'의 대상(${target + ext})이 옮기지 않는 파일`);
        if (addedExt) newTarget = newTarget.slice(0, -addedExt.length);
    }
    let r = path.posix.relative(path.posix.dirname(newRel), newTarget);
    if (!r.startsWith('.')) r = './' + r;
    return query === undefined ? r : `${r}?${query}`;
}

const SPEC_RE = /(\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+|<reference\s+path=)(['"])(\.{1,2}\/[^'"]*)\2/g;

let copied = 0, rewritten = 0;
for (const rel of candidates) {
    const to = mapPath(rel);
    if (to === null) { console.log(`제외  ${rel}`); continue; }
    if (to === undefined) { console.log(`규칙없음(옮기지 않음)  ${rel}`); continue; }
    const absTo = path.join(DST, to);
    fs.mkdirSync(path.dirname(absTo), { recursive: true });
    if (/\.(ts|js|mjs)$/.test(rel)) {
        const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
        const out = src.replace(SPEC_RE, (whole, kw, q, spec) => {
            const ns = rewriteSpec(rel, to, spec);
            if (ns !== spec) rewritten++;
            return `${kw}${q}${ns}${q}`;
        });
        fs.writeFileSync(absTo, out);
    } else {
        fs.copyFileSync(path.join(SRC, rel), absTo);
    }
    copied++;
}
console.log(`복사 ${copied}개, 경로 수정 ${rewritten}곳`);
```

- [ ] **Step 3: src 이전 실행**

```bash
node "$SCR/import-from-kayak.mjs" "$SCR/kayak-f4b6604" /c/webdev/kayak2 src
```
Expected: `제외`로 clipper 3개, TB_Test.js, TB_HtmlLineFactory.js가 찍히고 `규칙없음` 줄은 없다. 마지막 줄 `복사 N개`. 오류(throw)가 나면 멈추고 그 지정자를 보고한다.

- [ ] **Step 4: 진입점 확인**

Run: `cd /c/webdev/kayak2/packages/kayak && grep -nE "from |\?inline|reference path" src/index.ts src/node.ts`
Expected: `./engine/textbox/TextBox`, `./engine/segment/master_clipboard`, `./engine/css/base.css?inline`, `./engine/textbox/types`, `/// <reference path="./types/globals.d.ts" />`처럼 바뀌어 있다. 엔진 내부 파일은 상대 위치가 같으므로 `git diff --no-index`로 원본과 비교했을 때 import 줄이 바뀌지 않아야 한다:
```bash
for d in textbox segment geometry css; do echo "== $d"; diff -r "$SCR/kayak-f4b6604/src/$d" "src/engine/$d"; done
```
Expected: `== textbox` 아래 `Only in …: TB_HtmlLineFactory.js` 한 줄, `== geometry` 아래 `Only in …: TB_Test.js` 한 줄, segment·css는 출력 없음.

- [ ] **Step 5: 빌드 설정 작성**

`packages/kayak/vite.config.ts`:
```ts
// 브라우저용 번들: dist/m1textbox.min.js (UMD, 전역 M1TextBox) + dist/m1textbox.mjs (ESM)
//   npm run build       production (minify, LOG_LEVEL="warn")
//   npm run build:dev   development (minify 안 함, inline source map, LOG_LEVEL 미지정 = 전체 로그)
// Vitest 설정도 여기에 둔다.
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
    const prod = mode === 'production';
    return {
        define: {
            // redux 등이 참조한다. Vite는 process polyfill을 넣지 않으므로 치환한다.
            'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development'),
            ...(prod ? { LOG_LEVEL: JSON.stringify('warn') } : {}),
        },
        build: {
            // IE11 지원 종료 이후 기준. ES5가 다시 필요하면 Babel 출력 플러그인을 추가해야 함.
            target: 'es2015',
            outDir: 'dist',
            emptyOutDir: false, // node 번들(vite.config.node.ts)과 같은 폴더를 쓴다
            minify: prod,
            // CSS는 압축하지 않는다. Vite의 CSS minifier가 line-height 1.42857143을 1.42857로 반올림하고
            // -webkit-/-moz- keyframes 등을 지우는 등 내용이 바뀌기 때문.
            cssMinify: false,
            sourcemap: prod ? true : 'inline',
            lib: {
                entry: 'src/index.ts',
                name: 'M1TextBox',
                formats: ['umd', 'es'],
                fileName: (format) => (format === 'es' ? 'm1textbox.mjs' : 'm1textbox.min.js'),
            },
        },
        test: {
            include: ['test/**/*.test.{js,ts}'],
            environment: 'node',
        },
    };
});
```

`packages/kayak/vite.config.node.ts`:
```ts
// Node.js용 번들: dist/m1textbox_node.min.js (edicus-resource 등에서 require로 사용)
//   npm run build       production (minify, LOG_LEVEL="warn")
//   npm run build:dev   development
// npm 패키지는 모두 번들에 포함하고, fs 같은 Node 내장 모듈만 외부(require)로 남긴다.
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
    const prod = mode === 'production';
    return {
        define: prod ? {
            'process.env.NODE_ENV': JSON.stringify('production'),
            LOG_LEVEL: JSON.stringify('warn'),
        } : {},
        ssr: {
            target: 'node',
            noExternal: true,
        },
        build: {
            ssr: 'src/node.ts',
            target: 'es2015',
            outDir: 'dist',
            emptyOutDir: false, // 브라우저 번들(vite.config.ts)과 같은 폴더를 쓴다
            minify: prod,
            sourcemap: true,
            rollupOptions: {
                output: {
                    format: 'umd',
                    name: 'M1TextBox',
                    exports: 'named',
                    entryFileNames: 'm1textbox_node.min.js',
                    globals: { events: 'events' },
                },
            },
        },
    };
});
```

`packages/kayak/dts-bundle.config.json`:
```json
{
    "compilationOptions": { "preferredConfigPath": "./tsconfig.json" },
    "entries": [
        {
            "filePath": "./src/index.ts",
            "outFile": "./dist/m1textbox.d.ts",
            "libraries": { "inlinedLibraries": ["redux", "redux-undo"] },
            "output": { "umdModuleName": "M1TextBox", "noBanner": true, "exportReferencedTypes": false }
        },
        {
            "filePath": "./src/node.ts",
            "outFile": "./dist/m1textbox_node.d.ts",
            "libraries": { "inlinedLibraries": ["redux", "redux-undo"] },
            "output": { "umdModuleName": "M1TextBox", "noBanner": true, "exportReferencedTypes": false }
        }
    ]
}
```

- [ ] **Step 6: 타입 검사**

Run: `cd /c/webdev/kayak2 && npm run typecheck`
Expected: 오류 0. 오류가 나면 이동 때문인지(경로) 확인해 고친다. 타입 자체를 바꾸지 않는다.

- [ ] **Step 7: 번들 빌드 (d.ts 제외)**

`build:types`는 Task 3에서 `test/api/dts`가 생긴 뒤에 돈다. 여기서는 번들만 만든다.
```bash
cd /c/webdev/kayak2/packages/kayak && npx vite build && npx vite build -c vite.config.node.ts && npx dts-bundle-generator --config dts-bundle.config.json && ls -la dist
```
Expected: `m1textbox.min.js`, `m1textbox.mjs`, `m1textbox_node.min.js`, `m1textbox.d.ts`, `m1textbox_node.d.ts`와 각 `.map`이 생긴다.

- [ ] **Step 8: 커밋**

```bash
cd /c/webdev/kayak2
git add packages/kayak/src packages/kayak/vite.config.ts packages/kayak/vite.config.node.ts packages/kayak/dts-bundle.config.json
git commit -F - <<'EOF'
소스 이전: Kayak f4b6604의 src를 packages/kayak/src로

- src/{segment,geometry,textbox,css} → src/engine/ (내부 구조 그대로, 엔진 파일 내용 변경 없음)
- src/entry.ts → src/index.ts, src/entry_node.ts → src/node.ts (import 경로만 수정)
- 옮기지 않음: src/clipper-v6.4.2.2(import 없음), geometry/TB_Test.js, textbox/TB_HtmlLineFactory.js(빌드 범위 밖)
- Vite 설정을 .ts로 옮기고 브라우저 번들에 ESM 출력(dist/m1textbox.mjs)을 더함

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: 테스트·픽스처 이전

**Files:**
- Create: `packages/kayak/test/**` (스크립트로 복사)
- Modify (복사 후 손으로): `test/snapshot/helpers.js`, `test/snapshot/indesign_import.test.js`, `test/engine/textbox/helpers.js`, `test/engine/textbox/TB_GsubSafety.test.js`, `test/engine/segment/attr.test.js`, `test/api/entry.test.js`

**Interfaces:**
- Consumes: Task 2의 `import-from-kayak.mjs`, `src/index.ts`, `src/node.ts`.
- Produces: 픽스처 위치 `test/fixtures/{kayak_json_samples,indesign,fonts}/`. 헬퍼 상수 `ROOT`(= `packages/kayak`), `SAMPLE_DIR`, `TEST_FONT`.

- [ ] **Step 1: test 이전 실행**

```bash
node "$SCR/import-from-kayak.mjs" "$SCR/kayak-f4b6604" /c/webdev/kayak2 test
```
Expected: `규칙없음(옮기지 않음)`으로 `test/etc/…`, `test/ind-json-conv-sample/org/…`, `test/ind_json_samples/sample-01.json`만 찍힌다(모두 테스트가 참조하지 않음). 오류가 나면 멈추고 보고한다.

- [ ] **Step 2: 스냅샷 헬퍼의 경로 수정**

`packages/kayak/test/snapshot/helpers.js`에서 (ROOT는 `test/snapshot`의 두 단계 위 = `packages/kayak`로 그대로 맞다):
```js
export const SAMPLE_DIR = path.join(ROOT, 'test/kayak_json_samples');
```
→
```js
export const SAMPLE_DIR = path.join(ROOT, 'test/fixtures/kayak_json_samples');
```
그리고
```js
export const TEST_FONT = path.join(ROOT, 'ngtester/src/assets/KoPubDotumMedium.ttf');
```
→
```js
export const TEST_FONT = path.join(ROOT, 'test/fixtures/fonts/KoPubDotumMedium.ttf');
```

`packages/kayak/test/snapshot/indesign_import.test.js`:
```js
const IND_SAMPLES = [
    'test/ind-json-conv-sample/ind_textframe.json',
    'test_data/gradient-fill/gradient-fill-indesign.json',
];
```
→
```js
const IND_SAMPLES = [
    'test/fixtures/indesign/ind_textframe.json',
    'test/fixtures/indesign/gradient-fill-indesign.json',
];
```
(스냅샷 이름은 `path.basename`이라 바뀌지 않는다.)

- [ ] **Step 3: textbox 헬퍼, GsubSafety, attr 테스트의 경로 수정**

`packages/kayak/test/engine/textbox/helpers.js` (한 단계 깊어졌으므로 ROOT를 세 단계 위로):
```js
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const TEST_FONT = path.join(ROOT, 'ngtester/src/assets/KoPubDotumMedium.ttf');
```
→
```js
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const TEST_FONT = path.join(ROOT, 'test/fixtures/fonts/KoPubDotumMedium.ttf');
```

`packages/kayak/test/engine/textbox/TB_GsubSafety.test.js` — 작업 폴더 기준 상대 경로였던 것을 파일 기준으로:
```js
const FONT_WITH_LIGA = './test_data/font-samples/otf/Museo500-Regular.otf';
```
→
```js
const FONT_WITH_LIGA = fileURLToPath(new URL('../../fixtures/fonts/Museo500-Regular.otf', import.meta.url));
```
그리고 import 묶음 끝(`import * as gsub_safety …` 줄 위)에 `import { fileURLToPath } from 'url';`를 더한다.

`packages/kayak/test/engine/segment/attr.test.js`:
```js
            var seg_dir = path.resolve(__dirname, '../../src/segment');
```
→
```js
            var seg_dir = path.resolve(__dirname, '../../../src/engine/segment');
```

- [ ] **Step 4: entry 테스트의 시간 초과 여유**

`packages/kayak/test/api/entry.test.js`의 두 `it(…, async () => { … })` 각각의 닫는 `});`를 `}, 30_000);`로 바꾸고, `describe('entry', () => {` 위에 주석을 단다:
```js
// 진입점 동적 import는 엔진 전체를 변환하므로, 테스트를 많이 병렬로 돌릴 때 기본 5초를 넘긴 적이 있다(Kayak 2026-10-11).
```

- [ ] **Step 5: 남은 옛 경로 검사**

```bash
cd /c/webdev/kayak2/packages/kayak
grep -rnE "ngtester|test_data/|entry_node|src/entry|'\.\./\.\./src/(segment|geometry|textbox)|kayak_json_samples'\)|ind-json-conv-sample" test --include=*.js --include=*.ts
```
Expected: 출력이 주석뿐이다. 코드 줄이 나오면 고친다. 주석 속 옛 경로(예: `> npm test test/TB_InDesignJsonConverter.test.js`)는 새 경로로 고친다(`> npm test -w kayak -- test/engine/textbox/TB_InDesignJsonConverter.test.js`).

- [ ] **Step 6: 스냅샷 파일이 원본과 바이트 단위로 같은지 확인**

```bash
cd /c/webdev/kayak2/packages/kayak
diff -r "$SCR/kayak-f4b6604/test/snapshot/__snapshots__" test/snapshot/__snapshots__ && \
diff -r "$SCR/kayak-f4b6604/test/geometry/__snapshots__" test/engine/geometry/__snapshots__ && \
diff -r "$SCR/kayak-f4b6604/test/textbox/__snapshots__" test/engine/textbox/__snapshots__ && echo SAME
find test -path '*__snapshots__*' -type f | wc -l
find test -type f | sort > "$SCR/test-files-before.txt"
```
Expected: `SAME`, 그리고 `92`. (`test-files-before.txt`는 Step 8에서 쓴다.)

- [ ] **Step 7: 전체 테스트 실행**

Run: `cd /c/webdev/kayak2 && npm test`
Expected: `Test Files  38 passed (38)`, `Tests  531 passed (531)`. 수가 다르면(특히 적으면) 픽스처 경로가 틀려 테스트가 덜 만들어진 것이다 — 멈추고 원인을 찾는다.

- [ ] **Step 8: 새 스냅샷이 몰래 쓰이지 않았는지 확인**

아직 커밋 전이라 `git status`로는 알 수 없으므로, 테스트 전 파일 목록과 원본 스냅샷에 비교한다.
```bash
cd /c/webdev/kayak2/packages/kayak
find test -type f | sort | diff "$SCR/test-files-before.txt" - && echo "파일 목록 같음"
diff -r "$SCR/kayak-f4b6604/test/snapshot/__snapshots__" test/snapshot/__snapshots__ && diff -r "$SCR/kayak-f4b6604/test/geometry/__snapshots__" test/engine/geometry/__snapshots__ && diff -r "$SCR/kayak-f4b6604/test/textbox/__snapshots__" test/engine/textbox/__snapshots__ && echo "스냅샷 같음"
```
Expected: `파일 목록 같음`, `스냅샷 같음`. 새 파일이 보이면 그 테스트의 경로가 틀린 것이다.

- [ ] **Step 9: d.ts 소비자 픽스처까지 포함한 전체 빌드**

Run: `cd /c/webdev/kayak2 && npm run build`
Expected: 성공. 마지막에 `tsc -p test/api/dts/tsconfig.json`이 오류 없이 끝난다.

- [ ] **Step 10: 커밋**

```bash
cd /c/webdev/kayak2
git add packages/kayak/test
git commit -F - <<'EOF'
테스트 이전: Kayak f4b6604의 test와 픽스처를 packages/kayak/test로

- test/{segment,geometry,textbox}, test/TB_*.test.js → test/engine/
- test/entry.test.js, test/dts → test/api/
- test/snapshot → test/snapshot (스냅샷 92개 바이트 그대로)
- 픽스처를 test/fixtures/로 모음: kayak_json_samples, InDesign 샘플 2개(test_data/gradient-fill 포함), 폰트 2개(ngtester의 KoPubDotumMedium, test_data의 Museo500)
- TB_GsubSafety 테스트의 폰트 경로를 작업 폴더 기준에서 파일 기준으로 바꿈
- entry 테스트에 30초 시간 제한 (병렬 실행 부하에서 기본 5초 초과가 있었음)
- 결과: 38 files / 531 tests 통과 (Kayak과 같은 수)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Kayak과의 동등성 검증

커밋할 코드는 없다. 결과는 `$SCR/parity-report.md`에 적고 Task 7이 `docs/decisions.md`로 옮긴다. 차이가 설명되지 않으면 멈추고 보고한다.

**Files:**
- Create: `$SCR/parity-report.md`

**Interfaces:**
- Consumes: Task 2·3의 `packages/kayak/dist/*`.
- Produces: `$SCR/parity-report.md` (Task 7에서 사용). 형식: 파일별 `같음` / `다름 — 원인`.

- [ ] **Step 1: Kayak 기준 번들 빌드**

```bash
cd "$SCR/kayak-f4b6604" && npm ci && npm run build && npm run build_nodelib && ls dist
```
(Kayak에는 Volta 고정이 없어 기본 Node 20.20.2로 돈다. Kayak의 원래 빌드 환경과 같다.)
Expected: `m1textbox.min.js`, `m1textbox_node.min.js`, `m1textbox.d.ts`, `m1textbox_node.d.ts`.

- [ ] **Step 2: 산출물 바이트 비교**

```bash
K="$SCR/kayak-f4b6604/dist"; N=/c/webdev/kayak2/packages/kayak/dist
for f in m1textbox.min.js m1textbox_node.min.js m1textbox.d.ts m1textbox_node.d.ts; do
  if cmp -s "$K/$f" "$N/$f"; then echo "같음 $f"; else echo "다름 $f"; fi
done | tee "$SCR/parity-report.md"
```

- [ ] **Step 3: 다른 파일이 있으면 원인 확인**

d.ts: `diff -u "$K/m1textbox.d.ts" "$N/m1textbox.d.ts" | head -100`
JS 번들: 정렬해서 비교한다.
```bash
npx --yes prettier@3 --parser babel "$K/m1textbox.min.js" > "$SCR/k.js"
npx --yes prettier@3 --parser babel "$N/m1textbox.min.js" > "$SCR/n.js"
diff -u "$SCR/k.js" "$SCR/n.js" | head -200
```
각 차이의 원인을 `parity-report.md`에 한 줄씩 적는다(예: "모듈 경로 문자열 `src/textbox` → `src/engine/textbox`", "Node 버전 차이로 인한 …"). 원인을 설명할 수 없는 차이가 있으면 멈추고 보고한다.

- [ ] **Step 4: exports 맵으로 실제 불러오기**

```bash
cd /c/webdev/kayak2
node -e "const m=require('kayak/node'); console.log(Object.keys(m).sort().join(','))"
node --input-type=module -e "import { JSDOM } from 'jsdom'; globalThis.document = new JSDOM('<!DOCTYPE html><body></body>').window.document; console.log(import.meta.resolve('kayak')); const m = await import('kayak'); console.log(Object.keys(m).sort().join(','))"
```
(브라우저 번들은 불러올 때 `document`가 있으면 `<style>`을 넣으므로 `test/api/entry.test.js`처럼 jsdom document를 둔다.)
Expected:
- 첫 명령: `GT_MasterClipboard,TB_InDesignJsonConverter,TB_PlatformEnv,spFontManager,textbox`
- 둘째 명령: `…/packages/kayak/dist/m1textbox.mjs`로 끝나는 URL, 그리고 `GT_MasterClipboard,MeasureDiv,TB_FontSizeStepUtil,TB_InDesignJsonConverter,TB_NormalizedIME,TB_PlatformEnv,spFontManager,textbox`
결과를 `parity-report.md`에 덧붙인다. 다르면 멈추고 보고한다.

- [ ] **Step 5: Windows 깨끗한 클론에서 테스트**

```bash
rm -rf "$SCR/k2clone" && git clone -q /c/webdev/kayak2 "$SCR/k2clone"
cd "$SCR/k2clone" && npm ci && node -v && npm test 2>&1 | tail -4
```
Expected: `v24.21.0`, `38 passed`, `531 passed`. 결과를 `parity-report.md`에 덧붙인다.

---

### Task 5: ESLint 도입

**Files:**
- Create: `C:/webdev/kayak2/eslint.config.js`
- Modify: 루트 `package.json` (`lint` 스크립트, devDependencies)

**Interfaces:**
- Produces: `npm run lint`(루트). `npm run check`가 typecheck → lint → test를 모두 돈다.

- [ ] **Step 1: 설치**

```bash
cd /c/webdev/kayak2 && npm install -D eslint@10 @eslint/js@10 typescript-eslint@8 globals
```
`@eslint/js@10`이 없으면 `@eslint/js`를 eslint와 같은 메이저로 설치한다. 설치한 정확한 버전을 커밋 본문에 적는다.

- [ ] **Step 2: 엄격한 설정으로 위반 규칙 수집**

`eslint.config.js`를 다음으로 만든다(엔진 완화 블록은 아직 비어 있음):
```js
// ESLint flat config.
// 엔진(src/engine)·shim(src/types)·테스트는 Kayak에서 옮긴 코드라, 지금 위반하는 규칙을 끈 상태로 시작한다
// (설계 문서 5절: lint 때문에 엔진 코드를 고치지 않는다). 새 코드(진입점, 앞으로의 src/api)는 recommended 전체를 따른다.
// 엔진 완화 목록은 사람 승인 없이 늘리지 않는다.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig(
    { ignores: ['**/dist/**', '**/node_modules/**', 'packages/kayak/test/engine/segment/legacy/**'] },
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.browser, ...globals.node },
        },
    },
    {
        files: ['packages/kayak/src/engine/**', 'packages/kayak/src/types/**', 'packages/kayak/test/**'],
        rules: {
        },
    },
);
```
(`test/engine/segment/legacy/`는 비교 기준본이라 lint하지 않는다.)

규칙별 위반 수를 모은다:
```bash
cd /c/webdev/kayak2
npx eslint packages/kayak/src/engine packages/kayak/src/types packages/kayak/test -f json -o "$SCR/eslint-engine.json" ; \
node -e "const r=require(process.argv[1]);const c={};for(const f of r)for(const m of f.messages)c[m.ruleId||'(parse)']=(c[m.ruleId||'(parse)']||0)+1;console.log(Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([k,v])=>v+'\t'+k).join('\n'))" "$SCR/eslint-engine.json"
npx eslint packages/kayak/src/index.ts packages/kayak/src/node.ts packages/kayak/*.ts eslint.config.js
```
Expected: 첫 출력은 `건수<TAB>규칙` 목록. `(parse)`가 있으면 멈추고 보고한다(파서 설정 문제). 둘째 명령(새 코드 범위)은 위반 0이어야 한다. 위반이 있으면 그 파일만 고친다(진입점 두 파일의 주석 정리 정도여야 한다; export를 바꾸지 않는다).

- [ ] **Step 3: 엔진 완화 목록 채우기**

Step 2 목록의 규칙을 엔진 블록 `rules`에 모두 `'off'`로 넣고, 각 줄에 위반 수와 이유를 주석으로 단다. 형식:
```js
            // 412건 — 옛 코드 전반이 any를 씀. API 재설계 때 경계에서부터 줄인다.
            '@typescript-eslint/no-explicit-any': 'off',
```
이유는 위반 사례 2~3개를 열어 보고 사실대로 적는다.

- [ ] **Step 4: lint 스크립트 연결과 실행**

루트 package.json의 `"lint": "echo …"`를 `"lint": "eslint ."`로 바꾼다.
Run: `cd /c/webdev/kayak2 && npm run check`
Expected: typecheck 오류 0, lint 오류 0, `531 passed`.

- [ ] **Step 5: 커밋**

```bash
cd /c/webdev/kayak2
git add eslint.config.js package.json package-lock.json
git commit -F - <<'EOF'
ESLint 도입 (flat config + typescript-eslint)

엔진·shim·테스트는 현재 위반하는 규칙을 끈 상태로 시작한다(규칙마다 건수와 이유를 주석으로).
진입점과 설정 파일은 recommended 전체. npm run check = typecheck → lint → test.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: 개발 의존성 업그레이드 (jsdom, @types/node)

각각 따로 시도하고 따로 커밋한다. **스냅샷이 하나라도 바뀌면 그 업그레이드는 되돌리고**, 바뀐 파일 목록과 대표 diff를 `$SCR/upgrade-report.md`에 적어 보고한다(갱신 여부는 사용자가 정한다).

**Files:**
- Modify: `packages/kayak/package.json`, `package-lock.json`
- Create: `$SCR/upgrade-report.md`

**Interfaces:**
- Produces: `$SCR/upgrade-report.md` (Task 7에서 결정 기록에 사용).

- [ ] **Step 1: @types/node 24**

```bash
cd /c/webdev/kayak2 && npm install -D -w kayak @types/node@24 && npm run check
```
Expected: 통과. typecheck 오류가 나면 오류 목록을 `upgrade-report.md`에 적고 `git checkout -- packages/kayak/package.json package-lock.json && npm ci`로 되돌린 뒤 Step 3으로 간다.
통과하면 커밋:
```bash
git add packages/kayak/package.json package-lock.json
git commit -m "개발 의존성: @types/node 20 → 24 (Node 24 런타임에 맞춤)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: jsdom 최신**

```bash
cd /c/webdev/kayak2 && npm install -D -w kayak jsdom@latest && npm test 2>&1 | tail -30
```
Expected 둘 중 하나:
- 전부 통과(531) + `git status --porcelain packages/kayak/test`가 비어 있음 → `npm run check` 후 커밋:
  ```bash
  git add packages/kayak/package.json package-lock.json
  git commit -m "개발 의존성: jsdom 11.7.0 → <설치된 버전> (스냅샷 변화 없음)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```
- 스냅샷 실패 → 실패한 테스트 이름과 `npx vitest run` 출력의 대표 diff 3개를 `upgrade-report.md`에 적는다. (참고: `test/snapshot/helpers.js` 주석대로 jsdom 11의 cssstyle은 `transform`을 저장하지 않으므로, 새 jsdom에서는 HTML 덤프에 inline transform이 나타날 가능성이 크다.) 그 뒤 되돌린다:
  ```bash
  git checkout -- packages/kayak/package.json package-lock.json packages/kayak/test && git clean -fdq packages/kayak/test && npm ci
  npm test 2>&1 | tail -3
  ```
  Expected: 되돌린 뒤 다시 `531 passed`.

- [ ] **Step 3: 결과 정리**

`upgrade-report.md`에 두 업그레이드의 결과(커밋됨 / 되돌림 + 이유)를 적는다.

---

### Task 7: 문서 (README, docs/)

**Files:**
- Create: `C:/webdev/kayak2/README.md`, `docs/architecture.md`, `docs/glossary.md`, `docs/personas.md`, `docs/decisions.md`, `docs/roadmap.md`, `docs/issues.md`, `docs/usage/*.md`

**Interfaces:**
- Consumes: `$SCR/parity-report.md`(Task 4), `$SCR/upgrade-report.md`(Task 6), ESLint 완화 규칙 목록(Task 5).
- Produces: Task 8의 AGENTS.md가 링크하는 문서 이름들(위 Files 그대로).

모든 문서의 첫 줄 아래에 `> 언제 읽나: …` 한 줄을 둔다. 문서에 쓰는 코드 이름·경로는 모두 grep으로 존재를 확인한다.

- [ ] **Step 1: usage와 issues 가져오기**

```bash
cd /c/webdev/kayak2 && mkdir -p docs/usage
for f in README 01-getting-started 02-config 03-textbox-api 04-editing-and-style 05-helpers 06-recipes; do
  git -c core.autocrlf=false -C /c/webdev/Kayak show "f4b6604:docs/usage/$f.md" > "docs/usage/$f.md"
done
git -c core.autocrlf=false -C /c/webdev/Kayak show 1a027db:docs/ts-migration/issues.md > docs/issues.md
```
`docs/usage/README.md`의 제목 바로 아래에 넣는다:
```markdown
> 언제 읽나: 현재 공개 API(legacy)를 쓰거나 고칠 때.
> Kayak에서 옮겨 온 문서다. 공개 API 재설계 때 다시 쓴다. 문서 안의 `src/entry.ts`는 `packages/kayak/src/index.ts`, 빌드·배포 명령과 루트 README는 Kayak 기준이다.
```
`docs/issues.md`의 제목을 `# 알려진 결함 (백로그)`로 바꾸고 그 아래에 넣는다:
```markdown
> 언제 읽나: 이상한 동작을 만났을 때(알려진 결함인지), 결함을 고치거나 새로 올릴 때(`.claude/skills/record-issue`).
> #1~#21은 Kayak TypeScript 전환과 playground 작업 중 기록했다. 그 항목들의 경로는 Kayak 기준이다: `src/<dir>/…` → `packages/kayak/src/engine/<dir>/…`. #21이 언급하는 `playground/`는 kayak2에 없다.
```

- [ ] **Step 2: `docs/personas.md`**

```markdown
# 페르소나

> 언제 읽나: 공개 API, 기본값, 오류 처리, 기능 범위를 정할 때.

## 주 페르소나 — 책 만들기 서비스를 만드는 사내 엔지니어

kayak2의 직접 사용자다. API·문서·오류 처리는 이 사람을 기준으로 정한다.

| | 하는 일 | 엔진에 바라는 것 |
|---|---|---|
| 에디터 엔지니어 (Edicus 등) | 브라우저에서 원고를 입력하고 꾸미는 편집 화면을 만든다 | 조판을 몰라도 쓰는 API, 일관된 이름과 동작, 서식 상태 읽기·쓰기, 변경 이벤트, 되돌리기, 붙여넣은 원고 정리 |
| 출력·서버 엔지니어 (edicus-prepress, edicus-resource 등) | Node에서 InDesign 데이터를 변환하고 화면과 같은 출력물을 만든다 | 브라우저 없이 같은 결과, 폰트 로딩 실패가 오류로 드러남(무한 대기·`alert()` 없음), 예측 가능한 직렬화 형식 |

공통: 웹·서버 개발에 능숙하지만 타이포그래피·조판 전문가는 아니다. 엔진 내부 코드를 읽지 않고 타입과 문서만 보고 쓴다.
사내 팀이므로 npm 공개 배포는 하지 않는다. 깨지는 API 변경은 호스트 팀과 맞춰 옮기고, 변경은 `docs/decisions.md`에 남긴다.

## 배경 — 서비스의 고객, 책을 만드는 사람

원고를 꾸미고 레이아웃을 잡는다. 중심은 초보부터 고급 사용자 초반까지다. 엔진이 무엇을 지원하고 기본값을 어떻게 둘지의 근거로 쓴다.

| 수준 | 예 | 필요한 것 |
|---|---|---|
| 초보 | 처음 책을 만드는 개인 (자서전, 에세이, 여행기) | 손대지 않아도 보기 좋은 기본값, 자연스러운 한글 줄바꿈, 워드·한글에서 붙여넣은 원고의 깔끔한 정리, 마음 놓고 쓰는 되돌리기 |
| 중급 | 독립출판, 소책자, 사진책 | 제목·본문·인용 같은 문단 스타일의 일관성, 행간·자간·정렬·문단 간격 |
| 고급 초반 | 디자인 감각이 있고 InDesign을 조금 써 본 사람 | 장평·커닝·그림자·그라디언트·글줄 경로의 세밀한 제어, InDesign 데이터 호환 |

다단 같은 전문 기능도 추가할 예정이다(`docs/roadmap.md`).

## 설계 원칙

- 단순한 일은 단순하게: 기본값만으로 좋은 결과가 나와야 한다.
- 전문 기능은 선택해서 켜는 방식으로 얹는다. 기본 API를 복잡하게 만들지 않는다.

## 판단 순서

1. 사내 엔지니어가 이 API를 쉽게, 틀리지 않게 쓸 수 있는가.
2. 그 엔지니어가 고객(책 만드는 사람)에게 필요한 기능을 만들 수 있는가.

## 개발 역할 (AI)

한글 조판 규칙, OpenType 폰트, SVG 렌더링을 아는 텍스트 엔진 엔지니어로 일한다.
기존 동작을 지키고, 근거를 확인한 뒤 주장하며, 사용자에게 보이는 결정은 위 판단 순서로 정하고, 공개 API는 묻고 바꾼다.
```

- [ ] **Step 3: `docs/roadmap.md`**

```markdown
# 로드맵

> 언제 읽나: 다음 작업을 고를 때, 요청이 지금 범위 밖인지 확인할 때.

순서는 대략의 우선순위다. 각 항목은 시작할 때 `docs/specs/`에 설계를 쓴다.

1. **공개 API 재설계** — `src/api/`에 엔진을 감싸는 새 API를 만든다. 지금 API는 `kayak/legacy` 하위 경로로 남기고 호스트 팀과 전환한다. 기준은 `docs/personas.md`.
2. **전문 기능 (다단 등)** — 지금 레이아웃은 텍스트 상자 하나를 전제한다. 다단은 여러 영역으로 이어지는 흐름이 필요하므로 API 재설계 때 "영역/흐름" 개념이 들어갈 자리를 미리 고려한다.
3. **seglayer/seglayer_par 통합** — `test/engine/segment/parity_*.test.js`로 검증하고, 끝나면 `legacy/`와 함께 지운다.
4. **결함 수정** — `docs/issues.md`.
5. **런타임 의존성 현대화** — shortid → nanoid, css-element-queries 제거(ResizeObserver), redux/immutable 정리, lodash → lodash-es, lodash 4.17.11의 보안 패치 버전.
6. **Prettier 일괄 포맷** — API 재설계 직전, 커밋 하나로.
7. **새 playground** — `apps/playground`. 루트 workspaces에 `"apps/*"`를 더한다.
8. **호스트 배포 전환** — Edicus 등이 kayak2의 번들을 받도록. 출력 파일 이름은 Kayak과 같다.
```
Task 6에서 jsdom 업그레이드를 되돌렸다면 5번 뒤에 `5-1. **jsdom 업그레이드** — 스냅샷이 바뀜(upgrade-report 요약 한 줄). 바뀐 스냅샷을 검토하고 갱신할지 정한다.`를 더한다.

- [ ] **Step 4: `docs/decisions.md`**

아래 내용으로 만든다. 마지막 "Kayak과의 동등성" 절은 `$SCR/parity-report.md`, "개발 의존성 업그레이드" 절은 `$SCR/upgrade-report.md`의 내용을 요약해 채운다.
```markdown
# 결정 기록

> 언제 읽나: 구조·규칙·도구를 바꾸고 싶을 때(이미 정한 것인지, 왜 그렇게 정했는지 확인). 새 결정을 하면 여기에 더한다.

형식: 날짜 — 결정. 이유.

## kayak2 재구성 (2026-10-11, 설계: docs/specs/2026-10-11-kayak2-restructure-design.md)

- 새 git 저장소로 시작하고 이전 커밋에 Kayak 원본 커밋(f4b6604)을 적는다. 10년치 관련 없는 이력을 끌고 오지 않기 위해. 원본 이력은 Kayak 저장소에 있다.
- npm workspaces. 라이브러리는 `packages/kayak`, 앱은 `apps/`(첫 앱을 만들 때 workspaces에 `"apps/*"` 추가).
- 엔진(`src/engine/`)과 공개 진입점(`src/index.ts`, `src/node.ts`)을 나눈다. API 재설계는 `src/api/`에, 지금 API는 `kayak/legacy`로 병행하기 위해.
- 출력 파일 이름은 Kayak과 같게 두고 ESM(`m1textbox.mjs`)을 더한다. 호스트를 옮길 때 복사 이름이 같도록.
- `packages/kayak`에는 `"type": "module"`을 두지 않는다. UMD `.js` 번들을 Node가 ESM으로 해석하지 않도록.
- Node 24 LTS를 Volta로 고정(루트 `volta.node`, 하위 패키지 `volta.extends`). Node 20은 2026-04 지원 종료.
- ESLint는 지금, Prettier 일괄 포맷은 API 재설계 직전. 엔진 코드는 위반 규칙을 끈 상태로 시작하고 lint 때문에 고치지 않는다.
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

(parity-report 요약: 파일별 같음/다름과 원인, exports 확인, 깨끗한 클론 테스트 결과)

## 개발 의존성 업그레이드 (2026-10-11)

(upgrade-report 요약)
```
괄호 안 두 줄은 실제 요약으로 바꾼다(괄호 문장을 남기지 않는다).

- [ ] **Step 5: `docs/glossary.md`**

한국어 조판 용어 ↔ 코드 이름 표. 열: `용어 | 코드 이름 | 위치 | 설명`. 다음 항목을 반드시 포함하고, 각 행의 코드 이름과 위치는 grep으로 확인한다. 문단 속성의 실제 키 이름은 `src/engine/segment/ATTR_Par.ts`와 `docs/issues.md` #21의 키 목록(`align`, `findent`, `lindent`, `rindent`, `space_before`, `space_after`, `line_space`, `leading`)에서 확인한다.
- 글자 속성: 서체(ATTR_FontFamily), 글자 크기(ATTR_FontSize), 굵게(ATTR_Bold), 글자색(ATTR_FontColor), 자간(ATTR_LetterSpacing), 장평(ATTR_LetterScaleX), 외곽선(ATTR_Stroke), 그림자(ATTR_Shadow)
- 문단 속성(ATTR_Par): 정렬, 첫 줄 들여쓰기, 왼쪽·오른쪽 들여쓰기, 문단 앞·뒤 간격, 행간(line_space와 leading의 차이를 코드에서 확인해 적는다)
- 문서 속성(ATTR_Doc), 이름 붙은 범위(ATTR_NamedRange)
- 속성 레이어(seglayer, seglayer_par, seglayer_manager), 선택 범위(TB_SelRange), 되돌리기(TB_History)
- 글줄 경로(text on path, `src/engine/geometry/TB_TextOnPath*`), 양쪽 정렬(TB_JustificationService), 두부/대체 글자(TB_TofuService), 합자 안전성(TB_GsubSafety), 커닝(코드에서 kerning 옵션 위치 확인)
- kayak json(저장 형식, `saveAsJson`/`loadFromJson`), InDesign json(`TB_InDesignJsonConverter`), schema 모드(`docs/usage/02-config.md`), 거터(gutter)
문서 끝에 "InDesign의 Optical 커닝은 지원하지 않는다(Metrics만)"를 적는다(Kayak README Notices).

- [ ] **Step 6: `docs/architecture.md`**

다음 절을 쓴다. 각 절은 실제 코드를 읽고 쓰며, 언급하는 파일·클래스는 grep으로 확인한다.
1. **한눈에** — 엔진이 하는 일 3줄, 브라우저 번들과 Node 번들의 차이(`src/index.ts`가 `base.css`를 `<style>`로 넣음, Node는 jsdom window를 `TB_PlatformEnv.set`으로 받음).
2. **디렉터리 지도** — `src/engine/segment`(속성 레이어), `geometry`(경로·글줄 경로), `textbox`(편집·레이아웃·렌더, 하위 `ime/`, `inout/`, `layout_service/`, `services/`), `css`, `src/types`. 각 1~2줄과 대표 파일.
3. **데이터 흐름** — 원고(text_core) + 속성 레이어 → 단어·줄 나눔(TB_WordFetch/TB_LineComposer 등, 실제 이름 확인) → 레이아웃(TB_Layout) → SVG 렌더(TB_SvgTextRender/TB_SvgLineFactory) / DOM. 편집 입력 경로(TB_Input/TB_Keyboard/IME → TextBox_Edit → 적용). 저장·불러오기(TextBox_InOut, kayak json).
4. **공개 표면** — `textbox` 클래스와 `opEdit`/`opStyle`, 진입점의 값 8개·타입 7개, `exportReferencedTypes: false`.
5. **폰트와 메모리** — Kayak README의 "Memory management"와 "Font" 절 내용(`destroy()` → `TB_LocalFontLoader.destroy()` → `TB_FontManager.releaseFontResource()`, `spFontManager.clearFonts()`, kayak json의 `font_used`), Node에서의 폰트 경로(`TB_PlatformEnv`의 `get_font_filepath`).
6. **테스트 구성** — `test/engine`(특성 테스트, 가짜 tb), `test/snapshot`(jsdom 위 실제 textbox → HTML/SVG/JSON 덤프, shortid 정규화, 폰트 대체), `test/api`(export 목록, d.ts 소비자 픽스처), parity 테스트의 역할.
Kayak README 원문은 `git -C /c/webdev/Kayak show f4b6604:README.md`로 본다.

- [ ] **Step 7: 루트 `README.md`**

```markdown
# kayak2

온라인 책 만들기 서비스에서 원고를 꾸미고 레이아웃을 잡는 텍스트 엔진이다. 텍스트 상자 편집, 한글 조판, opentype.js 기반 SVG 렌더링, InDesign 데이터 변환을 브라우저와 Node에서 같은 결과로 한다.
Kayak(10년 된 원본, TypeScript 전환 완료)을 옮겨 왔다 — `docs/decisions.md`.

## 시작

[Volta](https://volta.sh)가 있으면 Node 24가 자동으로 맞춰진다.

    npm ci
    npm run check      # 타입 검사 + lint + 테스트
    npm run build      # packages/kayak/dist (UMD·ESM 번들, d.ts)

## 구조

    packages/kayak/    라이브러리 (src/index.ts·node.ts 공개 진입점, src/engine 내부 구현)
    apps/              앱 자리 (비어 있음)
    docs/              설계·결정·용어·페르소나·사용 문서

AI 도구로 작업한다면 [AGENTS.md](AGENTS.md)부터 읽는다.
```

- [ ] **Step 8: 검사와 커밋**

```bash
cd /c/webdev/kayak2
grep -rn "(parity-report\|(upgrade-report\|TODO\|TBD" docs README.md
```
Expected: 출력 없음.
```bash
git add README.md docs
git commit -F - <<'EOF'
문서: README, architecture, glossary, personas, decisions, roadmap, issues, usage

usage는 Kayak f4b6604, issues는 Kayak 1a027db(feat/svelte-playground)에서 가져왔다.
decisions에 Kayak과의 동등성 확인 결과와 개발 의존성 업그레이드 결과를 적었다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 8: AI 구성 (AGENTS.md, CLAUDE.md, .claude/)

**Files:**
- Create: `AGENTS.md`, `CLAUDE.md`, `packages/kayak/AGENTS.md`, `.claude/settings.json`, `.claude/agents/reviewer.md`, `.claude/skills/verify/SKILL.md`, `.claude/skills/update-snapshots/SKILL.md`, `.claude/skills/record-issue/SKILL.md`

**Interfaces:**
- Consumes: Task 7의 문서 이름, Task 1·5의 스크립트 이름.
- Produces: 서브에이전트 `reviewer`, 스킬 `verify`, `update-snapshots`, `record-issue`.

- [ ] **Step 1: `CLAUDE.md`**

```markdown
@AGENTS.md
```

- [ ] **Step 2: `AGENTS.md`**

```markdown
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
```

- [ ] **Step 3: `packages/kayak/AGENTS.md`**

```markdown
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

- `useDefineForClassFields: false`(tsconfig.base.json): 초기값 없는 class 필드 선언은 런타임 코드를 내지 않는다. 생성자 대입 순서와 schema 모드의 "속성 없음"이 여기에 기댄다. 끄지 않는다.
- `src/types/*.d.ts`는 타입 없는 패키지(opentype.js, bezier-js, loglevel, he)의 shim이다. tsconfig `paths`로 연결되며 Vite/Vitest는 paths를 무시한다(런타임은 실제 패키지). ambient가 아니라 모듈 파일이어야 d.ts 번들에 들어간다.
- opentype.js는 `patches/opentype.js+1.3.4.patch`(hasChar 수정)가 postinstall로 적용된 상태를 전제한다. 버전을 올리면 패치를 다시 확인한다.
- 의존성은 루트 `node_modules`로 올라간다. 이 패키지에 `node_modules`가 생기면 버전 충돌을 의심한다(패치가 루트 사본에만 적용됨).
- `test/engine/segment/legacy/`와 `parity_*.test.js`는 seglayer/seglayer_par 통합용 기준본이다. legacy 코드는 고치지 않고, 통합이 끝나면 함께 지운다.
- 스냅샷 헬퍼는 shortid로 만든 id를 정규화하고, 모든 폰트 요청을 `test/fixtures/fonts/KoPubDotumMedium.ttf`로 돌린다. 폰트별 차이는 스냅샷에 나타나지 않는다.
```

- [ ] **Step 4: `.claude/settings.json`**

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run check)",
      "Bash(npm run typecheck)",
      "Bash(npm run lint)",
      "Bash(npm run build)",
      "Bash(npm test)",
      "Bash(npm test:*)",
      "Bash(node -v)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git show:*)"
    ]
  }
}
```

- [ ] **Step 5: `.claude/agents/reviewer.md`**

```markdown
---
name: reviewer
description: kayak2의 작업 브랜치나 커밋 범위를 최종 리뷰한다. 계획의 마지막 단계나 merge 전에 쓴다. 동작 보존, 공개 API 영향, 페르소나 적합성, 검증 증거를 확인하고 코드는 고치지 않는다.
model: fable
tools: Read, Grep, Glob, Bash
---

너는 kayak2의 최종 리뷰어다. 코드를 고치지 않고 판정만 한다.

먼저 `AGENTS.md`, `packages/kayak/AGENTS.md`, `docs/personas.md`, `docs/decisions.md`, 그리고 리뷰 대상의 설계·계획 문서(`docs/specs/`, `docs/plans/`)를 읽는다.

확인할 것:
1. 동작 보존 — 구조 변경 커밋에 동작 변경이 섞였는가. 스냅샷이 바뀌었다면 이유가 커밋 본문에 있는가.
2. 공개 API — `src/index.ts`·`src/node.ts`의 export, d.ts에 나가는 타입이 바뀌었는가. 바뀌었다면 사람의 승인이 기록되어 있는가.
3. 페르소나 — 사용자에게 보이는 결정이 `docs/personas.md`의 판단 순서에 맞는가.
4. 검증 증거 — `npm run check`를 직접 돌려 결과를 본다. 보고된 결과와 다르면 지적한다.
5. 계획 대비 — 계획의 각 단계가 실제로 이루어졌는가, 빠진 것은 없는가.

출력: Critical / Important / Minor로 나눠 각 항목에 `파일:줄`, 무엇이 문제인지, 실제로 어떤 일이 생기는지(재현 조건)를 적는다. 추측은 추측이라고 표시한다. 문제가 없으면 없다고 쓴다.
```

- [ ] **Step 6: 스킬 3개**

`.claude/skills/verify/SKILL.md`:
```markdown
---
name: verify
description: kayak2에서 작업을 끝냈다고 말하기 전이나 커밋 전에 타입 검사·lint·테스트를 돌리고 실패를 해석한다.
---

# verify

1. 저장소 루트에서 `node -v`가 v24인지 본다. 아니면 멈추고 알린다(Volta 설정 문제).
2. `npm run check`를 돌린다(typecheck → lint → test, 앞이 실패하면 멈춤).
3. 실패를 이렇게 처리한다.
   - typecheck: 오류 위치를 고친다. `any`나 `@ts-ignore`로 덮지 않는다.
   - lint: 고친다. 규칙을 끄지 않는다. 엔진 완화 목록(`eslint.config.js`)은 사람 승인 없이 늘리지 않는다.
   - 스냅샷 불일치: 렌더링이 바뀐 것이다. 의도한 변경이 아니면 코드를 되돌린다. 의도했으면 `update-snapshots` 스킬.
   - 시간 초과: `npm test -w kayak -- <파일>`로 단독 실행해 부하 때문인지 확인하고 둘 다 보고한다.
4. 테스트 뒤 `git status --porcelain`으로 새로 생기거나 바뀐 스냅샷 파일이 없는지 본다. 있으면 테스트가 새 스냅샷을 몰래 쓴 것이다(경로 오류일 가능성이 크다).
5. 보고에는 통과·실패 수를 출력 그대로 적는다.
```

`.claude/skills/update-snapshots/SKILL.md`:
```markdown
---
name: update-snapshots
description: kayak2에서 렌더링이나 계산 결과를 의도적으로 바꿔 vitest 스냅샷을 갱신해야 할 때 쓴다.
---

# update-snapshots

1. 갱신 전에 실패한 스냅샷 diff를 읽고, 바뀐 부분이 모두 의도한 변경으로 설명되는지 확인한다. 설명되지 않는 차이가 하나라도 있으면 갱신하지 않는다.
2. 범위를 좁혀 갱신한다: `npm test -w kayak -- -u <테스트 파일 또는 폴더>`. 전체 `-u`는 쓰지 않는다.
3. `git diff --stat`으로 바뀐 스냅샷 파일이 예상한 것뿐인지 본다.
4. 동작 변경과 같은 커밋에 넣고 본문에 적는다:

       스냅샷 갱신: <파일/패턴>
       이유: <무엇이 왜 달라졌는가>
       확인: <diff에서 본 것>

5. 다시 `npm run check`.
```

`.claude/skills/record-issue/SKILL.md`:
```markdown
---
name: record-issue
description: kayak2 작업 중 원본 결함을 발견했는데 지금 고치지 않을 때(기존 동작 영향이 크거나 범위 밖) docs/issues.md에 올린다.
---

# record-issue

1. `docs/issues.md`에서 같은 결함이 이미 있는지 검색한다.
2. 번호는 마지막 번호 + 1. 파일 끝에 덧붙인다:

       ## #N <한 줄 요약> (<작업 이름> 중 발견)

       - 위치: `packages/kayak/src/engine/…:줄`
       - 재현: <입력·호출> → <실제 결과>
       - 기대: <기대 결과>
       - 영향: <누가 언제 겪는가 — 에디터 엔지니어/출력 엔지니어 기준>
       - 고치지 않은 이유: <동작 영향이 큼 / 범위 밖 / 결정 필요 등>

3. 재현은 실제로 돌려 본 것만 적는다. 못 돌렸으면 "재현 안 함"이라고 쓴다.
4. 커밋 본문이나 보고에 "issues.md #N 추가"를 적는다.
```

- [ ] **Step 7: 검사와 커밋**

```bash
cd /c/webdev/kayak2
wc -l AGENTS.md
for f in docs/architecture.md docs/glossary.md docs/personas.md docs/decisions.md docs/roadmap.md docs/issues.md docs/usage packages/kayak/AGENTS.md .claude/skills/verify/SKILL.md .claude/skills/update-snapshots/SKILL.md .claude/skills/record-issue/SKILL.md .claude/agents/reviewer.md; do test -e "$f" || echo "없음 $f"; done
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'));console.log('settings ok')"
npm run check 2>&1 | tail -4
```
Expected: AGENTS.md 100줄 안팎, `없음` 출력 없음, `settings ok`, check 통과.
```bash
git add AGENTS.md CLAUDE.md packages/kayak/AGENTS.md .claude
git commit -F - <<'EOF'
AI 구성: AGENTS.md(원본) + CLAUDE.md, 패키지 규칙, .claude(권한, reviewer 서브에이전트, verify·update-snapshots·record-issue 스킬)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 9: 새 세션 시험과 최종 리뷰

**Files:** 없음 (리뷰 지적을 고치면 해당 파일)

- [ ] **Step 1: 새 세션 시험 (설계 문서 6절 6)**

맥락 없는 서브에이전트(general-purpose)를 띄워 다음 프롬프트를 준다:
```
작업 폴더는 C:\webdev\kayak2 하나뿐이다. C:\webdev\Kayak을 포함해 다른 폴더는 읽지 마라.
이 저장소의 지시 파일과 문서만 보고 다음을 하라:
1. 이 프로젝트가 무엇이고 누가 쓰는지, 폴더 구조와 공개/내부 경계를 설명하라.
2. 전체 검사를 돌리고 결과(통과/실패 수)를 보고하라.
3. "글자 장평을 바꾸는 코드는 어디 있나"와 "스냅샷이 실패하면 어떻게 하나"에 답하라.
어떤 파일을 읽었는지 순서대로 적어라.
```
판정: AGENTS.md부터 읽었는가, `npm run check`를 찾아 돌렸는가(531 passed), 장평 → `ATTR_LetterScaleX`를 glossary로 찾았는가, 스냅샷 → update-snapshots 절차를 답했는가. 하나라도 못 했으면 그 원인이 된 문서를 고치고 커밋한 뒤 다시 시험한다.

- [ ] **Step 2: 최종 리뷰 (Fable)**

Agent 호출에 `model: "fable"`을 지정하고, `.claude/agents/reviewer.md` 본문과 함께 다음을 준다: 리뷰 범위(kayak2 첫 커밋부터 HEAD까지 전체), 설계 문서와 이 계획 경로, `$SCR/parity-report.md`·`$SCR/upgrade-report.md` 내용.
(현재 세션은 Kayak 폴더에서 시작했으므로 kayak2의 `.claude/agents`가 자동으로 불러와지지 않는다. 그래서 본문을 프롬프트로 넘긴다.)

- [ ] **Step 3: 리뷰 반영**

Critical·Important는 고치고 커밋한다. Minor는 고치거나 `docs/roadmap.md`/`docs/issues.md`에 올린다. 고친 뒤 `npm run check`.

- [ ] **Step 4: 사용자에게 보고**

보고할 것: 커밋 목록, 테스트 수, 동등성 결과(파일별), jsdom·@types/node 업그레이드 결과(되돌렸다면 결정 요청), ESLint 엔진 완화 규칙 수, 새 세션 시험 결과, 리뷰 결과와 반영 내역, 남은 결정(GitHub 원격 생성, jsdom 스냅샷 갱신 여부).
