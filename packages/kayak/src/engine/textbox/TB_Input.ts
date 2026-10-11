import _g from './TB_PlatformEnv';
import TB_Dom from './TB_Dom';
import { TB_KeydownAction } from './TB_KeydownAction';
import TB_Keyboard from './TB_Keyboard';
import TB_Utils from './TB_Utils';
import TB_StyleContext from './TB_StyleContext';
import * as TB_ExportHtml from './TB_ExportHtml';
import type { TextBoxHost, BrowserInfo, KeyboardTarget, ImeCmd } from './types';

/*
    원본은 생성자 함수 안의 클로저 함수들이었다. class로 바꾸면서
    - 이벤트/IME 콜백으로 넘겨지는 함수는 화살표 함수 필드로 (add/removeEventListener의 식별자가 같아야 하고, options에 담겨 this 없이 불린다)
    - 직접 호출만 되는 함수는 private 메서드로
    바꿨다. useDefineForClassFields:false라 화살표 필드는 생성자 본문 앞에 대입된다.
*/
class TB_Input {
    private browser: BrowserInfo;
	private tb: TextBoxHost;

	private KayakContent: HTMLElement;
    private cursor_elem: HTMLElement;

    private ST_NONE: number;
    private ST_SELECTED: number;
    private ST_FOCUSED: number;
    private sel_state: number; // 0:none, 1:selected, 2:focused

    private kb: TB_Keyboard;
    private keydown_action: TB_KeydownAction;

    private options: KeyboardTarget;

    constructor(textbox_obj: TextBoxHost) {
        this.browser = TB_Utils.get_browser_info();
    	this.tb = textbox_obj;
        var tb = this.tb;

    	this.KayakContent = tb.element.querySelector('.kayak-content')!;
        this.cursor_elem = tb.element.querySelector('.kayak-cursor')!;

        this.ST_NONE = 0;
        this.ST_SELECTED = 1;
        this.ST_FOCUSED = 2;
        this.sel_state = 0; // 0:none, 1:selected, 2:focused

        this.setup_mouse();
        this.kb = this.setup_keyboard();
        this.keydown_action = new TB_KeydownAction(tb);

        this.options = {
            textbox: tb,
            on_insert_word: this.on_insert_word,
            on_remove_by_ime_backspace: this.on_remove_by_ime_backspace,
            on_keydown: this.on_keydown,
            on_keyup: this.on_keyup,
            on_copy: (this.browser.name === 'ie') ? this.ie_copy : this.std_copy,
            on_cut: (this.browser.name === 'ie') ? this.ie_cut : this.std_cut,
            on_beforepaste: (this.browser.name === 'ie') ? this.ie_beforepaste : function() {},
            on_paste: (this.browser.name === 'ie') ? this.ie_paste : this.std_paste
        }
    }

    get_inp(): HTMLElement {
        return this.kb.get_inp();
    }


    get_sel_state(): number {
        return this.sel_state;
    }
    get_sel_state_text(): string {
        var str = '';
        switch (this.sel_state) {
            case 0:
                str = "ST_NONE";
                break;
            case 1:
                str = "ST_SELECTED";
                break;
            case 2:
                str = "ST_FOCUSED";
                break;
        }
        return str;
    }

    set_blur(): void {
        this.sel_state = this.ST_NONE;
        this.kb.blur(this.options);

        if (this.tb.text_on_path)
			this.tb.text_on_path.on_blur();

		this.KayakContent.style.cursor = 'default';
    }
    set_select(): void {
        this.sel_state = this.ST_SELECTED;
        this.kb.blur(this.options);

        if (this.tb.text_on_path)
			this.tb.text_on_path.on_select();

		this.KayakContent.style.cursor = 'text';
    }
    set_focus(event?: MouseEvent): void {
        this.sel_state = this.ST_FOCUSED;
        this.kb.focus(this.options);

        if (this.tb.text_on_path)
            this.tb.text_on_path.on_focus();

        /* ## event가 있는 경우 ##
           edicus같은 편집기에서 mouse_down 이후 바로 mouse_up이 되어
           select와 동시에 focus까지 주어야 하는 경우임.
           이 때 mouse event를 전달하여 위치를 파악하여 클릭한 지점에 cursor가 나도도록 하기 위함
        */
        if (event) {
            this.tb.tbcursor.input_lbutton_down(event);
            // console.log('----> style_listener() called after set_focus()')
            this.tb.style_listener();
		}
		this.KayakContent.style.cursor = 'text';
    }

    private setup_mouse(): void {
        this.KayakContent.addEventListener('mousedown', this.on_mousedown);
        this.KayakContent.addEventListener('touchstart', this.on_touchstart, { passive: true });
        this.KayakContent.addEventListener('click', this.on_click);
        this.KayakContent.addEventListener('dblclick', this.on_dblclick);
    }

    private setup_keyboard(): TB_Keyboard {
        // keyboard event는 아래의 순서로 발생한다.
        // keydown --> textInput (일반 문자 입력시)
        // keydown --> paste --> textInput (ctrl+v의 경우)

        return new TB_Keyboard(this.tb.element);
    }

    relocate_ime_box(): void {
        var tb = this.tb;
        // get style info for input method window
        var sel = tb.tbcursor.sel();
        var sampling_pos = (sel.exists_range) ? sel.begin : tb.tbcursor.cursor;
        var cur_style = tb.get_style_info(sampling_pos);

        var inp_box = this.kb.get_inp_box()
        var inp = this.kb.get_inp()

        var context = new TB_StyleContext();
        var style_string: string = tb.seg_mgr.get_span_style_string(cur_style, context);
        // console.log(style_string);

        // cursor의 위치정보를 이용함.
        ///////////////////////////////////////////////////////////////////////////////////////
        // 아직 실험중
        var loc = tb.tbcursor.get_location_info();
        var cur_line = tb.layout!.get_line(loc);

        // var abs_x = loc.last_cursor_loc_info.content_pos.left + loc.last_cursor_loc_info.x_pos;
        // var abs_y = loc.last_cursor_loc_info.content_pos.top + loc.last_cursor_loc_info.y_pos;
        var abs_x = loc.last_cursor_loc_info!.x_pos;
        var abs_y = loc.last_cursor_loc_info!.y_pos;

        var line_leading = (cur_line.max_word_height - (cur_line.max_word_ascent + cur_line.max_word_descent)) / 2;
        abs_y += line_leading + (cur_line.max_word_ascent - loc.last_cursor_loc_info!.ascent);


        var css_ime_loc = 'height:' + loc.last_cursor_loc_info!.max_word_height + 'px;';
        css_ime_loc += 'left:' + abs_x + 'px;';
        css_ime_loc += 'top:' + abs_y + 'px;';
        style_string += css_ime_loc;
        ///////////////////////////////////////////////////////////////////////////////////////
        if (inp_box.style.display.length > 0)
            style_string += 'display:' + inp_box.style.display + ';';

        inp_box.setAttribute('style', style_string);
    }

    // chrome에 한하여, ctrl+c시 clipboard에 text와 html 문자열을 복사해 넣는다.
    // 아래 text_html에서 hard line break시 p나 div로 분리시킬 것.
    private std_copy = (e: ClipboardEvent) => {
        var tb = this.tb;
        var sel = tb.tbcursor.sel();

        if (sel.exists_range)
            tb.opEdit.copy(tb.tbcontext.masterClipboard, sel.begin, sel.end);

        var text_plain = tb.text_core.toRawString(sel.begin, sel.end);
        e.clipboardData!.setData('text/plain', text_plain);

        var text_full_html = TB_ExportHtml.get_html_string_by_par(tb, sel);

        e.clipboardData!.setData('text/html', text_full_html);
        // console.log(text_full_html);

        e.preventDefault();
    }

    // chrome에 한하여, ctrl+c시 clipboard에 text와 html 문자열을 복사해 넣는다.
    // 아래 text_html에서 hard line break시 p나 div로 분리시킬 것.
    private std_cut = (e: ClipboardEvent) => {
        var tb = this.tb;
        var sel = tb.tbcursor.sel();

        var text_plain = tb.text_core.toRawString(sel.begin, sel.end);
        e.clipboardData!.setData('text/plain', text_plain);

        var text_full_html = TB_ExportHtml.get_html_string_by_par(tb, sel);

        e.clipboardData!.setData('text/html', text_full_html);
        // console.log(text_full_html);

        if (sel.exists_range) {
            tb.opEdit.cut(tb.tbcontext.masterClipboard, sel.begin, sel.end);
        }

        e.preventDefault();
    }


    /*
    	system clipboard에 있는 html가 있는 경우
    	par단위로 style정보를 읽어 tb.tb_schema에 edit operation을 적용한다.
    	모두 적용이 끝나면,
    	tb.tb_schema --> tb.tbcontext.masterClipboard로 copy하고
    	tb.tbcontext.masterClipboard --> tb로 paste한다.
    */
    private std_paste = (e: ClipboardEvent) => {
        // 아래 내용 참고하여 clipbaord data가져오기.
        // - JavaScript get clipboard data on paste event (Cross browser)
        //   http://stackoverflow.com/questions/2176861/javascript-get-clipboard-data-on-paste-event-cross-browser/2177059#2177059

        var text_plain = e.clipboardData!.getData('text/plain');
        var text_html: string | null = e.clipboardData!.getData('text/html');
        /*  text_html은 system clipboard에서 받은 데이터이고, 실제 필요한 데이터는
                <!--StartFragment-->...<!--EndFragment-->
            에 있다.
        */

        text_html = TB_Utils.extractCopiedData(text_html, { strip_fragment: true });

        this._std_paste(text_plain, text_html);

        e.preventDefault();
    }

    private _std_paste(text_plain: string, text_html: string | null): void {
        var tb = this.tb;
        // 아래 내용 참고하여 clipbaord data가져오기.
        // - JavaScript get clipboard data on paste event (Cross browser)
        //   http://stackoverflow.com/questions/2176861/javascript-get-clipboard-data-on-paste-event-cross-browser/2177059#2177059

        // text_plain = 'hello bold plain\nbig text';
        // text_html = '<html><body><!--StartFragment--><div kayak-doc><div kayak-par><span style="font-family:Arial;font-weight:normal;font-size:12pt;">hello&nbsp;</span><span style="font-family:Arial;font-weight:bold;font-size:12pt;">bold</span><span style="font-family:Arial;font-weight:normal;font-size:12pt;">&nbsp;plain\n</span></div><div kayak-par><span style="font-family:Arial;font-weight:normal;font-size:18pt;">big</span><span style="font-family:Arial;font-weight:normal;font-size:12pt;">&nbsp;text&nbsp;</span></div></div><!--EndFragment--></body></html>';

        /*
            아래 방식의 문제.
            1. dom으로 생성된 이후, div내의 style은 browser에 따라 해석된 상태로 얻어진다.
               "padding-left:1px; padding-right:1px; padding-top:5px; padding-botoom:5px;"이
               "padding: 5px 1px;"으로 얻어지는 문제 있음.
        */
        // DOMParser로 파싱하므로 붙여넣은 HTML의 script/onerror 등은 실행되지 않음.
        var divs = text_html ? TB_Dom.toArray(TB_Dom.parseHTML(text_html).querySelectorAll('div[kayak-par]')) : [];
        if (divs.length === 0) {
            // 외부 clipboard data를 내부 masterClipboard로 내용을 복사한다.
            tb.tbcontext.masterClipboard.copy_from_string_data(text_plain);
            var sel = tb.tbcursor.sel();
            tb.opEdit.paste(tb.tbcontext.masterClipboard, sel, function(err, text_change_info, par_change_info) {});

        } else {
            tb.tb_schema!.reset_all();

            // A. paste시 font loading이 발생할 수 있으며, 그것 때문에 promise로 처리됨.
            // tb가 schema mode이면 tb.fontloader가 null이므로 fontloader를 별도로 전달한다.
            tb.tb_schema!.apply_edit_operation(divs, tb.fontloader!).then(text_length => {
                // 1. copy : tb.tb_schema --> tb.tbcontext.masterClipboard
                tb.tb_schema!.opEdit.copy(tb.tbcontext.masterClipboard, 0, text_length);
                // 2. paste : tb.tbcontext.masterClipboard --> tb
                tb.opEdit.paste(tb.tbcontext.masterClipboard, tb.tbcursor.sel(), this.on_par_changed);

                tb.tb_schema!.reset_all();
            })

            // B. Promise 버전이 아니었을 경우
            // var text_length = tb.tb_schema.apply_edit_operation(divs);

            // // 1. copy : tb.tb_schema --> tb.tbcontext.masterClipboard
            // tb.tb_schema.copy(tb.tbcontext.masterClipboard, 0, text_length);
            // // 2. paste : tb.tbcontext.masterClipboard --> tb
            // tb.opEdit.paste(tb.tbcontext.masterClipboard, tb.tbcursor.sel(), on_par_changed);

            // tb.tb_schema.reset_all();
        } // end of if
    }

    private ie_copy = (e: ClipboardEvent) => {
        var tb = this.tb;
        if (this.browser.version >= 11) {
            var sel = tb.tbcursor.sel();
            if (sel.exists_range)
                tb.opEdit.copy(tb.tbcontext.masterClipboard, sel.begin, sel.end);

            // for html
            // 1. html string 준비
            var text_full_html = TB_ExportHtml.get_html_string_by_par(tb, sel);

            // 2. contentEditable element에 html string을 복사함.
            var imsi_el = TB_Utils.create_tmp_contentEditable_elem_on_root();
            imsi_el.innerHTML = text_full_html

            // 3. focus --> selectAll --> copy
            TB_Utils.focus_and_copy_in_IE_element(imsi_el);

            // 4. 마무리
            _g.document!.body.removeChild(imsi_el);
            this.kb.get_inp().focus({preventScroll:true});
        }

        // IE11 전용 버전.
        // window.clipbaordDAta를 이용한 버전임.
        // 차후 스터디를 위해 남겨 놓음.
        /*
        if (browser.version == 11) {
            var imsi_el = TB_Utils.create_tmp_contentEditable_elem_on_root();

            var sel = tb.tbcursor.sel();
            if (sel.exists_range)
                tb.opEdit.copy(tb.tbcontext.masterClipboard, sel.begin, sel.end);

            var text_plain = tb.text_core.toRawString(sel.begin, sel.end);
            window.clipboardData.setData('Text', text_plain);

            // for html
            // 1. html string 준비
            var text_full_html = TB_ExportHtml.get_html_string_by_par(tb, sel);

            // 2. contentEditable element에 html string을 복사함.
            imsi_el.innerHTML = text_full_html

            // 3. contentEditable element에 focus주고, select all을 함.
            TB_Utils.focus_and_select_all_in_IE_element(imsi_el);

            // 4. next tick에 contentEditable element의 내용을 모두 삭제함.
            setTimeout(function() {
                TB_Utils.focus_and_select_all_in_IE_element(imsi_el, { fill_with_dummy: true });
                document.body.removeChild(imsi_el);
                kb.get_inp().focus({preventScroll:true});
            }, 0);
        }
        */
    }

    private ie_cut = (e: ClipboardEvent) => {
        var tb = this.tb;
        if (this.browser.version >= 11) {
            var sel = tb.tbcursor.sel();

            // for html
            // 1. html string 준비
            var text_full_html = TB_ExportHtml.get_html_string_by_par(tb, sel);

            // 2. contentEditable element에 html string을 복사함.
            var imsi_el = TB_Utils.create_tmp_contentEditable_elem_on_root();
            imsi_el.innerHTML = text_full_html

            // 3. focus --> selectAll --> copy
            TB_Utils.focus_and_copy_in_IE_element(imsi_el);

            // 4. 마무리
            _g.document!.body.removeChild(imsi_el);
            this.kb.get_inp().focus({preventScroll:true});

            if (sel.exists_range)
                tb.opEdit.cut(tb.tbcontext.masterClipboard, sel.begin, sel.end);

        }

    }

    private ie_beforepaste = (e: Event) => {
        TB_Utils.focus_and_select_all_in_IE_element(this.kb.get_inp(), { fill_with_dummy: true });
    }

    private ie_paste = (e: ClipboardEvent) => {
        var text_plain = '';
        if (e.clipboardData) // for IE-Edge
            text_plain = e.clipboardData.getData('text');

        setTimeout(() => {
            var text_html: string | null = this.kb.get_inp().innerHTML.toString();
            text_html = TB_Utils.extractCopiedData(text_html); // std_paste()와는 달리 관심 데이터가 바로 text_html에 있음.

            // console.log('Clipboard Plain Text: ' + text_plain);
            // console.log('Clipboard HTML: ' + text_html);

            this._std_paste(text_plain, text_html);
            TB_Utils.focus_and_select_all_in_IE_element(this.kb.get_inp(), { fill_with_dummy: true });
        }, 0)
    }


    /*  focused가 아닌 상태에서는 모든 mouse event를 bypass 한다.
     */
    private on_mousedown = (e: MouseEvent) => {
        if (this.sel_state == this.ST_FOCUSED)
            this.on_mousedown_FOCUSED(e)
    }

    /*
    function on_mousedown_NONE(e) {}
    function on_mousemove_NONE(e) {}
    function on_mouseup_NONE(e) {}
    function on_mousedown_SELECTED(e) {}
    function on_mousemove_SELECTED(e) {}
    function on_mouseup_SELECTED(e) {}
    */

    private on_mousedown_FOCUSED(e: MouseEvent): void {
        this.tb.tbcursor.input_lbutton_down(e);

        e.preventDefault();
        this.kb.focus(this.options);
        this.tb.style_listener({ ime: false }); // ime창은 변화 없음

        // kb.show_ime(false);

        _g.document!.addEventListener('mousemove', this.on_mousemove_FOCUSED);
        _g.document!.addEventListener('mouseup', this.on_mouseup_FOCUSED);

        e.stopPropagation();
    }

    private on_mousemove_FOCUSED = (e: MouseEvent) => {
        this.tb.tbcursor.input_mousemove(e);

        e.preventDefault();
        this.tb.style_listener({ ime: false }); // ime창은 변화 없음

        e.stopPropagation();
    }

    private on_mouseup_FOCUSED = (e: MouseEvent) => {
        this.tb.tbcursor.input_lbutton_up(e);
        // 참고: 예전 jQuery의 off('mousemove mouseup')는 document의 다른 handler까지 모두 제거했었음.
        _g.document!.removeEventListener('mousemove', this.on_mousemove_FOCUSED);
        _g.document!.removeEventListener('mouseup', this.on_mouseup_FOCUSED);

        // kb.show_ime(true);

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.kb.focus(this.options);
        this.tb.style_listener();
        this.tb.focus_listener();
    }

    private on_touchstart = (e: TouchEvent) => {
        if (this.sel_state == this.ST_FOCUSED)
            this.on_touchstart_FOCUSED(e)
    }
    private on_touchstart_FOCUSED(e: TouchEvent): void {
        let ee = e.touches[0];
        this.tb.tbcursor.input_lbutton_down(ee);

        // e.preventDefault();
        this.kb.focus(this.options);
        this.tb.style_listener({ ime: false }); // ime창은 변화 없음

        // kb.show_ime(false);

        _g.document!.addEventListener('touchmove', this.on_touchmove_FOCUSED);
        _g.document!.addEventListener('touchend', this.on_touchend_FOCUSED);

        e.stopPropagation();
    }
    private on_touchmove_FOCUSED = (e: TouchEvent) => {
        if (e.touches.length !== 1)
            return;

        let ee = e.touches[0];
        this.tb.tbcursor.input_mousemove(ee);

        // e.preventDefault();
        this.tb.style_listener({ ime: false }); // ime창은 변화 없음

        e.stopPropagation();
    }
    private on_touchend_FOCUSED = (e: TouchEvent) => {
        // touchend에서는 touches가 비어 있으므로 changedTouches를 사용함.
        let ee = e.changedTouches[0];
        this.tb.tbcursor.input_lbutton_up(ee);
        _g.document!.removeEventListener('touchmove', this.on_touchmove_FOCUSED);
        _g.document!.removeEventListener('touchend', this.on_touchend_FOCUSED);

        // kb.show_ime(true);

        // e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.kb.focus(this.options);
        this.tb.style_listener();
        this.tb.focus_listener();
    }
    private on_click = (e: MouseEvent) => {
        e.stopPropagation();
    }

    private on_dblclick = (e: MouseEvent) => {
        this.tb.tbcursor.input_dblclick(e);

        e.preventDefault();
        this.set_focus();
        this.tb.style_listener();
    }

    // cmd --> 'insert' or 'replace'
    private on_insert_word = (word: string, cmd: ImeCmd) => {
        var tb = this.tb;
        // console.log('on_insert_word: ', word, cmd, word.length);

        if (cmd == 'insert') {
            var sel = tb.tbcursor.sel();
            if (sel.exists_range)
                tb.opEdit.erase(sel.begin, sel.begin, sel.end, this.on_par_changed);

            for (var i = 0; i < word.length; i++) {
                tb.opEdit.insert(tb.tbcursor.cursor, word.charCodeAt(i), this.on_par_changed);
            }
        } else if (cmd == 'replace') {
            if (word.length == 0) {
                // console.log('zero')
                return;
            }

			//D20200508
            tb.opEdit.undo(null, { undo_for_replace: true });
            var opt = { replace: true }
            tb.opEdit.insert_string(tb.tbcursor.cursor, word, this.on_par_changed, opt);
        }
    }

    // ime composition중 backspace로 글자가 소멸되는 경우 호출
    private on_remove_by_ime_backspace = () => {
        var tb = this.tb;
        tb.opEdit.erase(tb.tbcursor.cursor - 1, tb.tbcursor.cursor - 1, tb.tbcursor.cursor - 1, this.on_par_changed);
    }

    private on_keydown = (event: KeyboardEvent) => {
        // user_keyboard_event_filter callback이 true를 리턴하면 더이상 진행 안함.
        if (this.tb.user_keyboard_event_filter) {
            if (this.tb.user_keyboard_event_filter(event) == true)
                return;
        }
        this.cursor_elem.classList.remove('kayak-blink');

        this.keydown_action.on_keydown(event, this.on_par_changed);
    }

    private on_keyup = (event: KeyboardEvent) => {
        this.cursor_elem.classList.add('kayak-blink');
    }

    // this is callback for document changing
    private on_par_changed = (err: any, text_change_info?: any, par_change_info?: any) => {
        // console.log('on_par_changed() called');
        if (par_change_info == null)
            return;
        return;
    }

    ///////////////////////////////////////////////////////////////////////////////
}


export default TB_Input;
