/*
    GT_MasterClipboard 단위 테스트. TS 전환 전 JS 상태에서 통과하고 전환 후에도 같아야 한다.
    호스트(Edicus)는 M1TextBox.GT_MasterClipboard.getInstance()로 쓰므로 export 모양을 고정한다.
*/
import { describe, it } from 'vitest';
import assert from 'assert';
import GT_MasterClipboard from '../../../src/engine/segment/master_clipboard';

describe('GT_MasterClipboard', function () {
    it('export는 getInstance만 가진 객체이고, 싱글턴이다', function () {
        assert.deepStrictEqual(Object.keys(GT_MasterClipboard), ['getInstance']);
        assert.strictEqual(typeof GT_MasterClipboard, 'object');
        const a = GT_MasterClipboard.getInstance();
        const b = GT_MasterClipboard.getInstance();
        assert.strictEqual(a, b);
    });

    it('copy_text_data / get_element_size / get_text', function () {
        const c = GT_MasterClipboard.getInstance();
        c.copy_text_data([65, 66, 67]);
        assert.strictEqual(c.get_element_size(), 3);
        assert.deepStrictEqual(c.get_text(), [65, 66, 67]);
        assert.strictEqual(c.system_clipboard_has_content(), false);
        assert.deepStrictEqual(c.m_srv, []);
    });

    it('get_text는 CRLF를 LF로 바꾼다', function () {
        const c = GT_MasterClipboard.getInstance();
        c.copy_text_data([65, 13, 10, 66, 13]);
        assert.deepStrictEqual(c.get_text(), [65, 10, 66, 13]);
    });

    it('single_line_mode에서 LF는 space로 바뀐다', function () {
        const c = GT_MasterClipboard.getInstance();
        c.copy_text_data([65, 10, 66]);
        assert.deepStrictEqual(c.get_text({ single_line_mode: true }), [65, 32, 66]);
    });

    it('copy_from_string_data는 char code 배열로 저장하고 system clipboard 플래그를 켠다', function () {
        const c = GT_MasterClipboard.getInstance();
        c.m_srv.push({});
        c.copy_from_string_data('AB');
        assert.deepStrictEqual(c.m_text, [65, 66]);
        assert.strictEqual(c.system_clipboard_has_content(), true);
        assert.strictEqual(c.m_srv.length, 0);
    });

    it('clear_all은 m_srv만 비운다', function () {
        const c = GT_MasterClipboard.getInstance();
        c.copy_text_data([65]);
        c.m_srv.push({});
        c.clear_all();
        assert.strictEqual(c.m_srv.length, 0);
        assert.strictEqual(c.get_element_size(), 1);
    });
});
