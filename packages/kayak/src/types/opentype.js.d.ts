// opentype.js 1.3.4 (+ patches/opentype.js+1.3.4.patch의 hasChar)는 타입 선언을 제공하지 않는다.
// 이 프로젝트가 쓰는 API만 선언한다. Font/Glyph/Path는 3b(TB_SvgTextRender)에서 더 쓰므로 색인 시그니처를 남긴다.
// tsconfig.json의 paths가 'opentype.js'을 이 파일로 매핑한다 (Vite/Vitest는 paths를 무시하므로 런타임은 실제 패키지).
// ambient `declare module`이 아니라 모듈 파일이어야 dts-bundle-generator가 dist/m1textbox.d.ts에 인라인한다.
export interface BoundingBox { x1: number; y1: number; x2: number; y2: number }
export interface Path {
    commands: any[];
    toPathData(decimalPlaces?: number): string;
    /** 다른 Path(또는 command 배열)의 command를 이어 붙인다 */
    extend(path: Path | any[]): void;
    getBoundingBox(): BoundingBox;
    [key: string]: any;
}
export interface Glyph {
    index: number;
    name?: string;
    unicode?: number;
    advanceWidth?: number;
    getPath(x?: number, y?: number, fontSize?: number, options?: any, font?: Font): Path;
    getBoundingBox(): BoundingBox;
    [key: string]: any;
}
export interface RenderOptions { kerning?: boolean; features?: Record<string, boolean>; [key: string]: any }
export class Font {
    names: any;
    unitsPerEm: number;
    ascender: number;
    descender: number;
    tables: any;
    glyphs: { length: number; get(index: number): Glyph };
    /** patches/opentype.js+1.3.4.patch가 추가한 메서드 */
    hasChar(ch: string): boolean;
    charToGlyphIndex(ch: string): number;
    charToGlyph(ch: string): Glyph;
    stringToGlyphs(s: string, options?: RenderOptions): Glyph[];
    getPath(text: string, x: number, y: number, fontSize: number, options?: RenderOptions): Path;
    getPaths(text: string, x: number, y: number, fontSize: number, options?: RenderOptions): Path[];
    getAdvanceWidth(text: string, fontSize?: number, options?: RenderOptions): number;
    getKerningValue(left: Glyph, right: Glyph): number;
    /** Kayak 확장 — TB_FontManager.load_and_parse()가 붙인다 (합자 안전 여부) */
    __liga_safe?: boolean;
    /** Kayak 확장 — TB_GsubSafety.install_safe_string_to_glyphs()가 prototype에 붙인다 */
    __kayak_safe_string_to_glyphs?: boolean;
    [key: string]: any;
}
export function parse(buffer: ArrayBuffer, options?: { lowMemory?: boolean } | null): Font;
export function load(url: string, callback: (err: any, font?: Font) => void): void;
export function loadSync(path: string): Font;
const opentype: { parse: typeof parse; load: typeof load; loadSync: typeof loadSync; Font: typeof Font; Path: new () => Path };
export default opentype;
