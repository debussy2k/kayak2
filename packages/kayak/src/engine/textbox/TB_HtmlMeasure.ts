/*

*/
import MeasureDiv from './MeasureDiv';
import type { HtmlDimension } from './types';

interface WordCacheLike { get(key: string): number | undefined; put(key: string, value: number): void }

class TB_HtmlMeasure {

    static measure_html_width(str_html: string, tbcontext: { WordCache: WordCacheLike }): number {
        var WordCache = tbcontext.WordCache;

        var clientWidth = WordCache.get(str_html);
        if (clientWidth == undefined) {
            let spMeasureDiv = MeasureDiv.Instance();

            spMeasureDiv.metric_box.style.height = 'auto';
            spMeasureDiv.metric_box.innerHTML = str_html;
            clientWidth = spMeasureDiv.metric_box.clientWidth;;
            WordCache.put(str_html, clientWidth);
        }

        return clientWidth;
    }

    /**
     * 문자열의 width, height 얻기.
     * @param  {String} str_html - target string
     */
    static measure_html_dimension(str_html: string): HtmlDimension {
        let spMeasureDiv = MeasureDiv.Instance();

        /*
        ##original : 원래의 간단한 concept은 아래와 같음.
            var css_str = "position:fixed; left:-1000px; top:-1000px";
            spMeasureDiv.lDiv.style = css_str;
            spMeasureDiv.lDiv.innerHTML = str_html;
            var lResult = {
                width: spMeasureDiv.lDiv.clientWidth,
                height: spMeasureDiv.lDiv.clientHeight
            };
        */


        /*	##new :
            - 기존 width, height 계산에 추가하여
        	  str_html의 ascent, descent를 계산한다.

        	str_html은 span의 연속이어야 한다. 그렇지 않으면 에러발생시킬 것.
        	<span></span> ... <span></span>
        */
        spMeasureDiv.metric_box.style.height = 'auto';
        spMeasureDiv.metric_box.innerHTML = str_html;

        // step-1 : str_html이 형성하는 height를 먼저 구한다.
        var metric_box_height = spMeasureDiv.metric_box.clientHeight;

        // step-2 : height가 결정되어 있어야  ascent, descent 계산이 가능함.
        spMeasureDiv.metric_box.style.height = metric_box_height + 'px';

        var max_span_height = 0;
        var max_span_bottom = 0;

        // ascent/descent계산을 위해 각 span element 별로 계산하여 최대값을 기억한다.
        // #kayak_metric_box:after에 의해 span의 baseline이 metric_box의 bottom과 일치가 된다.
        for (var i = 0; i < spMeasureDiv.metric_box.children.length; i++) {
            var span = spMeasureDiv.metric_box.children[i] as HTMLElement;
            if (span.tagName !== 'SPAN')
                console.log('WARNING : only span element is allowed for measure');

            // height
            max_span_height = (span.offsetHeight > max_span_height) ? span.offsetHeight : max_span_height;

            // bottom. relative to #kayak_metric_box element(parent)
            var tmp_bottom = span.offsetTop + span.offsetHeight;
            max_span_bottom = (tmp_bottom > max_span_bottom) ? tmp_bottom : max_span_bottom;
        }

        // console.log('max_span_bottom: ' + max_span_bottom);

        var span_descent = max_span_bottom - spMeasureDiv.metric_box.clientHeight;
        var span_ascent = max_span_height - span_descent;
        // console.log('metric_box ascent : ' + span_ascent);
        // console.log('metric_box descent : ' + span_descent);

        // span height == span_ascent + span_descent
        if (spMeasureDiv.metric_box.clientWidth == 0) {
            console.log('stop');
        }

        var lResult: HtmlDimension = {
            width: spMeasureDiv.metric_box.clientWidth,
            last_glyph_white_space: 0,
            height: metric_box_height,
            ascent: span_ascent,
            descent: span_descent
        };

        return lResult;
    }
}



export default TB_HtmlMeasure;
