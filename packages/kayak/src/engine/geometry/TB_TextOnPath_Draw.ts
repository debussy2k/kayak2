import { MathUtil } from './MathUtil'
import type { TB_TextOnPath } from './TB_TextOnPath'
import type { Point, SvgGlyphPath, SvgRenderOptions } from './types'

class TB_TextOnPath_Draw {
    tp: TB_TextOnPath;
	svg_curve_pathdata: string;
	svg_text: string;
	svg_text_selection: string;
	svg_bbox: string;
	svg_projection_line: string;
	svg_cursor: string;
	d_path_bounding_shape: string;
	d_text_boudning_shape: string;
	svg_paths: SvgGlyphPath[];

    constructor(tp: TB_TextOnPath) {
        this.tp = tp;

		this.svg_curve_pathdata = '';
		this.svg_text = '';
		this.svg_text_selection = '';
		this.svg_bbox = '';
		this.svg_projection_line = '';
		this.svg_cursor = '';
		this.d_path_bounding_shape = '';
		this.d_text_boudning_shape = '';  

		/* pdf생성을 위해 svg 정보값을 저장함.
			svg_paths : [{
				d : string,
				fill : string
			}, 
			...]
		*/
		this.svg_paths = []; //
	}
	
	get_align_type(): string {
		const state = this.tp.tb.history.get_state().present.tpath;		
		return state.align_to_path;
	}
	
    // _time() {
    //     this.startTime = performance.now();
    // }
    // _timeEnd() {
    //     let lapse = performance.now() - this.startTime;
    //     _g.$('#time-lapse').text(lapse);
    // }

	render_svg_text(_opt?: { text?: boolean; selection?: boolean }): void {
        let tp = this.tp;

		if (tp.tb.is_initialized() == false)
            return;
            
        let opt = {text: true, selection:true}
        if (_opt) {
            opt.text = _opt.text == true;
            opt.selection = _opt.selection == true;
        }

        // selection이 없고, selection만 그려야 하는 경우 ==> 곧바로 return한다.
        let selection = tp.tb.tbcursor.sel();
        if (selection.exists_range == false && opt.text == false && opt.selection == true) {
            this.svg_text_selection = '';
            return;
        }


		let align_type = this.get_align_type();

		let domLine = tp.tb.layout!.get_tbdom().get_domLine_by_line_number(0).domLine!;
		let svg_glyph_arr = domLine.svg_glyph_arr!;

		let bbox_str = '';
		let svg_paths: SvgGlyphPath[] = [];

		svg_glyph_arr.forEach((item, index) => {
			// console.log(item);
			/*	{
					glyphPath
					glyph_width
					gx, gy
					fontColor
			}
            */
		   	
			// let p = tp.tpath.getPosByDistance(domLine.offset_left + item.gx + item.glyph_width / 2, { normal: true });
			let p = tp.inter_bracket_path!.getPosByDistance(domLine.offset_left + item.gx + item.glyph_width / 2, { normal: true });
			let angle = MathUtil.getAngle(p.nv!.x, p.nv!.y) - 90;


			let tx = 0;
			let ty = 0;
			let rotate_org_x = 0;
			let rotate_org_y = 0;
			let bbox_height = 0;
			switch (align_type) {
				case 'ascender':
					tx = p.pt.x - item.glyph_width / 2;
					ty = p.pt.y + item.ascender;
					rotate_org_x = item.glyph_width / 2;
					rotate_org_y = -item.ascender;
					bbox_height = item.gy - item.descender;
					break;
				case 'center':
					// case: center
					tx = p.pt.x - item.glyph_width / 2;
					ty = p.pt.y + item.ascender / 2;
					rotate_org_x = item.glyph_width / 2;
					rotate_org_y = -item.ascender / 2;
					bbox_height = item.gy - item.descender;
					break;
				case 'descender':
					tx = p.pt.x - item.glyph_width / 2;
					ty = p.pt.y + item.descender;
					rotate_org_x = item.glyph_width / 2;
					rotate_org_y = -item.descender;
					bbox_height = item.gy - item.descender;
					break;
				case 'baseline':
				default:
					tx = p.pt.x - item.glyph_width / 2;
					ty = p.pt.y;
					rotate_org_x = item.glyph_width / 2;
					rotate_org_y = 0;
					bbox_height = item.gy - item.descender;
					break;
			}


            // for text
            if (opt.text) {
				
				//D181820 TB_SvgLineFactory.js의 text_to_svg_paths() 참고
				svg_paths.push({
					d : item.glyphPath.toPathData(),
					fill: item.fontColor,
					fill_cmyk : item.fontColorCMYK,
					color_model : item.fontColorModel,
					transform: [
						{ translate: {x:tx, y:ty} },
						{ rotate: {a:angle, cx:rotate_org_x, cy:rotate_org_y} }
					]
				});
            }

            // for selection
            if (opt.selection) {
				let transform =
					`translate(${tx} ${ty}) ` +
					`rotate(${angle} ${rotate_org_x} ${rotate_org_y}) `;

                if (selection.begin <= index && index < selection.end) {
                    bbox_str += `
                        <rect y="${-item.gy}" width="${item.glyph_width}" height="${bbox_height}" transform="${transform}" stroke="none" fill="#c6dbfe" />
                    `
                }
            }
        })

        if (opt.selection) {
			let val = tp.tb.tbcursor.get_selection_visibility() ? 'visible' : 'hidden';
			this.svg_text_selection = `<g visibility="${val}">${bbox_str}</g>`;
		}
		
        if (opt.text) {
			// 아래 대입 순서 바뀌면 안됨.
			this.svg_paths = svg_paths
			this.svg_text = this.generate_svg_path_string();
		}
    }    

	render_svg_cursor(): void {
		let path_data = this.render_svg_cursor_datapath();			
		this.svg_cursor = `<path d="${path_data}" vector-effect="non-scaling-stroke" stroke="red" fill="transparent">
			<animate
				attributeType="XML"
				attributeName="stroke"
				from="#fff" to="#000"
				dur="0.8s"
				repeatCount="indefinite"/>
        </path>`;		
	}

	/*
	render_svg_cursor_element() {
		let el = document.createElementNS("http://www.w3.org/2000/svg", 'path')
		el.setAttribute("d", this.render_svg_cursor_datapath());
		el.style.vectorEffect = "non-scaling-stroke";
		el.style.stroke= "red";
		el.style.fill = "transparent";
		return el;
	}
	*/

	render_svg_cursor_datapath(): string {
        let tp = this.tp;

		if (tp.tb.is_initialized() == false)
			return '';
        let cursor_loc_info = tp.tb.layout!.finder.find_cursor_location_by_ci(tp.tb.tbcursor.cursor);
        // cursor 위치가 path를 넘어간 경우 cursor표시 안함.(overflow 발생)
        if (cursor_loc_info.location.li_doc > 0) {
            return '';
        }

        let p = tp.inter_bracket_path!.getPosByDistance(cursor_loc_info.x_pos, { normal: true });
        
        let b: Point, e: Point, height: number;
        switch(this.get_align_type()) {
            case 'ascender':
                b = {
                    x: p.pt.x,
                    y: p.pt.y
                }
                e = {
                    x: p.pt.x + (p.nv!.x * cursor_loc_info.max_word_height),
                    y: p.pt.y + (p.nv!.y * cursor_loc_info.max_word_height)
                }
                break;
            case 'descender':
                height = cursor_loc_info.max_word_ascent + cursor_loc_info.max_word_descent;
                b = {
                    x: p.pt.x,
                    y: p.pt.y
                }
                e = {
                    x: p.pt.x - (p.nv!.x * height),
                    y: p.pt.y - (p.nv!.y * height)
                }                 
                break;
            case 'center':
                b = {
                    x: p.pt.x - (p.nv!.x * cursor_loc_info.max_word_ascent/2),
                    y: p.pt.y - (p.nv!.y * cursor_loc_info.max_word_ascent/2)
                }
                e = {
                    x: p.pt.x + (p.nv!.x * (cursor_loc_info.max_word_ascent/2 + cursor_loc_info.max_word_descent)),
                    y: p.pt.y + (p.nv!.y * (cursor_loc_info.max_word_ascent/2 + cursor_loc_info.max_word_descent))
                }                 
                break;
            case 'baseline':
            default:
                b = {
                    x: p.pt.x,
                    y: p.pt.y
                }
                e = {
                    x: p.pt.x - (p.nv!.x * cursor_loc_info.max_word_height),
                    y: p.pt.y - (p.nv!.y * cursor_loc_info.max_word_height)
                }                 
        }

		let path_data = MathUtil.getSvgPathData_Line(b.x, b.y, e.x, e.y);
		return path_data;
    }	    
    
	render_curve(): void {
		this.svg_curve_pathdata = this.tp.tpath!.getSvgPathData();
    }
    
	render_projection_line(p: Point, q: Point): void {
		let path_data = MathUtil.getSvgPathData_Line(p.x, p.y, q.x, q.y);
		this.svg_projection_line = `<path d="${path_data}" stroke="gray" fill="transparent"/>`;
	}
	// get_projection_distance(mousepos) {
	// 	let pt_on_path = this.tpath.project(mousepos.x, mousepos.y);
	// 	let path_data = MathUtil.getSvgPathData_Line(mousepos.x, mousepos.y, pt_on_path.x, pt_on_path.y);
	// 	return MathUtil.distance(mousepos.x, mousepos.y, pt_on_path.x, pt_on_path.y)
    // }    
    
	// 최소한의 시점에만 호출할 것.
	render_outline_shape(): void {
        let tp = this.tp;

		// outline shape을 생성한다.
		if (tp.tb.is_initialized() == false)
			return;

		let upper_offset = 0;
		let lower_offset = 0;
		
		let domLine = tp.tb.layout!.get_tbdom().get_domLine_by_line_number(0).domLine!;
        switch (this.get_align_type()) {
            case 'ascender':
				upper_offset = 0;
				lower_offset = domLine.max_word_ascent + domLine.max_word_descent;
				break;
            case 'center':
				upper_offset = -domLine.max_word_ascent/2;
				lower_offset = (domLine.max_word_ascent/2) + domLine.max_word_descent;
				break;
			case 'descender':
				upper_offset = -(domLine.max_word_ascent + domLine.max_word_descent);
				lower_offset = 0;
				break;
            case 'baseline':
			default:
				upper_offset = -domLine.max_word_ascent;
				lower_offset = domLine.max_word_descent;
                break;
		}
	
		// 텍스트가 입력된 부분의 bounding shape
		let start_pos = tp.start_bracket;
		let end_pos = tp.end_bracket; //domLine.core_width;
		if (domLine.alignment_option == "fully-justified") {
			let par_attr = tp.tb.m_Par.getAttr_by_pi(0);
			end_pos = tp.end_bracket;
		}

		
		this.d_text_boudning_shape = tp.inter_bracket_path!.get_outline_svg_path(upper_offset, lower_offset, 0, tp.inter_bracket_path!.total_length)
 
		// test-B. path전체를 outline shape로 잡는 것. 
		// start_pos = tp.start_bracket;
		// end_pos = tp.end_bracket;
		// this.d_path_bounding_shape = tp.tpath.get_outline_svg_path(upper_offset, lower_offset, start_pos, end_pos);
    }
    


    get_shape_outline_css(outline_stroke_on_hover: string): string {
        return `
            .marginal-grabbing-area {
                pointer-events: stroke;
                stroke: transparent;
				stroke-width:16px;
				fill:none;
				cursor: move;
			}
			.marginal-grabbing-area:hover + .text-bounding-shape {
                stroke :  ${outline_stroke_on_hover};
			}

			.text-bounding-shape {
                pointer-events: fill;
                stroke: none;
                stroke-width:1px;
                fill:none;
            }
			.text-bounding-shape:hover {
                stroke 		 : ${outline_stroke_on_hover};
                fill 		 : none;
			}

            .path-bounding-shape {
                pointer-events: fill;
                stroke: none;
                fill:none;
			}
			.path-bounding-shape:hover {
				stroke: lightgray;
			}
            
            .text-path {
                pointer-events: none;
                stroke : lightgray;
                fill : none;
            }
        `
	}	
	
	get_svg_for_mirror(): string {
        let tp = this.tp;

		let base_transform = `
			translate(${-tp.bbox!.x}, ${-tp.bbox!.y})
		`
		let str = `
			<svg xmlns="http://www.w3.org/2000/svg" class='svg_tp' width="100%" height="100%" style='position:absolute; overflow:visible; pointer-events:none'>
				<g transform="${base_transform}">
					${this.svg_text}
				</g>
			</svg>
		`

		return str;
	}

	/* opt는 color overriding을 하기 위한 옵션 하나임
		opt = {
			override_fill_color : {
				fill: '#ffffff',
				fill_cmyk: '0,0,0,0'
			},
			cropbox?: {x, y, w, h}
			padding?: [left, top, right, bottom]
		}
	*/		
	generate_svg_path_string(opt?: SvgRenderOptions): string {
		let override_fill_color = (opt && opt.override_fill_color) ? opt.override_fill_color.fill : null;

		let svg_paths = this.svg_paths;
		if (opt && opt.render_master_color_only)
			svg_paths = this.svg_paths.filter(svg_path => svg_path.fill == opt.render_master_color_only!.fill)


		let glyphs_str = '';
		svg_paths.forEach(p => {
			let translate = p.transform[0].translate;
			let rotate = p.transform[1].rotate;

			let tx = translate.x;
			let ty = translate.y;
			if (opt && opt.cropbox) {
				tx -= opt.cropbox.x;
				ty -= opt.cropbox.y;
			}
			if (opt && opt.padding) {
				tx += opt.padding[0]; // left
				ty += opt.padding[1]; // top
			}

			let transform =
				`translate(${tx} ${ty}) ` +
				`rotate(${rotate.a} ${rotate.cx} ${rotate.cy}) `;		
				
			let fill_color = override_fill_color ? override_fill_color : p.fill;
			glyphs_str += `<path d="${p.d}" transform="${transform}" stroke="none" fill="${fill_color}"/>\n`;
				
		})

		return glyphs_str;
	}

	get_svg_for_render(opt?: SvgRenderOptions): string {
		let svg_text = this.generate_svg_path_string(opt);

		let base_transform = `
			translate(${-this.tp.bbox!.x}, ${-this.tp.bbox!.y})
		`
		let str = `
			<g transform="${base_transform}">
				${svg_text}
			</g>
		`

		return str;
	}

	get_svg_data_for_pdf(opt?: SvgRenderOptions): { x: number; y: number; svg_paths: SvgGlyphPath[] } {

		let svg_paths = this.svg_paths;
		if (opt && opt.render_master_color_only)
			svg_paths = this.svg_paths.filter(svg_path => svg_path.fill == opt.render_master_color_only!.fill)


		return {
			x: -this.tp.bbox!.x,
			y: -this.tp.bbox!.y,
			svg_paths: svg_paths
		}
	}

	draw(): void {
        let tp = this.tp;

		let base_transform = `
			scale(${tp.tb.tbconfig.page.scale})
			translate(${-tp.bbox!.x}, ${-tp.bbox!.y})
		`

		let svg_cursor = tp.cursor_visible ? this.svg_cursor : ''
		let svg_curve_pathdata = '';
		let d_textpath_on_unselected = '';
		
		let outline_stroke_on_hover = 'lightgray'

		if (tp.tb.is_state_focused()) {
			outline_stroke_on_hover = 'none';
			svg_curve_pathdata = this.svg_curve_pathdata;
		}
		else if (tp.tb.is_state_selected()) {
			outline_stroke_on_hover = 'none';			
			svg_curve_pathdata = this.svg_curve_pathdata;
		}
		else {
			d_textpath_on_unselected = this.svg_curve_pathdata;
		}

		let str_shape_outline_css = this.get_shape_outline_css(outline_stroke_on_hover);

		/*
			class="outer-grabbing-area"는 Edicus편집기에서 영역판단을 위해 class name을 이용함.

			.marginal-grabbing-area 바로 다음 .text-bounding-shape를 배치하여 마진영역 hover시에 boudnign shape가 보이도록 한다.
			(css의 '+' selector 사용)
		*/
		let str = `
			<svg xmlns="http://www.w3.org/2000/svg" class='svg_tp' width="100%" height="100%" style='position:absolute; overflow:visible; pointer-events:none'>
				<style> 
					${str_shape_outline_css}
				</style>
				<g transform="${base_transform}">
					${this.svg_text_selection}
					<path d= "${svg_curve_pathdata}" vector-effect="non-scaling-stroke" class='text-path'/>
					${this.svg_text}
					${this.svg_projection_line}
					<g class='cursor-section'>
						${svg_cursor}
					</g>

					<g class='path-bounding-shape'>
						<path d="${this.d_path_bounding_shape}" vector-effect="non-scaling-stroke" style='stroke:none'/>
						<path d="${d_textpath_on_unselected}" vector-effect="non-scaling-stroke" style="pointer-events: none"/>
					</g>			

					<g class='marginal-grabbing-area'>
						<path class="outer-grabbing-area" vector-effect="non-scaling-stroke" d="${this.d_text_boudning_shape}" />
					</g>
					<g class='text-bounding-shape'>
						<path d="${this.d_text_boudning_shape}" vector-effect="non-scaling-stroke"/>
						<path d="${d_textpath_on_unselected}" vector-effect="non-scaling-stroke" style="pointer-events: none"/>
					</g>
				</g>
			</svg>
		`

		let old_svg_tp = tp.svg_container.querySelector('.svg_tp');
		if (old_svg_tp)
			tp.svg_container.removeChild(old_svg_tp);
		tp.svg_container.insertAdjacentHTML('afterbegin', str);
	}    


}

export { TB_TextOnPath_Draw }