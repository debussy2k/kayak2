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
            emptyOutDir: false, // 브라우저 번들(vite.config.mts)과 같은 폴더를 쓴다
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
