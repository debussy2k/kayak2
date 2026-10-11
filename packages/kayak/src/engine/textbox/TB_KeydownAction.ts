import TB_Utils from './TB_Utils';
import { TB_FontSizeStepUtil } from './TB_FontSizeStepUtil'
import type { TextBoxHost, BrowserInfo, SelInfo, ParChangedCallback } from './types';

class TB_KeydownAction {
    tb: TextBoxHost;
    isMacOS: boolean;
    browser: BrowserInfo;
    font_size_step_util: TB_FontSizeStepUtil;

    constructor(tb: TextBoxHost) {
        this.tb = tb;
        this.isMacOS = TB_Utils.isMacOS();
        this.browser = TB_Utils.get_browser_info();
        this.font_size_step_util = new TB_FontSizeStepUtil();

    }
    on_keydown(event: KeyboardEvent, on_par_changed: ParChangedCallback): void {
        // console.log('haha')

        var tb = this.tb;
        var key_processed = true;
        var style_listener_options: { erase_cmd: boolean } | null = null;

        ////////////////////////////////////////////////////////////
        var ch = event.keyCode;
        var cursor: number = tb.tbcursor.cursor;
        var sel: SelInfo = tb.tbcursor.sel();

        ////////////////////////////////////////////////////////////
        let ctrl_cmd = this.isMacOS ? event.metaKey : event.ctrlKey;


        if (ch === 8) { // Backspace
            if (cursor > 0 && sel.exists_range == false)
                tb.opEdit.erase(cursor - 1, cursor - 1, cursor - 1, on_par_changed);
            else if (sel.exists_range) {
                tb.opEdit.erase(sel.begin, sel.begin, sel.end, on_par_changed);
            }
            
            style_listener_options = { erase_cmd: true}            
            event.preventDefault();
        } else if (ch === 46) { // Delete
            if (sel.exists_range)
                tb.opEdit.erase(sel.begin, sel.begin, sel.end, on_par_changed);
            else
                tb.opEdit.erase(cursor, sel.begin, sel.end, on_par_changed);
            
            style_listener_options = { erase_cmd: true}
            event.preventDefault();
        }
        // see --> std_copy()
        else if (ch == 67 && ctrl_cmd) { // ctrl + c
            // console.log('=== native copy');
            // (IE11) document에서 copy event를 받기 위해 IE인 경우에는 절대 preventDefault()를 하면 안됨.
            if (this.browser.name == 'ie') {
                return; // 그냥 내려가면 stopPropagation()이 작동함.
            }
        } else if (ch == 86 && ctrl_cmd && !event.shiftKey) { // ctrl + v
            // console.log('=== native paste');
            if (this.browser.name == 'ie') {
                return; // 그냥 내려가면 stopPropagation()이 작동함.
            }
        } else if (ch == 86 && ctrl_cmd) { // ctrl + shift + v
            // console.log('=== internal paste with style');
            tb.opEdit.paste(tb.tbcontext.masterClipboard, sel, on_par_changed);
            cursor += tb.tbcontext.masterClipboard.get_element_size(); //D
            event.preventDefault();
        } else if (ch == 88 && ctrl_cmd) { // ctrl + x
            // 예전 소스 18.1.24
            // if (sel.exists_range) {
            //     tb.opEdit.copy(tb.tbcontext.masterClipboard, sel.begin, sel.end);
            //     tb.opEdit.erase(sel.begin, sel.begin, sel.end, on_par_changed);
            // }

            // console.log('=== native copy');
            // (IE11) document에서 cut event를 받기 위해 IE인 경우에는 절대 preventDefault()를 하면 안됨.
            if (this.browser.name == 'ie') {
                return; // 그냥 내려가면 stopPropagation()이 작동함.
            }
        } else if (ch == 90 && ctrl_cmd) { // ctrl + z
            tb.opEdit.undo(on_par_changed);
            event.preventDefault();
        } else if (ch == 89 && ctrl_cmd) { // ctrl + y
            tb.opEdit.redo(on_par_changed);
            event.preventDefault();
        } else if (ch === 76 && ctrl_cmd && event.shiftKey) { // ctrl+shift+L
            sel = tb.tbcursor.sel_by_rule();
            tb.opStyle.set_text_align('left', sel, on_par_changed);
            event.preventDefault();
        } else if (ch === 69 && ctrl_cmd && event.shiftKey) { // ctrl+shift+E
            sel = tb.tbcursor.sel_by_rule();
            tb.opStyle.set_text_align('center', sel, on_par_changed);
            event.preventDefault();
        } else if (ch === 82 && ctrl_cmd && event.shiftKey) { // ctrl+shift+R
            sel = tb.tbcursor.sel_by_rule();
            tb.opStyle.set_text_align('right', sel, on_par_changed);
            event.preventDefault();
        } else if (ch === 33) { // Page up
            event.preventDefault();
        } else if (ch === 34) { // Page down
            event.preventDefault();
        } else if (ch === 35) { // End
            tb.tbcursor.input_end(event.shiftKey, ctrl_cmd);
            event.preventDefault();
        } else if (ch === 36) { // Home
            tb.tbcursor.input_home(event.shiftKey, ctrl_cmd);
            event.preventDefault();
        } else if (ch === 37) { // left
            var step = 1;
            if (ctrl_cmd) {
                step = tb.opEdit.find_steps_to_prev_word();
            }
            tb.tbcursor.input_left(step, event.shiftKey);
            event.preventDefault();
        } else if (ch === 39) { // right
            var step = 1;
            if (ctrl_cmd) {
                step = tb.opEdit.find_steps_to_next_word();
            }
            tb.tbcursor.input_right(step, event.shiftKey);
            event.preventDefault();
        } else if (ch === 38) { // up
            tb.tbcursor.input_up(event.shiftKey);
            event.preventDefault();
        } else if (ch === 40) { // down
            tb.tbcursor.input_down(event.shiftKey);
            event.preventDefault();
        } else if (ch == 65 && ctrl_cmd) { // ctrl + a
            let end_pos = tb.text_on_path ? tb.text_length()-1 : tb.text_length();
            tb.tbcursor.set_selection(0, end_pos);
            event.preventDefault();
        } else if (ch == 66 && ctrl_cmd) { // ctrl + b
            // console.log('bold: ');
            tb.opStyle.set_bold(null, sel, on_par_changed);
            event.preventDefault();
        } else if (ch == 188 && ctrl_cmd && event.shiftKey) { // ',' : 188
            sel = tb.tbcursor.sel_by_rule();
            if (sel.exists_range === false)
                return;
            var cur_style = tb.get_style_info(sel.end);
            var target_font_size = this.font_size_step_util.lower_font_size(cur_style.FontSize);
            tb.opStyle.set_font_size(target_font_size, sel, on_par_changed);
            event.preventDefault();
        } else if (ch == 190 && ctrl_cmd && event.shiftKey) { // '.' : 190
            sel = tb.tbcursor.sel_by_rule();
            if (sel.exists_range === false)
                return;
            var cur_style = tb.get_style_info(sel.end);
            var target_font_size = this.font_size_step_util.upper_font_size(cur_style.FontSize);
            // console.log(cur_style.FontSize, '-->', target_font_size);
            tb.opStyle.set_font_size(target_font_size, sel, on_par_changed);
            event.preventDefault();
        } else if (ch === 80 && ctrl_cmd && event.shiftKey && event.altKey) { // ctrl+shift+alt+P.
            // kayak json파일을 clipboard에 저장한다.
            let obj = tb.saveAsJson();
            navigator.clipboard.writeText(JSON.stringify(obj, null, 4)); // Chrome66부터 지원됨
            event.preventDefault();
        } else {
            key_processed = false;
        }

        event.stopPropagation();

        if (key_processed) {
            /* style_listener_optionsd의 역할
                - "erase"가 수행된 직후에는, tb.curStyle을 reset하지 않도록 지시함.
                  erase한 cursor 위치에서 다른 입력을 할 때 erase된 곳의 style이 적용되도록 하기 위함.
            */
            tb.style_listener(style_listener_options);
        }        
    }
}

export { TB_KeydownAction }