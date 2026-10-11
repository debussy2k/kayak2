/*
    Parity 테스트: 원본 seglayer_manager.js(legacy) vs 현재 src/engine/segment/seglayer_manager.
    레이어는 양쪽 모두 원본(legacy)을 쓴다 — 매니저 로직(history stack, 레이어 분배)만 비교한다.
    TextBox.js와 같은 순서로 레이어를 구성한다: [Par, Doc, FontSize, Bold]
*/
import { describe, it } from 'vitest';
import assert from 'assert';
import SEGC from '../../../src/engine/segment/segment_const';
import ATTR_FontSize from '../../../src/engine/segment/ATTR_FontSize';
import ATTR_Bold from '../../../src/engine/segment/ATTR_Bold';
import ATTR_Par from '../../../src/engine/segment/ATTR_Par';
import ATTR_Doc from '../../../src/engine/segment/ATTR_Doc';
import SeglayerManager from '../../../src/engine/segment/seglayer_manager';
import Old_SeglayerManager from './legacy/seglayer_manager';
import Old_segmentLayer from './legacy/seglayer';
import Old_segmentLayer_Par from './legacy/seglayer_par';
import { mulberry32, apply } from './parity_helpers';

const STEPS = 300;
const SEEDS = [7, 8, 9];

function make_layers() {
    const par = new Old_segmentLayer_Par(SEGC.GRAVITY_RIGHT, 'ATTR_Par', ATTR_Par.prototype);
    par.insert_newline(0, new ATTR_Par(0));
    const doc = new Old_segmentLayer_Par(SEGC.GRAVITY_LEFT, 'ATTR_Doc', ATTR_Doc.prototype, { accept_newline: false });
    doc.insert(0, new ATTR_Doc());
    const fsize = new Old_segmentLayer(SEGC.GRAVITY_LEFT, 'ATTR_FontSize', ATTR_FontSize.prototype);
    fsize.insert(0, new ATTR_FontSize(10));
    const bold = new Old_segmentLayer(SEGC.GRAVITY_LEFT, 'ATTR_Bold', ATTR_Bold.prototype);
    bold.insert(0, new ATTR_Bold(false));
    return [par, doc, fsize, bold];
}

function make_mgr(Ctor) {
    const mgr = new Ctor();
    make_layers().forEach(l => mgr.add(l));
    mgr.reset_history();
    return mgr;
}

// 모든 레이어에 넣을 type-B attr 묶음 (TextBox.js의 insert 호출과 같은 모양)
function attrs_for_all(fsize, bold) {
    return {
        ATTR_Par: new ATTR_Par(0),
        ATTR_Doc: new ATTR_Doc(),
        ATTR_FontSize: new ATTR_FontSize(fsize),
        ATTR_Bold: new ATTR_Bold(bold),
    };
}

function stack_tags(mgr) {
    return mgr.get_history_stack().map(e => ({
        item: e.item === 'all' ? 'all' : e.item === 'none' ? 'none'
            : Array.isArray(e.item) ? e.item.map(l => l._attr_class_name) : 'single',
        command_auto_play: e.command_auto_play,
    }));
}

function state_of(mgr) {
    const obj = {};
    mgr.saveToObject(obj);
    return {
        obj,
        pointer: mgr.get_history_stack_pointer(),
        can_undo: mgr.can_undo(),
        can_redo: mgr.can_redo(),
        stack: stack_tags(mgr),
    };
}

describe('Parity: seglayer_manager', function () {
    SEEDS.forEach(seed => {
        it(`무작위 명령 시퀀스 ${STEPS}회 (seed=${seed})`, function () {
            const rnd = mulberry32(seed);
            const ri = (n) => Math.floor(rnd() * n);
            const oldM = make_mgr(Old_SeglayerManager);
            const newM = make_mgr(SeglayerManager);
            const total_of = (m) => m.get_segPar().getElementTotal();

            for (let step = 0; step < STEPS; step++) {
                const total = total_of(oldM);
                const op = ri(11);
                let ctx = `seed=${seed} step=${step}`;
                let oldR, newR;

                if (op <= 1) { // insert (type-B)
                    const pos = ri(total + 1);
                    const fs = [10, 20][ri(2)], bd = rnd() < 0.5;
                    ctx += ` insert(${pos})`;
                    oldR = apply(() => oldM.insert(pos, attrs_for_all(fs, bd)));
                    newR = apply(() => newM.insert(pos, attrs_for_all(fs, bd)));
                } else if (op === 2) { // insert_newline
                    const pos = ri(total + 1);
                    ctx += ` insert_newline(${pos})`;
                    oldR = apply(() => oldM.insert_newline(pos, new ATTR_Par(0)));
                    newR = apply(() => newM.insert_newline(pos, new ATTR_Par(0)));
                } else if (op === 3) { // insert_string
                    const pos = ri(total + 1);
                    const arr = new Array(1 + ri(3)).fill(65);
                    ctx += ` insert_string(${pos}, len=${arr.length})`;
                    oldR = apply(() => oldM.insert_string(pos, arr, attrs_for_all(10, false)));
                    newR = apply(() => newM.insert_string(pos, arr, attrs_for_all(10, false)));
                } else if (op === 4 && total > 1) { // erase (마지막 $는 남긴다)
                    const b = ri(total - 1);
                    const e = b + 1 + ri(total - 1 - b);
                    ctx += ` erase(${b}, ${e})`;
                    oldR = apply(() => oldM.erase(b, e));
                    newR = apply(() => newM.erase(b, e));
                } else if (op === 5 && total > 0) { // set (char attr)
                    const b = ri(total);
                    const e = b + 1 + ri(total - b);
                    const fs = [10, 20, 30][ri(3)];
                    const opt = rnd() < 0.3 ? { command_auto_play: 'run' } : undefined;
                    ctx += ` set(${b}, ${e}, FontSize ${fs})`;
                    oldR = apply(() => oldM.set(b, e, new ATTR_FontSize(fs), null, opt));
                    newR = apply(() => newM.set(b, e, new ATTR_FontSize(fs), null, opt));
                } else if (op === 6 && total > 0) { // set (par attr with setMask)
                    const b = ri(total);
                    const e = b + ri(total + 1 - b);
                    const align = ['left', 'center', 'right'][ri(3)];
                    ctx += ` set(${b}, ${e}, Par align=${align})`;
                    oldR = apply(() => oldM.set(b, e, new ATTR_Par(0), { m_Align: align }));
                    newR = apply(() => newM.set(b, e, new ATTR_Par(0), { m_Align: align }));
                } else if (op === 7 && total > 1) { // copy + paste (local clipboard)
                    const b = ri(total - 1);
                    const e = b + 1 + ri(total - 1 - b);
                    const pos = ri(total);
                    ctx += ` copy(${b},${e})+paste(${pos})`;
                    oldR = apply(() => { oldM.copy(b, e); return oldM.paste(pos, [], null); });
                    newR = apply(() => { newM.copy(b, e); return newM.paste(pos, [], null); });
                } else if (op === 8 && total > 0) { // paste plain string
                    const pos = ri(total);
                    ctx += ` paste(${pos}, "AB")`;
                    oldR = apply(() => oldM.paste(pos, [65, 66], null));
                    newR = apply(() => newM.paste(pos, [65, 66], null));
                } else if (op === 9) { // undo
                    ctx += ' undo()';
                    oldR = apply(() => oldM.undo());
                    newR = apply(() => newM.undo());
                } else { // redo / nop
                    if (rnd() < 0.5) {
                        ctx += ' redo()';
                        oldR = apply(() => oldM.redo());
                        newR = apply(() => newM.redo());
                    } else {
                        ctx += ' nop()';
                        oldR = apply(() => oldM.nop());
                        newR = apply(() => newM.nop());
                    }
                }

                assert.strictEqual(newR.threw, oldR.threw, `${ctx}: 예외 발생 여부가 다름`);
                if (!oldR.threw)
                    assert.deepStrictEqual(newR.ret, oldR.ret, `${ctx}: 반환값이 다름`);
                assert.deepStrictEqual(state_of(newM), state_of(oldM), `${ctx}: 상태가 다름`);
            }
        });
    });

    it('set_history_limit은 매니저와 모든 레이어에 같은 상한을 적용한다', function () {
        const oldM = make_mgr(Old_SeglayerManager);
        const newM = make_mgr(SeglayerManager);
        oldM.set_history_limit(3);
        newM.set_history_limit(3);
        for (let i = 0; i < 6; i++) {
            oldM.insert(0, attrs_for_all(10, false));
            newM.insert(0, attrs_for_all(10, false));
        }
        assert.deepStrictEqual(state_of(newM), state_of(oldM));
        assert.strictEqual(newM.get_history_stack().length, 3);
        for (let i = 0; i < 4; i++) {
            assert.deepStrictEqual(newM.undo(), oldM.undo(), `undo ${i}`);
            assert.deepStrictEqual(state_of(newM), state_of(oldM), `undo ${i}`);
        }
    });
});
