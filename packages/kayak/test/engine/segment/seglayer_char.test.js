/*
    char layer(seglayer.js) 결함 회귀 테스트.
    결함 번호(S1, S3, ...)는 PR #21의 src/segment_ts/docs/bug-report.md 기준.
*/
import { describe, it } from 'vitest';
import assert from 'assert';
import * as h from './helpers';
import GT_PasteInfo from '../../../src/engine/segment/GT_PasteInfo';

var SEGC = h.SEGC;
var ATTR_FontSize = h.ATTR_FontSize;

function fs(ch) {
    return new ATTR_FontSize({ A: 10, B: 20, C: 30 }[ch]);
}

describe('seglayer.js (char layer)', function() {

    describe('S1: set 후 undo 시 뒤따르는 segment 유실', function() {
        it('병합이 일어나는 set을 undo하면 원래 상태로 복원된다', function() {
            // "AAACCBB" = [10x3, 30x2, 20x2]
            var layer = h.make_char_input('AAACCBB');

            layer.set(1, 3, fs('C')); // "AA"를 30pt로 → 뒤의 30pt와 병합
            assert.strictEqual(h.char_layer_to_string(layer), 'ACCCCBB');
            assert.deepStrictEqual(h.counts_of(layer), [1, 4, 2]);

            layer.undo();
            assert.strictEqual(h.char_layer_to_string(layer), 'AAACCBB');
            assert.deepStrictEqual(h.counts_of(layer), [3, 2, 2]);
        });

        it('undo 후 redo하면 set 결과가 다시 적용된다', function() {
            var layer = h.make_char_input('AAACCBB');
            layer.set(1, 3, fs('C'));
            layer.undo();
            layer.redo();
            assert.strictEqual(h.char_layer_to_string(layer), 'ACCCCBB');
            assert.deepStrictEqual(h.counts_of(layer), [1, 4, 2]);
        });

        it('병합이 없는 경우도 undo로 복원된다 (회귀 방지)', function() {
            var layer = h.make_char_input('AAACCBB');
            layer.set(1, 3, fs('B')); // 왼쪽(A)·오른쪽(C) 모두와 다름
            assert.strictEqual(h.char_layer_to_string(layer), 'ABBCCBB');
            layer.undo();
            assert.strictEqual(h.char_layer_to_string(layer), 'AAACCBB');
            assert.deepStrictEqual(h.counts_of(layer), [3, 2, 2]);
        });
    });

    describe('S3: 문서 끝까지 erase 후 undo 시 내용 중복 복원', function() {
        it('[30x1, 20x1]에서 erase(1,2) 후 undo하면 원래대로 복원된다', function() {
            var layer = h.make_char_input('CB');
            layer.erase(1, 2);
            assert.strictEqual(h.char_layer_to_string(layer), 'C');
            layer.undo();
            assert.strictEqual(h.char_layer_to_string(layer), 'CB');
            assert.strictEqual(layer.getElementTotal(), 2);
        });

        it('[10x3, 20x2]에서 erase(3,5) 후 undo/redo가 정확하다', function() {
            var layer = h.make_char_input('AAABB');
            layer.erase(3, 5);
            assert.strictEqual(h.char_layer_to_string(layer), 'AAA');
            layer.undo();
            assert.strictEqual(h.char_layer_to_string(layer), 'AAABB');
            assert.deepStrictEqual(h.counts_of(layer), [3, 2]);
            layer.redo();
            assert.strictEqual(h.char_layer_to_string(layer), 'AAA');
        });
    });

    describe('S4: 정의되지 않은 전역 assert() 호출', function() {
        it('문서 끝 위치에 paste해도 예외 없이 붙여넣어지고 undo된다', function() {
            var layer = h.make_char_input('AAB');
            layer.copy(0, 1); // [A x1]
            layer.paste(3, new GT_PasteInfo());
            assert.strictEqual(h.char_layer_to_string(layer), 'AABA');
            layer.undo();
            assert.strictEqual(h.char_layer_to_string(layer), 'AAB');
            assert.deepStrictEqual(h.counts_of(layer), [2, 1]);
        });

        it('문서 끝 paste에서 마지막 segment와 병합되는 경우도 undo된다', function() {
            var layer = h.make_char_input('AAB');
            layer.copy(2, 3); // [B x1]
            layer.paste(3, new GT_PasteInfo());
            assert.strictEqual(h.char_layer_to_string(layer), 'AABB');
            assert.deepStrictEqual(h.counts_of(layer), [2, 2]);
            layer.undo();
            assert.deepStrictEqual(h.counts_of(layer), [2, 1]);
        });

        it('오류 분기(빈 layer에 insert_string)에서 ReferenceError가 나지 않는다', function() {
            var layer = h.make_char_layer();
            var orig = console.assert;
            var assert_calls = 0;
            console.assert = function(expr) { if (!expr) assert_calls++; };
            try {
                layer.insert_string(0, [65, 65], fs('A'));
            } finally {
                console.assert = orig;
            }
            assert.strictEqual(assert_calls, 1);
        });
    });

    describe('M1: set(b,b)가 count 0인 segment를 만듦', function() {
        it('빈 범위 set은 layer를 바꾸지 않는다', function() {
            var layer = h.make_char_input('AAB');
            layer.set(1, 1, fs('C'));
            assert.deepStrictEqual(h.counts_of(layer), [2, 1]);
            assert.strictEqual(h.char_layer_to_string(layer), 'AAB');
        });

        it('빈 범위 set도 history 항목을 1개 남긴다 (manager와의 정렬 유지)', function() {
            var layer = h.make_char_input('AAB');
            layer.erase(0, 1);          // history #1
            layer.set(1, 1, fs('C'));   // history #2 (빈 항목)
            assert.strictEqual(layer.undo(), SEGC.OK_ALL); // #2 되돌림 → 변화 없음
            assert.strictEqual(h.char_layer_to_string(layer), 'AB');
            assert.strictEqual(layer.undo(), SEGC.OK_ALL); // #1 되돌림
            assert.strictEqual(h.char_layer_to_string(layer), 'AAB');
        });
    });

    describe('M11: 문서 끝에 다른 속성 insert 시 크래시', function() {
        it('문서 끝에 다른 속성을 insert하면 새 segment로 추가되고 undo된다', function() {
            var layer = h.make_char_input('AA');
            layer.insert(2, fs('B'));
            assert.strictEqual(h.char_layer_to_string(layer), 'AAB');
            layer.undo();
            assert.strictEqual(h.char_layer_to_string(layer), 'AA');
            assert.deepStrictEqual(h.counts_of(layer), [2]);
        });

        it('문서 끝에 같은 속성을 insert하면 마지막 segment가 늘어난다 (회귀 방지)', function() {
            var layer = h.make_char_input('AA');
            layer.insert(2, fs('A'));
            assert.deepStrictEqual(h.counts_of(layer), [3]);
        });
    });
});
