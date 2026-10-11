import SEGC from '../segment/segment_const';
import TB_Utils from "./TB_Utils";
import type { MasterClipboard } from '../segment/master_clipboard';
import type ATTR_Doc from '../segment/ATTR_Doc';
import type TP_TextRange from './TP_TextRange';
import type { TextBoxHost, ParChangedCallback, EditOptions, UndoOptions, EditSel, LayoutChangeInfo } from './types';
import type { TextChangeInfo } from './TP_TextCore';

/*
    ## 제공 Operation ##
        insert()
        insert_string()
        erase()
        copy()
        paste()
        undo()
        redo()


    ##  seglayer::paste() 호출시의 call stack ##
    ime updating
        TB_Keyboard.js::composiing_word()
        TB_Input::on_insert_word()
        TextBox_Edit::insert_string()
        seglayer_mgr::insert_string()
        seglayer::paste(pos, PasteInfo)

    tb 컨텐츠의 paste
    - tb copy시에는 내부 master clipboard로 옮기기 위해 insert가 발생한다. (schema 상태임)
        TB_ApplyEditOperation::_apply_edit_operation()
        TextBox_Edit::insert_string()
        seglayer_mgr::insert_string()
        seglayer::paste(pos, PasteInfo)
    - 이후 paste과정은 아래 clipboard paste와 같다.

    외부 clipbaord paste
        TB_Input::_std_paste()
        TextBox_Edit::paste()
        seglayer_mgr::paste()
        seglayer::paste(pos, PasteInfo)
*/

export class TextBox_Edit {
    tb: TextBoxHost;
    schema_only: boolean;

    constructor(tb: TextBoxHost) {       
        this.tb = tb;        
        this.schema_only = this.tb.tb_schema ? false : true;
    }

	// public interface 
	insert(cursor: number, ch: number, on_par_changed?: ParChangedCallback | null, opt?: EditOptions): void {
		this._insert(cursor, ch, on_par_changed, opt);
        this._post_process()
	}
	insert_multiline_string(cursor: number, str: string, on_par_changed?: ParChangedCallback | null, opt?: EditOptions): void {
		if (str.length === 0) 
			return;

		this._insert_multiline_string (cursor, str, on_par_changed, opt);
        this._post_process()
	}
	insert_string(cursor: number, str: string, on_par_changed?: ParChangedCallback | null, opt?: EditOptions): void {
		if (str.length === 0) 
			return;

		this._insert_string (cursor, str, on_par_changed, opt);
        this._post_process()
	}
	erase(cursor: number, sel_begin: number, sel_end: number, on_par_changed?: ParChangedCallback | null, opt?: EditOptions): void {
		this._erase(cursor, sel_begin, sel_end, on_par_changed, opt)
        this._post_process()
	}
	copy(masterClipboard: MasterClipboard, sel_begin: number, sel_end: number): void {
		this._copy(masterClipboard, sel_begin, sel_end);
        this._post_process()
	}
	cut(masterClipboard: MasterClipboard, sel_begin: number, sel_end: number): void {
		this._cut(masterClipboard, sel_begin, sel_end)
        this._post_process()
	}
	paste(masterClipboard: MasterClipboard, sel: EditSel, on_par_changed?: ParChangedCallback | null): void {
		this._paste(masterClipboard, sel, on_par_changed);
        this._post_process()
    }

    _post_process(): void {
		if (this.tb.tbpreference.fit_to_line_width_by_scale_x) {
			this.tb.seg_mgr.set_command_option({
				command_auto_play:"start"
			});
            this.tb.layout_each_paragraph_in_a_single_line();
        }
    }

	/*
		"command_auto_play" 관련하여 seglayer_manager의 addToHistoryStack() 설명 참조.

		예>
		layout_each_paragraph_in_a_single_line 모드에서 _post_process()가 작동하는 경우
		"ABC"입력이후 shrink모드가 되어 "12"가 추가되는 경우 

		cmd		command					command_auto_play
		---		-------    				-----------------
				set_letter_scale_x(60)	"run"
				set_letter_scale_x(100)	"run"
		5>		ins "2"					"start"
				set_letter_scale_x(87)	"run"				// 하동
				set_letter_scale_x(100)	"run"				// TextBox.layout_each_paragraph_in_a_single_line()에서 설정되는 것
		4>		ins "1"					"start"				// "1"입력.
		3>		ins "C"					null
		2>		ins "B"					null
		1>		ins "A"					null
	*/
    undo(on_par_changed?: ParChangedCallback | null, opt?: UndoOptions): void {
        // console.log('history: ', this.tb.seg_mgr.get_history_stack(), this.tb.get_history_stack_pointer())

		let curr_history = null;


		if (this.tb.tbpreference.fit_to_line_width_by_scale_x) {
			do {
				curr_history =  this.tb.seg_mgr.get_curr_history();
				this._undo(on_par_changed, opt)
				// console.log(curr_history)	
			} while (curr_history && curr_history.command_auto_play == "run")
		}
		else {
			if (this.tb.seg_mgr.can_undo() == false)
				return;

			curr_history = this.tb.seg_mgr.get_curr_history();
			if (curr_history!.command_auto_play != 'run') {
				this._undo(on_par_changed, opt)
				return;
			}
			else {
				do {
					this._undo(on_par_changed, opt)
					curr_history =  this.tb.seg_mgr.get_curr_history();
				} while (curr_history && curr_history.command_auto_play == "run")
			}
		}

	}
    redo(on_par_changed?: ParChangedCallback | null, opt?: UndoOptions): void {
        // console.log('history: ', this.tb.seg_mgr.get_history_stack(), this.tb.get_history_stack_pointer())

		let curr_history = null;
		let started = false;
		let run = true;

		/*
			첫 실행 항목의 command_auto_play가 "start"이고, 다음번 command_auto_play가 "run"이 나오면 연속 실행한다.
			예를 들면 아래와 같음.
			start -> run -> run -> (null 또는 start)
			^^^^^^^^^^^^^^^^^^^
			위의 3개만 실행하기 위한 것. 
		*/
		do {
            this._redo(on_par_changed, opt)
            
			if (this.tb.seg_mgr.can_redo()) {
				curr_history = this.tb.seg_mgr.get_curr_history();
				if (curr_history!.command_auto_play == 'start') {
					if (started == false) {
						started = true;
						run = true;
					}
					else {
						run = false;
					}
				}
				else if (curr_history!.command_auto_play == 'run') {
					// 현재가 'run'이면 다음 command가 'run'일 때만 auto play 한다.
                    let next_history = this.tb.seg_mgr.get_next_history();
                    run = (next_history != null && next_history.command_auto_play === 'run');
				}
				else
					run = false;
			}
			else
				curr_history = null;
		} while (curr_history && run)
	}


	////////////////////////////////////////////////////
	// private method
 
    _insert(cursor: number, ch: number, on_par_changed?: ParChangedCallback | null, opt?: EditOptions): void {
        let tb = this.tb;

        if (ch === 13 || ch === 10) { // '\r'. 10= '\n'
            //var attr_par = new ATTR_Par(10);
            if (this.tb.tbpreference.single_line_mode)
                return;

            // text_on_path의 경우 multi-line을 유발하는 enter키 입력을 막음
            if (tb.text_on_path)
                return;

            tb.seg_mgr.insert_newline(cursor, null);
            tb.text_core.insert('\n', cursor);
        } else {
            tb.seg_mgr.insert(cursor, tb.curStyle);
            tb.text_core.insert(ch, cursor);
        }
        tb.history.noop();

        if (!this.schema_only) {
            let par_change_info = tb.m_Par.get_command_change_info('insert') as LayoutChangeInfo;
            let text_change_info: TextChangeInfo = tb.text_core.get_last_change_info(par_change_info.edit_cmd);

            par_change_info.ci_change_start = cursor; //D10
            tb.layout!.do_layout(par_change_info, text_change_info);
            on_par_changed && on_par_changed(null, text_change_info, par_change_info);
            tb.tbcursor.set(cursor + 1);            
            tb.document_changed({
                cmd: 'insert',
                replacing: (opt && opt.replace) ? true : false,
                user_data: (opt) ? opt.user_data : null
            });
        }

        this.schema_only && tb.tbcursor.set(cursor + 1);
    }

    // \n을 포함한 string을 받음. 단, history는 \n갯수 만큼 늘어남.
    _insert_multiline_string(cursor: number, str: string, on_par_changed?: ParChangedCallback | null, opt?: EditOptions): void {
        let arr = this._get_lines(str);
        let _cursor_pos = cursor;
        arr.forEach(str => {
            if (str.length == 1 && str.charCodeAt(0) == 10)
                this._insert(_cursor_pos, str.charCodeAt(0), on_par_changed, opt);
            else
                this._insert_string(_cursor_pos, str, on_par_changed, opt);
            _cursor_pos += str.length;
        })
    }
    _get_lines(str: string): string[] {
        let arr = []
        let b = 0, e = 0;
        for (let i = 0; i < str.length; i++) {
            if (str.charCodeAt(i) == 10) {
                if (b < e)
                    arr.push(str.substring(b, e));

                arr.push('\n');
                ++e;
                b = e;
            }
            else
                ++e;
        }

        if (b < e)
            arr.push(str.substring(b, e));

        return arr;
    }

    // str에 '\n'이 포함되면 안됨.
    _insert_string(cursor: number, str: string, on_par_changed?: ParChangedCallback | null, opt?: EditOptions): void {
        let tb = this.tb;
        
        var text_arr = [];
        var ch;
        for (var i = 0; i < str.length; i++) {
            ch = str.charCodeAt(i);
            if (ch == 160) // &nbsp;를 일반 space로 변환.
                ch = 32;
            text_arr.push(ch);
        }

        tb.text_core.insert_string(cursor, text_arr);
        tb.seg_mgr.insert_string(cursor, text_arr, tb.curStyle);
        tb.history.noop();

        if (!this.schema_only) {
            let par_change_info = tb.m_Par.get_command_change_info('insert_string') as LayoutChangeInfo;
            let text_change_info: TextChangeInfo = tb.text_core.get_last_change_info(par_change_info.edit_cmd);

            par_change_info.ci_change_start = cursor; //D10
            tb.layout!.do_layout(par_change_info, text_change_info);
            on_par_changed && on_par_changed(null, text_change_info, par_change_info);

            tb.tbcursor.set(cursor + text_arr.length);            
            if (opt && opt.reset == true)
                tb.reset_history();
            else {
                tb.document_changed({
                    cmd: 'insert_string',
                    replacing: (opt && opt.replace) ? true : false,
                    user_data: (opt) ? opt.user_data : null
                });
            }
        }
        


        this.schema_only && tb.tbcursor.set(cursor + text_arr.length);
    }    

    /*
        지워지는 range의 첫번째 glyph의 style을 tb.curStyle에 기록하여, 
        erase직후 input시 지워진 range의 스타일이 적용되도록 한다.
        단, erase직후 cursor위치가 이탈하면 tb.curStyle이 reset된다. (set_style_listener()참조)
    */
    _erase(cursor: number, sel_begin: number, sel_end: number, on_par_changed?: ParChangedCallback | null, opt?: EditOptions): void {
        let tb = this.tb;
        
        // sel_begin는 항상 정확한 값이 와야 한다. 
        if (sel_begin == sel_end) {
            if (cursor == tb.text_length() - 1)
                return;

            tb.curStyle = { styles_before_erase : true};
            tb.seg_mgr.get_attributes_from_seglayer(sel_begin+1, tb.curStyle);
            tb.seg_mgr.erase(cursor, cursor + 1);
            tb.text_core.erase(cursor);
        } else {
            if (sel_end == tb.text_length()) // last$는 삭제불가.
                sel_end -= 1;
            if (sel_begin == sel_end)
                return;

            tb.curStyle = { styles_before_erase : true};
            tb.seg_mgr.get_attributes_from_seglayer(sel_begin+1, tb.curStyle);
            tb.seg_mgr.erase(sel_begin, sel_end);
            tb.text_core.erase_range(cursor, sel_begin, sel_end);
        }
        tb.history.noop();       

        if (!this.schema_only) {
            let par_change_info = tb.m_Par.get_command_change_info('erase') as LayoutChangeInfo;
            let text_change_info: TextChangeInfo = tb.text_core.get_last_change_info(par_change_info.edit_cmd);

            par_change_info.ci_change_start = sel_begin; //D10
            tb.layout!.do_layout(par_change_info, text_change_info);
            on_par_changed && on_par_changed(null, text_change_info, par_change_info);
            tb.tbcursor.set((sel_begin == sel_end) ? cursor : sel_begin);        
            tb.document_changed({
                cmd: 'erase',
                user_data: (opt) ? opt.user_data : null                
            });
        }


        this.schema_only && tb.tbcursor.set((sel_begin == sel_end) ? cursor : sel_begin);
    }    


    _copy(masterClipboard: MasterClipboard, sel_begin: number, sel_end: number): void {
        let tb = this.tb;
        masterClipboard.clear_all();

        // for Par
        tb.seg_mgr.copy(sel_begin, sel_end);

        var text_data = tb.text_core.m_text.slice(sel_begin, sel_end);
        masterClipboard.copy_text_data(text_data);

        // clipboard impl.
        //masterClipboard.m_srv.push(tb.m_Par.clone_SegRngCopy());
        tb.seg_mgr.copy_layer_data(sel_begin, sel_end, masterClipboard);
    }

    _cut(masterClipboard: MasterClipboard, sel_begin: number, sel_end: number): void {
        this._copy(masterClipboard, sel_begin, sel_end);
        this._erase(sel_begin, sel_begin, sel_end);
    }

    // this.paste = function(masterClipboard, sel_begin, sel_end, on_par_changed) {
    _paste(masterClipboard: MasterClipboard, sel: EditSel, on_par_changed?: ParChangedCallback | null): void {
        let tb = this.tb;
        
        var sel_begin = sel.begin;
        var sel_end = sel.end;

        if (sel_begin !== sel_end) {
            this._erase(sel_begin, sel_begin, sel_end);
        }


		/*
			"tb.tbpreference.single_line_mode == false" 검사하는 이유
			- kayak 컨텐츠가 clipboard에 있어도, single line mode이면 (style정보 빼고) 텍스트만 paste한다.
		*/
        if (masterClipboard.system_clipboard_has_content() == false && tb.tbpreference.single_line_mode == false) {
            if (masterClipboard.get_element_size() === 0)
                return;
            if (masterClipboard.m_srv.length === 0)
                return;

            //TODO191116-A kayak의 내용을 paste할 경우임. (미완성)
            // masterClipboard.m_text에서 개행문자를 공백으로 치환하고, ATTR_Par의 수치도 조정되어야
            // single line을 유지할 수 있음.
            tb.text_core.paste(sel_begin, masterClipboard.m_text);
            tb.seg_mgr.paste(sel_begin, '' as any, masterClipboard);   // 원본은 number[] 자리에 빈 문자열을 넘긴다 (slice(0)/length만 쓴다)
        } else {
            // system clipboard에 내용이 있는 경우.
            //TODO191116-B single line mode인 경우 '\n'를 space로 치환하여 single line을 유지한다. (완성되었음)
            // [CR,LF]가 발견되면 [LF]로 치환함.
            let master_clipboard_text = masterClipboard.get_text({single_line_mode:tb.tbpreference.single_line_mode}) 
            tb.text_core.paste(sel_begin, master_clipboard_text);
            tb.seg_mgr.paste(sel_begin, master_clipboard_text, null);
        }
        tb.history.noop(); 

        if (!this.schema_only) {
            let par_change_info = tb.m_Par.get_command_change_info('paste') as LayoutChangeInfo;
            let text_change_info: TextChangeInfo = tb.text_core.get_last_change_info(par_change_info.edit_cmd);

            par_change_info.ci_change_start = sel_begin; //D10
            tb.layout!.do_layout(par_change_info, text_change_info);
            on_par_changed && on_par_changed(null, text_change_info, par_change_info);
            tb.tbcursor.set(sel_begin + masterClipboard.m_text.length);
            tb.document_changed({
                cmd: 'paste'
            });
        }


        (tb as any).schema_only && tb.tbcursor.set(sel_begin + masterClipboard.m_text.length);   // textbox에는 schema_only가 없다(항상 undefined). issues.md #12
    }    

    _undo(on_par_changed?: ParChangedCallback | null, opt?: UndoOptions): void {
        let tb = this.tb;
        
        let ret = tb.seg_mgr.undo();
        if (ret.err != SEGC.OK_ALL)
            return;

        //D180421
        /*  ret.noop == true인 경우
            GT_segmentLayer_Par.m_LastAction는 noop발생 이전의 noop아닌 action값을 가지고 있으므로 주의할 것.
            즉, ret.noop인 상태에서 tb.layout.do_layout()를 호출하면 절대 안됨.
        */
        if (ret.noop) {
            tb.text_core.undo_text(function(err: number | null, rng?: TP_TextRange) {})
            tb.history.undo();
            tb.document_changed({
                cmd: 'undo'
            });
            return;
        }


        tb.tbcursor.clear_sel();
        let self = this;
        tb.text_core.undo_text(function(err: number | null, rng?: TP_TextRange) {
            if (err)
                return;
            // console.log('ci_change_start: ', ci_change_start);
    
            tb.history.undo();

            if (!self.schema_only) {
                let par_change_info = tb.m_Par.get_command_change_info('undo') as LayoutChangeInfo;
                let text_change_info: TextChangeInfo = tb.text_core.get_last_change_info(par_change_info.edit_cmd);

                par_change_info.ci_change_start = rng!.m_begin; //D10
                par_change_info.ci_change_end = rng!.m_end;
                tb.layout!.do_layout(par_change_info, text_change_info);
                on_par_changed && on_par_changed(null, text_change_info, par_change_info);

                let after = text_change_info.after;
                if (Math.abs(after!.m_begin - after!.m_end) >= 1) {
                    if (opt && opt.dont_select_range) {
                        // tb.tbcursor.clear_sel();
                    }
                    else
                        tb.tbcursor.set_selection(after!.m_begin, after!.m_end);
                }
                else
                    tb.tbcursor.set(after!.m_cursor_pos);

                self.on_execute_ATTR_Doc(opt); // ATTR_Doc layer의 undo/redo 수행을 담당함
                tb.document_changed({
                    cmd: 'undo'
                });    
            }
        });
    }
    _redo(on_par_changed?: ParChangedCallback | null, opt?: UndoOptions): void {
        let tb = this.tb;
        
        let ret = tb.seg_mgr.redo();        
        if (ret.err != SEGC.OK_ALL)
            return;

        tb.tbcursor.clear_sel();
        
        //D180421 undo()의 설명 참고할 것.
        if (ret.noop) {
            tb.text_core.redo_text(function(err: number | null, rng?: TP_TextRange) {})
            tb.history.redo();
            tb.document_changed({
                cmd: 'redo'
            });
            return;
        }

        let self = this;        
        tb.text_core.redo_text(function(err: number | null, rng?: TP_TextRange) {
            if (err)
                return;
            // console.log('ci_change_start: ', ci_change_start);

            tb.history.redo();

            if (!self.schema_only) {
                let par_change_info = tb.m_Par.get_command_change_info('redo') as LayoutChangeInfo;
                let text_change_info: TextChangeInfo = tb.text_core.get_last_change_info(par_change_info.edit_cmd);

                par_change_info.ci_change_start = rng!.m_begin; //D10
                par_change_info.ci_change_end = rng!.m_end; //D10
                tb.layout!.do_layout(par_change_info, text_change_info);
                on_par_changed && on_par_changed(null, text_change_info, par_change_info);

                let after = text_change_info.after;
                if (Math.abs(after!.m_begin - after!.m_end) >= 1) {
                    if (opt && opt.dont_select_range) {
                        // tb.tbcursor.clear_sel();
                    }
                    else
                        tb.tbcursor.set_selection(after!.m_begin, after!.m_end);
                }
                else
                    tb.tbcursor.set(after!.m_cursor_pos);

                self.on_execute_ATTR_Doc(); // ATTR_Doc layer의 undo/redo 수행을 담당함
                tb.document_changed({
                    cmd: 'redo'
                });
            }
        });
    }

    //////////////////////////////////////////////////////////////////////////
    /*
        ATTR_Doc layer에 대한 undo, redo에 대한 수행을 한다.
        참고: TextBox_Style.ts:set_vertical_align()
    */
    on_execute_ATTR_Doc(opt?: UndoOptions): void {
		// replace를 위한 undo일 경우에는 그냥 넘어간다.
		// ex. 한글입력시 composing단계에서의 undo처리등.
		if (opt && opt.undo_for_replace) {
			return;
		}

        let seg = this.tb.seg_mgr.get_segDoc();
        if (seg._attr_class_name == 'ATTR_Doc') {
			let attr = seg.getAttr(0) as ATTR_Doc;
            if (attr.vertical_align != this.tb.tbpreference.vertical_justification) {
                this.tb.tbpreference.set_vertical_justification(attr.vertical_align);
            }
            if (attr.fit_to_content_height != this.tb.tbpreference.fit_to_content_height) {
                this.tb.tbpreference.set_fit_to_content_height(attr.fit_to_content_height)
            }
            if (attr.frame_height != this.tb.tbpreference.frame_height) {
                this.tb.tbpreference.set_height(attr.frame_height)
            } 
            this.tb.tbcursor.repaint();
        }
    }

    //////////////////////////////////////////////////////////////////////////
    
    find_steps_to_next_word(): number {
        let tb = this.tb;
        
        var cursor = tb.tbcursor.cursor;
        var text_length = tb.text_length();
        var i: number = cursor;
        var ch = tb.text_core.m_text[cursor];
        if (ch === 10)
            return 1;
    
        var whiteSpace = TB_Utils.isWhiteSpace(ch);
        if (whiteSpace) {
            for (i = cursor; i < text_length; i++) {
                ch = tb.text_core.m_text[i];
                if (ch === 10 || TB_Utils.isWhiteSpace(ch) == false)
                    return i - cursor;
            }
        } else {
            for (i = cursor; i < text_length; i++) {
                ch = tb.text_core.m_text[i];
                if (TB_Utils.isWhiteSpace(ch))
                    break;
            }
            for (; i < text_length; i++) {
                ch = tb.text_core.m_text[i];
                if (ch === 10 || TB_Utils.isWhiteSpace(ch) == false)
                    return i - cursor;
            }
        }
    
        var i = TB_Utils.inRange(0, text_length, i);
        var step = (i - cursor);
        return step == 0 ? 1 : step; // 적어도 1 step은 전진하도록 한다.
    }

    find_steps_to_prev_word(): number {
        let tb = this.tb;
        
        var cursor = tb.tbcursor.cursor - 1;
        if (cursor < 0)
            return 0;
    
        var text_length = tb.text_length();
        var i: number = cursor;
        var ch = tb.text_core.m_text[cursor];
        if (ch === 10)
            return 1;
    
        var whiteSpace = TB_Utils.isWhiteSpace(ch);
        if (whiteSpace) {
            for (i = cursor; i >= 0; i--) {
                ch = tb.text_core.m_text[i];
                if (ch === 10 || TB_Utils.isWhiteSpace(ch) == false)
                    break;
            }
            for (; i >= 0; i--) {
                ch = tb.text_core.m_text[i];
                if (ch === 10 || TB_Utils.isWhiteSpace(ch))
                    return cursor - i;
            }
        } else {
            for (i = cursor; i >= 0; i--) {
                ch = tb.text_core.m_text[i];
                if (TB_Utils.isWhiteSpace(ch))
                    return cursor - i;
            }
        }
    
        return (cursor - i);
    }

}