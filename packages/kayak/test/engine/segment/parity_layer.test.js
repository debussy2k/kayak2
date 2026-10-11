/*
    Parity(동등성) 테스트: 원본 JS(test/engine/segment/legacy) vs 현재 src/engine/segment 구현.

    결정론적 PRNG로 만든 같은 편집 명령 시퀀스를 양쪽 레이어에 적용하고
    매 단계 상태(getDataObject)·반환값·예외 여부를 비교한다.
    ATTR 클래스는 양쪽이 같은 것(src/segment의 TS)을 쓴다. 비교 대상은 레이어 로직뿐이다.

    TS 전환 전에는 "원본 vs 원본"이라 당연히 통과한다. 전환 후에도 통과해야 한다.
*/
import { describe, it } from 'vitest';
import assert from 'assert';
import SEGC from '../../../src/engine/segment/segment_const';
import ATTR_FontSize from '../../../src/engine/segment/ATTR_FontSize';
import ATTR_Par from '../../../src/engine/segment/ATTR_Par';
import ATTR_Doc from '../../../src/engine/segment/ATTR_Doc';
import GT_PasteInfo from '../../../src/engine/segment/GT_PasteInfo';
import GT_segmentLayer from '../../../src/engine/segment/seglayer';
import GT_segmentLayer_Par from '../../../src/engine/segment/seglayer_par';
import Old_segmentLayer from './legacy/seglayer';
import Old_segmentLayer_Par from './legacy/seglayer_par';
import { mulberry32, apply, assert_same_step } from './parity_helpers';

const STEPS = 400;
const SEEDS = [11, 22, 33, 44, 55];

describe('Parity: char layer (GT_segmentLayer)', function () {
    SEEDS.forEach(seed => {
        it(`무작위 편집 시퀀스 ${STEPS}회 (seed=${seed})`, function () {
            const rnd = mulberry32(seed);
            const FSIZES = [10, 20, 30];
            const oldL = new Old_segmentLayer(SEGC.GRAVITY_LEFT, 'ATTR_FontSize', ATTR_FontSize.prototype);
            const newL = new GT_segmentLayer(SEGC.GRAVITY_LEFT, 'ATTR_FontSize', ATTR_FontSize.prototype);
            const ri = (n) => Math.floor(rnd() * n);

            for (let step = 0; step < STEPS; step++) {
                const total = oldL.getElementTotal();
                let op = ri(10);
                if (total === 0 && op !== 0)
                    op = 0; // 빈 layer에서는 insert만 가능

                let ctx = `seed=${seed} step=${step}`;
                let oldR, newR;

                if (op <= 2) { // insert (가중치 3)
                    const pos = ri(total + 1);
                    const useNull = total > 0 && rnd() < 0.3;
                    const fsize = FSIZES[ri(3)];
                    ctx += ` insert(${pos}, ${useNull ? 'null' : fsize})`;
                    oldR = apply(() => oldL.insert(pos, useNull ? null : new ATTR_FontSize(fsize)));
                    newR = apply(() => newL.insert(pos, useNull ? null : new ATTR_FontSize(fsize)));
                } else if (op === 3) { // insert_string
                    const pos = ri(total + 1);
                    const len = 1 + ri(3);
                    const fsize = FSIZES[ri(3)];
                    const arr = new Array(len).fill(65);
                    ctx += ` insert_string(${pos}, len=${len}, ${fsize})`;
                    oldR = apply(() => oldL.insert_string(pos, arr, new ATTR_FontSize(fsize)));
                    newR = apply(() => newL.insert_string(pos, arr, new ATTR_FontSize(fsize)));
                } else if (op === 4) { // erase
                    const b = ri(total);
                    const e = b + 1 + ri(total - b);
                    ctx += ` erase(${b}, ${e})`;
                    oldR = apply(() => oldL.erase(b, e));
                    newR = apply(() => newL.erase(b, e));
                } else if (op === 5) { // set
                    const b = ri(total);
                    const e = b + 1 + ri(total - b);
                    const fsize = FSIZES[ri(3)];
                    ctx += ` set(${b}, ${e}, ${fsize})`;
                    oldR = apply(() => oldL.set(b, e, new ATTR_FontSize(fsize)));
                    newR = apply(() => newL.set(b, e, new ATTR_FontSize(fsize)));
                } else if (op === 6) { // copy + paste (문서 끝 paste(total) 포함)
                    const b = ri(total);
                    const e = b + 1 + ri(total - b);
                    const pos = ri(total + 1);
                    ctx += ` copy(${b},${e})+paste(${pos})`;
                    oldR = apply(() => { oldL.copy(b, e); return oldL.paste(pos, new GT_PasteInfo()); });
                    newR = apply(() => { newL.copy(b, e); return newL.paste(pos, new GT_PasteInfo()); });
                } else if (op === 7) { // 조회 (상태 불변)
                    const pos = ri(total + 1);
                    ctx += ` getAttr(${pos})`;
                    oldR = apply(() => { const a = oldL.getAttr(pos); return a ? a.getDataObject() : null; });
                    newR = apply(() => { const a = newL.getAttr(pos); return a ? a.getDataObject() : null; });
                } else if (op === 8) { // undo
                    ctx += ' undo()';
                    oldR = apply(() => oldL.undo());
                    newR = apply(() => newL.undo());
                } else { // redo
                    ctx += ' redo()';
                    oldR = apply(() => oldL.redo());
                    newR = apply(() => newL.redo());
                }

                assert_same_step(oldR, newR, oldL, newL, ctx);
            }
        });
    });
});

describe('Parity: par layer (GT_segmentLayer_Par)', function () {
    SEEDS.forEach(seed => {
        it(`무작위 편집 시퀀스 ${STEPS}회 (seed=${seed})`, function () {
            const rnd = mulberry32(seed);
            const LINEGAPS = [10, 20];
            const ALIGNS = ['left', 'center', 'right'];
            const oldL = new Old_segmentLayer_Par(SEGC.GRAVITY_RIGHT, 'ATTR_Par', ATTR_Par.prototype);
            const newL = new GT_segmentLayer_Par(SEGC.GRAVITY_RIGHT, 'ATTR_Par', ATTR_Par.prototype);
            const ri = (n) => Math.floor(rnd() * n);
            const make_attr = () => {
                const a = new ATTR_Par(LINEGAPS[ri(2)]);
                a.m_Align = ALIGNS[ri(3)];
                return a;
            };

            for (let step = 0; step < STEPS; step++) {
                const total = oldL.getElementTotal();
                let op = ri(10);
                if (total === 0 && op > 1)
                    op = ri(2); // 빈 layer에서는 insert/insert_newline만

                let ctx = `seed=${seed} step=${step}`;
                let oldR, newR;

                if (op === 0) { // insert
                    const pos = ri(total + 1);
                    const a = make_attr();
                    ctx += ` insert(${pos})`;
                    oldR = apply(() => oldL.insert(pos, a.clone()));
                    newR = apply(() => newL.insert(pos, a.clone()));
                } else if (op === 1 || op === 2) { // insert_newline (가중치 2)
                    const pos = ri(total + 1);
                    const a = make_attr();
                    ctx += ` insert_newline(${pos})`;
                    oldR = apply(() => oldL.insert_newline(pos, a.clone()));
                    newR = apply(() => newL.insert_newline(pos, a.clone()));
                } else if (op === 3) { // insert_string
                    const pos = ri(total + 1);
                    const len = 1 + ri(3);
                    const arr = new Array(len).fill(65);
                    ctx += ` insert_string(${pos}, len=${len})`;
                    oldR = apply(() => oldL.insert_string(pos, arr, null));
                    newR = apply(() => newL.insert_string(pos, arr, null));
                } else if (op === 4) { // erase
                    const b = ri(total);
                    const e = b + 1 + ri(total - b);
                    ctx += ` erase(${b}, ${e})`;
                    oldR = apply(() => oldL.erase(b, e));
                    newR = apply(() => newL.erase(b, e));
                } else if (op === 5) { // set (setMask 사용)
                    const b = ri(total + 1);
                    const e = b + ri(total + 1 - b);
                    const a = make_attr();
                    const align = ALIGNS[ri(3)];
                    ctx += ` set(${b}, ${e}, align=${align})`;
                    oldR = apply(() => oldL.set(b, e, a.clone(), { m_Align: align }));
                    newR = apply(() => newL.set(b, e, a.clone(), { m_Align: align }));
                } else if (op === 6) { // copy + paste
                    const b = ri(total);
                    const e = b + 1 + ri(total - b);
                    // paste(total)은 원본이 assert(false)만 찍고 아무것도 안 하는 경로라 console 노이즈만 생긴다. pos < total만 쓴다.
                    const pos = ri(total);
                    ctx += ` copy(${b},${e})+paste(${pos})`;
                    oldR = apply(() => { oldL.copy(b, e); return oldL.paste(pos, new GT_PasteInfo()); });
                    newR = apply(() => { newL.copy(b, e); return newL.paste(pos, new GT_PasteInfo()); });
                } else if (op === 7) { // query_if_last_newline_being_erased
                    const b = ri(total + 1);
                    ctx += ` query_if_last_newline_being_erased(${b}, ${total})`;
                    oldR = apply(() => oldL.query_if_last_newline_being_erased(b, total));
                    newR = apply(() => newL.query_if_last_newline_being_erased(b, total));
                } else if (op === 8) { // undo
                    ctx += ' undo()';
                    oldR = apply(() => oldL.undo());
                    newR = apply(() => newL.undo());
                } else { // redo
                    ctx += ' redo()';
                    oldR = apply(() => oldL.redo());
                    newR = apply(() => newL.redo());
                }

                assert_same_step(oldR, newR, oldL, newL, ctx);

                // par 전용 API: get_command_change_info 파생 정보도 비교
                const oldInfo = oldL.get_command_change_info('op');
                const newInfo = newL.get_command_change_info('op');
                if (oldInfo === null)
                    assert.strictEqual(newInfo, null, ctx);
                else {
                    assert.strictEqual(newInfo.history_pointer, oldInfo.history_pointer, ctx + ': history_pointer');
                    assert.strictEqual(newInfo.par_length, oldInfo.par_length, ctx + ': par_length');
                    assert.deepStrictEqual(
                        { f: newInfo.before.m_nFirstSegIndex, l: newInfo.before.m_nLastSegIndex, af: newInfo.after.m_nFirstSegIndex, al: newInfo.after.m_nLastSegIndex },
                        { f: oldInfo.before.m_nFirstSegIndex, l: oldInfo.before.m_nLastSegIndex, af: oldInfo.after.m_nFirstSegIndex, al: oldInfo.after.m_nLastSegIndex },
                        ctx + ': change_info 범위');
                }
            }
        });
    });
});

describe('Parity: doc layer (accept_newline=false)', function () {
    it('insert_newline이 insert로 동작하는 것까지 원본과 같다', function () {
        const oldL = new Old_segmentLayer_Par(SEGC.GRAVITY_LEFT, 'ATTR_Doc', ATTR_Doc.prototype, { accept_newline: false });
        const newL = new GT_segmentLayer_Par(SEGC.GRAVITY_LEFT, 'ATTR_Doc', ATTR_Doc.prototype, { accept_newline: false });
        oldL.insert(0, new ATTR_Doc());
        newL.insert(0, new ATTR_Doc());

        const rnd = mulberry32(99);
        for (let i = 0; i < 100; i++) {
            const total = oldL.getElementTotal();
            const r = rnd();
            if (r < 0.5) {
                const pos = Math.floor(rnd() * (total + 1));
                oldL.insert_newline(pos, null);
                newL.insert_newline(pos, null);
            } else if (r < 0.8 || total < 2) {
                const pos = Math.floor(rnd() * (total + 1));
                oldL.insert(pos, null);
                newL.insert(pos, null);
            } else {
                const b = Math.floor(rnd() * (total - 1));
                oldL.erase(b, b + 1);
                newL.erase(b, b + 1);
            }
            assert.deepStrictEqual(newL.getDataObject(), oldL.getDataObject(), `i=${i}`);
        }
    });
});
