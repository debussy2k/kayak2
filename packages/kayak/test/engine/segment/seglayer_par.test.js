/*
    par layer(seglayer_par.js) 결함 회귀 테스트.
    결함 번호는 PR #21의 src/segment_ts/docs/bug-report.md 기준.
*/
import { describe, it } from 'vitest';
import assert from 'assert';
import * as h from './helpers';

var ATTR_Par = h.ATTR_Par;

function line_gaps_of(layer) {
    return layer._get_vec().map(function(seg) { return seg.m_nLineGap; });
}

describe('seglayer_par.js (par layer)', function() {

    describe('S4: 정의되지 않은 전역 assert() 호출', function() {
        it('오류 분기(빈 layer에 insert_string)에서 ReferenceError가 나지 않는다', function() {
            var layer = h.make_par_layer();
            var orig = console.assert;
            var assert_calls = 0;
            console.assert = function(expr) { if (!expr) assert_calls++; };
            try {
                layer.insert_string(0, [65], new ATTR_Par(10));
            } finally {
                console.assert = orig;
            }
            assert.strictEqual(assert_calls, 1);
        });
    });

    describe('S5: set(total, total) 시 TypeError', function() {
        it('문서 끝 위치에 set하면 마지막 par에 적용되고 undo된다', function() {
            var layer = h.make_par_input('AA$BB$');
            var total = layer.getElementTotal();

            layer.set(total, total, new ATTR_Par(30), { m_nLineGap: 30 });
            assert.deepStrictEqual(line_gaps_of(layer), [10, 30]);
            assert.deepStrictEqual(h.counts_of(layer), [3, 3]);

            layer.undo();
            assert.deepStrictEqual(line_gaps_of(layer), [10, 10]);
        });

        it('문서 중간 커서 위치 set은 기존대로 해당 par에 적용된다 (회귀 방지)', function() {
            var layer = h.make_par_input('AA$BB$');
            layer.set(1, 1, new ATTR_Par(30), { m_nLineGap: 30 });
            assert.deepStrictEqual(line_gaps_of(layer), [30, 10]);
        });
    });

    describe('M9: insert_newline이 전달받은 attr 객체를 그대로 저장', function() {
        it('par 앞(offset 0)에 newline을 넣어도 전달한 객체를 공유하지 않는다', function() {
            var layer = h.make_par_input('AA$');
            var attr = new ATTR_Par(20);
            layer.insert_newline(0, attr);
            assert.deepStrictEqual(line_gaps_of(layer), [20, 10]);
            assert.notStrictEqual(layer._get_vec()[0], attr);
        });

        it('문서 끝에 newline을 넣어도 전달한 객체를 공유하지 않는다', function() {
            var layer = h.make_par_input('AA$');
            var attr = new ATTR_Par(20);
            layer.insert_newline(3, attr);
            assert.deepStrictEqual(line_gaps_of(layer), [10, 20]);
            assert.notStrictEqual(layer._get_vec()[1], attr);
        });

        it('같은 attr로 newline을 여러 번 넣어도 전달한 객체가 vec에 들어가지 않는다', function() {
            var layer = h.make_par_layer();
            var attr = new ATTR_Par(10);
            layer.insert_newline(0, attr);
            layer.insert_newline(0, attr);
            var vec = layer._get_vec();
            assert.strictEqual(vec.length, 2);
            assert.notStrictEqual(vec[0], attr);
            assert.notStrictEqual(vec[1], attr);
        });
    });
});
