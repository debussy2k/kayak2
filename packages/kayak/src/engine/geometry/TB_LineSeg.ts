import { MathUtil } from './MathUtil'
import type { Point, NearestPoint, Segment } from './types'

class TB_LineSeg {
	type: 'line';
	x0: number;
	y0: number;
	x1: number;
	y1: number;

	constructor(x0: number, y0: number, x1: number, y1: number) {
		this.type = 'line'

		this.x0 = x0;
		this.y0 = y0;
		this.x1 = x1;
		this.y1 = y1;
	}

	get p0(): Point {
		return {x:this.x0, y:this.y0}
	}
	get p1(): Point {
		return {x:this.x1, y:this.y1}
	}

	length(): number {
		return Math.sqrt((this.x1-this.x0)**2 + (this.y1-this.y0)**2);
	}

	get(t: number): Point {
		return MathUtil.interpolate(this.x0, this.y0, this.x1, this.y1, t);
	}

	findTbyDistance(dist: number): number {
		return dist / this.length();
	}
	getPosByDistance(dist: number): Point {
		let t = dist / this.length();
		return MathUtil.interpolate(this.x0, this.y0, this.x1, this.y1, t);
	}

	// t는 받지만 쓰지 않는다 (직선의 법선은 t와 무관). offset()은 인자 없이 부른다.
	normal(t?: number): Point {
		let tanX = this.x1 - this.x0;
		let tanY = this.y1 - this.y0;
		let signX = (tanX >= 0) ? +1 : -1;
		let signY = (tanY >= 0) ? +1 : -1;

		let uv: Point = {x:0, y:0};
		if (Math.abs(tanY) < 0.000000001)
		{
			uv.x = 0;
			uv.y = 1 * signX;
		}
		else
		{
			let tx = tanY;
			let ty = -tanX;

			let unit_base = Math.sqrt(tx*tx + ty*ty);
			uv.x = -tx / unit_base;
			uv.y = -ty / unit_base;
		}

		return uv;
	}

	project(p: Point): NearestPoint {
		return MathUtil.getNearestPoint(p, this.p0, this.p1);
	}

	offset(dist: number): TB_LineSeg {
		let uv = this.normal();
		let x0 = this.x0 + uv.x * dist;
		let y0 = this.y0 + uv.y * dist;
		let x1 = this.x1 + uv.x * dist;
		let y1 = this.y1 + uv.y * dist;

		return new TB_LineSeg(x0, y0, x1, y1);
	}
}

/** segment가 직선인지. TB_LineSeg만 type 필드를 가진다 (bezier-js의 Bezier에는 없다). 원본의 `seg.type == 'line'` 검사와 같다. */
function is_line(seg: Segment): seg is TB_LineSeg {
	return (seg as TB_LineSeg).type == 'line';
}

export { TB_LineSeg, is_line }
