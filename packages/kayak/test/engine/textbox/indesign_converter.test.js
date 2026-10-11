/*
    TB_InDesignJsonConverter 특성 테스트. 변환기는 내부에 schema textbox를 만들므로 ../snapshot/helpers를 import해 TB_PlatformEnv를 준비한다.
    전체 변환은 test/snapshot/indesign_import.test.js가 고정하고, 여기서는 단위 변환 함수를 고정한다.
*/
import { describe, it, expect, vi } from 'vitest';
import '../../snapshot/helpers';
import { TB_InDesignJsonConverter } from '../../../src/engine/textbox/TB_InDesignJsonConverter';
import { spFontManager } from '../../../src/engine/textbox/TB_FontManager';

const FONT_LIST = {
    Foo: { family: { locale: { en: 'Foo' }, postscriptName: 'Foo-PS' }, style: { Bold: { full_name: 'Foo Bold Full', url: 'u', issue: 'i', locale: {} } } },
};
const conv = () => new TB_InDesignJsonConverter({ src_unit: 'mm', font_list: FONT_LIST });
const CIRCLE = 'M100, 200 C 155, 200, 200, 155, 200, 100 C 200, 45, 155, 0, 100, 0 C 45, 0, 0, 45, 0, 100 C 0, 155, 45, 200, 100, 200 Z';

describe('TB_InDesignJsonConverter', () => {
    it('생성: schema textbox를 만들고 단위 변환기를 고른다. 모르는 단위는 throw (Review Focus 4)', () => {
        const c = conv();
        expect(Object.keys(c)).toEqual(['opt', 'toPx', 'tb', 'rng']);
        expect([c.tb.tb_schema, c.tb.layout, c.rng]).toEqual([null, null, { begin: 0, end: 0 }]);
        expect(c.toPx(25.4)).toBeCloseTo(96, 6);
        expect(new TB_InDesignJsonConverter({ src_unit: 'indesign_px', font_list: FONT_LIST }).toPx(3)).toBeCloseTo(4, 5);
        let err = null;
        try { new TB_InDesignJsonConverter({ src_unit: 'in', font_list: FONT_LIST }); } catch (e) { err = e; }
        expect(err).toEqual({ err: 'not supported source unit.' });
    });

    it('get_align_code', () => {
        const c = conv();
        expect(['LEFT_ALIGN', 'CENTER_ALIGN', 'RIGHT_ALIGN', 'LEFT_JUSTIFIED', 'CENTER_JUSTIFIED', 'RIGHT_JUSTIFIED', 'FULLY_JUSTIFIED', 'x'].map(v => c.get_align_code(v)))
            .toEqual(['left', 'center', 'right', 'left-justified', 'center-justified', 'right-justified', 'fully-justified', 'left']);
    });

    it('parse_stroke: stroke_color null/weight 없음은 "선 없음", miter면 miterlimit 반영 (Review Focus 4)', () => {
        const c = conv();
        expect(c.parse_stroke({ stroke_color: null, stroke_weight: 1 })).toEqual({ weight: 0, align: 'outside', color: '#000', join: 'round', miterlimit: 10 });
        expect(c.parse_stroke({ stroke_color: { rgb_color: [1, 2, 3] } })).toEqual({ weight: 0, align: 'outside', color: '#000', join: 'round', miterlimit: 10 });
        expect(c.parse_stroke({ stroke_weight: 2, stroke_color: { rgb_color: [255, 0, 0] }, stroke_alignment: 'CENTER_ALIGNMENT', stroke_endjoin: 'MITER_END_JOIN', stroke_miterlimit: 4 }))
            .toEqual({ weight: 2, align: 'center', color: '#ff0000', join: 'miter', miterlimit: 4 });
    });

    it('parse_dropShadow: 없으면 기본값(키 이름이 shadow), 있으면 size/distance는 toFixed(2) 문자열 (원본 quirk, issues.md #16)', () => {
        const c = conv();
        expect(c.parse_dropShadow({})).toEqual({ size: 0, angle: 135, distance: 0, opacity: 100, shadow: '#000' });
        expect(c.parse_dropShadow({ dropShadow: { color: { rgb_color: [0, 0, 255] }, size: 1.234, angle: 90, distance: 2.345, opacity: 40 } }))
            .toEqual({ size: '1.23', angle: 90, distance: '2.35', opacity: 40, color: '#0000ff' });
    });

    it('_parse_indesign_solid_color: rgb hex, CMYK면 cmyk 문자열+배열, model은 깊은 복사', () => {
        const c = conv();
        const model = { type: 'SPOT', name: 'P' };
        const r = c._parse_indesign_solid_color({ rgb_color: [0, 160, 233], src_color: [100, 0, 0, 0], src_color_space: 'CMYK', model });
        expect(r).toEqual({ rgb: '#00a0e9', cmyk: '100,0,0,0', cmyk_arr: [100, 0, 0, 0], model });
        expect(r.model).not.toBe(model);
        expect(c._parse_indesign_solid_color({})).toEqual({ rgb: '#000000' });
    });

    it('parse_indesign_color: LINEAR gradient는 frame 기준 % 좌표와 stop으로', () => {
        const c = conv();
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        const r = c.parse_indesign_color({
            fill_color: { gradientType: 'LINEAR', gradientStops: [
                { location: 0, stopColor: { rgb_color: [255, 0, 0] } },
                { location: 100, stopColor: { rgb_color: [0, 0, 255], src_color: [100, 100, 0, 0], src_color_space: 'CMYK' } }] },
            gradient_fill: { start: [0, 0], length: 72, angle: 0 },
        }, { width: 96, height: 96 });
        log.mockRestore();
        expect(r).toEqual({ rgb: { type: 'linear', geom: { x1: '0%', y1: '0%', x2: '100%', y2: '0%' },
            stops: [{ offset: '0%', rgb: '#ff0000' }, { offset: '100%', rgb: '#0000ff', cmyk: [100, 100, 0, 0] }], angle: 0 } });
        expect(c.parse_indesign_color({ fill_color: { rgb_color: [1, 2, 3] } })).toEqual({ rgb: '#010203' });
    });

    it('parse_textonpath: 열린 경로는 pt→px, flip이면 bracket을 맞바꾸고, 닫힌 경로는 길이에서 빼며 길이로 clamp', () => {
        const c = conv();
        expect(c.parse_textonpath({ start_bracket: 72, end_bracket: 144 }, 'M0 0 L 1000 0'))
            .toEqual({ svg_path_data: 'M0 0 L 1000 0', flip_path: false, align_to_path: 'baseline', start_bracket: 96, end_bracket: 192 });
        expect(c.parse_textonpath({ flip_path_effect: 'FLIPPED', start_bracket: 72, end_bracket: 144 }, 'M0 0 L 1000 0'))
            .toMatchObject({ flip_path: true, start_bracket: 192, end_bracket: 96 });
        const r = c.parse_textonpath({ text_alignment: 'CENTER_TEXT_ALIGNMENT', flip_path_effect: 'FLIPPED', start_bracket: 72, end_bracket: 999999 }, CIRCLE);
        expect([r.align_to_path, r.flip_path, r.end_bracket]).toEqual(['center', true, 0]);
        expect(r.start_bracket).toBeCloseTo(2277.582, 2);
        expect(c.parse_textonpath({ text_alignment: 'ASCENDER_TEXT_ALIGNMENT' }, 'M0 0 L 10 0').align_to_path).toBe('ascender');
    });

    it('remap_font_family(#1 full_name, #2 "family style") / fix_font_family(#3 postscriptName)', () => {
        const c = conv();
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        const list = [{ font_family: 'Foo Bold Full' }, { font_family: 'Foo Bold' }, { font_family: 'Foo' }, { font_family: 'Nope' }];
        let occurred = null;
        c.remap_font_family(list, v => occurred = v);
        expect([list.map(t => t.font_family), occurred]).toEqual([['Foo', 'Foo', 'Foo', 'Nope'], true]);
        c.remap_font_family([{ font_family: 'Foo' }], v => occurred = v);
        expect(occurred).toBe(false);
        const t = { font_family: 'Nope', postscriptName: 'Foo-PS' };
        c.fix_font_family(t);
        const t2 = { font_family: 'Nope', postscriptName: null };
        c.fix_font_family(t2);
        log.mockRestore();
        expect([t.font_family, t2.font_family]).toEqual(['Foo', 'Nope']);
    });

    it('set_vertical_justification: OFF면 정렬과 frame height, 그 밖에는 아무것도 안 한다', () => {
        const c = conv();
        c.set_vertical_justification({ autoSizingType: 'OFF', verticalJustification: 'BOTTOM_ALIGN' }, { width: 10, height: 50 });
        expect([c.tb.tbpreference.vertical_justification, c.tb.tbpreference.fit_to_content_height, c.tb.tbpreference.frame_height]).toEqual(['bottom', false, 50]);
        const c2 = conv();
        c2.set_vertical_justification({ autoSizingType: 'HEIGHT_ONLY' }, { width: 10, height: 50 });
        expect([c2.tb.tbpreference.vertical_justification, c2.tb.tbpreference.fit_to_content_height]).toEqual(['top', true]);
    });

    it('load_json: 기본 폰트 목록으로 샘플을 변환하면 text_arr 길이와 dim_px가 맞는다', () => {
        const c = new TB_InDesignJsonConverter({ src_unit: 'mm', font_list: spFontManager._get_font_list('default-host-ko') });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const r = c.load_json({ type: 'TextFrame', frame: { size: { width: 25.4, height: 50.8 } },
            text_list: [{ contents: 'ab\n', font_family: 'SpoqaHanSans', font_style: 'Bold', font_size: 12, kerning: 'Metrics', tracking: 0, h_scale: 100,
                justification: 'CENTER_ALIGN', first_indent: 0, left_indent: 0, right_indent: 0, space_before: 0, space_after: 0, auto_leading: 120,
                fill_color: { rgb_color: [0, 0, 0] } }] });
        warn.mockRestore();
        expect([r.kayak_json.text_arr.length, r.font_family_remap_occurred]).toEqual([4, false]);
        expect([r.dim_px.width, r.dim_px.height].map(Math.round)).toEqual([96, 192]);
        expect(r.kayak_json.ATTR_Par.map(p => p.m_Align)).toEqual(['center', 'center']);
    });
});
