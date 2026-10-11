import TB_Dom from '../textbox/TB_Dom';
import Bezier from 'bezier-js';
import { TB_Path } from './TB_Path'
import { MathUtil } from './MathUtil'
import { CGMatrix } from '../textbox/cg'
import { TB_TextOnPath_MouseInput } from './TB_TextOnPath_MouseInput'
import { TB_TextOnPath_Draw } from './TB_TextOnPath_Draw'
import { TB_TextOnPath_Bracket } from './TB_TextOnPath_Bracket'
import type { Point, Rect, ProjectResult, TextOnPathOptions, TextOnPathSaveData, ViewChangeData, TextBoxHost } from './types'

/*
	InDesign text-on-path의 특성
	- open path와 closed path에 따라 속성이 다름
	- closed path는 winding 방향이 ccw임 
	
	bracket (closed path의 경우)
	- CEP에서 최초 얻는 bracket 값의 단위는 point임
	- kayak이 값을 받을 때는 mm로 환산된 값을 받음 (edicus-prepress의 ind2doc.ts 참고)
	- kayak에서 mm를 px로 변환함.
	- bracket 값은 path의 시작점으로 부터의 거리이다.
	- 표시되는 글줄은 bracket_start에서 bracket_end로 cw방향임

	kayak에서의 처리
	- kayak내에서의 path는 항상 cw방향이다.
	- closed path인 경우
	  svg_path_data가 closed path이면 곡선을 뒤집어 cw방향으로 생성한다.
	  indesign으로부터 받은 bracket start~end구간은 cw로 해석해야 하기 때문에 
	  곡선을 ccw에서 cw로 만들었다면 bracket값은 (cw_path_length - brakcet_value)로 처리해야 함.
	- bracket값은 text-on-path의 bbox가 변해도 같이 변하지 않는다.
*/

class TB_TextOnPath {
	tb: TextBoxHost;
	svg_container: HTMLElement;
	svg_path_data: string;
	svg_tp: Element | null;
	tpath_org: TB_Path | null;
	bbox_org: Rect | null;
	tpath: TB_Path | null;
	tpath_length: number;
	bbox: Rect | null;
	mat: CGMatrix;
	mat_bbox: CGMatrix;
	current_flip_path: boolean;
	cursor_visible: boolean;
	inter_bracket_path: TB_Path | null;
	// init_1 / init_2에서 채운다
	start_bracket!: number;
	end_bracket!: number;
	tp_draw!: TB_TextOnPath_Draw;
	tp_bracket!: TB_TextOnPath_Bracket;
	mi!: TB_TextOnPath_MouseInput;

	// opt : { svg_path_data, align_to_path }
	constructor(textbox_obj: TextBoxHost, opt: TextOnPathOptions) {
		this.tb = textbox_obj;

		this.svg_container = this.tb.tbconfig.element_textonpath!;
		this.svg_path_data = opt.svg_path_data!;
		this.svg_tp = null;
		this.tpath_org = null;
		this.bbox_org = null;
		this.tpath = null;
		this.tpath_length = 0;
		this.bbox = null;
		this.mat = new CGMatrix();
		this.mat_bbox = new CGMatrix();
		this.current_flip_path = false;
		this.cursor_visible = false;

		this.inter_bracket_path = null;

		/////////////////////////////////////////////////////////////////
		this.init_0()
		this.init_1(opt)
		this.init_2()
		/////////////////////////////////////////////////////////////////

	}

	init_0(): void {
		// 기본 path를 생성한다.
		// 만약 closed path이면 cw방향으로 뒤집어 생성한다. (indesign에서 closed path는 ccw임)
		this.tpath_org = this.build_path();
		this.bbox_org = this.tpath_org.getBbox();

		this.tpath = this.tpath_org.clone();
		this.tpath_length = this.tpath.getLength();
	}

	init_1(opt: TextOnPathOptions): void {
		this.start_bracket = 0;
		this.end_bracket = this.tpath_length;

		if (typeof opt.start_bracket === 'number')
			this.start_bracket = opt.start_bracket;
		if (typeof opt.end_bracket === 'number')
			this.end_bracket = opt.end_bracket;

		// 초기정보는 dispatch()로 설정함. history가 +2만큼 증가한 것이 최초 상태임.
		// const state = this.tb.history.get_state();
		this.tb.history.dispatch({
			type: 'TPath.ALIGN',
			align_to_path: opt.align_to_path,
		})
		this.tb.history.dispatch({
			type: 'TPath.FLIP_PATH',
			flip_path: opt.flip_path,
		})
		this.tb.history.dispatch({
			type: 'TPath.START_BRACKET',
			value: this.start_bracket
		})
		this.tb.history.dispatch({
			type: 'TPath.END_BRACKET',
			value: this.end_bracket
		})
	}

	init_2(): void {
		this.tp_draw = new TB_TextOnPath_Draw(this);
		this.tp_bracket = new TB_TextOnPath_Bracket(this);

		this.get_prepared();

		this.mi = new TB_TextOnPath_MouseInput(this);		
		this.setup_mouse_input();
		this.setup_keyboard_input();
	}
	
	get_prepared(): void {
		this.setup_svg_root();

		this.bbox = this.tpath!.getBbox();
		this.tp_draw.svg_bbox = this.tpath!.getSvgRect(this.bbox)
		this.calc_transform();
		
		this.tp_draw.render_curve();

		this.tp_bracket.generate_inter_bracket_path(this.start_bracket, this.end_bracket)
		this.resize_tb(this.inter_bracket_path!.total_length);
	}


	/*
		InDesign에서 text-on-path 특징
		- textpath로 제공된 path가 closed path이면 방향성이 ccw이다. (open path이면 path와 순방향)
		- bracket 사이공간에서 정의되는 path는 cw이다. 

		확인사항
		- begin, end가 this.tp.tpath의 범위 내인지 확인
		- this.tp.tpath가 closed path이면 inter-bracket-path는 역방향으로 값을 얻을 것.
	*/
	build_path(): TB_Path {
		let svg_path_data = this.svg_path_data;
		if (svg_path_data == undefined)
			svg_path_data = this.get_default_pathdata();

		let path_is_closed = TB_Path.is_closed(svg_path_data);
		let tpath = new TB_Path(svg_path_data, {flip:path_is_closed});
		
		tpath.precalc_length();
		return tpath;
	}
	get_default_pathdata(): string {
		return 'M50, 150 C150, 80, 200, 80, 250, 150'
	}
	// build_path() {
	// 	let tpath = new TB_Path();
	// 	tpath.moveTo(50, 150);
	// 	tpath.curveTo(150, 80, 200, 80, 250, 150);
	// 	tpath.curveTo(300, 230, 400, 230, 450, 150);
	// 	tpath.lineTo(550, 130);
	// 	tpath.precalc_length();
	// 	return tpath;
	// }
	// build_path() {
	// 	let tpath = new TB_Path();
	// 	tpath.moveTo(0, 100);
	// 	tpath.curveTo(0, 45, 45, 0, 100, 0);
	// 	tpath.curveTo(155, 0, 200, 45, 200, 100);
	// 	tpath.curveTo(200, 155, 155, 200, 100, 200);
	// 	tpath.curveTo(45, 200, 0, 155, 0, 100);
	// 	return tpath;
	// }
	

	/* 
		start/end bracket
		  textbox의 left/right indent를 사용하므로 저장할 것이 없음.
		align-to-path
		  저장필요
	*/
	save(): TextOnPathSaveData {
		const state = this.tb.history.get_state().present.tpath;
		
		let save_obj = {
			svg_path_data : this.svg_path_data,
			align_to_path : state.align_to_path,
			flip_path     : state.flip_path,
			start_bracket : state.start_bracket,
			end_bracket   : state.end_bracket
		}

		return save_obj;
	}


	setup_svg_root(): void {
		this.svg_tp = TB_Dom.createElement(`<svg class='svg_tp'></svg>`);
		this.svg_container.appendChild(this.svg_tp);
	}
	
	show_cursor(val: boolean): void {
		this.cursor_visible = val ? true : false;
		if (val == false)
			this.tp_draw.svg_cursor = '';
		this.draw_all();		
	}
	
	/* 
		path가 x/y축에 나란한 직선인 경우 별도 처리 해야함.
		path bbox의 width/height가 0에 수렴하면 아래의 scale계산이 안됨.
	*/
	set_bbox(width: number, height: number): void {
		let scale_x = width / this.bbox_org!.width;
		let scale_y = height / this.bbox_org!.height;
		this.mat_bbox.setScale(scale_x, scale_y);

		this._rebuild_tpath_from_org();
		this.get_prepared();
        this.update_view();		
	}
	_rebuild_tpath_from_org(): void {
		let flip_path = this.tb.history.get_state().present.tpath.flip_path;
		this.tpath = this.tpath_org!.clone(this.mat_bbox, flip_path);
		this.tpath_length = this.tpath.getLength();
		this.tp_draw.svg_projection_line = '';		
	}
	

	calc_transform(opt?: { angle_only?: boolean }): void {
		// bbox의 lt를 원점으로 하고, scale적용함.

		let page_scale = this.tb.tbconfig.page.scale;

		// for mouse position transform
		this.mat.set();
		this.mat.translate(this.bbox!.x, this.bbox!.y);
		this.mat.scale(1/page_scale, 1/page_scale);


		if (opt && opt.angle_only) {
			// this.svg_container.style의 width/height를 변경하지 않음.
		}
		else {
            this.svg_container.style.width = (this.bbox!.width * page_scale) + 'px';
            this.svg_container.style.height = (this.bbox!.height * page_scale) + 'px';
			// console.log(`calc_transform() called. angle(${this.tb.tbconfig.transform.angle})`, this.bbox)
		}
	}

	// parent에서 scale이 변경된 경우 호출됨.
	scale_changed(val?: number): void {
		this.calc_transform();

		// this.update_view()
		// --> scale만 변경된 경우 redraw하는 정도로 가능한지 시도해 볼것.
		// this.tp_draw.render_svg_text();
		if (this.tb.is_initialized())
			this.tp_bracket.render();		
		this.draw_all();
	}
	angle_changed(val?: number): void {
		this.calc_transform({angle_only:true});

		// this.update_view()
		// --> scale만 변경된 경우 redraw하는 정도로 가능한지 시도해 볼것.
		// this.tp_draw.render_svg_text();
		this.draw_all();		
	}

	on_blur(): void {
		this.tp_draw.svg_projection_line = '';
		this.tp_bracket.show_brackets(false);
		this.tp_bracket.show_overflow_mark(false);
	}
	on_select(): void {
		this.tp_bracket.show_brackets(true);
		this.tp_bracket.show_overflow_mark(false);
	}
	on_focus(): void {
		this.tp_bracket.show_brackets(false);
		this.tp_bracket.show_overflow_mark(true);
	}



	/*
		TextBox::document_changed()가 호출되면 우선적으로 호출됨.
	*/
	update_cursor(): void {
		if (this.tb.is_initialized() == false)
			return;

		// console.log('update_cursor() called.')

		this.tp_draw.render_svg_text({selection:true});			
		this.tp_draw.render_svg_cursor();
		this.draw_all();

		// let $el = _g.$(this.svg_container).find('.cursor-section');
		// $el.empty();
		// let svg_cursor_el = this.tp_draw.render_svg_cursor_element();
		// $el.append(svg_cursor_el);
		
	}
	update_view(change_data?: ViewChangeData): void {
		if (this.tb.is_initialized() == false)
			return;
		// console.log('update_view() called.')

		// document_changed가 발생하여 호출된 경우. 
		if (change_data) {
			if (change_data.cmd == 'initialized') {
				this.tpath_length = this.tpath!.getLength(); // 필요한가?
				this.resize_tb(this.inter_bracket_path!.total_length);				
			}

			let present = this.tb.history.get_state().present;
			// update if flip_path value was changed.			
			let flip_path = present.tpath.flip_path;
			if (this.current_flip_path != flip_path) {
				this._rebuild_tpath_from_org();		
				this.current_flip_path = flip_path;
				this.tp_bracket.generate_inter_bracket_path(this.start_bracket, this.end_bracket)
				this.resize_tb(this.inter_bracket_path!.total_length);
			}

			if (change_data.cmd == 'TPath.START_BRACKET' || change_data.cmd == 'TPath.END_BRACKET') {
				this.resize_tb(this.inter_bracket_path!.total_length);
			}
			else if (change_data.cmd == 'undo' || change_data.cmd == 'redo') {
				// bracket 위치의 변화가 있을 때만 inter-bracket-path를 갱신한다.
				if (this.start_bracket !== present.tpath.start_bracket || this.end_bracket !== present.tpath.end_bracket) {
					this.start_bracket = present.tpath.start_bracket;
					this.end_bracket = present.tpath.end_bracket;

					this.tp_bracket.generate_inter_bracket_path(this.start_bracket, this.end_bracket)
					this.resize_tb(this.inter_bracket_path!.total_length);
				}
			}
		}

		this.tp_draw.render_svg_text();
		this.tp_draw.render_svg_cursor();
		this.tp_draw.render_outline_shape();
		this.tp_bracket.render();
		this.draw_all();
	}

	draw_all(): void {
		this.tp_draw.draw()		
		this.tp_bracket.draw();
	}
	

	resize_tb(length: number): void {
		console.log('-----> resize_tb: length', length)
		var opt = {
			content: {
				width: length
			},
			page: {
				width: length
			}
		}
		this.tb.resizeBox(opt);
	}

	setup_keyboard_input(): void {
	}

	// 이 함수를 사용하는 곳은 없음. 잘 작동하며, 참고로 남겨둠
	/*
	get_area_code(e) {
		let p = this.get_transformed_mouse_pt(e);//{ x: e.offsetX, y: e.offsetY };

		let ret = this.tpath.project_and_distance(p.x, p.y);
		let loc = this.tb.layout.finder.find_cursor_location_by_line_num(0, ret.length);
		if (ret.d <= loc.max_word_height) {
			return 'in_path'
		}
		return 'out_of_path'
	}
	*/
	

	// // TB_Cursor.js의 input_lbutton_down()에서도 호출함.
	focus_and_locate_cursor_at_mouse_point(e: MouseEvent): number {
		let p = this.get_transformed_mouse_pt(e);//{ x: e.offsetX, y: e.offsetY };

		let ret = this.inter_bracket_path!.project_and_distance(p.x, p.y);
		let loc = this.tb.layout!.finder.find_cursor_location_by_line_num(0, ret.length)!;
		// if (ret.d > loc.max_word_height) {
		// 	return;
		// }

		this.tb.set_focus();
		this.tb.tbcursor.set(loc.ci_doc);
		this.tb.tbcursor.clear_sel();
		return loc.ci_doc;
	}

	set_select_word(e: MouseEvent): void {
		// word를 선택하는 코드 구현할 것.
		// TB_Cursor.js의 input_dblclick()참고 할것.
		let ci_doc = this.focus_and_locate_cursor_at_mouse_point(e);
		this.tb.tbcursor.input_dblclick_by_index(ci_doc);
	}

    is_mouse_on_grabbing_area (clientX: number, clientY: number): boolean {
        var elMouseHover = document.elementFromPoint(clientX, clientY);
        // console.log('hover class:', elMouseHover.classList)
        if (elMouseHover && elMouseHover.classList) {
            return elMouseHover.classList.contains("outer-grabbing-area")
        }
        return false;
	};
		
	setup_mouse_input(): void {
		let self = this;
		// dblclick event는 오지 않는다. mousedown에서 stopPropagation()을 하기 때문

		let mousedown_listener = function(e: MouseEvent) {
			if (self.tb.is_state_focused() == false)
				return;

			// grabbing area를 클릭하면, mouse이벤트를 흘려 selector에서 처리되도록 한다.
			if (self.is_mouse_on_grabbing_area(e.clientX, e.clientY)) {
				return;
			}

			let mouse_moved = false;
			let last_pos = {x:e.clientX, y:e.clientY};
			let sel_begin = 0;
			if (e.shiftKey) {
				let sel = self.tb.tbcursor.sel();
				sel_begin = sel.exists_range ? sel.begin : self.tb.tbcursor.cursor;
				self.update_selection(e, sel_begin);
			}
			else
				sel_begin = self.focus_and_locate_cursor_at_mouse_point(e);

			self.tb.style_listener({ ime: false }); // ime창은 변화 없음. 마우스 위치의 style을 ui에 반영함. 
			
			if (self.mi.is_double_clicked()) {
				self.set_select_word(e);
				sel_begin = self.tb.tbcursor.sel().begin;
			}
			else {
				self.tp_draw.render_svg_text()
				self.draw_all()
			}

			e.preventDefault();
			e.stopPropagation();

			// 이상하게도, mousedown이후 위치이동이 없어도 무조건 mousemove가 따라오는 현상이 있어, 움직인 거리를 체크하여 mouse_moved여부를 판단함
			let mousemove_listener = function(e: MouseEvent) {
				if (!mouse_moved && MathUtil.distance(last_pos.x, last_pos.y, e.clientX, e.clientY) < 2) {
					e.stopPropagation();
					return;
				}
				else
					mouse_moved = true;

				self.update_selection(e, sel_begin);

				self.tp_draw.render_svg_text()
				self.draw_all();

				e.stopPropagation();
			}
			let mouseup_listener = function(e: MouseEvent) {
				if (mouse_moved) {
					self.update_selection(e, sel_begin);
				}

				self.tp_draw.render_svg_text()
				self.draw_all()

				document.removeEventListener('mousemove', mousemove_listener);
				document.removeEventListener('mouseup', mouseup_listener);

				e.stopPropagation();

				//////////////////////////////////////////////////////////////////////
				// 배경에서 발생하는 click event를 무시하도록 함.
				// --> 필요없음. mousedown시 preventDefault()를 함으로 해서 click, drag등이 발생안하게 됨.
				// self.mi.consume_click_event();
			}

			document.addEventListener('mousemove', mousemove_listener)
			document.addEventListener('mouseup', mouseup_listener)
		}

		this.svg_container.addEventListener('mousedown', mousedown_listener, true);
	}

	update_selection(e: MouseEvent, sel_begin: number): { p: Point; ret: ProjectResult } {
		let p = this.get_transformed_mouse_pt(e); //{ x: e.offsetX, y: e.offsetY };
		let ret = this.inter_bracket_path!.project_and_distance(p.x, p.y);
		let loc = this.tb.layout!.finder.find_cursor_location_by_line_num(0, ret.length)!;
		this.tb.tbcursor.set_selection(sel_begin, loc.ci_doc);
		// this.tp_draw.render_projection_line(p, ret.q)	// for debugging
		return { p, ret };
	}

	get_transformed_mouse_pt(e: MouseEvent): Point {
		let offset = this.mi.get_offsetXY(e, this);
		return this.mat.transformPoint(offset)
	}
}

export { TB_TextOnPath };