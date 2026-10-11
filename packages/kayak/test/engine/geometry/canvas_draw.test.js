/*
    TB_CanvasDraw 특성 테스트. canvas 2D context를 흉내 내어 호출 순서와 인자를 기록한다.
    디버그 전용 코드지만(TB_Path.drawOnCanvas) 전환 중 깨지지 않게 고정한다.
*/
import { describe, it, expect } from 'vitest';
import Bezier from 'bezier-js';
import { TB_CanvasDraw } from '../../../src/engine/geometry/TB_CanvasDraw';
import { TB_Path } from '../../../src/engine/geometry/TB_Path';
import { round, make_curve } from './helpers';

function make_ctx() {
    const calls = [];
    const ctx = {};
    for (const name of ['beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'stroke', 'fill'])
        ctx[name] = (...args) => { calls.push([name, ...round(args)]); };
    let strokeStyle = '', fillStyle = '';
    Object.defineProperty(ctx, 'strokeStyle', { get: () => strokeStyle, set: (v) => { strokeStyle = v; calls.push(['strokeStyle=', v]); } });
    Object.defineProperty(ctx, 'fillStyle', { get: () => fillStyle, set: (v) => { fillStyle = v; calls.push(['fillStyle=', v]); } });
    return { ctx, calls };
}

describe('TB_CanvasDraw', () => {
    it('setColor / setFill', () => {
        const { ctx, calls } = make_ctx();
        const cd = new TB_CanvasDraw(ctx);
        cd.setColor('red');
        cd.setFill('blue');
        expect(calls).toEqual([['strokeStyle=', 'red'], ['fillStyle=', 'blue']]);
    });
    it('drawCurve: 3차는 bezierCurveTo, 2차는 quadraticCurveTo, offset 적용', () => {
        const { ctx, calls } = make_ctx();
        const cd = new TB_CanvasDraw(ctx);
        cd.drawCurve(make_curve(), { x: 1, y: 2 });
        cd.drawCurve(new Bezier(0, 0, 5, 5, 10, 0));
        expect(calls).toMatchSnapshot();
    });
    it('drawPoint / drawPoints / drawCircle / drawArc / drawLine', () => {
        const { ctx, calls } = make_ctx();
        const cd = new TB_CanvasDraw(ctx);
        cd.drawPoint({ x: 1, y: 1 });
        cd.drawPoints([{ x: 1, y: 1 }, { x: 2, y: 2 }], { x: 10, y: 10 });
        cd.drawCircle({ x: 0, y: 0 }, 7);
        cd.drawArc({ x: 0, y: 0, r: 5, s: 0, e: 1 });
        cd.drawLine({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 5 });
        expect(calls).toMatchSnapshot();
    });
    it('drawSkeleton: 3차/2차, nocoords', () => {
        const { ctx, calls } = make_ctx();
        const cd = new TB_CanvasDraw(ctx);
        cd.drawSkeleton(make_curve());
        cd.drawSkeleton(new Bezier(0, 0, 5, 5, 10, 0), undefined, true);
        expect(calls).toMatchSnapshot();
    });
    it('drawNormalOnCurve / drawNormalLine', () => {
        const { ctx, calls } = make_ctx();
        const cd = new TB_CanvasDraw(ctx);
        cd.drawNormalOnCurve(make_curve(), 0.5, 10);
        cd.drawNormalLine({ x: 0, y: 0 }, { x: 0, y: 1 }, 10);
        expect(calls).toMatchSnapshot();
    });
    it('TB_Path.drawOnCanvas: 직선은 drawLine, 곡선은 drawCurve + drawSkeleton', () => {
        const { ctx, calls } = make_ctx();
        const p = new TB_Path('M0 0 L100 0 C150 100 200 100 250 0');
        p.drawOnCanvas(ctx);
        expect(calls).toMatchSnapshot();
    });
});
