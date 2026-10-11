import ATTR_Par from '../segment/ATTR_Par';
import ATTR_Doc from '../segment/ATTR_Doc';
import ATTR_FontFamily from '../segment/ATTR_FontFamily';
import ATTR_FontSize from '../segment/ATTR_FontSize';
import ATTR_Bold from '../segment/ATTR_Bold';
import ATTR_FontColor from '../segment/ATTR_FontColor';
import ATTR_LetterSpacing from '../segment/ATTR_LetterSpacing';
import ATTR_LetterScaleX from '../segment/ATTR_LetterScaleX';
import ATTR_Stroke from '../segment/ATTR_Stroke';
import ATTR_Shadow from '../segment/ATTR_Shadow';
import ATTR_NamedRange from '../segment/ATTR_NamedRange';

import SEGC from '../segment/segment_const';
import * as log from "loglevel";
import type { GradientSpec, ColorModel, StrokeSpec, ShadowSpec } from '../segment/types';
import type { ParSetMask } from '../segment/ATTR_Par';
import type { DocSetMask } from '../segment/ATTR_Doc';
import type { TextBoxHost, ParChangedCallback, StyleSel, StyleSetOptions, LayoutChangeInfo } from './types';
import type { TextChangeInfo } from './TP_TextCore';

export class TextBox_Style {
    tb: TextBoxHost;
    schema_only: boolean;

    constructor(tb: TextBoxHost) {       
        this.tb = tb;        
        this.schema_only = this.tb.tb_schema ? false : true;
    }

	/*
		schema_only인 경우에는 호출하지 않는다.
	*/
	_post_process(): void {
        if (this.tb.tbpreference.fit_to_line_width_by_scale_x) {
            this.tb.seg_mgr.set_command_option({
                command_auto_play:"start"
            });
            this.tb.layout_each_paragraph_in_a_single_line();		
        }
	}

	set_font_family(family_name: string, type_style: string, sel: StyleSel, on_par_changed?: ParChangedCallback | null): Promise<void> {
		/*
			font loading은 async하게 발생하므로 callback(on_par_changed)에서 일부 처리했지만,
			promise를 리턴하는 방식으로 수정하였음.
			문제점 : callback이 오기 전까지 모든 입력을 막아야 하지만, 현실적으로 곤란함이 있어 그대로 둠.
		*/
		return new Promise((resolve, reject) => {
			this.do_set_font_family(family_name, type_style, sel, on_par_changed, () => {
				this._post_process();
				resolve();
			})
		})
	}
    set_font_size(font_size: number, sel: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null, opt?: StyleSetOptions): void {
    	this.do_set_font_size (font_size, sel, on_par_changed, replacing, opt)
		this._post_process(); 
	}
    set_bold(bold_val: string | null, sel: StyleSel, on_par_changed?: ParChangedCallback | null): void {
	    this.do_set_bold(bold_val, sel, on_par_changed)
		this._post_process();
	}
	set_fontColor(font_color: string | GradientSpec, font_color_cmyk?: number[] | string | null, font_color_model?: ColorModel | null, sel?: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null, opt?: StyleSetOptions): void {
		this.do_set_fontColor(font_color, font_color_cmyk, font_color_model, sel, on_par_changed, replacing, opt)
		this._post_process();
	}
    set_letter_space(space_val: number, sel: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null): void {
	    this.do_set_letter_space(space_val, sel, on_par_changed, replacing)
		this._post_process();
	}
    set_letter_scale_x(scale_val: number, sel: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null, opt?: StyleSetOptions): void {
		this.do_set_letter_scale_x(scale_val, sel, on_par_changed, replacing, opt)
		/*
			tb.tbpreference.fit_to_line_width_by_scale_x이 true이면 아래의 순환 구조가 나오게 되므로 
				_post_process() --> tb.layout_each_paragraph_in_a_single_line() --> set_letter_scale_x() --> _post_process()
			
			TextBox.layout_each_paragraph_in_a_single_line() 에서 set_letter_scale_x()호출시 post_process가 호출되지 않도록 옵션을 제공한다.
		*/
		if (opt == null || opt.skip_post_process == false)
			this._post_process();
	}
	set_stroke(stroke: StrokeSpec, sel: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null): void {
		this.do_set_stroke(stroke, sel, on_par_changed, replacing)
		this._post_process();
	}
	set_shadow(shadow: ShadowSpec, sel: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null): void {
		this.do_set_shadow(shadow, sel, on_par_changed, replacing)
		this._post_process();
	}
	set_text_align(align_code: string, sel: StyleSel, on_par_changed?: ParChangedCallback | null): void {
		this.do_set_text_align(align_code, sel, on_par_changed)
		this._post_process();
	}
    set_par_style(style_name: string, val: any, sel: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null): void {
	    this.do_set_par_style(style_name, val, sel, on_par_changed, replacing)
		this._post_process();
	}
    set_vertical_align(val: string, on_par_changed?: ParChangedCallback | null): void {
	    this.do_set_vertical_align (val, on_par_changed)
		this._post_process();
	}
    set_fit_to_content_height(val: boolean, on_par_changed?: ParChangedCallback | null): void {
	    this.do_set_fit_to_content_height(val, on_par_changed)
		this._post_process();
	}
    set_frame_height(height_px: number, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null): void {
	    this.do_set_frame_height(height_px, on_par_changed, replacing)
		this._post_process();
	}
    set_textonpath_align(align_code: string): void {
	    this.do_set_textonpath_align(align_code)
		this._post_process();
	}
    set_textonpath_flip_path(flip_flag: boolean): void {
	    this.do_set_textonpath_flip_path(flip_flag)
		this._post_process();
	}
    set_textonpath_bracket(bracket_tag: string, val: number): void {
	    this.do_set_textonpath_bracket(bracket_tag, val)
		this._post_process();
	}
    set_range_id(id: string, title: string, sel: StyleSel, on_par_changed?: ParChangedCallback | null): void {
    	this.do_set_range_id (id, title, sel, on_par_changed)
		this._post_process(); 
	}

	////////////////////////////////////////////////////////////////////////////////////////
	// private method

    
    run_command(edit_cmd: string, sel: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null): void {
        let tb = this.tb;
        
        tb.history.noop();
        if (!this.schema_only) {
            let par_change_info = tb.m_Par.get_command_change_info(edit_cmd) as LayoutChangeInfo;
            let text_change_info: TextChangeInfo = tb.text_core.get_last_change_info(par_change_info.edit_cmd);

            par_change_info.ci_change_start = sel.begin; //D10
            par_change_info.ci_change_end = sel.end;
            // ci_change_end의 지정은, layout시 first par에서  optimal layout을 할 때
            // sel.end이후 부터 optimal layout을 적용하라는 의미임.

            tb.layout!.do_layout(par_change_info, text_change_info);
            on_par_changed && on_par_changed(null, text_change_info, par_change_info);
            tb.document_changed({
                cmd: edit_cmd,
                replacing: replacing ? true : false
            });

        }
    }    


    do_set_font_family(family_name: string, type_style: string, sel: StyleSel, on_par_changed?: ParChangedCallback | null, callback?: () => void): void {
        let tb = this.tb;
        
        let self = this;
        if (this.schema_only) {
            // console.log('schema_only:', schema_only);
			this._set_font_family(family_name, type_style, sel, on_par_changed);
			callback && callback();
        }
        else {
            tb.fontloader!.get(family_name, type_style, (err, font) => {
                if (err)
                    log.error("font loading ERROR : ", err);
                else {
					self._set_font_family(family_name, type_style, sel, on_par_changed);
					callback && callback();
				}
            })
        }
    }
    _set_font_family(family_name: string, type_style: string, sel: StyleSel, on_par_changed?: ParChangedCallback | null): void {
        let tb = this.tb;

        if (sel.exists_range === false) {
            let attr = new ATTR_FontFamily(family_name, type_style);
            tb.curStyle[attr._attr_class_name] = attr;
            return;
        }

        let attr = new ATTR_FontFamily(family_name, type_style);
        // this.text_core.nop(sel.cursor);
        tb.text_core.nop(sel.begin, sel.end);
        tb.seg_mgr.set(sel.begin, sel.end, attr);

        this.run_command('set', sel, on_par_changed);
        tb.tbcursor.repaint();    
    }

    do_set_font_size(font_size: number, sel: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null, opt?: StyleSetOptions): void {
        let tb = this.tb;

        if (sel.exists_range === false) {
            let attr = new ATTR_FontSize(font_size);
            tb.curStyle[attr._attr_class_name] = attr;            
            return;
        }

        var attr_fsize = new ATTR_FontSize(font_size);
        // this.text_core.nop(sel.cursor);
        tb.text_core.nop(sel.begin, sel.end);
        tb.seg_mgr.set(sel.begin, sel.end, attr_fsize, null, opt);

        this.run_command('set', sel, on_par_changed, replacing);

		tb.tbcursor.repaint();
    }

    do_set_bold(bold_val: string | null, sel: StyleSel, on_par_changed?: ParChangedCallback | null): void {
        let tb = this.tb;
        
        if (sel.exists_range === false) {
            // 현재 cursor 위치에서의 bold 상태를 얻음
            let bold = !tb.m_Bold.getAttr(sel.begin)!.bold;
            let attr = new ATTR_Bold(bold);
            tb.curStyle[attr._attr_class_name] = attr;            
            return;
        }

        var bold = true;
        if (bold_val !== null) {
            bold = false;
            if (bold_val === 'bold' || bold_val === '700')
                bold = true;
            else if (bold_val === 'normal' || bold_val === '400')
                bold = false;

        } else if (tb.m_Bold.is_in_single_segment(sel.begin, sel.end)) {
            var layer = tb.m_Bold.getAttr(sel.begin)!;
            bold = !(layer.bold);
        }

        var attr_bold = new ATTR_Bold(bold);
        // this.text_core.nop(sel.cursor);
        tb.text_core.nop(sel.begin, sel.end);
        tb.seg_mgr.set(sel.begin, sel.end, attr_bold);

        this.run_command('set', sel, on_par_changed);

		tb.tbcursor.repaint();
    }

	// font_color가 object이면 gradient object임 
	do_set_fontColor(font_color: string | GradientSpec, font_color_cmyk?: number[] | string | null, font_color_model?: ColorModel | null, sel?: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null, opt?: StyleSetOptions): void {
        let tb = this.tb;
        
        if (sel!.exists_range === false) {
            let attr = new ATTR_FontColor(font_color, font_color_cmyk as number[] | null, font_color_model);   // clipboard HTML(TB_ApplyEditOperation)과 InDesign 변환은 문자열을 넘긴다. issues.md #16
            tb.curStyle[attr._attr_class_name] = attr;
            return;
        }

        var attr_fontColor = new ATTR_FontColor(font_color, font_color_cmyk as number[] | null, font_color_model);   // issues.md #16
        // this.text_core.nop(sel.cursor);
        tb.text_core.nop(sel!.begin, sel!.end);
        tb.seg_mgr.set(sel!.begin, sel!.end, attr_fontColor, null, opt);

        this.run_command('set', sel!, on_par_changed, replacing);

		tb.tbcursor.repaint();
	}

    do_set_letter_space(space_val: number, sel: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null): void {
        let tb = this.tb;
        
        if (sel.exists_range === false) {
            let attr = new ATTR_LetterSpacing(space_val);
            tb.curStyle[attr._attr_class_name] = attr;
            return;
        }

        var attr_val = new ATTR_LetterSpacing(space_val);
        // this.text_core.nop(sel.cursor);
        tb.text_core.nop(sel.begin, sel.end);
        tb.seg_mgr.set(sel.begin, sel.end, attr_val);

        this.run_command('set', sel, on_par_changed, replacing);

		tb.tbcursor.repaint();
    }    

    do_set_letter_scale_x(scale_val: number, sel: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null, opt?: StyleSetOptions): void {
        let tb = this.tb;
        
        if (sel.exists_range === false) {
            let attr = new ATTR_LetterScaleX(scale_val);
            tb.curStyle[attr._attr_class_name] = attr;            
            return;
        }

        var attr_val = new ATTR_LetterScaleX(scale_val);
        // this.text_core.nop(sel.cursor);
        tb.text_core.nop(sel.begin, sel.end);
        tb.seg_mgr.set(sel.begin, sel.end, attr_val, null, opt);

        this.run_command('set', sel, on_par_changed, replacing);

        tb.tbcursor.repaint();
    }

	// stroke은 object임.
	do_set_stroke(stroke: StrokeSpec, sel: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null): void {
		let tb = this.tb;
		
		if (sel.exists_range === false) {
			let attr = new ATTR_Stroke(stroke);
			tb.curStyle[attr._attr_class_name] = attr;
			return;
		}

		var attr_stroke = new ATTR_Stroke(stroke);
		// this.text_core.nop(sel.cursor);
		tb.text_core.nop(sel.begin, sel.end);
		tb.seg_mgr.set(sel.begin, sel.end, attr_stroke);

		this.run_command('set', sel, on_par_changed, replacing);

		tb.tbcursor.repaint();
	}
	
	// shadow은 object임.
	do_set_shadow(shadow: ShadowSpec, sel: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null): void {
		let tb = this.tb;
		
		if (sel.exists_range === false) {
			let attr = new ATTR_Shadow(shadow);
			tb.curStyle[attr._attr_class_name] = attr;
			return;
		}

		var attr_shadow = new ATTR_Shadow(shadow);
		// this.text_core.nop(sel.cursor);
		tb.text_core.nop(sel.begin, sel.end);
		tb.seg_mgr.set(sel.begin, sel.end, attr_shadow);

		this.run_command('set', sel, on_par_changed, replacing);

		tb.tbcursor.repaint();
	}

	do_set_text_align(align_code: string, sel: StyleSel, on_par_changed?: ParChangedCallback | null): void {
        let tb = this.tb;
        
        var attr_par = new ATTR_Par(0);
        // par에만 선별적으로 값을 설정하기 위한 것.
        var setMask: ParSetMask = {
            m_Align: align_code
        }

        tb.text_core.nop(sel.begin, sel.end);
        tb.seg_mgr.set(sel.begin, sel.end, attr_par, setMask);

        this.run_command('set_par', sel, on_par_changed);

        tb.tbcursor.repaint();
    }

    do_set_par_style(style_name: string, val: any, sel: StyleSel, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null): boolean | void {
        let tb = this.tb;
        
        var attr_par = new ATTR_Par(0);
        // par에만 선별적으로 값을 설정하기 위한 것.
        var setMask: ParSetMask = {}
        if (style_name === 'first')
            setMask.m_Findent = val
        else if (style_name === 'left')
            setMask.m_Lindent = val
        else if (style_name === 'right')
            setMask.m_Rindent = val
        else if (style_name === 'space_before')
            setMask.m_SpaceBefore = val
        else if (style_name === 'space_after')
            setMask.m_SpaceAfter = val
        else if (style_name === 'line_space')
            setMask.m_LineSpace = val
        else if (style_name === 'leading')
            setMask.m_Leading = val
        else
            return false;


        tb.text_core.nop(sel.begin, sel.end);
        tb.seg_mgr.set(sel.begin, sel.end, attr_par, setMask);

        this.run_command('set_par', sel, on_par_changed, replacing);

        tb.tbcursor.repaint();
    }

    do_set_range_id(id: string, title: string, sel: StyleSel, on_par_changed?: ParChangedCallback | null): void {
        let tb = this.tb;

        if (sel.exists_range === false) {
            let attr = new ATTR_NamedRange(id, title);
            tb.curStyle[attr._attr_class_name] = attr;            
            return;
        }

        var attr_named_range = new ATTR_NamedRange(id, title);
        // this.text_core.nop(sel.cursor);
        tb.text_core.nop(sel.begin, sel.end);
        tb.seg_mgr.set(sel.begin, sel.end, attr_named_range, null);

        this.run_command('set', sel, on_par_changed);

		tb.tbcursor.repaint();
    }	

    //////////////////////////////////////////////////////////////////////////////////////////////

    
    /*
        ATTR_Doc에 대한 undo/redo 수행은 
        TextBox_Edit.ts:on_execute_ATTR_Doc()를 참고.
    */
   do_set_vertical_align(val: string, on_par_changed?: ParChangedCallback | null): void {
        let tb = this.tb;

        // vertical align을 하는 시점에 fit-to-content-height가 true에서 false가 되는 상황이면 frame_height 값을 넣어주어야 한다.
        // set_fit_to_content_height()하기 전에 미리 상태를 확보해야 함.
        let need_to_set_frame_height = tb.tbpreference.get_fit_to_content_height(); 

        var attr_doc = new ATTR_Doc();
        var setMask: DocSetMask = {
            vertical_align : val,
            fit_to_content_height : false
        }
        // ATTR_Doc이 단일 attrbiute로 관리가 되므로 tb.tbcursor.sel()을 자유롭게 사용가능함
        var sel = tb.tbcursor.sel();
        tb.text_core.nop(sel.begin, sel.end);
        tb.seg_mgr.set(sel.begin, sel.end, attr_doc, setMask);            

        // 실제 값 설정
        tb.tbpreference.set_fit_to_content_height(false)
        tb.tbpreference.set_vertical_justification(val)

        // schema mode이면 get_content_height()를 수행할 수 없으므로 건너뛴다. (InDesignJosnConvert에서 사용하는 경우임.)
        if (need_to_set_frame_height && !this.schema_only) { 
            setMask.frame_height = tb.tbpreference.get_content_height()   // seg_mgr.set() 뒤라 ATTR_Doc에는 반영되지 않는다 (원본 그대로). issues.md #14
        }

        this.run_command('set_vertical_align', sel, on_par_changed);
        tb.tbcursor.repaint();    
    }

    /* 
        val:boolean
    */
   do_set_fit_to_content_height(val: boolean, on_par_changed?: ParChangedCallback | null): void {
        let tb = this.tb;
        if (val == tb.tbpreference.get_fit_to_content_height())
            return;

        tb.tbpreference.set_fit_to_content_height(val)

        var attr_doc = new ATTR_Doc();
        var setMask: DocSetMask = {
            fit_to_content_height : val
        }
        if (val == false)
            setMask.frame_height = tb.tbpreference.get_content_height();

        // ATTR_Doc이 단일 attrbiute로 관리가 되므로 tb.tbcursor.sel()을 자유롭게 사용가능함
        var sel = tb.tbcursor.sel();
        tb.text_core.nop(sel.begin, sel.end);
        tb.seg_mgr.set(sel.begin, sel.end, attr_doc, setMask);

        this.run_command('fit_to_content_height', sel, on_par_changed);
        tb.tbcursor.repaint();
    }

    do_set_frame_height(height_px: number, on_par_changed?: ParChangedCallback | null, replacing?: boolean | null): void {
        let tb = this.tb;

        tb.tbpreference.set_height(height_px)


        if (replacing != true) {
            var attr_doc = new ATTR_Doc();
            var setMask: DocSetMask = {
                frame_height : height_px
            }        

            // ATTR_Doc이 단일 attrbiute로 관리가 되므로 tb.tbcursor.sel()을 자유롭게 사용가능함
            var sel = tb.tbcursor.sel();  
            tb.text_core.nop(sel.begin, sel.end);
            tb.seg_mgr.set(sel.begin, sel.end, attr_doc, setMask);

            this.run_command('set_frame_height', sel, on_par_changed, replacing);
            tb.tbcursor.repaint(); 
        }
    }

    //////////////////////////////////////////////////////////////////////////////////////////////


    //////////////////////////////////////////////////////////////////////////////////////////////
 
    do_set_textonpath_align(align_code: string): void {
        let tb = this.tb;

        let sel = tb.tbcursor.sel();
        tb.text_core.nop(sel.begin, sel.end);
        tb.seg_mgr.nop();

        tb.history.dispatch({
            type: 'TPath.ALIGN',
            align_to_path: align_code
        })

        // let cmd_step = tb.get_history_stack_pointer();
        // console.log('cmd_step:', cmd_step)

        if (this.schema_only == false) {
            // call tb.text_on_path.update_view(); 
            
            // 1. texbox의 일반 operation뒤에 tpath의 noop을 호출할 것.
            // 2. tb.text_on_path.update_view()가 tb.layout.do_layout()뒤에 불리도록 할 것.

            tb.document_changed({
                cmd: 'TPath.ALIGN'
            });
            
        }

        tb.tbcursor.repaint();        
    }

    do_set_textonpath_flip_path(flip_flag: boolean): void {
        let tb = this.tb;

        let sel = tb.tbcursor.sel();
        tb.text_core.nop(sel.begin, sel.end);
        tb.seg_mgr.nop();

        tb.history.dispatch({
            type: 'TPath.FLIP_PATH',
            flip_path: flip_flag
        })

        // let cmd_step = tb.get_history_stack_pointer();
        // console.log('cmd_step:', cmd_step)

        if (this.schema_only == false) {
            // call tb.text_on_path.update_view(); 
            
            // 1. texbox의 일반 operation뒤에 tpath의 noop을 호출할 것.
            // 2. tb.text_on_path.update_view()가 tb.layout.do_layout()뒤에 불리도록 할 것.

            tb.document_changed({
                cmd: 'TPath.FLIP_PATH'
            });
            
        }

        tb.tbcursor.repaint();        
    }    

    do_set_textonpath_bracket(bracket_tag: string, val: number): void {
        let cmd_type: string = 'TPath.START_BRACKET'
        if (bracket_tag == 'begin')
            cmd_type = 'TPath.START_BRACKET'
        else if (bracket_tag == 'end')
            cmd_type = 'TPath.END_BRACKET'

        let tb = this.tb;

        let sel = tb.tbcursor.sel();
        tb.text_core.nop(sel.begin, sel.end);
        tb.seg_mgr.nop();

        tb.history.dispatch({
            type: cmd_type,
            value: val
        })

        if (this.schema_only == false) {
            // 1. texbox의 일반 operation뒤에 tpath의 noop을 호출할 것.
            // 2. tb.text_on_path.update_view()가 tb.layout.do_layout()뒤에 불리도록 할 것.
            tb.document_changed({
                cmd: cmd_type
            });
        }
        tb.tbcursor.repaint();        
    }
}