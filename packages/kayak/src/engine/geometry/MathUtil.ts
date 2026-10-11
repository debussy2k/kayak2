import type { Point, NearestPoint } from './types'

class MathUtil {

    static distance(x0: number, y0: number, x1: number, y1: number): number {
        let val = (x1-x0)**2 + (y1-y0)**2;
        return Math.sqrt(val);
    }

    static interpolate(x0: number, y0: number, x1: number, y1: number, t: number): Point {
        let x = t * x1 + (1-t) * x0;
        let y = t * y1 + (1-t) * y0;
        return {x:x, y:y}
    }

    static isInRange(p: number, from: number, to: number): boolean {
        let answer: boolean;
        if (to > from)
            answer = (from <= p && p <= to);
        else
            answer = (to <= p && p <= from)

        return answer;
    }

    // P to Line AB
    static getNearestPoint (P: Point, A: Point, B: Point): NearestPoint {
        let Tan: number, x: number, y: number;
        let C: Point;
        let t!: number;

        if (Math.abs(B.x - A.x) < 0.000000001) {
            C = {x:A.x, y:P.y}
        }
        else {
            Tan = (B.y - A.y) / (B.x - A.x);
            x = (P.x - Tan* (A.y - Tan*A.x - P.y) ) / (1 + Tan*Tan);
            y = Tan*x + A.y - Tan*A.x;
            C = {x:x, y:y}
        }

        let fNrstDist = Infinity;
        let fDistToA  = MathUtil.distance(P.x, P.y, A.x, A.y);
        let fDistToB  = MathUtil.distance(P.x, P.y, B.x, B.y);

        if (MathUtil.isInRange(C.x, A.x, B.x) && MathUtil.isInRange(C.y, A.y, B.y)) {
            fNrstDist = MathUtil.distance(P.x, P.y, C.x, C.y);
            t = MathUtil.distance(A.x, A.y , C.x, C.y) / MathUtil.distance(A.x, A.y ,B.x, B.y);
        }

        if (fDistToA < fNrstDist){
            C = {x:A.x, y:A.y}
            fNrstDist = fDistToA;
            t = 0;
        }
        if (fDistToB < fNrstDist)
        {
            C = {x:B.x, y:B.y}
            fNrstDist = fDistToB;
            t = 1;
        }
        return {
            x: C.x,
            y: C.y,
            t: t,
            d: fNrstDist
        }
    }

    static getAngle(dx: number, dy: number): number {
        var angle = Math.atan2(dy, dx);   //radians
        var degrees = 180*angle/Math.PI;  //degrees
        return (360+degrees)%360; //round number
    }

    static getSvgPathData_Line(x0: number, y0: number, x1: number, y1: number): string {
        return `M${x0} ${y0} L${x1} ${y1}`;
    }
}

export { MathUtil }