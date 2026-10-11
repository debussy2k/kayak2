/*
    TextBoxDom(논리 문서 모델) 특성 테스트. 실제 레이아웃 없이 DomPar/DomLine을 손으로 쌓아 색인 계산만 고정한다.
    DomPar/DomLine은 export되지 않으므로 append_par()/push_empty_DomLine_object()로 만든다.
*/
import { describe, it, expect } from 'vitest';
import TextBoxDom from '../../../src/engine/textbox/TextBoxDom';

const METRIC = { space_before: 1, line_height: 10, space_after: 2, line_height_base: 8, max_word_ascent: 7, max_word_descent: 3 };

/* spec: 문단별 글줄 글자 수. [[3, 4], [5]] → 문단 0 = 글줄 3자 + 4자, 문단 1 = 글줄 5자 */
function build(spec, metric = METRIC) {
    const tbdom = new TextBoxDom();
    for (const counts of spec) {
        const par = tbdom.append_par();
        let offset = 0;
        for (const cc of counts) {
            Object.assign(par.push_empty_DomLine_object(offset, cc), metric);
            offset += cc;
        }
    }
    return tbdom;
}
const loc_obj = loc => ({
    ci_doc: loc.ci_doc, li_doc: loc.li_doc, pi: loc.pi, li_par: loc.li_par, ci_pbegin_doc: loc.ci_pbegin_doc,
    ci_line: loc.ci_line, cc_line: loc.cc_line, ci_lbegin_doc: loc.ci_lbegin_doc, ci_lend_doc: loc.ci_lend_doc,
});

describe('TextBoxDom 문단/글줄 관리', () => {
    it('append_par / insertBefore_par / remove_par / remove_lines_to_the_end / clear', () => {
        const tbdom = build([[3, 4], [5]]);
        expect(tbdom.pars.length).toBe(2);
        expect(tbdom.getDomLines().map(l => l.char_count)).toEqual([3, 4, 5]);
        const p = tbdom.insertBefore_par(1);
        expect(tbdom.pars[1]).toBe(p);
        expect(p.lines).toEqual([]);
        tbdom.remove_par(1, 1);                        // begin >= end 면 아무것도 안 함
        expect(tbdom.pars.length).toBe(3);
        tbdom.remove_par(1, 2);
        expect(tbdom.pars.length).toBe(2);
        tbdom.remove_lines_to_the_end(0, 1);
        expect(tbdom.pars[0].lines.length).toBe(1);
        tbdom.remove_lines_to_the_end(9, 0);           // 범위 밖 pi는 무시
        tbdom.remove_par(1);                           // end 생략 → 끝까지
        expect(tbdom.pars.length).toBe(1);
        tbdom.lineview_arr.push('x');
        tbdom.clear();                                 // pars만 비운다. lineview_arr는 그대로
        expect([tbdom.pars.length, tbdom.get_total_line_count()]).toEqual([0, 1]);
    });

    it('get_line_range_by_par_index / get_ci_range_of_par / get_char_pos_by_line_counter', () => {
        const tbdom = build([[3, 4], [5]]);
        expect(tbdom.get_line_range_by_par_index(0, 1)).toEqual({ begin: 0, end: 2 });
        expect(tbdom.get_line_range_by_par_index(1, 2)).toEqual({ begin: 2, end: 3 });
        expect(tbdom.get_line_range_by_par_index(0, 2)).toEqual({ begin: 0, end: 3 });
        expect(tbdom.get_line_range_by_par_index(1, 1)).toEqual({ begin: 2, end: 2 });   // begin == end: 그 앞까지의 글줄 수
        expect(new TextBoxDom().get_line_range_by_par_index(0, 1)).toEqual({ begin: 0, end: 0 });
        expect(tbdom.get_ci_range_of_par(0)).toEqual({ begin: 0, end: 7 });
        expect(tbdom.get_ci_range_of_par(1)).toEqual({ begin: 7, end: 12 });
        expect(tbdom.get_ci_range_of_par(2)).toBeNull();
        expect([0, 1, 2].map(li => tbdom.get_char_pos_by_line_counter(li))).toEqual([0, 3, 7]);
        expect(tbdom.get_char_pos_by_line_counter(2, 2)).toBe(9);
        expect(tbdom.get_char_pos_by_line_counter(99)).toBe(12);                     // 못 찾으면 전체 글자 수
    });

    it('get_location: 글자 위치 → 문단/글줄 색인', () => {
        const tbdom = build([[3, 4], [5]]);
        expect(loc_obj(tbdom.get_location(0))).toEqual({ ci_doc: 0, li_doc: 0, pi: 0, li_par: 0, ci_pbegin_doc: 0, ci_line: 0, cc_line: 3, ci_lbegin_doc: 0, ci_lend_doc: 3 });
        expect(loc_obj(tbdom.get_location(5))).toEqual({ ci_doc: 5, li_doc: 1, pi: 0, li_par: 1, ci_pbegin_doc: 0, ci_line: 2, cc_line: 4, ci_lbegin_doc: 3, ci_lend_doc: 7 });
        expect(loc_obj(tbdom.get_location(8))).toEqual({ ci_doc: 8, li_doc: 2, pi: 1, li_par: 0, ci_pbegin_doc: 7, ci_line: 1, cc_line: 5, ci_lbegin_doc: 7, ci_lend_doc: 12 });
        // 전체 길이 위치(어느 글줄에도 없음): 끝까지 진행한 색인이 남는다 (Review Focus 1)
        expect(loc_obj(tbdom.get_location(12))).toEqual({ ci_doc: 12, li_doc: 3, pi: 2, li_par: 0, ci_pbegin_doc: 12, ci_line: 0, cc_line: 0, ci_lbegin_doc: 12, ci_lend_doc: 12 });
        expect(Object.prototype.hasOwnProperty.call(tbdom.get_location(0), 'reset')).toBe(true);   // TBLocator.reset은 자기 속성(클로저)
    });

    it('get_location_of_line_start', () => {
        const tbdom = build([[3, 4], [5]]);
        expect(loc_obj(tbdom.get_location_of_line_start(0, 1))).toEqual({ ci_doc: 3, li_doc: 1, pi: 0, li_par: 1, ci_pbegin_doc: 0, ci_line: 3, cc_line: 4, ci_lbegin_doc: 3, ci_lend_doc: 7 });
        expect(loc_obj(tbdom.get_location_of_line_start(1, 0))).toEqual({ ci_doc: 7, li_doc: 2, pi: 1, li_par: 0, ci_pbegin_doc: 7, ci_line: 0, cc_line: 5, ci_lbegin_doc: 7, ci_lend_doc: 12 });
        expect(loc_obj(new TextBoxDom().get_location_of_line_start(0, 0))).toEqual({ ci_doc: 0, li_doc: 0, pi: 0, li_par: 0, ci_pbegin_doc: 0, ci_line: 0, cc_line: 0, ci_lbegin_doc: 0, ci_lend_doc: 0 });
    });

    it('get_line_by_line_counter / get_domLine_by_line_number', () => {
        const tbdom = build([[3, 4], [5]]);
        const lines = tbdom.getDomLines();
        expect(tbdom.get_line_by_line_counter(1)).toEqual({ ci_lbegin_doc: 3, ci_lend_doc: 7, line: lines[1] });
        expect(tbdom.get_line_by_line_counter(99)).toEqual({ ci_lbegin_doc: 12, ci_lend_doc: 0, line: null });   // 못 찾으면 line null
        expect(tbdom.get_domLine_by_line_number(0)).toEqual({ pi_doc: 0, li_par: 0, is_last_line_on_par: false, domLine: lines[0] });
        expect(tbdom.get_domLine_by_line_number(1)).toEqual({ pi_doc: 0, li_par: 1, is_last_line_on_par: true, domLine: lines[1] });
        expect(tbdom.get_domLine_by_line_number(2)).toEqual({ pi_doc: 1, li_par: 0, is_last_line_on_par: true, domLine: lines[2] });
        let thrown;
        try { tbdom.get_domLine_by_line_number(3); } catch (e) { thrown = e; }
        expect(thrown).toBe('get_pi_li_by_line_number() failed.');   // Error가 아니라 문자열을 던진다
    });

    it('get_y_pos_by_line_number / get_line_number_by_y (space_before 1, line_height 10, space_after 2)', () => {
        const tbdom = build([[3, 4], [5]]);
        expect([0, 1, 2, 99].map(li => tbdom.get_y_pos_by_line_number(li).y_pos)).toEqual([1, 14, 27, 39]);
        // Review Focus 5: 경계 y(13)는 아래 글줄, 문서 아래 밖(39)은 -1
        expect([-1, 0, 12.9, 13, 38.9, 39].map(y => tbdom.get_line_number_by_y(y))).toEqual([-1, 0, 0, 1, 2, -1]);
        expect([-1, 39].map(y => tbdom.get_line_number_by_y(y, true))).toEqual([0, 2]);   // extended: 위는 0, 아래는 마지막 글줄
    });

    it('get_full_height / get_last_domline / get_first_line_bbox_info', () => {
        const tbdom = build([[3, 4], [5]]);
        // 3줄 × 13 = 39, 첫줄 space_before(1) 빼고, 마지막 줄 (line_height + space_after)(12) 빼고 line_height_base(8) 더함
        expect(tbdom.get_full_height()).toBe(34);
        expect(new TextBoxDom().get_full_height()).toBe(0);
        expect(tbdom.get_last_domline()).toBe(tbdom.pars[1].lines[0]);
        expect(tbdom.get_first_line_bbox_info()).toEqual({ max_font_size_px: 8, effective_height: 10 });
    });
});

describe('DomPar / DomLine', () => {
    it('DomLine 기본값. core_width는 선언만 되고 속성이 만들어지지 않는다. uuid는 shortid', () => {
        const line = build([[2]], {}).pars[0].lines[0];
        expect(typeof line.uuid).toBe('string');
        expect(line.uuid.length).toBeGreaterThan(0);
        expect(Object.prototype.hasOwnProperty.call(line, 'core_width')).toBe(false);
        expect(line).toMatchObject({
            index_offset: 0, char_count: 2, max_word_height: 0, max_word_ascent: 0, max_word_ascent_d: 0, max_word_descent: 0,
            max_font_size_px: 0, leading: 'auto', line_height: 0, line_height_base: 0, line_body_height: 0, line_holder_height: 0,
            dom_line_height: 0, line_width: 0, alignment_option: 'left', content_width: 0, trailing_ws_px: 0, trailing_ws_count: 0,
            last_glyph_white_space: 0, offset_left: 0, space_before: 0, space_after: 0, jstf_balance_info: null, svg_paths: [], svg_glyph_arr: null,
        });
    });

    it('DomLine.y_overflow와 clone(얕은 복사, uuid도 같음)', () => {
        const line = build([[2]]).pars[0].lines[0];
        line.line_height_base = 10; line.line_body_height = 7;
        expect(line.y_overflow()).toBe(3);
        line.line_body_height = 12;
        expect(line.y_overflow()).toBe(0);
        const c = line.clone();
        expect(c).not.toBe(line);
        expect(c.uuid).toBe(line.uuid);
        expect(c.svg_paths).toBe(line.svg_paths);
    });

    it('DomPar.get_char_count / clone(글줄도 복제) / remove_lines_to_the_end', () => {
        const par = build([[3, 4]]).pars[0];
        expect(par.get_char_count()).toBe(7);
        const c = par.clone();
        expect(c.lines.length).toBe(2);
        expect(c.lines[0]).not.toBe(par.lines[0]);
        expect(c.lines[0].char_count).toBe(3);
        par.remove_lines_to_the_end(1);
        expect([par.lines.length, c.lines.length]).toEqual([1, 2]);
    });
});
