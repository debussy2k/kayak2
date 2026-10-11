/*
    seglayer_manager.js / GT_SegHistory.js 결함 회귀 테스트.
    결함 번호는 PR #21의 src/segment_ts/docs/bug-report.md 기준.
*/
import { describe, it } from 'vitest';
import assert from 'assert';
import * as h from './helpers';
import GT_segmentLayer from '../../../src/engine/segment/seglayer';
import GT_segmentLayer_Par from '../../../src/engine/segment/seglayer_par';
import ATTR_Doc from '../../../src/engine/segment/ATTR_Doc';
import ATTR_Bold from '../../../src/engine/segment/ATTR_Bold';
import GT_SegHistory from '../../../src/engine/segment/GT_SegHistory';
import SeglayerManager from '../../../src/engine/segment/seglayer_manager';

var SEGC = h.SEGC;
var ATTR_FontSize = h.ATTR_FontSize;
var ATTR_Par = h.ATTR_Par;

// TextBox.js와 같은 순서로 layer를 구성한다. (빈 문서 = "$" 1글자)
function make_layers(opt) {
    var par = new GT_segmentLayer_Par(SEGC.GRAVITY_RIGHT, 'ATTR_Par', ATTR_Par.prototype);
    par.insert_newline(0, new ATTR_Par(0));
    var doc = new GT_segmentLayer_Par(SEGC.GRAVITY_LEFT, 'ATTR_Doc', ATTR_Doc.prototype, { accept_newline: false });
    doc.insert(0, new ATTR_Doc());
    var fsize = new GT_segmentLayer(SEGC.GRAVITY_LEFT, 'ATTR_FontSize', ATTR_FontSize.prototype);
    fsize.insert(0, new ATTR_FontSize(10));
    var layers = [par, doc, fsize];

    if (opt && opt.with_bold) {
        var bold = new GT_segmentLayer(SEGC.GRAVITY_LEFT, 'ATTR_Bold', ATTR_Bold.prototype);
        bold.insert(0, new ATTR_Bold(false));
        layers.push(bold);
    }
    return layers;
}

function make_mgr(layers) {
    var mgr = new SeglayerManager();
    layers.forEach(function(l) { mgr.add(l); });
    mgr.reset_history();
    return mgr;
}

function totals_of(layers) {
    return layers.map(function(l) { return l.getElementTotal(); });
}

// GT_MasterClipboard(singleton) 대신 같은 모양의 객체를 사용한다.
function make_clipboard() {
    return { m_srv: [], clear_all: function() { this.m_srv.length = 0; } };
}

describe('seglayer_manager.js', function() {

    describe('M5: get_next_history()의 can_redo 검사가 함수 참조와 비교됨', function() {
        it('redo할 항목이 없으면 null을 반환한다', function() {
            var mgr = make_mgr(make_layers());
            assert.strictEqual(mgr.get_next_history(), null);

            mgr.insert(0, new ATTR_FontSize(10));
            assert.strictEqual(mgr.get_next_history(), null);
        });

        it('undo 후에는 다음 history 항목을 반환한다 (회귀 방지)', function() {
            var mgr = make_mgr(make_layers());
            mgr.insert(0, new ATTR_FontSize(10));
            mgr.undo();
            var next = mgr.get_next_history();
            assert.ok(next);
            assert.strictEqual(next.item, 'all');
        });
    });

    describe('M8: erase() 중복 정의 정리', function() {
        it('erase(pos)는 한 글자를 지운다 (회귀 방지)', function() {
            var layers = make_layers();
            var mgr = make_mgr(layers);
            mgr.insert(0, new ATTR_FontSize(10));
            mgr.insert(0, new ATTR_FontSize(10));
            assert.deepStrictEqual(totals_of(layers), [3, 3, 3]);

            mgr.erase(0);
            assert.deepStrictEqual(totals_of(layers), [2, 2, 2]);
            mgr.undo();
            assert.deepStrictEqual(totals_of(layers), [3, 3, 3]);
        });
    });

    describe('M10: undo history 상한 옵션', function() {
        it('GT_SegHistory는 기본적으로 상한이 없다', function() {
            var hist = new GT_SegHistory();
            for (var i = 0; i < 1000; i++)
                hist.push_shi({ n: i });
            var count = 0;
            while (hist.getPrevStep())
                count++;
            assert.strictEqual(count, 1000);
        });

        it('GT_SegHistory에 상한을 주면 오래된 항목부터 버린다', function() {
            var hist = new GT_SegHistory();
            hist.set_history_limit(3);
            for (var i = 0; i < 5; i++)
                hist.push_shi({ n: i });

            assert.strictEqual(hist.getPointer(), 2);
            assert.strictEqual(hist.getPrevStep().n, 4);
            assert.strictEqual(hist.getPrevStep().n, 3);
            assert.strictEqual(hist.getPrevStep().n, 2);
            assert.strictEqual(hist.getPrevStep(), null);
            // 버려지지 않은 항목은 redo로 다시 갈 수 있다
            assert.strictEqual(hist.getNextStep().n, 2);
        });

        it('manager에 상한을 주면 manager와 모든 layer가 같은 깊이까지만 undo된다', function() {
            var layers = make_layers();
            var mgr = make_mgr(layers);
            mgr.set_history_limit(2);

            mgr.insert(0, new ATTR_FontSize(10)); // 총 2
            mgr.insert(0, new ATTR_FontSize(10)); // 총 3
            mgr.insert(0, new ATTR_FontSize(10)); // 총 4
            assert.strictEqual(mgr.get_history_stack().length, 2);

            assert.strictEqual(mgr.undo().err, SEGC.OK_ALL);
            assert.strictEqual(mgr.undo().err, SEGC.OK_ALL);
            assert.strictEqual(mgr.undo().err, SEGC.ERR_BEGIN_OF_HISTORY);
            assert.deepStrictEqual(totals_of(layers), [2, 2, 2]);

            assert.strictEqual(mgr.redo().err, SEGC.OK_ALL);
            assert.strictEqual(mgr.redo().err, SEGC.OK_ALL);
            assert.deepStrictEqual(totals_of(layers), [4, 4, 4]);
        });

        it('상한 설정 후에 add()한 layer에도 상한이 적용된다', function() {
            var layers = make_layers();
            var mgr = new SeglayerManager();
            mgr.set_history_limit(1);
            layers.forEach(function(l) { mgr.add(l); });
            mgr.reset_history();

            mgr.insert(0, new ATTR_FontSize(10));
            mgr.insert(0, new ATTR_FontSize(10));
            // 각 layer도 1단계만 보관해야 한다
            layers.forEach(function(l) {
                assert.strictEqual(l.undo(), SEGC.OK_ALL);
                assert.strictEqual(l.undo(), SEGC.ERR_BEGIN_OF_HISTORY);
            });
        });

        it('manager 기본값은 상한이 없다', function() {
            var layers = make_layers();
            var mgr = make_mgr(layers);
            for (var i = 0; i < 50; i++)
                mgr.insert(0, new ATTR_FontSize(10));
            for (var j = 0; j < 50; j++)
                assert.strictEqual(mgr.undo().err, SEGC.OK_ALL);
            assert.deepStrictEqual(totals_of(layers), [1, 1, 1]);
        });
    });

    describe('A3: layer 구성이 다른 클립보드 붙여넣기 시 크래시', function() {
        function copy_from(layers, b, e) {
            var src_mgr = make_mgr(layers);
            var clip = make_clipboard();
            src_mgr.copy(b, e);
            src_mgr.copy_layer_data(b, e, clip);
            return clip;
        }

        it('layer 수가 다른 클립보드는 아무것도 바꾸지 않고 오류를 반환한다', function() {
            // 3-layer 문서에서 복사한 클립보드를 4-layer(Bold 추가) 문서에 붙여넣는다.
            var small_clip = copy_from(make_layers(), 0, 1);
            assert.strictEqual(small_clip.m_srv.length, 3);

            var dst_layers = make_layers({ with_bold: true });
            var dst_mgr = make_mgr(dst_layers);

            var ret = dst_mgr.paste(0, '', small_clip);
            assert.notStrictEqual(ret, SEGC.OK_ALL);
            assert.deepStrictEqual(totals_of(dst_layers), [1, 1, 1, 1]);
            assert.strictEqual(dst_mgr.get_history_stack_pointer(), -1);
        });

        it('layer 순서가 다른 클립보드도 거부한다', function() {
            var clip = copy_from(make_layers({ with_bold: true }), 0, 1);
            // FontSize와 Bold의 순서를 바꾼다
            var tmp = clip.m_srv[2];
            clip.m_srv[2] = clip.m_srv[3];
            clip.m_srv[3] = tmp;

            var dst_layers = make_layers({ with_bold: true });
            var dst_mgr = make_mgr(dst_layers);
            var ret = dst_mgr.paste(0, '', clip);
            assert.notStrictEqual(ret, SEGC.OK_ALL);
            assert.deepStrictEqual(totals_of(dst_layers), [1, 1, 1, 1]);
        });

        it('layer 구성이 같은 클립보드는 정상적으로 붙여넣는다 (회귀 방지)', function() {
            var clip = copy_from(make_layers({ with_bold: true }), 0, 1);
            var dst_layers = make_layers({ with_bold: true });
            var dst_mgr = make_mgr(dst_layers);

            var ret = dst_mgr.paste(0, '', clip);
            assert.strictEqual(ret, SEGC.OK_ALL);
            assert.deepStrictEqual(totals_of(dst_layers), [2, 2, 2, 2]);
        });
    });
});
