import TB_Dom from './TB_Dom';

import { TB_SvgTextRender } from './TB_SvgTextRender'
import { TB_StyleService } from './services/TB_StyleService'
import { TB_SvgLineFactory } from './TB_SvgLineFactory'
import { TB_SvgDimension } from './TB_SvgDimension';
import type { TB_RangeMetric } from './TB_RangeMetric';
import type { TB_LineMetric } from './TB_LineMetric';
import type { TB_LineRenderOptions } from './TB_LineRenderOptions';
import type { TB_PosTracker } from './layout_service/TB_PosTracker';
import type { TextBoxHost, TextLineRange, LineViewObj, SvgTextLine } from './types';

/**
 * @fileOverview TextBox의 내용에서 HTML 생성.
 * @author  Harry
 */


/** 
 * Document Factory. Generate HTML string based on textbox
 * @constructor
 * @param {Object} textbox_obj textbox object.
 */
export class TB_DocFactory {
    tb: TextBoxHost;
    svgTextRender: TB_SvgTextRender;
    styleSerivce: TB_StyleService;
    svgFactory: TB_SvgLineFactory;
    svgDimension: TB_SvgDimension;
    line_view_class: string;
    line_view_selector: string;
    gutter_wrapper_class: string;
    gutter_wrapper_selector: string;
    line_class: string;
    line_selector: string;

    constructor(textbox_obj: TextBoxHost) {
        this.tb = textbox_obj;

        this.svgTextRender = new TB_SvgTextRender();
        this.styleSerivce = new TB_StyleService(textbox_obj);
        this.svgFactory = new TB_SvgLineFactory(textbox_obj, this.svgTextRender, this.styleSerivce);
        this.svgDimension = new TB_SvgDimension(textbox_obj, this.svgTextRender, this.styleSerivce)

        /**
         * line view class의 이름.
         * @type {String}
         */
        this.line_view_class = "kayak-lineview";
        this.line_view_selector = ".kayak-lineview";
        this.gutter_wrapper_class = "kayak-gutter-wrapper";
        this.gutter_wrapper_selector = ".kayak-gutter-wrapper";
        this.line_class = "kayak-line";
        this.line_selector = ".kayak-line";
    }



    // TB_SvgLineFactory는 default_font를 가지고 있으므로, 문서를 로딩하면 갱신해 주어야 한다.    
    update_default_font_state(): void {
        this.styleSerivce.update_default_font_state();
    }

    /**
     * Create new line view elements
     * @return {Object} { line_view, gutter, linespace_top, line } : DOM elements
     */
    create_line_view_obj(): LineViewObj {
        var line_view_obj: LineViewObj = {
            line_view: TB_Dom.createElement("<div class='kayak-lineview'></div>") as HTMLElement,
            gutter: TB_Dom.createElement("<div class='kayak-gutter-wrapper'></div>") as HTMLElement,
            linespace_top: TB_Dom.createElement("<div class='kayak-linespace-top'></div>") as HTMLElement,
            line: TB_Dom.createElement("<div class='kayak-line' style='padding-left:0px;'></div>") as HTMLElement,
            // linespace_bottom: TB_Dom.createElement("<div class='kayak-linespace-bottom'></div>"),
        }

        line_view_obj.line_view.appendChild(line_view_obj.gutter);
        line_view_obj.line_view.appendChild(line_view_obj.linespace_top);
        line_view_obj.line_view.appendChild(line_view_obj.line);
        // line_view_obj.line_view.appendChild(line_view_obj.linespace_bottom);

        return line_view_obj;
    }

    /* callback을 리턴하게 하고, 관련된 자료를 받아 target별로 생성하도록 하기.
        pos_tracker.par_index   	: 현재 par index
        curr_metric.lineWidth	    : line의 전체 폭
        curr_metric.content_width   : 실제 문자가 차지하는 폭
        curr_metric.trailing_ws_px  : 글줄 마지막에 있는 공백문자열의 폭(unit:pixel). align center/right를 위해 필요.
    */
   populate_data_on_domLine(pos_tracker: TB_PosTracker, curr_metric: TB_LineMetric, domLine: any): void {
		// core_width 게산.  content_width에서 마지막 glyph의 letter-space와 이후 trailing_ws_px가 제외된 영역
        domLine.core_width = curr_metric.content_width - (curr_metric.last_glyph_white_space + curr_metric.trailing_ws_px);
        let par_attr = this.tb.m_Par.getAttr_by_pi(pos_tracker.par_index);

		// align 및 indentation에 따른 offset_left 위치계산 및 설정
        domLine.alignment_option = par_attr.m_Align;
        domLine.offset_left = this.calc_offset_left(pos_tracker, curr_metric, par_attr, domLine.core_width)

        // 줄 간격 설정 
        this.set_line_height_by_leading(domLine, curr_metric, par_attr);

		// 단락 앞 공백 
        if (pos_tracker.li_par === 0)
            domLine.space_before = par_attr.m_SpaceBefore;
		// 단락 뒤 공백 
        if (curr_metric.is_last_line === true)
		domLine.space_after = par_attr.m_SpaceAfter;
		// 참고: par를 line으로 만들어가는 과정이므로, 아래와 같은 비교는 불가능하다.
        // (pos_tracker.li_par === curr_metric.domPar.lines.length-1)
		
        domLine.max_font_size_px 	   = curr_metric.max_font_size_px; // InDesign방식과 동일한 글줄 구조로 함.
        domLine.max_word_height 	   = curr_metric.max_height;
        domLine.max_word_ascent 	   = curr_metric.max_ascent;
        domLine.max_word_ascent_d 	   = curr_metric.max_ascent_d;
        domLine.max_word_descent 	   = curr_metric.max_descent;
        domLine.line_width 			   = curr_metric.lineWidth;
        domLine.content_width 		   = curr_metric.content_width;
        domLine.trailing_ws_px 		   = curr_metric.trailing_ws_px;
        domLine.trailing_ws_count 	   = curr_metric.trailing_ws_count;
        domLine.last_glyph_white_space = curr_metric.last_glyph_white_space;
	}
	
	// private method
	// core_width: content_width에서 마지막 glyph의 letter-space와 이후 trailing_ws_px가 제외된 영역
	calc_offset_left(pos_tracker: TB_PosTracker, curr_metric: TB_LineMetric, par_attr: any, core_width: number): number {
        let offset_left = 0;
        switch (par_attr.m_Align) {
            case 'left':
                offset_left = 0;
                break;
            case 'center':
                offset_left = (curr_metric.lineWidth - core_width) / 2;
                break;
            case 'right':
                offset_left = (curr_metric.lineWidth - core_width);
                break;
            case 'left-justified':
                offset_left = 0;
                break;
            case 'center-justified':
                if (curr_metric.is_last_line)
                    offset_left = (curr_metric.lineWidth - core_width) / 2;
                break;
            case 'right-justified':
                if (curr_metric.is_last_line)
                    offset_left = (curr_metric.lineWidth - core_width);
                break;
            case 'fully-justified':
                offset_left = 0;
                break;
        }

		offset_left += par_attr.m_Lindent;
		if (pos_tracker.li_par === 0)
			offset_left += par_attr.m_Findent;		
			
		return offset_left > 0 ? offset_left : 0;
	}

	set_line_height_by_leading(domLine: any, curr_metric: TB_LineMetric, par_attr: any): void {
        // curr_metric.max_height는 글줄에서 최대 font의 px환산 높이값과 동일.

		domLine.line_height_base = curr_metric.max_height;
		if (par_attr.m_Leading == 'auto') {
			domLine.leading = 'auto';
			domLine.line_body_height = curr_metric.max_height;
			domLine.line_height = curr_metric.max_height * par_attr.m_LineSpace;
			domLine.line_holder_height = curr_metric.max_height;
			domLine.dom_line_height = curr_metric.max_height;
		}
		else {
			domLine.leading = 'fixed';
			let leading_px = par_attr.m_Leading * 96 / 72; // "pt" to "px"
			let height_by_leading = leading_px;
			domLine.line_height = height_by_leading;
			domLine.line_body_height = height_by_leading;
			domLine.line_holder_height = leading_px;
			// kayak-line의 높이는 line_holder_height로 설정. (중요)만약 마지막 라인이면 실제 glyph가 차지하는 높이 만큼 height를 설정함. 
			domLine.dom_line_height = curr_metric.is_last_line_on_doc ? domLine.line_height_base : domLine.line_holder_height;
		}
	}

    build_lineview(line_view_obj: LineViewObj, domLine: any, rng: TextLineRange, line_render_options: TB_LineRenderOptions): void {
        // html을 만들어 넣기.	
        let ret = this.get_rendered_textline(rng, domLine, line_render_options);
        /*
            {
                line_content
                metrics
                svg_paths
                svg_glyph_arr
                width
            }
        */

        if (this.tb.tbconfig.text_render == 'svg') {
            domLine.svg_paths = ret.svg_paths;
            domLine.svg_glyph_arr = ret.svg_glyph_arr;
        }

        let line_space = domLine.line_height - domLine.line_body_height;
        let line_view_padding_bottom = line_space + domLine.space_after;

        let css_line_view = {
            'box-sizing' : 'content-box',   // height에 padding을 포함하지 않음.
            'margin-bottom' :  0, //
        };

        let css_linespace_top = {
            "height": domLine.space_before + "px"
        }
        let css_line = {
            'height' : domLine.dom_line_height + 'px',
			'padding-left' : domLine.offset_left,
			'margin-bottom' : line_view_padding_bottom + "px"	//(B) 0보다 작은 값 설정이 가능함.
		}
		
		//(A) css height는 0보다 작을 수 가 없기 때문에, line-space가 1(100%)이하 처리가 안됨. (B)방식으로 변경함
        // let css_linespace_bottom = {
        //     "height":  line_view_padding_bottom + "px" 
        // }

        
        // setting html or svg 
        // text_on_path모드에서는 textbox의 내용을 채우지 않음.
        if (this.tb.text_on_path == undefined)
            line_view_obj.line.insertAdjacentHTML('beforeend', ret.line_content);

        // setting CSS
        TB_Dom.css(line_view_obj.line_view, css_line_view);
        TB_Dom.css(line_view_obj.linespace_top, css_linespace_top);
        TB_Dom.css(line_view_obj.line, css_line);
        // TB_Dom.css(line_view_obj.linespace_bottom, css_linespace_bottom);
    }

    // called completed line is appended to (temporary) dom object.
    on_line_completed(line_view_obj: LineViewObj, pos_tracker: TB_PosTracker): void {

		//D Release Mode에서는 필요없는 부분이므로, 추후 대응할 것.
		if (this.tb.tbconfig.debug.show_line_gutter) {
			var str = "<div>";
			str += "[" + pos_tracker.par_index + ":" + pos_tracker.li_par + "]";
			str += ' - ';
			str += "[" + pos_tracker.ci_lbegin_par + "," + pos_tracker.line_char_count + "]";
			str += "</div>";
			line_view_obj.gutter.insertAdjacentHTML('beforeend', str);
		}
    }




    ////////////////////////////////////////////////////////////////////////////
    // interface for both HTML & SVG
    ////////////////////////////////////////////////////////////////////////////
    get_rendered_textline(rng: TextLineRange, domLine: any, line_render_options: TB_LineRenderOptions): SvgTextLine {
        return this.svgFactory.get_svg_textline(rng, domLine, line_render_options);
    }
    get_dimension_of_range(rng: TextLineRange, align: string | null, domLine?: any): TB_RangeMetric {   // TB_WordInfo.measureText()가 호출함.
        return this.svgDimension.get_dimension_of_text_range(rng, align, domLine)
    }
}