/*
    src/engine/segment 회귀 테스트 공용 헬퍼.

    seglayer.js 하단의 doTest2()/doTest3() 주석 코드가 사용하던
    "문자열로 layer 상태 표현" 방식을 따른다.
      - 'A' = FontSize 10, 'B' = FontSize 20, 'C' = FontSize 30
*/
import SEGC from '../../../src/engine/segment/segment_const';
import GT_segmentLayer from '../../../src/engine/segment/seglayer';
import GT_segmentLayer_Par from '../../../src/engine/segment/seglayer_par';
import ATTR_FontSize from '../../../src/engine/segment/ATTR_FontSize';
import ATTR_Par from '../../../src/engine/segment/ATTR_Par';

var FSIZE_OF = { A: 10, B: 20, C: 30 };
var CH_OF = { 10: 'A', 20: 'B', 30: 'C' };

function make_char_layer() {
    return new GT_segmentLayer(SEGC.GRAVITY_LEFT, 'ATTR_FontSize', ATTR_FontSize.prototype);
}

function make_par_layer() {
    return new GT_segmentLayer_Par(SEGC.GRAVITY_RIGHT, 'ATTR_Par', ATTR_Par.prototype);
}

// "AABBC" 형태의 문자열로 char layer를 구성하고 history를 비운다.
// (문서 끝에 다른 속성을 insert하는 경로를 피하기 위해 뒤에서부터 pos 0에 삽입)
function make_char_input(str) {
    var layer = make_char_layer();
    for (var i = str.length - 1; i >= 0; --i)
        layer.insert(0, new ATTR_FontSize(FSIZE_OF[str[i]]));
    layer.reset_history();
    return layer;
}

function char_layer_to_string(layer) {
    return layer._get_vec().map(function(seg) {
        var ch = CH_OF[seg.FontSize];
        return (ch === undefined ? '?' : ch).repeat(seg.m_nCount);
    }).join('');
}

// "AA$BB$" 형태의 문자열로 par layer를 구성하고 history를 비운다.
function make_par_input(str, nLineGap) {
    var layer = make_par_layer();
    for (var i = str.length - 1; i >= 0; --i) {
        if (str[i] === '$')
            layer.insert_newline(0, new ATTR_Par(nLineGap || 10));
        else
            layer.insert(0, new ATTR_Par(nLineGap || 10));
    }
    layer.reset_history();
    return layer;
}

function counts_of(layer) {
    return layer._get_vec().map(function(seg) { return seg.m_nCount; });
}

export {
    SEGC,
    ATTR_FontSize,
    ATTR_Par,
    make_char_layer,
    make_par_layer,
    make_char_input,
    char_layer_to_string,
    make_par_input,
    counts_of
};
