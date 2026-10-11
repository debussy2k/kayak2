/*
    TextBox_InOut 특성 테스트. 'Hi' 한 줄을 가진 실제 textbox에서 JSON 저장/로드, SVG 스냅샷, bbox, mirror, 폰트/색 수집을 고정한다.
    숫자는 KoPubDotum 글리프 기하와 jsdom 레이아웃에서 나온 값이라 실행마다 같다 (test/snapshot이 같은 전제).
*/
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { create_textbox, destroy_textbox, normalize } from '../../snapshot/helpers';
import _g from '../../../src/engine/textbox/TB_PlatformEnv';

let tb;
beforeEach(async () => { tb = await create_textbox(); tb.opEdit.insert_string(0, 'Hi'); });
afterEach(() => destroy_textbox(tb));

const num = (svg, attr) => parseFloat(svg.match(new RegExp(`<svg [^>]*${attr}="([^"]+)"`))[1]);

describe('kayak JSON 저장/로드', () => {
    it('saveAsJson: 키 순서, meta, font_used에 기본 폰트, text_raw', () => {
        const j = tb.saveAsJson();
        expect(Object.keys(j)).toEqual(['version', 'meta', 'preference', 'text_arr', 'text_raw', 'font_used',
            'ATTR_Par', 'ATTR_Doc', 'ATTR_FontFamily', 'ATTR_FontSize', 'ATTR_Bold', 'ATTR_FontColor',
            'ATTR_LetterSpacing', 'ATTR_LetterScaleX', 'ATTR_Stroke', 'ATTR_Shadow', 'ATTR_NamedRange']);
        expect(j.meta).toEqual({ linebreak_tolerance: 0 });
        expect(j.text_raw).toBe('Hi\n');
        expect(Object.keys(j.font_used)).toEqual([tb.get_default_font().familyName]);
        expect(j.preference).toEqual(tb.tbpreference.save());
        expect(tb.inout.verify_saved_json({ ATTR_X: [], b: 1 })).toEqual({ error: 'ATTR_X is empty' });
        expect(tb.inout.verify_saved_json({ ATTR_X: [1] })).toBeNull();
    });

    it('loadFromJson: text_arr가 비면 {warning}으로 resolve (Review Focus 3), 정상이면 meta를 적용하고 결과를 돌려준다', async () => {
        const cmds = [];
        tb.add_doc_change_listener(e => cmds.push(e.cmd));
        const j = JSON.parse(JSON.stringify(tb.saveAsJson()));  // 'Hi' 상태를 먼저 저장. saveAsJson의 text_arr는 m_text 참조라 복사해 둔다 (깨진 로드가 reset_all을 한다)
        await expect(tb.loadFromJson(JSON.stringify({ text_arr: [] }))).resolves.toEqual({ warning: 'invalid kayak json.' });
        expect(tb.text_core.toString()).toBe('$');
        j.meta.linebreak_tolerance = 7;
        const r = await tb.loadFromJson(JSON.stringify(j));
        expect([Object.keys(r), r.verify_result.code, r.default_font_used]).toEqual([['verify_result', 'default_font_used'], 'pass', false]);
        expect([tb.text_core.toString(), tb.tbconfig.linebreak_tolerance]).toEqual(['Hi$', 7]);
        expect(cmds[cmds.length - 1]).toBe('loadFromJson');
    });

    it('_get_used_fonts_set: font_used가 있으면 그것만, 없으면 ATTR_FontFamily에서 중복 없이', () => {
        expect(tb.inout._get_used_fonts_set({ font_used: { A: { style: { R: { url: 'u', issue: 'i', default: true } } } } }))
            .toEqual([{ familyName: 'A', typeStyle: 'R', url: 'u', issue: 'i', default: true }]);
        expect(tb.inout._get_used_fonts_set({ ATTR_FontFamily: [{ familyName: 'A', typeStyle: 'R' }, { familyName: 'A', typeStyle: 'R' }], font_used: {} }))
            .toEqual([{ familyName: 'A', typeStyle: 'R', url: null, issue: null, default: false }]);
    });

    it('gather_used_colors(json 또는 현재 문서) / gather_used_fonts(기본 폰트 포함) / gather_used_font_list_info', () => {
        expect(tb.gather_used_colors()).toEqual({ black: { rgb: 'black', cmyk: [0, 0, 0, 100] } });
        expect(tb.gather_used_colors(JSON.stringify({ ATTR_FontColor: [{ fontColor: '#1', fontColorCMYK: [1] }] }))).toEqual({ '#1': { rgb: '#1', cmyk: [1] } });
        const def = tb.get_default_font();
        expect(tb.gather_used_fonts()).toEqual({ [`${def.familyName}/${def.typeStyle}`]: def });
        const info = tb.gather_used_font_list_info();
        expect([Object.keys(info.used_fonts), Object.keys(info.used_fonts[def.familyName].style), info.unresolved_fonts]).toEqual([[def.familyName], [def.typeStyle], []]);
        expect(tb.inout._get_used_font_list_for_embedding({ 'X/Y': { familyName: 'X', typeStyle: 'Y' } }, {})).toEqual({ used_fonts: {}, unresolved_fonts: ['X/Y'] });
    });
});

describe('SVG 스냅샷', () => {
    it('snapshotAsSVG: path_only는 <g>만, 기본은 frame 크기, cropbox+padding, viewbox_offset+fix_20210402', () => {
        const dim = tb.get_dimension();
        expect(normalize(tb.snapshotAsSVG({ path_only: true }))).toMatch(/^<g transform="translate\(/);
        const full = tb.snapshotAsSVG();
        expect([num(full, 'width'), num(full, 'height')]).toEqual([300, dim.visible_content_height]);
        const crop = tb.snapshotAsSVG({ cropbox: { x: 1, y: 2, w: 30, h: 40 }, padding: [1, 2, 3, 4] });
        expect([num(crop, 'width'), num(crop, 'height'), crop.match(/viewBox="([^"]+)"/)[1]]).toEqual([34, 46, '0 0 34 46']);
        const vb = tb.snapshotAsSVG({ viewbox_offset: { x: -2, y: -3 }, fix_20210402: true });
        expect(num(vb, 'width')).toBeCloseTo(306, 6);                               // (300 + 4) - (-2)
        expect(num(vb, 'height')).toBeCloseTo(dim.visible_content_height + 6 + 3, 6);
        expect(vb.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number).slice(0, 3)).toEqual([-2, -3, 304]);
    });

    it('snapshotAsSVGData: frame, viewbox_offset(embox offset), bbox. override_fill_color는 복제본에만 적용', () => {
        const d = tb.snapshotAsSVGData();
        const E = tb.tbpreference.computed_values.embox_height_offset_px;
        expect([d.frame_width, d.svg_path_info.length, d.viewbox_offset.x + 0]).toEqual([300, 1, 0]);   // -0 → 0
        expect(d.frame_height).toBeCloseTo(tb.get_dimension().visible_content_height, 6);
        expect(d.viewbox_offset.y).toBeCloseTo(E, 6);
        expect(d.bbox).toEqual({ w: 300, h: d.frame_height - 2 * d.viewbox_offset.y });
        expect(d.svg_path_info[0].svg_paths.map(p => p.fill)).toEqual(['black']);
        const d2 = tb.snapshotAsSVGData({ override_fill_color: { fill: '#abc', fill_cmyk: [1, 2, 3, 4] } });
        expect(d2.svg_path_info[0].svg_paths.map(p => [p.fill, p.fill_cmyk])).toEqual([['#abc', [1, 2, 3, 4]]]);
        expect(tb.layout.get_tbdom().pars[0].lines[0].svg_paths.map(p => p.fill)).toEqual(['black']);
    });

    it('getBBox / snapshotAsSVGInBox / snapshotAsSVGInContentBBox', () => {
        const b = tb.getBBox();
        expect([b.min_x, b.min_y, b.max_x, b.max_y, b.w, b.h].map(v => Math.round(v * 1000) / 1000)).toEqual([1.25, 0.053, 11.72, 10.013, 10.47, 9.96]);
        const inbox = tb.inout.snapshotAsSVGInBox();
        expect([inbox.frame.w, inbox.bbox.w, inbox.viewbox_offset.x + 0]).toEqual([300, 300, 0]);   // -0 → 0
        expect(inbox.svg_str).toMatch(/^<svg /);
        const c = tb.snapshotAsSVGInContentBBox({ padding: [1, 2, 3, 4] });
        expect(c.bbox).toEqual(b);
        expect([c.padded_box.x, c.padded_box.y, c.padded_box.w, c.padded_box.h].map(v => Math.round(v * 1000) / 1000)).toEqual([0.25, -1.947, 14.47, 15.96]);
        expect(c.svg_str).toMatch(/^<svg /);
    });

    it('snapshotAsSVGInContentBBox는 padding 없이 불러도 된다 (issues.md #15)', () => {
        const c = tb.snapshotAsSVGInContentBBox();
        expect(c.padded_box).toEqual({ x: c.bbox.min_x, y: c.bbox.min_y, w: c.bbox.w, h: c.bbox.h });
        expect(c.svg_str).toMatch(/^<svg /);
    });

    it('빈 문서의 getBBox는 0', async () => {
        tb.reset_all();
        expect(tb.getBBox()).toEqual({ min_x: 0, min_y: 0, max_x: 0, max_y: 0, w: 0, h: 0 });
    });
});

describe('mirror / InDesign', () => {
    it('mirror: node를 비우고 kayak-root 복제본(scale)과 lineview 복제본을 넣는다. enable_debounce면 300ms 뒤', async () => {
        const node = _g.document.createElement('div');
        node.appendChild(_g.document.createElement('p'));
        tb.mirror({ node, scale: 0.5 });
        expect([node.childNodes.length, node.firstChild.className, node.firstChild.style.transform, node.querySelectorAll('div.kayak-lineview').length])
            .toEqual([1, 'kayak-root', 'scale(0.5)', 1]);
        const node2 = _g.document.createElement('div');
        tb.mirror({ node: node2, enable_debounce: true });
        expect(node2.childNodes.length).toBe(0);
        await new Promise(r => setTimeout(r, 400));
        expect(node2.childNodes.length).toBe(1);
    });

    it('importFromInDesignJson은 변환 결과 객체를 돌려준다', () => {
        const r = tb.importFromInDesignJson(JSON.stringify({ type: 'TextFrame', frame: { size: { width: 25.4, height: 50.8 } }, text_list: [] }));
        expect(Object.keys(r)).toEqual(['kayak_json', 'dim_px', 'font_family_remap_occurred']);
        expect([r.dim_px.width, r.dim_px.height].map(Math.round)).toEqual([96, 192]);
        expect(r.kayak_json.meta.linebreak_tolerance).toBe(2);
    });
});
