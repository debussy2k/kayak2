/*
    TB_Path 특성 테스트. TS 전환 전 JS에서 통과하는 상태가 기준선이다.
*/
import { describe, it, expect } from 'vitest';
import Bezier from 'bezier-js';
import { TB_Path } from '../../../src/engine/geometry/TB_Path';
import { CGMatrix } from '../../../src/engine/textbox/cg';
import { round, segs_dump, mixed_segments, CIRCLE_CCW } from './helpers';

const L_PATH = 'M0 0 L100 0 L100 100';   // 길이 200, 꺾인 직선

function make(data, opt) {
    const p = new TB_Path(data, opt);
    p.precalc_length();
    return p;
}

describe('TB_Path: 파싱', () => {
    it('is_closed', () => {
        expect(TB_Path.is_closed('M0 0 L1 1 Z')).toBe(true);
        expect(TB_Path.is_closed('M0 0 L1 1 z ')).toBe(true);
        expect(TB_Path.is_closed('M0 0 L1 1')).toBe(false);
        expect(TB_Path.is_closed('  ')).toBe(false);
    });
    it('열린 경로: path/segments/lengths', () => {
        const p = make('M0 0 L100 0 C100 50 100 50 100 100');
        expect(p.path).toEqual([{ cmd: 'M', x: 0, y: 0 }, { cmd: 'L', x: 100, y: 0 }, { cmd: 'C', x0: 100, y0: 50, x1: 100, y1: 50, x2: 100, y2: 100 }]);
        expect(p.segments.length).toBe(2);
        expect(p.closed_path).toBe(false);
        expect(round(p.lengths)).toEqual([100, 100]);
        expect(round(p.total_length)).toBe(200);
        expect(round(p.getLength())).toBe(200);
        expect(p.getSvgPathData()).toBe('M 0 0 L 100 0 C 100 50, 100 50, 100 100 ');
    });
    it('닫힌 경로 + flip: 방향이 뒤집힌다', () => {
        const ccw = make(CIRCLE_CCW);
        expect(ccw.closed_path).toBe(true);
        expect(ccw.getSvgPathData()).toBe('M 100 200 C 155 200, 200 155, 200 100 C 200 45, 155 0, 100 0 C 45 0, 0 45, 0 100 C 0 155, 45 200, 100 200 ');
        const cw = make(CIRCLE_CCW, { flip: true });
        expect(cw.closed_path).toBe(true);
        expect(cw.getSvgPathData()).toBe('M 100 200 C 45 200, 0 155, 0 100 C 0 45, 45 0, 100 0 C 155 0, 200 45, 200 100 C 200 155, 155 200, 100 200 ');
        expect(round(cw.getLength())).toBe(round(ccw.getLength()));
    });
    it('소문자(상대) 명령은 parse_data가 무시한다 (원본 동작)', () => {
        const p = make('M0 0 l10 10');
        expect(p.segments.length).toBe(0);
        expect(p.path).toEqual([{ cmd: 'M', x: 0, y: 0 }]);
    });
    it('데이터 없이 만들면 빈 경로', () => {
        const p = new TB_Path();
        expect(p.path).toEqual([]);
        expect(p.getLength()).toBe(0);
    });
});

describe('TB_Path: 기하 질의', () => {
    it('getBbox: 직선 꼭짓점과 곡선 extrema', () => {
        expect(make(L_PATH).getBbox()).toEqual({ x: 0, y: 0, width: 100, height: 100 });
        const b = make(CIRCLE_CCW, { flip: true }).getBbox();
        expect(b.x).toBeCloseTo(0, 1);
        expect(b.y).toBeCloseTo(0, 1);
        expect(b.width).toBeCloseTo(200, 1);
        expect(b.height).toBeCloseTo(200, 1);
    });
    it('getPosByDistance: 범위 안/음수/초과, normal, angle', () => {
        const p = make(L_PATH);
        const r = p.getPosByDistance(150, { normal: true, angle: true });
        expect(r.pt).toEqual({ x: 100, y: 50 });
        expect(r.nv.x).toBeCloseTo(-1);
        expect(r.nv.y).toBeCloseTo(0);
        expect(r.nv_angle).toBe(180);
        expect(p.getPosByDistance(50)).toEqual({ pt: { x: 50, y: 0 } });
        // dist < 0: 첫 segment의 t=0 — 단, 루프가 dist < l 조건으로 다시 계산한다 (원본 동작)
        expect(round(p.getPosByDistance(-1, { normal: true }))).toMatchSnapshot();
        expect(p.getPosByDistance(500)).toEqual({ pt: { x: 100, y: 100 } });
    });
    it('getSafeNormal: 퇴화 베지어(p0 == p1)의 t=0, (p2 == p3)의 t=1', () => {
        const p = new TB_Path();
        const degenerate0 = new Bezier(0, 0, 0, 0, 100, 100, 200, 0);
        expect(Number.isNaN(degenerate0.normal(0).x)).toBe(true);   // 전제: bezier-js가 NaN을 돌려준다
        const n0 = p.getSafeNormal(degenerate0, 0);
        expect(Number.isFinite(n0.x) && Number.isFinite(n0.y)).toBe(true);
        expect(round(n0)).toMatchSnapshot();
        const degenerate1 = new Bezier(0, 0, 100, 100, 200, 0, 200, 0);
        expect(Number.isNaN(degenerate1.normal(1).x)).toBe(true);
        const n1 = p.getSafeNormal(degenerate1, 1);
        expect(Number.isFinite(n1.x) && Number.isFinite(n1.y)).toBe(true);
        expect(round(n1)).toMatchSnapshot();
    });
    it('project / project_and_distance', () => {
        const p = make(L_PATH);
        expect(p.project(50, 10)).toEqual({ x: 50, y: 0 });
        expect(p.project_and_distance(50, 10)).toEqual({ q: { x: 50, y: 0 }, d: 10, length: 50 });
        expect(p.project_and_distance(110, 50)).toEqual({ q: { x: 100, y: 50 }, d: 10, length: 150 });
        const c = make(CIRCLE_CCW, { flip: true });
        expect(round(c.project_and_distance(300, 100))).toMatchSnapshot();   // 곡선 위 투영 + split 길이
    });
});

describe('TB_Path: 부분 경로와 outline', () => {
    it('getSubPath: begin <= end', () => {
        const sub = make(L_PATH).getSubPath(50, 150);
        expect(round(sub.getLength())).toBe(100);
        expect(sub.getSvgPathData()).toBe('M 50 0 L 100 0 L 100 50 ');
    });
    it('getSubPath wrap-around (begin > end): 원본 동작을 고정한다 (issues.md #3)', () => {
        const sub = make(L_PATH).getSubPath(150, 50);
        expect(sub.getSvgPathData()).toMatchSnapshot();
        expect(round(sub.getLength())).toMatchSnapshot();
    });
    it('get_outline_svg_path', () => {
        const p = make(L_PATH);
        expect(p.get_outline_svg_path(-10, 10, 100, 100)).toBe('');
        expect(p.get_outline_svg_path(-10, 10, 0, 200)).toMatchSnapshot();
        expect(make(CIRCLE_CCW, { flip: true }).get_outline_svg_path(-5, 5, 100, 300)).toMatchSnapshot();
    });
    it('append_with_segments: 정방향/flip', () => {
        const a = new TB_Path();
        a.append_with_segments(mixed_segments());
        expect(a.getSvgPathData()).toBe('M 0 0 L 100 0 C 150 100, 200 100, 250 0 L 350 0 ');
        const b = new TB_Path();
        b.append_with_segments(mixed_segments(), { flip: true });
        expect(b.getSvgPathData()).toBe('M 350 0 L 250 0 C 200 100, 150 100, 100 0 L 0 0 ');
    });
});

describe('TB_Path: clone / reverse_path', () => {
    it('clone(): 같은 경로, lengths 재계산', () => {
        const p = make(L_PATH);
        const c = p.clone();
        expect(c.getSvgPathData()).toBe(p.getSvgPathData());
        expect(c.closed_path).toBe(false);
        expect(round(c.total_length)).toBe(200);
        expect(c).not.toBe(p);
    });
    it('clone(mat): transformPoint로 M/L/C 모두 변환', () => {
        // 원본 JS는 C 명령에서 transformPoint(x, y) 두 인자로 부르고 전환 뒤에는 {x, y} 한 인자로 부른다.
        // cg.js의 CGMatrix는 둘 다 받으므로 가짜 객체 대신 실제 행렬을 쓴다.
        const mat = new CGMatrix();
        mat.setScale(2, 3);
        const c = make('M0 0 L100 0 C100 50 100 50 100 100').clone(mat);
        expect(c.getSvgPathData()).toBe('M 0 0 L 200 0 C 200 150, 200 150, 200 300 ');
        expect(c.getBbox()).toEqual({ x: 0, y: 0, width: 200, height: 300 });
    });
    it('clone(undefined, true): 역방향', () => {
        expect(make(L_PATH).clone(undefined, true).getSvgPathData()).toBe('M 100 100 L 100 0 L 0 0 ');
        expect(make(CIRCLE_CCW).clone(undefined, true).getSvgPathData()).toBe(make(CIRCLE_CCW, { flip: true }).getSvgPathData());
    });
    it('reverse_path: 중간에 M이 있으면 throw', () => {
        expect(() => new TB_Path().reverse_path([{ cmd: 'M', x: 0, y: 0 }, { cmd: 'M', x: 1, y: 1 }])).toThrow('cannot process "M" in the middle of path');
    });
    it('getSvgRect', () => {
        expect(new TB_Path().getSvgRect({ x: 1, y: 2, width: 3, height: 4 })).toBe('<rect x="1" y="2" width="3" height="4" stroke="blue" fill="transparent" />');
    });
});
