import TB_Dom from './TB_Dom';
import TextBoxDom from "./TextBoxDom";
import { TB_PosTracker } from './layout_service/TB_PosTracker';
import { TB_ParChangeInfo } from './layout_service/TB_ParChangeInfo'
import { TB_LayoutAux } from './layout_service/TB_LayoutAux'
import { TB_LineComposer } from './TB_LineComposer'
import { TB_LocationFinder } from './TB_LocationFinder'
import { TB_PostLayoutProcess } from './TB_PostLayoutProcess'
import * as log from "loglevel";
import { TB_LayoutContext } from './layout_service/TB_LayoutContext';
import type { TBLocator, DomLine } from './TextBoxDom';
import type { TextBoxHost, CiRange, CursorLocationInfo, LayoutChangeInfo } from './types';
import type { TB_DocFactory } from './TB_DocFactory';
import type { TextChangeInfo } from './TP_TextCore';

/** perform_smart_layout_for_single_par()가 돌려주는, 일반 layout으로 마저 처리해야 할 범위 */
interface SmartLayoutRest { pi_rest: CiRange; line_index_for_insert: number }


/** 
 * Layout textbox document.
 * @constructor
 * @param {Object} textbox_obj textbox object.
 * @param {String} elem_id - id of textbox dom element.
 */
class TB_Layout {
    finder: TB_LocationFinder;
    private tb: TextBoxHost;
    private docFactory: TB_DocFactory;
    private tbdom: TextBoxDom;
    private lineComposer: TB_LineComposer;
    private postLayoutProcess: TB_PostLayoutProcess;
    private aux: TB_LayoutAux;
    private KayakContent: HTMLElement;
    private KayakLineviewContainer: HTMLElement;

    constructor(textbox_obj: TextBoxHost) {
        this.tb = textbox_obj;
        this.docFactory = textbox_obj.docFactory!;
        this.tbdom = new TextBoxDom();
        this.lineComposer = new TB_LineComposer(this.tb, this.tbdom);
        this.postLayoutProcess = new TB_PostLayoutProcess(this.tb);   // 원본은 (tb, tbdom)을 넘겼지만 생성자는 tb만 받는다
        this.finder = new TB_LocationFinder(this.tb, this.tbdom);
        this.aux = new TB_LayoutAux(this.tb, this.tbdom, this.docFactory)

        this.KayakContent = this.tb.element.querySelector('.kayak-content')!;
        this.KayakLineviewContainer = this.KayakContent.querySelector('.kayak-lineview-container')!;
    }

    get_tbdom(): TextBoxDom {
        return this.tbdom;
    }
    //////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////
    // Layout methods
    //////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////

    do_layout_all(): void {
		let pos_tracker = new TB_PosTracker();

        this.tbdom.clear();
        this.aux.remove_lineview_elements(0); // 실제 dom에서 0라인 이후 모든 line을 제거한다.

        var end = this.tb.m_Par._get_vec().length;
        this.perform_layout_for_pars({ begin: 0, end: end }, pos_tracker, 0);
        this.on_complete_layout();
    }
    /*  change_info_par 
    	{
    		edit_cmd : String,
    		history_pointer : Number,
    		par_length : par의 갯수.
    		ci_change_start : Number, // cursor index (변화가 발생한 위치임)
    		before : GT_SegRange,
    		after  : GT_SegRange
    	}
    	change_info_text
    	{
    		edit_cmd : String,
    		text_fluctuation : Number,
    		before : TP_TextRange,
    		after  : TP_TextRange,
    	}
    */

    do_layout(change_info_par: LayoutChangeInfo, change_info_text: TextChangeInfo): void {
        // seglayer는 최신의 상태로 갱신된 상태
        // tbdom은 예전 상태임. 

        // change_info_par.ci_change_start : 변화가 발생한 위치임.
        //console.log('ci_change_start: ', change_info_par.ci_change_start);

		let pos_tracker = new TB_PosTracker();
		let pi = new TB_ParChangeInfo(change_info_par, change_info_text)

        if (change_info_par.edit_cmd === 'set_par')
            this.full_layout(pi, pos_tracker);
        else
            this.smart_layout(pi, pos_tracker);
        // layout_from_changed_par(pi, pos_tracker);

        //console.log('arr: ', this.tbdom.lineview_arr);
        this.on_complete_layout(change_info_par);
    }
    /**
     * 변경이 발생한 par 전체를 layout
     */

    private full_layout(pi: TB_ParChangeInfo, pos_tracker: TB_PosTracker): void {
        var old_li_doc_range = this.tbdom.get_line_range_by_par_index(pi.old.begin, pi.old.end);
        this.aux.remove_lineview_elements(old_li_doc_range.begin, old_li_doc_range.end);
        this.tbdom.remove_par(pi.old.begin, pi.old.end);

        var pi_rest = { begin: pi.new.begin, end: pi.new.end };
        // old_li_doc_range.begin --> layout한 line을 insert할 시작 위치
        this.perform_layout_for_pars(pi_rest, pos_tracker, old_li_doc_range.begin);
    }
    /**
     * box내에서 최적화된 layout을 수행.
     */

    private smart_layout(pi: TB_ParChangeInfo, pos_tracker: TB_PosTracker): void {
		// smart layout이 가능한 부분을 수행하고, 나머지 일반 layout해야 하는 부분의 정보를 리턴함.
		let result = this.perform_smart_layout_for_single_par(pi, pos_tracker);
		if (result)
			this.perform_layout_for_pars(result.pi_rest, pos_tracker, result.line_index_for_insert);
    }

    private perform_layout_for_pars(pi_rest: CiRange, pos_tracker: TB_PosTracker, insert_position: number): void {
        var par_text_arr = this.aux.get_pars_text_arr(pi_rest.begin, pi_rest.end);

        var temp_tb_elem = TB_Dom.createElement("<div class='kayak-line_container'></div>") as HTMLElement;

        for (var i = pi_rest.begin; i < pi_rest.end; i++) {
            var domPar = this.tbdom.insertBefore_par(i);

            pos_tracker.reset_pos_tracker(i);
            var j = i - (pi_rest.begin);

			let cx = new TB_LayoutContext(this.tb);
			cx.setup(par_text_arr[j], domPar);

            this.lineComposer.do_par_to_lines(cx, pos_tracker, temp_tb_elem);
        }

        // (temp_tb_elem)에 만들어진 lines를 dom에 추가한다.
        this.aux.insert_new_lines(temp_tb_elem, insert_position, this.KayakLineviewContainer);
    }
	// smart layout이 가능한 부분을 수행하고, 나머지 일반 layout해야 하는 부분의 정보를 리턴함.

    private perform_smart_layout_for_single_par(pi: TB_ParChangeInfo, pos_tracker: TB_PosTracker): SmartLayoutRest | null {
		let old_li_doc_range = this.tbdom.get_line_range_by_par_index(pi.old.begin, pi.old.end);
		if (pi.old.begin === pi.old.end || pi.new.begin === pi.new.end)
			return this.layout_for_simple_case(pi, old_li_doc_range);

		let cx = new TB_LayoutContext(this.tb);
		cx.setup_for_line_reuse(pi, this.tbdom, old_li_doc_range);

        var temp_tb_elem = TB_Dom.createElement("<div class='kayak-line_container'></div>") as HTMLElement;

		pos_tracker.reset_pos_tracker(pi.new.begin);
        pos_tracker.li_par = cx.loc_layout_started.li_par; //d
        pos_tracker.ci_lbegin_par = cx.loc_layout_started.ci_lbegin_doc - cx.loc_layout_started.ci_pbegin_doc; //d

        // par를 line단위로 레이아웃 한다. 
        // reuse_lines_if_possible_cb는 계산되는 line마다 호출 된다.
        // 만약 재사용가능한 line이 발견되면, 이후 line은 기존 line을 복사(=재사용)하고 do_par_to_lines()는 종료된다.
        this.lineComposer.do_par_to_lines(cx, pos_tracker, temp_tb_elem, this.aux.reuse_lines_if_possible_cb);


        // 새로운 layout으로 교체되어야 하는 범위의 line만큼만 삭제한다.
        this.aux.remove_lineview_elements(cx.old_li_doc_range!.begin, cx.old_li_doc_range!.end);
        // (temp_tb_elem)에 만들어진 lines를 dom에 추가한다.
        this.aux.insert_new_lines(temp_tb_elem, cx.old_li_doc_range!.begin, this.KayakLineviewContainer);

        var added_lines = cx.domPar.lines.length - cx.loc_layout_started.li_par;

        var pi_rest: CiRange = { begin: pi.new.begin + 1, end: pi.new.end };
		return {
			pi_rest: pi_rest,
			line_index_for_insert: cx.old_li_doc_range!.begin + added_lines
		}
    }

    private layout_for_simple_case(pi: TB_ParChangeInfo, old_li_doc_range: CiRange): SmartLayoutRest | null {
		let result: SmartLayoutRest | null = null;

        // 빈 줄 생성시의 경우 (enter를 두번 철때 )
        if (pi.old.begin === pi.old.end) {
            // insert만 발생한 경우임.
            var pi_rest = { begin: pi.new.begin, end: pi.new.end };
			result = {
				pi_rest: pi_rest,
				line_index_for_insert: old_li_doc_range.begin
			}
        } else if (pi.new.begin === pi.new.end) {
            // delete만 발생한 경우.
            this.tbdom.remove_par(pi.old.begin, pi.old.end);
            this.aux.remove_lineview_elements(old_li_doc_range.begin, old_li_doc_range.end);
		}
		
        return result;
    }
	// layout이후 first line baseline offset(flbo)을 갱신한다.
    // change_info_par.after.m_nFirstSegIndex가 0이면 첫줄의 height를 조절해야하는 경우임. (즉, 첫줄에 변화가 있다는 것)

    private on_complete_layout(change_info_par?: LayoutChangeInfo): void {
        // console.log('--> this.on_complete_layout() called');
		this.post_layout_process_1(change_info_par)
		this.postLayoutProcess.adjust_gradient();
    }

    private post_layout_process_1(change_info_par?: LayoutChangeInfo): void {
        if (change_info_par && change_info_par.after!.m_nFirstSegIndex == 0) {
            let old_first_line: DomLine | null = null;
            /*
                문서 제일 처음 위치에서 enter키를 입력 하여 첫 줄이 그대로 2번째 줄이 되는 경우에는
                두 번째 줄을 본래 height만큼 값을 설정해 주어야 한다.
                문서 첫 줄에서 enter를 입력한 경우의 값 상태는 아래와 같다.
                    change_info_par.before.m_nFirstSegIndex     : 0
                    change_info_par.before.m_nLastSegIndex      : 0
                    change_info_par.after.m_nFirstSegIndex     : 0
                    change_info_par.after.m_nLastSegIndex      : 1

                편의상 change_info_par.after.m_nLastSegIndex가 1인 경우만 따진다.
                (두번째 라인 첫 머리에서 backspace 입력시에도 1이 올 수 있다)
            */
            if (change_info_par.after!.m_nLastSegIndex == 1 && this.tbdom.pars.length > 1)
                old_first_line = this.tbdom.pars[1].lines[0]

            this.tb.tbpreference.update_first_line_height_by_baseline_offset_mode(this.tbdom.pars[0].lines[0], old_first_line);
        }
        else if (change_info_par == undefined)
			this.tb.tbpreference.update_first_line_height_by_baseline_offset_mode(this.tbdom.pars[0].lines[0]);
    }
	///////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////

    get_cursor_pos_info(cursor: number): TBLocator {
        var cursor_loc = this.tbdom.get_location(cursor);

		if (this.tb.tbconfig.debug.show_line_gutter) {
			var gutter_wrappers = this.KayakContent.querySelectorAll<HTMLElement>(this.docFactory.gutter_wrapper_selector);
			// cursor가 위치한 line을 red로 표시
			TB_Dom.cssAll(gutter_wrappers, {
				"background-color": "transparent",
				"color": "black"
			});
			TB_Dom.css(gutter_wrappers[cursor_loc.li_doc], {
				"background-color": "red",
				"color": "white"
			});
		}

        return cursor_loc;
    }

    get_line(loc: { last_cursor_loc_info: CursorLocationInfo | null }): DomLine {
        var lll = loc.last_cursor_loc_info!.location;
        return this.tbdom.pars[lll.pi].lines[lll.li_par];
    }
}

export default TB_Layout;