export class TB_PosTracker {
	par_index: number;
	li_par: number;
	line_char_count: number;
	ci_lbegin_par: number;

	constructor() {
		this.par_index = 0;
		this.li_par = 0;
		this.line_char_count = 0;
		this.ci_lbegin_par =  0
	}

	reset_pos_tracker(par_index: number): void {
        this.par_index = par_index;
        this.li_par = 0;
        this.line_char_count = 0;
        this.ci_lbegin_par = 0;
    }
}