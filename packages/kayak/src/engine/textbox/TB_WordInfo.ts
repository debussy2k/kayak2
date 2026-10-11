import * as log from "loglevel";
import type { TB_WordFetchParams } from './TB_WordFetch';
import type { TB_RangeMetric } from './TB_RangeMetric';

/** 
 * TB_WordInfo class
 * @constructor
 * @property {Bool} this.whiteSpace 공백문자열인지 여부
 * @property {Bool} this.tab tab	문자 여부
 * @property {Number} this.ci_base 	전체 document상에서의 시작 offset
 * @property {Number} this.begin	word의 시작 (ci_base 기준)
 * @property {Number} this.end 		word의 끝 (ci_base 기준)
 * @property {Bool} this.eol		end of line 여부
 * @property {String} this.text 	word의 문자.
 * @property {Object} this.dimension {width, height}
 */
export class TB_WordInfo {
    whiteSpace: boolean;
    tab: boolean;
    ci_base: number;
    begin: number;
    end: number;
    eol: boolean;
    last_none_ws_word: boolean;
    text: string;
    dimension: TB_RangeMetric | null;
    /** TB_WordFinder.find_word_fit_to_line_width()가 붙인다 (디버그용) */
    __loop_cost?: number;

    constructor() {
        this.whiteSpace = false;
        this.tab = false;
        this.ci_base = 0; // 
        this.begin = 0;
        this.end = -1;
        this.eol = false;
        // paragraph text내에서 마지막 none white space word인지 여부.
        // measureText()이후에만 값이 제대로 확보됨.
        this.last_none_ws_word = false; 
        this.text = '';
        this.dimension = null;
    }

    getCount(): number {
        return this.end - this.begin;
    }

    /**
     * word의 width, height 측정
     * @function 
     * @param  {Object} params 
     * @return {}       리턴값 없음.
     */
    measureText(params: TB_WordFetchParams): void {
        // 5/15
        // word_ci_scope를 이용하여 css를 포함한 html string생성할 것.
        // 이것의 dimension을 얻도록 수정 하기.

        this.text = params.parText.slice(this.begin, this.end);

        // word_scope의 범위를 이용하여, seglayer의 서식을 뽑아낸다.
        var word_ci_scope = {
            begin: this.ci_base + this.begin,
            end: this.ci_base + this.end
        }

        this.dimension = params.tb.docFactory!.get_dimension_of_range(word_ci_scope, params.par_attr.m_Align);

        this.last_none_ws_word = false;
        if (this.whiteSpace == false) {
            this.last_none_ws_word = this.isLastNonWhiteSpaceWord(params.parText);
            // if (this.last_none_ws_word)
            //     log.debug("last_none_ws_word: ", this.text);
        }
    }

    // private
    isLastNonWhiteSpaceWord(s: string): boolean {
        let answer = true;
        for(let i=this.end; i<s.length; i++) {
            if (this.isWhiteSpace(s[i]) == false) {
                answer = false;
                break;
            }
        }
        return answer;
    }
    isWhiteSpace(__char: string): boolean {
        return __char === ' ' || __char === '\n';
    }    
}
