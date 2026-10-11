import type Bezier from 'bezier-js';
import { TB_LineSeg, is_line } from './TB_LineSeg'
import type { Segment, Point, XYPoint, SvgPathCommand, FindTOptions, FlattenOptions, OffsetSvgPath } from './types'

class PathUtil {
	// start~end 구간의 path segments를 리턴한다.
	static clip_path(segments: Segment[], lengths: number[], dist_start: number, dist_end: number): Segment[] {
		if (dist_end <= dist_start)
			return [];

		let new_segs: Segment[] = [];
		let length = 0;
		for(let i=0; i<segments.length; i++) {
			let seg = segments[i];

			let next_length = length + lengths[i];
			let dist_start_in_seg = length <= dist_start && dist_start < next_length;
			let dist_end_in_seg = length < dist_end && dist_end <= next_length;
			
			if (dist_start_in_seg && dist_end_in_seg) {
				let t1 = PathUtil.findTbyDistance(seg, dist_start - length, {}); //(dist_start - length) / lengths[i];
				let t2 = PathUtil.findTbyDistance(seg, dist_end - length, {}); //(dist_end - length) / lengths[i];
				let s = PathUtil.split_segment(seg, t1, t2)
				new_segs.push(s);
				break;
			}
			else if (dist_start_in_seg) {
				let tt = PathUtil.findTbyDistance(seg, dist_start - length, {});
				let s = PathUtil.split_and_select_segment(seg, tt, 'right')
				new_segs.push(s);
			}
			else if (dist_end_in_seg) {
				let tt = PathUtil.findTbyDistance(seg, dist_end - length, {})
				let s = PathUtil.split_and_select_segment(seg, tt, 'left')
				new_segs.push(s);
				break;
			}
			else if (length < dist_start) {
				// do nothing. just pass.
			}
			else {
				new_segs.push(seg);				
			}

			length = next_length;
		}
		return new_segs;
	}

	static split_and_select_segment(seg: Segment, t: number, select: 'left' | 'right'): Segment {
		if (is_line(seg)) {
			let p = seg.get(t);
			if (select == 'left')
				return new TB_LineSeg(seg.x0, seg.y0, p.x, p.y)
			else 
				return new TB_LineSeg(p.x, p.y, seg.x1, seg.y1)
		}
		else {
			let result = seg.split(t);
			return (select == 'left') ? result.left : result.right
		}
	}
	static split_segment(seg: Segment, t1: number, t2: number): Segment {
		if (is_line(seg)) {
			let p0 = seg.get(t1);
			let p1 = seg.get(t2);
			return new TB_LineSeg(p0.x, p0.y, p1.x, p1.y)
		}
		else {
			return seg.split(t1, t2);
		}
	}
	
	static findTbyDistance(seg: Segment, dist: number, opt?: FindTOptions): number {
		let t = 0;
		if (is_line(seg))
			t = seg.findTbyDistance(dist);
		else
			t = PathUtil.findTbyDistance_Bezier(seg, dist, opt);
		return t;
	}

	/*  t에 따른 length값을 cache하여 연산량 줄일 것.
	*/
	static findTbyDistance_Bezier(curve: Bezier, length: number, opt?: FindTOptions): number {
		let L = curve.length()
		if (length >= L)
			return 1.0;
		else if (length <= 0)
			return 0;

		let epsilon = (opt && opt.epsilon) || 0.001;
		let max_step = (opt && opt.max_step) || 25;
			
		let t = 0.5;
		let t_step = 0.5;
		let step = 0;
		while(step < max_step) {
			let split = curve.split(t);
			t_step /= 2;
			let mid = split.left.length();
			if (length <= mid) {
				if (mid - length < epsilon)
					break;
				t -= t_step;
			}
			else {
				if (length-mid < epsilon)
					break;
				t += t_step;
			}
			step += 1;
		}

		return t;
	}	  

	static flatten_segments(segments: Segment[], flatness = 1): TB_LineSeg[] {
		let result: TB_LineSeg[] = [];

		let mg = new MGeometry();

		segments.forEach(seg => {
			if (is_line(seg))
				result.push(seg);
			else { // cubic bezier
				let bez: XYPoint[] = [
					{X:seg.points[0].x, Y:seg.points[0].y},
					{X:seg.points[1].x, Y:seg.points[1].y},
					{X:seg.points[2].x, Y:seg.points[2].y},
					{X:seg.points[3].x, Y:seg.points[3].y}
				]
				let v: XYPoint[] = [];
				mg.flatten_cbezier(bez, v, {flatness:flatness, has_begin_point:true})
				for(let i=0; i<v.length-1; i++) {
					result.push(new TB_LineSeg(v[i].X, v[i].Y, v[i+1].X, v[i+1].Y))
				}
			}
		})

		return result;
	}

    /*
        설명
        - segments에 dist만큼 떨어진 path를 생성한다.
        특징
        - offset path의 첫 'M'은 svg_str에 포함되어 있지 않음.
          이유는, 다른 path와 연결하는 경우 'M' command 없이 바로 연결하기 위함.
        - curve --> line 혹은 그 반대의 경우 끝점-시작접을 연결한다. 
        - begin_point, end_point는 다른 path와 연결하여 사용하기 위해 제공함.

        return {
            svg_str : string        # L또는 C로 시작함 (M으로 시작하지 않음)
            begin_point : {x,y}
            end_point :{x,y}
        }
    */
    static get_offset_svg_path(_segments: Segment[], dist: number, reverse?: boolean): OffsetSvgPath {
		let svg_str = '';
		let begin_point: Point | null = null;
		let end_point: Point | null = null;
		let tmp_last_data: { cmd: string; last_point: Point | null } = {
			cmd: '',
			last_point: null
		}

		/*
			bezier.js의 offset()함수에 버그가 있어 수정전까지는 line으로 flatten시켜 offset시킨다.
			issue in github : https://github.com/Pomax/bezierjs/issues/102

			문제가 수정되면 아래 this.flatten_segments()를 사용하지 않아도 된다.
		*/
		// flatten 결과는 전부 직선이지만, 아래 curve 분기(bezier.js 버그가 고쳐지면 다시 쓸 코드)가 컴파일되도록 Segment[]로 둔다.
		let segments: Segment[] = this.flatten_segments(_segments);


		if (reverse != true) {
			segments.forEach((seg, index) => {
				if (is_line(seg)) {
					let cu = seg.offset(dist);					
					if (index == 0)
						begin_point = {x:cu.x0, y:cu.y0};

					if (tmp_last_data.cmd == 'C')
						svg_str += 	`L ${cu.x0} ${cu.y0}`
					svg_str += `L ${cu.x1} ${cu.y1}`

					// 마지막 point 확보
					if (index == segments.length-1)
						end_point = {x:cu.x1, y:cu.y1}

					tmp_last_data = {
						cmd : "L",
						last_point: {x:cu.x1, y:cu.y1}
					}
				}
				else { // curve
					let cu = seg.offset(dist);
					if (index == 0 && cu.length > 0)
						begin_point = {x:cu[0].points[0].x, y:cu[0].points[0].y}

					if (tmp_last_data.cmd == 'L') {
						let bez = cu[cu.length-1];
						svg_str += 	`L ${bez.points[3].x} ${bez.points[3].y}`
					}
					cu.forEach(bez => {
						svg_str += `C ${bez.points[1].x} ${bez.points[1].y} ${bez.points[2].x} ${bez.points[2].y} ${bez.points[3].x} ${bez.points[3].y} `
					})

					// 마지막 point 확보
					let last_bez = cu[cu.length-1];
					if (index == segments.length-1) {
						end_point = {x:last_bez.points[3].x, y:last_bez.points[3].y}
					}

					tmp_last_data = {
						cmd : "C",
						last_point: {x:last_bez.points[3].x, y:last_bez.points[3].y}
					}
				}
			})
		}
		else {
			let last_index = segments.length-1;
			let _segments = segments.slice();
			_segments.reverse().forEach((seg, index) => {
				if (is_line(seg)) {
					let cu = seg.offset(dist);										
					if (index == 0)
						begin_point = {x:cu.x1, y:cu.y1};

					if (tmp_last_data.cmd == 'C')
						svg_str += `L ${cu.x1} ${cu.y1}`
					svg_str += `L ${cu.x0} ${cu.y0}`

					// 마지막 point 확보
					if (index == last_index)
						end_point = {x:cu.x0, y:cu.y0}

					tmp_last_data = {
						cmd : "L",
						last_point: {x:cu.x0, y:cu.y0}
					}						
				}
				else {
					let cu = seg.offset(dist);
					let last_cu_index = cu.length-1;
					if (index == 0 && cu.length > 0)
						begin_point = {x:cu[last_cu_index].points[3].x, y:cu[last_cu_index].points[3].y}
					
					if (tmp_last_data.cmd == 'L') {
						let bez = cu[last_cu_index];
						svg_str += 	`L ${bez.points[3].x} ${bez.points[3].y}`
					}
					cu.reverse().forEach(bez => {
						svg_str += `C ${bez.points[2].x} ${bez.points[2].y} ${bez.points[1].x} ${bez.points[1].y} ${bez.points[0].x} ${bez.points[0].y} `
					})

					let last_bez = cu[0];
					if (index == last_index) {
						end_point = {x:last_bez.points[0].x, y:last_bez.points[0].y}
					}

					tmp_last_data = {
						cmd : "C",
						last_point: {x:last_bez.points[0].x, y:last_bez.points[0].y}
					}					
				}
			})
		}
		return {
			svg_str,
			begin_point,
			end_point
		}
	}



	static parse_svg_path(str: string): SvgPathCommand[] {
		return _parse_svg_path(str)
	}
}

// 참고: https://github.com/jkroso/parse-svg-path/blob/master/index.js
function _parse_svg_path(str: string): SvgPathCommand[] {
	var length: Record<string, number> = {a: 7, c: 6, h: 1, l: 2, m: 2, q: 4, s: 4, t: 2, v: 1, z: 0}

	/**
	 * segment pattern
	 * @type {RegExp}
	 */
	
	var segment = /([astvzqmhlc])([^astvzqmhlc]*)/ig
	
	/**
	 * parse an svg path data string. Generates an Array
	 * of commands where each command is an Array of the
	 * form `[command, arg1, arg2, ...]`
	 *
	 * @param {String} path
	 * @return {Array}
	 */
	
	function parse(path: string): SvgPathCommand[] {
		var data: SvgPathCommand[] = []
		path.replace(segment, function(_, command: string, argstr: string){
			var type = command.toLowerCase()
			var args = parseValues(argstr)
	
			// overloaded moveTo
			if (type == 'm' && args.length > 2) {
				data.push(make_command(command, args.splice(0, 2)))
				type = 'l'
				command = command == 'm' ? 'l' : 'L'
			}
	
			while (true) {
				if (args.length == length[type]) {
					data.push(make_command(command, args))
					return ''   // replace()의 결과는 쓰지 않는다 (원본은 data.push()의 반환값을 돌려줬다)
				}
				if (args.length < length[type]) throw new Error('malformed path data')
				data.push(make_command(command, args.splice(0, length[type])))
			}
		})
		return data
	}

	// 원본의 `args.unshift(command); data.push(args)` 와 같은 배열을 만든다.
	function make_command(command: string, nums: number[]): SvgPathCommand {
		return [command, ...nums]
	}
	
	var number = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/ig
	
	function parseValues(args: string): number[] {
		var numbers = args.match(number)
		return numbers ? numbers.map(Number) : []
	}

	return parse(str)
}



///////////////////////////////////////////////////////////////////////////////////////////////////////////
class MGeometry {
	constructor() {

	}

	/* options
		flatness : 평활도
		has_begin_point : 결과물에 시작 point를 포함할 것인지 여부.
	*/
	flatten_cbezier(bezier: XYPoint[], flatten_vec: XYPoint[], options: FlattenOptions): void {
		// var max_flat_val = this.distanceApprox(bezier[1], bezier[0], bezier[2]);
		var flat_a = this.distToSegment(bezier[1], bezier[0], bezier[3]);
		var flat_b = this.distToSegment(bezier[2], bezier[0], bezier[3]);

		if (flat_a < options.flatness && flat_b < options.flatness) {
			if (flatten_vec.length == 0 && options.has_begin_point)
				flatten_vec.push(bezier[0]);
			flatten_vec.push(bezier[3]);
		}
		else {
			var ret = this.subdivide_cbezier(bezier);
			this.flatten_cbezier(ret.left,  flatten_vec, options);
			this.flatten_cbezier(ret.right, flatten_vec, options);
		}
	}

	subdivide_cbezier (curve: XYPoint[]): { left: XYPoint[]; right: XYPoint[] }
	{
		var p0 = curve;
		var p1: XYPoint[] = [], p2: XYPoint[] = [], p3: XYPoint;

		p1[0] = this.interpolate(p0[0], p0[1], 0.5);
		p1[1] = this.interpolate(p0[1], p0[2], 0.5);
		p1[2] = this.interpolate(p0[2], p0[3], 0.5);

		p2[0] = this.interpolate(p1[0], p1[1], 0.5);
		p2[1] = this.interpolate(p1[1], p1[2], 0.5);

		p3 = this.interpolate(p2[0], p2[1], 0.5);

		var pLeft: XYPoint[] = [];
		pLeft.push(p0[0]);
		pLeft.push(p1[0]);
		pLeft.push(p2[0]);
		pLeft.push(p3);

		var pRight: XYPoint[] = [];
		pRight.push(p3);
		pRight.push(p2[1]);
		pRight.push(p1[2]);
		pRight.push(p0[3]);

		return {left:pLeft, right:pRight};
	}

	interpolate (pt0: XYPoint, pt1: XYPoint, t: number): XYPoint {
		var x = t * pt1.X + (1-t) * pt0.X;
		var y = t * pt1.Y + (1-t) * pt0.Y;
		return {X:x, Y:y};
	}

	// for distToSegment()
	sqr(x: number): number { return x * x }
	dist2(v: XYPoint, w: XYPoint): number { return this.sqr(v.X - w.X) + this.sqr(v.Y - w.Y) }
	distToSegmentSquared(p: XYPoint, v: XYPoint, w: XYPoint): number {
		var l2 = this.dist2(v, w);
		if (l2 == 0) return this.dist2(p, v);
		var t = ((p.X - v.X) * (w.X - v.X) + (p.Y - v.Y) * (w.Y - v.Y)) / l2;
		if (t < 0) return this.dist2(p, v);
		if (t > 1) return this.dist2(p, w);
		return this.dist2(p, { X: v.X + t * (w.X - v.X),
			Y: v.Y + t * (w.Y - v.Y) });
	}
	distToSegment(p: XYPoint, v: XYPoint, w: XYPoint): number { return Math.sqrt(this.distToSegmentSquared(p, v, w)); }		
}
	///////////////////////////////////////////////////////////////////////////////////////////////////////////




export { PathUtil,  MGeometry }