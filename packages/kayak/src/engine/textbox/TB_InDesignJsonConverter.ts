import textbox from "./TextBox";
import GT_MasterClipboard from "../segment/master_clipboard";
import { TB_Path } from '../geometry/TB_Path'

import * as log from "loglevel";
import cloneDeep from 'lodash/cloneDeep';
import type { TextBoxHost, CiRange, FontList, IndColor, IndTextObject, IndTextPath, IndTextFrame, IndFramePreferences,
    IndConvertOptions, IndConvertResult, IndParsedColor, IndParsedSolidColor, IndParsedShadow } from './types';
import type { TextOnPathSaveData } from '../geometry/types';
import type { StrokeSpec } from '../segment/types';

/* 
	InDesign DOM
	
	class Text 문서
	- http://jongware.mit.edu/idcs6js/pc_Text.html

	분석해 보니 아래처럼 맵핑된 것 같음.
	"type":"TextFrame" --> TextFrame    http://jongware.mit.edu/idcs6js/pc_TextFrame.html
	"text_list" --> Texts               http://jongware.mit.edu/idcs6js/pc_Text.html


	InDeisgn 화면체계
	- 인디자인의 px값은 72dpi 화면 기준. 화면 표시는 (디바이스에 따라)96dpi 임
	- Kayak내에서는 값 및 표시 모두 96dpi 체계임.
	- 따라서 raw device 화면은 96dpi이므로, (인디자인 px value) x (92/72) 해야 인디자인과 동일

	17.10.23
	- json parsing중 '\r'은 버려지니 json문자열에 \r대신 \n이 사용되는지 확인 할 것. 

*/
class TB_InDesignJsonConverter {
	opt: IndConvertOptions;
	toPx: (val: number) => number;
	tb: TextBoxHost;   // schema 모드 textbox
	rng: CiRange;

	constructor(opt: IndConvertOptions) {
		this.opt = {} as IndConvertOptions;
		Object.assign(this.opt, opt);
		this.toPx = function(){} as unknown as (val: number) => number;   // build()가 바로 덮어쓴다

		this.tb = this.build();
		this.rng = {begin:0, end:0};

		// nodejs에서 사용하기 위한 설정임. node v8이상 되어야 padStart사용가능하기 때문에 polyfill 사용함.
		// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
		if (!String.prototype.padStart) {
			String.prototype.padStart = function padStart(targetLength,padString) {
				targetLength = targetLength>>0; //floor if number or convert non-number to 0;
				padString = String(padString || ' ');
				if (this.length > targetLength) {
					return String(this);
				}
				else {
					targetLength = targetLength-this.length;
					if (targetLength > padString.length) {
						padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
					}
					return padString.slice(0,targetLength) + String(this);
				}
			};
		}

	}

	build(): TextBoxHost {
		switch (this.opt.src_unit) {
			case 'mm' :
				this.toPx = this._conv_mm_to_px; break;
			case 'indesign_px' :
				this.toPx = this._conv_indesign_px_to_px; break;
			default:
				throw {err: 'not supported source unit.'}
		}

		return  new textbox({
			schema: true,
			masterClipboard: GT_MasterClipboard.getInstance()
		}); 
	}

	/*
		ind json → kayak json 변환시 [font.full_name] ⇒ [font.preferredFamily]로 보정한다.
		이전의 font-list는 fullname을 포함하지 않고 있으므로, 이를 포함하여 생성하고 (19.2.28 이후는 이 기능 포함됨)
		ind json의 "font family"(실제는 fullname정보)를 font-list의 fullname 항목에서 찾기.
		kayak json에 저장되는 font family는 font-list상의 key값에 해당하는 famil-name으로 변경 저장되어야 한다.		
	*/
	remap_font_family(text_list: IndTextObject[], callback?: (remap_occurred: boolean) => void): void {
		let font_list = this.opt.font_list!;
		let ff_keys = Object.keys(font_list); // font-family keys

		let flag_remap_occurred = false;
		text_list.forEach(text_obj => {
			//text_obj.font_family
			if (font_list[text_obj.font_family])
				return;

			let stop = false;
			for(let i=0; i<ff_keys.length; i++) {
				let font_family_key = ff_keys[i];
				let style_keys = Object.keys(font_list[font_family_key].style)
				for(let j=0; j<style_keys.length; j++) {
					let style_key = style_keys[j];
					if (font_list[font_family_key].style[style_key].full_name == text_obj.font_family) {
						// font family found
						console.log(`>>>>#1 font-family mapped from "${text_obj.font_family}" to "${font_family_key}"`);
						text_obj.font_family = font_family_key;
						stop = true;
						flag_remap_occurred = true;
						break;
					}
					// 주로 otf에서 아래 방식으로 매칭되는 경우가 있음.
					let familyName_candidate  = font_family_key + ' ' + style_key;
					if (familyName_candidate == text_obj.font_family) {
						// font family found
						console.log(`>>>>#2 font-family mapped from "${text_obj.font_family}" to "${font_family_key}"`);
						text_obj.font_family = font_family_key;
						stop = true;
						flag_remap_occurred = true;
						break;
					}

				}
				if (stop)
					break;
			}
		})
		
		callback && callback(flag_remap_occurred)
	}

	load_json(ind_item: string | IndTextFrame, d_path?: string): IndConvertResult {
		let textframe_obj: IndTextFrame = null!;
		if (typeof ind_item == 'string') {
			textframe_obj = JSON.parse(ind_item);
		}
		else {
			textframe_obj = ind_item;
		}
		 
		// textframe_obj.frame.origin;
		// textframe_obj.frame.size;

		let dim_px = this.get_box_dimension_px(textframe_obj);
		let flag_font_family_remapped = false;

		if (textframe_obj.type == 'TextFrame') {
			if (textframe_obj.text_paths) {
				this.remap_font_family(textframe_obj.text_paths[0].text_list, (remap_occurred) => {
					if (remap_occurred)
						flag_font_family_remapped = true;
				});
				textframe_obj.text_paths[0].text_list.forEach(text_obj => {
					this.push_text(text_obj);
				})
			}
			else {
				if (textframe_obj.textFramePreferences) {
					this.set_vertical_justification(textframe_obj.textFramePreferences, dim_px)
				}

				this.remap_font_family(textframe_obj.text_list!, (remap_occurred) => {
					if (remap_occurred)
						flag_font_family_remapped = true;
				});
				textframe_obj.text_list!.forEach(text_obj => {
					this.push_text(text_obj, dim_px);
				})
			}
		}

		// 마지막에 적용된 style을 last-$에도 적용함.
		let text_list: IndTextObject[] | null = null;
		if (textframe_obj.text_list && textframe_obj.text_list.length > 0)
			text_list = textframe_obj.text_list;
		else if (textframe_obj.text_paths && textframe_obj.text_paths.length > 0 && textframe_obj.text_paths[0].text_list)
			text_list = textframe_obj.text_paths[0].text_list;
		
		if (text_list)
			this.set_last_style(text_list[text_list.length-1], dim_px);
		else
			log.warn('text_list of TextFrame is empty.')
		/////////////////////////////////////////////////////////////////

		var kayak_json_obj = this.tb.saveAsJson({font_list:this.opt.font_list});
		// 2018.2.28. RedPrint에서 Indesign에서 생성한 json에 적용하는 값임.
		kayak_json_obj.meta!.linebreak_tolerance = 2;

		if (textframe_obj.text_paths && textframe_obj.paths && d_path) {
			kayak_json_obj.text_on_path = this.parse_textonpath(textframe_obj.text_paths[0], d_path);
		}

		return {
			kayak_json: kayak_json_obj,
			dim_px : dim_px,
			font_family_remap_occurred : flag_font_family_remapped
		}
	}

	parse_textonpath(ind_text_path: IndTextPath, d_path: string): TextOnPathSaveData {
		let text_on_path: TextOnPathSaveData = {
			//svg_path_data: 'M100,200C45,200,0,155,0,100C0,45,45,0,100,0C155,0,200,45,200,100C200,155,155,200,100,200', 
			svg_path_data: d_path,
			flip_path: ind_text_path.flip_path_effect == "FLIPPED" ? true : false,
			align_to_path: 'baseline',
			start_bracket: 0,
			end_bracket: 0,
		}

		// interpret text_alignment
		if (ind_text_path.text_alignment == "CENTER_TEXT_ALIGNMENT")
			text_on_path.align_to_path = 'center';
		else if (ind_text_path.text_alignment == "ASCENDER_TEXT_ALIGNMENT")
			text_on_path.align_to_path = 'ascender';
		else if (ind_text_path.text_alignment == "DESCENDER_TEXT_ALIGNMENT")
			text_on_path.align_to_path = 'descender';

		// interpret bracket values
		// indesign에서 bracket 값의 단위는 point임. point --> mm로 환산함.
		let start_bracket_mm = 0, end_bracket_mm = 0
		if (ind_text_path.start_bracket !== undefined && ind_text_path.start_bracket !== null)
			start_bracket_mm = ind_text_path.start_bracket * 25.4 / 72;
		if (ind_text_path.end_bracket !== undefined && ind_text_path.end_bracket !== null)
			end_bracket_mm = ind_text_path.end_bracket * 25.4 / 72;

		/*
			closed path일때 
			- d_path는 ccw방향이며
			- ind_item.start_bracket은 원점에서 ccw방향으로의 distance임.
			- 그러나 TB_TextOnPath에서는 path를 cw로 돌려 계산하므로 
			- tpath_length로부터 bracket 값을 빼 준다.

			indesign에서의 bracket 값의 단위는 mm이다. 
			bracket값은 text-on-path의 bbox가 변해도 같이 변하지 않는다.

			이 위치에서 this.tpath_length는 mm값이다.

			19.4.3 ToDo
			- cw closed path에 대한 대응이 필요함.
			- closed path의 flip상태에 대한 처리가 필요함.
		*/
		let path_is_closed = TB_Path.is_closed(d_path);
		let tpath = new TB_Path(d_path, {flip:path_is_closed});
		let tpath_length = tpath.getLength();

		// clamping bracket position 
		if (start_bracket_mm > tpath_length)
			start_bracket_mm = tpath_length;
		if (end_bracket_mm > tpath_length)
			end_bracket_mm = tpath_length;

		// mm --> pixel(96dpi)
		let mmTo96px = 96 / 25.4;
		if (path_is_closed) {
			let val = tpath_length - start_bracket_mm;
			text_on_path.start_bracket = val * mmTo96px;
			val = tpath_length - end_bracket_mm;
			text_on_path.end_bracket = val * mmTo96px;
		}
		else {
			if (!text_on_path.flip_path) {
				text_on_path.start_bracket = start_bracket_mm * mmTo96px;
				text_on_path.end_bracket = end_bracket_mm * mmTo96px;
			}
			else {
				text_on_path.start_bracket = end_bracket_mm * mmTo96px;
				text_on_path.end_bracket = start_bracket_mm * mmTo96px;
			}
		}
		return text_on_path;
	}


	get_box_dimension_px(textframe_obj: IndTextFrame): { width: number; height: number } {
		let dim_px = {
			width  : this.toPx(textframe_obj.frame.size.width),
			height : this.toPx(textframe_obj.frame.size.height)
		}
		// console.log(dim_px)
		return dim_px;
	}

	fix_font_family(text_obj: IndTextObject): void {
		let font_list = this.opt.font_list!;
		if (font_list[text_obj.font_family])
			return;
		if (text_obj.postscriptName == null || text_obj.postscriptName.length === 0) // postscriptName이 없으면 할 수 있는 것이 없음.
			return;

		let ff_keys = Object.keys(font_list);
		for(let i=0; i<ff_keys.length; i++) {
			let font_family_key = ff_keys[i];
			if (text_obj.postscriptName === font_list[font_family_key].family.postscriptName) {
				text_obj.font_family = font_family_key;
				console.log(`>>>>#3 font-family mapped from "${text_obj.font_family}" to "${font_family_key}"`);
				break;
			}
		}	
	}

	push_text(text_obj: IndTextObject, dim_px?: { width: number; height: number }): void {
		this.fix_font_family(text_obj);
		this.rng.begin = this.tb.tbcursor.cursor;
		this.rng.end = this.rng.begin + text_obj.contents.length;
		
		// text_obj.contents에 개행문자료 '\r'이 있으면 json parsing과정에서 탈락되는 문제가 있으니 참고.
		// \n은 정상적으로 문자열로 넘어옴.
		this.tb.opEdit.insert_multiline_string(this.tb.tbcursor.cursor, text_obj.contents);
		// console.log(text_obj.char_style);
		// console.log(text_obj.para_style);

		this.set_style(text_obj, dim_px);
	}
	set_last_style(text_obj: IndTextObject, dim_px?: { width: number; height: number }): void {
		this.rng.begin = this.tb.tbcursor.cursor;
		this.rng.end = this.tb.tbcursor.cursor + 1;
		this.set_style(text_obj, dim_px);
	}

	set_style(text_obj: IndTextObject, dim_px?: { width: number; height: number }): void {
		if (text_obj.kerning != 'Metrics') {
			log.warn(`not support "${text_obj.kerning}" kerning`);
		}

		this.tb.opStyle.set_font_size(text_obj.font_size, this.rng); // text_obj.font_size 단위는 pt임.
		this.tb.opStyle.set_font_family(text_obj.font_family, text_obj.font_style, this.rng);
		this.tb.opStyle.set_letter_space(text_obj.tracking, this.rng);
		this.tb.opStyle.set_letter_scale_x(text_obj.h_scale, this.rng);
	 
		this.tb.opStyle.set_text_align(this.get_align_code(text_obj.justification), this.rng);
		this.tb.opStyle.set_par_style('first', text_obj.first_indent, this.rng)
		this.tb.opStyle.set_par_style('left', text_obj.left_indent, this.rng)
		this.tb.opStyle.set_par_style('right', text_obj.right_indent, this.rng)
		this.tb.opStyle.set_par_style('space_before', text_obj.space_before, this.rng)
		this.tb.opStyle.set_par_style('space_after', text_obj.space_after, this.rng)

		// let color = this.parse_indesign_color(text_obj.fill_color, text_obj.gradient_fill);
		let color = this.parse_indesign_color(text_obj, dim_px);
		// InDesign 변환은 cmyk를 '100,0,0,0' 문자열로, gradient geom을 '50%' 문자열로 넘긴다 (원본 그대로). issues.md #16
		this.tb.opStyle.set_fontColor(color.rgb as any, color.cmyk as any, color.model, this.rng);

		let stroke = this.parse_stroke(text_obj)
		if (stroke) {
			// console.log(stroke)
			this.tb.opStyle.set_stroke(stroke, this.rng)
		}

		let dropShadow = this.parse_dropShadow(text_obj)
		if (dropShadow) {
			this.tb.opStyle.set_shadow(dropShadow as any, this.rng);   // size/distance가 toFixed(2) 문자열. issues.md #16
		}

		this.tb.opStyle.set_par_style('line_space', text_obj.auto_leading/100, this.rng);

		if (text_obj.leading) {
			var leading_val: 'auto' | number = (text_obj.leading == 'AUTO') ? 'auto' : parseFloat(text_obj.leading as string);
			this.tb.opStyle.set_par_style('leading', leading_val, this.rng);
		}
	}

	set_vertical_justification(val: IndFramePreferences, dim_px: { width: number; height: number }): void {
		switch(val.autoSizingType) {
			case 'OFF': {
				switch(val.verticalJustification) {
					case 'CENTER_ALIGN': 
						this.tb.opStyle.set_vertical_align('center');
						break;
					case 'BOTTOM_ALIGN': 
						this.tb.opStyle.set_vertical_align('bottom');
						break;
					default:
						this.tb.opStyle.set_vertical_align('top');
				}
				this.tb.opStyle.set_frame_height(dim_px.height)
				break;
			}
			case 'HEIGHT_ONLY':
			default: {
				// this.tb.opStyle.set_frame_height(dim_px.height)
				// this.tb.opStyle.set_fit_to_content_height(true);

				/*
					indesign에 여러 옵션이 있지만, autoSizingType이 OFF가 아닌 경우에는 항상 아래의 경우로 취급한다.
						val.autoSizingType : 'HEIGHT_ONLY'
						val.autoSizingReferencePoint : "TOP_CENTER_POINT"
				*/
				break;
			}
		}

	}


	//--------------------------------------------------------------------------------------------------
	//--------------------------------------------------------------------------------------------------

	_conv_indesign_px_to_px(val: number): number {
		// 1px(InDesign) = 1.333px (kayak, 1x96/72)
		return val * 1.3333333;
	}
	_conv_mm_to_px(mm_val: number): number {
		/*  25.4(mm) = 96(px)   in 96dpi
			1px = 1mm x 96 / 25.4
		*/
		return mm_val * 96 / 25.4;
	}

	get_align_code(val: string): string {
		let ret = '';
		switch(val) {
			case 'LEFT_ALIGN':
				ret = 'left';
				break;
			case 'CENTER_ALIGN':
				ret = 'center';
				break;
			case 'RIGHT_ALIGN':
				ret = 'right';
				break;
			case 'LEFT_JUSTIFIED':
				ret = 'left-justified';
				break;
			case 'CENTER_JUSTIFIED':
				ret = 'center-justified';
				break;
			case 'RIGHT_JUSTIFIED':
				ret = 'right-justified';
				break;
			case 'FULLY_JUSTIFIED':
				ret = 'fully-justified';
				break;
			default:
				ret = 'left';
				break;                
		}
		return ret;
	}

	parse_stroke(text_obj: IndTextObject): StrokeSpec {
		// InDesign은 선 색이 [None]이면 stroke_color를 null로 내보낸다. undefined와 같이 "선 없음"으로 본다.
		if (text_obj.stroke_weight === undefined || text_obj.stroke_color == null) {
			return {
				weight: 0,
				align: 'outside',
				color: '#000',
				join   : 'round',
				miterlimit: 10
			}
		}

		let color_obj = this._parse_indesign_solid_color(text_obj.stroke_color);
		let align = 'outside'
		switch(text_obj.stroke_alignment) {
			case 'OUTSIDE_ALIGNMENT':
				align = 'outside'; break;
			case 'CENTER_ALIGNMENT':
				align = 'center'; break;
		}

		let endjoin = 'round';
		switch(text_obj.stroke_endjoin) {
			case 'ROUND_END_JOIN':
				endjoin = 'round'; break;
			case 'BEVEL_END_JOIN':
				endjoin = 'bevel'; break;
			case 'MITER_END_JOIN':
				endjoin = 'miter'; break;
		}

		let miterlimit = 10;
		if (endjoin == 'miter')
			miterlimit = text_obj.stroke_miterlimit!
		let ret: StrokeSpec = {
			weight: text_obj.stroke_weight,
			align: align,
			color: color_obj.rgb,
			join: endjoin,
			miterlimit: miterlimit
		}

		return ret;
	}

	parse_dropShadow(text_obj: IndTextObject): IndParsedShadow {
		if (text_obj.dropShadow == undefined) {
			return {
				size : 0,
				angle  : 135,
				distance  : 0,
				opacity  : 100,
				shadow : '#000'
			};
		}

		let color_obj = this._parse_indesign_solid_color(text_obj.dropShadow.color);
		let ret: IndParsedShadow = {
			size: text_obj.dropShadow.size.toFixed(2), //this._conv_mm_to_px(text_obj.dropShadow.size),
			angle : text_obj.dropShadow.angle,
			distance: text_obj.dropShadow.distance.toFixed(2), //this._conv_mm_to_px(text_obj.dropShadow.distance),
			opacity: text_obj.dropShadow.opacity,
			color: color_obj.rgb
		}

		return ret;
	}

	parse_indesign_color(text_obj: IndTextObject, dim_px?: { width: number; height: number }): IndParsedColor {
		//text_obj.fill_color, text_obj.gradient_fill
		if (text_obj.fill_color.gradientType ==  "LINEAR") {
			return this._parse_indesign_linear_gradient(text_obj, dim_px!);
		}
		else {
			return this._parse_indesign_solid_color(text_obj.fill_color)
		}
	}

	/*
		indesign에서 받은 gradient 정보를 kayak gradient로 변경한다.
		문서참고: https://docs.google.com/presentation/d/1xPnIWDIS8WCHorgSA70U--PBZoEo0EpS-bbyq2C6HKU/edit#slide=id.g5e30f3eabe_0_0 (Gradient 페이지 볼것)

		#인디자인의 gradient 정보구조
		  1. start[x, y]
		  2. length
		  3. angle

		특징
		"그레이디언트" 패널에서 값을 설정하면 값의 구조는 아래와 같다.
		  1. start[x,y] => [0, 0]
		  2. length => textframe의 width
		  3. angle => textframe의 center가 중점


		gradient가 kayak으로 변환되면 위의 시작점,끝점 정보(x1,y1,x2,y2)로 변환된다. 
		단위는 textframe을 기준으로 %값이 되며, svg로 1:1 맵핑된다.

		#인디자인에서 변환
		인디자인에서 kayak으로 변환될 때 angle값은 0이됨.
		즉, (x1,y1)을 중점으로 회전되거나 하지 않음 

		
	*/
	_parse_indesign_linear_gradient(text_obj: IndTextObject, dim_px: { width: number; height: number }): IndParsedColor {
		let fill_color = text_obj.fill_color;
		let gradient_fill = text_obj.gradient_fill!;
		console.log(fill_color)

		/*	단위 (gradient_fill내에서 단위가 다름. 희한함)
			gradient_fill.start[] : 각각 mm
			gradient_fill.length  : indesign px
		*/
		let grad_length_px = this._conv_indesign_px_to_px(gradient_fill.length)
		// mm
		let x1_px = this._conv_mm_to_px(gradient_fill.start[0]);
		let x2_px = this._conv_mm_to_px(gradient_fill.start[0]) + grad_length_px * Math.cos(gradient_fill.angle* Math.PI / 180);
		let y1_px = this._conv_mm_to_px(gradient_fill.start[1]);
		let y2_px = this._conv_mm_to_px(gradient_fill.start[1]) - grad_length_px * Math.sin(gradient_fill.angle* Math.PI / 180);

		// mm -> %
		let x1 = Math.round(100 * x1_px / dim_px.width);
		let x2 = Math.round(100 * x2_px / dim_px.width);
		let y1 = Math.round(100 * y1_px / dim_px.height);
		let y2 = Math.round(100 * y2_px / dim_px.height);

		/*
			항상 위치는 textframe을 기준으로 %값으로 유지한다.
		*/
		let gradient_obj: { type: string; geom: Record<string, string>; stops: { offset: string; rgb: string; cmyk?: number[] }[]; angle: number } = {
			type: "linear",
			geom: {
				x1: x1 + '%',
				y1: y1 + '%',
				x2: x2 + '%',
				y2: y2 + '%'
			},
			stops:[
				// 참고를 위해 남겨둠.
				// { offset:"0%",   rgb: '#ff0000', cmyk: [0, 100, 100, 0] },
				// { offset:"100%", rgb: '#00ff00', cmyk: [100, 0, 100, 0] }
			],
			angle: 0
		}

		// color stop 값을 채워넣음
		fill_color.gradientStops!.forEach(stop => {
			let c = this._parse_indesign_solid_color(stop.stopColor);
			console.log(c)
			let tmp: { offset: string; rgb: string; cmyk?: number[] } = {
				offset: stop.location+'%',
				rgb: c.rgb
			}
			if (c.cmyk_arr)
				tmp.cmyk = c.cmyk_arr
			gradient_obj.stops.push(tmp)
		})

		return {
			rgb: gradient_obj
		}
	}

	_parse_indesign_solid_color(fill_color: IndColor): IndParsedSolidColor {
		let ret: IndParsedSolidColor | null = null

		if (fill_color.rgb_color){
			let r = Math.round(fill_color.rgb_color[0]);
			let g = Math.round(fill_color.rgb_color[1]);
			let b = Math.round(fill_color.rgb_color[2]);
			
			let rgb = '#' + r.toString(16).padStart(2, '0')
				+ g.toString(16).padStart(2, '0')
				+ b.toString(16).padStart(2, '0')
			
			ret = {
				rgb : rgb
			}				
		}
		else {
			ret = {
				rgb : '#000000'
			}
		}

		if (fill_color.src_color && fill_color.src_color_space == "CMYK") {
			ret.cmyk = fill_color.src_color.join(',');
			ret.cmyk_arr = fill_color.src_color;
		}
		if (fill_color.model) {
			ret.model = cloneDeep(fill_color.model);
		}

		return ret;
	}
}
/*
		else if (obj.space == 'RGB'){
			let r = Math.round(obj.color_value[0]);
			let g = Math.round(obj.color_value[1]);
			let b = Math.round(obj.color_value[2]);
			
			let rgb = '#' + r.toString(16).padStart(2, '0')
				+ g.toString(16).padStart(2, '0')
				+ b.toString(16).padStart(2, '0')
			
			ret = {
				rgb : rgb
			}				
		}
		else if (obj.space == 'CMYK') {
			let C = obj.color_value[0];
			let M = obj.color_value[1];
			let Y = obj.color_value[2];
			let K = obj.color_value[3];
			
			let r = Math.round(255 * (1 - C/100) * (1 - K/100))
			let g = Math.round(255 * (1 - M/100) * (1 - K/100))
			let b = Math.round(255 * (1 - Y/100) * (1 - K/100))

			let rgb = '#' + r.toString(16).padStart(2, '0') 
				+ g.toString(16).padStart(2, '0') 
				+ b.toString(16).padStart(2, '0');
			// console.log(rgb)

			ret = {
				rgb : rgb
			}
		}
*/


export { TB_InDesignJsonConverter }