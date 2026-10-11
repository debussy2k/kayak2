import type { TextBoxHost, ParTextObject } from '../types';

export class TB_LayoutAux {
	tb: TextBoxHost;
	tbdom: any;
	docFactory: any;

	constructor(tb: TextBoxHost, tbdom: any, docFactory: any) {
		this.tb = tb;
		this.tbdom = tbdom;
		this.docFactory = docFactory
	}

	insert_new_lines(temp_tb_elem: Element, line_index_for_insert: number, KayakLineviewContainer: Element): void {
        // insert(append) new lines
        // temp_tb_elem에서 옮기므로(detach --> attach) 먼저 배열로 복사해 둔다.
        var line_views: Element[] = Array.prototype.slice.call(temp_tb_elem.querySelectorAll(this.docFactory.line_view_selector));

        if (this.tbdom.lineview_arr.length == 0 || this.tbdom.lineview_arr.length <= line_index_for_insert) {
            // child element로 append함.
            for (var i = 0; i < line_views.length; i++) {
                KayakLineviewContainer.appendChild(line_views[i]);
                this.tbdom.lineview_arr.push(line_views[i]);
            }
        } else {
            // sibling으로 추가함.
            var target_elem = this.tbdom.lineview_arr[line_index_for_insert];
            for (var i = 0; i < line_views.length; i++) {
                target_elem.parentNode.insertBefore(line_views[i], target_elem);
                this.tbdom.lineview_arr.splice(line_index_for_insert + i, 0, line_views[i]);
            }
        }
	}
	remove_lineview_elements(begin: number, end?: number): void {
        // 참고: JQuery 방식의 경우.
        // 속도향상을 위해 tbdom.lineview_arr을 도입하면서, 아래 code는 제거함.
        // $KayakContent.find(docFactory.line_view_selector).slice(begin, end).remove();

        var rm_count = (end == undefined) ? (this.tbdom.lineview_arr.length - begin) : (end - begin);
        var rm_arr = this.tbdom.lineview_arr.splice(begin, rm_count);
        for (var i = 0; i < rm_arr.length; i++) {
        //rm_arr[i].remove(); // rm_arr[i]는 pure javascript element임.
			rm_arr[i].parentNode.removeChild(rm_arr[i]);
		}
	}
	
	get_pars_text_arr(par_begin: number, par_end: number): ParTextObject[] {
        // 이 함수는 html로 만들어질 문자열을 리턴하는데 
        // '\n'의 경우 공백으로 문자열을 치환한다.
        // '\n'만 있는 paragraph의 경우, height가 실질적으로 0이되는 문제가 있으므로 sapce공백을 리턴한다.
        // 예를 들면, 
        // <div><span>\n</span</div> :  div element의 height는 0임.
        // <div><span>&nbsp;</span</div> : div element는 유효한 height를 가짐.

        var par_text_arr: ParTextObject[] = [];
        var par_text = '';
        var textcore = this.tb.text_core;
        var segVec = this.tb.m_Par._get_vec();

        var char_pos = 0;
        var char_end = 0;
        for (var i = 0; i < par_begin; i++)
            char_pos += segVec[i].m_nCount;
        for (var i = par_begin; i < par_end; i++) {
            char_end = char_pos + segVec[i].m_nCount;
            par_text = '';
            for (var j = char_pos; j < char_end; j++)
                par_text += (textcore.m_text[j] == 10) ? ' ' : String.fromCharCode(textcore.m_text[j]);
            par_text_arr.push({
                par_text: par_text,
                ci_doc: char_pos
            });
            char_pos = char_end;
        }

        return par_text_arr;
	}
	
	
    // layout을 하는 중, 재사용이 가능한 line이 발견되면 true를 리턴함.
    reuse_lines_if_possible_cb(cx: any, pos_tracker: any): boolean | undefined {
        var pi = cx.pi;

        var ci_lbegin_new_par = pos_tracker.ci_lbegin_par;
        var ci_lbegin_new_par_shifted = ci_lbegin_new_par - pi.text_fluctuation;

        if (cx.old_domPar && (pos_tracker.li_par > cx.loc_edit_started.li_par)) {
            // for speed optimization
            var old_domPar_lines_length = cx.old_domPar.lines.length;
            var old_lines = cx.old_domPar.lines;

            // for old lines
            var ci_org_par: number | null = null;
            for (; cx.li_old_par < old_domPar_lines_length; cx.li_old_par++) {
                ci_org_par = old_lines[cx.li_old_par].index_offset;
                if (ci_org_par! >= ci_lbegin_new_par_shifted)
                    break;
            }

            if (ci_org_par === ci_lbegin_new_par_shifted) { // 반복되는 line을 처음 만난 순간임.
                // 아래 조건의 의미
                // "set" operation (set bold같은)에서는 text 수량에는 변동이 없기 때문에 
                // 변화가 적용된 selection의 마지막 이후 부터 optimal layout이 
                // 적용되어야 한다. 
                // pi.ci_change_end의 존재는 selection이 존재한다는 것임.
                if (pi.ci_change_end == undefined || ci_org_par > pi.ci_change_end) {
                    // old par의 나머지 line을 모두 push하고, 종료함.
                    // 모든 상황 종료. 
                    //console.log(">>>>>>>>>>>>>>>>> SAME found!!");

                    // cx.old_domPar.lines의 나머지 line들을 모두 new dom par로 재사용. 
                    cx.li_old_par += 1;

                    cx.old_li_doc_range.end = cx.old_li_doc_range.begin + (cx.li_old_par - cx.loc_layout_started.li_par);

                    for (; cx.li_old_par < old_domPar_lines_length; cx.li_old_par++) {
                        old_lines[cx.li_old_par].index_offset += pi.text_fluctuation;
                        cx.domPar.lines.push(old_lines[cx.li_old_par]);
                    }
                    return true; // STOP LAYOUT
                }
            } else { // 즉, (ci_org_par >= ci_lbegin_new_par_shifted)인 경우임.
                // par의 마지막 line까지 검사하여도 동일한 line이 발견되지 못한 경우.
                // 새로 layout한 line을 push함.
                // console.log("push line");
            }
        } else {
            // 무조건 새로 layout한 line을 push함.
            // console.log("push line (before edit occurred line)");
        }

		// optimal layout을 위한 trace.
		// let str = '';
        // str += "[" + pos_tracker.par_index + ":" + pos_tracker.li_par + "]";
        // str += ' - ';
        //this.log_for_optimal_layout(str, pos_tracker, cx.loc_edit_started, ci_org_par, ci_lbegin_new_par, ci_lbegin_new_par_shifted);
    }

    log_for_optimal_layout(str: string, pos_tracker: any, loc_edit_started: any, ci_org_par: number | null, ci_lbegin_new_par: number, ci_lbegin_new_par_shifted: number): void {
        if (ci_org_par)
            str += "[ci_org_par:" + ci_org_par;
        else
            str += "[ci_org_par:n/a";

        str += " -- ci_lbegin_new_par:" + ci_lbegin_new_par;

        if (pos_tracker.li_par == loc_edit_started.li_par)
            str += "(edit occurred)";
        else if (pos_tracker.li_par > loc_edit_started.li_par)
            str += "(" + ci_lbegin_new_par_shifted + ")";

        if (ci_org_par == ci_lbegin_new_par_shifted)
            str = "[SAME] " + str;
        else
            str = "[none] " + str;

        str += ", cc_line:" + pos_tracker.line_char_count + "]";
        // console.log('first par: ', str);
    }
}