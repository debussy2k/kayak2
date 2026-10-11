import TP_TextRange from "./TP_TextRange";
import TP_TextHistoryInfo from './TP_TextHistoryInfo';
import TP_TextHistory from './TP_TextHistory';

var TP_OK_ALL = 0;
var TP_ERR_BEGIN_OF_HISTORY = 1;
var TP_ERR_END_OF_HISTORY = 2;

/** get_last_change_info()의 결과. TB_Layout.do_layout()이 받는다. */
export interface TextChangeInfo {
    edit_cmd: string;
    text_fluctuation: number;
    before?: TP_TextRange;
    after?: TP_TextRange;
}
/** undo_text/redo_text 콜백. err는 TP_ERR_* 또는 null */
export type TextUndoCallback = (err: number | null, rng?: TP_TextRange) => any;

class TP_TextCore {
    // this.m_text를 string으로 유지하지 않는 이유.
    // javascript에서의 string literal 및 String object는 immutable임.
    // 따라서 수정 하기에는 적합하지 않음.
    m_text: number[];
    m_LastAction: TP_TextHistoryInfo | null;

    private _HT: number;
    private _LF: number;
    private _CR: number;
    private m_History: TP_TextHistory;
    private m_rng_before: TP_TextRange;
    private m_rng_after: TP_TextRange;

    constructor() {
        this.m_text = [];
        this._HT = 9; // horizontal tab
        this._LF = 10; // Life Feed. '\n'
        this._CR = 13; // Carriage Return. '\r'

        this.m_LastAction = null;

        // private (원본은 메서드 정의 뒤에 var로 만들었다. 호이스팅으로 같은 시점에 준비된다.)
        this.m_History = new TP_TextHistory;
        this.m_rng_before = new TP_TextRange;
        this.m_rng_after = new TP_TextRange;
    }

    get_last_change_info(edit_cmd: string): TextChangeInfo {
        // clone SegRange for prevent unexpected change.
        var change_info: TextChangeInfo = {
            edit_cmd: edit_cmd,
            text_fluctuation: 0
        };
        if (edit_cmd != 'undo') {
            change_info.before = this.m_LastAction!.m_pRngBefore!.clone();
            change_info.after = this.m_LastAction!.m_pRngAfter!.clone();
        } else {
            change_info.before = this.m_LastAction!.m_pRngAfter!.clone();
            change_info.after = this.m_LastAction!.m_pRngBefore!.clone();
        }

        if (change_info.before.m_end === change_info.before.m_begin)
            change_info.text_fluctuation = (change_info.after.m_end - change_info.after.m_begin);
        else if (change_info.after.m_end === change_info.after.m_begin)
            change_info.text_fluctuation = -(change_info.before.m_end - change_info.before.m_begin);
        else {
            // console.log(false, "not supported action");
        }

        // console.log("rng_before: %d, %d", change_info.before.m_begin, change_info.before.m_end);
        // console.log("rng_after: %d, %d", change_info.after.m_begin, change_info.after.m_end);

        return change_info;
    }

    toString(): string {
        var str = '';
        for (var i = 0; i < this.m_text.length; i++) {
            if (this.m_text[i] == this._LF) // \n
                str += '$';
            else
                str += String.fromCharCode(this.m_text[i]);
        }
        return str;
    }
    toRawString(begin?: number, end?: number, options?: { new_line_as_space?: boolean }): string {
        if (options == undefined)
            options = {};

        var str = '';
        var i = (begin == undefined) ? 0 : begin;
        var to = (end == undefined) ? this.m_text.length : end;

        for (; i < to; i++) {
            if (this.m_text[i] == this._LF) {// \n
                if (options.new_line_as_space)
                    str += ' ';
                else
                   str += '\n';
			}
			else if (this.m_text[i] == null || this.m_text[i] == 0) { // 참고: (null == 0) -> false임
				/* 2019.6.5
					null(0)이 되는 현상이 있으면 안되지만, 일본어 입력시 마지막 \n가 null로 저장되는 현상이 있음.
					버그이지만 원인은 파악하지 못했음.
					이 경우 ' '로 치환하여 깍두기가 표시 되지 않도록 함.
				*/
				str += ' ';
			}
            else
                str += String.fromCharCode(this.m_text[i]);
        }
        return str;
    }
    toHtmlString(begin: number | undefined, end: number | undefined, options: { keep_cr?: boolean }): string {
        var str = '';
        var i = (begin == undefined) ? 0 : begin;
        var to = (end == undefined) ? this.m_text.length : end;
        var ch = 0;

        for (; i < to; i++) {
            ch = this.m_text[i];
            if (ch === 10 && options.keep_cr)
                str += '\n';
            else if (ch <= 32)
                str += '&nbsp;';
            else if (ch === 38)
                str += '&amp;';
            else if (ch === 60)
                str += '&lt;';
            else if (ch === 62)
                str += '&gt;';
            else
                str += String.fromCharCode(ch);
        }
        return str;
    }
    toHtmlCharEntity(ch: number): string {
        var char_entity = '';
        if (ch <= 32)
            char_entity = '&nbsp;';
        else if (ch === 38)
            char_entity = '&amp;';
        else if (ch === 60)
            char_entity = '&lt;';
        else if (ch === 62)
            char_entity = '&gt;';
        else
            char_entity = String.fromCharCode(ch);

        return char_entity;
    }

    insert(tcChar: number | string, cursor: number): void {
        var cc: number = (tcChar == '\n') ? 10 : (tcChar as number);

        this.save_undo_info(cursor, cursor, cursor);
        this.m_text.splice(cursor, 0, cc);
        this.save_redo_info(cursor, cursor + 1, cursor + 1);

        this.m_LastAction = this.m_History.getLastStep();
    }
    insert_string(cursor: number, pVec: ArrayLike<number>): void {
        var nSize = pVec.length;
        if (nSize > 0) {
            this.save_undo_info(cursor, cursor, cursor);

            var itr_insert = cursor;
            for (var i = 0; i < nSize; i++) {
                this.m_text.splice(itr_insert, 0, pVec[i]);
                ++itr_insert;
            }

            this.save_redo_info(cursor, cursor + nSize, cursor + nSize);
        }
        this.m_LastAction = this.m_History.getLastStep();
    }

    erase(cursor: number): void {
        this.save_undo_info(cursor, cursor + 1, cursor);
        this.m_text.splice(cursor, 1);
        this.save_redo_info(cursor, cursor, cursor);

        this.m_LastAction = this.m_History.getLastStep();
    }
    erase_range(cursor: number, sel_begin: number, sel_end: number): void {
            this.save_undo_info(sel_begin, sel_end, cursor);
            this.m_text.splice(sel_begin, sel_end - sel_begin);
            this.save_redo_info(sel_begin, sel_begin, sel_begin);

            this.m_LastAction = this.m_History.getLastStep();
        }
        // this.paste = function(int cursor, Tp_Clipboard& clipboard)
        // {
        // 	paste(cursor, clipboard.getGlyphVec());
        // }
    paste(cursor: number, pVec: ArrayLike<number>): void {
        var nSize = pVec.length;
        if (nSize > 0) {
            this.save_undo_info(cursor, cursor, cursor);

            var itr_insert = cursor;
            for (var i = 0; i < nSize; i++) {
                this.m_text.splice(itr_insert, 0, pVec[i]);
                ++itr_insert;
            }

            this.save_redo_info(cursor, cursor + nSize, cursor + nSize);
        }
        this.m_LastAction = this.m_History.getLastStep();
    }
    nop(sel_begin: number, sel_end: number): void {
        this.save_undo_info(sel_begin, sel_end, sel_begin, true);
        this.save_redo_info(sel_begin, sel_end, sel_begin, true);
        this.m_LastAction = this.m_History.getLastStep(); //d check this!!
    }


    ////////////////////////////////////////////////////////////////////////////////////////
    // for undo/redo System

    undo_text(callback: TextUndoCallback): any { // callback(err, cursor_pos)
        var HistoryInfo = this.m_History.getPrevStep();
        if (HistoryInfo) {
            if (HistoryInfo.m_noop == false) {
                this.erase_with(HistoryInfo.m_pRngAfter!);
                this.insert_with(HistoryInfo.m_pRngBefore!);
            }
            this.m_LastAction = HistoryInfo;

            // HistoryInfo.m_pRngBefore.m_cursor_pos : 변화가 시작하는 char pos
            return callback(null, HistoryInfo.m_pRngBefore!);
        }

        return callback(TP_ERR_BEGIN_OF_HISTORY);
    }

    redo_text(callback: TextUndoCallback): any {
        var HistoryInfo = this.m_History.getNextStep();
        if (HistoryInfo) {
            if (HistoryInfo.m_noop == false) {
                this.erase_with(HistoryInfo.m_pRngBefore!);
                this.insert_with(HistoryInfo.m_pRngAfter!);
            }
            this.m_LastAction = HistoryInfo;

            // HistoryInfo.m_pRngBefore.m_cursor_pos : 변화가 시작하는 char pos
            return callback(null, HistoryInfo.m_pRngBefore!);
        }

        return callback(TP_ERR_END_OF_HISTORY);
    }

    ////////////////////////////////////////////////////////////////////////////////////////
    // private

    private save_undo_info(begin_pos: number, end_pos: number, cursor_pos: number, noop?: boolean): void {
        //MT_ASSERT(end_pos >= end_pos);

        this.m_rng_before.clear();
        this.m_rng_before.m_begin = begin_pos;
        this.m_rng_before.m_end = end_pos;
        this.m_rng_before.m_cursor_pos = cursor_pos;
        if (noop !== true) {
            for (var i = begin_pos; i < end_pos; i++)
                this.m_rng_before.m_text.push(this.m_text[i]);
        }
    }

    private save_redo_info(begin_pos: number, end_pos: number, cursor_pos: number, noop?: boolean): void {
        //MT_ASSERT(end_pos >= end_pos);

        this.m_rng_after.clear();
        this.m_rng_after.m_begin = begin_pos;
        this.m_rng_after.m_end = end_pos;
        this.m_rng_after.m_cursor_pos = cursor_pos;
        if (noop !== true) {
            for (var i = begin_pos; i < end_pos; i++)
                this.m_rng_after.m_text.push(this.m_text[i]);
        }

        var HistoryInfo = new TP_TextHistoryInfo;
        HistoryInfo.m_noop = noop ? true : false;
        HistoryInfo.m_pRngBefore = this.m_rng_before.clone();
        HistoryInfo.m_pRngAfter = this.m_rng_after.clone();
        this.m_History.push_thi(HistoryInfo);
    }


    private erase_with(pTextRng: TP_TextRange): void {
        this.m_text.splice(pTextRng.m_begin, (pTextRng.m_end - pTextRng.m_begin))
    }

    private insert_with(pTextRng: TP_TextRange): void {
        var counter = 0;
        for (var i = pTextRng.m_begin; i < pTextRng.m_end; i++) {
            this.m_text.splice(i, 0, pTextRng.m_text[counter]);
            ++counter;
        }
    }

} //


export default TP_TextCore;
