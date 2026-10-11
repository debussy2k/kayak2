/*
    geometry 특성 테스트 공용.
    - round(): 부동소수 출력을 6자리로 잘라 스냅샷을 안정시킨다.
    - seg_dump(): TB_LineSeg | Bezier를 비교 가능한 단순 객체로 바꾼다 (Bezier 인스턴스는 내부 캐시 필드가 많다).
*/
import Bezier from 'bezier-js';
import { TB_LineSeg } from '../../../src/engine/geometry/TB_LineSeg';

export function round(v, digits = 6) {
    if (typeof v === 'number')
        return Math.round(v * 10 ** digits) / 10 ** digits;
    if (Array.isArray(v))
        return v.map(x => round(x, digits));
    if (v && typeof v === 'object') {
        const o = {};
        for (const k of Object.keys(v)) o[k] = round(v[k], digits);
        return o;
    }
    return v;
}

export function seg_dump(seg) {
    if (seg.type == 'line')
        return { type: 'line', x0: seg.x0, y0: seg.y0, x1: seg.x1, y1: seg.y1 };
    return { type: 'curve', points: seg.points.map(p => ({ x: p.x, y: p.y })) };
}

export function segs_dump(segs) {
    return round(segs.map(seg_dump));
}

/** 좌우 대칭 3차 곡선 (100,0) → (250,0). findTbyDistance(길이/2)가 0.5여야 한다. */
export function make_curve() {
    return new Bezier(100, 0, 150, 100, 200, 100, 250, 0);
}

/** 직선 - 곡선 - 직선이 이어진 segment 배열 */
export function mixed_segments() {
    return [new TB_LineSeg(0, 0, 100, 0), make_curve(), new TB_LineSeg(250, 0, 350, 0)];
}

// SimpleTextBox.js의 test_for_textonpath()가 쓰던 닫힌 원형 경로 (반시계 방향). test/snapshot/text_on_path.test.js와 같다.
export const CIRCLE_CCW = 'M100, 200 C 155, 200, 200, 155, 200, 100 C 200, 45, 155, 0, 100, 0 C 45, 0, 0, 45, 0, 100 C 0, 155, 45, 200, 100, 200 Z';
