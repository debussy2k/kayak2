import type { SvgPathEntry, TextFxOptions, TextFxResult, ShadowGeom } from '../types';

interface DropShadowParts { shadow_def: string | null; shadow_filter: string | null; shadow_geom?: ShadowGeom }

export class TB_TextFxService {
    static generate_svg_path_string(svg_paths: SvgPathEntry[], uuid: string, domLine?: any, opt?: TextFxOptions): TextFxResult {
        let ofc = opt && opt.override_fill_color;
        let override_fill_color = ofc ? opt!.override_fill_color!.fill : null;
        let transparent_by_src_color = (ofc && ofc.transparent_by_src_color) ?  ofc.transparent_by_src_color : null;


		let defs_paths = '';
		let defs_shadows = '';
		
		let shadow_layer = '';
		let stroke_layer = '';
		let path_layer = '';

		let gradient_index = 0;
		let path_index = 0;

		let shadow_info_arr: TextFxResult['shadow_info_arr'] = [];

        svg_paths.forEach(svg_path => {
			let uuid_postfix = `${uuid}-${path_index}`;
			let path_id = `path-${uuid_postfix}`;
			defs_paths += `<path id="${path_id}" d="${svg_path.d}"/>`

			/*
				imagemagick convert.exe에서 svg를 image로 변환시 
				반드시 "xlink:href" 사용해야 정상 변환됨.
			*/

			// drop-shadow
			let {shadow_def, shadow_filter, shadow_geom} = TB_TextFxService.compose_dropshadow(svg_path, { defs_shadows, uuid_postfix })
			if (shadow_def && shadow_filter) {
				if (opt && opt.shadow_as_image) {
					// <----- shadow 작업 영역
					// shadow_layer += `<use xlink:href="#${path_id}" ${shadow_filter} shape-rendering="geometricPrecision"/>`;
					
					// height계산에서는 line height를 벗어나는 글자까지 포함하기 위해 descent를 더한다. "g"같은 문자 대응
					let shadow_dim = {
						width: domLine.content_width + shadow_geom!.size_grow,
						height: (domLine.max_font_size_px + domLine.max_word_descent) + shadow_geom!.size_grow,
					}
					
					let shadow_file_name = '';
					if (opt && opt.relative_path)
						shadow_file_name = opt.relative_path += '/';
					shadow_file_name += path_id + '.png';
					/* todo:shadow
						shadow의 x,y 위치가 정해져야 함. 
					*/
					shadow_layer += `<image xlink:href="${shadow_file_name}" x="${shadow_geom!.anchor_offset_x}" y="${shadow_geom!.anchor_offset_y}" width="${shadow_dim.width}" height="${shadow_dim.height}" />`

					let obj = {
						shadow_name: path_id,
						svg_path: svg_path,
						shadow_dim: shadow_dim
					}
					shadow_info_arr.push(obj);
				}
				else {
					defs_shadows += shadow_def;
					shadow_layer += `<use xlink:href="#${path_id}" ${shadow_filter} shape-rendering="geometricPrecision"/>`;
				}
			}

			let tmp = '';			
			// stroke (outside)
			if (svg_path.stroke && svg_path.stroke.weight > 0 && svg_path.stroke.align == 'outside')
				tmp += TB_TextFxService.compose_stroke(svg_path, path_id, { override_fill_color });		// stroke : "outside"인 경우 가장 바닥에 outline을 그린다.
			
			tmp += `<use xlink:href="#${path_id}"`;
			// fill/gradient 
			tmp += TB_TextFxService.compose_fill_or_gradient(svg_path, { uuid, gradient_index, override_fill_color, transparent_by_src_color })
			
			// stroke (center)
			if (svg_path.stroke && svg_path.stroke.weight > 0 && svg_path.stroke.align == 'center')
				tmp += TB_TextFxService.compose_stroke(svg_path, path_id, { override_fill_color });		 // stroke : "center"인 경우 윗쪽에 그린다.

			tmp += ` shape-rendering="geometricPrecision"/>`
			path_layer += tmp;

			++path_index;
        })
		
		if (shadow_info_arr.length > 0) {
			// console.log('shadow_info_arr', shadow_info_arr)
		}

		/* 리턴 문자열의 형태
			<defs>
				<path id='path-fihJ6g67a0-0' d='...'></path>
			<defs>
			<use href="#path-fihJ6g67a0-0" stroke='blue' stroke-width='8' shape-rendering="geometricPrecision"></use>
			<use href="#path-fihJ6g67a0-0" fill="url(#grad-fihJ6g67a0-0)" shape-rendering="geometricPrecision"></use>
		*/
		let svg_string = `<defs>${defs_paths}</defs>
			<defs>${defs_shadows}</defs>
			${shadow_layer}
			${stroke_layer}
			${path_layer}`
        return {
			svg_string,
			shadow_info_arr
		}
	}
	static compose_dropshadow(svg_path: SvgPathEntry, ctx: { defs_shadows?: string; uuid_postfix: string }): DropShadowParts {
		let mm2px = 96 / 25.4;

		let shadow_def: string | null = null; 
		let shadow_filter: string | null = null;

		if (svg_path.shadow == undefined || (svg_path.shadow.size == 0 && svg_path.shadow.distance == 0))
			return {shadow_def, shadow_filter};

		let id = `dropshadow-${ctx.uuid_postfix}`;
		let size_offset = mm2px*svg_path.shadow.size;
		let angle_rad = (180 - svg_path.shadow.angle) * Math.PI / 180;
		let dx = mm2px*svg_path.shadow.distance * Math.cos(angle_rad)
		let dy = mm2px*svg_path.shadow.distance * Math.sin(angle_rad)
		
		/*
			mm를 stdDeviation으로 변환하기
			참고 : https://www.w3.org/TR/SVG11/filters.html#feGaussianBlurElement

			gaussian kernel의 size는 아래 공식으로 근사된다. (s = standard deviation)
			d = floor(s * 3*sqrt(2*pi)/4 + 0.5)
			
			위는 반올림을 위한 식이므로 
			d = s * 3*sqrt(2*pi)/4 			// 3*sqrt(2*pi)/4 == 1.879
			
			* 위의 식과 관련있는 듯 했지만 1.879 곱하는 것은 엉터리. 
			  우연히 비슷하게 보임. 실제는 InDesin의 shadow보다 살짝 진함.
		*/
		// let stdDeviation = svg_path.shadow.size * 1.879; 
		let stdDeviation = svg_path.shadow.size * mm2px / 2;
		
		let safe_shadow_size_px = 1.5 * size_offset;
		let shadow_geom = {
			size_grow : 2*safe_shadow_size_px, 	// shadow size때문에 커져야 하는 bbox의 크기
			anchor_offset_x : -safe_shadow_size_px + dx,	// 원래 글자 기준에 대해 shadow를 위치시킬 offset
			anchor_offset_y : -safe_shadow_size_px + dy
		}		
		
		shadow_def = `
			<filter id="${id}" x="-${safe_shadow_size_px}" y="-${safe_shadow_size_px}" width="200" height="200">
				<feGaussianBlur in="SourceGraphic" stdDeviation="${stdDeviation}"/>
				<feOffset dx="${dx}" dy="${dy}" result="offsetblur"/>
				<feFlood flood-color="${svg_path.shadow.color}"/>
				<feComposite in2="offsetblur" operator="in"/>
				<feMerge>
					<feMergeNode/>
				</feMerge>
			</filter> 
		`
		shadow_filter = ` filter="url(#${id})"` // space로 시작해야 함.
		return {shadow_def, shadow_filter, shadow_geom}
	}
	static compose_stroke(svg_path: SvgPathEntry, path_id: string, ctx: { override_fill_color: string | null }): string {
		let pt2px = 96/72;

		let color = ctx.override_fill_color || svg_path.stroke!.color;

		// stroke : "outside"인 경우 가장 바닥에 outline을 그린다.
		if (svg_path.stroke!.weight > 0 && svg_path.stroke!.align == 'outside') {
			return `<use xlink:href="#${path_id}"  stroke-width="${2*svg_path.stroke!.weight*pt2px}" stroke="${color}"
						stroke-linecap="round" stroke-linejoin="${svg_path.stroke!.join}" stroke-miterlimit="${svg_path.stroke!.miterlimit}"
						shape-rendering="geometricPrecision"/>`
		}
		// stroke : "center"인 경우 윗쪽에 그린다.
		else if (svg_path.stroke!.weight > 0 && svg_path.stroke!.align == 'center') {
			return ` stroke-width="${svg_path.stroke!.weight*pt2px}" stroke="${color}" 
						stroke-linejoin="${svg_path.stroke!.join}" stroke-miterlimit="${svg_path.stroke!.miterlimit}"`
		}		
		return '';
	}
	static compose_fill_or_gradient(svg_path: SvgPathEntry, ctx: { uuid: string; gradient_index: number; override_fill_color: string | null; transparent_by_src_color: string[] | null }): string {
		// 단색color 또는 gradient 적용
		if (svg_path.fill) {
			let fill_color = ctx.override_fill_color ? ctx.override_fill_color : svg_path.fill;
			if (ctx.transparent_by_src_color) {
				if (ctx.transparent_by_src_color.find(val => val == svg_path.fill) !== undefined)
					fill_color = 'none';
			}
			return ` fill="${fill_color}"`
		}
		else if (svg_path.gradient) {
			//todo:20190711 stroke_layer += `<use href='#${path_id}' stroke='blue' stroke-width='8' shape-rendering="geometricPrecision"/>`
			
			let cur_gradient_index = ctx.gradient_index;
			ctx.gradient_index += 1; // 여기에서만 증가시킬 것.
			return ` fill="url(#grad-${ctx.uuid}-${cur_gradient_index})"`
		}

		return '';
	}
}