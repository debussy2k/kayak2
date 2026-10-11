/*
    B 서비스 묶음 특성 테스트: services/* 와 layout_service/*. 가짜 tb를 쓴다.
*/
import { describe, it, expect } from 'vitest';
import { window, make_tb, round } from './helpers';
import { TB_TextFxService } from '../../../src/engine/textbox/services/TB_TextFxService';
import { TB_JustificationService } from '../../../src/engine/textbox/services/TB_JustificationService';
import { TB_TofuService } from '../../../src/engine/textbox/services/TB_TofuService';
import { TB_StyleService } from '../../../src/engine/textbox/services/TB_StyleService';
import { TB_FormatService } from '../../../src/engine/textbox/services/TB_Format.service';
import { TB_LayoutAux } from '../../../src/engine/textbox/layout_service/TB_LayoutAux';
import { TB_LayoutContext } from '../../../src/engine/textbox/layout_service/TB_LayoutContext';
import { TB_ParChangeInfo } from '../../../src/engine/textbox/layout_service/TB_ParChangeInfo';
import { TB_PosTracker } from '../../../src/engine/textbox/layout_service/TB_PosTracker';

describe('TB_TextFxService', () => {
    const svg_paths = () => [
        { d: 'M0 0', fill: '#f00' },
        { d: 'M1 1', gradient: { type: 'linear' } },
        { d: 'M2 2', fill: '#0f0', stroke: { weight: 1, align: 'outside', color: '#00f', join: 'round', miterlimit: 4 } },
        { d: 'M3 3', fill: '#0f0', stroke: { weight: 2, align: 'center', color: '#00f', join: 'miter', miterlimit: 2 } },
        { d: 'M4 4', fill: '#f00', shadow: { size: 1, distance: 2, angle: 135, color: '#000', opacity: 100 } },
        { d: 'M5 5', fill: '#f00', shadow: { size: 0, distance: 0, angle: 0, color: '#000', opacity: 100 } },
    ];
    it('fill / gradient / stroke(outside, center) / shadow', () => {
        const r = TB_TextFxService.generate_svg_path_string(svg_paths(), 'u1');
        expect(r.shadow_info_arr).toEqual([]);
        expect(r.svg_string).toMatchSnapshot();
    });
    it('override_fill_color와 transparent_by_src_color', () => {
        const r = TB_TextFxService.generate_svg_path_string(svg_paths(), 'u1', null, { override_fill_color: { fill: '#fff', transparent_by_src_color: ['#f00'] } });
        expect(r.svg_string).toMatchSnapshot();
    });
    it('shadow_as_image: <image>로 바꾸고 shadow_info_arr를 채운다', () => {
        const domLine = { content_width: 100, max_font_size_px: 12, max_word_descent: 3 };
        const r = TB_TextFxService.generate_svg_path_string(svg_paths(), 'u1', domLine, { shadow_as_image: true, relative_path: 'img' });
        expect(round(r.shadow_info_arr)).toMatchSnapshot();
        expect(r.svg_string).toMatchSnapshot();
    });
    it('compose_dropshadow: size/distance 0이면 null', () => {
        expect(TB_TextFxService.compose_dropshadow({ shadow: { size: 0, distance: 0 } }, { uuid_postfix: 'x' })).toEqual({ shadow_def: null, shadow_filter: null });
        expect(TB_TextFxService.compose_dropshadow({}, { uuid_postfix: 'x' })).toEqual({ shadow_def: null, shadow_filter: null });
    });
});

describe('TB_JustificationService', () => {
    const wi = (ws, keys, last) => ({ whiteSpace: ws, dimension: Object.assign({ style_keys: keys }, last) });
    const arr = () => [
        wi(false, { k1: { width: 10, count: 2 } }, { last_style_key: 'k1', last_glyph_width: 4, last_glyph_white_space: 1 }),
        wi(true, { k1: { width: 5, count: 1 } }),
        wi(false, { k2: { width: 20, count: 4 } }, { last_style_key: 'k2', last_glyph_width: 5, last_glyph_white_space: 0 }),
        wi(true, { k2: { width: 3, count: 1 } }),
    ];
    it('calc_for_justification: 마지막 white space 제외, 마지막 글리프 폭 제외, 비율 안분', () => {
        const r = TB_JustificationService.calc_for_justification(arr());
        expect(r.k1).toEqual({ width: 15, count: 3, balance_space_ratio: (15 / 30) / 3 });
        expect(r.k2).toEqual({ width: 15, count: 3, balance_space_ratio: (15 / 30) / 3 });
    });
    it('get_jstf_balance_info: 정렬 종류와 마지막 줄 여부', () => {
        expect(TB_JustificationService.get_jstf_balance_info({ m_Align: 'left' }, false, arr())).toBeNull();
        expect(TB_JustificationService.get_jstf_balance_info({ m_Align: 'fully-justified' }, true, arr())).not.toBeNull();
        expect(TB_JustificationService.get_jstf_balance_info({ m_Align: 'left-justified' }, true, arr())).toBeNull();
        expect(TB_JustificationService.get_jstf_balance_info({ m_Align: 'center-justified' }, false, arr())).not.toBeNull();
    });
    it('last_style_key가 없으면 비율 계산을 건너뛴다 (원본 동작, console.error)', () => {
        const a = [wi(false, { k1: { width: 10, count: 2 } }, {})];
        expect(TB_JustificationService.calc_for_justification(a)).toEqual({ k1: { width: 10, count: 2 } });
    });
});

describe('TB_TofuService / TB_StyleService', () => {
    const TEXT = 'ab✗✗cd';
    function make_font_tb(missing_family) {
        return {
            fontloader: {
                get_default_font: () => ({ familyName: 'Def', typeStyle: 'Regular' }),
                getSync: (fam) => fam === missing_family ? undefined : { hasChar: (ch) => ch !== '✗' },
            },
            text_core: { toRawString: (b, e) => TEXT.slice(b, e) },
            seg_mgr: { extract_styles_except_par_layer(styles) { styles.push({ pos: 0, familyName: 'A', typeStyle: 'R' }, { pos: 6 }); } },
        };
    }
    it('tofu 구간을 기본 폰트로 감싸고 원래 스타일로 복귀한다', () => {
        const s = new TB_TofuService(make_font_tb(null));
        const styles = [{ pos: 0, familyName: 'A', typeStyle: 'R' }, { pos: 6 }];
        expect(s.adjust_styles_for_no_matching_glyph(styles)).toEqual([
            { pos: 0, familyName: 'A', typeStyle: 'R' },
            { pos: 2, familyName: 'Def', typeStyle: 'Regular' },
            { pos: 4, familyName: 'A', typeStyle: 'R' },
            { pos: 6 },
        ]);
        expect(s.default_font_used).toBe(true);
        s.clear_default_font_used_flag();
        expect(s.default_font_used).toBe(false);
    });
    it('tofu가 없으면 같은 배열을 그대로 돌려준다', () => {
        const s = new TB_TofuService(make_font_tb(null));
        const tb = s.tb;
        tb.text_core.toRawString = () => 'abcd';
        const styles = [{ pos: 0, familyName: 'A', typeStyle: 'R' }, { pos: 4 }];
        expect(s.adjust_styles_for_no_matching_glyph(styles)).toBe(styles);
    });
    it('폰트를 못 찾으면 전체가 tofu', () => {
        const s = new TB_TofuService(make_font_tb('A'));
        expect(s.adjust_styles_for_no_matching_glyph([{ pos: 0, familyName: 'A', typeStyle: 'R' }, { pos: 6 }])).toMatchSnapshot();
    });
    it('TB_StyleService.get_styles는 seg_mgr 스타일을 tofu 보정해서 돌려준다', () => {
        const svc = new TB_StyleService(make_font_tb(null));
        expect(svc.get_styles({ begin: 0, end: 6 }).length).toBe(4);
        svc.update_default_font_state();
        expect(svc.tofuService.default_font).toEqual({ familyName: 'Def', typeStyle: 'Regular' });
    });
});

describe('TB_FormatService', () => {
    function make_fmt_tb() {
        const calls = [];
        return {
            calls,
            text_core: { toRawString: (b, e) => 'abcdefghi'.slice(b, e) },
            m_NamedRange: { _get_vec: () => [{ var_name: '_na_', m_nCount: 3 }, { var_name: 'x', title: 'X', m_nCount: 4 }, { var_name: '_na_', m_nCount: 2 }] },
            m_FSizeLayer: { _get_vec: () => [{ FontSize: 10, m_nCount: 2 }, { FontSize: 30, m_nCount: 3 }, { FontSize: 40, m_nCount: 1 }, { FontSize: 5, m_nCount: 2 }] },
            m_FontColor: { _get_vec: () => [{ fontColor: '#f00', m_nCount: 2 }, { fontColor: '#0f0', m_nCount: 3 }, { fontColor: '#f00', m_nCount: 1 }] },
            opStyle: {
                set_font_size: (...a) => calls.push(['set_font_size', ...a]),
                set_fontColor: (...a) => calls.push(['set_fontColor', ...a]),
            },
            opEdit: {
                erase: (...a) => calls.push(['erase', ...a]),
                insert_string: (...a) => calls.push(['insert_string', ...a]),
            },
        };
    }
    it('_calc_shrink_ratio', () => {
        const f = new TB_FormatService(make_fmt_tb());
        expect(f._calc_shrink_ratio({ lines: [{ content_width: 100, core_width: 90, line_width: 120 }, { content_width: 60, core_width: 50, line_width: 120 }] })).toBe(80);
    });
    it('named range 조회/치환', () => {
        const tb = make_fmt_tb();
        const f = new TB_FormatService(tb);
        expect(f._get_range_by_id('x')).toEqual({ begin: 3, end: 7 });
        expect(f._get_range_by_id('nope')).toEqual({ begin: 9, end: 9 });
        expect(f.get_array_of_ranges()).toEqual([{ var_name: 'x', title: 'X', range: { begin: 3, end: 7 } }]);
        expect(f.get_text_by_range_id('x')).toEqual({ range: { begin: 3, end: 7 }, text: 'defg' });
        expect(f.get_text_by_range_id('nope')).toBeUndefined();
        f.replace_text_with_range_id('x', 'T');
        expect(tb.calls).toEqual([['erase', 3, 3, 7], ['insert_string', 3, 'T']]);
    });
    it('clamp_font_size: 초과 구간을 병합해 한 번에 설정', () => {
        const tb = make_fmt_tb();
        new TB_FormatService(tb).clamp_font_size(20);
        expect(tb.calls).toEqual([['set_font_size', 20, { begin: 2, end: 6 }, null, false, { command_auto_play: 'run', skip_post_process: true }]]);
    });
    it('replace_font_color: src 색과 같은 segment마다 set_fontColor', () => {
        const tb = make_fmt_tb();
        new TB_FormatService(tb).replace_font_color([{ src: { fontColor: '#f00' }, dst: { fontColor: '#00f', fontColorCMYK: 'c', fontColorModel: 'm' } }]);
        expect(tb.calls).toEqual([
            ['set_fontColor', '#00f', 'c', 'm', { cursor: 0, begin: 0, end: 2, exists_range: true }, null, false],
            ['set_fontColor', '#00f', 'c', 'm', { cursor: 5, begin: 5, end: 6, exists_range: true }, null, false],
        ]);
    });
});

describe('layout_service', () => {
    it('TB_LayoutAux.get_pars_text_arr: 개행은 공백으로', () => {
        const aux = new TB_LayoutAux(make_tb(), { lineview_arr: [] }, { line_view_selector: '.lv' });
        expect(aux.get_pars_text_arr(0, 2)).toEqual([{ par_text: 'Hi ', ci_doc: 0 }, { par_text: 'Bye', ci_doc: 3 }]);
        expect(aux.get_pars_text_arr(1, 2)).toEqual([{ par_text: 'Bye', ci_doc: 3 }]);
    });
    it('TB_LayoutAux.insert_new_lines / remove_lineview_elements', () => {
        const tbdom = { lineview_arr: [] };
        const aux = new TB_LayoutAux(make_tb(), tbdom, { line_view_selector: '.lv' });
        const container = window.document.createElement('div');
        const temp = window.document.createElement('div');
        temp.innerHTML = '<div class="lv">a</div><div class="lv">b</div><div class="lv">c</div>';
        aux.insert_new_lines(temp, 0, container);
        expect(tbdom.lineview_arr.map(e => e.textContent)).toEqual(['a', 'b', 'c']);
        expect(container.children.length).toBe(3);
        temp.innerHTML = '<div class="lv">x</div>';
        aux.insert_new_lines(temp, 1, container);
        expect(tbdom.lineview_arr.map(e => e.textContent)).toEqual(['a', 'x', 'b', 'c']);
        expect(Array.from(container.children, e => e.textContent)).toEqual(['a', 'x', 'b', 'c']);
        aux.remove_lineview_elements(1, 2);
        expect(tbdom.lineview_arr.map(e => e.textContent)).toEqual(['a', 'b', 'c']);
        expect(container.children.length).toBe(3);
        aux.remove_lineview_elements(1);
        expect(tbdom.lineview_arr.map(e => e.textContent)).toEqual(['a']);
        expect(container.children.length).toBe(1);
    });
    it('TB_LayoutContext.get_text_of_par_end / setup', () => {
        const cx = new TB_LayoutContext(make_tb());
        expect(cx.get_text_of_par_end(0, 1)).toBe('i ');
        expect(cx.get_text_of_par_end(1, 3)).toBe('Bye');
        cx.setup({ par_text: 'Bye', ci_doc: 3 }, 'domPar');
        expect([cx.text, cx.ci_doc_par_text, cx.domPar]).toEqual(['Bye', 3, 'domPar']);
    });
    it('TB_ParChangeInfo / TB_PosTracker', () => {
        const pi = new TB_ParChangeInfo(
            { before: { m_nFirstSegIndex: 1, m_nLastSegIndex: 2 }, after: { m_nFirstSegIndex: 1, m_nLastSegIndex: 3 }, par_length: 3, ci_change_start: 5, ci_change_end: 6 },
            { text_fluctuation: 2 });
        expect(pi).toEqual({ old: { begin: 1, end: 2 }, new: { begin: 1, end: 3 }, par_length: 3, ci_change_start: 5, ci_change_end: 6, text_fluctuation: 2 });
        const pt = new TB_PosTracker();
        pt.li_par = 3; pt.line_char_count = 9; pt.ci_lbegin_par = 4;
        pt.reset_pos_tracker(7);
        expect(pt).toEqual({ par_index: 7, li_par: 0, line_char_count: 0, ci_lbegin_par: 0 });
    });
});
