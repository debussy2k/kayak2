import * as log from "loglevel";
import type { TextBoxHost, PreferenceData } from './types';

class TB_Preference {
	tb: TextBoxHost;
	single_line_mode: boolean;
	fit_to_line_width_by_scale_x: boolean;
	embox_offset_ratio: number;
	first_line_baseline_offset: string;
	fit_to_content_height: boolean;
	vertical_justification: string;
	frame_height: number;
	computed_values: {
		embox_height_offset_px: number;
		valign_padding_top: number;
		valign_padding_bottom: number;
		first_line_heading_space: number;
		first_line_excluded_heading_space: number;
	};

	constructor(tb: TextBoxHost) {
		this.tb = tb; // tb는 constructor에서는 사용하지 말 것. 
		this.single_line_mode = false;
		this.fit_to_line_width_by_scale_x = false;

		this.embox_offset_ratio = 0.12
		this.first_line_baseline_offset = 'ascent',	// embox(전각상자), ascent

		this.fit_to_content_height = true;
		this.vertical_justification = 'top';
		this.frame_height = 100;

		this.computed_values = {
			embox_height_offset_px: 0,
			valign_padding_top: 0,
			valign_padding_bottom: 0,

			first_line_heading_space: 0, 			// 첫줄의 space_before
			first_line_excluded_heading_space: 0	// 
		}
	}

	save(): PreferenceData {
		return {
			single_line_mode: this.single_line_mode,
			fit_to_line_width_by_scale_x: this.fit_to_line_width_by_scale_x,
			
			first_line_baseline_offset: this.first_line_baseline_offset,
			fit_to_content_height : this.fit_to_content_height,
			vertical_justification: this.vertical_justification,
			frame_height : this.frame_height
		}
	}
	apply(preference: PreferenceData): void {
		this.set_single_line_mode(preference.single_line_mode)
		this.set_fit_to_line_width_by_scale_x(preference.fit_to_line_width_by_scale_x)
		this.set_first_line_baseline_offset_mode(preference.first_line_baseline_offset)
		this.set_fit_to_content_height(preference.fit_to_content_height)
		this.set_vertical_justification(preference.vertical_justification)
		this.set_height(preference.frame_height)
	}

	set_legacy_181028(doc_ver?: string, opt?: { refresh?: boolean }): void {
		this.tb.version = doc_ver ? doc_ver : 'legacy_181028';

		if (this.tb.version == 'legacy_181028')
			this.tb.tbconfig.lineview_container_elem!.classList.add('legacy-181028')
		else 
			this.tb.tbconfig.lineview_container_elem!.classList.remove('legacy-181028')

		if (opt && opt.refresh) {
			this.tb.layout!.do_layout_all();
			let tbdom = this.tb.layout!.get_tbdom();
			if (tbdom.pars.length > 0 && tbdom.pars[0].lines.length > 0) {
				this.update_first_line_height_by_baseline_offset_mode(tbdom.pars[0].lines[0])
				this.calc_vertical_align();
			}
		}
	}

	set_single_line_mode(val: boolean): boolean {
		let tbdom = this.tb.layout!.get_tbdom();

		if (val == true && tbdom.pars.length !== 1) {
			log.warn("can't set single line mode.(only for single paragraph)")
			return false
		}

		this.single_line_mode = val;
		return true;
	}
	set_fit_to_line_width_by_scale_x(val: boolean): void {
		if (val == true) {
			if (this.set_single_line_mode(true)) // single line mode가 전제조건임.
				this.fit_to_line_width_by_scale_x = true;
		}
		else {
			this.fit_to_line_width_by_scale_x = false;
		}
	}


	set_first_line_baseline_offset_mode(val?: string | null): void {
		// first_line_baseline_offset 기능이 없는 구버전 kayak 컨텐츠를 로딩한 경우 기본값을 'ascent'로 한다. 2018.10.19
		if (val == undefined || val == null)
			this.first_line_baseline_offset = 'ascent';
		else
			this.first_line_baseline_offset = val;


		this.tb.layout!.do_layout_all();
		let tbdom = this.tb.layout!.get_tbdom();
		if (tbdom.pars.length > 0 && tbdom.pars[0].lines.length > 0) {
			this.update_first_line_height_by_baseline_offset_mode(tbdom.pars[0].lines[0])
			this.calc_vertical_align();
		}
	}
	
	get_first_line_baseline_offset_value_px(first_line: any): number {
		let offset = 0;
        switch(this.first_line_baseline_offset) {
            case 'ascent': 
				offset = - (first_line.max_word_ascent - first_line.max_word_ascent_d); // embox height offset 만큼의 높이를 덜 가지도록 함.
                break;
            default:
				offset = 0;
                break;
		}		

		return offset;
	}

	/* 
		old_first_line: 원래 first line이었다가 두 번째로 밀려 line height를 재설정 해야 하는 경우에 전달됨.
	*/
	update_first_line_height_by_baseline_offset_mode(first_line: any, old_first_line?: any): void {
        // console.log('--> update_first_line_height_by_baseline_offset_mode() called');
		
		let tbdom = this.tb.layout!.get_tbdom();
		
		let actual_height = 0;
		let excluded_heading_space = 0;
		if (this.tb.version == 'legacy_181028') {
			this.computed_values.embox_height_offset_px = 0; // 즉 무조건 first-line-baseline-offset 모드가 "ascent"와 같음
			actual_height = first_line.line_holder_height;
			excluded_heading_space = 0;
		}
		else {
			let offset = this.get_first_line_baseline_offset_value_px(first_line);
			this.computed_values.embox_height_offset_px = offset;

			actual_height = first_line.dom_line_height + offset;
			excluded_heading_space = first_line.space_before;
		}
		this.computed_values.first_line_heading_space = first_line.space_before;
		this.computed_values.first_line_excluded_heading_space = excluded_heading_space;

		///////////////////////////////////////////////////////////////////////////////
		// 1. first kayak line의 css값을 조정 함.
		let first_kayak_line_elem = tbdom.lineview_arr[0].getElementsByClassName('kayak-line')[0] as HTMLElement;
		first_kayak_line_elem.style.height = actual_height + 'px';

		// svg를 글줄 상단에 위치시킨다. text-on-path 모드에서는 svg_elem이 null이므로 체크한다.
		let svg_elem = first_kayak_line_elem.querySelector<HTMLElement>('.kayak-svg-line');
		if (svg_elem)
			svg_elem.style.top = this.computed_values.embox_height_offset_px + 'px';
		///////////////////////////////////////////////////////////////////////////////

		if (old_first_line) {
			// // console.log('------> special case')
			// // 이 경우는 문서 제일 처음 위치에서 enter키를 입력한 경우	첫 줄이 그대로 2번째 줄이 되는 경우임.
			// let height = 0
			// if (old_first_line.leading == 'auto')
			// 	height = old_first_line.max_font_size_px;
			// else
			// 	height = old_first_line.line_height_on_non_first_line;
			
			// ///////////////////////////////////////////////////////////////////////////////
			// // 2. 이전의 first kayak line의 css값을 조정 함.
			// let old_first_kayak_line_elem = tbdom.lineview_arr[1].getElementsByClassName('kayak-line')[0];
			// old_first_kayak_line_elem.style.height = height + 'px';

			// // svg를 글줄 하단에 위치시킨다.
			// let svg_elem = old_first_kayak_line_elem.querySelector('.kayak-svg-line');
			// svg_elem.style.top = 0;
			// ///////////////////////////////////////////////////////////////////////////////
		}
	}

	// textbox frame크기가 변경되면 호출됨.
	on_dimension_changed(dim?: any): void {
		this.calc_vertical_align();
	}

	set_vertical_justification(val: string): void {
		this.vertical_justification = val;
		this.calc_vertical_align();
	}

	get_fit_to_content_height(): boolean {
		return this.fit_to_content_height;
	}
	
	set_fit_to_content_height(val: boolean): void {
		if (this.fit_to_content_height == val)
			return;

		this.fit_to_content_height = val;
		if (this.tb.layout == null) // schema mode가 아닐 경우에만 통과
			return;

		let tbconfig = this.tb.tbconfig;

		if (val) {
			tbconfig.element!.style.height = 'auto';

			this.computed_values.valign_padding_top = 0;
			this.computed_values.valign_padding_bottom = 0;
			tbconfig.content_elem!.style.paddingTop = '0px';
			tbconfig.content_elem!.style.paddingBottom = '0px';

		}
		else {
			let target_height = this.get_content_height();
			this.set_height(target_height)
		}
	}
	get_content_height(): number {
		let tbconfig = this.tb.tbconfig;
		let dim = this.tb.get_dimension();
		let target_height = dim.visible_content_height + (tbconfig.page.gutter_top + tbconfig.page.gutter_bottom);
		return target_height;
	}

	set_height(new_height: number): void {
		if (this.fit_to_content_height)
			return;

		this.frame_height = new_height;
		if (this.tb.layout == null) // schema mode가 아닐 경우에만 통과
			return;

		this.tb.tbconfig.element!.style.height = new_height + 'px';
		this.calc_vertical_align();
	}


	// ---------------------------------------------------------------------------------------
	// private
	// ---------------------------------------------------------------------------------------
	calc_vertical_align(): void {
		if (this.fit_to_content_height)
			return;
		if (this.tb.layout == null) // schema mode가 아닐 경우에만 통과
			return;

		let tbconfig = this.tb.tbconfig;

		var dim = this.tb.get_dimension();
		var full_content_height = this.frame_height - (tbconfig.page.gutter_top + tbconfig.page.gutter_bottom);

		var extra_height = full_content_height - dim.visible_content_height;

		if (extra_height < 0)
			extra_height = 0;

		let valign_padding_top = 0;
		let valign_padding_bottom = 0;
		switch (this.vertical_justification) {
			case 'top':
				valign_padding_top = 0;
				valign_padding_bottom = extra_height;			
				break;
			case 'center':
				valign_padding_top =  extra_height / 2;
				valign_padding_bottom =  extra_height / 2;			
				break;
			case 'bottom':
				valign_padding_top = extra_height;
				valign_padding_bottom = 0;			
				break;
		}

		this.computed_values.valign_padding_top = valign_padding_top;
		this.computed_values.valign_padding_bottom = valign_padding_bottom;

		tbconfig.content_elem!.style.paddingTop = valign_padding_top + 'px';
		tbconfig.content_elem!.style.paddingBottom = valign_padding_bottom + 'px';

		this.tb.tbcursor.repaint();
	}

}

export { TB_Preference };