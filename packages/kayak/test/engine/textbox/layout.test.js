/*
    TB_Layout / TB_LocationFinder / TB_LayoutWalker / TB_PostLayoutProcess 특성 테스트.
    test/snapshot/helpers의 실제 textbox(jsdom, page/content 300px, gutter 0, scale 1, KoPub 폰트) 위에서 돌린다.
    ./helpers는 import하지 않는다 (_g window 충돌).
    describe 블록은 파일 순서대로 돌고 앞 블록의 편집 결과 위에서 뒤 블록이 돈다.
*/
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { create_textbox, destroy_textbox } from '../../snapshot/helpers';
import { TB_LayoutWalker } from '../../../src/engine/textbox/TB_layoutWalker';

const LONG = 'The quick brown fox jumps over the lazy dog again and again until the line wraps';
const TEXT = `Hello world\n${LONG}\nThird`;

let tb;
beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    tb = await create_textbox();
    tb.opEdit.insert_multiline_string(0, TEXT);
});
afterAll(() => { destroy_textbox(tb); vi.restoreAllMocks(); });

const tbdom = () => tb.layout.get_tbdom();
const finder = () => tb.layout.finder;
const shape = () => tbdom().pars.map(p => p.lines.map(l => l.char_count));
const loc_fields = loc => ({
    ci_doc: loc.ci_doc, li_doc: loc.li_doc, pi: loc.pi, li_par: loc.li_par, ci_pbegin_doc: loc.ci_pbegin_doc,
    ci_line: loc.ci_line, cc_line: loc.cc_line, ci_lbegin_doc: loc.ci_lbegin_doc, ci_lend_doc: loc.ci_lend_doc,
});

/* 레이아웃 불변식: 글줄 글자 수 합 = 전체 길이, lineview 배열 = 논리 글줄 = 실제 DOM .kayak-lineview, 모든 ci가 자기 글줄 범위 안 */
function check_invariants() {
    const lines = tbdom().getDomLines();
    expect(lines.reduce((s, l) => s + l.char_count, 0)).toBe(tb.text_length());
    expect(tbdom().get_total_line_count()).toBe(lines.length);
    expect(tb.element.querySelectorAll('.kayak-lineview').length).toBe(lines.length);
    for (let ci = 0; ci < tb.text_length(); ci++) {
        const loc = tbdom().get_location(ci);
        expect(loc.ci_lbegin_doc <= ci && ci < loc.ci_lend_doc).toBe(true);
        expect(tbdom().get_char_pos_by_line_counter(loc.li_doc)).toBe(loc.ci_lbegin_doc);
    }
}

describe('TB_Layout', () => {
    it('insert_multiline_string 뒤 문단 3개, 긴 문단은 여러 글줄로 나뉜다 (do_layout_all + do_layout)', () => {
        expect(tbdom().pars.length).toBe(3);
        expect(tbdom().pars[1].lines.length).toBeGreaterThan(1);
        check_invariants();
        expect(shape()).toMatchSnapshot();
    });

    it('문단 중간에 글자를 넣으면(smart layout, 글줄 재사용) 불변식이 유지된다', () => {
        const before = tb.text_length();
        const ci = tbdom().get_ci_range_of_par(1).begin + 5;
        tb.opEdit.insert(ci, 'X'.charCodeAt(0));
        expect(tb.text_length()).toBe(before + 1);
        expect(tb.text_core.toRawString(ci, ci + 1)).toBe('X');
        check_invariants();
        expect(shape()).toMatchSnapshot();
    });

    it('문서 맨 앞에서 Enter: 첫 줄이 둘째 줄이 되고 첫 줄 높이를 다시 계산한다 (post_layout_process_1)', () => {
        tb.opEdit.insert(0, 10);
        expect(tbdom().pars.length).toBe(4);
        expect(tbdom().pars[0].lines[0].char_count).toBe(1);
        check_invariants();
    });

    it('빈 첫 문단을 지우면(delete만 있는 경우, layout_for_simple_case) 문단이 줄어든다', () => {
        tb.opEdit.erase(0, 0, 0);
        expect(tbdom().pars.length).toBe(3);
        check_invariants();
    });

    it('문단 정렬 변경(set_par)은 문단 전체를 다시 배치한다 (full_layout)', () => {
        const rng = tbdom().get_ci_range_of_par(1);
        tb.opStyle.set_text_align('center', { cursor: rng.begin, begin: rng.begin, end: rng.end, exists_range: true });
        expect(tbdom().pars[1].lines.every(l => l.alignment_option === 'center')).toBe(true);
        expect(tbdom().pars[1].lines.every(l => l.offset_left > 0)).toBe(true);
        // 문단 0의 alignment_option은 undefined다 (create_textbox의 content 옵션에 default_align이 없어 첫 문단 ATTR_Par.m_Align이 비어 있다). 'center'가 아닌 것만 본다.
        expect(tbdom().pars[0].lines[0].alignment_option).not.toBe('center');
        expect(tbdom().pars[0].lines[0].offset_left).toBe(0);
        check_invariants();
        expect(shape()).toMatchSnapshot();
    });

    it('resizeBox는 전체를 다시 배치한다 (do_layout_all)', () => {
        const lines_before = tbdom().get_total_line_count();
        tb.resizeBox({ content: { width: 150 }, page: { width: 150 } });
        expect(tbdom().get_total_line_count()).toBeGreaterThan(lines_before);
        check_invariants();
        tb.resizeBox({ content: { width: 300 }, page: { width: 300 } });
        expect(tbdom().get_total_line_count()).toBe(lines_before);
    });

    it('get_cursor_pos_info는 tbdom.get_location과 같고, show_line_gutter면 그 글줄 gutter만 빨갛게 칠한다', async () => {
        const g = await create_textbox({ debug: { show_line_gutter: true } });
        try {
            g.opEdit.insert_multiline_string(0, 'ab\ncd');
            const loc = g.layout.get_cursor_pos_info(3);
            expect(loc_fields(loc)).toEqual(loc_fields(g.layout.get_tbdom().get_location(3)));
            const wrappers = g.element.querySelectorAll(g.docFactory.gutter_wrapper_selector);
            expect(wrappers.length).toBe(2);
            expect([wrappers[0].style.backgroundColor, wrappers[1].style.backgroundColor]).toEqual(['transparent', 'red']);
            g.layout.get_cursor_pos_info(0);
            expect([wrappers[0].style.backgroundColor, wrappers[1].style.backgroundColor]).toEqual(['red', 'transparent']);
        } finally { destroy_textbox(g); }
    });

    it('get_line은 커서 위치의 DomLine을 돌려준다', () => {
        const rng = tbdom().get_ci_range_of_par(1);
        tb.tbcursor.set(rng.begin + 2);
        tb.tbcursor.repaint();
        const info = tb.tbcursor.get_location_info();
        const li = info.last_cursor_loc_info.location.li_doc;
        expect(tb.layout.get_line(info)).toBe(tbdom().get_domLine_by_line_number(li).domLine);
    });
});

describe('TB_LocationFinder', () => {
    it('find_cursor_location_by_ci: 글줄 첫 위치는 x_pos == offset_left, 뒤로 갈수록 x_pos가 는다', () => {
        const line1 = tbdom().get_line_by_line_counter(1);     // 가운데 정렬된 긴 문단의 첫 글줄
        const at_begin = finder().find_cursor_location_by_ci(line1.ci_lbegin_doc);
        expect(at_begin.location.li_doc).toBe(1);
        expect(at_begin.x_pos).toBe(line1.line.offset_left);
        expect(at_begin.height).toBe(line1.line.max_font_size_px);
        expect(at_begin.max_word_height).toBe(line1.line.max_word_height);
        const at_next = finder().find_cursor_location_by_ci(line1.ci_lbegin_doc + 1);
        expect(at_next.x_pos).toBeGreaterThan(at_begin.x_pos);
        expect(at_next.y_pos).toBe(at_begin.y_pos);
        expect(Object.keys(at_begin).sort()).toEqual(['ascent', 'descent', 'height', 'location', 'max_word_ascent', 'max_word_descent', 'max_word_height', 'x_pos', 'y_pos']);
    });

    it('is_range_sel이면 글줄 끝 index(다음 줄 시작)를 그 줄의 끝으로 해석한다', () => {
        const line1 = tbdom().get_line_by_line_counter(1);
        const plain = finder().find_cursor_location_by_ci(line1.ci_lend_doc);
        const ranged = finder().find_cursor_location_by_ci(line1.ci_lend_doc, true);
        expect(plain.location.li_doc).toBe(2);
        expect(ranged.location.li_doc).toBe(1);
        expect(ranged.x_pos).toBeGreaterThan(line1.line.offset_left);
        expect(ranged.y_pos).toBeLessThan(plain.y_pos);
        expect(finder().find_cursor_location_by_ci(0, true).location.ci_doc).toBe(0);   // 음수 보정
    });

    it('find_cursor_location_by_line_num: x=0은 글줄 시작, 아주 큰 x는 마지막 글자 앞, 범위 밖 li_doc은 보정', () => {
        const line0 = tbdom().get_line_by_line_counter(0);     // 'Hello world' + \n (12자, 왼쪽 정렬)
        const a = finder().find_cursor_location_by_line_num(0, 0);
        expect([a.li_doc, a.ci_doc, a.ci_line, a.x_pos]).toEqual([0, 0, 0, 0]);
        const b = finder().find_cursor_location_by_line_num(0, 1e9);
        expect([b.li_doc, b.ci_doc, b.ci_line]).toEqual([0, line0.ci_lend_doc - 1, line0.line.char_count - 1]);
        expect(b.x_pos).toBeGreaterThan(0);
        expect(b.max_word_height).toBe(line0.line.max_word_height);
        const last = tbdom().get_total_line_count() - 1;
        const c = finder().find_cursor_location_by_line_num(last + 5, 0);      // 아래로 벗어나면 마지막 글줄의 끝
        expect([c.li_doc, c.ci_doc]).toEqual([last, tb.text_length() - 1]);
        const d = finder().find_cursor_location_by_line_num(-1, 1e9);         // 위로 벗어나면 첫 글줄의 시작
        expect([d.li_doc, d.ci_doc, d.x_pos]).toEqual([0, 0, 0]);
        expect(Object.keys(a).sort()).toEqual(['ci_doc', 'ci_line', 'li_doc', 'max_word_height', 'x_mouse', 'x_pos', 'y_pos']);
    });

    it('find_cursor_location_by_mouse_point: jsdom의 bbox는 0이므로 page 폭의 절반(-150)을 왼쪽 끝으로 해석한다', () => {
        // orthogonal_box = {x: -page.width/2, y: 0} (scrollHeight 0). gutter_top 0, scale 1 → x_page = clientX + 150, y = clientY
        const hit = finder().find_cursor_location_by_mouse_point({ clientX: -150, clientY: 1 });
        expect([hit.li_doc, hit.ci_doc, hit.ci_line, hit.x_pos, hit.x_mouse, hit.y_pos]).toEqual([0, 0, 0, 0, 0, 1]);
        expect(hit.max_word_height).toBe(tbdom().get_line_by_line_counter(0).line.max_word_height);
        expect(finder().find_cursor_location_by_mouse_point({ clientX: -150, clientY: -5 })).toBeNull();        // 위로 벗어남
        expect(finder().find_cursor_location_by_mouse_point({ clientX: -150, clientY: 1e6 })).toBeNull();       // 아래로 벗어남
        expect(finder().find_cursor_location_by_mouse_point({ clientX: 151, clientY: 1 })).toBeNull();          // 오른쪽 (x 301 > 300)
        expect(finder().find_cursor_location_by_mouse_point({ clientX: -150, clientY: -5 }, { find_outof_box: true }).li_doc).toBe(0);
        const last = tbdom().get_total_line_count() - 1;
        expect(finder().find_cursor_location_by_mouse_point({ clientX: -150, clientY: 1e6 }, { find_outof_box: true }).li_doc).toBe(last);
        expect(finder().find_cursor_location_by_mouse_point({ clientX: 151, clientY: 1 }, { find_outof_box: true }).ci_doc).toBe(11);
        // find_pos_to_line_end: 글줄 끝(다음 줄 시작 index)까지 허용
        expect(finder().find_cursor_location_by_mouse_point({ clientX: 151, clientY: 1 }, { find_outof_box: true, find_pos_to_line_end: true }).ci_doc).toBe(12);
    });

    it('angle이 90이면 마우스 좌표를 상자 중심 기준으로 역회전한다 (Review Focus 2)', () => {
        tb.angle(90);
        try {
            // R(-90°): (x, y) → (y, -x). (-1, -150) → (-150, 1) = 위 테스트의 (clientX:-150, clientY:1)
            const hit = finder().find_cursor_location_by_mouse_point({ clientX: -1, clientY: -150 });
            expect([hit.li_doc, hit.ci_doc]).toEqual([0, 0]);
            expect(hit.y_pos).toBeCloseTo(1, 6);
            expect(finder().find_cursor_location_by_mouse_point({ clientX: -150, clientY: 1 })).toBeNull();   // (1, 150) → 글줄 밖 또는 x 301
        } finally { tb.angle(0); }
    });
});

describe('TB_LayoutWalker', () => {
    it('traverse_by_line은 글줄마다 {x, y, line, index}를 주고 frame 크기를 돌려준다', () => {
        const walker = new TB_LayoutWalker(tb);
        const seen = [];
        const frame = walker.traverse_by_line(d => seen.push(d));
        const lines = tbdom().getDomLines();
        expect(seen.length).toBe(lines.length);
        seen.forEach((d, i) => {
            expect(d.index).toBe(i);
            expect(d.line).toBe(lines[i]);
            expect(d.x).toBe(tb.tbconfig.computed_page_gutter_left + lines[i].offset_left);
            if (i > 0) expect(d.y).toBeGreaterThan(seen[i - 1].y);
        });
        expect(frame.frame_width).toBe(300);
        const last = lines[lines.length - 1];
        expect(frame.frame_height).toBeCloseTo(seen[seen.length - 1].y + last.dom_line_height + last.space_after + tb.tbconfig.page.gutter_bottom, 6);
    });

    it('fit_to_content_height가 false면 frame_height는 preference의 frame_height', () => {
        tb.opStyle.set_fit_to_content_height(false);
        try {
            tb.opStyle.set_frame_height(777);
            expect(new TB_LayoutWalker(tb).traverse_by_line(() => {}).frame_height).toBe(777);
        } finally { tb.opStyle.set_fit_to_content_height(true); }
    });
});

describe('TB_PostLayoutProcess', () => {
    it('adjust_gradient: gradient가 적용된 글줄의 <defs for=gradient>에 linearGradient를 채운다', async () => {
        const g = await create_textbox();
        try {
            g.opEdit.insert_string(0, 'gradient');
            const gradient = {
                type: 'linear', geom: { x1: '0%', y1: '0%', x2: '100%', y2: '0%' },
                stops: [{ offset: '0%', rgb: '#ff0000' }, { offset: '100%', rgb: '#0000ff' }], angle: 0,
            };
            g.opStyle.set_fontColor(gradient, null, null, g.tbcursor.sel_all());
            const line = g.layout.get_tbdom().getDomLines()[0];
            expect(line.svg_paths.some(p => p.gradient)).toBe(true);
            const defs = g.element.querySelector('.kayak-line svg defs[for=gradient]');
            expect(defs).not.toBeNull();
            expect(defs.innerHTML).toContain(`<linearGradient id="grad-${line.uuid}-0"`);
            expect(g.snapshotAsSVG({ path_only: true })).toContain('<linearGradient');
        } finally { destroy_textbox(g); }
    });
});
