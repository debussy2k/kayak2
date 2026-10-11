/*  TB_InDesignJsonConverter 단위 테스트
    > npm test -w kayak -- test/engine/textbox/TB_InDesignJsonConverter.test.js
*/
import { describe, it, expect } from 'vitest';
import { TB_InDesignJsonConverter } from '../../../src/engine/textbox/TB_InDesignJsonConverter';

describe('TB_InDesignJsonConverter.parse_stroke()', () => {
    const conv = new TB_InDesignJsonConverter({ src_unit: 'mm', font_list: {} });

    it('stroke_color가 null이면(InDesign의 [None] 색) 선 없음으로 처리한다', () => {
        // InDesign export는 선 색이 없을 때 undefined가 아니라 null을 내보낸다.
        // (test/fixtures/indesign/gradient-fill-indesign.json 참고)
        const stroke = conv.parse_stroke({ stroke_weight: 1, stroke_color: null });
        expect(stroke.weight).toBe(0);
    });

    it('stroke_color가 있으면 색과 두께를 읽는다', () => {
        const stroke = conv.parse_stroke({
            stroke_weight: 2,
            stroke_color: { rgb_color: [255, 0, 0] },
            stroke_alignment: 'CENTER_ALIGNMENT',
        });
        expect(stroke.weight).toBe(2);
        expect(stroke.align).toBe('center');
        expect(stroke.color).toBe('#ff0000');
    });
});
