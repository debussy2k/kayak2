import { TB_WordFinder } from "./TB_WordFinder"
import type { TB_WordInfo } from './TB_WordInfo';
import * as log from "loglevel";
import type { TextBoxHost, BuiltWord } from './types';

export class TB_WordFetchParams {
    tb: TextBoxHost;
    tbcontext: any;
    maxWordSize: number;
    parText: string;
    ci_doc_par_text: number;
    par_attr: any;

    constructor(tb: TextBoxHost, parText: string, ci_doc_par_text: number, par_attr: any) {
        this.tb = tb;
        this.tbcontext = tb.tbcontext;
        this.maxWordSize = 24;
        //
        this.parText = parText;
        this.ci_doc_par_text = ci_doc_par_text,
        this.par_attr = par_attr;
    }
}

export class TB_WordFetch {
    /**
     * @param  {Object} params TB_WordFetchParams
     * @param  {Array} words  array of wordinfo object

        call graph. 
        fiindWord()                  word_fetch.js
        scanWordInfo()
        measureText()                TB_WordInfo.js
        get_textline_dimension()     TB_DocFactory.js
    */

    static get_words_contained_in_par_by_textlines(params: TB_WordFetchParams, line_width: number): TB_WordInfo[][] {
        var cur_index = 0;
        var wi: TB_WordInfo;

        let content_width = 0;
        let lines: TB_WordInfo[][] = [];
        let words: TB_WordInfo[] = [];
        let curr_width = 0;
        
        do {
            wi = TB_WordFinder.findWord(params, line_width, cur_index);   // word_fetch.js

            let whiteSpace = wi.tab || wi.whiteSpace;
            
            /* (A) 
                - letter-space값이 있는 경우 wi.dimension.width는 그것의 마지막 glyph의 letter-space값을 포함하고 있음.
                - line break을 판단할 때는 word의 마지막 whitespace를 제외하고 계산해야 함. 즉 width_without_last_glyph_ws을 사용함.
            */
            curr_width = content_width + wi.dimension!.width_without_last_glyph_ws;
            
            /* 글줄의 마지막 none white space word의 경우, 약간의 차이로 linebreak이 발생하는 것을 방지하는 기능
                - indesign에서는 한 줄에 다 나오지만, kayak에서는 마지막 word가 넘어가는 경우가 있음. 
                - 이를 threshold값에 따라 왠만하면 한 줄에 나오도록 보상함. 
            */
            if (wi.last_none_ws_word) {
                // log.debug('linebreak gap : ', line_width-curr_width)
                curr_width -= params.tb.tbconfig.linebreak_tolerance;
            }

            if (!whiteSpace && curr_width >= line_width) {
                if (words.length > 0) {
                    lines.push(words);
                    words = [];
                }
                content_width = 0;
            }

            content_width += wi.dimension!.width;   // 중요: (A)단계에서 비교시와는 달리 전체 wi.dimension.width를 증가시킨다.
            words.push(wi);
            
            cur_index = wi.end;
        } while (!wi.eol);

        console.assert(words.length > 0);
        lines.push(words);
        // console.log('lines: ', lines);

        return lines;
    }


    static build_word(wi: TB_WordInfo): BuiltWord {
        var ww: BuiltWord = {
            text: wi.text,
            width: wi.dimension!.width,
            last_glyph_white_space: wi.dimension!.last_glyph_white_space,
            height: wi.dimension!.height,
            ascent: wi.dimension!.ascent,
            ascent_d: wi.dimension!.ascent_d,
            descent: wi.dimension!.descent,
            max_font_size_px: wi.dimension!.max_font_size_px,
            whiteSpace: (wi.tab || wi.whiteSpace)
        };
        return ww;
    }
}
