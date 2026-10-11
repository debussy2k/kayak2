import TB_Utils from './TB_Utils';
import TB_Ime_Chrome from './ime/TB_Ime_Chrome';
import TB_Ime_EdgeTo15 from './ime/TB_Ime_EdgeTo15';
import TB_Ime_EdgeFrom16 from './ime/TB_Ime_EdgeFrom16';
import TB_Ime_Safari_Mac from './ime/TB_Ime_Safari_Mac';
import TB_Ime_Safari_iOS from './ime/TB_Ime_Safari_iOS';
import * as log from "loglevel";
import type { ImeContext, ImeOptions, BrowserInfo } from './types';


//////////////////////////////////////////////////////////////////////
// TB_NormalizedIME
//////////////////////////////////////////////////////////////////////
class TB_NormalizedIME {
    contenteditable_state: boolean | null;
    ime_ctx: ImeContext;
    private browser: BrowserInfo;
    private options: ImeOptions;

    constructor(options: ImeOptions) {
        this.options = options;
        this.browser = TB_Utils.get_browser_info();
        var browser = this.browser;
        // log.debug('detected browser : ', browser);
        this.contenteditable_state = null

        var events = ["keydown", "keyup", "keypress",
            "input", "textInput", "text",
            "compositionstart", "compositionupdate", "compositionend"
        ];

        if (browser.name === 'chrome') {
            events.push('copy');
            events.push('cut');
            events.push('paste');

        } else if (browser.name === 'ie') {
            // events.push('DOMCharacterDataModified');
            events.push('copy');
            events.push('cut');
            events.push('paste');
            events.push('beforepaste');
        } else if (browser.name === 'safari_mac') {
            events.push('copy');
            events.push('cut');
            events.push('paste');
        } else if (browser.name === 'safari_ios') {
            events.push('copy');
            events.push('cut');
            events.push('paste');
        }


        this.ime_ctx = {
            inp_box: options.kbd_input_box, //
            inp: options.kbd_input, // _TB_Keyboard::get_ime_elem()로 외부에 노출되어 있음.
            isComposing: false,
            composing: '',
            composed: '',
            last_composing_state: null,
            // for chrome only
            focus_blurred: false,
            // for ie11
            need_clear_text: false,
            dom_str_new: '',
            dom_str_prev: '',

            key_pressed: false,
            key_pressed_keyCode: null,
			last_event: ''
        }

        // 원본의 function listener(e) — self/browser 클로저를 this로. 등록만 되고 제거되지 않으므로 지역 상수로 충분하다.
        const listener = (e: Event) => {
            options.kbd_listener(e); // only for inspection purpose
            if (this.browser.name === 'chrome') {
                TB_Ime_Chrome(e, this.ime_ctx, options);
				this.ime_ctx.last_event = e.type;
            } else if (this.browser.name === 'ie') {   // legacy Edge(EdgeHTML)만 해당. IE11은 지원 종료.
                if (this.browser.version <= 15)
                    TB_Ime_EdgeTo15(e, this.ime_ctx, options);
                else
                    TB_Ime_EdgeFrom16(e, this.ime_ctx, options);
            } else if (this.browser.name === 'safari_mac') {
                TB_Ime_Safari_Mac(e, this.ime_ctx, options);
            } else if (this.browser.name === 'safari_ios') {
                TB_Ime_Safari_iOS(e, this.ime_ctx, options);
            }
        };

        events.forEach(function(name) {
            var capture = (name == 'beforepaste') ? true : false;
            options.kbd_input.addEventListener(name, listener, capture);

        });
    }

    // TB_Keyboard가 {preventScroll:true}를 넘기지만 원본은 인자를 받지 않았다. 인자는 무시한다.
    focus(_opt?: FocusOptions): void {
        // for minimize reflow
        if (this.contenteditable_state !== true)
            this.options.kbd_input.setAttribute("contenteditable", 'true')   // setAttribute는 문자열로 바꾸므로 true와 같다
        this.contenteditable_state = true;

        this.options.kbd_input.focus({preventScroll:true});
    }
    blur(): void {
        this.options.kbd_input.blur();

        // for minimize reflow
        if (this.contenteditable_state === true)
            this.options.kbd_input.setAttribute("contenteditable", 'false')
        this.contenteditable_state = false;
    }


}


export default TB_NormalizedIME;
