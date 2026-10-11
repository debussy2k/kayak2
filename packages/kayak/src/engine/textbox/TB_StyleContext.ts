//D Layer
import type { StyleResultContext } from '../segment/types';

class TB_StyleContext implements StyleResultContext {
    css_data: Record<string, any>;         // 바로 css로 사용가능 한 것.
    raw_data: Record<string, any>;         // 계산후 css로 변환해야 하는 것.

    constructor() {
        this.css_data = {};
        this.raw_data = {};
    }

    // 참고 : ATTR_*.prototype.style_setter() 참고
    build_css_str(for_clipboard_export?: boolean): string {
        var css_str = '';
        var key: string;
        for (key in this.css_data) {
            if (typeof this.css_data[key] != 'object')
                css_str += this.css_data[key];
        }

        css_str += this.calc_raw_to_css_string();

        // clipboard로 복사된 항목은 paste된 이후
        // TextBox.js의 apply_span_style()함수에서 해석하여 사용된다.
        if (for_clipboard_export === true) {
            for (key in this.raw_data)
                css_str += '-kayak-' + key + ':' + this.raw_data[key] + ';';
        }

        return css_str;
    }

    has_letter_scale_x(): boolean {
        return (this.raw_data.hasOwnProperty('letter_scale_x') && this.raw_data.letter_scale_x != 100);
    }

    get_transformed_span(ch: string): string {
        var str = "<span style='display:inline-block; transform-origin:0% 0%;"
        str += "transform:scaleX(" + (this.raw_data.letter_scale_x/100) + ");";
        str += "'>" + ch + "</span>";
        return str;
    }

    need_for_split_to_every_single_span(): boolean {
        // 자간, 장평, kerning에 의해 적용된 margin 합이 0이 아니면 character별로 span을 할당해야 한다.
        if (this.raw_data.letter_space != 0)
            return true;
        else if (this.raw_data.letter_scale_x !== 100)
            return true;

        return false;
    }

    private calc_raw_to_css_string(): string {
        var css_str = '';

        // for "margin-right". 자간, 장평, kerning등이 해당함.
        var sum = 0;
        if (this.raw_data.letter_space != undefined)
            sum += this.raw_data.letter_space;

        css_str += 'margin-right:' + (sum / 1000) + 'em;'
        return css_str;
    }
}

export default TB_StyleContext;
