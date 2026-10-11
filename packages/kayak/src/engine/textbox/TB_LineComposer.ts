import { TB_WordFetch, TB_WordFetchParams } from './TB_WordFetch'
import { TB_LineMetric } from './TB_LineMetric'
import { TB_LineRenderOptions } from './TB_LineRenderOptions'
import { TB_JustificationService } from './services/TB_JustificationService'
import type { TB_WordInfo } from './TB_WordInfo';
import type { TB_PosTracker } from './layout_service/TB_PosTracker';
import type { TextBoxHost, JstfBalanceInfo, TextLineRange } from './types';

/** do_par_to_lines()의 callback. true를 돌려주면 layout을 멈춘다. */
type LineCallback = (cx: any, pos_tracker: TB_PosTracker) => boolean | void;

class TB_LineComposer {
    tb: TextBoxHost;
    docFactory: any;   // TB_DocFactory (Task 4) — 순환 import를 피하려고 any
    tbdom: any;

    constructor(textbox_obj: TextBoxHost, tbdom: any) {
        this.tb = textbox_obj;
        this.docFactory = textbox_obj.docFactory;        
        this.tbdom = tbdom;
    }

    /**
     * paragraph를 line단위로 layout 함.
     * @param  {String}   cx.text        		layout 대상 text.
     * @param  {Number}   cx.ci_doc_par_text 	par가 시작하는 ci_doc 위치.
     * @param  {DomPar}   cx.domPar         	layout된 line 정보를 저장할 DomPar 객체.
     * @param  {Object}   pos_tracker     위치정보를 담고 있는 것.
     * @param  {Element}  textbox_elem    layout된 dom객체를 임시저장할 element. class : ".kayak-line_container"
     * @param  {Function} callback        function (pos_tracker)
     * @return 없음.
     */
    do_par_to_lines(cx: any, pos_tracker: TB_PosTracker, textbox_elem: Element, callback?: LineCallback): void {
		let par_attr = this.tb.m_Par.getAttr_by_pi(pos_tracker.par_index);
		let is_last_par = this.tb.m_Par.is_last_index(pos_tracker.par_index)
		
		// params
        let params = new TB_WordFetchParams(this.tb, cx.text, cx.ci_doc_par_text, par_attr);

		// curr_metric
        let curr_metric = new TB_LineMetric(cx.domPar);
        curr_metric.lineWidth     = this.get_lineWidth(pos_tracker, this.tb.tbconfig.content.width, par_attr);
        curr_metric.ci_lbegin_doc = cx.ci_doc_par_text;

		let lines = TB_WordFetch.get_words_contained_in_par_by_textlines(params, curr_metric.lineWidth);
		for(let i=0; i<lines.length; i++) {
            curr_metric.set_zero();
            curr_metric.is_first_line_on_doc = (i == 0 && pos_tracker.par_index == 0)
            curr_metric.is_last_line_on_doc = (i == (lines.length-1) && is_last_par)
			curr_metric.is_last_line = (i == lines.length-1);
			lines[i].forEach(wi => {
                let word = TB_WordFetch.build_word(wi);
	            curr_metric.measure_by_adding_word(word);
				pos_tracker.line_char_count += word.text.length;
			})

            let jstf_balance_info = this.get_jstf_balance_info(par_attr, curr_metric.is_last_line, lines[i]);
            this.append_as_kayak_lineview(pos_tracker, textbox_elem, curr_metric, jstf_balance_info);

            if (this.prepare_for_next_line(par_attr, cx, pos_tracker, curr_metric, callback) == true) // true : satisfy stop condition.
				return;    
		}

        callback && callback(cx, pos_tracker);
    }


    // private ----------------------------------

	get_jstf_balance_info(par_attr: any, is_last_line: boolean, wi_arr: TB_WordInfo[]): JstfBalanceInfo | null {
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


    prepare_for_next_line(par_attr: any, cx: any, pos_tracker: TB_PosTracker, curr_metric: TB_LineMetric, callback?: LineCallback): boolean {
        if (callback) {
            var stop_condition = callback(cx, pos_tracker);
            if (stop_condition == true)
                return true;
        }

        pos_tracker.li_par += 1;
        pos_tracker.ci_lbegin_par += pos_tracker.line_char_count;
        curr_metric.ci_lbegin_doc += pos_tracker.line_char_count;
        pos_tracker.line_char_count = 0;

        curr_metric.lineWidth = this.get_lineWidth(pos_tracker, this.tb.tbconfig.content.width, par_attr)
        return false;
    }

    get_lineWidth(pos_tracker: TB_PosTracker, content_width: number, par_attr: any): number {
        let foo = par_attr.m_Lindent + par_attr.m_Rindent;
        foo += (pos_tracker.li_par == 0) ? par_attr.m_Findent : 0;

        return content_width - foo;
    }

    append_as_kayak_lineview(pos_tracker: TB_PosTracker, textbox_elem: Element, curr_metric: TB_LineMetric, jstf_balance_info: JstfBalanceInfo | null): void {
        /*
            pos_tracker.par_index   	: 현재 par index
            curr_metric.content_width        : 실제 문자가 차지하는 폭
            curr_metric.lineWidth	    	: line의 전체 폭			
        */

        let domLine = curr_metric.domPar.push_empty_DomLine_object(pos_tracker.ci_lbegin_par, pos_tracker.line_char_count);
        domLine.jstf_balance_info = jstf_balance_info;

        let rng: TextLineRange = {
            begin: curr_metric.ci_lbegin_doc,
            end: curr_metric.ci_lbegin_doc + pos_tracker.line_char_count,
        }
        let line_render_options = new TB_LineRenderOptions()
        line_render_options.is_first_line_on_doc = curr_metric.is_first_line_on_doc;
        line_render_options.is_last_line_on_doc = curr_metric.is_last_line_on_doc;

        this.docFactory.populate_data_on_domLine(pos_tracker, curr_metric, domLine);

        var line_view_obj = this.docFactory.create_line_view_obj();
        this.docFactory.build_lineview(line_view_obj, domLine, rng, line_render_options);
        this.docFactory.on_line_completed(line_view_obj, pos_tracker);
        
        textbox_elem.appendChild(line_view_obj.line_view);
    }
}

export { 
    TB_LineComposer
};
