/*
    TextBox_Edit 특성 테스트. 실제 textbox(test/snapshot/helpers.create_textbox) 위에서 편집 명령의 결과(텍스트, 커서, document_changed)를 고정한다.
    text_core.toString()은 '\n'을 '$'로 보여준다. 문서는 항상 마지막 '\n'(last $) 하나를 가진다.
*/
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { create_textbox, destroy_textbox } from '../../snapshot/helpers';
import * as M1TextBox from '../../../src/node';
import GT_MasterClipboard from '../../../src/engine/segment/master_clipboard';

const text = tb => tb.text_core.toString();
let tb;
beforeEach(async () => { tb = await create_textbox(); });
afterEach(() => destroy_textbox(tb));

describe('TextBox_Edit 입력', () => {
    it('insert_string은 &nbsp;를 공백으로 바꾸고 커서를 끝으로, 빈 문자열은 무시한다', () => {
        tb.opEdit.insert_string(0, 'ab c');
        expect([text(tb), tb.tbcursor.cursor]).toEqual(['ab c$', 4]);
        tb.opEdit.insert_string(1, '');
        expect([text(tb), tb.tbcursor.cursor]).toEqual(['ab c$', 4]);
    });

    it('insert_multiline_string은 \\n마다 _insert로 나누고 _get_lines는 줄과 \\n을 따로 낸다', () => {
        expect(tb.opEdit._get_lines('a\n\nb\n')).toEqual(['a', '\n', '\n', 'b', '\n']);
        tb.opEdit.insert_string(0, 'ab c');
        tb.opEdit.insert_multiline_string(4, '\nx\n');
        expect([text(tb), tb.tbcursor.cursor]).toEqual(['ab c$x$$', 7]);
        expect(tb.layout.get_tbdom().pars.length).toBe(3);
    });

    it('insert(13)은 문단을 나누되 single_line_mode에서는 무시한다', () => {
        tb.opEdit.insert_string(0, 'xy');
        expect(tb.tbpreference.set_single_line_mode(true)).toBe(true);   // 문단이 하나일 때만 켤 수 있다
        tb.opEdit.insert(1, 13);
        expect([text(tb), tb.tbcursor.cursor]).toEqual(['xy$', 2]);
        tb.tbpreference.set_single_line_mode(false);
        tb.opEdit.insert(1, 13);
        expect([text(tb), tb.tbcursor.cursor]).toEqual(['x$y$', 2]);
        expect(tb.tbpreference.set_single_line_mode(true)).toBe(false);  // 문단이 둘이면 거부
    });

    it('document_changed: cmd/replacing/user_data를 넘기고 opt.reset이면 대신 history를 비운다', () => {
        const events = [];
        tb.add_doc_change_listener(e => events.push(e));
        tb.opEdit.insert_string(0, 'ab');
        tb.opEdit.insert(2, 65, null, { replace: true, user_data: 'u' });
        tb.opEdit.erase(0, 0, 1, null, { user_data: 'e' });
        expect(events).toEqual([
            { cmd: 'insert_string', replacing: false, user_data: null },
            { cmd: 'insert', replacing: true, user_data: 'u' },
            { cmd: 'erase', user_data: 'e' },
        ]);
        expect(tb.get_history_stack_pointer()).toBe(2);
        tb.opEdit.insert_string(0, 'z', null, { reset: true });
        expect(events.length).toBe(3);                      // document_changed 없음
        expect(tb.get_history_stack_pointer()).toBe(-1);    // history reset
    });

    it('on_par_changed 콜백은 (null, text_change_info, par_change_info)를 받고 ci_change_start가 있다', () => {
        const calls = [];
        tb.opEdit.insert_string(0, 'ab', (err, t, p) => calls.push([err, t.edit_cmd, p.edit_cmd, p.ci_change_start]));
        expect(calls).toEqual([[null, 'insert_string', 'insert_string', 0]]);
    });
});

describe('TextBox_Edit 삭제', () => {
    beforeEach(() => tb.opEdit.insert_string(0, 'Hello world'));

    it('한 글자 삭제는 cursor 위치, 범위 삭제는 sel_begin으로 커서를 둔다', () => {
        tb.opEdit.erase(1, 1, 1);
        expect([text(tb), tb.tbcursor.cursor]).toEqual(['Hllo world$', 1]);
        tb.opEdit.erase(0, 5, 10);
        expect([text(tb), tb.tbcursor.cursor]).toEqual(['Hllo $', 5]);
    });

    it('마지막 $ 앞에서 Delete는 무시, 전체 선택 삭제는 $ 하나를 남긴다 (Review Focus 2)', () => {
        tb.opEdit.erase(11, 11, 11);
        expect(text(tb)).toBe('Hello world$');
        tb.opEdit.erase(0, 0, tb.text_length());
        expect([text(tb), tb.tbcursor.cursor, tb.text_length()]).toEqual(['$', 0, 1]);
    });

    it('삭제 직후 curStyle에는 지워진 첫 글자의 스타일이 들어간다', () => {
        tb.opEdit.erase(0, 0, 1);
        expect(tb.curStyle.styles_before_erase).toBe(true);
        expect(Object.keys(tb.curStyle)).toContain('ATTR_FontSize');
    });
});

describe('TextBox_Edit 클립보드/히스토리', () => {
    beforeEach(() => tb.opEdit.insert_multiline_string(0, 'Hello world\nsecond'));

    it('copy/paste/cut/undo/redo', () => {
        const mc = GT_MasterClipboard.getInstance();
        tb.opEdit.copy(mc, 0, 5);
        expect([mc.m_text.length, mc.get_element_size()]).toEqual([5, 5]);
        tb.opEdit.paste(mc, { begin: 6, end: 11 });
        expect([text(tb), tb.tbcursor.cursor]).toEqual(['Hello Hello$second$', 11]);
        tb.opEdit.cut(mc, 0, 6);
        expect([text(tb), mc.m_text.length]).toEqual(['Hello$second$', 6]);
        tb.opEdit.undo();
        expect(text(tb)).toBe('Hello Hello$second$');
        tb.opEdit.redo();
        expect(text(tb)).toBe('Hello$second$');
        tb.opEdit.redo();                                   // 더 없으면 무시
        expect(text(tb)).toBe('Hello$second$');
    });

    it('find_steps_to_next_word / find_steps_to_prev_word', () => {
        const next = c => { tb.tbcursor.set(c); return tb.opEdit.find_steps_to_next_word(); };
        const prev = c => { tb.tbcursor.set(c); return tb.opEdit.find_steps_to_prev_word(); };
        expect([next(0), next(6), next(11)]).toEqual([6, 5, 1]);   // 단어 끝+공백, 다음 단어, \n은 1
        expect([prev(0), prev(8), prev(12)]).toEqual([0, 2, 1]);
    });

    it('undo할 것이 없으면 아무 일도 없다', () => {
        const t = text(tb);
        for (let i = 0; i < 5; i++) tb.opEdit.undo();
        tb.opEdit.undo();
        expect(text(tb)).toBe('$');
        expect(t).toBe('Hello world$second$');
    });
});

describe('schema 모드 textbox (Review Focus 1)', () => {
    it('insert/insert_string/erase는 커서만 옮기고 레이아웃·document_changed를 부르지 않는다', async () => {
        const s = new M1TextBox.textbox({ schema: true, masterClipboard: GT_MasterClipboard.getInstance() });
        expect([s.layout, s.docFactory, s.tbinput, s.fontloader, s.tb_schema]).toEqual([null, null, null, null, null]);
        await s.init();
        const cmds = [];
        s.add_doc_change_listener(e => cmds.push(e.cmd));
        s.opEdit.insert_string(0, 'ab c');
        expect([s.text_core.toString(), s.tbcursor.cursor]).toEqual(['ab c$', 4]);
        s.opEdit.insert(1, 13);
        expect([s.text_core.toString(), s.tbcursor.cursor]).toEqual(['a$b c$', 2]);
        s.opEdit.erase(0, 0, 1);
        expect([s.text_core.toString(), s.tbcursor.cursor]).toEqual(['$b c$', 0]);
        expect(cmds).toEqual([]);
    });
});
