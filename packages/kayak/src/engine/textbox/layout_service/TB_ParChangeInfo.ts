import type { CiRange } from '../types';

export class TB_ParChangeInfo {
	old: CiRange;
	new: CiRange;
	par_length: number;
	ci_change_start: number;
	ci_change_end: number | undefined;
	text_fluctuation: number;

	constructor(change_info_par: any, change_info_text: { text_fluctuation: number }) {
		this.old = {
			begin: change_info_par.before.m_nFirstSegIndex,
			end: change_info_par.before.m_nLastSegIndex
		}

		this.new = {
			begin: change_info_par.after.m_nFirstSegIndex,
			end: change_info_par.after.m_nLastSegIndex
		}

		this.par_length =  change_info_par.par_length
		this.ci_change_start =  change_info_par.ci_change_start
		this.ci_change_end =  change_info_par.ci_change_end
		this.text_fluctuation =  change_info_text.text_fluctuation
	}
}