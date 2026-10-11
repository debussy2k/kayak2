import type { TextBoxHost, StyleEntry, FontItem } from '../types';

export class TB_TofuService {
	tb: TextBoxHost;
	default_font: FontItem;
	default_font_used: boolean;

	constructor(textbox_obj: TextBoxHost) {
		this.tb = textbox_obj;
        this.default_font = this.tb.fontloader!.get_default_font();
		this.default_font_used = false;
	}

	clear_default_font_used_flag(): void {
		this.default_font_used = false;
	}
	
	update_default_font_state(): void {
        this.default_font = this.tb.fontloader!.get_default_font();
	}
	
	adjust_styles_for_no_matching_glyph(styles: StyleEntry[]): StyleEntry[] {
		let arr: StyleEntry[] = [];
		let tofus = this._get_tofu_styles(styles);
		let i = 0,
			j = 0;
		let obj: StyleEntry;
		let fstyle: StyleEntry = {} as StyleEntry;

		if (tofus.length == 0)
			return styles;

		/*  
			styles와 tofus array를 .pos를 기준으로 합친다.
			tofu가 있는 pos에 기본폰트 스타일을 설정하여 그것의 glyph가 나오도록 한다.
			단, 기본폰트에도 해당 glyph가 없으면 깍두기 표시가 나오게 됨.
		*/
		while (i < styles.length - 1) {
			let style = styles[i];
			arr.push(Object.assign({}, style))
			Object.assign(fstyle, styles[i]);

			while (j < tofus.length && tofus[j].pos < styles[i + 1].pos) {
				if (tofus[j].pos == style.pos) {
					let s = arr[arr.length - 1];
					if (j % 2 == 0) // start
						Object.assign(s, tofus[j]);
					else {
						s.familyName = fstyle.familyName,
							s.typeStyle = fstyle.typeStyle
					}
				} else {
					obj = Object.assign({}, tofus[j]);
					arr.push(obj);
				}
				j++;
			}
			i++;
		}
		arr.push(Object.assign({}, styles[styles.length - 1]));

		return arr;
	}

	_get_tofu_styles(styles: StyleEntry[]): StyleEntry[] {
		let arr: StyleEntry[] = [];
		let state = {
			prev_tofu: false,
			pos: 0
		}

		let fstyle: StyleEntry = {} as StyleEntry;
		for (let i = 0; i < styles.length - 1; i++) {
			Object.assign(fstyle, styles[i]);
			let text = this.tb.text_core.toRawString(styles[i].pos, styles[i + 1].pos, { new_line_as_space: true });
			let font = this.tb.fontloader!.getSync(fstyle.familyName!, fstyle.typeStyle!);
			state.pos = styles[i].pos;

			/* 아래의 경우는 있어서는 안되는 예외적인 경우임.
				- kayak json에 "fonts_unresolved"가 있어 font를 못찾은 경우임 
				- tofu로 처리하여 (A)에서 기본 폰트로 처리함.
			*/
			if (font == undefined) {
				// return [];

			}

			for (let ch of text) {
				let tofu = (font == undefined) || !font.hasChar(ch); // <-- (A) 
				if (state.prev_tofu == false && tofu) { // not-tofu --> tofu
					// console.log("tofu detected")
					this.default_font_used = true;

					arr.push({
						pos: state.pos,
						familyName: this.default_font.familyName,
						typeStyle: this.default_font.typeStyle
					})
				} else if (state.prev_tofu && tofu == false) {
					arr.push({
						pos: state.pos,
						familyName: fstyle.familyName,
						typeStyle: fstyle.typeStyle
					});
				}

				state.prev_tofu = tofu;
				state.pos += 1;
			}
		}

		return arr;
	}

}