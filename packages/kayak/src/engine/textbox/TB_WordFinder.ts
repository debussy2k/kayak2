import { TB_WordInfo } from './TB_WordInfo'
import type { TB_WordFetchParams } from './TB_WordFetch';


/**
 * @fileOverview 문자열에서 word 단위로 분석함.
 * @author  Harry
 */

/**
전체 알고리즘
1. shrink/stretch를 하여 binary search가 가능한 상태로 진행한다.
2. binary search를 함. step이 1이 되고 word.width < line_width 이면 정지한다.

shrink 하기
  - -8씩 word를 줄여간다. 
  -  word size가 8보다 작아지면 가능한 step을 계산하여 word를 줄인다.
  -  그리고 word.width가 line_width 내로 들어가면 다음 단계로 진행.

stretch 하기
  - +8씩 word를 늘린다.
  -  +8한 위치에서 word.width &gt; line_width 검사하여 참이면 다음 단계로 진행
  -  +8전에 ws나 eol이 나오면 거기까지 진행하고 적용가능한 step을 계산해 놓음.
  -  그리고 ws, eol까지에서 &nbsp;word.width &gt; line_width 이면 다음 단계로 진행

  -  +8 진행한다. 그 중 ws, eol이 나오면 그 만큼 진행한다. (&lt;+8)
  -  +8진행이면 depth는 0, 
  -  ws,eol 만났으면 +6에서 만나면 depth는 1(step:+4), 됨.
  -  ws,eol 경우에서 word.width &lt; line_width이면 word찾기 종료.
  -   그렇지 않으면 binary search단계로 진입하는데, depth는 1(step:+4)에서 시작하도록.
 */

export class TB_WordFinder {
    /**
        * @param  {Object} params - parameters
        * @param  {Number} line_width - 글줄  폭
        * @param  {Number} startAt - 문자열에서 분석을 시작할 위치(offset)
        * @return {Object} WordInfo object    
    */
    static findWord(params: TB_WordFetchParams, line_width: number, startAt: number): TB_WordInfo {
        var maxWordSize = params.maxWordSize;

        var wi = TB_WordFinder.scanWordInfo(params, startAt);

        if (wi.whiteSpace || wi.tab)
            return wi;
        if (wi.getCount() < maxWordSize && wi.dimension!.width_without_last_glyph_ws < line_width)
            return wi;
        else if (wi.getCount() == 1)
            return wi;

        // 이하는 word 하나가 line_width보다 큰 경우 최적의 시간내에 적합한 크기의 word를 찾는 과정임.

        TB_WordFinder.find_word_fit_to_line_width(wi, params, line_width);
        return wi;
	}
	
	static scanWordInfo(params: TB_WordFetchParams, startAt: number): TB_WordInfo {
        // 시작이 non-whietspace이면 white-space까지 찾기.
        // 시작이 whitespace이면 whitespace의 연속이 끝나는 곳 까지.
        // white space : space, \n, \t
        var s = params.parText;
        var maxWordSize = params.maxWordSize;

        var offset = startAt || 0;
        var wi = new TB_WordInfo;
        wi.whiteSpace = TB_WordFinder.isWhiteSpace(s[offset]);
        wi.tab = (s[offset] === '\t');
        wi.ci_base = params.ci_doc_par_text;
        wi.begin = startAt;
        wi.end = -1;

        var partext_length = params.parText.length;

        var wordSize = 0;
        if (wi.tab) {
            wi.end = offset + 1;
            wi.eol = (wi.end === partext_length);
        } else if (wi.whiteSpace === true) { // start with white-space
            var i = offset;
            for (; i < partext_length; i++)
                if (TB_WordFinder.isWhiteSpace(s[i]) === false) {
                    wi.end = i;
                    break
                }
            wi.end = i;
            if (i === partext_length)
                wi.eol = true;
        } else {
            var i = offset;
            for (; i < partext_length && wordSize < maxWordSize; i++) {
                if (TB_WordFinder.isWhiteSpace(s[i]) === true) {
                    wi.end = i;
                    break;
                }
                ++wordSize;
            }
            wi.end = i;
            if (i === partext_length)
                wi.eol = true;
        }

        wi.measureText(params);
        return wi;
    }

	static find_word_fit_to_line_width(wi: TB_WordInfo, params: TB_WordFetchParams, line_width: number): TB_WordInfo | void {
		var __loop_cost = 0;

        var step = [8, 4, 2, 1]; // 또는 [16, 8,4,2,1] 
        var depth = 0;
        var op_shrink = 1; // IE때문에 const 대신 var 사용
        var op_stretch = 2; // IE때문에 const 대신 var 사용
        var last_op = (wi.dimension!.width_without_last_glyph_ws >= line_width) ? op_shrink : op_stretch;

        // 1. shrink 또는 stretch를 하여 binary search 시행이 가능한 상태까지 진행한다.
        if (last_op === op_shrink) {
            while (wi.dimension!.width_without_last_glyph_ws >= line_width && wi.getCount() > 1) {
                ++__loop_cost;

                depth = TB_WordFinder.decide_depth_back(step, wi, depth);
                wi.end -= step[depth];
                wi.measureText(params);
            }
        } else {
            while (wi.dimension!.width_without_last_glyph_ws < line_width) {
                ++__loop_cost;

                var val = TB_WordFinder.advance_step(params.parText, wi, step[0]);
                wi.measureText(params);
                if (val.stop === true) {
                    if (wi.dimension!.width_without_last_glyph_ws < line_width)
                        return wi;
                    depth = TB_WordFinder.decide_depth(step, val.step, depth);
                    break;
                }
                // 여기 온 것은 +8진행한 상황. 그러면 depth는 0.
            }
        }

        //2. binary search방식으로 찾기.
        //   이 부분 부터는 ws, eol이 나올 수 없으로므(1단계를 거쳤기 때문) 쉽게 생각 할 것.
        while (true) {
            ++__loop_cost;

            depth = (depth + 1) === step.length ? depth : (depth + 1);

            if (wi.dimension!.width_without_last_glyph_ws >= line_width) { // shrink
                if (wi.getCount() == 1)
                    break;

                wi.end -= step[depth];
                wi.measureText(params);
                if (depth === (step.length - 1) && wi.dimension!.width_without_last_glyph_ws < line_width)
                    break;
            } else { // stretch
                wi.end += step[depth];
                wi.measureText(params);
                if (depth === (step.length - 1) && wi.dimension!.width_without_last_glyph_ws < line_width)
                    break;
            }
        }

        //console.log('loop_cost: ', __loop_cost);
        wi.__loop_cost = __loop_cost;
	}

    // private function ----------------------------------------------------------
    static decide_depth_back(step: number[], wi: TB_WordInfo, cur_depth: number): number {
        var count = wi.getCount();
        var depth = step.length - 1;
        for (var i = cur_depth; i < step.length; i++)
            if (count > step[i]) {
                depth = i;
                break;
            }
        return depth;
    }

    static advance_step(s: string, wi: TB_WordInfo, max_step: number): { stop: boolean; step: number } {
        var ret = {
            stop: false,
            step: 0
        }
        for (var i = 1; i < max_step; i++) {
            wi.end += 1;
            ret.step = i;
            if (wi.end === s.length || TB_WordFinder.isWhiteSpace(s[wi.end]) || s[wi.end] === '\t') {
                ret.stop = true;
                return ret;
            }
        }
        return ret;
    }

    static decide_depth(step: number[], count: number, cur_depth: number): number {
        var depth = step.length - 1;
        for (var i = cur_depth; i < step.length; i++)
            if (count > step[i]) {
                depth = i;
                break;
            }
        return depth;
    }

    static isWhiteSpace(__char: string): boolean {
        return __char === ' ' || __char === '\n';
    }
}