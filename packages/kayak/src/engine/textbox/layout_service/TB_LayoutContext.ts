import type { TextBoxHost, ParTextObject, CiRange } from '../types';

export class TB_LayoutContext {
	private _tb: TextBoxHost;
	text: string;
	ci_doc_par_text: number | null;
	domPar: any;
	pi: any;
	li_old_par: number | null;
	old_li_doc_range: CiRange | null;
	loc_edit_started: any;
	loc_layout_started: any;
	old_domPar: any;

	constructor(tb: TextBoxHost) {
		// private
		this._tb = tb;

		// 공통요소
		this.text = '';
		this.ci_doc_par_text = null; // layout이 갱신되어야 하는 곳의 line이 시작하는 곳의 ci_doc
		this.domPar = null; 
		
		// reuse_lines_if_possible_cb()에서 필요한 항목
		this.pi = null;
		this.li_old_par = null;
		this.old_li_doc_range = null; // layout이 갱신되어야 하는 곳의 line 시작 위치 와 끝 위치 {begin:Number, end:Number}
		this.loc_edit_started = null; // 수정이 발행한 지점의 line이 시작하는 곳의 위치정보(TBLocator)
		this.loc_layout_started = null; // layout이 갱신되어야 하는 첫번째 line이 시작하는 곳의 위치정보(TBLocator)
		this.old_domPar = null;
	}

	setup(par_text_object: ParTextObject, domPar: any): void {
		this.text = par_text_object.par_text;
		this.ci_doc_par_text = par_text_object.ci_doc;
		this.domPar = domPar;
	}

	setup_for_line_reuse(pi: any, tbdom: any, old_li_doc_range: CiRange): void {
		this.pi = pi;
		this.old_li_doc_range = old_li_doc_range;

		this.loc_edit_started = tbdom.get_location(pi.ci_change_start);

        // li_par_layout_start는 변화가 발생한 line의 한 줄 위를 가리킨다. 바로 윗줄은 변화에 영향을 받기 때문임.
        var li_par_layout_started = (this.loc_edit_started.li_par == 0) ? 0 : (this.loc_edit_started.li_par - 1);

        // layout이 되어야 하는 line의 시작/끝 ci를 확보한다.
        this.loc_layout_started = tbdom.get_location_of_line_start(this.loc_edit_started.pi, li_par_layout_started);
        // console.log(this.loc_layout_started);

        if (tbdom.pars.length === 0) {
            this.domPar = tbdom.insertBefore_par(pi.new.begin);
        } else {
            console.assert(this.loc_layout_started.pi < tbdom.pars.length);
            this.old_domPar = tbdom.pars[pi.old.begin].clone();
            this.domPar = tbdom.pars[pi.old.begin];
            this.domPar.remove_lines_to_the_end(this.loc_layout_started.li_par);
            // par에서 변화시작 line부터 끝 line까지 제거함.

            this.old_li_doc_range.begin = this.loc_layout_started.li_doc;
            // old_li_doc_range은 실제 변화가 발생한 최초의 line부터 끝 line까지를 가리킴.
            // this.loc_layout_started.li_doc : 변화가 발생한 첫번째 line.

            tbdom.remove_par(pi.old.begin + 1, pi.old.end); // 수정이 발생한 par의 다음 par의 layout을 제거함.
        }

        this.text = this.get_text_of_par_end(this.loc_layout_started.pi, this.loc_layout_started.ci_lbegin_doc);
        //console.log('text:' + this.text);
        // loc_layout_started.pi : 변화 발생한 line의 par index
        // loc_layout_started.ci_lbegin_doc : 변화 발생한 line의 시작 char index.
        // 위 함수는 변화가 발생한 line의 시작위치부터, par의 마지막 까지의 text를 리턴함.
        // 이 text가 optimal layout의 대상이 되는 것임.
        this.ci_doc_par_text = this.loc_layout_started.ci_lbegin_doc;

        this.li_old_par = this.loc_layout_started.li_par;		
	}

	get_text_of_par_end(pi: number, ci_begin: number): string {
        // get text 
        // from : ci_begin which is the start char index of a line user modification occurred.
        // to : end of par (pi)
        var segVec = this._tb.m_Par._get_vec();
        var textcore = this._tb.text_core;
        var text = '';

        var ci_end = 0;
        for (var i = 0; i <= pi; i++)
            ci_end += segVec[i].m_nCount;

        for (var i = ci_begin; i < ci_end; i++)
            text += (textcore.m_text[i] == 10) ? ' ' : String.fromCharCode(textcore.m_text[i]);
        return text;
	}
}