import _g from './TB_PlatformEnv';
import TB_NormalizedIME from "./TB_NormalizedIME";
import type { ImeOptions, ImeCmd, KeyboardTarget } from './types';

class TB_Keyboard {
    private current_target: KeyboardTarget | null;
    private inp_box: HTMLElement;
    private kbd: HTMLElement | null;
    private ime: TB_NormalizedIME | null;

    constructor(element: HTMLElement) {
        this.current_target = null;

        // div
        this.inp_box = element.querySelector('.kayak_input_box')!;

        this.kbd = null;
        this.ime = null;

        this.init();
    }

    private init(): void {
        this.kbd = this.create_kdb();
        this.inp_box.appendChild(this.kbd);

        this.init_ime();
    }

    private create_kdb(): HTMLElement {
        var kbd = _g.document!.createElement('span');
        kbd.setAttribute('id', 'kayak_ime_proxy');
        /*  IE대응-1, Safari-9
            IE에서 user-select:none이 지정되면 contenteditable element에 focus()를 해도 제대로 focus되지 않음.
            정확히 설명하면, element에 focus는 가지만 편집가능한 contenteditable text에 가는 것이 아니라
            (caret을 가지지 않은) element 자체에만 포커스가 감.
            그 결과로, 한글 입력이 안되는 문제가 발생함.
        */
        var kdb_style = '-ms-user-select:auto !important;';
        kdb_style += '-webkit-user-select:auto !important;';
        kdb_style += 'user-select:auto !important;';
        /*  IE대응-2
            contenteditable의 caret은 항상 전면에 나오며, visible 하게 나오려는 속성이 있음.
            caret을 숨기기 위해 height를 zero로 하며, overflow안되도록 함.
        */
        kdb_style += 'position:absolute; left:0px; top:0px; height:0px; overflow:hidden;'
        kdb_style += 'border:1px solid red;';
        kbd.setAttribute('style', kdb_style);
        (kbd as any).contentEditable = true;   // TB_Utils.create_tmp_contentEditable_elem_on_root()와 같은 이유 (불리언을 그대로 둔다)

        // Listener 등록 --------------------------------------------

        // cursor show/hide에 사용
        kbd.addEventListener('blur', (e) => {
            // console.log('kbd blurred...');
            this.current_target && this.current_target.textbox.tbcursor.show_cursor(false);
        })
        kbd.addEventListener('focus', (e) => {
            // parent element의 mousedown시 간접적으로 keyboard focus를 유발시킬 수 있으므로
            // parent element의 mousedown시 반드시 preventDefault()를 해 줄 것.
            // console.log('kbd focused...');
            this.current_target && this.current_target.textbox.tbcursor.show_cursor(true);
        })

        return kbd;
    }

    private init_ime(): void {
        // options의 메서드는 options 객체를 this로 쓰므로(flag_composition_start) function을 유지한다. TB_Keyboard는 kb로 잡는다.
        const kb = this;
        var options: ImeOptions = {
            // 필수항목
            kbd_input_box: this.inp_box,
            kbd_input: this.kbd!,
            flag_composition_start: false,
            composition_start: function () {
                this.flag_composition_start = true;
            },
            composing_word: function (word: string, cmd?: ImeCmd) {
                let _cmd: ImeCmd = null;
                if (cmd == null)
                    _cmd = this.flag_composition_start ? 'insert' : 'replace';
                else
                    _cmd = cmd;
                this.flag_composition_start = false;

                if (word.length > 0)
                    kb.current_target && kb.current_target.on_insert_word(word, _cmd);

                // console.log('--------> composing_word:' + word + '[' + _cmd + ']');

            },
            composed_word: function (word: string, cmd?: ImeCmd) {
                // console.log('--------> composed_word:' + word + '[' + cmd + ']');

                /*
                    cmd가 null인 경우가 있음
                    - 한글 조합이 되는 경우 cmd가 null이 될 수 있으며,
                      이런 경우는 composing_word 단계에서 이미 처리되었기 때문에
                      현단계에서는 아무 처리 하지 않는다.
                    예>
                        "가나"를 입력한 경우
                        composing_word:ㄱ[insert]
                        composing_word:가[replace]
                        composing_word:간[replace]
                        composing_word:가[replace]
                        composed_word:가[undefined] <--- 바로 전단계에서 replace되었으므로 아무 처리 하지 말 것.
                        composing_word:나[insert]
                */

                // 한글 조합중 back-space입력으로 완전히 word가 없어지는 시점에는 insert자체를 하지 않는다.
                if (word.length > 0)
                    kb.current_target && kb.current_target.on_insert_word(word, cmd);
                else if (cmd == 'delete')
                    kb.current_target && kb.current_target.on_remove_by_ime_backspace();
            },
            keydown: function (e: KeyboardEvent) {
                kb.current_target && kb.current_target.on_keydown(e);
            },
            keyup: function (e: KeyboardEvent) {
                kb.current_target && kb.current_target.on_keyup(e);
            },
            on_copy: function (e: ClipboardEvent) {
                kb.current_target && kb.current_target.on_copy(e);
            },
            on_cut: function (e: ClipboardEvent) {
                kb.current_target && kb.current_target.on_cut(e);
            },
            on_beforepaste: function (e: Event) {
                kb.current_target && kb.current_target.on_beforepaste(e);
            },
            on_paste: function (e: ClipboardEvent) {
                kb.current_target && kb.current_target.on_paste(e);
            },
            // -----------------------------------------------------
            // belows for inspection
            kbd_listener: function (e: Event) { },
            log: function (str: string) { /* console.log(str) */ },
            log_norm: function (str: string) { }
        }
        this.ime = new TB_NormalizedIME(options);
    }

    get_inp(): HTMLElement {
        return this.ime!.ime_ctx.inp;
    }
    get_inp_box(): HTMLElement {
        return this.ime!.ime_ctx.inp_box;
    }

    /*
    this.show_ime = function(show) {
        // dislay:none이 되면 blur event가 발생하니 주의할 것.
        // ime.ime_ctx.inp_box.style.display = show ? 'block' : 'none';
    }
    */

    focus(target: KeyboardTarget): void {
        this.current_target = target;
        this.ime!.focus({preventScroll:true});
    }
    // TB_Input이 options를 넘기지만 원본은 인자를 받지 않았다. 인자는 무시한다.
    blur(_target?: KeyboardTarget): void {
        this.ime!.blur();
    }
}


export default TB_Keyboard;
