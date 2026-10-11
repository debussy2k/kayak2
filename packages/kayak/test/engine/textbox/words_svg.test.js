/*
    E/F 묶음 특성 테스트: TB_WordFinder/TB_WordFetch/TB_WordInfo(가짜 docFactory), TB_LineComposer(순수 메서드),
    TB_SvgTextRender/TB_SvgDimension/TB_SvgLineFactory(실제 폰트), TB_SvgGradientFactory, TB_DocFactory(가짜 tb),
    TB_ApplyEditOperation(기록용 가짜 opStyle/opEdit).
*/
import { describe, it, expect } from 'vitest';
import { window, round, load_test_font } from './helpers';
import { recorder } from './dom_events';
import { TB_WordFinder } from '../../../src/engine/textbox/TB_WordFinder';
import { TB_WordFetch, TB_WordFetchParams } from '../../../src/engine/textbox/TB_WordFetch';
import { TB_WordInfo } from '../../../src/engine/textbox/TB_WordInfo';
import { TB_LineComposer } from '../../../src/engine/textbox/TB_LineComposer';
import { TB_SvgTextRender } from '../../../src/engine/textbox/TB_SvgTextRender';
import { TB_SvgDimension } from '../../../src/engine/textbox/TB_SvgDimension';
import { TB_SvgLineFactory } from '../../../src/engine/textbox/TB_SvgLineFactory';
import { TB_SvgGradientFactory } from '../../../src/engine/textbox/TB_SvgGradientFactory';
import { TB_DocFactory } from '../../../src/engine/textbox/TB_DocFactory';
import { TB_ApplyEditOperation } from '../../../src/engine/textbox/TB_ApplyEditOperation';

const font = load_test_font();
const STYLE = { FontSize: 12, letter_space: 0, letter_scale_x: 100, kerning: true, ligature: true };

describe('TB_WordFinder / TB_WordFetch (글자 폭 10px, 공백 5px인 가짜 측정)', () => {
    function make_params(text, tolerance = 0) {
        const tb = {
            tbcontext: {},
            tbconfig: { linebreak_tolerance: tolerance },
            docFactory: {
                get_dimension_of_range(rng) {
                    let w = 0;
                    for (let i = rng.begin; i < rng.end; i++) w += (text[i] === ' ' || text[i] === '\n') ? 5 : 10;
                    return { width: w, width_without_last_glyph_ws: w, last_glyph_white_space: 0, height: 12, ascent: 9, ascent_d: 8, descent: 3, max_font_size_px: 16 };
                },
            },
        };
        return new TB_WordFetchParams(tb, text, 0, { m_Align: 'left' });
    }
    const brief = wi => [wi.begin, wi.end, wi.text, wi.whiteSpace, wi.tab, wi.eol, wi.last_none_ws_word];

    it('scanWordInfo: 단어 / 공백 연속 / 탭 / 끝', () => {
        const p = make_params('hello  wo\trld');
        expect(brief(TB_WordFinder.scanWordInfo(p, 0))).toEqual([0, 5, 'hello', false, false, false, false]);
        expect(brief(TB_WordFinder.scanWordInfo(p, 5))).toEqual([5, 7, '  ', true, false, false, false]);
        // 탭은 단어 시작에서만 구분자다 (isWhiteSpace는 공백/개행만). 단어 안의 탭은 단어에 포함된다.
        expect(brief(TB_WordFinder.scanWordInfo(p, 7))).toEqual([7, 13, 'wo\trld', false, false, true, true]);
        expect(brief(TB_WordFinder.scanWordInfo(make_params('a\tb'), 1))).toEqual([1, 2, '\t', false, true, false, false]);
        expect(TB_WordFinder.scanWordInfo(p, 0).getCount()).toBe(5);
        expect(TB_WordFinder.scanWordInfo(p, 0).ci_base).toBe(0);
    });
    it('findWord: 글줄 폭보다 긴 단어는 들어가는 만큼 자른다 (shrink), 짧으면 그대로', () => {
        const p = make_params('abcdefghijklmnop');
        expect(brief(TB_WordFinder.findWord(p, 1000, 0)).slice(0, 3)).toEqual([0, 16, 'abcdefghijklmnop']);
        const wi = TB_WordFinder.findWord(p, 55, 0);
        expect([wi.begin, wi.end, wi.text, wi.__loop_cost]).toMatchSnapshot();
        expect(wi.dimension.width_without_last_glyph_ws).toBeLessThan(55);
        // 한 글자도 안 들어가면 한 글자
        expect(brief(TB_WordFinder.findWord(p, 5, 0)).slice(0, 2)).toEqual([0, 1]);
    });
    it('findWord: maxWordSize(24)보다 긴 단어는 24자에서 끊고 늘려 본다 (stretch)', () => {
        const long = 'x'.repeat(30) + ' y';
        const p = make_params(long);
        const wi = TB_WordFinder.findWord(p, 1000, 0);
        expect([wi.begin, wi.end, wi.eol, wi.__loop_cost]).toMatchSnapshot();
        const wi2 = TB_WordFinder.findWord(p, 265, 0);
        expect([wi2.begin, wi2.end, wi2.__loop_cost]).toMatchSnapshot();
    });
    it('get_words_contained_in_par_by_textlines: 글줄 나누기와 linebreak_tolerance', () => {
        const lines = TB_WordFetch.get_words_contained_in_par_by_textlines(make_params('aa bb cc dd'), 55);
        expect(lines.map(words => words.map(w => w.text))).toEqual([['aa', ' ', 'bb', ' '], ['cc', ' ', 'dd']]);
        // 마지막 단어 'dd'(20)는 50+20=70 ≥ 70이면 넘어가지만 tolerance 1로 한 줄에 들어간다
        const lines2 = TB_WordFetch.get_words_contained_in_par_by_textlines(make_params('aa bb dd', 1), 70);
        expect(lines2.map(words => words.map(w => w.text))).toEqual([['aa', ' ', 'bb', ' ', 'dd']]);
        const lines3 = TB_WordFetch.get_words_contained_in_par_by_textlines(make_params('aa bb dd', 0), 70);
        expect(lines3.map(words => words.map(w => w.text))).toEqual([['aa', ' ', 'bb', ' '], ['dd']]);
    });
    it('build_word', () => {
        const wi = TB_WordFinder.scanWordInfo(make_params('ab '), 2);
        expect(TB_WordFetch.build_word(wi)).toEqual({ text: ' ', width: 5, last_glyph_white_space: 0, height: 12, ascent: 9, ascent_d: 8, descent: 3, max_font_size_px: 16, whiteSpace: true });
    });
    it('TB_WordInfo 초기값과 isLastNonWhiteSpaceWord', () => {
        const wi = new TB_WordInfo();
        expect([wi.whiteSpace, wi.tab, wi.ci_base, wi.begin, wi.end, wi.eol, wi.last_none_ws_word, wi.text, wi.dimension]).toEqual([false, false, 0, 0, -1, false, false, '', null]);
        wi.end = 2;
        expect([wi.isLastNonWhiteSpaceWord('ab  \n'), wi.isLastNonWhiteSpaceWord('ab c')]).toEqual([true, false]);
    });
});

describe('TB_LineComposer (순수 메서드)', () => {
    const lc = new TB_LineComposer({ docFactory: 'df' }, 'tbdom');
    it('get_lineWidth: 첫 줄만 첫줄 들여쓰기', () => {
        const attr = { m_Lindent: 10, m_Rindent: 5, m_Findent: 20 };
        expect(lc.get_lineWidth({ li_par: 0 }, 300, attr)).toBe(265);
        expect(lc.get_lineWidth({ li_par: 1 }, 300, attr)).toBe(285);
    });
    it('get_jstf_balance_info: 정렬과 마지막 줄', () => {
        const wi = [{ whiteSpace: false, dimension: { style_keys: { k: { width: 10, count: 2 } }, last_style_key: 'k', last_glyph_width: 4, last_glyph_white_space: 1 } }];
        expect(lc.get_jstf_balance_info({ m_Align: 'left' }, false, wi)).toBeNull();
        expect(lc.get_jstf_balance_info({ m_Align: 'fully-justified' }, true, wi)).toEqual({ k: { width: 5, count: 1, balance_space_ratio: 1 } });
        expect(lc.get_jstf_balance_info({ m_Align: 'right-justified' }, true, wi)).toBeNull();
        expect(lc.get_jstf_balance_info({ m_Align: 'right-justified' }, false, wi)).not.toBeNull();
    });
    it('prepare_for_next_line: callback이 true면 멈추고, 아니면 다음 줄 위치로', () => {
        const pt = { li_par: 0, ci_lbegin_par: 0, line_char_count: 7 };
        const metric = { ci_lbegin_doc: 100, lineWidth: 0 };
        const attr = { m_Lindent: 0, m_Rindent: 0, m_Findent: 30 };
        const lc2 = new TB_LineComposer({ docFactory: null, tbconfig: { content: { width: 200 } } }, null);
        expect(lc2.prepare_for_next_line(attr, 'cx', pt, metric, () => true)).toBe(true);
        expect(lc2.prepare_for_next_line(attr, 'cx', pt, metric, () => false)).toBe(false);
        expect([pt.li_par, pt.ci_lbegin_par, pt.line_char_count, metric.ci_lbegin_doc, metric.lineWidth]).toEqual([1, 7, 0, 107, 200]);
    });
});

describe('TB_SvgTextRender (실제 폰트)', () => {
    const r = new TB_SvgTextRender();
    it('getGlyphsDimension: 기본, 자간/장평, 정렬 key', () => {
        expect(round(r.getGlyphsDimension('Hello 가나', { x: 0, y: 0 }, STYLE, { font }))).toMatchSnapshot();
        expect(round(r.getGlyphsDimension('Hi', { x: 0, y: 0 }, Object.assign({}, STYLE, { letter_space: 100, letter_scale_x: 80 }), { font }))).toMatchSnapshot();
        expect(r.getGlyphsDimension('Hi', { x: 0, y: 0 }, STYLE, { font, align: 'fully-justified' }).key).toBe('fS:12;ls:0;sx:100');
        expect(r.getGlyphsDimension('Hi', { x: 0, y: 0 }, STYLE, { font, align: 'left' }).key).toBeNull();
    });
    it('getGlyphsDimension: 글리프 없는 문자는 공백으로, FontSize 없으면 throw', () => {
        const a = r.getGlyphsDimension('a✗b', { x: 0, y: 0 }, STYLE, { font });
        const b = r.getGlyphsDimension('a b', { x: 0, y: 0 }, STYLE, { font });
        expect(round(a.width)).toBe(round(b.width));
        expect(() => r.getGlyphsDimension('x', { x: 0, y: 0 }, {}, { font })).toThrow();
    });
    it('justification space: domLine.jstf_balance_info가 있으면 마지막 core 글자 전까지 더한다', () => {
        const domLine = { jstf_balance_info: { 'fS:12;ls:0;sx:100': { width: 1, count: 1, balance_space_ratio: 0.5 } }, line_width: 100, core_width: 60, trailing_ws_count: 0 };
        const plain = r.getGlyphsDimension('Hi', { x: 0, y: 0 }, STYLE, { font });
        const jstf = r.getGlyphsDimension('Hi', { x: 0, y: 0 }, STYLE, { font, domLine, textRng: { begin: 0, end: 2, ci_lbegin_doc: 0, ci_lend_doc: 2 } });
        expect(round(jstf.width - plain.width)).toBe(20);   // (100-60)*0.5, 첫 글리프에만
    });
    it('getSvgPathGlyphs: path data와 text-on-path용 glyph_arr', () => {
        const res = r.getSvgPathGlyphs('Hi', { x: 0, y: 10 }, STYLE, { font });
        expect(res.glyphs_path.toPathData(2)).toMatchSnapshot();
        expect([res.glyph_arr, round(res.width_px), round(res.last_glyph_white_space)]).toMatchSnapshot();
        const res2 = r.getSvgPathGlyphs('Hi', { x: 0, y: 10 }, STYLE, { font, text_on_path: true });
        expect(res2.glyph_arr.length).toBe(2);
        expect(round(res2.glyph_arr.map(g => ({ gx: g.gx, gy: g.gy, glyph_width: g.glyph_width, ascender: g.ascender, descender: g.descender, fontColor: g.fontColor, fontColorCMYK: g.fontColorCMYK })))).toMatchSnapshot();
        expect(res2.glyph_arr[0].glyphPath.toPathData(2)).toMatchSnapshot();
    });
    it('_getGlyphs: 정렬이 justified이거나 letter_space>20이면 합자 off (glyph 수로 확인)', () => {
        const n = r._getGlyphs('fi', STYLE, { font }).length;
        expect(n).toBe(r._getGlyphs('fi', Object.assign({}, STYLE, { letter_space: 30 }), { font }).length);   // KoPub에는 fi 합자가 없어 둘 다 2
        expect(r._getGlyphs('fi', STYLE, { font, align: 'fully-justified' }).length).toBe(2);
    });
});

describe('TB_SvgGradientFactory', () => {
    it('calc_adjusted_geom / angle_attr_val', () => {
        expect(TB_SvgGradientFactory.calc_adjusted_geom({ x1: '0%', y1: '50%', x2: '100%', y2: '50%' }, 200, 100, -10, -20)).toEqual({ x1: -10, x2: 190, y1: 30, y2: 30 });
        expect(TB_SvgGradientFactory.angle_attr_val(45, { page_width: 200, page_height: 100 }, -10, -20)).toBe('translate(90 30) rotate(45) translate(-90 -30)');
        expect(TB_SvgGradientFactory.angle_attr_val(undefined, { page_width: 200, page_height: 100 }, 0, 0)).toBe('translate(100 50) rotate(0) translate(-100 -50)');
    });
    it('build_gradient_defs: linear만, 필터 후 index로 id', () => {
        const data = { x: 10, y: 20, line: { uuid: 'u', svg_paths: [
            { d: '', fill: '#000' },
            { d: '', gradient: { type: 'linear', geom: { x1: '0%', y1: '0%', x2: '100%', y2: '0%' }, stops: [{ offset: '0%', rgb: '#f00' }, { offset: '100%', rgb: '#00f' }], angle: 90 } },
            { d: '', gradient: { type: 'radial' } },
        ] } };
        expect(TB_SvgGradientFactory.build_gradient_defs(data, { page_width: 200, page_height: 100 })).toMatchSnapshot();
        expect(TB_SvgGradientFactory.build_gradient_defs({ x: 0, y: 0, line: { uuid: 'u', svg_paths: [] } }, { page_width: 1, page_height: 1 })).toBe('');
    });
});

describe('TB_SvgDimension / TB_SvgLineFactory (실제 폰트, 가짜 styleService)', () => {
    const TEXT = 'Hello 가나';
    const styles = () => [
        { pos: 0, familyName: 'F', typeStyle: 'R', FontSize: 12, letter_space: 0, letter_scale_x: 100, fontColor: '#000000', fontColorCMYK: '0,0,0,100', fontColorModel: null, shadow: null, stroke: null, gradient: null },
        { pos: 5, FontSize: 18, fontColor: '#ff0000' },
        { pos: 8 },
    ];
    function make_tb(text_on_path) {
        return { text_core: { toRawString: (b, e) => TEXT.slice(b, e) }, fontloader: { getSync: () => font }, tbconfig: { debug: { show_linebox: false } }, text_on_path };
    }
    const styleSvc = { get_styles: () => styles() };
    const pick = m => ({ width: m.width, width_without_last_glyph_ws: m.width_without_last_glyph_ws, last_style_key: m.last_style_key, last_glyph_width: m.last_glyph_width, height: m.height, ascent: m.ascent, ascent_d: m.ascent_d, descent: m.descent, max_font_size_px: m.max_font_size_px, style_keys: m.style_keys });
    it('get_dimension_of_text_range: 스타일 구간마다 폰트 크기가 누적된다 (Object.assign)', () => {
        const d = new TB_SvgDimension(make_tb(null), new TB_SvgTextRender(), styleSvc);
        expect(round(pick(d.get_dimension_of_text_range({ begin: 0, end: 8, ci_lbegin_doc: 0, ci_lend_doc: 8 }, 'left', null)))).toMatchSnapshot();
        expect(round(pick(d.get_dimension_of_text_range({ begin: 0, end: 8, ci_lbegin_doc: 0, ci_lend_doc: 8 }, 'fully-justified', null)).style_keys)).toMatchSnapshot();
    });
    it('폰트를 못 찾으면 빈 metric', () => {
        const tb = make_tb(null); tb.fontloader.getSync = () => undefined;
        const m = new TB_SvgDimension(tb, new TB_SvgTextRender(), styleSvc).get_dimension_of_text_range({ begin: 0, end: 8 }, 'left', null);
        expect([m.width, m.max_font_size_px, m.height]).toEqual([0, 0, 0]);
    });
    it('calc_max_metrics / text_to_svg_paths / get_svg_textline', () => {
        const f = new TB_SvgLineFactory(make_tb(null), new TB_SvgTextRender(), styleSvc);
        expect(round(f.calc_max_metrics(styles()))).toMatchSnapshot();
        const paths = f.text_to_svg_paths({ begin: 0, end: 8 }, { uuid: 'u1' }, null);
        expect(paths.svg_paths.map(p => [p.fill, p.fill_cmyk, p.color_model, p.shadow, p.stroke, p.gradient])).toEqual([['#000000', '0,0,0,100', null, null, null, null], ['#ff0000', '0,0,0,100', null, null, null, null]]);
        expect(paths.svg_glyph_arr).toEqual([]);
        expect(round(paths.width)).toMatchSnapshot();
        const line = f.get_svg_textline({ begin: 0, end: 8 }, { uuid: 'u1' }, null);
        expect(line.line_content).toMatchSnapshot();
        expect(line.svg_paths.length).toBe(2);
    });
    it('text_on_path면 glyph_arr에 색이 붙고, show_linebox면 outline', () => {
        const tb = make_tb({}); tb.tbconfig.debug.show_linebox = true;
        const f = new TB_SvgLineFactory(tb, new TB_SvgTextRender(), styleSvc);
        const line = f.get_svg_textline({ begin: 0, end: 8 }, { uuid: 'u1' }, null);
        expect(line.svg_glyph_arr.length).toBe(8);
        expect(line.svg_glyph_arr.map(g => [g.fontColor, g.fontColorCMYK, g.fontColorModel]).slice(4, 6)).toEqual([['#000000', '0,0,0,100', null], ['#ff0000', '0,0,0,100', null]]);
        expect(line.line_content).toContain("style='outline:1px solid #ffc65b77'");
    });
});

describe('TB_DocFactory (가짜 tb)', () => {
    function make_tb(par_attr, extra) {
        return Object.assign({
            fontloader: { get_default_font: () => ({ familyName: 'F', typeStyle: 'R' }), getSync: () => font },
            m_Par: { getAttr_by_pi: () => par_attr },
            tbconfig: { text_render: 'svg', debug: { show_line_gutter: false } },
            text_core: { toRawString: (b, e) => 'Hello 가나'.slice(b, e) },
            seg_mgr: { extract_styles_except_par_layer(styles) { styles.push({ pos: 0, familyName: 'F', typeStyle: 'R', FontSize: 12, letter_space: 0, letter_scale_x: 100, fontColor: '#000000' }, { pos: 8 }); } },
        }, extra);
    }
    const ATTR = { m_Align: 'left', m_Lindent: 10, m_Rindent: 0, m_Findent: 20, m_SpaceBefore: 3, m_SpaceAfter: 4, m_Leading: 'auto', m_LineSpace: 1.5 };
    it('create_line_view_obj: lineview > gutter, linespace-top, line', () => {
        const df = new TB_DocFactory(make_tb(ATTR));
        const o = df.create_line_view_obj();
        expect(o.line_view.outerHTML).toBe('<div class="kayak-lineview"><div class="kayak-gutter-wrapper"></div><div class="kayak-linespace-top"></div><div class="kayak-line" style="padding-left:0px;"></div></div>');
        expect([df.line_view_selector, df.line_selector, df.gutter_wrapper_selector]).toEqual(['.kayak-lineview', '.kayak-line', '.kayak-gutter-wrapper']);
    });
    it('calc_offset_left: 정렬별, 첫 줄 들여쓰기, 음수는 0', () => {
        const df = new TB_DocFactory(make_tb(ATTR));
        const metric = { lineWidth: 100, is_last_line: false };
        const rows = [];
        for (const align of ['left', 'center', 'right', 'left-justified', 'center-justified', 'right-justified', 'fully-justified'])
            for (const last of [false, true])
                for (const li_par of [0, 1])
                    rows.push([align, last, li_par, df.calc_offset_left({ li_par }, Object.assign({}, metric, { is_last_line: last }), Object.assign({}, ATTR, { m_Align: align }), 40)]);
        expect(rows).toMatchSnapshot();
        expect(df.calc_offset_left({ li_par: 0 }, metric, Object.assign({}, ATTR, { m_Align: 'right', m_Lindent: -200 }), 40)).toBe(0);
    });
    it('set_line_height_by_leading: auto / fixed(마지막 줄은 글자 높이)', () => {
        const df = new TB_DocFactory(make_tb(ATTR));
        const auto = {}; df.set_line_height_by_leading(auto, { max_height: 20, is_last_line_on_doc: false }, ATTR);
        expect(auto).toEqual({ line_height_base: 20, leading: 'auto', line_body_height: 20, line_height: 30, line_holder_height: 20, dom_line_height: 20 });
        const fixed = {}; df.set_line_height_by_leading(fixed, { max_height: 20, is_last_line_on_doc: false }, Object.assign({}, ATTR, { m_Leading: 24 }));
        expect(fixed).toEqual({ line_height_base: 20, leading: 'fixed', line_height: 32, line_body_height: 32, line_holder_height: 32, dom_line_height: 32 });
        const fixed_last = {}; df.set_line_height_by_leading(fixed_last, { max_height: 20, is_last_line_on_doc: true }, Object.assign({}, ATTR, { m_Leading: 24 }));
        expect(fixed_last.dom_line_height).toBe(20);
    });
    it('populate_data_on_domLine', () => {
        const df = new TB_DocFactory(make_tb(ATTR));
        const metric = { content_width: 80, last_glyph_white_space: 2, trailing_ws_px: 8, lineWidth: 200, is_last_line: true, max_height: 20, max_font_size_px: 16, max_ascent: 15, max_ascent_d: 11, max_descent: 5, trailing_ws_count: 2 };
        const domLine = {};
        df.populate_data_on_domLine({ par_index: 0, li_par: 0 }, metric, domLine);
        expect(domLine).toMatchSnapshot();
        const domLine2 = {};
        df.populate_data_on_domLine({ par_index: 0, li_par: 1 }, Object.assign({}, metric, { is_last_line: false }), domLine2);
        expect([domLine2.space_before, domLine2.space_after, domLine2.offset_left]).toEqual([undefined, undefined, 10]);
    });
    it('build_lineview + on_line_completed: svg가 line에 들어가고 css가 설정된다', () => {
        const tb = make_tb(ATTR, { text_on_path: undefined });
        tb.tbconfig.debug.show_line_gutter = true;
        const df = new TB_DocFactory(tb);
        const o = df.create_line_view_obj();
        const domLine = { uuid: 'u1', line_height: 30, line_body_height: 20, space_after: 4, space_before: 3, dom_line_height: 20, offset_left: 10, jstf_balance_info: null, trailing_ws_count: 0 };
        df.build_lineview(o, domLine, { begin: 0, end: 8, ci_lbegin_doc: 0, ci_lend_doc: 8 }, { is_first_line_on_doc: true, is_last_line_on_doc: true });
        expect(domLine.svg_paths.length).toBe(1);
        expect(domLine.svg_glyph_arr).toEqual([]);
        // jsdom 11은 SVG element의 class 선택자를 못 찾으므로 태그로 찾고 class 속성을 본다.
        expect(o.line.querySelector('svg').getAttribute('class')).toBe('kayak-svg-line');
        expect([o.line.style.height, o.line.style.paddingLeft, o.line.style.marginBottom, o.linespace_top.style.height, o.line_view.style.boxSizing]).toEqual(['20px', '10px', '14px', '3px', 'content-box']);
        df.on_line_completed(o, { par_index: 2, li_par: 1, ci_lbegin_par: 5, line_char_count: 8 });
        expect(o.gutter.innerHTML).toBe('<div>[2:1] - [5,8]</div>');
        // text_on_path 모드면 line 내용은 비워 둔다
        const tb2 = make_tb(ATTR, { text_on_path: {} });
        const o2 = new TB_DocFactory(tb2).create_line_view_obj();
        new TB_DocFactory(tb2).build_lineview(o2, Object.assign({}, domLine), { begin: 0, end: 8 }, {});
        expect(o2.line.innerHTML).toBe('');
    });
});

describe('TB_ApplyEditOperation', () => {
    it('get_lines / get_number_part / extract_fontfamily / collectFontFamily', () => {
        expect(TB_ApplyEditOperation.get_lines('ab\n\ncd')).toEqual(['ab', '\n', '\n', 'cd']);
        expect(TB_ApplyEditOperation.get_lines('\nx')).toEqual(['\n', 'x']);
        expect(TB_ApplyEditOperation.get_lines('')).toEqual([]);
        expect(TB_ApplyEditOperation.get_number_part('12px')).toBe(12);
        const usages = {};
        TB_ApplyEditOperation.extract_fontfamily('font-size:12pt; -kayak-font_family: Noto Sans KR , Bold ;bad', usages);
        expect(usages).toEqual({ 'Noto Sans KR , Bold': { familyName: 'Noto Sans KR', typeStyle: 'Bold' } });
        const div = window.document.createElement('div');
        div.innerHTML = '<span style="-kayak-font_family:A,B;">x</span><b>no</b><span style="-kayak-font_family:A,B;">y</span><span style="-kayak-font_family:C,D;">z</span>';
        expect(TB_ApplyEditOperation.collectFontFamily([div])).toEqual([{ familyName: 'A', typeStyle: 'B' }, { familyName: 'C', typeStyle: 'D' }]);
        expect(TB_ApplyEditOperation.child_spans(div).length).toBe(3);
    });
    function make_tb(render) {
        const rec = recorder(['set_text_align', 'set_par_style', 'set_font_family', 'set_bold', 'set_font_size', 'set_fontColor', 'set_letter_space', 'set_letter_scale_x', 'set_stroke', 'set_shadow', 'insert', 'insert_string', 'load_fonts']);
        const tb = { tbconfig: { text_render: render }, opStyle: rec.fns, opEdit: rec.fns, tbcursor: { cursor: 0 } };
        const fontloader = { load_fonts: (arr) => { rec.fns.load_fonts(arr); return Promise.resolve(null); } };
        return { tb, rec, fontloader };
    }
    it('apply_par_style / apply_par_padding_style', () => {
        const { tb, rec } = make_tb('svg');
        const sel = { begin: 0, end: 3 };
        TB_ApplyEditOperation.apply_par_style(tb, sel, 'text-align: center;text-indent:5px;padding-left:6px;padding-right:7px;line-height:1.5;padding-bottom:8px;padding-top:9px;');
        TB_ApplyEditOperation.apply_par_style(tb, sel, 'line-height:normal;padding:1px 2px 3px 4px');
        TB_ApplyEditOperation.apply_par_style(tb, sel, 'padding:1px 2px 3px');
        TB_ApplyEditOperation.apply_par_style(tb, sel, 'padding:1px 2px');
        TB_ApplyEditOperation.apply_par_style(tb, sel, 'padding:9px');
        expect(rec.calls).toMatchSnapshot();
    });
    it('apply_span_style: -kayak-* 값은 순서대로 누적된다', () => {
        const { tb, rec } = make_tb('svg');
        const sel = { begin: 1, end: 2 };
        const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64');
        TB_ApplyEditOperation.apply_span_style(tb, sel, `color:#ff0000;font-weight:bold;font-size:12pt;font-family:X;-kayak-font_family:A,B;-kayak-color_cmyk:0,100,100,0;-kayak-fontColorModel:${b64({ type: 'SPOT', name: 'P' })};-kayak-letter_space:50;-kayak-letter_scale_x:80.5;-kayak-stroke:${b64({ weight: 1 })};-kayak-shadow:${b64({ size: 2 })};-kayak-gradient_fill:${b64({ type: 'linear' })};`);
        expect(rec.calls).toMatchSnapshot();
    });
    it('apply_edit_operation: html 모드는 바로, svg 모드는 폰트 로딩 뒤 (문단/스팬마다 insert)', async () => {
        const div = window.document.createElement('div');
        div.setAttribute('style', 'text-align:right;');
        div.innerHTML = '<span style="color:#000;-kayak-font_family:A,B;">ab\ncd</span><span style="font-size:10pt;">e</span>';
        const html = make_tb('html');
        expect(await TB_ApplyEditOperation.apply_edit_operation([div], html.tb, html.fontloader)).toBe(6);
        expect(html.rec.calls).toMatchSnapshot();
        const svg = make_tb('svg');
        expect(await TB_ApplyEditOperation.apply_edit_operation([div], svg.tb, svg.fontloader)).toBe(6);
        expect(svg.rec.calls[0]).toEqual(['load_fonts', [{ familyName: 'A', typeStyle: 'B' }]]);
    });
});
