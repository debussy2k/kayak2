import type Bezier from 'bezier-js';
import type { Point } from './types';

class TB_CanvasDraw {
	ctx: CanvasRenderingContext2D;

	constructor(ctx: CanvasRenderingContext2D) {
		this.ctx = ctx;
	}

	setColor(c: string) {
		this.ctx.strokeStyle = c;
	}
    setFill(c: string) {
		this.ctx.fillStyle = c;
	}

	drawCurve(curve: Bezier, offset?: Point) {
		offset = offset || { x: 0, y: 0 };
		var ox = offset.x;
		var oy = offset.y;
		this.ctx.beginPath();
		var p = curve.points, i;
		this.ctx.moveTo(p[0].x + ox, p[0].y + oy);
		if (p.length === 3) {
			this.ctx.quadraticCurveTo(
				p[1].x + ox, p[1].y + oy,
				p[2].x + ox, p[2].y + oy
			);
		}
		if (p.length === 4) {
			this.ctx.bezierCurveTo(
				p[1].x + ox, p[1].y + oy,
				p[2].x + ox, p[2].y + oy,
				p[3].x + ox, p[3].y + oy
			);
		}
		this.ctx.stroke();
		this.ctx.closePath();
	}

	drawPoint(p: Point, offset?: Point) {
		offset = offset || { x: 0, y: 0 };
		var ox = offset.x;
		var oy = offset.y;
		this.ctx.beginPath();
		this.ctx.arc(p.x + ox, p.y + oy, 5, 0, 2 * Math.PI);
		this.ctx.stroke();
	}

	drawPoints(points: Point[], offset?: Point) {
		offset = offset || { x: 0, y: 0 };
		let self = this;
		points.forEach(function (p) {
			self.drawCircle(p, 3, offset);
		});
	}

	drawArc(p: Point & { r: number; s: number; e: number }, offset?: Point) {
		offset = offset || { x: 0, y: 0 };
		var ox = offset.x;
		var oy = offset.y;
		this.ctx.beginPath();
		this.ctx.moveTo(p.x + ox, p.y + oy);
		this.ctx.arc(p.x + ox, p.y + oy, p.r, p.s, p.e);
		this.ctx.lineTo(p.x + ox, p.y + oy);
		this.ctx.fill();
		this.ctx.stroke();
	}

	drawCircle(p: Point, r: number, offset?: Point) {
		offset = offset || { x: 0, y: 0 };
		var ox = offset.x;
		var oy = offset.y;
		this.ctx.beginPath();
		this.ctx.arc(p.x + ox, p.y + oy, r, 0, 2 * Math.PI);
		this.ctx.stroke();
	}


	drawLine(p1: Point, p2: Point, offset?: Point) {
		offset = offset || { x: 0, y: 0 };
		var ox = offset.x;
		var oy = offset.y;
		this.ctx.beginPath();
		this.ctx.moveTo(p1.x + ox, p1.y + oy);
		this.ctx.lineTo(p2.x + ox, p2.y + oy);
		this.ctx.stroke();
	}

	drawSkeleton(curve: Bezier, offset?: Point, nocoords?: boolean) {
		offset = offset || { x: 0, y: 0 };
		var pts = curve.points;
		this.ctx.strokeStyle = "lightgrey";
		this.drawLine(pts[0], pts[1], offset);
		if (pts.length === 3) { this.drawLine(pts[1], pts[2], offset); }
		else { this.drawLine(pts[2], pts[3], offset); }
		this.ctx.strokeStyle = "black";
		if (!nocoords) this.drawPoints(pts, offset);
	}

	drawNormalOnCurve(curve: Bezier, t: number, length: number) {
		let nv = curve.normal(t);
		let p0 = curve.get(t);
		let p1 = {
			x: p0.x - length*nv.x,
			y: p0.y - length*nv.y
		}
		this.drawLine(p0, p1);
	}
	drawNormalLine(p0: Point, nv: Point, length: number) {
		let p1 = {
			x: p0.x - length*nv.x,
			y: p0.y - length*nv.y
		}
		this.drawLine(p0, p1);
	}

}

export { TB_CanvasDraw }