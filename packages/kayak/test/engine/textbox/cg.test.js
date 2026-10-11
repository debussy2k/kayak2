/*
    cg.js 특성 테스트. export되는 것은 CGMatrix뿐이므로 CGMatrix의 공개 동작만 고정한다.
    concat(m)은 this ∘ m (m을 먼저 적용) — translate().scale() 순서로 호출하면 점에는 scale이 먼저 적용된다.
*/
import { describe, it, expect } from 'vitest';
import { CGMatrix, CGPoint, CGSize, CGRect } from '../../../src/engine/textbox/cg';

// -0을 0으로 (toEqual은 Object.is로 비교해 -0 !== 0)
const r = (v, d = 10) => { const x = Math.round(v * 10 ** d) / 10 ** d; return x === 0 ? 0 : x; };
const pt = p => ({ x: r(p.x), y: r(p.y) });
const mat = m => ({ a: r(m.a), b: r(m.b), c: r(m.c), d: r(m.d), tx: r(m.tx), ty: r(m.ty) });

describe('CGMatrix', () => {
    it('인자 없이 만들면 단위행렬, 4개면 tx/ty는 0, 1개면 복사, set()은 this', () => {
        expect(mat(new CGMatrix())).toEqual({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
        expect(mat(new CGMatrix(2, 0, 0, 3))).toEqual({ a: 2, b: 0, c: 0, d: 3, tx: 0, ty: 0 });
        const src = new CGMatrix(1, 2, 3, 4, 5, 6);
        expect(mat(new CGMatrix(src))).toEqual({ a: 1, b: 2, c: 3, d: 4, tx: 5, ty: 6 });
        expect(src.set(9, 8, 7, 6)).toBe(src);
        expect(mat(src)).toEqual({ a: 9, b: 8, c: 7, d: 6, tx: 0, ty: 0 });
    });

    it('transformPoint는 {x,y} 객체와 (x, y) 두 인자를 모두 받고 CGPoint를 돌려준다', () => {
        const m = new CGMatrix().translate(10, 20);
        const p = m.transformPoint({ x: 1, y: 2 });
        expect(pt(p)).toEqual({ x: 11, y: 22 });
        expect(p.__typeinfo).toBe('CGPoint');
        expect(pt(m.transformPoint(1, 2))).toEqual({ x: 11, y: 22 });
        expect(pt(m.transform({ x: 1, y: 2 }))).toEqual({ x: 11, y: 22 });   // CGRect가 아니면 transformPoint
    });

    it('scale/rotate/translate는 this를 돌려주고, 나중에 호출한 변환이 점에 먼저 적용된다', () => {
        expect(pt(new CGMatrix().scale(2, 3).transformPoint(1, 1))).toEqual({ x: 2, y: 3 });
        expect(pt(new CGMatrix().rotate(Math.PI / 2).transformPoint(1, 0))).toEqual({ x: 0, y: 1 });
        expect(pt(new CGMatrix().translate(10, 0).scale(2, 2).transformPoint(1, 1))).toEqual({ x: 12, y: 2 });
        expect(pt(new CGMatrix().scale(2, 2).translate(10, 0).transformPoint(1, 1))).toEqual({ x: 22, y: 2 });
    });

    it('rotateAtCenter는 중심을 기준으로 회전하고 this를 돌려주지 않는다', () => {
        const m = new CGMatrix();
        expect(m.rotateAtCenter(Math.PI, { x: 1, y: 1 })).toBeUndefined();
        expect(pt(m.transformPoint(2, 1))).toEqual({ x: 0, y: 1 });
        expect(pt(m.transformPoint(1, 1))).toEqual({ x: 1, y: 1 });
    });

    it('setInverse는 역행렬로 바꾼다', () => {
        const m = new CGMatrix().translate(5, 7).scale(2, 2);
        const p = m.transformPoint(3, 4);
        expect(pt(new CGMatrix(m).setInverse().transformPoint(p))).toEqual({ x: 3, y: 4 });
    });

    it('setTranslation은 (tx, ty)와 {x, y}를 모두 받고 concat은 this를 돌려준다', () => {
        expect(mat(new CGMatrix().setTranslation({ x: 3, y: 4 }))).toEqual({ a: 1, b: 0, c: 0, d: 1, tx: 3, ty: 4 });
        const m = new CGMatrix().setScale(2, 2);
        expect(m.concat(new CGMatrix().setTranslation(1, 1))).toBe(m);
        expect(mat(m)).toEqual({ a: 2, b: 0, c: 0, d: 2, tx: 2, ty: 2 });
    });
});

describe('jQuery 없는 환경 (issues.md #9)', () => {
    it('CGPoint/CGSize/CGRect.set에 plain 객체나 숫자를 주면 $를 참조하지 않고 복사한다', () => {
        expect(new CGPoint({ x: 1, y: 2 })).toMatchObject({ x: 1, y: 2 });
        expect(new CGSize({ width: 3, height: 4 })).toMatchObject({ width: 3, height: 4 });
        expect(new CGSize(5)).toMatchObject({ width: 5, height: 5 });   // 숫자 하나면 정사각
        const rc = new CGRect({ x: 1, y: 2, width: 3, height: 4 });
        expect([rc.origin.x, rc.origin.y, rc.size.width, rc.size.height]).toEqual([1, 2, 3, 4]);
    });
});
