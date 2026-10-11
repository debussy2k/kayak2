import { TB_RangeMetric } from './TB_RangeMetric';
import type { TB_SvgTextRender } from './TB_SvgTextRender';
import type { TB_StyleService } from './services/TB_StyleService';
import type { Point } from '../geometry/types';
import type { TextBoxHost, TextLineRange, RenderStyle, FontContext } from './types';

export class TB_SvgDimension {
    tb: TextBoxHost;
    styleSerivce: TB_StyleService;
    svgTextRender: TB_SvgTextRender;

    constructor(textbox_obj: TextBoxHost, svgTextRender: TB_SvgTextRender, styleSerivce: TB_StyleService) {
        this.tb = textbox_obj;
        this.styleSerivce = styleSerivce;
        this.svgTextRender = svgTextRender;
    }

    // rng내 동일 style 그룹별로 구분하여 계산하고, 전체 dimension을 알아낸다.
    get_dimension_of_text_range(rng: TextLineRange, align: string | null, domLine: any): TB_RangeMetric {
        let fstyle: RenderStyle = {
            kerning: true,
            ligature : true
        } as RenderStyle;

        let font_context: FontContext = {} as FontContext;
        let pos: Point = {x:0, y:0};
		let metrics = new TB_RangeMetric();

        // let styles = [];
        // this.tb.seg_mgr.extract_styles_except_par_layer(styles, rng);
        let styles = this.styleSerivce.get_styles(rng);
        
        for (let i=0; i < styles.length - 1; i++) {
            Object.assign(fstyle, styles[i]);
            let text = this.tb.text_core.toRawString(styles[i].pos, styles[i+1].pos, {new_line_as_space: true});
            let textRng: TextLineRange = {
                begin : styles[i].pos,
                end   : styles[i+1].pos,
                ci_lbegin_doc : rng.ci_lbegin_doc,
                ci_lend_doc   : rng.ci_lend_doc                       
            }     

            let font = this.tb.fontloader!.getSync(fstyle.familyName, fstyle.typeStyle);
            if (font) {
                font_context = {
                    font: font,
                    align: align,
                    domLine: domLine,
                    textRng : textRng
                }
                let font_size_px = fstyle.FontSize * 96 / 72;   // "pt" to "px"
                metrics.max_font_size_px = Math.max(font_size_px, metrics.max_font_size_px);
				pos.y = metrics.ascent; // 의미는 없음.
				
                let dim = this.svgTextRender.getGlyphsDimension(text, pos, fstyle, font_context);
				metrics.set_with_dimension(dim)
				metrics.set_with_font(font, font_size_px)
            }            
        }

        metrics.width_without_last_glyph_ws = metrics.width - metrics.last_glyph_white_space;        
        return metrics;
    }
}