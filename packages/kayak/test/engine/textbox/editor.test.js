/*
    G-2 묶음 특성 테스트: TB_Cursor, TB_Input을 실제 textbox(test/snapshot/helpers.create_textbox) 위에서 돌린다.
    키보드/IME/클립보드 이벤트는 kayak_ime_proxy span에 직접 dispatch한다.
    jsdom은 'safari_mac'으로 판정되므로 TB_NormalizedIME는 Safari 리스너를, TB_Input은 std_copy/std_paste를 쓴다.
*/
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { create_textbox, destroy_textbox } from '../../snapshot/helpers';
import { fire, fake_clipboard } from './dom_events';

let tb;
beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    tb = await create_textbox();
    tb.opEdit.insert_string(0, 'Hello world');
});
afterAll(() => { destroy_textbox(tb); vi.restoreAllMocks(); });

const text = () => tb.text_core.toString();
const sel = () => tb.tbcursor.sel();
async function until(pred, ms = 3000) {
    const t0 = Date.now();
    while (!pred()) {
        if (Date.now() - t0 > ms) throw new Error('timeout');
        await new Promise(r => setTimeout(r, 20));
    }
}

describe('TB_Cursor', () => {
    it('insert_string 뒤 커서는 끝, set()은 [0, text_length-1]로 자른다', () => {
        expect([text(), tb.text_length(), tb.tbcursor.cursor]).toEqual(['Hello world$', 12, 11]);
        tb.tbcursor.set(-5); expect(tb.tbcursor.cursor).toBe(0);
        tb.tbcursor.set(100); expect(tb.tbcursor.cursor).toBe(11);
        tb.tbcursor.set(3); expect(tb.tbcursor.cursor).toBe(3);
        expect(sel()).toEqual({ cursor: 3, begin: 3, end: 3, exists_range: false });
        expect(tb.tbcursor.sel_by_rule()).toEqual({ cursor: 3, begin: 0, end: 12, exists_range: true, empty_originally: true });
        expect(tb.tbcursor.sel_all()).toEqual({ cursor: 3, begin: 0, end: 12, exists_range: true });
        expect(tb.tbcursor.is_empty()).toBe(true);
    });
    it('set_selection은 overlay를 그리고 clear_sel은 지운다', () => {
        tb.tbcursor.set_selection(2, 6);
        expect(sel()).toEqual({ cursor: 6, begin: 2, end: 6, exists_range: true });
        expect(tb.tbcursor.is_empty()).toBe(false);
        const overlay = tb.element.querySelector('.kayak-line > .kayak-selection-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay.style.visibility).toBe('visible');
        tb.tbcursor.show_selection(false);
        expect([tb.tbcursor.get_selection_visibility(), overlay.style.visibility]).toEqual([false, 'hidden']);
        tb.tbcursor.show_selection(true);
        tb.tbcursor.clear_sel();
        expect([tb.tbcursor.is_empty(), tb.element.querySelector('.kayak-selection-overlay')]).toEqual([true, null]);
        // 선택 끝이 text_length(마지막 $ 뒤)여도 커서는 그 앞
        tb.tbcursor.set_selection(0, 12);
        expect(sel()).toEqual({ cursor: 11, begin: 0, end: 12, exists_range: true });
        tb.tbcursor.clear_sel();
    });
    it('input_left/right: 이동, shift 선택, 선택 해제 방향', () => {
        tb.tbcursor.set(3);
        tb.tbcursor.input_right(1, false); expect(tb.tbcursor.cursor).toBe(4);
        tb.tbcursor.input_left(2, false); expect(tb.tbcursor.cursor).toBe(2);
        tb.tbcursor.input_right(1, true); expect(sel()).toEqual({ cursor: 3, begin: 2, end: 3, exists_range: true });
        tb.tbcursor.input_right(1, true); expect(sel()).toEqual({ cursor: 4, begin: 2, end: 4, exists_range: true });
        tb.tbcursor.input_left(1, false); expect(sel()).toEqual({ cursor: 2, begin: 2, end: 2, exists_range: false });
        tb.tbcursor.input_right(100, true); expect(sel()).toEqual({ cursor: 11, begin: 2, end: 12, exists_range: true });
        tb.tbcursor.input_left(1, true); expect(sel()).toEqual({ cursor: 11, begin: 2, end: 11, exists_range: true });
        tb.tbcursor.input_right(1, false); expect(sel()).toEqual({ cursor: 11, begin: 11, end: 11, exists_range: false });
        tb.tbcursor.input_left(100, false); expect(tb.tbcursor.cursor).toBe(0);
    });
    it('input_home/end, input_up/down(한 줄이면 무시), dblclick', () => {
        tb.tbcursor.set(3);
        tb.tbcursor.input_end(false, false); expect(tb.tbcursor.cursor).toBe(11);
        tb.tbcursor.input_home(false, false); expect(tb.tbcursor.cursor).toBe(0);
        tb.tbcursor.input_end(true, false); expect(sel()).toEqual({ cursor: 11, begin: 0, end: 11, exists_range: true });
        tb.tbcursor.input_home(false, true); expect(sel().exists_range).toBe(false);
        tb.tbcursor.set(5);
        tb.tbcursor.input_up(false); tb.tbcursor.input_down(false);
        expect(tb.tbcursor.cursor).toBe(5);
        tb.tbcursor.input_dblclick_by_index(7);
        expect(sel()).toMatchSnapshot();          // 'world' 단어 선택 (find_steps_to_*_word가 정한다)
        tb.tbcursor.clear_sel();
    });
    it('show_cursor, get_location_info', () => {
        const cursor_elem = tb.element.querySelector('.kayak-cursor');
        tb.tbcursor.show_cursor(false); expect(cursor_elem.style.visibility).toBe('hidden');
        tb.tbcursor.show_cursor(true); expect(cursor_elem.style.visibility).toBe('visible');
        tb.tbcursor.set(4);
        const info = tb.tbcursor.get_location_info().last_cursor_loc_info;
        expect(typeof info.x_pos).toBe('number');
        expect(info.location.ci_doc).toBe(4);
        expect(cursor_elem.style.left).toBe(info.x_pos + 'px');
    });
});

describe('TB_Input', () => {
    const inp = () => tb.tbinput.get_inp();
    it('sel_state 전이와 content cursor 스타일', () => {
        const content = tb.element.querySelector('.kayak-content');
        expect([tb.tbinput.get_sel_state(), tb.tbinput.get_sel_state_text()]).toEqual([0, 'ST_NONE']);
        tb.tbinput.set_select();
        expect([tb.tbinput.get_sel_state(), tb.tbinput.get_sel_state_text(), content.style.cursor]).toEqual([1, 'ST_SELECTED', 'text']);
        tb.tbinput.set_focus();
        expect([tb.tbinput.get_sel_state(), tb.tbinput.get_sel_state_text(), inp().getAttribute('contenteditable')]).toEqual([2, 'ST_FOCUSED', 'true']);
        tb.tbinput.set_blur();
        expect([tb.tbinput.get_sel_state(), content.style.cursor, inp().getAttribute('contenteditable')]).toEqual([0, 'default', 'false']);
        expect(inp().id).toBe('kayak_ime_proxy');
    });
    it('relocate_ime_box: 입력 상자 style에 현재 스타일과 커서 위치', () => {
        tb.set_focus();
        tb.tbcursor.set(2);
        tb.tbinput.relocate_ime_box();
        const style = tb.tbinput.get_inp().parentNode.getAttribute('style');
        expect(style).toMatch(/height:[0-9.]+px;left:-?[0-9.]+px;top:-?[0-9.]+px;/);
        expect(style).toContain('font-size:');
    });
    it('키보드: Backspace, ctrl+a, Delete, ctrl+z', () => {
        tb.set_focus();
        tb.tbcursor.set(11);
        fire(inp(), 'keydown', { keyCode: 8 });
        expect([text(), tb.tbcursor.cursor]).toEqual(['Hello worl$', 10]);
        fire(inp(), 'keydown', { keyCode: 65, ctrlKey: true });
        expect(sel()).toEqual({ cursor: 10, begin: 0, end: 11, exists_range: true });
        fire(inp(), 'keydown', { keyCode: 46 });
        expect([text(), tb.tbcursor.cursor]).toEqual(['$', 0]);
        fire(inp(), 'keydown', { keyCode: 90, ctrlKey: true });
        expect(text()).toBe('Hello worl$');
        // undo 뒤에도 ctrl+a의 선택(tbsel)은 남아 있어 shift+left는 그 선택을 줄인다 (원본 동작)
        fire(inp(), 'keydown', { keyCode: 37, shiftKey: true });
        expect(sel()).toEqual({ cursor: 9, begin: 0, end: 9, exists_range: true });
        tb.tbcursor.clear_sel();
        tb.tbcursor.set(10);
        fire(inp(), 'keydown', { keyCode: 37, shiftKey: true });    // 커서 10 → shift+left → 선택 [9,10]
        expect(sel()).toEqual({ cursor: 9, begin: 9, end: 10, exists_range: true });
        tb.tbcursor.clear_sel();
    });
    it('IME: 조합(insert→replace)과 완성, 이어지는 textInput 하나는 무시', () => {
        tb.set_focus();
        tb.tbcursor.set(10);
        fire(inp(), 'compositionstart');
        fire(inp(), 'compositionupdate', { data: 'ㄱ' });
        expect(text()).toBe('Hello worlㄱ$');
        fire(inp(), 'compositionupdate', { data: '가' });
        expect(text()).toBe('Hello worl가$');
        fire(inp(), 'compositionend', { data: '가' });
        expect([text(), tb.tbcursor.cursor]).toEqual(['Hello worl가$', 11]);
        fire(inp(), 'textInput', { data: '!' });     // compositionend 직후 → 무시
        expect(text()).toBe('Hello worl가$');
        fire(inp(), 'textInput', { data: '!' });
        expect(text()).toBe('Hello worl가!$');
        // 조합 중 backspace로 소멸
        fire(inp(), 'compositionstart');
        fire(inp(), 'compositionupdate', { data: 'ㄴ' });
        fire(inp(), 'compositionend', { data: '' });
        expect(text()).toBe('Hello worl가!$');
        // 선택 영역이 있으면 insert가 지우고 넣는다. (compositionend 직후의 textInput 하나는 무시되므로 빈 것으로 먼저 흘려보낸다)
        fire(inp(), 'textInput', { data: '' });
        tb.tbcursor.set_selection(0, 5);
        fire(inp(), 'textInput', { data: 'Bye' });
        expect(text()).toBe('Bye worl가!$');
    });
    it('copy/cut: clipboardData에 text/plain과 kayak html', () => {
        tb.set_focus();
        tb.tbcursor.set_selection(0, 3);
        const cb = fake_clipboard();
        const e = fire(inp(), 'copy', { clipboardData: cb });
        expect([cb.data['text/plain'], e.defaultPrevented]).toEqual(['Bye', true]);
        expect(cb.data['text/html']).toContain('<div kayak-doc>');
        expect(cb.data['text/html']).toContain('data-kayak-html=');
        const cut = fake_clipboard();
        fire(inp(), 'cut', { clipboardData: cut });
        expect([cut.data['text/plain'], text()]).toEqual(['Bye', ' worl가!$']);
        fire(inp(), 'keydown', { keyCode: 90, ctrlKey: true });
        expect(text()).toBe('Bye worl가!$');
    });
    it('paste: kayak html이 없으면 평문을, 있으면 폰트 로딩 뒤 스타일까지 넣는다', async () => {
        tb.set_focus();
        tb.tbcursor.set(0);
        fire(inp(), 'paste', { clipboardData: fake_clipboard({ 'text/plain': 'ab', 'text/html': '<p>ab</p>' }) });
        expect(text()).toBe('abBye worl가!$');
        tb.tbcursor.set(2);
        // kayak이 복사한 HTML은 <div data-kayak-html="(인코딩된 kayak-doc)">를 담고 있다 (TB_ExportHtml.generate_html_for_export).
        // 그것이 없으면 extractCopiedData가 null을 돌려줘 평문 경로로 간다.
        const inner = '<div kayak-doc><div kayak-par style="text-align: center;"><span style="color:#ff0000;font-size:20pt;-kayak-font_family:NanumMyeongjoOTF,Regular;">XY</span></div></div>';
        const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const html = `<html><body><!--StartFragment-->${inner}<div data-kayak-html="${esc(inner)}"></div><!--EndFragment--></body></html>`;
        fire(inp(), 'paste', { clipboardData: fake_clipboard({ 'text/plain': 'XY', 'text/html': html }) });
        await until(() => text().indexOf('XY') !== -1);
        expect(text()).toBe('abXYBye worl가!$');
        const style = tb.get_style_info(3);
        expect([style.FontSize, style.fontColor]).toEqual([20, '#ff0000']);
    });
});
