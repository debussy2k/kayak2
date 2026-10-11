/*
    G-1 묶음 특성 테스트.
    - ime/TB_Ime_*: 순수 함수. 가짜 e/ime_ctx/options로 이벤트 시퀀스를 돌려 호출 기록과 상태를 스냅샷으로 고정한다.
    - TB_NormalizedIME, TB_Keyboard: jsdom에서 실제 element에 이벤트를 dispatch한다.
      jsdom은 TB_Utils.get_browser_info()가 'safari_mac'이므로 Safari 리스너를 탄다 (test/engine/textbox/__snapshots__/platform_utils 참고).
    - TB_KeydownAction: 가짜 tb로 키마다 어떤 편집/커서 명령이 불리는지 고정한다.
*/
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { window } from './helpers';
import { fire, recorder } from './dom_events';
import TB_Ime_Chrome from '../../../src/engine/textbox/ime/TB_Ime_Chrome';
import TB_Ime_EdgeTo15 from '../../../src/engine/textbox/ime/TB_Ime_EdgeTo15';
import TB_Ime_EdgeFrom16 from '../../../src/engine/textbox/ime/TB_Ime_EdgeFrom16';
import TB_Ime_Safari_Mac from '../../../src/engine/textbox/ime/TB_Ime_Safari_Mac';
import TB_Ime_Safari_iOS from '../../../src/engine/textbox/ime/TB_Ime_Safari_iOS';
import TB_NormalizedIME from '../../../src/engine/textbox/TB_NormalizedIME';
import TB_Keyboard from '../../../src/engine/textbox/TB_Keyboard';
import { TB_KeydownAction } from '../../../src/engine/textbox/TB_KeydownAction';

const OPTION_NAMES = ['composition_start', 'composing_word', 'composed_word', 'keydown', 'keyup', 'on_copy', 'on_cut', 'on_beforepaste', 'on_paste', 'kbd_listener', 'log', 'log_norm'];

// Safari 리스너는 console.log를 찍는다. 출력만 막는다.
beforeAll(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { vi.restoreAllMocks(); });

function make_ctx() {
    return { inp: { textContent: '' }, isComposing: false, composing: '', composed: '', last_composing_state: null, focus_blurred: false, need_clear_text: false, dom_str_new: '', dom_str_prev: '', key_pressed: false, key_pressed_keyCode: null, last_event: '' };
}
/** options 기록기: keydown/keyup은 keyCode만, 나머지는 인자 그대로 */
function make_options() {
    const rec = recorder(OPTION_NAMES);
    const keydown = rec.fns.keydown, keyup = rec.fns.keyup;
    rec.fns.keydown = e => keydown(e.keyCode);
    rec.fns.keyup = e => keyup(e.keyCode);
    rec.fns.log = () => {};   // 기록하지 않는다 (문장이 길다)
    return rec;
}
const ctx_brief = c => ({ isComposing: c.isComposing, composing: c.composing, composed: c.composed, last_composing_state: c.last_composing_state, focus_blurred: c.focus_blurred, need_clear_text: c.need_clear_text, inp: c.inp.textContent });

/** listener에 이벤트 시퀀스를 넣는다. 각 항목은 [event, inp.textContent를 미리 바꿀 값?] */
function run(listener, seq, { track_last_event } = {}) {
    const ctx = make_ctx(), rec = make_options();
    const log = [];
    for (const [e, inp_text] of seq) {
        if (inp_text !== undefined) ctx.inp.textContent = inp_text;
        listener(e, ctx, rec.fns);
        if (track_last_event) ctx.last_event = e.type;   // TB_NormalizedIME가 Chrome 리스너 뒤에 하는 일
        log.push([e.type, e.data === undefined ? '' : e.data, rec.calls.splice(0), ctx_brief(ctx)]);
    }
    return log;
}

describe('ime/TB_Ime_Chrome', () => {
    it('한글 조합 → 완성 → Windows11 이중 textInput 무시 → 영문 → 조합 중 backspace 소멸 → 조합 중 blur', () => {
        expect(run(TB_Ime_Chrome, [
            [{ type: 'keydown', keyCode: 229 }],
            [{ type: 'compositionstart' }, 'old'],
            [{ type: 'compositionupdate', data: 'ㄱ' }],
            [{ type: 'compositionupdate', data: '가' }],
            [{ type: 'compositionend', data: '가' }, '가'],
            [{ type: 'textInput', data: '가' }],            // compositionend 직후 → 무시
            [{ type: 'keyup', keyCode: 229 }],
            [{ type: 'textInput', data: 'a\xA0b' }],         // nbsp → space
            [{ type: 'compositionstart' }],
            [{ type: 'compositionupdate', data: '' }],      // 길이 0은 무시
            [{ type: 'compositionend', data: '' }, ''],     // backspace로 소멸 → delete
            [{ type: 'compositionstart' }],
            [{ type: 'compositionend', data: '' }, 'ㅎ'],    // 조합 중 blur
            [{ type: 'textInput', data: 'ㅎ' }],            // focus_blurred → 무시하고 플래그 해제
            [{ type: 'textInput', data: 'c' }],
            [{ type: 'copy' }], [{ type: 'cut' }], [{ type: 'paste' }], [{ type: 'input' }],
        ], { track_last_event: true })).toMatchSnapshot();
    });
});

describe('ime/TB_Ime_EdgeTo15 / TB_Ime_EdgeFrom16', () => {
    const seq = [
        [{ type: 'keydown', keyCode: 229 }],
        [{ type: 'compositionstart' }, ''],
        [{ type: 'compositionupdate' }, 'ㄱ'],
        [{ type: 'compositionupdate' }, '가'],
        [{ type: 'compositionend', data: '가' }, '가'],
        [{ type: 'keyup', keyCode: 229 }],
        [{ type: 'keydown', keyCode: 16 }],                 // shift는 조합을 끊지 않는다
        [{ type: 'keydown', keyCode: 65 }],                 // 일반 키 → 조합 확정, 입력 상자 비움
        [{ type: 'keypress', char: 'a', key: 'a' }],
        [{ type: 'keyup', keyCode: 65 }],                   // need_clear_text → 비움
        [{ type: 'keypress', char: '\r', key: 'Enter' }],
        [{ type: 'compositionstart' }, ''],
        [{ type: 'compositionend', data: '' }, ''],         // 소멸 → delete
        [{ type: 'copy' }], [{ type: 'cut' }], [{ type: 'beforepaste' }], [{ type: 'paste' }],
    ];
    it('EdgeTo15', () => { expect(run(TB_Ime_EdgeTo15, seq)).toMatchSnapshot(); });
    it('EdgeFrom16', () => { expect(run(TB_Ime_EdgeFrom16, seq)).toMatchSnapshot(); });
});

describe('ime/TB_Ime_Safari_Mac / TB_Ime_Safari_iOS', () => {
    const seq = [
        [{ type: 'keydown', keyCode: 229 }],
        [{ type: 'textInput', data: 'a\xA0' }],
        [{ type: 'compositionstart' }, 'old'],
        [{ type: 'compositionupdate', data: 'ㄱ' }],
        [{ type: 'compositionupdate', data: '' }],
        [{ type: 'compositionend', data: '가' }],
        [{ type: 'textInput', data: '가' }],                // compositionend 직후 → 무시
        [{ type: 'textInput', data: 'b' }],
        [{ type: 'compositionstart' }],
        [{ type: 'compositionend', data: '' }],             // delete
        [{ type: 'keyup', keyCode: 229 }],
        [{ type: 'copy' }], [{ type: 'cut' }], [{ type: 'paste' }],
    ];
    it('Safari_Mac', () => { expect(run(TB_Ime_Safari_Mac, seq)).toMatchSnapshot(); });
    it('Safari_iOS', () => { expect(run(TB_Ime_Safari_iOS, seq)).toMatchSnapshot(); });
});

describe('TB_NormalizedIME (jsdom → safari_mac 리스너)', () => {
    function make() {
        const box = window.document.createElement('div');
        const span = window.document.createElement('span');
        box.appendChild(span);
        window.document.body.appendChild(box);
        const rec = make_options();
        const options = Object.assign({ kbd_input_box: box, kbd_input: span, flag_composition_start: false }, rec.fns);
        const ime = new TB_NormalizedIME(options);
        return { box, span, rec, ime };
    }
    it('ime_ctx 초기값과 inp/inp_box', () => {
        const { box, span, ime } = make();
        expect([ime.ime_ctx.inp, ime.ime_ctx.inp_box, ime.contenteditable_state]).toEqual([span, box, null]);
        expect(ctx_brief(ime.ime_ctx)).toEqual({ isComposing: false, composing: '', composed: '', last_composing_state: null, focus_blurred: false, need_clear_text: false, inp: '' });
    });
    it('element 이벤트가 리스너를 거쳐 options로 전달된다', () => {
        const { span, rec, ime } = make();
        fire(span, 'keydown', { keyCode: 65 });
        fire(span, 'compositionstart');
        fire(span, 'compositionupdate', { data: 'ㄱ' });
        fire(span, 'compositionend', { data: '가' });
        fire(span, 'textInput', { data: 'x' });     // compositionend 직후 → 무시
        fire(span, 'textInput', { data: 'x' });
        fire(span, 'copy');
        expect(rec.calls.filter(c => c[0] !== 'kbd_listener')).toMatchSnapshot();
        expect(rec.calls.filter(c => c[0] === 'kbd_listener').length).toBe(7);
        expect(ime.ime_ctx.isComposing).toBe(false);
    });
    it('focus/blur는 contenteditable 속성을 한 번만 바꾼다', () => {
        const { span, ime } = make();
        ime.focus();
        expect([span.getAttribute('contenteditable'), ime.contenteditable_state]).toEqual(['true', true]);
        span.setAttribute('contenteditable', 'x');
        ime.focus();                                   // 상태가 true면 다시 쓰지 않는다
        expect(span.getAttribute('contenteditable')).toBe('x');
        ime.blur();
        expect([span.getAttribute('contenteditable'), ime.contenteditable_state]).toEqual(['false', false]);
    });
});

describe('TB_Keyboard (jsdom)', () => {
    function make() {
        const element = window.document.createElement('div');
        element.innerHTML = "<div class='kayak_input_box'></div>";
        window.document.body.appendChild(element);
        const kb = new TB_Keyboard(element);
        const rec = recorder(['on_insert_word', 'on_remove_by_ime_backspace', 'on_keydown', 'on_keyup', 'on_copy', 'on_cut', 'on_beforepaste', 'on_paste', 'show_cursor']);
        const target = Object.assign({ textbox: { tbcursor: { show_cursor: rec.fns.show_cursor } } }, rec.fns);
        target.on_keydown = e => rec.fns.on_keydown(e.keyCode);
        target.on_keyup = e => rec.fns.on_keyup(e.keyCode);
        return { element, kb, rec, target };
    }
    it('kayak_ime_proxy span을 input box에 만든다', () => {
        const { element, kb } = make();
        const span = element.querySelector('#kayak_ime_proxy');
        expect(span).not.toBeNull();
        expect([kb.get_inp(), kb.get_inp_box()]).toEqual([span, element.querySelector('.kayak_input_box')]);
        expect(span.contentEditable).toBe(true);
        expect(span.getAttribute('style')).toContain('height:0px');
    });
    it('focus(target) 뒤 키/조합 이벤트가 target으로 간다 (insert → replace, 소멸 → backspace)', () => {
        const { kb, rec, target } = make();
        const inp = kb.get_inp();
        fire(inp, 'keydown', { keyCode: 65 });          // target 없음 → 무시
        kb.focus(target);
        fire(inp, 'keydown', { keyCode: 65 });
        fire(inp, 'keyup', { keyCode: 65 });
        fire(inp, 'textInput', { data: 'a' });
        fire(inp, 'compositionstart');
        fire(inp, 'compositionupdate', { data: 'ㄱ' });
        fire(inp, 'compositionupdate', { data: '가' });
        fire(inp, 'compositionend', { data: '가' });
        fire(inp, 'compositionstart');
        fire(inp, 'compositionend', { data: '' });
        fire(inp, 'copy'); fire(inp, 'cut'); fire(inp, 'paste');
        expect(rec.calls.filter(c => c[0] !== 'show_cursor')).toMatchSnapshot();
        kb.blur();
        expect(inp.getAttribute('contenteditable')).toBe('false');
    });
});

describe('TB_KeydownAction (가짜 tb)', () => {
    function make() {
        const rec = recorder(['erase', 'paste', 'undo', 'redo', 'find_steps_to_prev_word', 'find_steps_to_next_word', 'set_text_align', 'set_bold', 'set_font_size', 'input_end', 'input_home', 'input_left', 'input_right', 'input_up', 'input_down', 'set_selection', 'style_listener']);
        const tb = {
            tbcursor: Object.assign({ cursor: 3, sel: () => ({ cursor: 3, begin: 3, end: 3, exists_range: false }), sel_by_rule: () => ({ cursor: 3, begin: 0, end: 10, exists_range: true }) }, rec.fns),
            opEdit: Object.assign({}, rec.fns, { find_steps_to_prev_word: () => { rec.fns.find_steps_to_prev_word(); return 2; }, find_steps_to_next_word: () => { rec.fns.find_steps_to_next_word(); return 3; } }),
            opStyle: rec.fns,
            tbcontext: { masterClipboard: { get_element_size: () => 4 } },
            text_on_path: null,
            text_length: () => 10,
            get_style_info: () => ({ FontSize: 12 }),
            style_listener: rec.fns.style_listener,
            saveAsJson: () => ({}),
        };
        return { tb, rec, action: new TB_KeydownAction(tb) };
    }
    const ev = (keyCode, mods) => Object.assign({ keyCode, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } }, mods);
    it('키별 동작', () => {
        const rows = [];
        const keys = [
            ['Backspace', ev(8)], ['Delete', ev(46)], ['ctrl+c', ev(67, { ctrlKey: true })], ['ctrl+v', ev(86, { ctrlKey: true })],
            ['ctrl+shift+v', ev(86, { ctrlKey: true, shiftKey: true })], ['ctrl+x', ev(88, { ctrlKey: true })], ['ctrl+z', ev(90, { ctrlKey: true })], ['ctrl+y', ev(89, { ctrlKey: true })],
            ['ctrl+shift+L', ev(76, { ctrlKey: true, shiftKey: true })], ['ctrl+shift+E', ev(69, { ctrlKey: true, shiftKey: true })], ['ctrl+shift+R', ev(82, { ctrlKey: true, shiftKey: true })],
            ['PageUp', ev(33)], ['End', ev(35, { shiftKey: true })], ['Home', ev(36, { ctrlKey: true })], ['Left', ev(37)], ['ctrl+Left', ev(37, { ctrlKey: true })],
            ['shift+Right', ev(39, { shiftKey: true })], ['ctrl+Right', ev(39, { ctrlKey: true })], ['Up', ev(38)], ['Down', ev(40, { shiftKey: true })],
            ['ctrl+a', ev(65, { ctrlKey: true })], ['ctrl+b', ev(66, { ctrlKey: true })], ['ctrl+shift+,', ev(188, { ctrlKey: true, shiftKey: true })], ['ctrl+shift+.', ev(190, { ctrlKey: true, shiftKey: true })],
            ['Q', ev(81)], ['meta+a (jsdom은 mac이 아님)', ev(65, { metaKey: true })],
        ];
        for (const [name, e] of keys) {
            const { rec, action } = make();
            action.on_keydown(e, 'cb');
            rows.push([name, rec.calls, e.prevented, e.stopped]);
        }
        expect(rows).toMatchSnapshot();
    });
    it('selection이 있으면 Backspace/Delete는 범위를 지우고, ctrl+a는 text_on_path면 끝-1까지', () => {
        const { tb, rec, action } = make();
        tb.tbcursor.sel = () => ({ cursor: 5, begin: 2, end: 5, exists_range: true });
        action.on_keydown(ev(8), 'cb');
        action.on_keydown(ev(46), 'cb');
        tb.text_on_path = {};
        action.on_keydown(ev(65, { ctrlKey: true }), 'cb');
        expect(rec.calls).toMatchSnapshot();
    });
});
