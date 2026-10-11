import type { SvgPathEntry } from './types';
import type { GradientSpec } from '../segment/types';

interface GradientDims { page_width: number; page_height: number }
interface LineGradientData { x: number; y: number; line: { uuid: string; svg_paths: SvgPathEntry[] } }

export class TB_SvgGradientFactory {
	static build_gradient_defs(data: LineGradientData, dim: GradientDims): string { 
		let defs_str = '';
		data.line.svg_paths.filter(item => item.gradient).forEach((item, index) => {
			if (item.gradient!.type == 'linear') {
				let adj_geom = TB_SvgGradientFactory.calc_adjusted_geom(item.gradient!.geom, dim.page_width, dim.page_height, -data.x, -data.y)

				let svg_stops_str = item.gradient!.stops.reduce((str: string, grad_stop: GradientSpec['stops'][number]) => {
					return str + `<stop offset="${grad_stop.offset}" style="stop-color:${grad_stop.rgb};stop-opacity:1"/>`
				}, '')

				let gradientTransform = TB_SvgGradientFactory.angle_attr_val(item.gradient!.angle, dim,  -data.x, -data.y);

				defs_str += `
					<linearGradient id="grad-${data.line.uuid}-${index}" x1="${adj_geom.x1}" y1="${adj_geom.y1}" x2="${adj_geom.x2}" y2="${adj_geom.y2}" 
						gradientUnits="userSpaceOnUse"
						gradientTransform="${gradientTransform}">
						${svg_stops_str}
					</linearGradient>
				`
			}
		})
		return defs_str;
	}

	// adj_geom의 단위는 실제 pixel임
	static angle_attr_val(angle: number | undefined, dim: GradientDims, tx: number, ty: number): string { 
		let hw = tx + (dim.page_width) / 2;
		let hh = ty + (dim.page_height) / 2;

		let _angle = angle === undefined ? 0 : angle;
		return `translate(${hw} ${hh}) rotate(${_angle}) translate(${-hw} ${-hh})` 
	}


	static calc_adjusted_geom(geom: Record<string, string | number>, width: number, height: number, tx: number, ty: number): { x1: number; y1: number; x2: number; y2: number } {
		// geom.x1은 %문자열으로 간주함. ex."30%"
		// parseFloat()은 %직전까지 숫자를 변환하는 특성을 활용
		let ret = { x1:0, y1:0, x2:0, y2:0 }
		// parseFloat는 런타임에 숫자도 문자열로 바꿔 처리한다. TS lib 시그니처(string)를 위한 캐스팅만.
		ret.x1 = (width * parseFloat(geom.x1 as string) / 100) + tx;
		ret.x2 = (width * parseFloat(geom.x2 as string) / 100) + tx;
		ret.y1 = (height * parseFloat(geom.y1 as string) / 100) + ty;
		ret.y2 = (height * parseFloat(geom.y2 as string) / 100) + ty;
		return ret;
	}
}