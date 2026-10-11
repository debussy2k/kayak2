/*
    MathUtil, TB_LineSeg, PathUtil, MGeometry 특성 테스트.
    TS 전환 전 JS에서 통과하는 상태를 기준선으로 삼는다. 전환 후에도 같아야 한다.
    스냅샷(__snapshots__/*.snap)은 첫 실행(JS)에서 만들어지고 커밋한다.
*/
import { describe, it, expect } from 'vitest';
import Bezier from 'bezier-js';
import { MathUtil } from '../../../src/engine/geometry/MathUtil';
import { TB_LineSeg } from '../../../src/engine/geometry/TB_LineSeg';
import { PathUtil, MGeometry } from '../../../src/engine/geometry/PathUtil';
import { round, segs_dump, make_curve, mixed_segments } from './helpers';

describe('MathUtil', () => {
    it('distance / interpolate / isInRange', () => {
        expect(MathUtil.distance(0, 0, 3, 4)).toBe(5);
        expect(MathUtil.interpolate(0, 0, 10, 20, 0.25)).toEqual({ x: 2.5, y: 5 });
        expect(MathUtil.isInRange(5, 0, 10)).toBe(true);
        expect(MathUtil.isInRange(5, 10, 0)).toBe(true);   // from > to 도 허용
        expect(MathUtil.isInRange(11, 0, 10)).toBe(false);
    });
    it('getNearestPoint: 수선의 발, 끝점 A, 끝점 B, 수직선', () => {
        expect(MathUtil.getNearestPoint({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 5, y: 0, t: 0.5, d: 5 });
        expect(round(MathUtil.getNearestPoint({ x: -5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }))).toEqual({ x: 0, y: 0, t: 0, d: round(Math.sqrt(34)) });
        expect(MathUtil.getNearestPoint({ x: 20, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 10, y: 0, t: 1, d: 10 });
        expect(MathUtil.getNearestPoint({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 10 })).toEqual({ x: 0, y: 4, t: 0.4, d: 3 });
    });
    it('getAngle은 0~360도', () => {
        expect(MathUtil.getAngle(1, 0)).toBe(0);
        expect(MathUtil.getAngle(0, 1)).toBe(90);
        expect(MathUtil.getAngle(-1, 0)).toBe(180);
        expect(MathUtil.getAngle(0, -1)).toBe(270);
    });
    it('getSvgPathData_Line', () => {
        expect(MathUtil.getSvgPathData_Line(1, 2, 3, 4)).toBe('M1 2 L3 4');
    });
});

describe('TB_LineSeg', () => {
    it('type, p0/p1, length, get, findTbyDistance, getPosByDistance', () => {
        const s = new TB_LineSeg(0, 0, 3, 4);
        expect(s.type).toBe('line');
        expect(s.p0).toEqual({ x: 0, y: 0 });
        expect(s.p1).toEqual({ x: 3, y: 4 });
        expect(s.length()).toBe(5);
        expect(s.get(0.5)).toEqual({ x: 1.5, y: 2 });
        expect(s.findTbyDistance(2.5)).toBe(0.5);
        expect(s.getPosByDistance(2.5)).toEqual({ x: 1.5, y: 2 });
    });
    it('normal: 수평/역수평/수직/대각', () => {
        expect(new TB_LineSeg(0, 0, 10, 0).normal()).toEqual({ x: 0, y: 1 });
        expect(new TB_LineSeg(10, 0, 0, 0).normal()).toEqual({ x: 0, y: -1 });
        const v = new TB_LineSeg(0, 0, 0, 10).normal();
        expect(v.x).toBeCloseTo(-1);
        expect(v.y).toBeCloseTo(0);
        const d = new TB_LineSeg(0, 0, 3, 4).normal();
        expect(d.x).toBeCloseTo(-0.8);
        expect(d.y).toBeCloseTo(0.6);
    });
    it('offset / project', () => {
        const o = new TB_LineSeg(0, 0, 10, 0).offset(5);
        expect([o.x0, o.y0, o.x1, o.y1]).toEqual([0, 5, 10, 5]);
        expect(new TB_LineSeg(0, 0, 10, 0).project({ x: 5, y: 5 })).toEqual({ x: 5, y: 0, t: 0.5, d: 5 });
    });
});

describe('PathUtil.parse_svg_path', () => {
    it('M/L/C/Z', () => {
        expect(PathUtil.parse_svg_path('M1 2 L3 4 C5 6 7 8 9 10 Z')).toEqual([['M', 1, 2], ['L', 3, 4], ['C', 5, 6, 7, 8, 9, 10], ['Z']]);
    });
    it('overloaded moveTo는 L/l로 이어진다', () => {
        expect(PathUtil.parse_svg_path('M1 2 3 4')).toEqual([['M', 1, 2], ['L', 3, 4]]);
        expect(PathUtil.parse_svg_path('m1 2 3 4')).toEqual([['m', 1, 2], ['l', 3, 4]]);
    });
    it('지수/음수/쉼표', () => {
        expect(PathUtil.parse_svg_path('M-1.5e1,2')).toEqual([['M', -15, 2]]);
    });
    it('인자가 모자라면 throw', () => {
        expect(() => PathUtil.parse_svg_path('L1')).toThrow('malformed path data');
    });
});

describe('PathUtil: findTbyDistance / split / clip', () => {
    it('findTbyDistance: 직선은 비례, 곡선은 이분 탐색', () => {
        expect(PathUtil.findTbyDistance(new TB_LineSeg(0, 0, 10, 0), 2.5, {})).toBe(0.25);
        const cv = make_curve();
        expect(PathUtil.findTbyDistance(cv, cv.length() / 2, {})).toBeCloseTo(0.5, 3);
        expect(PathUtil.findTbyDistance(cv, 1e9, {})).toBe(1);
        expect(PathUtil.findTbyDistance(cv, -1, {})).toBe(0);
        expect(round(PathUtil.findTbyDistance_Bezier(cv, 30, { epsilon: 0.5, max_step: 5 }))).toMatchSnapshot();
    });
    it('split_segment / split_and_select_segment (직선)', () => {
        const s = new TB_LineSeg(0, 0, 100, 0);
        expect(segs_dump([PathUtil.split_segment(s, 0.25, 0.75)])).toEqual([{ type: 'line', x0: 25, y0: 0, x1: 75, y1: 0 }]);
        expect(segs_dump([PathUtil.split_and_select_segment(s, 0.3, 'left')])).toEqual([{ type: 'line', x0: 0, y0: 0, x1: 30, y1: 0 }]);
        expect(segs_dump([PathUtil.split_and_select_segment(s, 0.3, 'right')])).toEqual([{ type: 'line', x0: 30, y0: 0, x1: 100, y1: 0 }]);
    });
    it('split_segment / split_and_select_segment (곡선)', () => {
        const cv = make_curve();
        expect(segs_dump([PathUtil.split_segment(cv, 0.25, 0.75), PathUtil.split_and_select_segment(cv, 0.5, 'left'), PathUtil.split_and_select_segment(cv, 0.5, 'right')])).toMatchSnapshot();
    });
    it('clip_path: 직선-곡선-직선 구간 자르기', () => {
        const segs = mixed_segments();
        const lens = segs.map(s => s.length());
        const clipped = PathUtil.clip_path(segs, lens, 50, lens[0] + lens[1] + 50);
        expect(clipped.length).toBe(3);
        const total = clipped.reduce((sum, s) => sum + s.length(), 0);
        expect(total).toBeCloseTo(lens[1] + 100, 1);
        expect(segs_dump(clipped)).toMatchSnapshot();
        // 한 segment 안에서 시작하고 끝나는 경우
        expect(segs_dump(PathUtil.clip_path(segs, lens, 10, 20))).toEqual([{ type: 'line', x0: 10, y0: 0, x1: 20, y1: 0 }]);
        // 역순/빈 구간
        expect(PathUtil.clip_path(segs, lens, 20, 20)).toEqual([]);
        expect(PathUtil.clip_path(segs, lens, 20, 10)).toEqual([]);
    });
});

describe('PathUtil: flatten / offset', () => {
    it('flatten_segments: 곡선은 직선 조각으로, 직선은 그대로', () => {
        const flat = PathUtil.flatten_segments(mixed_segments());
        expect(flat.every(s => s.type == 'line')).toBe(true);
        expect(flat[0]).toEqual(mixed_segments()[0]);
        expect([flat[1].x0, flat[1].y0]).toEqual([100, 0]);
        expect([flat[flat.length - 2].x1, flat[flat.length - 2].y1]).toEqual([250, 0]);
        expect(flat.length).toMatchSnapshot();
        expect(PathUtil.flatten_segments([make_curve()], 5).length).toMatchSnapshot();
    });
    it('get_offset_svg_path: 정방향/역방향', () => {
        const fwd = PathUtil.get_offset_svg_path(mixed_segments(), 10);
        expect(fwd.svg_str.startsWith('L ')).toBe(true);
        expect(fwd.begin_point).toEqual({ x: 0, y: 10 });
        expect(round(fwd)).toMatchSnapshot();
        const rev = PathUtil.get_offset_svg_path(mixed_segments(), -10, true);
        expect(rev.end_point).toEqual({ x: 0, y: -10 });
        expect(round(rev)).toMatchSnapshot();
    });
    it('get_offset_svg_path: 빈 입력', () => {
        expect(PathUtil.get_offset_svg_path([], 10)).toEqual({ svg_str: '', begin_point: null, end_point: null });
    });
});

describe('MGeometry', () => {
    const mg = new MGeometry();
    it('interpolate / distToSegment', () => {
        expect(mg.interpolate({ X: 0, Y: 0 }, { X: 10, Y: 20 }, 0.5)).toEqual({ X: 5, Y: 10 });
        expect(mg.distToSegment({ X: 0, Y: 5 }, { X: 0, Y: 0 }, { X: 10, Y: 0 })).toBe(5);
        expect(mg.distToSegment({ X: -3, Y: 4 }, { X: 0, Y: 0 }, { X: 10, Y: 0 })).toBe(5);   // 끝점 밖
        expect(mg.distToSegment({ X: 3, Y: 4 }, { X: 0, Y: 0 }, { X: 0, Y: 0 })).toBe(5);     // 길이 0 segment
    });
    it('subdivide_cbezier: 중점 분할', () => {
        const r = mg.subdivide_cbezier([{ X: 0, Y: 0 }, { X: 0, Y: 10 }, { X: 10, Y: 10 }, { X: 10, Y: 0 }]);
        expect(r.left[3]).toEqual({ X: 5, Y: 7.5 });
        expect(r.right[0]).toEqual(r.left[3]);
        expect(r.left[0]).toEqual({ X: 0, Y: 0 });
        expect(r.right[3]).toEqual({ X: 10, Y: 0 });
    });
    it('flatten_cbezier: 직선인 곡선은 양 끝점만', () => {
        const v = [];
        mg.flatten_cbezier([{ X: 0, Y: 0 }, { X: 1, Y: 1 }, { X: 2, Y: 2 }, { X: 3, Y: 3 }], v, { flatness: 1, has_begin_point: true });
        expect(v).toEqual([{ X: 0, Y: 0 }, { X: 3, Y: 3 }]);
        const w = [];
        mg.flatten_cbezier([{ X: 0, Y: 0 }, { X: 1, Y: 1 }, { X: 2, Y: 2 }, { X: 3, Y: 3 }], w, { flatness: 1, has_begin_point: false });
        expect(w).toEqual([{ X: 3, Y: 3 }]);
    });
});
