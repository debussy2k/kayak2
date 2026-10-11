import TextBoxDom from "./TextBoxDom";
import type { DomLine } from './TextBoxDom';
import type { TextBoxHost, FrameSize } from './types';

/** traverse_by_line() 콜백 인자. TB_SvgGradientFactory.build_gradient_defs()의 data로도 쓴다 */
export interface LineWalkData { x: number; y: number; line: DomLine; index: number }

class TB_LayoutWalker {
	tb: TextBoxHost;

	constructor(tb: TextBoxHost) {
		this.tb = tb;
	}

	traverse_by_line(callback: (data: LineWalkData) => void): FrameSize {
        let tb = this.tb;
        let tbdom = tb.layout!.get_tbdom();

        let svg_str = '';

        let x = 0;
        let y = tb.tbconfig.page.gutter_top 
                + tb.tbpreference.computed_values.valign_padding_top
                - tb.tbpreference.computed_values.first_line_excluded_heading_space
                + tb.tbpreference.computed_values.embox_height_offset_px

        let lines = tbdom.getDomLines();
        lines.forEach((line, index) => {
            x = tb.tbconfig.computed_page_gutter_left + line.offset_left;
            y += line.space_before;            

            // do something.
            // x, y, line.svg_path
            let data: LineWalkData = { x, y, line, index }
            callback(data)

            // line_height: 
            //   auto leading인 경우는 (glyph-height + line-space) 임
            //   수동 leading인 경우는 leading값 그대로임
            // 단, 마지막 줄에서는 실제 glyph의 높이만큼의 값을 가져야 하므로 dom_line_height를 적용함.
            if (index == lines.length-1)
                y += line.dom_line_height + line.space_after;
            else
                y += line.line_height + line.space_after;
        })

        let frame_width = tb.tbconfig.page.width;
        let frame_height = y + tb.tbconfig.page.gutter_bottom;
        if (tb.tbpreference.fit_to_content_height == false)
            frame_height = tb.tbpreference.frame_height;

        return {frame_width: frame_width, frame_height: frame_height};
   }	
}

export { 
    TB_LayoutWalker
};
