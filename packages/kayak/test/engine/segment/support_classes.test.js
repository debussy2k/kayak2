/*
    보조 클래스 단위 테스트: GT_SegHistory, GT_SegRange, GT_PasteInfo.
    TS 전환 전 JS 상태에서 통과하는 것을 먼저 확인하고, 전환 후에도 그대로 통과해야 한다.
*/
import { describe, it } from 'vitest';
import assert from 'assert';
import GT_SegHistory from '../../../src/engine/segment/GT_SegHistory';
import GT_SegRange from '../../../src/engine/segment/GT_SegRange';
import GT_PasteInfo from '../../../src/engine/segment/GT_PasteInfo';
import ATTR_FontSize from '../../../src/engine/segment/ATTR_FontSize';

function make_shi(tag) {
    const before = new GT_SegRange();
    before.m_nFirstSegIndex = tag;
    const after = new GT_SegRange();
    after.m_nFirstSegIndex = tag + 100;
    return { m_pSegRngBefore: before, m_pSegRngAfter: after };
}

describe('GT_SegHistory', function () {
    it('초기 상태에서 getPrevStep/getNextStep/getLastStep은 null을 반환한다', function () {
        const h = new GT_SegHistory();
        assert.strictEqual(h.getPrevStep(), null);
        assert.strictEqual(h.getNextStep(), null);
        assert.strictEqual(h.getLastStep(), null);
        assert.strictEqual(h.getPointer(), -1);
    });

    it('push_shi 후 undo(getPrevStep)/redo(getNextStep) 포인터가 올바르게 이동한다', function () {
        const h = new GT_SegHistory();
        const s1 = make_shi(1), s2 = make_shi(2);
        h.push_shi(s1);
        h.push_shi(s2);
        assert.strictEqual(h.getPointer(), 1);
        assert.strictEqual(h.getLastStep(), s2);
        assert.strictEqual(h.getPrevStep(), s2);
        assert.strictEqual(h.getPrevStep(), s1);
        assert.strictEqual(h.getPrevStep(), null);
        assert.strictEqual(h.getNextStep(), s1);
        assert.strictEqual(h.getNextStep(), s2);
        assert.strictEqual(h.getNextStep(), null);
    });

    it('undo 후 push_shi하면 redo 브랜치가 잘려나간다', function () {
        const h = new GT_SegHistory();
        const s1 = make_shi(1), s2 = make_shi(2), s3 = make_shi(3);
        h.push_shi(s1);
        h.push_shi(s2);
        h.getPrevStep();
        h.push_shi(s3);
        assert.strictEqual(h.getLastStep(), s3);
        assert.strictEqual(h.getNextStep(), null);
        assert.strictEqual(h.getPrevStep(), s3);
        assert.strictEqual(h.getPrevStep(), s1);
    });

    it('reset하면 초기 상태로 돌아간다', function () {
        const h = new GT_SegHistory();
        h.push_shi(make_shi(1));
        h.reset();
        assert.strictEqual(h.getPointer(), -1);
        assert.strictEqual(h.getLastStep(), null);
    });

    it('set_history_limit(n)을 넘으면 가장 오래된 항목부터 버린다 (PR #23 M10)', function () {
        const h = new GT_SegHistory();
        h.set_history_limit(2);
        const s1 = make_shi(1), s2 = make_shi(2), s3 = make_shi(3);
        h.push_shi(s1); h.push_shi(s2); h.push_shi(s3);
        assert.strictEqual(h.getPointer(), 1);
        assert.strictEqual(h.getPrevStep(), s3);
        assert.strictEqual(h.getPrevStep(), s2);
        assert.strictEqual(h.getPrevStep(), null);
    });

    it('set_history_limit(0)은 무제한이다', function () {
        const h = new GT_SegHistory();
        h.set_history_limit(0);
        for (let i = 0; i < 50; i++) h.push_shi(make_shi(i));
        assert.strictEqual(h.getPointer(), 49);
    });
});

describe('GT_SegRange', function () {
    it('clear는 모든 상태를 초기값으로 되돌린다', function () {
        const r = new GT_SegRange();
        r.m_SegVec.push(new ATTR_FontSize(10));
        r.m_nFirstSegIndex = 1;
        r.m_nLastSegIndex = 2;
        r.m_first_whole_seg = false;
        r.m_last_whole_seg = false;
        r.clear();
        assert.strictEqual(r.m_SegVec.length, 0);
        assert.strictEqual(r.m_nFirstSegIndex, -1);
        assert.strictEqual(r.m_nLastSegIndex, -1);
        assert.strictEqual(r.m_first_whole_seg, true);
        assert.strictEqual(r.m_last_whole_seg, true);
    });

    it('clone은 깊은 복사본을 만든다 (segment까지 clone)', function () {
        const r = new GT_SegRange();
        const a = new ATTR_FontSize(10);
        a.m_nCount = 5;
        r.m_SegVec.push(a);
        r.m_nFirstSegIndex = 1;
        const c = r.clone();
        assert.notStrictEqual(c.m_SegVec[0], a);
        assert.deepStrictEqual(c.m_SegVec[0].getDataObject(), a.getDataObject());
        assert.strictEqual(c.m_nFirstSegIndex, 1);
        c.m_SegVec[0].m_nCount = 99;
        assert.strictEqual(a.m_nCount, 5);
    });

    it('copy는 기존 내용을 비우고 src의 내용을 복사한다', function () {
        const src = new GT_SegRange();
        src.m_SegVec.push(new ATTR_FontSize(20));
        src.m_last_whole_seg = false;
        const dst = new GT_SegRange();
        dst.m_SegVec.push(new ATTR_FontSize(10));
        dst.copy(src);
        assert.strictEqual(dst.m_SegVec.length, 1);
        assert.strictEqual(dst.m_SegVec[0].FontSize, 20);
        assert.strictEqual(dst.m_last_whole_seg, false);
    });

    it('get_element_count는 모든 segment의 m_nCount 합을 반환한다', function () {
        const r = new GT_SegRange();
        const a = new ATTR_FontSize(10); a.m_nCount = 3;
        const b = new ATTR_FontSize(20); b.m_nCount = 4;
        r.m_SegVec.push(a, b);
        assert.strictEqual(r.get_element_count(), 7);
    });

    describe('make_from_string (char code 배열 기반)', function () {
        const attr = new ATTR_FontSize(10);

        it('LF(10)를 경계로 segment를 나눈다', function () {
            const r = new GT_SegRange();
            r.make_from_string([97, 98, 10, 99, 100], attr);   // "ab\ncd" → [3, 2]
            assert.deepStrictEqual(r.m_SegVec.map(s => s.m_nCount), [3, 2]);
            assert.strictEqual(r.m_first_whole_seg, true);
            assert.strictEqual(r.m_last_whole_seg, false);
        });

        it('LF로 끝나면 m_last_whole_seg=true', function () {
            const r = new GT_SegRange();
            r.make_from_string([97, 10], attr);
            assert.deepStrictEqual(r.m_SegVec.map(s => s.m_nCount), [2]);
            assert.strictEqual(r.m_last_whole_seg, true);
        });

        it('LF가 없으면 whole-seg 플래그가 모두 false', function () {
            const r = new GT_SegRange();
            r.make_from_string([97, 98], attr);
            assert.deepStrictEqual(r.m_SegVec.map(s => s.m_nCount), [2]);
            assert.strictEqual(r.m_first_whole_seg, false);
            assert.strictEqual(r.m_last_whole_seg, false);
        });
    });
});

describe('GT_PasteInfo', function () {
    it('기본값', function () {
        const p = new GT_PasteInfo();
        assert.strictEqual(p.m_last_newline_being_erased_case, false);
        assert.ok(Array.isArray(p.non_clipboard_copy_string));
        assert.strictEqual(p.non_clipboard_copy_string.length, 0);
    });
});
