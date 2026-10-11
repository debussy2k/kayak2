/*
    parity 테스트 공용: 결정론적 PRNG와 한 단계 비교 함수.
    (PR #21의 src/segment_ts/tests/helpers.ts · parity.test.ts에서 가져옴)
*/
import assert from 'assert';

/** 결정론적 PRNG. 같은 seed면 같은 시퀀스 */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** fn을 실행해 반환값과 예외 여부를 돌려준다 */
export function apply(fn) {
    try {
        return { ret: fn(), threw: false };
    } catch (e) {
        return { ret: undefined, threw: true };
    }
}

/** 한 단계의 결과(반환값·예외 여부)와 레이어 상태가 같은지 */
export function assert_same_step(oldR, newR, oldLayer, newLayer, ctx) {
    assert.strictEqual(newR.threw, oldR.threw, `${ctx}: 예외 발생 여부가 다름`);
    if (!oldR.threw)
        assert.deepStrictEqual(newR.ret, oldR.ret, `${ctx}: 반환값이 다름`);
    assert.deepStrictEqual(newLayer.getDataObject(), oldLayer.getDataObject(), `${ctx}: layer 상태가 다름`);
    assert.strictEqual(newLayer.getElementTotal(), oldLayer.getElementTotal(), `${ctx}: element total이 다름`);
}
