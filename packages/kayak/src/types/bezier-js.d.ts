// bezier-js 2.2.5는 타입 선언을 제공하지 않는다 (@types/bezier-js는 4.x용).
// 이 프로젝트(src/geometry)가 실제로 호출하는 API만 선언한다.
// tsconfig.json의 paths가 'bezier-js'을 이 파일로 매핑한다 (Vite/Vitest는 paths를 무시하므로 런타임은 실제 패키지).
// ambient `declare module`이 아니라 모듈 파일이어야 dts-bundle-generator가 dist/m1textbox.d.ts에 인라인한다.
interface BezierPoint { x: number; y: number; z?: number }
interface BezierSplit { left: Bezier; right: Bezier; span: BezierPoint[] }

class Bezier {
    /** new Bezier(x0, y0, x1, y1, x2, y2, x3, y3) 또는 new Bezier(points) */
    constructor(...coords: number[]);
    constructor(points: BezierPoint[]);
    points: BezierPoint[];
    order: number;
    length(): number;
    get(t: number): BezierPoint;
    normal(t: number): BezierPoint;
    split(t1: number): BezierSplit;
    split(t1: number, t2: number): Bezier;
    extrema(): { x: number[]; y: number[]; values: number[] };
    offset(t: number, d: number): BezierPoint & { c: BezierPoint; n: BezierPoint };
    offset(d: number): Bezier[];
    project(point: BezierPoint): BezierPoint & { t: number; d: number };
}

export default Bezier;
