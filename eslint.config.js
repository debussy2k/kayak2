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
            // 건수는 2026-10-11 Kayak f4b6604에서 옮긴 직후 기준.
            // 930건 — ES5 시절 코드가 var를 쓴다 (예: geometry/MathUtil.ts).
            'no-var': 'off',
            // 708건 — 다시 대입하지 않는 let. 기계적으로 고칠 수 있지만 엔진 코드를 lint 때문에 고치지 않는다.
            'prefer-const': 'off',
            // 269건 — TS 전환 때 타입을 정하지 못한 경계(ATTR_*의 데이터 객체 등)가 any다. API 재설계 때 경계부터 줄인다.
            '@typescript-eslint/no-explicit-any': 'off',
            // 226건 — 쓰지 않는 인자·변수 (콜백 시그니처를 맞춘 인자, 디버그용 변수 등).
            '@typescript-eslint/no-unused-vars': 'off',
            // 62건 — arguments를 그대로 넘기는 ES5 패턴 (예: cg.ts의 this.set.apply(this, arguments)).
            'prefer-rest-params': 'off',
            // 57건 — 선언 때 초기값을 넣고 곧바로 다시 대입 (예: let t = 0; 뒤에 t = …).
            'no-useless-assignment': 'off',
            // 49건 — `callback && callback(x)` 같은 단락 평가 문장 (예: seglayer.ts).
            '@typescript-eslint/no-unused-expressions': 'off',
            // 26건 — .apply로 인자 배열을 넘기는 ES5 패턴 (cg.ts).
            'prefer-spread': 'off',
            // 11건 — obj.hasOwnProperty(key) 직접 호출 (예: TB_RangeMetric.ts).
            'no-prototype-builtins': 'off',
            // 9건 — `let self = this` (예: TB_CanvasDraw.ts, TB_TextOnPath.ts).
            '@typescript-eslint/no-this-alias': 'off',
            // 2건 — 빈 블록 (TB_Path.ts, Textbox_Verify.ts).
            'no-empty': 'off',
            // 1건 — seglayer_manager.ts의 `if (true)` ("font 선택 기능을 만들기 전까지" 주석).
            'no-constant-condition': 'off',
            // 1건 — test/api/dts/global.ts는 UMD 전역 사용을 검사하려고 d.ts를 triple-slash로 참조한다 (의도).
            '@typescript-eslint/triple-slash-reference': 'off',
            // 1건 — test/snapshot/helpers.js 정규식의 불필요한 이스케이프.
            'no-useless-escape': 'off',
        },
    },
    {
        // dts-bundle-generator는 진입점의 import 그래프만 보므로 전역 선언 파일을 triple-slash로 알려 줘야 한다(진입점 파일 주석 참고).
        files: ['packages/kayak/src/index.ts', 'packages/kayak/src/node.ts'],
        rules: {
            '@typescript-eslint/triple-slash-reference': 'off',
        },
    },
);
