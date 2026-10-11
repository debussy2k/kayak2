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
            emptyOutDir: false, // node 번들(vite.config.node.mts)과 같은 폴더를 쓴다
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
