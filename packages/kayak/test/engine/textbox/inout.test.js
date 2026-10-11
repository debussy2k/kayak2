/*
    inout/inout.js 특성 테스트 (순수 함수 2개).
*/
import { describe, it, expect, vi } from 'vitest';
import { getMaxStrokeWeightPx, getBBoxFromSvgDPath } from '../../../src/engine/textbox/inout/inout';

const r6 = o => Object.fromEntries(Object.entries(o).map(([k, v]) => { const x = Math.round(v * 1e6) / 1e6; return [k, x === 0 ? 0 : x]; }));
const svg_data = (...strokes) => ({ svg_path_info: [{ svg_paths: strokes.map(s => ({ d: 'M0 0', stroke: s })) }] });

describe('getMaxStrokeWeightPx', () => {
    it('center는 weight/2, outside는 weight, 그 밖의 정렬과 stroke 없음은 0으로 보고 최대값을 pt→px(96/72)로 바꾼다', () => {
        expect(getMaxStrokeWeightPx(svg_data({ align: 'center', weight: 3 }))).toBeCloseTo(1.5 * 96 / 72, 10);
        expect(getMaxStrokeWeightPx(svg_data({ align: 'outside', weight: 2 }, { align: 'center', weight: 3 }))).toBeCloseTo(2 * 96 / 72, 10);
        expect(getMaxStrokeWeightPx(svg_data({ align: 'inside', weight: 9 }, undefined))).toBe(0);
        expect(getMaxStrokeWeightPx({ svg_path_info: [] })).toBe(0);
    });
});

describe('getBBoxFromSvgDPath', () => {
    const bbox = (d, transform) => r6(getBBoxFromSvgDPath({ d, transform }));

    it('d가 비어 있으면 null', () => {
        expect(getBBoxFromSvgDPath({ d: '' })).toBeNull();
    });
    it('M/L/H/V/Z: 끝점만으로 bbox를 만든다. 쉼표 구분도 받는다', () => {
        expect(bbox('M0 0 L10 0 L10 5 Z')).toEqual({ x: 0, y: 0, width: 10, height: 5 });
        expect(bbox('M1 1 H5 V4')).toEqual({ x: 1, y: 1, width: 4, height: 3 });
        expect(bbox('M0,0 L10,20')).toEqual({ x: 0, y: 0, width: 10, height: 20 });
    });
    it('붙어 있는 음수(0-1)는 공백을 넣어 분리한다', () => {
        expect(bbox('M0-1L5-2')).toEqual({ x: 0, y: -2, width: 5, height: 1 });
    });
    it('Q/C/S는 제어점도 bbox에 넣고, T와 A는 끝점만 넣는다', () => {
        expect(bbox('M0 0 Q 5 10 10 0')).toEqual({ x: 0, y: 0, width: 10, height: 10 });
        expect(bbox('M0 0 C 0 10 10 10 10 0')).toEqual({ x: 0, y: 0, width: 10, height: 10 });
        expect(bbox('M0 0 S 10 10 10 0')).toEqual({ x: 0, y: 0, width: 10, height: 10 });
        expect(bbox('M0 0 T 10 10')).toEqual({ x: 0, y: 0, width: 10, height: 10 });
        expect(bbox('M0 0 A 5 5 0 0 1 10 0')).toEqual({ x: 0, y: 0, width: 10, height: 0 });
    });
    it('모르는 명령은 console.warn만 하고 건너뛴다', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(bbox('M0 0 X 1 2')).toEqual({ x: 0, y: 0, width: 0, height: 0 });
        expect(warn).toHaveBeenCalledWith('Unsupported command:', 'X');
        warn.mockRestore();
    });
    it('transform(translate, rotate)을 순서대로 적용한 점으로 bbox를 만든다', () => {
        expect(bbox('M0 0 L10 10', [{ translate: { x: 5, y: 5 } }])).toEqual({ x: 5, y: 5, width: 10, height: 10 });
        expect(bbox('M0 0 L10 0', [{ rotate: { a: 90, cx: 0, cy: 0 } }])).toEqual({ x: 0, y: 0, width: 0, height: 10 });
        // translate 뒤 rotate: 행렬은 T∘R이라 점에는 rotate가 먼저 → (10,0)→(0,10)→(1,10)
        expect(bbox('M0 0 L10 0', [{ translate: { x: 1, y: 0 } }, { rotate: { a: 90, cx: 0, cy: 0 } }])).toEqual({ x: 1, y: 0, width: 0, height: 10 });
    });
});
