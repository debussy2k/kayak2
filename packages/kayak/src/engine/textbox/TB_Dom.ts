/*  jQuery 대체용 DOM 헬퍼.

    jQuery 의존성을 제거하면서 jQuery가 암묵적으로 해 주던 동작 중
    코드 곳곳에서 기대하고 있는 것만 모아 둔 것임.
    - css(): 숫자값에 'px' 자동 부여 (jQuery.cssNumber 와 동일한 예외 적용)
    - createElement(): HTML/SVG 문자열 --> element (jQuery("<div/>") 대체)
    - parseHTML(): 클립보드 HTML 문자열을 inert document로 파싱 (jQuery(html).find() 대체)

    모든 DOM 접근은 _g.document/_g.window를 통해야 함. (NodeJs/jsdom 환경 지원)
*/
import _g from './TB_PlatformEnv';

// jQuery.cssNumber: 숫자를 주어도 'px'를 붙이지 않는 속성.
var UNITLESS: Record<string, number> = {
    'animation-iteration-count': 1, 'column-count': 1, 'fill-opacity': 1, 'flex-grow': 1, 'flex-shrink': 1,
    'font-weight': 1, 'line-height': 1, 'opacity': 1, 'order': 1, 'orphans': 1, 'widows': 1,
    'z-index': 1, 'zoom': 1, 'stroke-opacity': 1
};

function toKebab(name: string): string {
    return name.replace(/[A-Z]/g, function(c) { return '-' + c.toLowerCase(); });
}

var TB_Dom = {
    // jQuery .css(obj) 대체. 숫자 --> 'px', null/undefined/NaN --> 무시, '' --> 속성 제거.
    css: function(el: HTMLElement | SVGElement | null, props: Record<string, string | number | null | undefined>) {
        if (!el)
            return;
        Object.keys(props).forEach(function(key) {
            var name = toKebab(key);
            var v: string | number | null | undefined = props[key];
            if (v == null || v !== v)
                return;
            if (typeof v === 'number' && !UNITLESS[name])
                v = v + 'px';
            if (v === '')
                el.style.removeProperty(name);
            else
                el.style.setProperty(name, String(v));
        });
    },

    cssAll: function(list: ArrayLike<HTMLElement | SVGElement>, props: Record<string, string | number | null | undefined>) {
        for (var i = 0; i < list.length; i++)
            TB_Dom.css(list[i], props);
    },

    // jQuery("<div class='x'></div>") 대체. 최상위 element 하나를 리턴함.
    // <svg ...> 문자열도 HTML parser가 SVG namespace로 만들어 줌.
    createElement: function(html: string): Element {
        var div = _g.document!.createElement('div');
        div.innerHTML = html.trim();
        var el = div.firstElementChild!;
        div.removeChild(el);
        return el;
    },

    // jQuery(htmlString).find(...) 대체.
    // DOMParser로 만든 문서는 inert하므로 붙여넣은 HTML의 script/onerror 등이 실행되지 않음.
    parseHTML: function(html: string): Document {
        return new _g.window!.DOMParser().parseFromString(html, 'text/html');
    },

    toArray: function<T>(list: ArrayLike<T>): T[] {
        return Array.prototype.slice.call(list);
    },

    removeAll: function(list: ArrayLike<Element>) {
        for (var i = list.length - 1; i >= 0; i--)
            if (list[i].parentNode)
                list[i].parentNode!.removeChild(list[i]);
    },

    // jQuery .attr(obj) 대체.
    setAttrs: function(el: Element, attrs: Record<string, string | number>) {
        Object.keys(attrs).forEach(function(k) {
            el.setAttribute(k, attrs[k] as string);   // setAttribute는 런타임에 문자열로 바꾼다. TS lib 시그니처(value: string)를 위한 캐스팅만.
        });
    }
};

export default TB_Dom;
