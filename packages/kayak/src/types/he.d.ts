// he 1.1.1 (HTML entity encoder/decoder)은 타입 선언을 제공하지 않는다. decode/encode만 쓴다.
// tsconfig.json의 paths가 'he'을 이 파일로 매핑한다 (Vite/Vitest는 paths를 무시하므로 런타임은 실제 패키지).
// ambient `declare module`이 아니라 모듈 파일이어야 dts-bundle-generator가 dist/m1textbox.d.ts에 인라인한다.
interface He {
    decode(html: string, options?: { isAttributeValue?: boolean; strict?: boolean }): string;
    encode(text: string, options?: { useNamedReferences?: boolean; decimal?: boolean; encodeEverything?: boolean; strict?: boolean; allowUnsafeSymbols?: boolean }): string;
}
const he: He;
export default he;
