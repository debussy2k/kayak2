import Bezier from 'bezier-js';
import { TB_LineSeg, is_line } from './TB_LineSeg'
import { MathUtil } from './MathUtil'
import { PathUtil } from './PathUtil'
import { TB_CanvasDraw } from './TB_CanvasDraw'
import { CGMatrix } from '../textbox/cg'
import type { Point, Rect, Segment, PathCmd, PathCmdM, SvgPathCommand, PosOnPath, PosOnPathOptions, ProjectResult, MatrixLike } from './types'

/* 
	ToDo
	- point에 변화가 없으면 계산값을 cache하고 재활용할 것.
*/
class TB_Path {
	path: PathCmd[];
	segments: Segment[];
	lengths: number[];
	total_length: number;
	last_pt: Point | null;
	closed_path: boolean;

	constructor(svg_path_data?: string, opt?: { flip?: boolean }) {
		this.path = [];
		this.segments = [];
		this.lengths = [];
		this.total_length = 0;
		this.last_pt = null;
		this.closed_path = false;

		// this.test();

		let flip = opt && opt.flip;
		if (svg_path_data)
			this.parse_data(svg_path_data, flip)
	}

	test() {
		// 아래 문제가 있음.
		// https://github.com/Pomax/bezierjs/issues/102
		let seg = new Bezier(56.4784042286517, 112.95538057301243, 31.180574948729816, 112.95538057742776, 9.768881274012546, 96.32488088867885, 2.578847809503432, 73.40012003978167)
		seg.offset(-10)
	}

	static is_closed(svg_path_data: string): boolean {
		let str = svg_path_data.trim();
		if (str.length == 0)
			return false;
		let last_ch = str.charAt(str.length-1);
		return (last_ch == 'Z' || last_ch == 'z')
	}

	parse_data(svg_path_data: string, flip?: boolean): void {
		this.closed_path = false;
		let arr = PathUtil.parse_svg_path(svg_path_data);
		if (!flip) {
			arr.forEach(item => {
				switch(item[0]) {
					case 'M':
					this.moveTo(item[1], item[2])
						break;
					case 'L':
						this.lineTo(item[1], item[2])
						break;
					case 'C':
						this.curveTo(item[1], item[2], item[3], item[4], item[5], item[6]);
						break;
					case 'Z':
					case 'z':
						this.closed_path = true;
						break;
				}
			})
		}
		else {
			let last_pt: Point | null | undefined = null;
			if (arr.length > 1) {
				last_pt = this.get_last_pt(arr[arr.length-2]);
				this.moveTo(last_pt!.x, last_pt!.y);
			}

			for(let i=arr.length-1; i>=0; i--) {
				let item = arr[i];
				if (i > 0)
					last_pt = this.get_last_pt(arr[i-1]);
				switch(item[0]) {
					case 'M':
						// just pass
						break;
					case 'L':
						this.lineTo(last_pt!.x, last_pt!.y);
						break;
					case 'C':
						this.curveTo(item[3], item[4], item[1], item[2], last_pt!.x, last_pt!.y);
						break;
					case 'Z':
					case 'z':
						this.closed_path = true;
						break;
				}
			}
		}
	}
	get_last_pt(item: SvgPathCommand): Point | undefined {
		if (item[0] == 'M' || item[0] == 'L')
			return {x:item[1], y:item[2]}
		else if (item[0] == 'C')
			return {x:item[5], y:item[6]}
	}

	reverse_path(path: PathCmd[]): PathCmd[] {
		// condition: path[0].cmd must be 'M'
		let first = path[0] as PathCmdM;   // 위 조건대로 M이다
		let last_pt = {x:first.x, y:first.y};
		let reverse_path: PathCmd[] = [];
		for(let i=1; i<path.length; i++) {
			let pts = path[i];
			switch(pts.cmd) {
				case "M":
					throw 'cannot process "M" in the middle of path'
					break;
				case "L":
					reverse_path.unshift({cmd:'L', x:last_pt.x, y:last_pt.y})
					last_pt = {x:pts.x, y:pts.y}
					break;
				case "C":
					reverse_path.unshift({cmd:'C', 
						x0:pts.x1, y0:pts.y1,
						x1:pts.x0, y1:pts.y0,
						x2:last_pt.x, y2:last_pt.y
					})
					last_pt = {x:pts.x2, y:pts.y2}
					break;
			}
		}
		reverse_path.unshift({cmd:'M', x:last_pt.x, y:last_pt.y})

		return reverse_path;
	}

	clone(mat?: MatrixLike, flip_path?: boolean): TB_Path {
		let cpath = new TB_Path();
		let p: Point | null = null;

		let target_path = (flip_path == true) ? this.reverse_path(this.path) : this.path;

		target_path.forEach(pts => {
			switch(pts.cmd) {
				case "M":
					p = mat ? mat.transformPoint(pts) : pts;
					cpath.moveTo(p.x, p.y);
					break;
				case "L":
					p = mat ? mat.transformPoint(pts) : pts;
					cpath.lineTo(p.x, p.y);
					break;
				case "C":
					if (mat) {
						let p0 = mat.transformPoint({x: pts.x0, y: pts.y0})
						let p1 = mat.transformPoint({x: pts.x1, y: pts.y1})
						let p2 = mat.transformPoint({x: pts.x2, y: pts.y2})
						cpath.curveTo(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
					}
					else
						cpath.curveTo(pts.x0, pts.y0, pts.x1, pts.y1, pts.x2, pts.y2);
					break;
			}
		})

		cpath.closed_path = this.closed_path;
		cpath.precalc_length();
		return cpath;
	}

	precalc_length(): void {
		this.total_length = 0;
		let seg_len = 0;

		this.segments.forEach(seg => {
			seg_len = seg.length()
			this.lengths.push(seg_len)
			this.total_length += seg_len;
		})
	}

	getBbox(): Rect {
		let x_min = Infinity;
		let x_max = -Infinity;
		let y_min = Infinity;
		let y_max = -Infinity;
		
		this.path.forEach(pts => {
			switch(pts.cmd) {
				case "M":
				case "L":
					x_min = Math.min(x_min, pts.x)
					x_max = Math.max(x_max, pts.x)
					y_min = Math.min(y_min, pts.y)
					y_max = Math.max(y_max, pts.y)
					break;
				case "C":
					x_min = Math.min(x_min, pts.x2)
					x_max = Math.max(x_max, pts.x2)
					y_min = Math.min(y_min, pts.y2)
					y_max = Math.max(y_max, pts.y2)
					break;
			}
		})

		this.segments.forEach(seg => {
			if (is_line(seg)) {
			}
			else {
				let ex = seg.extrema();
				ex.x.forEach(t => {
					let p = seg.get(t);
					x_min = Math.min(x_min, p.x)
					x_max = Math.max(x_max, p.x)
				})
				ex.y.forEach(t => {
					let p = seg.get(t);
					y_min = Math.min(y_min, p.y)
					y_max = Math.max(y_max, p.y)
				})
			}
		})
		// console.log(x_min, x_max, y_min, y_max)

		return 	{
			x: x_min,
			y: y_min,
			width: x_max-x_min,
			height: y_max-y_min
		}
	}

	get_outline_svg_path(upper_offset: number, lower_offset: number, start_dist: number, end_dist: number): string {
		let segs = PathUtil.clip_path(this.segments, this.lengths, start_dist, end_dist);
		if (segs.length == 0)
			return '';

		let svg_upper = PathUtil.get_offset_svg_path(segs, upper_offset)
		let svg_lower = PathUtil.get_offset_svg_path(segs, lower_offset, true)

		return `
			M ${svg_upper.begin_point!.x} ${svg_upper.begin_point!.y} 
			${svg_upper.svg_str}
			L ${svg_lower.begin_point!.x} ${svg_lower.begin_point!.y}
			${svg_lower.svg_str}
			Z
		`
	}

	getSvgRect(rect: Rect): string {
		return `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" stroke="blue" fill="transparent" />`
	}

	drawOnCanvas(ctx: CanvasRenderingContext2D): void {
		let cd = new TB_CanvasDraw(ctx);
		
		this.segments.forEach(seg => {
			if (is_line(seg)) {
				cd.drawLine(seg.p0, seg.p1);
			}
			else {
				cd.drawCurve(seg);
				cd.drawSkeleton(seg);
			}
		})
	}

	getSvgPathData(): string {
		let path_data = this.path.reduce((svg_path_data, data) => {
			switch(data.cmd) {
				case 'M':
					svg_path_data += `M ${data.x} ${data.y} `;
					break;
				case 'L':
					svg_path_data += `L ${data.x} ${data.y} `;
					break;
				case 'C':
					svg_path_data += `C ${data.x0} ${data.y0}, ${data.x1} ${data.y1}, ${data.x2} ${data.y2} `;
					break;
			}
			return svg_path_data;

		}, "");
		return path_data;
	}
	
	moveTo(x: number, y: number): void {
		this.path.push({cmd:'M', x:x, y:y})
		this.last_pt = {x:x, y:y};
	}

	lineTo(x: number, y: number): void {
		this.path.push({cmd:'L', x:x, y:y})
		let line = new TB_LineSeg(this.last_pt!.x, this.last_pt!.y, x, y)
		this.segments.push(line);
		this.last_pt = {x:x, y:y};        
	}

	curveTo(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): void {
		this.path.push({
			cmd:'C', 
			x0:x0, y0:y0,
			x1:x1, y1:y1,
			x2:x2, y2:y2
		})
		let curve = new Bezier(this.last_pt!.x, this.last_pt!.y, x0, y0, x1, y1, x2, y2);
		this.segments.push(curve);

		this.last_pt = {x:x2, y:y2};
	}

	getLength(): number {
		let length = this.segments.reduce((sum, seg) => {
			return sum += seg.length();
		}, 0);
		return length;
	}

	/*
		21.11.23
		bezier-js의 normal()함수 버그를 처리하기 위한 작업
		- p1,p2,p3,p4로 구성된 bezier에서 p1과 p2가 동일한 경우 t=0위치에서 
		  또는 p3,p4가 동일한 경우 t=1 위치에서
		  미분불가한 상황이 발생함.
	*/
	getSafeNormal(seg: Segment, t: number): Point {
		let result: Point;
		result = seg.normal(t)
		if (isNaN(result.x) || isNaN(result.y)) {
			if (t === 0) {
				result = seg.normal(0.00000000000001)
			}
			else if (t === 1) {
				result = seg.normal(0.9999999999999)
			}
		}

		return result;
	}

	getPosByDistance(dist: number, opt?: PosOnPathOptions): PosOnPath {
		let ret = {} as PosOnPath;

		if (dist < 0) {
			ret.pt = this.segments[0].get(0);
			if (opt && opt.normal)
				// ret.nv = this.segments[0].normal(0);
				ret.nv = this.getSafeNormal(this.segments[0], 0);

		}

		for(let i=0; i<this.segments.length; i++ ) {
			let seg = this.segments[i];
			let l = this.lengths[i]; // seg.length();
			if (dist < l) {
				let t = PathUtil.findTbyDistance(seg, dist, {});

				ret.pt = seg.get(t);
				if (opt && opt.normal) {
					// ret.nv = seg.normal(t);
					ret.nv = this.getSafeNormal(seg, t);
				}
				break;
			}
			else {
				dist = dist - l;
			}
		}
		if (ret.pt == undefined) {
			let seg = this.segments[this.segments.length-1];
			ret.pt = seg.get(1);
			if (opt && opt.normal)
				// ret.nv = seg.normal(1);
				ret.nv = this.getSafeNormal(seg, 1);
		}

		if (opt && opt.normal && opt.angle) {
			ret.nv_angle = MathUtil.getAngle(ret.nv!.x, ret.nv!.y)
		}
		return ret;
	}

	
	project(x: number, y: number): Point | undefined {
		let min_dist = Infinity;
		let pt_on_path!: Point;
		this.segments.forEach(seg => {
			let ret = seg.project({x:x, y:y}); 
			// ret : {x, y, d, t}
			if (ret.d < min_dist) {
				min_dist = ret.d;
				pt_on_path = {x:ret.x, y:ret.y}
			}
		})

		return pt_on_path;
	}

	/*  
		p(x,y)에서 최단거리에 있는 curve상의 q를 찾고, 거리(d) 및 길이(lq)를 리턴함.
		return
			q  : the on-curve point closest to the specific off-curve point
			d  : distance between p and q
			length : length from curve start to q
	*/
	project_and_distance(x: number, y: number): ProjectResult {
		let min_dist = Infinity;
		let dist = 0;
		let length_to_projected_point = 0;
		let pt_on_path!: Point;
		this.segments.forEach((seg, i) => {
			let ret = seg.project({x:x, y:y});
			// ret : {x, y, d, t}			
			if (ret.d < min_dist) {
				min_dist = ret.d;
				let seg_len = 0;
				if (is_line(seg))
					seg_len = this.lengths[i] * ret.t;
				else
					seg_len = seg.split(ret.t).left.length();
				length_to_projected_point = dist + seg_len;
				pt_on_path = {x:ret.x, y:ret.y}
			}
			dist += this.lengths[i];
		})

		// p : point around curve
		// q : projected point on curve
		return {
			q: pt_on_path,
			d : min_dist, 
			length : length_to_projected_point
		};
	}

	getSubPath(dist_begin: number, dist_end: number): TB_Path {
		let subpath = new TB_Path();

		if (dist_begin <= dist_end) {
			let segs = PathUtil.clip_path(this.segments, this.lengths, dist_begin, dist_end);
			subpath.append_with_segments(segs);
		}
		else {
			let segs_1 = PathUtil.clip_path(this.segments, this.lengths, dist_begin, this.total_length);
			let segs_2 = PathUtil.clip_path(this.segments, this.lengths, 0, dist_end);

			subpath.append_with_segments(segs_1);
			subpath.append_with_segments(segs_2);
		}

		return subpath;
	}

	append_with_segments(segs: Segment[], opt?: { flip?: boolean }): void {
		if (opt && opt.flip) {
			let start_index = segs.length-1;
			for(let i=start_index; i>=0; i--) {
				let seg = segs[i];

				if (is_line(seg)) {
					if (i == start_index && this.path.length == 0)
						this.moveTo(seg.x1, seg.y1);
					this.lineTo(seg.x0, seg.y0);
				}
				else {
					if (i == start_index && this.path.length == 0)
						this.moveTo(seg.points[3].x, seg.points[3].y);
					this.curveTo(seg.points[2].x, seg.points[2].y, seg.points[1].x, seg.points[1].y, seg.points[0].x, seg.points[0].y);
				}
			}

		}
		else {
			segs.forEach((seg, i) => {
				if (is_line(seg)) {
					if (i == 0 && this.path.length == 0)
						this.moveTo(seg.x0, seg.y0);
					this.lineTo(seg.x1, seg.y1);
				}
				else {
					if (i == 0 && this.path.length == 0)
						this.moveTo(seg.points[0].x, seg.points[0].y);
					this.curveTo(seg.points[1].x, seg.points[1].y, seg.points[2].x, seg.points[2].y, seg.points[3].x, seg.points[3].y);				
				}
			})
		}
	}
}


export { TB_Path }