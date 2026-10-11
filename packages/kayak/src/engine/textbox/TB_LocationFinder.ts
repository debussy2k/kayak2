import TextBoxDom from "./TextBoxDom";
import type { LineLocator } from './TextBoxDom';
import { CGMatrix } from './cg';
import * as log from "loglevel";
import type { TextBoxHost, CursorLocationInfo, MouseLocationInfo, MouseLocationOptions, TextLineRange } from './types';
import type { TB_DocFactory } from './TB_DocFactory';
import type { TB_RangeMetric } from './TB_RangeMetric';


class TB_LocationFinder {
    tb: TextBoxHost;
    docFactory: TB_DocFactory;
    tbdom: TextBoxDom;
    KayakContent: HTMLElement;

    constructor(textbox_obj: TextBoxHost, tbdom: TextBoxDom) {
        this.tb = textbox_obj;
        this.docFactory = textbox_obj.docFactory!;
        this.tbdom = tbdom;

		// 향후 nested될 수 있는 .kayak-content를 제외하기 위해 첫번째 것만 사용함.
		this.KayakContent = this.tb.element.querySelector('.kayak-content')!;
    }


    /** 
    <p>text selection시 line의 끝까지 selection 하기 위해서	selection의 끝 index처리를 예외적으로 처리해 주어야 한다.</p>
    즉, 끝 index는 다음 line의 시작 index인데, <br>
    이것을 이전라인의 마지막 문자 index로 설정하고(= ci_doc-1)<br>
    x_pos의 계산시에는 원래의 ci_doc을 사용하는 방식임.

     * @param  {Number}  ci_doc       index on doc
     * @param  {Boolean} is_range_sel selection을 위한 위치인지 여부. line의 마지막을 선택하기 위한 옵션.
     * @return {Object}               {	x_pos, y_pos, max_word_height, location }
    	}
     */
    find_cursor_location_by_ci(ci_doc: number, is_range_sel?: boolean): CursorLocationInfo {
        // sampled_ci_doc는 selection
        var sampled_ci_doc = is_range_sel ? (ci_doc - 1) : ci_doc;
        if (sampled_ci_doc < 0)
            sampled_ci_doc = 0;

        // (ci_doc이 last$이고, is_range_sel이 true인 경우)에는 
        // $linvview_elem를 얻기 위해 (last$-1)인 sampled_ci_doc을 이용하고, 
        // last$까지의 width를 얻기 위해서는 ci_doc(last$에 해당)을 직접 사용한다.

        var loc = this.tbdom.get_location(sampled_ci_doc);
        // 중요: loc.ci_doc은 사용하지 말 것. 대신 ci_doc(함수 parameter로 넘오언 것) 사용할 것.

        // 작업순서.
        // 1. li_doc으로 $lineview_elem을 찾기.
        // 2. x_pos 계산.
        //    dim(ci_lbegin_doc, ci_doc).width 확보하기.
        // 3. y_pos 계산 
        // 	  loc_info.y_pos = $lineview_elem.offset().top - contentPos.top;
        // 4. line height 계산.


        // 1. li_doc으로 line을 찾기. (속도향상을 위하여 this.tbdom.lineview_arr을 도입하였음)

        // 2. x_pos 계산.
        var dom_line = this.tbdom.get_domLine_by_line_number(loc.li_doc).domLine;        
        var rng: TextLineRange, dim: TB_RangeMetric;
        if (loc.ci_lbegin_doc === ci_doc) {
            // line의 첫번째 index에서는 범위가 없는 공백 문자열로는 dimension 계산이 안되므로 
            // 아래와 같이 임으로 하나 늘려서 계산하고, width는 0으로 강제 설정한다.
            rng = {
                begin: ci_doc,
                end: ci_doc + 1,
                ci_lbegin_doc : loc.ci_lbegin_doc,
                ci_lend_doc : loc.ci_lend_doc
                
            }
            // get_dimension_of_range()에서 온 값을 변경 하면 안되므로, shallow copy하여 사용한다.
            dim = Object.assign({}, this.docFactory.get_dimension_of_range(rng, null, dom_line));
            dim.width = 0;
        } else {
            rng = {
                begin: loc.ci_lbegin_doc,
                end: ci_doc,
                ci_lbegin_doc : loc.ci_lbegin_doc,
                ci_lend_doc : loc.ci_lend_doc                
            }
            dim = this.docFactory.get_dimension_of_range(rng, null, dom_line);
        }

        // 3. y_pos 계산 
        var y_pos = 0;

        /* 3A. 아래 방식은 dom element을 이용해  y-position을 얻는 방식.
           scale이 적용되면 scale이 적용된 값이 얻어지므로 사용 불가함.
        */
        // var contentPos = $KayakContent.offset(); // {top, left} relative to the document
        // y_pos = $lineview_elem.find('.kayak-line:first').offset().top - contentPos.top;
        // console.log("line-top: ", $lineview_elem.find('.kayak-line:first').offset().top);
        // console.log("cont-top: ", contentPos.top);
        // console.log("y_pos   : ", y_pos);

        // 3B. scale과 독립적으로 얻는 방법
        y_pos += this.tbdom.get_y_pos_by_line_number(loc.li_doc).y_pos;
        
        // baseline-offset 설정에 따라 line height를 보정해 주어야 한다. 
        y_pos += this.tb.tbpreference.computed_values.embox_height_offset_px;
        y_pos -= this.tb.tbpreference.computed_values.first_line_excluded_heading_space;
        if (this.tb.tbpreference.fit_to_content_height == false)
            y_pos += this.tb.tbpreference.computed_values.valign_padding_top;

        // console.log("ret.y_pos   : ", y_pos);


        // 4. line height 계산.
        var line_obj = this.tbdom.get_line_by_line_counter(loc.li_doc);

        // make result
        if (line_obj.line == null) {
            log.error('line_obj.line is null');
            alert('line_obj.line is null');   // node에는 alert가 없다. issues.md #10
        }

        let cursor_height = line_obj.line!.max_font_size_px;

        return {
            x_pos: line_obj.line!.offset_left + dim.width,
            y_pos: y_pos,
            height: cursor_height,
            ascent: dim.ascent,
            descent: dim.descent,
            max_word_ascent: dom_line!.max_word_ascent,
            max_word_descent: dom_line!.max_word_descent,
            max_word_height: line_obj.line!.max_word_height,
            location: loc
        }
    }

    /**
     * mouse pointer 위치에 대한 location 찾기.
     * @param  {Object} e mouse event object
     * @return {Object}   location
     */
    find_cursor_location_by_mouse_point(e: MouseEvent | Touch, opt?: MouseLocationOptions): MouseLocationInfo | null {
        // e.pageXY   : relative to the leftTop of the document(fully rendered content area).
        // e.clientXY : relative to the leftTop of the browser window.

        // A. 회전하기 전의 kayak-root box를 확보한다.
        //
        // var domRect = this.tb.tbconfig.element.getBoundingClientRect();
        var domRect = this.tb.tbconfig.content_elem!.getBoundingClientRect();
        var dom_center = {
            x: domRect.left + domRect.width / 2,
            y: domRect.top + domRect.height / 2,
        }

        // scrollWidth/scrollHeight는 transform이 적용되기 전의 값을 얻기 위해 사용된다.
        // var box_width = this.tb.tbconfig.element.scrollWidth * this.tb.tbconfig.page.scale; // <-- scrollWidth는 trailing ws를 포함할 경우 부정확한 결과가 나올수 있으므로 사용불가.
        var box_width = this.tb.tbconfig.page.width * this.tb.tbconfig.page.scale;
        var box_height = this.tb.tbconfig.element!.scrollHeight * this.tb.tbconfig.page.scale;

        // 화면에 보이면 크기와 동일하지만, rotate하기 전(angle=0)의 box 영역임. 
        var orthogonal_box = {
            x: dom_center.x - box_width / 2,
            y: dom_center.y - box_height / 2
        }

        // B. click한 mouse pos를 회전전의 대응점을 구한다.
        //
        var mat = new CGMatrix();
        var radian = this.tb.tbconfig.transform.angle / 180 * Math.PI;
        mat.rotateAtCenter(-radian, dom_center);
        var mpos = { x: e.clientX, y: e.clientY };
        var tr_pt = mat.transformPoint(mpos);


        // C. lineview element를 확보한다.
        //
        var extended_serach = (opt && opt.find_outof_box) ? true : false;
        /*  this.tb.tbconfig.page.gutter_top을 빼주는 이유는 
            .kayak-content의 box를 top을 기준으로 하기 위함. 
            참고: orthogonal_box는 .kayak-root의 box임.
         */
        var top_offset = this.tb.tbconfig.page.gutter_top;
        if (this.tb.tbpreference.fit_to_content_height == false)
            top_offset += this.tb.tbpreference.computed_values.valign_padding_top;
        var mouse_y_on_kayak_content = ((tr_pt.y - orthogonal_box.y) / this.tb.tbconfig.page.scale) - top_offset;
        var line_num = this.tbdom.get_line_number_by_y(mouse_y_on_kayak_content, extended_serach);
        // console.log('line_num: ', line_num)
        if (line_num == -1)
            return null;

        // D.
        //

        // scale이 지정되어 있는 경우 mouse 위치를 보정해 준다. (수평만 해당)
        var mouse_x_on_kayak_page = (tr_pt.x - orthogonal_box.x) / this.tb.tbconfig.page.scale;
        if (mouse_x_on_kayak_page > this.tb.tbconfig.page.width && extended_serach == false) {
            log.debug('out of hor box');
            return null;
        }

        var loc_info: MouseLocationInfo = {
            x_mouse: mouse_x_on_kayak_page - this.tb.tbconfig.computed_page_gutter_left, // content영역 local x 좌표.
            li_doc: line_num!,
            ci_doc: -1,
            ci_line: -1,
            x_pos: 0,
            y_pos: 0,
            max_word_height: 0
        }

        // 1. li_doc에 대한 li_lbegin_doc 확보.
        // 2. dim(rng(li_lbegin_doc, ci_doc)).width > mouse_ifo.x_mouse 인 ci_doc을 발견.		
        var loc = this.tbdom.get_line_by_line_counter(loc_info.li_doc);
        if (loc.line === null)
            return null;
        loc_info.max_word_height = loc.line.max_word_height;

        this.find_location_by_x_pos(loc, loc_info, (opt && opt.find_pos_to_line_end));

        loc_info.y_pos = mouse_y_on_kayak_content;

        // console.log(">loc_info: ", loc_info);
        return loc_info;
    }



    /**
     * line상에서 x_pos에서 가장 가까운 location 찾기.
     * @param  {Number} li_doc line index
     * @param  {Number} x_pos  line의 시작점을 0으로 하는 x상의 위치.
     * @return {Object}        location
     */
    find_cursor_location_by_line_num(li_doc: number, x_pos: number): MouseLocationInfo | null {
        // 주로 cursor up/down 기능을 위해 사용되는 함수임.
        // line상의 마지막 char 직전(li_lend_doc-1)까지 검사한다. 
        // li_lend_doc 위치는 사실상 다음 line의 첫번째 char이고, 
        // cursor up/down으로 line상의 마지막 까지 selection할 필요는 없기 때문임.

        var contentPos = this.KayakContent.getBoundingClientRect(); // 아래에서 line과의 top 차이만 사용함.
        if (li_doc < 0) {
            li_doc = 0;
            x_pos = 0;
        } else if (li_doc >= this.tbdom.lineview_arr.length) {
            li_doc = this.tbdom.lineview_arr.length - 1;
            x_pos = 9999999999;
        }

        var lineview_elem = this.tbdom.lineview_arr[li_doc];
        var loc_info: MouseLocationInfo = {
            x_mouse: x_pos, // content영역 local x 좌표.
            li_doc: li_doc, // -1 if failed
            ci_doc: -1,
            ci_line: -1,
            x_pos: 0,
            y_pos: 0,
            max_word_height: 0
        }

        // 1. li_doc에 대한 li_lbegin_doc 확보.
        // 2. dim(rng(li_lbegin_doc, ci_doc)).width > mouse_ifo.x_mouse 인 ci_doc을 발견.		
        var loc = this.tbdom.get_line_by_line_counter(loc_info.li_doc);
        if (loc.line === null)
            return null;
        loc_info.max_word_height = loc.line.max_word_height;

        this.find_location_by_x_pos(loc, loc_info);

        loc_info.y_pos = lineview_elem.getBoundingClientRect().top - contentPos.top;
        return loc_info;
    }


    /*
    	loc :
    		ci_lbegin_doc : 
    		ci_lend_doc :
    		line : DomLine
    			char_count :
    			index_offset :
    			max_word_height :
    			offset_left:
    	}
    */
    find_location_by_x_pos(loc: LineLocator, loc_info: MouseLocationInfo, sel_range?: boolean): void {
        var self = this;   // 아래 decide_left_or_right가 while 안에서 선언보다 먼저 불린다(호이스팅). function 선언과 self를 유지한다.
        var bin_begin = loc.ci_lbegin_doc;
        var bin_end = sel_range ? loc.ci_lend_doc : loc.ci_lend_doc - 1;
        if (bin_begin == bin_end) {
            loc_info.ci_doc = bin_begin;
            loc_info.ci_line = 0;
            loc_info.x_pos = 0;
            return;
        }

        // binary search
        while (true) {
            var bin_half = (bin_begin + bin_end) / 2 | 0; // "|0"는 소수점을 제거
            if (bin_end - bin_begin == 1)
                return decide_left_or_right(bin_begin, null);

            var rng_for_measure = { 
                begin: loc.ci_lbegin_doc, 
                end: bin_half,
                ci_lbegin_doc : loc.ci_lbegin_doc,
                ci_lend_doc : loc.ci_lend_doc
             };
            var dim = this.docFactory.get_dimension_of_range(rng_for_measure, null, loc.line);
            var actual_width = loc.line!.offset_left + dim.width;

            if (loc_info.x_mouse < actual_width) {
                if (bin_half - bin_begin == 1)
                    return decide_left_or_right(bin_begin, null);
                else
                    bin_end = bin_half;
            } else {
                if (bin_end - bin_half == 1)
                    return decide_left_or_right(bin_half, actual_width);
                else
                    bin_begin = bin_half;
            }
        }

        function decide_left_or_right(index: number, width: number | null): void {
            if (width === null) {
                let rng = {
                    begin: loc.ci_lbegin_doc, 
                    end: index,
                    ci_lbegin_doc : loc.ci_lbegin_doc,
                    ci_lend_doc : loc.ci_lend_doc                        
                }
                var dim_base = self.docFactory.get_dimension_of_range(rng, null, loc.line);
                width = loc.line!.offset_left + dim_base.width;
            }

            let rng = { 
                begin: index, 
                end: index + 1,
                ci_lbegin_doc : loc.ci_lbegin_doc,
                ci_lend_doc : loc.ci_lend_doc                        
        };
            var dim_one_char = self.docFactory.get_dimension_of_range(rng, null, loc.line);
            var half = width + (dim_one_char.width / 2);
            if (loc_info.x_mouse < half) {
                loc_info.ci_doc = index;
                loc_info.ci_line = index - loc.ci_lbegin_doc;
                loc_info.x_pos = width;
            } else {
                loc_info.ci_doc = index + 1;
                loc_info.ci_line = (index + 1) - loc.ci_lbegin_doc;
                loc_info.x_pos = width + dim_one_char.width;
            }
        }
    }
    
}


export { 
    TB_LocationFinder
}