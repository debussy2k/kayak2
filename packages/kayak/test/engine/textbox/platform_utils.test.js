/*
    A 기반 묶음 특성 테스트: TB_PlatformEnv, TB_Utils, TB_StyleContext, MeasureDiv, TB_HtmlMeasure, TextBoxEnv,
    TB_ExportHtml(generate_html_inline), TB_Preference, TB_Config.
    TS 전환 전 JS에서 통과하는 상태가 기준선이다. 스냅샷은 첫 실행에서 만들어지고 커밋한다.
*/
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { window } from './helpers';
import _g from '../../../src/engine/textbox/TB_PlatformEnv';
import MeasureDiv from '../../../src/engine/textbox/MeasureDiv';
import TB_HtmlMeasure from '../../../src/engine/textbox/TB_HtmlMeasure';
import TB_Utils from '../../../src/engine/textbox/TB_Utils';
import TB_StyleContext from '../../../src/engine/textbox/TB_StyleContext';
import { TextBoxEnv, EmptyRangeRule } from '../../../src/engine/textbox/TextBoxEnv';
import { generate_html_inline } from '../../../src/engine/textbox/TB_ExportHtml';
import { TB_Preference } from '../../../src/engine/textbox/TB_Preference';
import TB_Config from '../../../src/engine/textbox/TB_Config';

describe('TB_PlatformEnv', () => {
    it('set()은 window/document와 호스트 함수를 보관한다', () => {
        expect(_g.window).toBe(window);
        expect(_g.document).toBe(window.document);
        const fn = () => {};
        _g.set({ window, get_font_filepath: fn });
        expect(_g.get_font_filepath).toBe(fn);
        _g.set({ window });
        expect(_g.get_font_filepath).toBeUndefined();
    });
});

describe('TB_Utils', () => {
    it('inRange / isWhiteSpace', () => {
        expect(TB_Utils.inRange(0, 10, -1)).toBe(0);
        expect(TB_Utils.inRange(0, 10, 10)).toBe(9);
        expect(TB_Utils.inRange(0, 10, 5)).toBe(5);
        expect([10, 13, 32, 160].map(TB_Utils.isWhiteSpace)).toEqual([true, true, true, true]);
        expect(TB_Utils.isWhiteSpace(65)).toBe(false);
    });
    it('jsdom(platform "")에서는 mac/iOS가 아니고 브라우저 판정은 고정된 값이다', () => {
        expect(TB_Utils.isMacOS()).toBe(false);
        expect(TB_Utils.iOSSafari()).toBe(false);
        expect(TB_Utils.detectIE()).toBe(false);
        expect(TB_Utils.detect_browser()).toMatchSnapshot();
        expect(TB_Utils.get_browser_info()).toMatchSnapshot();
    });
    it('legacy Edge UA면 detectIE가 버전을 돌려주고 get_browser_info는 ie다', () => {
        const edge = new JSDOM('', { userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/64.0 Safari/537.36 Edge/16.16299' });
        _g.set({ window: edge.window });
        try {
            expect(TB_Utils.detectIE()).toBe(16);
            expect(TB_Utils.get_browser_info()).toEqual({ name: 'ie', version: 16 });
        } finally {
            _g.set({ window });
        }
    });
    it('extractCopiedData: data-kayak-html 추출, 없으면 null, fragment 마커 없으면 빈 div', () => {
        const inner = '&lt;span style=&quot;color:red&quot;&gt;A&lt;/span&gt;';
        const html = `<html><body><!--StartFragment--><div data-kayak-html="${inner}"></div><!--EndFragment--></body></html>`;
        expect(TB_Utils.extractCopiedData(html, { strip_fragment: true })).toBe('<div><span style="color:red">A</span></div>');
        expect(TB_Utils.extractCopiedData(`<div data-kayak-html="${inner}"></div>`)).toBe('<div><span style="color:red">A</span></div>');
        expect(TB_Utils.extractCopiedData('<p>external</p>')).toBeNull();
        expect(TB_Utils.extractCopiedData('<p>no markers</p>', { strip_fragment: true })).toBe('<div></div>');
    });
    it('create_tmp_contentEditable_elem_on_root: body에 숨은 contenteditable div를 붙인다', () => {
        const el = TB_Utils.create_tmp_contentEditable_elem_on_root();
        expect(el.parentNode).toBe(window.document.body);
        expect(el.getAttribute('style')).toContain('height:0px');
        expect(el.contentEditable).toBe(true);
        el.remove();
    });
});

describe('TB_StyleContext', () => {
    it('build_css_str: css_data의 문자열 값 + margin-right, clipboard용이면 -kayak-* 추가', () => {
        const c = new TB_StyleContext();
        c.css_data = { a: 'font-size:12px;', b: { nested: 1 }, c: 'color:red;' };
        c.raw_data = { letter_space: 100, letter_scale_x: 80 };
        expect(c.build_css_str()).toBe('font-size:12px;color:red;margin-right:0.1em;');
        expect(c.build_css_str(true)).toBe('font-size:12px;color:red;margin-right:0.1em;-kayak-letter_space:100;-kayak-letter_scale_x:80;');
        expect(c.has_letter_scale_x()).toBe(true);
        expect(c.need_for_split_to_every_single_span()).toBe(true);
        expect(c.get_transformed_span('X')).toBe("<span style='display:inline-block; transform-origin:0% 0%;transform:scaleX(0.8);'>X</span>");
    });
    it('빈 context: margin-right 0em, letter_space undefined도 split 대상 (원본 동작)', () => {
        const c = new TB_StyleContext();
        expect(c.build_css_str()).toBe('margin-right:0em;');
        expect(c.has_letter_scale_x()).toBe(false);
        expect(c.need_for_split_to_every_single_span()).toBe(true);
        c.raw_data = { letter_space: 0, letter_scale_x: 100 };
        expect(c.need_for_split_to_every_single_span()).toBe(false);
    });
});

describe('MeasureDiv / TB_HtmlMeasure', () => {
    it('MeasureDiv.Instance()는 싱글턴이고 #kayak_metric_box를 하나만 만든다', () => {
        const a = MeasureDiv.Instance();
        const b = MeasureDiv.Instance();
        expect(a).toBe(b);
        expect(window.document.querySelectorAll('#kayak_metric_box').length).toBe(1);
        expect(a.metric_box.id).toBe('kayak_metric_box');
        a.show(true);
        expect(a.metric_box.style.top).toBe('100px');
        a.show(false);
        expect(a.metric_box.style.top).toBe('-1000px');
    });
    it('measure_html_width: 캐시에 있으면 DOM을 건드리지 않고, 없으면 측정해서 put한다', () => {
        const puts = [];
        const cache = { map: {}, get(k) { return this.map[k]; }, put(k, v) { this.map[k] = v; puts.push([k, v]); } };
        cache.map['<span>cached</span>'] = 42;
        expect(TB_HtmlMeasure.measure_html_width('<span>cached</span>', { WordCache: cache })).toBe(42);
        expect(puts).toEqual([]);
        const w = TB_HtmlMeasure.measure_html_width('<span>new</span>', { WordCache: cache });
        expect(typeof w).toBe('number');   // jsdom은 레이아웃이 없어 0이다
        expect(puts).toEqual([['<span>new</span>', w]]);
        expect(MeasureDiv.Instance().metric_box.innerHTML).toBe('<span>new</span>');
    });
    it('measure_html_dimension: jsdom에서는 전부 0 (모양만 고정)', () => {
        expect(TB_HtmlMeasure.measure_html_dimension('<span>a</span><span>b</span>')).toMatchSnapshot();
    });
});

describe('TextBoxEnv', () => {
    it('기본 empty_range_rule은 SELECT_ALL', () => {
        expect(EmptyRangeRule).toEqual({ DEFAULT: 'default', SELECT_ALL: 'select_all' });
        expect(new TextBoxEnv(null).empty_range_rule).toBe('select_all');
    });
});

describe('TB_ExportHtml.generate_html_inline', () => {
    function make_tb(raw) {
        return {
            tbcontext: { WordCache: { get: () => 7, put() {} } },
            seg_mgr: {
                get_span_style_string(style, context, options) {
                    context.raw_data = Object.assign({ letter_space: 0, letter_scale_x: 100 }, raw);
                    return 'color:red;';
                },
            },
            text_core: {
                m_text: [65, 66, 67],
                toHtmlString: (from, to) => String.fromCharCode(...[65, 66, 67].slice(from, to)),
                toHtmlCharEntity: (code) => '&#' + code + ';',
            },
        };
    }
    it('clipboard export: span 하나', () => {
        expect(generate_html_inline(make_tb({}), 0, 2, { pos: 0 }, new TB_StyleContext(), { for_clipbaord_export: true })).toBe('<span style="color:red;">AB</span>');
    });
    it('일반: 장평이 있으면 글자마다 transform span + padding', () => {
        expect(generate_html_inline(make_tb({ letter_scale_x: 120 }), 0, 2, { pos: 0 }, new TB_StyleContext(), {})).toMatchSnapshot();
    });
    it('일반: 자간이 있으면 글자마다 span', () => {
        expect(generate_html_inline(make_tb({ letter_space: 50 }), 0, 3, { pos: 0 }, new TB_StyleContext(), {})).toMatchSnapshot();
    });
    it('일반: 자간/장평 없으면 span 하나', () => {
        expect(generate_html_inline(make_tb({}), 1, 3, { pos: 1 }, new TB_StyleContext(), {})).toBe('<span style="color:red;">BC</span>');
    });
});

describe('TB_Preference', () => {
    function make_tb(pars) {
        const content_elem = window.document.createElement('div');
        const element = window.document.createElement('div');
        return {
            layout: { get_tbdom: () => ({ pars }) },
            tbconfig: { page: { gutter_top: 5, gutter_bottom: 5 }, content_elem, element },
            get_dimension: () => ({ visible_content_height: 50 }),
            tbcursor: { repaint() { this.repaints = (this.repaints || 0) + 1; } },
        };
    }
    it('기본값과 save()', () => {
        const p = new TB_Preference(make_tb([]));
        expect(p.save()).toEqual({ single_line_mode: false, fit_to_line_width_by_scale_x: false, first_line_baseline_offset: 'ascent', fit_to_content_height: true, vertical_justification: 'top', frame_height: 100 });
        expect(p.computed_values).toEqual({ embox_height_offset_px: 0, valign_padding_top: 0, valign_padding_bottom: 0, first_line_heading_space: 0, first_line_excluded_heading_space: 0 });
    });
    it('get_first_line_baseline_offset_value_px: ascent 모드만 음수 offset', () => {
        const p = new TB_Preference(make_tb([]));
        expect(p.get_first_line_baseline_offset_value_px({ max_word_ascent: 10, max_word_ascent_d: 4 })).toBe(-6);
        p.first_line_baseline_offset = 'embox';
        expect(p.get_first_line_baseline_offset_value_px({ max_word_ascent: 10, max_word_ascent_d: 4 })).toBe(0);
    });
    it('set_single_line_mode: 문단이 하나일 때만 된다', () => {
        expect(new TB_Preference(make_tb([1, 2])).set_single_line_mode(true)).toBe(false);
        const p = new TB_Preference(make_tb([1]));
        expect(p.set_single_line_mode(true)).toBe(true);
        expect(p.single_line_mode).toBe(true);
        p.set_fit_to_line_width_by_scale_x(true);
        expect(p.fit_to_line_width_by_scale_x).toBe(true);
    });
    it('고정 높이에서 vertical_justification에 따라 content padding을 나눈다', () => {
        const tb = make_tb([]);
        const p = new TB_Preference(tb);
        p.set_fit_to_content_height(false);   // get_content_height() = 50 + 10 → set_height(60)
        expect(p.frame_height).toBe(60);
        expect(tb.tbconfig.element.style.height).toBe('60px');
        p.set_height(100);
        p.set_vertical_justification('center');
        expect([p.computed_values.valign_padding_top, p.computed_values.valign_padding_bottom]).toEqual([20, 20]);
        expect([tb.tbconfig.content_elem.style.paddingTop, tb.tbconfig.content_elem.style.paddingBottom]).toEqual(['20px', '20px']);
        p.set_vertical_justification('bottom');
        expect([p.computed_values.valign_padding_top, p.computed_values.valign_padding_bottom]).toEqual([40, 0]);
        p.set_vertical_justification('top');
        expect([p.computed_values.valign_padding_top, p.computed_values.valign_padding_bottom]).toEqual([0, 40]);
        expect(tb.tbcursor.repaints).toBeGreaterThan(0);
        p.set_fit_to_content_height(true);
        expect(tb.tbconfig.element.style.height).toBe('auto');
        expect(tb.tbconfig.content_elem.style.paddingTop).toBe('0px');
    });
});

describe('TB_Config', () => {
    const pref = { fit_to_content_height: true, frame_height: 100 };
    it('schema 모드: font_list_id만 받고 DOM/debug/메서드용 필드는 만들지 않는다', () => {
        const cfg = new TB_Config({ schema: true, font_list_id: 'x', base_node: window.document.createElement('div') }, pref);
        expect(cfg.font_list_id).toBe('x');
        expect(cfg.element).toBeNull();
        expect(cfg.base_node).toBeNull();     // Object.assign 전에 return
        // own property 자체가 없어야 한다. (값이 undefined인 own property는 useDefineForClassFields:true가 만드는 것이라 실패해야 한다.)
        for (const k of ['debug', 'content_elem', 'lineview_container_elem'])
            expect(Object.prototype.hasOwnProperty.call(cfg, k)).toBe(false);
    });
    it('일반 모드: DOM 골격, 크기 계산, debug 병합', () => {
        const base = window.document.createElement('div');
        const cfg = new TB_Config({
            base_node: base,
            page: { width: 300, height: 300, gutter_top: 0, gutter_bottom: 0, scale: 1 },
            content: { width: 300 },
            font_list_id: 'default-host-ko',
            debug: { show_linebox: true },
        }, pref);
        expect(cfg.debug).toEqual({ show_linebox: true, show_textonpath_bbox: false, show_line_gutter: false });
        expect(cfg.content.default_font_size).toBeUndefined();   // options.content가 기본값 객체를 통째로 덮는다 (원본 동작)
        expect(cfg.computed_page_gutter_left).toBe(0);
        expect(base.innerHTML).toMatchSnapshot();
        cfg.update_size({ content: { width: 100 }, page: { width: 200 } });
        expect([cfg.computed_page_gutter_left, cfg.computed_page_gutter_right]).toEqual([50, 50]);
        expect(cfg.element.style.width).toBe('200px');
        expect(cfg.content_elem.style.marginLeft).toBe('50px');
        cfg.update_size({ content: { width: 0 }, page: { width: 0 } });
        expect([cfg.content.width, cfg.page.width]).toEqual([1, 1]);
    });
    it('build_dom_textonpath: kayak-root를 숨기고 .kayak-textonpath를 붙인다 (두 번 불러도 하나)', () => {
        const base = window.document.createElement('div');
        const cfg = new TB_Config({ base_node: base, page: { width: 100, height: 100, gutter_top: 0, gutter_bottom: 0, scale: 1 }, content: { width: 100 } }, pref);
        cfg.build_dom_textonpath();
        cfg.build_dom_textonpath();
        expect(base.querySelectorAll('.kayak-textonpath').length).toBe(1);
        expect(cfg.element.style.opacity).toBe('0');
        expect(cfg.element_textonpath.className).toBe('kayak-textonpath');
        // jsdom 11(cssstyle 0.2)은 pointer-events/outline 같은 속성을 저장하지 않을 수 있다. 값이 무엇이든 스냅샷으로 고정한다.
        expect(cfg.element_textonpath.getAttribute('style')).toMatchSnapshot();
        cfg.debug.show_textonpath_bbox = true;
        cfg.build_dom_textonpath();
        expect(cfg.element_textonpath.getAttribute('style')).toMatchSnapshot();
    });
});
