import _g from './TB_PlatformEnv';
import TB_Dom from './TB_Dom';
import he from 'he'; //  HTML entity encoder/decoder
import type { BrowserInfo } from './types';

class TB_Utils {

    // static method
    static inRange(begin: number, end: number, val: number): number {
        if (val < begin)
            return begin;
        else if (val >= end)
            return val - 1;
        return val;
    }

    static isWhiteSpace(char_code: number): boolean {
        // 160 : nbsp
        return char_code === 10 || char_code === 13 || char_code === 32 || char_code === 160;
    }

    static isMacOS(): boolean {
        if (_g.window == undefined)
            return false;
    
        return _g.window.navigator.platform == 'MacIntel';
    }
    static iOSSafari(): boolean {
        if (_g.window == undefined)
            return false;

    	var ua = _g.window.navigator.userAgent;
        var iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
        var webkit = !!ua.match(/WebKit/i);
        return iOS && webkit && !ua.match(/CriOS/i);
    }

    static detect_browser(): { isPCSafari: boolean; isiOSSafari: boolean; isChrome: boolean } {
        const w = _g.window as any;
        let result = { isPCSafari: false, isiOSSafari: false, isChrome: false };

        // Safari 3.0+ "[object HTMLElementConstructor]" 
        result.isPCSafari = /constructor/i.test(String(_g.window!.HTMLElement)) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!w['safari'] || (typeof safari !== 'undefined' && safari.pushNotification));
        result.isiOSSafari = TB_Utils.iOSSafari();

        // Chrome 1+
        result.isChrome = !!w.chrome && !!w.chrome.webstore;

        // // Opera 8.0+
        // var isOpera = (!!_g.window.opr && !!opr.addons) || !!_g.window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;

        // // Firefox 1.0+
        // var isFirefox = typeof InstallTrigger !== 'undefined';

        // // Internet Explorer 6-11
        // var isIE = /*@cc_on!@*/false || !!document.documentMode;

        // // Edge 20+
        // var isEdge = !isIE && !!_g.window.StyleMedia;

        // // Blink engine detection
        // var isBlink = (isChrome || isOpera) && !!_g.window.CSS;    

        return result
    }

    static get_browser_info(): BrowserInfo {

        let info = TB_Utils.detect_browser();
        let ie_version = TB_Utils.detectIE();
        // console.log('ie_version: ', ie_version);

        if (ie_version) {
            return {
                name: 'ie',
                version: ie_version
            }
        }
        else if (info.isPCSafari) {
            return {
                name: "safari_mac",
                version: 0
            }
        }
        else if (info.isiOSSafari) {
            return {
                name: "safari_ios",
                version: 0
            }
        }
        else {  // ie, safari가 아니면 chrome으로 간주하고 처리함.
            return {
                name: "chrome",
                version: 0
            }
        }
    }

    /**
     * detect legacy Edge (EdgeHTML). IE11 이하는 더 이상 지원하지 않음.
     * returns version of legacy Edge or false, if browser is not legacy Edge
     */
    static detectIE(): number | false {
        var ua = _g.window!.navigator.userAgent;

        var edge = ua.indexOf('Edge/');
        if (edge > 0) {
            // Edge (IE 12+) => return version number
            return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
        }

        // other browser
        return false;
    }

    // 
    static focus_and_copy_in_IE_element(elm: HTMLElement): void {
        /* 참고: https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
        	- For security reasons, this can only called from an event handler such as click (Just as with opening windows).
        	- IE will show a permission dialog the first time the clipboard is updated.
        	- IE, and Edge will scroll when the textarea is focused.
        	- execCommand() may throw in some cases.
        	- Newlines and tabs can get swallowed unless you use a textarea. (Most articles seem to recommend using a div)
        	- The textarea will be visible while the IE dialog is shown, you either need to hide it, or use the IE specific clipboardData api.
        	- In IE system administrators can disable the clipboard API.	
        */

        // IE에서 contenteditable/textarea에 focus가 가면 scroll이 되는 현상이 있음.
        // 이를 해결하기 위해 scroll 위치를 기록하여 focus 직후 원위치 시킴. 
        // 화면상으로는 스크롤 변화를 느끼지 못함.
        var x = _g.window!.scrollX;
        var y = _g.window!.scrollY;
        elm.focus({preventScroll:true});
        _g.window!.scrollTo(x, y);

        _g.document!.execCommand("selectAll", false, null!);
        // execCommand("copy")는 보안상의 이유로, event handler하에서 호출된 경우에만 성공함.
        var success = _g.document!.execCommand("copy", false, null!);
        // console.log('copy : ', success);
    }

    // Focuses an element to be ready for copy/paste (used exclusively for IE)
    static focus_and_select_all_in_IE_element(elm: HTMLElement, opt?: { fill_with_dummy?: boolean }): void {
        if (opt && opt.fill_with_dummy)
            elm.innerHTML = 'Y'; // selection이 될 수 있도록 최소한의 문자열을 제공함. 'Y'는 별 뜻 없음.
        elm.focus({preventScroll:true});
        var range = _g.document!.createRange();
        range.selectNodeContents(elm);
        var selection = _g.window!.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
    }

    static extractCopiedData(str: string, opt?: { strip_fragment?: boolean }): string | null {
        var ret_html = null;
        var copiedString = '';

        if (opt && opt.strip_fragment) {
            let start = -1;
            let end = -1;
            if (TB_Utils.isMacOS()) {
                let index = str.indexOf("<meta charset='utf-8'>");
                if (index != -1) {
                    start = index + 22;
                    end = str.length;
                }
            }
            else {
                start = str.indexOf('<!--StartFragment-->') + 20;
                end = str.indexOf('<!--EndFragment-->');    
            }

            if (start == -1 || end == -1)
                return '<div></div>';

            copiedString = str.substring(start, end);
        } else
            copiedString = str;

        // <div data-kayak-html='...'>에 있는 내용을 찾음.
        // DOMParser로 inert하게 파싱하므로 클립보드 HTML의 script/onerror 등은 실행되지 않음.
        try {
            var divs = TB_Dom.parseHTML(copiedString).querySelectorAll('div[data-kayak-html]');
            if (divs.length == 1) {
                var html_string = divs[0].getAttribute('data-kayak-html');
                html_string = he.decode(html_string!);
                // console.log(html_string);
                ret_html = '<div>' + html_string + '</div>';
            } else {
                // 외부에서 온 html문서인 경우 받은 그대로 전달한다. 일종의 fallback
                ret_html = null;
            }
        } catch (e) {
            ret_html = null
        }

        return ret_html;
    }


    static create_tmp_contentEditable_elem_on_root(): HTMLDivElement {
        var el = _g.document!.createElement('div');

        /*  IE대응-1
        	IE에서 user-select:none이 지정되면 contenteditable element에 focus()를 해도 제대로 focus되지 않음. 
        	정확히 설명하면, element에 focus는 가지만 편집가능한 contenteditable text에 가는 것이 아니라
        	(caret을 가지지 않은) element 자체에만 포커스가 감.
        	그 결과로, 한글 입력이 안되는 문제가 발생함.
        */
        var style = '-ms-user-select:auto !important;';
        /*  IE대응-2
        	contenteditable의 caret은 항상 전면에 나오며, visible 하게 나오려는 속성이 있음.
        	caret을 숨기기 위해 height를 zero로 하며, overflow안되도록 함.
        */
        style += 'position:absolute; left:0px; top:0px; height:0px; overflow:hidden; vibisility:1'
            // style += 'border:1px solid red;';
        el.setAttribute('style', style);
        (el as any).contentEditable = true;

        _g.document!.body.appendChild(el);
        return el;
    }

}

export default TB_Utils;