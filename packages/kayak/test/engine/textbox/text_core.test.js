/*
    D 묶음 특성 테스트: TP_TextCore/TP_TextRange/TP_TextHistory/TP_TextHistoryInfo, TB_SelRange, TB_WordCache, TB_History,
    TB_LineMetric, TB_LineRenderOptions, TB_RangeMetric. 전환 전 JS에서 통과하는 상태가 기준선이다.
    원본은 메서드가 인스턴스 속성이라 toEqual(객체)로 비교하면 class 전환 뒤 결과가 달라진다. 필드만 골라 비교한다.
*/
import { describe, it, expect } from 'vitest';
import { round, load_test_font } from './helpers';
import TP_TextCore from '../../../src/engine/textbox/TP_TextCore';
import TP_TextRange from '../../../src/engine/textbox/TP_TextRange';
import TP_TextHistory from '../../../src/engine/textbox/TP_TextHistory';
import TP_TextHistoryInfo from '../../../src/engine/textbox/TP_TextHistoryInfo';
import TB_SelRange from '../../../src/engine/textbox/TB_SelRange';
import TB_WordCache from '../../../src/engine/textbox/TB_WordCache';
import { TB_History } from '../../../src/engine/textbox/TB_History';
import { TB_LineMetric } from '../../../src/engine/textbox/TB_LineMetric';
import { TB_LineRenderOptions } from '../../../src/engine/textbox/TB_LineRenderOptions';
import { TB_RangeMetric } from '../../../src/engine/textbox/TB_RangeMetric';

const codes = s => Array.from(s, ch => ch.charCodeAt(0));
const rng = r => [r.m_begin, r.m_end, r.m_cursor_pos, r.m_text];

describe('TP_TextRange / TP_TextHistory / TP_TextHistoryInfo', () => {
    it('TP_TextRange: clone은 독립 복사본, length는 end-begin, clear', () => {
        const r = new TP_TextRange();
        expect(rng(r)).toEqual([-1, -1, -1, []]);
        r.m_begin = 2; r.m_end = 5; r.m_cursor_pos = 3; r.m_text = [65, 66, 67];
        const c = r.clone();
        expect(rng(c)).toEqual([2, 5, 3, [65, 66, 67]]);
        expect(c.m_text).not.toBe(r.m_text);
        expect(c.length()).toBe(3);
        c.clear();
        expect(rng(c)).toEqual([-1, -1, 3, []]);   // cursor_pos는 남는다 (원본 동작)
    });
    it('TP_TextHistoryInfo 초기값', () => {
        const h = new TP_TextHistoryInfo();
        expect([h.m_pRngBefore, h.m_pRngAfter, h.m_noop]).toEqual([null, null, false]);
    });
    it('TP_TextHistory: push는 현재 위치 뒤를 버리고, prev/next/last', () => {
        const h = new TP_TextHistory();
        expect([h.getLastStep(), h.getPrevStep(), h.getNextStep()]).toEqual([null, null, null]);
        h.push_thi('a'); h.push_thi('b'); h.push_thi('c');
        expect(h.getLastStep()).toBe('c');
        expect(h.getPrevStep()).toBe('c');
        expect(h.getPrevStep()).toBe('b');
        h.push_thi('d');                       // 'b','c'를 버리고 'd'
        expect(h.getNextStep()).toBeNull();
        expect(h.getPrevStep()).toBe('d');
        expect(h.getPrevStep()).toBe('a');
        expect(h.getPrevStep()).toBeNull();
        expect(h.getNextStep()).toBe('a');
        expect(h.getNextStep()).toBe('d');
        expect(h.getNextStep()).toBeNull();
        expect(h.getLastStep()).toBe('d');
    });
});

describe('TP_TextCore', () => {
    function make() {
        const tc = new TP_TextCore();
        tc.insert('\n', 0);
        return tc;
    }
    it('insert / insert_string / toString / toRawString / toHtmlString / toHtmlCharEntity', () => {
        const tc = make();
        tc.insert(65, 0);
        tc.insert_string(1, codes('bc'));
        expect(tc.m_text).toEqual([65, 98, 99, 10]);
        expect(tc.toString()).toBe('Abc$');
        expect(tc.toRawString()).toBe('Abc\n');
        expect(tc.toRawString(0, 2)).toBe('Ab');
        expect(tc.toRawString(2, 4, { new_line_as_space: true })).toBe('c ');
        expect(tc.toHtmlString(0, 4, {})).toBe('Abc&nbsp;');
        expect(tc.toHtmlString(0, 4, { keep_cr: true })).toBe('Abc\n');
        expect(tc.toHtmlString(undefined, undefined, {})).toBe('Abc&nbsp;');
        expect(['<', '&', '>', ' ', 'x'].map(ch => tc.toHtmlCharEntity(ch.charCodeAt(0)))).toEqual(['&lt;', '&amp;', '&gt;', '&nbsp;', 'x']);
    });
    it('toRawString: null/0 글자는 공백으로 (일본어 입력 버그 대응)', () => {
        const tc = make();
        tc.m_text = [65, null, 0, 10];
        expect(tc.toRawString()).toBe('A  \n');
    });
    it('get_last_change_info: insert/erase/erase_range/paste의 변동량', () => {
        const tc = make();
        tc.insert_string(0, codes('bc'));
        let ci = tc.get_last_change_info('insert');
        expect([ci.edit_cmd, ci.text_fluctuation, rng(ci.before), rng(ci.after)]).toEqual(['insert', 2, [0, 0, 0, []], [0, 2, 2, [98, 99]]]);
        tc.erase(0);
        ci = tc.get_last_change_info('erase');
        expect([ci.text_fluctuation, rng(ci.before), rng(ci.after)]).toEqual([-1, [0, 1, 0, [98]], [0, 0, 0, []]]);
        expect(tc.toString()).toBe('c$');
        tc.erase_range(5, 0, 1);
        ci = tc.get_last_change_info('erase');
        expect([ci.text_fluctuation, rng(ci.before)]).toEqual([-1, [0, 1, 5, [99]]]);
        tc.paste(0, codes('xy'));
        ci = tc.get_last_change_info('paste');
        expect([ci.text_fluctuation, tc.toString()]).toEqual([2, 'xy$']);
        // 'undo'면 before/after가 뒤집힌다
        ci = tc.get_last_change_info('undo');
        expect([ci.text_fluctuation, rng(ci.before), rng(ci.after)]).toEqual([-2, [0, 2, 2, [120, 121]], [0, 0, 0, []]]);
        // noop: 양쪽 범위가 같아 변동량 0
        tc.nop(0, 1);
        ci = tc.get_last_change_info('nop');
        expect([ci.text_fluctuation, tc.m_LastAction.m_noop]).toEqual([0, true]);
    });
    it('undo_text/redo_text: 경계에서 에러 코드 1/2, noop은 텍스트를 건드리지 않는다', () => {
        const tc = make();                       // 히스토리 1: '\n'
        tc.insert_string(0, codes('ab'));        // 2
        tc.erase(0);                             // 3 → 'b\n'
        tc.nop(0, 1);                            // 4 (noop)
        const results = [];
        const cb = (err, r) => results.push([err, r ? rng(r) : null, tc.toString()]);
        tc.undo_text(cb);   // noop
        tc.undo_text(cb);   // 'ab$'
        tc.undo_text(cb);   // '$'
        tc.undo_text(cb);   // ''
        tc.undo_text(cb);   // err 1
        tc.redo_text(cb);   // '$'
        tc.redo_text(cb);   // 'ab$'
        tc.redo_text(cb);   // 'b$'
        tc.redo_text(cb);   // noop
        tc.redo_text(cb);   // err 2
        expect(results).toMatchSnapshot();
        expect(tc.m_LastAction.m_noop).toBe(true);
    });
});

describe('TB_SelRange', () => {
    it('set/setFrom/setTo/inRange/reset', () => {
        const s = new TB_SelRange(null);
        expect([s.is_empty(), s.length()]).toEqual([true, 0]);
        expect(s.set(5, 2)).toBe(true);
        expect([s.m_from, s.m_to, s.is_empty(), s.length()]).toEqual([2, 5, false, 3]);
        expect(s.set(3, 3)).toBe(false);
        expect([s.m_from, s.m_to]).toEqual([2, 5]);
        expect([s.inRange(1), s.inRange(2), s.inRange(4), s.inRange(5)]).toEqual([false, true, true, false]);
        expect(s.setFrom(4)).toBe(true);
        expect([s.m_from, s.m_to, s.m_org_pos, s.is_empty(), s.inRange(4)]).toEqual([4, 4, 4, true, false]);
        expect(s.setTo(7)).toBe(true);
        expect([s.m_from, s.m_to]).toEqual([4, 7]);
        expect(s.setTo(1)).toBe(true);
        expect([s.m_from, s.m_to]).toEqual([1, 4]);
        expect(s.setTo(4)).toBe(false);
        expect([s.m_from, s.m_to, s.is_empty()]).toEqual([1, 4, true]);
        s.reset();
        expect([s.m_from, s.m_to, s.m_org_pos, s.m_bEmpty]).toEqual([0, 0, 0, true]);
    });
});

describe('TB_WordCache', () => {
    it('put/get/size/containsValue/remove/clear', () => {
        const c = new TB_WordCache();
        expect(c.size()).toBe(0);
        c.put('a', 1); c.put('b', 2);
        expect([c.get('a'), c.get('zz'), c.size(), c.containsValue(2), c.containsValue(3)]).toEqual([1, undefined, 2, true, false]);
        c.remove('a');
        expect([c.get('a'), c.size()]).toEqual([undefined, 1]);
        c.clear();
        expect(c.size()).toBe(0);
    });
});

describe('TB_History (redux-undo)', () => {
    it('초기 상태, dispatch, noop 카운트, undo/redo, reset', () => {
        const h = new TB_History();
        const present = () => h.get_state().present.toJS();
        expect(present()).toEqual({ noop: false, noop_count: 0, tpath: { align_to_path: 'none', flip_path: false, start_bracket: 0, end_bracket: 1 } });
        h.dispatch({ type: 'TPath.ALIGN', align_to_path: 'center' });
        expect(present()).toMatchSnapshot();
        h.dispatch({ type: 'TPath.START_BRACKET', value: 5 });
        h.noop();
        h.noop();
        expect(present()).toMatchSnapshot();
        expect(h.get_state().past.length).toBe(4);
        h.undo();
        h.undo();
        expect(present().tpath.start_bracket).toBe(5);
        expect(present().noop).toBe(false);
        h.undo();
        expect(present().tpath.align_to_path).toBe('center');
        h.redo();
        expect(present().tpath.start_bracket).toBe(5);
        h.reset();
        expect([h.get_state().past.length, h.get_state().future.length, present().tpath.start_bracket]).toEqual([0, 0, 5]);
        h.dispatch({ type: 'NOTHING' });
        expect(present().noop_count).toMatchSnapshot();
    });
});

describe('TB_LineMetric / TB_LineRenderOptions / TB_RangeMetric', () => {
    it('TB_LineMetric.measure_by_adding_word / set_zero', () => {
        const m = new TB_LineMetric('domPar');
        m.lineWidth = 300; m.ci_lbegin_doc = 7;
        m.measure_by_adding_word({ text: 'ab', width: 10, whiteSpace: false, last_glyph_white_space: 1, height: 12, ascent: 9, ascent_d: 5, descent: 3, max_font_size_px: 16 });
        m.measure_by_adding_word({ text: '  ', width: 4, whiteSpace: true, last_glyph_white_space: 0, height: 12, ascent: 9, ascent_d: 5, descent: 3, max_font_size_px: 16 });
        m.measure_by_adding_word({ text: 'c', width: 3, whiteSpace: false, last_glyph_white_space: 2, height: 20, ascent: 15, ascent_d: 11, descent: 5, max_font_size_px: 24 });
        expect([m.content_width, m.trailing_ws_px, m.trailing_ws_count, m.last_glyph_white_space, m.max_height, m.max_ascent, m.max_ascent_d, m.max_descent, m.max_font_size_px]).toEqual([17, 4, 2, 2, 20, 15, 11, 5, 24]);
        m.set_zero();
        expect([m.content_width, m.max_height, m.lineWidth, m.ci_lbegin_doc, m.domPar]).toEqual([0, 0, 300, 7, 'domPar']);
        const o = new TB_LineRenderOptions();
        expect([o.is_first_line_on_doc, o.is_last_line_on_doc]).toEqual([false, false]);
    });
    it('TB_RangeMetric.set_with_dimension: style key별 합산', () => {
        const m = new TB_RangeMetric();
        m.set_with_dimension({ width: 10, key: 'k1', last_glyph_width: 4, last_glyph_white_space: 1, height: 16, count: 2 });
        m.set_with_dimension({ width: 5, key: 'k1', last_glyph_width: 3, last_glyph_white_space: 0, height: 12, count: 1 });
        m.set_with_dimension({ width: 7, key: null, last_glyph_width: 2, last_glyph_white_space: 0, height: 20, count: 3 });
        expect([m.width, m.last_style_key, m.last_glyph_width, m.height, m.style_keys]).toEqual([22, null, 2, 20, { k1: { width: 15, count: 3 } }]);
    });
    it('TB_RangeMetric.set_with_font: ascent_d가 큰 폰트/크기만 반영', () => {
        const font = load_test_font();
        const m = new TB_RangeMetric();
        m.set_with_font(font, 16);
        const first = [m.ascent, m.ascent_d, m.descent];
        expect(round(first)).toMatchSnapshot();
        m.set_with_font(font, 12);      // 더 작으니 그대로
        expect([m.ascent, m.ascent_d, m.descent]).toEqual(first);
        m.set_with_font(font, 32);
        expect(round(m.ascent)).toBe(round(first[0] * 2));
    });
});
