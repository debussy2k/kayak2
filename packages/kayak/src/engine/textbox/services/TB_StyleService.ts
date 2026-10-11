import { TB_TofuService } from './TB_TofuService'
import type { TextBoxHost, StyleEntry } from '../types';

export class TB_StyleService {
	tb: TextBoxHost;
	tofuService: TB_TofuService;

	constructor(textbox_obj: TextBoxHost) {
		this.tb = textbox_obj;
		this.tofuService = new TB_TofuService(textbox_obj);
	}

    update_default_font_state(): void {
        this.tofuService.update_default_font_state();
	}

	get_styles(rng: any): StyleEntry[] {
		let styles: StyleEntry[] = [];
		this.tb.seg_mgr.extract_styles_except_par_layer(styles, rng);
		return this.tofuService.adjust_styles_for_no_matching_glyph(styles);
	}
}