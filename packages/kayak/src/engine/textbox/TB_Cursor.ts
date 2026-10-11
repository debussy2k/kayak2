import TB_Dom from './TB_Dom';
import TB_Utils from './TB_Utils';
import TB_SelRange from './TB_SelRange';
import { EmptyRangeRule } from './TextBoxEnv'
import type { TextBoxHost, SelInfo, CursorLocationInfo } from './types';

/** render_selection_overlay()가 TB_Dom.css()에 넘기는 overlay 박스 */
type SelBoxInfo = { left: number; width: number; top: number; height: string; visibility?: string }   // type(not interface): TB_Dom.css의 Record 인자에 맞추기 위해

class TB_Cursor {
    cursor: number;

    private tb: TextBoxHost;
    private last_cursor_loc_info: CursorLocationInfo | null; // cursor
    private last_sel_begin_loc_info: CursorLocationInfo | null; // selection begin
    private last_sel_end_loc_info: CursorLocationInfo | null; // selection end
    // structure ==>
    // x_pos : Number,
    // y_pos : Number,
    // max_word_height : Number,
    // location : TBLocation
    private last_sel_li_doc_b: number | null;
    private last_sel_li_doc_e: number | null;

    private m_cursor_last_x_position: number;
    private tbsel: TB_SelRange;
    private cursor_elem: HTMLElement | null;
    private sel_begin_elem: HTMLElement | null;
    private sel_end_elem: HTMLElement | null;

    private cursor_width_px: number;

    private show_selection_flag: boolean;

    constructor(textbox_obj: TextBoxHost) {
        this.tb = textbox_obj;
        this.cursor = 0;
        this.last_cursor_loc_info = null;
        this.last_sel_begin_loc_info = null;
        this.last_sel_end_loc_info = null;
        this.last_sel_li_doc_b = null;
        this.last_sel_li_doc_e = null;

        this.m_cursor_last_x_position = 0;
        this.tbsel = new TB_SelRange(this.tb.tbinput);
        this.cursor_elem = null;
        this.sel_begin_elem = null;
        this.sel_end_elem = null;

        this.cursor_width_px = 2;

        this.show_selection_flag = true;

        ////////////
        this.init();
    }

    private init(): void {
        this.init_elem()
    }

    private init_elem(): void {
        if (this.tb.element) {
            this.cursor_elem = this.tb.element.querySelector('.kayak-cursor');
            this.sel_begin_elem = this.tb.element.querySelector('.kayak-sel-begin');
            this.sel_end_elem = this.tb.element.querySelector('.kayak-sel-end');
        }
    }


    show_cursor(val: boolean): void {
        TB_Dom.css(this.cursor_elem, {
            visibility: val == true ? "visible" : "hidden"
        })

        if (this.tb.text_on_path)
            this.tb.text_on_path.show_cursor(val);
    }

    get_location_info(): { last_cursor_loc_info: CursorLocationInfo | null; last_sel_begin_loc_info: CursorLocationInfo | null; last_sel_end_loc_info: CursorLocationInfo | null } {
        /* structure
        	x_pos : Number,
        	y_pos : Number,
        	max_word_height : Number,
        	location : TBLocation
        */
        return {
            last_cursor_loc_info: this.last_cursor_loc_info,
            last_sel_begin_loc_info: this.last_sel_begin_loc_info,
            last_sel_end_loc_info: this.last_sel_end_loc_info
        }
    }

    set(ci_doc: number): void {
        // cursor를 ci_doc위치로 옮긴다.
        // cursor을 옮기면 selction은 clear된다.

        var text_length = this.tb.text_length();

        if (ci_doc < 0)
            this.cursor = 0;
        else if (ci_doc >= text_length)
            this.cursor = text_length - 1;
        else
            this.cursor = ci_doc;

        this.tbsel.reset(); // selection clear.

        this.repaint();
    }

    repaint(dont_update_last_cursor_x_postion?: boolean): void {
        // 컨텐츠에 수정이 가해진 명령 뒤에 repaint()를 호출.
        // 아래에서 null을 주는 이유는, selection영역 전체를 다시 렌더링 유도하기 위함.
        this.last_sel_li_doc_b = null;
        this.last_sel_li_doc_e = null;

        this.internal_repaint(dont_update_last_cursor_x_postion);
    }
    internal_repaint(dont_update_last_cursor_x_postion?: boolean): void {
        // selection영역 repaint를 최소한으로 하기 위한 작업이 적용되어 있음.

        if (this.tb.layout === null)
            return;
        if (this.tb.is_initialized() == false)
            return;

        this.last_cursor_loc_info = this.tb.layout.finder.find_cursor_location_by_ci(this.cursor);
        TB_Dom.css(this.cursor_elem, {
            'left': this.last_cursor_loc_info.x_pos,
            'top': this.last_cursor_loc_info.y_pos,
            'height': this.last_cursor_loc_info.height,
            'width': this.cursor_width_px / this.tb.tbconfig.page.scale
        });
		// console.log('tb.tbconfig.page.scale', tb.tbconfig.page.scale)


        if (dont_update_last_cursor_x_postion !== false)
            this.m_cursor_last_x_position = this.last_cursor_loc_info.x_pos;

        if (this.tbsel.is_empty()) {
            this.remove_selection_overlay();

            this.last_sel_li_doc_b = null;
            this.last_sel_li_doc_e = null;
        } else {
            this.last_sel_begin_loc_info = this.tb.layout.finder.find_cursor_location_by_ci(this.tbsel.m_from);
            this.last_sel_end_loc_info = this.tb.layout.finder.find_cursor_location_by_ci(this.tbsel.m_to, true);
            this.render_selection_overlay();

            this.last_sel_li_doc_b = this.last_sel_begin_loc_info.location.li_doc;
            this.last_sel_li_doc_e = this.last_sel_end_loc_info.location.li_doc;
        }

        if (this.tb.text_on_path) {
            this.tb.text_on_path.update_cursor();
        }
    }


    private remove_selection_overlay(): void {
        this.sel_begin_elem!.style.display = 'none';
        this.sel_end_elem!.style.display = 'none';
        //////////////////////////////////////////////////////////////////

        TB_Dom.removeAll(this.tb.element.querySelectorAll('.kayak-line > .kayak-selection-overlay'));
    }

    private render_selection_overlay(): void {
        // for debugging
        // $sel_begin.css({
        // 	'display' 			: 'inline',
        // 	'background-color'  : 'red',
        // 	'left'   			: last_sel_begin_loc_info.x_pos-2,
        // 	'top'    			: last_sel_begin_loc_info.y_pos,
        // 	'height' 			: last_sel_begin_loc_info.max_word_height,
        // 	'width'  			: 2
        // })
        // $sel_end.css({
        // 	'display' 			: 'inline',
        // 	'background-color'  : 'blue',
        // 	'left'   			: last_sel_end_loc_info.x_pos,
        // 	'top'    			: last_sel_end_loc_info.y_pos,
        // 	'height' 			: last_sel_end_loc_info.max_word_height,
        // 	'width'  			: 2
        // })
        //////////////////////////////////////////////////////////////////

        var tbdom = this.tb.layout!.get_tbdom();

        var li_doc_b = this.last_sel_begin_loc_info!.location.li_doc;
        var li_doc_e = this.last_sel_end_loc_info!.location.li_doc;


        var i = 0;
        var line_elem: HTMLElement | null = null;
        var sel_overlay_elem: HTMLElement | null = null;

        // [last_sel_li_doc_b, li_doc_b) --> del
        if (this.last_sel_li_doc_b !== null)
            for (i = this.last_sel_li_doc_b; i <= li_doc_b; i++) {
                line_elem = tbdom.lineview_arr[i].getElementsByClassName('kayak-line')[0] as HTMLElement;
                TB_Dom.removeAll(line_elem.querySelectorAll('.kayak-selection-overlay'));
            }

        // (li_doc_e, last_sel_li_doc_e] --> del
        if (this.last_sel_li_doc_e !== null)
            for (i = li_doc_e; i <= this.last_sel_li_doc_e; i++) {
                line_elem = tbdom.lineview_arr[i].getElementsByClassName('kayak-line')[0] as HTMLElement;
                TB_Dom.removeAll(line_elem.querySelectorAll('.kayak-selection-overlay'));
            }

        var bbb = Math.max(li_doc_b, this.last_sel_li_doc_b!);
        var eee = Math.min(li_doc_e, this.last_sel_li_doc_e!);

        for (i = li_doc_b; i <= li_doc_e; i++) {
            // 변경이 필요없는 부분은 그대로 둔다.
            if (bbb < i && i < eee && this.last_sel_li_doc_b !== null)
                continue;

            line_elem = tbdom.lineview_arr[i].getElementsByClassName('kayak-line')[0] as HTMLElement;

            sel_overlay_elem = line_elem.querySelector('.kayak-selection-overlay');
            if (sel_overlay_elem === null) {
                sel_overlay_elem = TB_Dom.createElement("<div class='kayak-selection-overlay'></div>") as HTMLElement;
                line_elem.insertBefore(sel_overlay_elem, line_elem.firstChild);
            }

            var box_info = this.get_box_info(i, tbdom, li_doc_b, li_doc_e);
            box_info.visibility = this.show_selection_flag ? 'visible' : 'hidden'; // selection을 실제 보여줄지 여부 결정.
            TB_Dom.css(sel_overlay_elem, box_info);
        }
    }
    private get_box_info(index: number, tbdom: any, li_doc_b: number, li_doc_e: number): SelBoxInfo {
        let line_info = tbdom.get_domLine_by_line_number(index);
        var dom_line = line_info.domLine;

        var box_info: SelBoxInfo = {
            left: 0,
            width: 0,
            top: 0,
            height: dom_line.line_height_base + 'px'
        }
        if (index == 0)
            box_info.top = this.tb.tbpreference.computed_values.embox_height_offset_px;

        let is_justified =
            dom_line.alignment_option == 'left-justified' ||
            dom_line.alignment_option == 'center-justified' ||
            dom_line.alignment_option == 'right-justified' ||
            dom_line.alignment_option == 'fully-justified';
        //line_info.is_last_line_on_par == false
        switch(dom_line.alignment_option) {
            case 'left-justified':
            case 'center-justified':
            case 'right-justified':
                is_justified = line_info.is_last_line_on_par ? false : true;
                break;
            case 'fully-justified':
                is_justified = true;
                break;
        }


        if (li_doc_b === li_doc_e) { // sel이 한 줄에 있는 경우
            box_info.left = this.last_sel_begin_loc_info!.x_pos;
            box_info.width = this.last_sel_end_loc_info!.x_pos - this.last_sel_begin_loc_info!.x_pos;
        } else if (index === li_doc_b) { // sel의 첫번째 줄
            box_info.left = this.last_sel_begin_loc_info!.x_pos;
            if (is_justified )
                box_info.width = (dom_line.offset_left + dom_line.line_width) - this.last_sel_begin_loc_info!.x_pos;
            else
                box_info.width = (dom_line.offset_left + dom_line.content_width) - this.last_sel_begin_loc_info!.x_pos;
        } else if (index === li_doc_e) { // sel의 마지막 줄
            box_info.left = dom_line.offset_left;
            box_info.width = this.last_sel_end_loc_info!.x_pos - dom_line.offset_left;
        } else { // sel의 첫줄과 마지막줄 사이
            box_info.left = dom_line.offset_left;
            if (is_justified)
                box_info.width = dom_line.line_width;
            else
                box_info.width = dom_line.content_width;
        }
        return box_info;
    }



    input_home(bSelRange: boolean, ctrlKey: boolean): void {
        if (bSelRange) {
            if (this.tbsel.is_empty())
                this.tbsel.setFrom(this.cursor);
        } else if (this.tbsel.is_empty() == false) {
            this.cursor = ctrlKey ? 0 : this.last_cursor_loc_info!.location.ci_lbegin_doc;
            this.tbsel.reset();
            this.internal_repaint();
            return;
        }

        this.cursor = ctrlKey ? 0 : this.last_cursor_loc_info!.location.ci_lbegin_doc;

        if (bSelRange) {
            this.tbsel.setTo(this.cursor);
            // console.log('sel: (%d, %d)', tbsel.m_from, tbsel.m_to);
        }
        this.internal_repaint();
    }
    input_end(bSelRange: boolean, ctrlKey: boolean): void {
        if (bSelRange) {
            if (this.tbsel.is_empty())
                this.tbsel.setFrom(this.cursor);
        } else if (this.tbsel.is_empty() == false) {
            this.cursor = ctrlKey ? this.tb.text_length() - 1 : this.last_cursor_loc_info!.location.ci_lend_doc - 1;
            this.tbsel.reset();
            this.internal_repaint();
            return;
        }

        this.cursor = ctrlKey ? this.tb.text_length() - 1 : this.last_cursor_loc_info!.location.ci_lend_doc - 1;

        if (bSelRange) {
            this.tbsel.setTo(this.cursor);
            // console.log('sel: (%d, %d)', tbsel.m_from, tbsel.m_to);
        }
        this.internal_repaint();
    }

    input_left(step: number, bSelRange: boolean): void {
        if (bSelRange) {
            if (this.tbsel.is_empty())
                this.tbsel.setFrom(this.cursor);
        } else if (this.tbsel.is_empty() == false) {
            this.cursor = this.tbsel.m_from;
            this.tbsel.reset();
            this.internal_repaint();
            return;
        }

        var text_length = this.tb.text_length();
        var target_pos = this.cursor - step;

        if (bSelRange) {
            // selection의 end가 last$인 경우, cursor는 (last$ - 1)위치에 있음.
            // selection end를 왼쪽으로 하나 줄이는 경우 별도 처리를 해 주어야 한다.
            target_pos = (this.tbsel.m_to == text_length) ? (text_length - 1) : target_pos;
            this.cursor = (target_pos < 0) ? 0 : target_pos;
            this.tbsel.setTo(this.cursor);
            // console.log('sel: (%d, %d)', tbsel.m_from, tbsel.m_to);
        } else {
            this.cursor = (target_pos < 0) ? 0 : target_pos;
        }
        this.internal_repaint();
    }

    input_right(step: number, bSelRange: boolean): void {
        if (bSelRange) {
            if (this.tbsel.is_empty())
                this.tbsel.setFrom(this.cursor);
        } else if (this.tbsel.is_empty() == false) {
            this.cursor = this.tbsel.m_to;
            if (this.cursor == this.tb.text_length())
                --this.cursor;
            this.tbsel.reset();
            this.internal_repaint();
            return;
        }

        ////////////////////////////////////////////
        var text_length = this.tb.text_length();
        var target_pos = this.cursor + step;

        this.cursor = (target_pos >= text_length) ? text_length - 1 : target_pos;
        ////////////////////////////////////////////

        if (bSelRange) {
            this.tbsel.setTo(target_pos >= text_length ? text_length : target_pos);
            // console.log('sel: (%d, %d)', tbsel.m_from, tbsel.m_to);
        }
        this.internal_repaint();
    }

    input_up(bSelRange: boolean): void {
        if (this.last_cursor_loc_info!.location.li_doc == 0)
            return;

        if (bSelRange) {
            if (this.tbsel.is_empty())
                this.tbsel.setFrom(this.cursor);
        } else if (this.tbsel.is_empty() == false) {
            var new_loc = this.tb.layout!.finder.find_cursor_location_by_line_num(
                this.last_sel_begin_loc_info!.location.li_doc - 1,
                this.last_sel_begin_loc_info!.x_pos);
            this.cursor = new_loc!.ci_doc;
            this.tbsel.reset();
            this.internal_repaint();
            return;
        }

        var new_loc = this.tb.layout!.finder.find_cursor_location_by_line_num(
            this.last_cursor_loc_info!.location.li_doc - 1, this.m_cursor_last_x_position);


        if (new_loc === null)
            return;
        this.cursor = new_loc.ci_doc;

        if (bSelRange) {
            this.tbsel.setTo(this.cursor);
            // console.log('sel: (%d, %d)', tbsel.m_from, tbsel.m_to);
        }
        this.internal_repaint(false);
    }
    input_down(bSelRange: boolean): void {
        var line_count = this.tb.layout!.get_tbdom().get_total_line_count();
        if (this.last_cursor_loc_info!.location.li_doc === line_count - 1) // 마지막 line에 있으면.
            return;

        if (bSelRange) {
            if (this.tbsel.is_empty())
                this.tbsel.setFrom(this.cursor);
        } else if (this.tbsel.is_empty() == false) {
            var new_loc = this.tb.layout!.finder.find_cursor_location_by_line_num(
                this.last_sel_end_loc_info!.location.li_doc + 1,
                this.last_sel_end_loc_info!.x_pos);
            this.cursor = new_loc!.ci_doc;
            this.tbsel.reset();
            this.internal_repaint();
            return;
        }

        var new_loc = this.tb.layout!.finder.find_cursor_location_by_line_num(this.last_cursor_loc_info!.location.li_doc + 1, this.m_cursor_last_x_position);
        if (new_loc === null)
            return;
        this.cursor = new_loc.ci_doc;

        if (bSelRange) {
            this.tbsel.setTo(this.cursor);
            // console.log('sel: (%d, %d)', tbsel.m_from, tbsel.m_to);
        }
        this.internal_repaint(false);
    }


    input_lbutton_down(e: MouseEvent | Touch): void {
        if (this.tb.text_on_path == null) {
            let bSelRange = (e as MouseEvent).shiftKey;
            let loc_info = this.tb.layout!.finder.find_cursor_location_by_mouse_point(e, {
                find_pos_to_line_end: bSelRange
            });
            if (loc_info === null)
                return;

            if (bSelRange) {
                if (this.tbsel.is_empty())
                    this.tbsel.setFrom(this.cursor);
            } else if (this.tbsel.is_empty() == false) {
                this.cursor = loc_info.ci_doc;
                this.tbsel.reset();
                this.internal_repaint();
                return;
            }

            this.cursor = (this.tb.text_length() == loc_info.ci_doc) ? loc_info.ci_doc - 1 : loc_info.ci_doc;
            if (bSelRange) {
                this.tbsel.setTo(loc_info.ci_doc);
                // console.log('sel: (%d, %d)', tbsel.m_from, tbsel.m_to);
            }
        }
        else {
            this.tb.text_on_path.focus_and_locate_cursor_at_mouse_point(e as MouseEvent);   // 2단계 선언이 MouseEvent만 받는다 (Touch도 들어온다 — 원본 그대로)
        }

        this.internal_repaint();
    }
    input_mousemove(e: MouseEvent | Touch): void {
        var loc_info = this.tb.layout!.finder.find_cursor_location_by_mouse_point(e, {
            find_outof_box: true,
            find_pos_to_line_end: true
        });
        if (loc_info === null)
            return;

        if (this.tbsel.is_empty())
            this.tbsel.setFrom(this.cursor);

        this.cursor = (this.tb.text_length() == loc_info.ci_doc) ? loc_info.ci_doc - 1 : loc_info.ci_doc;
        this.tbsel.setTo(loc_info.ci_doc);

        this.internal_repaint();
    }
    input_lbutton_up(e: MouseEvent | Touch): void {}

    input_dblclick(e: MouseEvent): void {
        this.tbsel.reset();
        var loc_info = this.tb.layout!.finder.find_cursor_location_by_mouse_point(e);
        if (loc_info === null)
            return;

        this.input_dblclick_by_index(loc_info.ci_doc);
    }

    input_dblclick_by_index(ci_doc: number): void {
        this.cursor = (this.tb.text_length() == ci_doc) ? ci_doc - 1 : ci_doc;

        var prev_step = this.tb.opEdit.find_steps_to_prev_word();
        var next_step = this.tb.opEdit.find_steps_to_next_word();
        this.tbsel.setFrom(this.cursor - prev_step);
        this.tbsel.setTo(this.cursor + next_step);
        this.cursor = TB_Utils.inRange(0, this.tb.text_length(), this.cursor + next_step);
        this.internal_repaint();
    }

    set_selection(begin: number, end: number): void {
        // selection을 지정하면 cursor는 selection의 끝을 가리킨다.
        this.tbsel.set(begin, end);
        this.cursor = TB_Utils.inRange(0, this.tb.text_length(), end);

        this.internal_repaint();
    }

    get_selection_visibility(): boolean { return this.show_selection_flag; }
    show_selection(show: boolean): void {
        this.show_selection_flag = show == true ? true : false;

        let css = {
            visibility: this.show_selection_flag ? 'visible' : 'hidden'
        }
        TB_Dom.cssAll(this.tb.element.querySelectorAll('.kayak-line > .kayak-selection-overlay'), css);

        if (this.tb.text_on_path)
            this.tb.text_on_path.update_cursor(); // selection부분도 refresh됨
    }

    is_empty(): boolean {
        return this.tbsel.is_empty();
    }

    /*
        selection range가 비어있을 경우 전체 선택으로 간주할 것인가에 대한 규칙을 적용함.
    */
    sel_by_rule(): SelInfo {
        if (this.tbsel.is_empty() && this.tb.env.empty_range_rule == EmptyRangeRule.SELECT_ALL) {
            return {
                cursor: this.cursor,
                begin: 0,
                end: this.tb.text_length(),
                exists_range: true,
                empty_originally: true
            }
        }
        else {
            return this.sel();
        }
    }

    sel(): SelInfo {
        if (this.tbsel.is_empty()) {
            return {
                cursor: this.cursor,
                begin: this.cursor,
                end: this.cursor,
                exists_range: false
            }
        } else {
            return {
                cursor: this.cursor,
                begin: this.tbsel.m_from,
                end: this.tbsel.m_to,
                exists_range: true
            }
        }
    }
    sel_all(): SelInfo {
        return {
            cursor: this.cursor,
            begin: 0,
            end: this.tb.text_length(),
            exists_range: true
        }
    }
    clear_sel(): void {
        this.tbsel.reset();
        this.internal_repaint();
    }
}




export default TB_Cursor;
