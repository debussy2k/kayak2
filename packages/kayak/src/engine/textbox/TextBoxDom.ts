import _g from './TB_PlatformEnv';
import shortid from 'shortid';
import type { SvgPathEntry, SvgGlyphItem, JstfBalanceInfo, CiRange } from './types';

/**
 * @fileOverview TextBox의 Logical object model. 
 * @author  Harry
 */


/** 문서 안의 한 글자 위치를 문단/글줄 색인으로 푼 것 */
class TBLocator {
    ci_doc: number;        // char index on a doc
    li_doc!: number;        // line index on a doc
    pi!: number;            // par index on a doc
    li_par!: number;        // line index on a par
    ci_pbegin_doc!: number; // char index of par begin, on a doc
    ci_line!: number;       // char index on a line
    cc_line!: number;       // char count on a line
    ci_lbegin_doc!: number; // char index of line begin, on a doc
    ci_lend_doc!: number;   // char index of line end, on a doc
    reset: () => void;

    constructor(pos?: number) {
        // 원본처럼 자기 속성. 생성자 인자 pos를 잡고 있어 traverse_dom()의 reset()이 ci_doc을 pos로 되돌린다.
        this.reset = () => {
            this.ci_doc = pos || 0; // char index on a doc
            this.li_doc = 0; // line index on a doc
            this.pi = 0; // par index on a doc
            this.li_par = 0; // line index on a par
            this.ci_pbegin_doc = 0; // char index of par begin, on a doc
            this.ci_line = 0; // char index on a line
            this.cc_line = 0; // char count on a line
            this.ci_lbegin_doc = 0; // char index of line begin, on a doc
            this.ci_lend_doc = 0; // char index of line end, on a doc
        }

        this.reset();
        this.ci_doc = pos || 0; // char index on a doc
    }
}

/** get_line_by_line_counter() 결과 */
export interface LineLocator { ci_lbegin_doc: number; ci_lend_doc: number; line: DomLine | null }
/** get_domLine_by_line_number() 결과 */
export interface DomLineLocator { pi_doc: number; li_par: number; is_last_line_on_par: boolean; domLine: DomLine | null }

class TextBoxDom {
    pars: DomPar[];
    // ".kayak-lineview" element만 array로 관리함. 
    // 실제 element는 dom상에 어디에 있든지 상관 없으며, 
    // 단지 dom상에서 나타나는 순서와 array에 저장되어 있는 순서는 일치해야 한다.
    lineview_arr: HTMLElement[];

    constructor() {
        this.pars = [];
        this.lineview_arr = [];
    }

    clear(): void {
        this.pars.length = 0;
    }

    get_total_line_count(): number {
        return this.lineview_arr.length;
    }

    getDomLines(_callback?: unknown): DomLine[] {
        let lines: DomLine[] = [];

        this.pars.find(par => {            
            for (var i = 0; i < par.lines.length; i++) {
                lines.push(par.lines[i])
            }
        });

        return lines;
    }

    append_par(): DomPar {
        var new_par = new DomPar;
        this.pars.push(new_par);
        return new_par;
    }

    insertBefore_par(index: number): DomPar {
        var new_par = new DomPar;
        this.pars.splice(index, 0, new_par);
        return new_par;
    }

    remove_par(begin: number, end?: number): void {
        if (begin >= end!)
            return;
        if (end == undefined)
            this.pars.splice(begin, this.pars.length - begin); // 끝까지 지움.
        else
            this.pars.splice(begin, end - begin);
    }

    remove_lines_to_the_end(pi: number, start_line: number): void {
        if (pi >= this.pars.length)
            return;
        this.pars[pi].remove_lines_to_the_end(start_line);
    }

    get_line_range_by_par_index(begin: number, end: number): CiRange {
        var line_num = 0;

        var line_range: CiRange = {
            begin: 0,
            end: 0,
        }
        if (this.pars.length == 0)
            return line_range;

        if (begin == end) {
            for (var i = 0; i < begin; i++)
                line_num += this.pars[i].lines.length;
            line_range.begin = line_range.end = line_num;
            return line_range;
        }

        var i = 0;
        do {
            if (i === begin)
                line_range.begin = line_num;


            if (this.pars[i] === undefined)
                console.log('bad!!');
            line_num += this.pars[i].lines.length;

            if (i == end - 1)
                line_range.end = line_num;
            i++;
        } while (i < end)

        return line_range;
    }

    get_location(pos: number): TBLocator {
        var loc = new TBLocator(pos);

        this.traverse_dom(pos, loc);
        var line_begin = this.get_char_pos_by_line_counter(loc.li_doc);
        loc.ci_lbegin_doc = line_begin;
        loc.ci_lend_doc = line_begin + loc.cc_line;
        return loc;
    }

    traverse_dom(cursor: number, loc: TBLocator): void {
        loc.reset();
        loc.ci_line = cursor; // setup for calculation purpose.

        var char_pos = 0;
        this.pars.find(par => {
            for (var i = 0; i < par.lines.length; i++) {
                if (char_pos <= cursor && cursor < (char_pos + par.lines[i].char_count)) {
                    loc.li_par = i;
                    loc.cc_line = par.lines[i].char_count; //d
                    return true;
                }
                loc.li_doc += 1;
                char_pos += par.lines[i].char_count;
                loc.ci_line -= par.lines[i].char_count;
            }
            loc.ci_pbegin_doc = char_pos;
            ++loc.pi;
        });
    }

    get_location_of_line_start(pi_doc: number, li_par: number): TBLocator {
        var loc = new TBLocator(0);

        if (this.pars.length == 0)
            return loc;


        loc.pi = pi_doc;
        loc.li_par = li_par;
        for (var i = 0; i < pi_doc; i++) {
            loc.ci_doc += this.pars[i].get_char_count();
            loc.li_doc += this.pars[i].lines.length;
            loc.ci_pbegin_doc = loc.ci_doc;
            loc.ci_lbegin_doc = loc.ci_doc;
        }

        console.assert(pi_doc < this.pars.length);
        var par = this.pars[pi_doc];
        console.assert(li_par < par.lines.length);

        for (var i = 0; i < li_par; i++) {
            loc.ci_doc += par.lines[i].char_count;
            loc.ci_line += par.lines[i].char_count;
            loc.ci_lbegin_doc += par.lines[i].char_count;
        }
        loc.cc_line = par.lines[li_par].char_count;
        loc.li_doc += li_par;
        loc.ci_lend_doc = loc.ci_lbegin_doc + par.lines[li_par].char_count;

        return loc;
    }

    get_char_pos_by_line_counter(line_counter: number, offset?: number): number {
        // line_counter가 지정한 line의 offset 까지의 char pos 구하기.
        // line_counter : line number.
        // offset : 그 줄에서의 char offset
        var char_pos = 0;
        var line_num = 0;
        this.pars.find(par => {            
            for (var i = 0; i < par.lines.length; i++) {
                if (line_num === line_counter) {
                    char_pos += (offset != undefined) ? offset : 0;
                    return true;
                }
                line_num += 1;
                char_pos += par.lines[i].char_count;
            }
        });

        return char_pos;
    }

    get_line_by_line_counter(line_counter: number): LineLocator {
        // line_counter가 지정한 line의 offset 까지의 char pos 구하기.
        // line_counter : line number.
        var line_num = 0;

        var loc: LineLocator = {
            ci_lbegin_doc: 0,
            ci_lend_doc: 0,
            line: null
        }
        this.pars.find(par => {
            for (var i = 0; i < par.lines.length; i++) {
                if (line_num === line_counter) {
                    loc.ci_lend_doc = loc.ci_lbegin_doc + par.lines[i].char_count;
                    loc.line = par.lines[i]
                    return true;
                }
                line_num += 1;
                loc.ci_lbegin_doc += par.lines[i].char_count;
            }
        });

        return loc;
    }

    get_ci_range_of_par(pi: number): CiRange | null {
        // returns begin and end char index of pi.
        if (pi >= this.pars.length)
            return null;

        var b = 0,
            e = 0;
        for (var i = 0; i < pi; i++)
            b += this.pars[i].get_char_count();
        e = b + this.pars[i].get_char_count();
        return { begin: b, end: e };
    }
    // line_counter로 (pi_doc, li_par, DomLine)을 얻음.

    get_domLine_by_line_number(line_number: number): DomLineLocator {
        var ret: DomLineLocator = {
            pi_doc: 0,
            li_par: 0,
            is_last_line_on_par: false,
            domLine : null  // DomLine Object
        }

        var stop = false;
        var line_num = 0;

        for(var pi=0; pi<this.pars.length; pi++) {
            var par = this.pars[pi];
            for (var i = 0; i < par.lines.length; i++, line_num++) {
                if (line_num === line_number) {
                    ret.pi_doc = pi;                    
                    ret.li_par = i;
                    ret.is_last_line_on_par = i == (par.lines.length-1);
                    ret.domLine = par.lines[i];
                    stop = true; 
                    break;
                }
            }

            if (stop)
                break;
        }

        if (stop == false)
            throw "get_pi_li_by_line_number() failed."
        return ret;
    }

    get_y_pos_by_line_number(line_counter: number): { y_pos: number } {
        // line_counter의 line이 시작하는 곳의 y-position 구함.
        var line_num = 0;

        var ret = {
            y_pos: 0
        }

        var line_values: DomLine;
        this.pars.find(par => {
            for (var i = 0; i < par.lines.length; i++) {
                line_values = par.lines[i];

                ret.y_pos += line_values.space_before;
                if (line_num === line_counter) {
                    return true;
                }
                ret.y_pos +=
                    line_values.line_height +
                    line_values.space_after;

                line_num += 1;
            }
        });

        return ret;
    }
    /*  extended_search : true이면 box 위쪽이면 0을, box영역보다 아래이면 마지막 line number를 리턴함.
     */

    get_line_number_by_y(y: number, extended_search?: boolean): number | undefined {
        // line_counter의 line이 시작하는 곳의 y-position 구함.
        var line_num = 0;
        var y_pos = 0;

        if (y < 0 && extended_search != true)
            return -1;
        
        if (extended_search && y < 0)
            return 0;

        let top = 0;
        let bottom = 0;
        let flag_found = false;
        let index_found = 0;

        // 고정행간에 의해 line이 겹치는 경우 아랫쪽 line이 찾아지도록 함.
        // 고정행간 line에서 고정행간보다 큰 문자가 포함되면 겹치는 상황 발생함.
        // 이것 때문에 알고리즘이 좀 복잡해 짐.
        var line_values: DomLine;
        var found = this.pars.find(par => {
            for (var i = 0; i < par.lines.length; i++) {
                line_values = par.lines[i];
                let advance = line_values.space_before + line_values.line_height + line_values.space_after;

                top = y_pos;

                y_pos += advance
                bottom = y_pos;

                let in_bound = (top <= y && y < bottom);
                if (flag_found) {
                    if (in_bound == false) // 1차로 line을 찾았고, 현재 검사에서 찾지 못하면 1차에서 찾은 line_num이 확정됨.
                        return true;
                    index_found = line_num;
                }

                // y가 속한 line을 찾았지만, 다음 line에 y가 포함되는지 검사하기위해 flag_found 값 운용함.
                if (flag_found == false && in_bound) {
                    flag_found = true;
                    index_found = line_num;
                }

                line_num += 1;
            }
        });

        if (flag_found) {
            return index_found;
        }
        else if (found == undefined) { // 찾은 것이 없으면 가장 마지막 line_num을 가지도록 함.
            if (extended_search == true)
                index_found = line_num - 1;
            else
                index_found = -1;
            
            return index_found;
        }
    }

    get_last_domline(): DomLine {
        let last_par  = this.pars[this.pars.length-1];
        return last_par.lines[last_par.lines.length-1];
    }

    get_full_height(): number {
        // 속도 개선필요. underscore --> lodash / 또는 pure javascript

        if (this.pars.length == 0)
            return 0;

        var height = 0;
        this.pars.forEach(par => {
            par.lines.forEach(line => {
                height += line.space_before
                       +  line.line_height
                       +  line.space_after;
            })
        })


        // 1. 첫 줄의 space_before를 차감함
        height -= this.pars[0].lines[0].space_before;

        // 2. 마지막 줄의 (line_space + space_after)를 차감함
        let last_domline = this.get_last_domline();
        height -= (last_domline.line_height + last_domline.space_after);
        height += last_domline.line_height_base;


        // let last_line_space = (last_domline.line_height - last_domline.line_body_height) // line-space 설정으로 늘어난 만큼의 공간
        // height -= (last_line_space + last_domline.space_after);

        return height;
    }
	/*
		글줄이 실제 가지는 높이를 계산함
		----------------------------------
		first-line space_before
		----------------------------------
		visible height (  max_word_ascent + max_word_descent
		----------------------------------
		last-line space_after
		----------------------------------
	*/

    get_first_line_bbox_info(): { max_font_size_px: number; effective_height: number } {
		let first_line = this.pars[0].lines[0];
		let effective_height = first_line.max_word_ascent + first_line.max_word_descent;

		return {
			max_font_size_px: first_line.line_height_base,
			effective_height: effective_height
		};
    }
}


// 빈번하게 생성되는 object의 function은 prototype에 정의한다.
/**
 * @constructor
 * @property {Array} this.lines - DomLine Object의 배열.
 */
class DomPar {
    lines: DomLine[];

    constructor() {
        this.lines = [];
    }

    push_empty_DomLine_object(ci_lbegin_par: number, line_char_count: number): DomLine {
        const new_line = new DomLine(ci_lbegin_par, line_char_count);
        this.lines.push(new_line);
        return new_line;
    }

    clone(): DomPar {
        const obj = new DomPar;
        for (let i = 0; i < this.lines.length; i++)
            obj.lines.push(this.lines[i].clone());
        return obj;
    }

    get_char_count(): number {
        let cc = 0;
        for (let i = 0; i < this.lines.length; i++)
            cc += this.lines[i].char_count;
        return cc;
    }

    remove_lines_to_the_end(start_line: number): void {
        this.lines.splice(start_line, Number.MAX_VALUE);
    }
}

/**
 * @constructor
 * @property {Number} this.index_offset - par의 첫번째 문자로 부터의 시작 offset.
 * @property {Number} this.char_count - char 갯수
 * @property {Number} this.max_word_height - line의 내용부분의 max height (padding을 제외한 height).
 * @property {Number} this.content_width - 실제 text가 차지한 폭.
 * @property {Number} this.offset_left - indentation 적용값 (F-indent와 L-indent 모두 고려된 것)
 * 
 * 중요 : Textbox.js의 snapshotAsSVG()참고 할 것.
 */
class DomLine {
    uuid: string;
    index_offset: number;
    char_count: number;
    max_word_height: number;
    max_word_ascent: number;
    max_word_ascent_d: number;
    max_word_descent: number;
    max_font_size_px: number;
    leading: 'auto' | number;
    line_height: number;
    line_height_base: number;
    line_body_height: number;
    line_holder_height: number;
    dom_line_height: number;
    line_width: number;
    alignment_option: string;
    content_width: number;
    core_width!: number;     // 원본의 `this.core_width;`는 아무것도 하지 않는다 — 선언만 하고 속성은 만들지 않는다 (textbox_dom.test.js가 고정)
    trailing_ws_px: number;
    trailing_ws_count: number;
    last_glyph_white_space: number;
    offset_left: number;
    space_before: number;
    space_after: number;
    jstf_balance_info: JstfBalanceInfo | null;
    svg_paths: SvgPathEntry[];
    svg_glyph_arr: SvgGlyphItem[] | null;

    constructor(_index_offset?: number, _char_count?: number, _max_word_height?: number, _max_word_ascent?: number, _max_word_descent?: number) {
		this.uuid = shortid.generate();
        this.index_offset = _index_offset!;
        this.char_count = _char_count!;
        this.max_word_height = _max_word_height || 0;   // TB_SvgTextRender.getGlyphsDimension().height 값이 대입됨.
        this.max_word_ascent = _max_word_ascent || 0;
        this.max_word_ascent_d = 0;
        this.max_word_descent = _max_word_descent || 0;
        this.max_font_size_px = 0;
        this.leading = 'auto';
        this.line_height = 0;   // 자동행간인 경우 line-space가 포함되어있는 높이. 고정행간이면 leading으로 지정한 값 그대로임.
        this.line_height_base = 0;      // line space가 적용되기 전의 값. 자동행간 및 수동행간 모두 max-font-size-px 그대로임
        this.line_body_height = 0;      // 자동행간인 경우 글자의 최대높이와 동일(line-space를 포함하지 않음). 고정행간인 경우 line_height와 값이 동일함
        this.line_holder_height = 0;    // 자동행간: 글자 최대 높이,  수동행간: leading height
        this.dom_line_height = 0;       // kayak dom line이 실제 가지는 값.  line_holder_height와 값이 같으나, (중요)만약 마지막 라인이면 실제 glyph가 차지하는 높이 만큼 height를 설정함. 
        this.line_width = 0;
        this.alignment_option = 'left';
        this.content_width = 0;
        this.trailing_ws_px = 0;
        this.trailing_ws_count = 0;
        this.last_glyph_white_space = 0;
        this.offset_left = 0;
        this.space_before = 0;
        this.space_after = 0;
        this.jstf_balance_info = null;

        this.svg_paths = [];
        this.svg_glyph_arr = null;
    
    }

    clone(): DomLine {
        let obj = new DomLine();
        // shallow copy
        return Object.assign(obj, this);
    }

    y_overflow(): number {
        let y_overflow = this.line_height_base - this.line_body_height;
        y_overflow = (y_overflow < 0) ? 0 : y_overflow;
        return y_overflow;
    }
}

export { TBLocator, DomPar, DomLine };
export default TextBoxDom;