import ATTR_Par from '../segment/ATTR_Par';
import TB_StyleContext from './TB_StyleContext';
import TB_HtmlMeasure from "./TB_HtmlMeasure";      // ES5
import he from 'he'; //  HTML entity encoder/decoder
import type { TextBoxHost, StyleEntry, ExportHtmlOptions } from './types';


////////////////////////////////////////////////////////////////////////////
// seglayer로 부터 html을 생성.
////////////////////////////////////////////////////////////////////////////

/**
 * paragraph 단위로 묶어 html을 생성한다.
 * copy시 clipboard에 복사할 내용을 생성하는 용도로 사용.
 */
function get_html_string_by_par(tb: TextBoxHost, rng: any): string {
    //D Layer
    var styles: StyleEntry[] = [];

    tb.seg_mgr.extract_styles_except_par_layer(styles, rng);
    // par는 항상 마지막에.
    tb.seg_mgr.exctract_style_from_seglayer(styles, rng, tb.m_Par._get_vec(), ATTR_Par.prototype.style_setter);

    //console.log('start --------------');
    //console.log('rng: ', rng);
    //console.log('style_arr:', styles);

    var options = { 
        keep_cr: true, 
        include_html_data: true,
        for_clipbaord_export: true    // 생성될 span element를 자간,장평이 적용되어 있어도 한 그룹으로 생성한다.
    }
    var str_html = generate_html_for_export(tb, styles, options);

    return str_html;
}


/**
 * HTML파일을 생성하는 함수. system clipboard로 copy하기위한 html생성을 함. html생성에 관련한 주된 작업은 여기서 한다.
 * @param  {String} text 	대상 text
 * @param  {Object} styles 	style을 생성하기 편리하도록 만들어진 style array.
 * @return {String}
 * 
 */
function generate_html_for_export(tb: TextBoxHost, styles: StyleEntry[], options?: ExportHtmlOptions): string {
    // 첫 style에 start_of_par가 있으면, styles는 par 정보를 가진 상태이며,
    // 이 경우 생성하는 html은 par단위로 <div></div>로 묶어 생성함.
    var has_par_style = (styles[0].start_of_par === true);

    var html = '';
    var par = '';
    var context = new TB_StyleContext();
    var span_style = '';

    if (styles.length > 0 && styles[0].start_of_par) {
        //console.log('from copy ');
    }

    if (styles.length === 1) { // range가 없는 경우임.
        span_style = tb.seg_mgr.get_span_style_string(styles[0], context);
        par += '<span style="' + span_style + '"></span>';
    } else {
        for (var i = 0; i < styles.length - 1; i++) {
            if (styles[i].start_of_par === true) {
                if (i > 0)
                    par += '</div>';
                html += par;

                // 새로운 par의 시작.
                par = build_kayak_par_div_head(styles[i].par);
            }

            par += generate_html_inline(tb, styles[i].pos, styles[i + 1].pos, styles[i], context, options!);
        }
    }

    if (has_par_style) {
        if (par.length > 0 && i! > 0)
            html += par + '</div>';

        if (options && options.include_html_data) {
            var encoded_html = he.encode(html);
            html = '<div kayak-doc>' +
                html +
                '<div data-kayak-html="' + encoded_html + '"></div>' +
                '</div>';
        } else
            html = '<div kayak-doc>' + html + '</div>';

        // console.log('html: ', html);
        return html;
    } else
        return par;
}

function generate_html_inline(tb: TextBoxHost, from: number, to: number, style: StyleEntry, context: TB_StyleContext, options: ExportHtmlOptions): string {
    let inline_html = '';

    var text = '';
    var span_style = tb.seg_mgr.get_span_style_string(style, context, options);
    var has_letter_scale_x = context.has_letter_scale_x();

    if (options.for_clipbaord_export) {
        text = tb.text_core.toHtmlString(from, to, options);
        inline_html += '<span style="' + span_style + '">';
        inline_html += text;
        inline_html += '</span>';
    } 
    else {
        // 아래의 순서 중요.
        if (has_letter_scale_x) {
            for (var k = from; k < to; k++) {
                var ch = tb.text_core.toHtmlCharEntity(tb.text_core.m_text[k]);

                var span_origin = '<span style="' + 'display:inline-block;' + span_style + '">'
                    + ch + '</span>';
                var org_width = TB_HtmlMeasure.measure_html_width(span_origin, tb.tbcontext);
                var value_delta = org_width * (context.raw_data.letter_scale_x - 100) / 100;
                var span_padding = 'padding-right:' + value_delta + 'px;';

                // span_origin보다 transform된 만큼 넓혀주기 위한 padding-right가 보함된다.
                var span_transform = '<span style="' + 'display:inline-block;' + span_style + span_padding + '">'
                    + context.get_transformed_span(ch) + '</span>';
                
                inline_html += span_transform;
                inline_html += '</span>';  
            }
        }
        else if (context.need_for_split_to_every_single_span()) {
            for (var k = from; k < to; k++) {
                var ch = tb.text_core.toHtmlCharEntity(tb.text_core.m_text[k]);
                inline_html += '<span style="' + span_style + '">';
                inline_html += tb.text_core.toHtmlCharEntity(tb.text_core.m_text[k]);
                inline_html += '</span>';
            }
        }
        else {
            text = tb.text_core.toHtmlString(from, to, options);
            inline_html += '<span style="' + span_style + '">';
            inline_html += text;
            inline_html += '</span>';
        }
    }

    // console.log(inline_html);
    return inline_html;
}



function build_kayak_par_div_head(par_style: any): string {
    /* par_style
        m_Align, m_Findent, m_Lindent, m_LineSpace, m_Rindent, 
        m_SpaceAfter, m_SpaceBefore, m_nLineGap

        google doc에 paste관련
        - 적용되는 항목 : text-align
        - 안되는  항목 : 
    */
    var div_head = '<div kayak-par style="';

    // m_Align
    div_head += 'text-align: ' + par_style.m_Align + ';';

    // m_Findent
    div_head += 'text-indent:' + par_style.m_Findent + 'px;';

    // m_Lindent
    div_head += 'padding-left:' + par_style.m_Lindent + 'px;';

    // m_Rindent
    div_head += 'padding-right:' + par_style.m_Rindent + 'px;';

    // m_LineSpace
    div_head += 'line-height:' + par_style.m_LineSpace + ';';

    // m_SpaceAfter
    div_head += 'padding-bottom:' + par_style.m_SpaceAfter + 'px;';

    // m_SpaceBefore
    div_head += 'padding-top:' + par_style.m_SpaceBefore + 'px;';

    // 닫기
    div_head += '">';

    return div_head;
}



export {
    get_html_string_by_par,
    generate_html_inline
};