import type { TextBoxHost, CiRange } from '../types';
import type { DomPar, DomLine } from '../TextBoxDom';

export class TB_FormatService {
	tb: TextBoxHost;

    constructor(textbox_obj: TextBoxHost) {
		this.tb = textbox_obj;
	}

	/*
		opt {
			respect_segments_letter_scale: boolean
		}

		알고 있는 버그
		- 이 함수 적용후 undo()하면 원래상태(undo하기 전)에서 undo가 한 번 더 되는 문제 있음.
	*/
	layout_first_paragraph_in_a_single_line(opt?: { respect_segments_letter_scale?: boolean }): void {
		let tbdom = this.tb.layout!.get_tbdom();
		
		// if (opt && opt.first_paragraph_only) {
		// 	this.shrink_par_to_single_line(tbdom.pars[0], 0)
		// }
		// else {
		// 	tbdom.pars.forEach((par, index, opt) => {
		// 		this.shrink_par_to_single_line(par, index)
		// 	})
		// }

		tbdom.pars.forEach((par, index) => {
			this.shrink_par_to_single_line(par, index, opt)
		})

	}

	/*

	*/
	shrink_par_to_single_line(par: DomPar, index: number, opt?: { respect_segments_letter_scale?: boolean }): void {	
		let respect_segments_letter_scale = false;

		let tbdom = this.tb.layout!.get_tbdom();
		let sel = tbdom.get_ci_range_of_par(index)!
		let opStyle = this.tb.opStyle;
		let base_letter_scale_x = 100;


		/*
			주의
			- option이 없는 default 작용은 Method-2가 되어야 함.
			- doc2svg에서 default로 동작하도록 호출되고 있음.

		*/
		if (opt && opt.respect_segments_letter_scale == false) {
			// Method-1 :  항상 letter_scale을 100%로 가정하여 sing line으로 shrink함. 

			// 1. 전체 letter_scale을 100%로 설정
			opStyle.set_letter_scale_x(base_letter_scale_x, sel, null, null, {command_auto_play:"run", skip_post_process:true});

			// 2. 한 줄에 들어가도록 ratio를 계산한다. 
			let shrink_ratio = this._calc_shrink_ratio(par)

			// 3. 적용
			if (shrink_ratio < 100)
				opStyle.set_letter_scale_x(shrink_ratio, sel, null, null, {command_auto_play:"run", skip_post_process:true});
		}
		else {
			// Method-2 : par내에 적용되어 있는 letter_scale간의 비율을 유지한 상태로 shrink계산을 한다.

			if (par.lines.length == 1) {
				return // paragraph has single line
			}
	
			// 1. 한 줄에 들어가도록 ratio를 계산한다. 
			let shrink_ratio = this._calc_shrink_ratio(par)
			// console.log('shrink_ratio', shrink_ratio)
			
			// 2. letter_scale_x의 속성만 arr에 모음
			let styles = this.tb.docFactory!.styleSerivce.get_styles(sel)
			// console.log(styles)
			let arr: { pos: number; letter_scale_x?: number }[] = styles.filter(style => style.letter_scale_x !== undefined)
			.map(style => {
				return {
					pos: style.pos,
					letter_scale_x: style.letter_scale_x
				}
			})
			arr.push({pos:styles[styles.length-1].pos}) // 마지막 항목 추가 
			// console.log(arr)
	
			// 3. 새로 적용할 letter_scale_x의 범위과 값을 segs에 계산함.
			let segs: { begin: number; end: number; letter_scale_x: number }[] = [];
			for(let i=0; i<arr.length-1; i++) {
				segs.push({
					begin: arr[i].pos,
					end: arr[i+1].pos,
					letter_scale_x: arr[i].letter_scale_x! * shrink_ratio / 100
				})
			}
			// console.log(segs)
	
			// 4. style을 적용.
			segs.forEach(seg => {
				opStyle.set_letter_scale_x(seg.letter_scale_x, seg, null, null, {command_auto_play:"run", skip_post_process:true});
			})
		}
	}
	_calc_shrink_ratio(par: DomPar): number {
		let lines = par.lines;
		let last_index = par.lines.length - 1;
		let base_letter_scale_x = 100;

		let full_length = lines.reduce((sum: number, line: DomLine) => {
			return sum + line.content_width;
		}, 0)

		let last_space = lines[last_index].content_width - lines[last_index].core_width;
		let effective_length = full_length - last_space;

		// console.log('effective_length', effective_length)

		////////////////////////////////
		let target_width = lines[0].line_width;
		let shrink_ratio = Math.floor(base_letter_scale_x * target_width / effective_length);
		// console.log('shrink_ratio', shrink_ratio)
		
		return shrink_ratio
	}

	// shrink_par_to_single_line_ORG(par, index, opt) {	
	// 	if (par.lines.length == 1) {
	// 		return // paragraph has single line
	// 	}

	// 	let respect_initial_letter_scale = true;// (opt && opt.respect_initial_letter_scale == true)
	// 	let base_letter_scale_x = 100;

	// 	let tbdom = this.tb.layout.get_tbdom();
	// 	let sel = tbdom.get_ci_range_of_par(index)

	// 	if (respect_initial_letter_scale) {
	// 		/* ToDo
	// 			tn-view전용. 
	// 		 	현재 par의 시작저점의 letter scale을 찾아서 그것을 base_letter_scale_x로 사용.
	// 		*/
	// 		let info = this.tb.get_style_info(sel.begin+1); // sel.begin에서는 gravity가 left라 이전 줄의 style이 얻어지는 문제있음.
	// 		console.log(info)
	// 		base_letter_scale_x = info.letter_scale_x;
	// 	}

	// 	let opStyle = this.tb.opStyle;

	// 	// 1. letter scale은 loadFromJson()시의 첫글자의 장평값을 기준으로 설정된다.
	// 	opStyle.set_letter_scale_x(base_letter_scale_x, sel, null, null, {command_auto_play:"run", skip_post_process:true});
		

	// 	// 2. 한 줄에 들어가도록 ratio를 계산한다. 
	// 	let lines = par.lines;
	// 	let last_index = par.lines.length - 1;

	// 	let full_length = lines.reduce((sum, line) => {
	// 		return sum + line.content_width;
	// 	}, 0)

	// 	let last_space = lines[last_index].content_width - lines[last_index].core_width;
	// 	let effective_length = full_length - last_space;

	// 	// console.log('effective_length', effective_length)

	// 	////////////////////////////////
	// 	let target_width = lines[0].line_width;
	// 	let shrink_ratio = Math.floor(base_letter_scale_x * target_width / effective_length);
	// 	console.log('shrink_ratio', shrink_ratio)

	// 	// 3. 적용
	// 	opStyle.set_letter_scale_x(shrink_ratio, sel, null, null, {command_auto_play:"run", skip_post_process:true});
	// }


	//////////////////////////////////
	replace_font_color(opt: { src: { fontColor: string }; dst: { fontColor: string; fontColorCMYK: any; fontColorModel: any } }[]): void {

		// Font Color
		var segVec = this.tb.m_FontColor._get_vec();
		// console.log(segVec)
		let arr = segVec.map(seg => {
			return {
				m_nCount: seg.m_nCount,
				fontColor: seg.fontColor
			}
		});

		let ci = 0;
		arr.forEach(seg => {
			for(let i=0; i<opt.length; i++) {
				let item = opt[i];
				if (seg.fontColor == item.src.fontColor) {
					let sel = {
						cursor: ci,
						begin: ci,
						end: ci + seg.m_nCount,
						exists_range: true
					}
					/*
						Edicus에서 복합 command로 수행되는 작업이 들어가는 경우 command_auto_play="run"을 적용하지 말 것.
						Edicus에서 복합 command를 grouping하여 n번 undo/redo를 처리함.
							참고: in_gdp_processing 관련, (in document-context.service.ts)
						google doc 참고
							https://docs.google.com/presentation/d/1IZ7xuh7QN8ne-t0ZLrNT-ULtEOCGAMHzh0MyAhubkGs/edit#slide=id.g84e21f109d_0_0
					*/
					// this.tb.opStyle.set_fontColor(item.dst.fontColor, item.dst.fontColorCMYK, item.dst.fontColorModel, sel, null, false, {command_auto_play:"run"});
					this.tb.opStyle.set_fontColor(item.dst.fontColor, item.dst.fontColorCMYK, item.dst.fontColorModel, sel, null, false);
					break;
				}
			}
			ci += seg.m_nCount
		})
	}

	/*
		max_font_size보다 큰 폰트를 찾아 max_font_size로 설정한다.
	*/
	clamp_font_size(max_font_size: number): void {
		var segVec = this.tb.m_FSizeLayer._get_vec();
		console.log(segVec)

		let clamp_target = segVec.reduce((state, seg) => {
			if (seg.FontSize > max_font_size)
				state.ranges.push({begin:state.pos, end: state.pos+seg.m_nCount});
			state.pos += seg.m_nCount;
			return state;
		}, {ranges: [] as CiRange[], pos: 0})
		
		/*
			폰트크기가 같은 인접한 segment를 병합한다. 
		*/
		let ranges = clamp_target.ranges;
		let merged_ranges = ranges.reduce((mranges, seg, i) => {
			if (mranges.length > 0 && mranges[mranges.length-1].end === ranges[i].begin)
				mranges[mranges.length-1].end = ranges[i].end
			else 
				mranges.push(Object.assign({}, seg))
			
				return mranges;
		}, [] as CiRange[])
		// console.log('filtered vec', clamp_target)
		// console.log('merged_ranges', merged_ranges)

		merged_ranges.forEach(seg => {
			this.tb.opStyle.set_font_size(max_font_size, seg, null, false, {command_auto_play:"run", skip_post_process:true})
		})
	}

	replace_text_with_range_id(id: string, text: string): void {
		let rng = this._get_range_by_id(id);
		if (rng.begin === rng.end) 
			return;

		// console.log(rng)
		this.tb.opEdit.erase(rng.begin, rng.begin, rng.end);
		this.tb.opEdit.insert_string(rng.begin, text);
	}
	_get_range_by_id(id: string): CiRange {
		let vec = this.tb.m_NamedRange._get_vec();
		// console.log(vec)
		let begin = 0;
		let end = 0;
		let found = false;
		for(let i=0; i<vec.length; i++) {
			if (vec[i].var_name === id) {
				end = begin + vec[i].m_nCount;
				found = true;
				break;
			}
			begin += vec[i].m_nCount;
			end = begin;
		}
		return {begin, end}
	}

	get_text_by_range_id(id: string): { range: CiRange; text: string } | undefined {
		let rng = this._get_range_by_id(id);
		if (rng.begin === rng.end) 
			return;

		let text = this.tb.text_core.toRawString(rng.begin, rng.end)
		return {
			range: rng,
			text: text,
		}
	}

	get_array_of_ranges(): { var_name: string; title: string; range: CiRange }[] {
		let vec = this.tb.m_NamedRange._get_vec();
		let arr = vec.filter(item => item.var_name !== '_na_')
		.map(item => {
			return {
				var_name: item.var_name,
				title: item.title,
				range: this._get_range_by_id(item.var_name)
			}
		})
		// console.log(arr)

		return arr;
	}
}