import type { TextBoxHost, FontItem, EditSel } from './types';
import type { TB_LocalFontLoader } from './TB_LocalFontLoader';

class TB_ApplyEditOperation {
    // tb가 schema mode이면 tb.fontloader가 null이므로 fontloader를 별도로 받는다.
    static apply_edit_operation(divs: Element[], tb: TextBoxHost, fontloader: TB_LocalFontLoader): Promise<number> | void {
        if (tb.tbconfig.text_render == 'html') {
            return new Promise((resolve, reject) => {
                let text_length = TB_ApplyEditOperation._apply_edit_operation(divs, tb);
                resolve(text_length);
            })
        }
        else if (tb.tbconfig.text_render == 'svg') {
            let font_arr = TB_ApplyEditOperation.collectFontFamily(divs);
            return fontloader.load_fonts(font_arr).then(() => {
                return TB_ApplyEditOperation._apply_edit_operation(divs, tb)
            })
        }
        else
            return alert('text_render not defined!!');
    }

    static _apply_edit_operation(divs: Element[], tb: TextBoxHost): number {

        var sel: EditSel = { begin: 0, end: 0 }
        divs.forEach(function (div) {
            var par_style = div.getAttribute('style');
            TB_ApplyEditOperation.apply_par_style(tb, sel, par_style!);


            TB_ApplyEditOperation.child_spans(div).forEach(function (span) {
                // console.log('text: ' + span.textContent);
                // tb.opEdit.insert_string(tb.tbcursor.cursor, span.textContent);
                let arr = TB_ApplyEditOperation.get_lines(span.textContent);
                arr.forEach(str => {
                    if (str.length == 1 && str.charCodeAt(0) == 10)
                        tb.opEdit.insert(tb.tbcursor.cursor, str.charCodeAt(0));
                    else
                        tb.opEdit.insert_string(tb.tbcursor.cursor, str);
                })
                // for(let i=0; i<span.textContent.length; i++) {
                //     tb.opEdit.insert(tb.tbcursor.cursor, span.textContent.charCodeAt(i));
                // }

                var span_style = span.getAttribute('style');
                // console.log('style: ' + span_style);

                sel.end += span.textContent.length;
                TB_ApplyEditOperation.apply_span_style(tb, sel, span_style!);
                sel.begin = sel.end;
            });
        })

        return sel.end;
    }

    // div의 직계 자식 중 <span>만 배열로 리턴함. (jQuery children('span') 대체)
    static child_spans(div: Element): HTMLElement[] {
        return Array.prototype.slice.call(div.children).filter(function (child) {
            return child.tagName === 'SPAN';
        });
    }

    static get_lines(str: string): string[] {
        let arr: string[] = []
        let b = 0, e = 0;
        for (let i = 0; i < str.length; i++) {
            if (str.charCodeAt(i) == 10) {
                if (b < e)
                    arr.push(str.substring(b, e));

                arr.push('\n');
                ++e;
                b = e;
            }
            else
                ++e;
        }

        if (b < e)
            arr.push(str.substring(b, e));

        return arr;
    }


    static collectFontFamily(divs: Element[]): FontItem[] {
        let usages: Record<string, FontItem> = {};
        divs.forEach(function (div) {
            TB_ApplyEditOperation.child_spans(div).forEach(function (span) {
                var span_style = span.getAttribute('style');
                // console.log('style: ' + span_style);
                TB_ApplyEditOperation.extract_fontfamily(span_style!, usages)
            });
        })

        let arr: FontItem[] = [];
        Object.keys(usages).forEach(key => {
            arr.push({
                familyName: usages[key].familyName,
                typeStyle: usages[key].typeStyle
            })
        })
        return arr;
    }
    static extract_fontfamily(span_style: string, usages: Record<string, FontItem>): void {
        var styles = span_style.split(';');
        styles.forEach(style => {
            var arr = style.trim().split(':');
            if (arr.length != 2)
                return;
            var key = arr[0].trim();
            var val = arr[1].trim();
            // ** 중요 **
            // val은 모두 string이므로, 아래 case에서 적절히 형변환을 해 주어야 함.
            switch (key) {
                case '-kayak-font_family':
                    var values = val.split(','); // values[0] : familyName, values[1] : typeStyle
                    //values[0], values[1]
                    usages[val] = {
                        familyName: values[0].trim(),
                        typeStyle: values[1].trim(),
                    }
                    break;
            }
        })
    }

    // private
    // --------------------------------------------------------------------------------------
    static apply_par_style(tb: TextBoxHost, sel: EditSel, par_style: string): void {
        var styles = par_style.split(';');
        styles.forEach(style => {
            var arr = style.split(':');
            if (arr[0] == undefined || arr[1] == undefined)
                return;
            var key = arr[0].trim();
            var val = arr[1].trim();
            switch (key) {
                case 'text-align':
                    tb.opStyle.set_text_align(val, sel);
                    break;
                case 'text-indent':
                    tb.opStyle.set_par_style('first', TB_ApplyEditOperation.get_number_part(val), sel);
                    break;
                case 'padding-left':
                    tb.opStyle.set_par_style('left', TB_ApplyEditOperation.get_number_part(val), sel);
                    break;
                case 'padding-right':
                    tb.opStyle.set_par_style('right', TB_ApplyEditOperation.get_number_part(val), sel);
                    break;
                case 'line-height':
                    tb.opStyle.set_par_style('line_space', isNaN(Number(val)) ? 1 : Number(val), sel);
                    break;
                case 'padding-bottom':
                    tb.opStyle.set_par_style('space_after', TB_ApplyEditOperation.get_number_part(val), sel);
                    break;
                case 'padding-top':
                    tb.opStyle.set_par_style('space_before', TB_ApplyEditOperation.get_number_part(val), sel);
                    break;
                case 'padding':
                    TB_ApplyEditOperation.apply_par_padding_style(val, tb, sel);
                    break;
            }
        })
    }

    static apply_par_padding_style(val: string, tb: TextBoxHost, sel: EditSel): void {
        var arr = val.split(" ");
        if (arr.length == 4) { // top right bottom left
            tb.opStyle.set_par_style('space_before', TB_ApplyEditOperation.get_number_part(arr[0]), sel);
            tb.opStyle.set_par_style('right', TB_ApplyEditOperation.get_number_part(arr[1]), sel);
            tb.opStyle.set_par_style('space_after', TB_ApplyEditOperation.get_number_part(arr[2]), sel);
            tb.opStyle.set_par_style('left', TB_ApplyEditOperation.get_number_part(arr[3]), sel);
        } else if (arr.length == 3) { // top right/left bottom
            tb.opStyle.set_par_style('space_before', TB_ApplyEditOperation.get_number_part(arr[0]), sel);
            tb.opStyle.set_par_style('right', TB_ApplyEditOperation.get_number_part(arr[1]), sel);
            tb.opStyle.set_par_style('left', TB_ApplyEditOperation.get_number_part(arr[1]), sel);
            tb.opStyle.set_par_style('space_after', TB_ApplyEditOperation.get_number_part(arr[2]), sel);
        } else if (arr.length == 2) { // top/bottom, right/left
            tb.opStyle.set_par_style('space_before', TB_ApplyEditOperation.get_number_part(arr[0]), sel);
            tb.opStyle.set_par_style('space_after', TB_ApplyEditOperation.get_number_part(arr[0]), sel);
            tb.opStyle.set_par_style('right', TB_ApplyEditOperation.get_number_part(arr[1]), sel);
            tb.opStyle.set_par_style('left', TB_ApplyEditOperation.get_number_part(arr[1]), sel);
        } else if (arr.length == 1) { // top/bottom, right/left
            tb.opStyle.set_par_style('space_before', TB_ApplyEditOperation.get_number_part(arr[0]), sel);
            tb.opStyle.set_par_style('space_after', TB_ApplyEditOperation.get_number_part(arr[0]), sel);
            tb.opStyle.set_par_style('right', TB_ApplyEditOperation.get_number_part(arr[0]), sel);
            tb.opStyle.set_par_style('left', TB_ApplyEditOperation.get_number_part(arr[0]), sel);
        }
    }

    static get_number_part(val: string): number {
        return parseInt(val.substring(0, val.indexOf('px')));
    }


    //D Layer
    /**
     *  "-kayak-" prefix는 TB_StyleContext.js의 build_css_str()에서 생성된다.
     */
    static apply_span_style(tb: TextBoxHost, sel: EditSel, span_style: string): void {
		let font_color_rgb: string | null = null;
		let font_color_cmyk: string | null = null;

        var styles = span_style.split(';');
        styles.forEach(style => {
            var arr = style.trim().split(':');
            if (arr.length != 2)
                return;
            var key = arr[0].trim();
            var val = arr[1].trim();
            // ** 중요 **
            // val은 모두 string이므로, 아래 case에서 적절히 형변환을 해 주어야 함.
            // "-kayak-"로 시작하는 key는 일반 key보다 항상 이후에 나옴.
            switch (key) {
                case '-kayak-font_family':
                    // ATTR_FontFamily.prototype.css_string() 참고
                    var values = val.split(','); // values[0] : familyName, values[1] : typeStyle
                    tb.opStyle.set_font_family(values[0].trim(), values[1].trim(), sel);
                    break;
                case 'font-weight': // bold
                    tb.opStyle.set_bold(val, sel);
                    break;
                case 'font-size':
                    var font_size_num = parseInt(val); // ignore the unit
                    tb.opStyle.set_font_size(font_size_num, sel);
                    break;
                case 'color':
                    tb.opStyle.set_fontColor(val, null, null, sel);
                    font_color_rgb = val;
                    break;
                case '-kayak-color_cmyk':
                    // cmyk 값 설정이 있는 경우.
					tb.opStyle.set_fontColor(font_color_rgb!, val, null, sel);
					font_color_cmyk = val;
                    // console.log(val, sel);
					break;
				case '-kayak-fontColorModel':
					tb.opStyle.set_fontColor(font_color_rgb!, font_color_cmyk, JSON.parse(atob(val)), sel);
					break;
                case '-kayak-letter_space':
                    tb.opStyle.set_letter_space(parseInt(val), sel);
                    break;
                case '-kayak-letter_scale_x':
                    tb.opStyle.set_letter_scale_x(parseFloat(val), sel);
                    break;
                case 'font-family':
					break;
				case '-kayak-gradient_fill':
					tb.opStyle.set_fontColor(JSON.parse(atob(val)), null, null, sel);
					break;
				case '-kayak-stroke':
					tb.opStyle.set_stroke(JSON.parse(atob(val)), sel);
					break;
				case '-kayak-shadow':
					tb.opStyle.set_shadow(JSON.parse(atob(val)), sel);
					break;					
			}
        })
    }
}

export { TB_ApplyEditOperation };