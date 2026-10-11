import type { BuiltWord } from './types';

class TB_LineMetric {
    domPar: any;
    lineWidth: number;
    is_first_line_on_doc: boolean;
    is_last_line_on_doc: boolean;
    is_last_line: boolean;
    content_width: number;
    trailing_ws_px: number;
    trailing_ws_count: number;
    last_glyph_white_space: number;
    max_height: number;
    max_ascent: number;
    max_ascent_d: number;
    max_descent: number;
    max_font_size_px: number;
    ci_lbegin_doc: number;

    constructor(domPar: any) {
        this.domPar = domPar;
        this.lineWidth = 0;
        // 여기서 부터는 계산 결과값
        this.is_first_line_on_doc = false;  // 문서에서 제일 첫번째 라인인지 여부. first line baseline offset 적용을 위해 필요.
        this.is_last_line_on_doc = false;   // 문서에서 가장 마지막 라인인지 여부. 
        this.is_last_line = false;          // par에서 마지막 line인지 여부.
        this.content_width = 0;             // 실제 문자가 차지하는 폭
        this.trailing_ws_px = 0;            // 글줄 마지막에 있는 공백문자열의 폭(unit:pixel). 
        this.trailing_ws_count = 0;         // 글줄 마지막에 있는 공백문자열의 갯수
        this.last_glyph_white_space = 0;    // 글줄 마지막 glyph의 glyph부분을 제외한 white space의 폭 (letter spacing과 장평적용으로 인해 생기는 영역)
                                            // align right시 마지막 공백을 제외한 실제 문자열을 오른쪽 끝에 맞추기 위해 필요.
        this.max_height = 0;
        this.max_ascent = 0;
        this.max_ascent_d = 0;
        this.max_descent = 0;
        this.max_font_size_px = 0;
        this.ci_lbegin_doc = 0;
    }
    
    set_zero(): void {
        this.content_width = 0;
        this.trailing_ws_px = 0;
        this.trailing_ws_count = 0;    
        this.last_glyph_white_space = 0;
        this.max_height = 0;
        this.max_ascent = 0;
        this.max_ascent_d = 0;
        this.max_descent = 0;
        this.max_font_size_px = 0;
    }

    measure_by_adding_word(word: BuiltWord): void {
        this.content_width += word.width;

        if (word.whiteSpace) {
            this.trailing_ws_px = word.width;
            this.trailing_ws_count = word.text.length;
        }

        if (word.whiteSpace == false)
            this.last_glyph_white_space = word.last_glyph_white_space;

        
        if (word.ascent_d > this.max_ascent_d) {
        // if (word.height > this.max_height) {
            this.max_height       = word.height;
            this.max_ascent       = word.ascent;
            this.max_ascent_d     = word.ascent_d;
            this.max_descent      = word.descent;
            this.max_font_size_px = word.max_font_size_px;
        }
    }
}


export { 
	TB_LineMetric
};
