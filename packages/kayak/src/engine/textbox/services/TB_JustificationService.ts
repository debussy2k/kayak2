import type { JstfStyleKey, JstfBalanceInfo } from '../types';

interface JstfContext { length: number; wi__last_non_white_space: any | null }

export class TB_JustificationService {
	static get_jstf_balance_info(par_attr: any, is_last_line: boolean, wi_arr: any[]): JstfBalanceInfo | null {
		let jstf_balance_info: JstfBalanceInfo | null = null;
		if (par_attr.m_Align == 'fully-justified')
			jstf_balance_info = TB_JustificationService.calc_for_justification(wi_arr);
		else if (par_attr.m_Align == 'left-justified' || par_attr.m_Align == 'center-justified' || par_attr.m_Align == 'right-justified') {
			// 마지막줄에서 jstf_balance_info정보를 주지 않으면 justify가 되지 않음.
			if (is_last_line == false)
				jstf_balance_info = TB_JustificationService.calc_for_justification(wi_arr);
		}
		return jstf_balance_info;
	}

	/* Calculation for Justification
		- justification에서는 ligature off됨.
		- 동일한 style별로 합산하여 각 style별  balance-space ratio를 계산한다.
		- 동일한 style이란 (font-size, letter-space, letter-scale-x)가 같은 경우이다.

	  이후, 이 계산결과를 이용해 glyph 출력 및 위치계산을 다움과 같은 방법으로 한다.
		- 동일한 style별 word를 이용해 content-width를 계산한다.
		- 가장 마지막 non-white-space glyph를 제외한 glyph들에 대해 
		- 여백공간을 balance-space ratio에 따라 안분한다.

		예를 들면 다음과 같다. 
			|   ABCD|-_
			|A B C D|-_
		마지막 non-white-space glyph에 관련한 설명
		- 위의 예에서는 'D'가 해당됨.
		- D의 letter-space는 오른쪽 끝인 |의 바깥쪽에 위치함.
		- |의 뒤의 '-'는 D의 letter-space
		- |의 뒤의 '_'는 연속되는 trailing white-space
		
	*/
	//D171205-justification
	static calc_for_justification(wi_arr: any[]): JstfBalanceInfo {
		let style_keys: JstfBalanceInfo = {};
		let context: JstfContext = {
			length : 0,
			wi__last_non_white_space : null
		}

		wi_arr.forEach((wi, i) => {
			if (wi.dimension.style_keys) {
				// 마지막 wi가 whiteSpace이면 계산에서 제외한다. 
				if (i != wi_arr.length-1 || wi.whiteSpace == false)
					TB_JustificationService._collect_style_keys(wi, style_keys, context);
			}
			if (wi.whiteSpace == false)
				context.wi__last_non_white_space = wi;
		})

		TB_JustificationService._calc_balance_space(style_keys, context);
		// console.log(style_keys, context);
		
		return style_keys;
	}

	// private method
	static _collect_style_keys(wi: any, style_keys: JstfBalanceInfo, context: JstfContext): void {
		Object.keys(wi.dimension.style_keys).forEach(k => {
			let val = wi.dimension.style_keys[k];

			if (style_keys.hasOwnProperty(k)) {
				style_keys[k].width += val.width;
				style_keys[k].count += val.count;
			}
			else {
				style_keys[k] = {
					width: val.width,
					count: val.count
				}
			}
		})
	}

	static _calc_balance_space(style_keys: JstfBalanceInfo, context: JstfContext): void {
		if (context.wi__last_non_white_space) {
			let k = context.wi__last_non_white_space.dimension.last_style_key;
			//Bug k가 undefined가 나오는 경우가 있으니 추후 재현하여 꼭 처리할 것.
			// 19.3.6. unresoved font가 있는 kayak json을 열고 진행하면 문제가 발생하는 경우가 있음.
			if (k == undefined ) {
				console.trace();
				console.error('last_style_key is null');
				return;
			}

			style_keys[k].width -= context.wi__last_non_white_space.dimension.last_glyph_width + context.wi__last_non_white_space.dimension.last_glyph_white_space;
			style_keys[k].count -= 1;
		}

		let total_width = Object.keys(style_keys).reduce((total_width, key) => {
			return total_width + style_keys[key].width;
		}, 0)
		// console.log("total_width: ", total_width)

		/* balance_space_ratio의 의미
			- justification을 위해 style이 동일한 glyph 한 개가 받을 수 있는 여백 공간의 비율
			- (font-size, letter-space, letter-scale-x) 3가지 항목이 같으면 동일 style로 간주.
		*/
		Object.entries(style_keys).forEach(([k,v]) => {
			if (v.count > 0)
				v.balance_space_ratio = (v.width / total_width) / v.count;
			else
				v.balance_space_ratio = 0;
		})
	}
}