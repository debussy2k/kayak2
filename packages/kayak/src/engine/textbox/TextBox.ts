import SeglayerManager from "../segment/seglayer_manager";
import GT_segmentLayer_Par from "../segment/seglayer_par";
import GT_segmentLayer from "../segment/seglayer";
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

import { TextBoxEnv } from "./TextBoxEnv";
import { TB_Preference } from "./TB_Preference";
import TB_Config from './TB_Config';
import { TextBox_Edit } from './TextBox_Edit';
import { TextBox_Style } from './TextBox_Style';
import { TextBox_InOut } from './TextBox_InOut';

import TB_WordCache from './TB_WordCache';
import { TB_DocFactory } from "./TB_DocFactory"
import TB_Layout from "./TB_Layout";
import TB_Input from "./TB_Input";
import TB_Cursor from "./TB_Cursor";
import TP_TextCore from "./TP_TextCore";
import { spFontManager } from './TB_FontManager';
import { TB_LocalFontLoader } from './TB_LocalFontLoader';
import { TB_ApplyEditOperation } from './TB_ApplyEditOperation';

import { TB_TextOnPath } from '../geometry/TB_TextOnPath';
import { TB_History } from './TB_History';
import { TB_FormatService } from './services/TB_Format.service'


import TB_Dom from './TB_Dom';


// http://marcj.github.io/css-element-queries/
// https://stackoverflow.com/questions/6492683/how-to-detect-divs-dimension-changed
import ResizeSensor from "css-element-queries/src/ResizeSensor.js";

import type { MasterClipboard } from '../segment/master_clipboard';
import type { TB_ConfigOptions, ResizeOption, FontItem, FontList, FontLoadingState, FontLoadingStateCallback, KayakJsonObject,
    DocChangeData, DocChangeListener, KeyboardEventFilter, Dimension, CurrentStyleInfo, ResizeSensorLike, ResizeObserverLike,
    LoadJsonOptions, LoadJsonResult, FontEnvOptions, SnapshotSvgOptions, SnapshotSvgCallback, SvgSnapshotData,
    ContentBBox, ContentBBoxSvg, MirrorOptions, UsedColor, UsedFontListInfo, IndTextFrame, IndConvertResult } from './types';
import type { TextOnPathOptions } from '../geometry/types';


////////////////////////////////////////////////////////////////////////////////
import * as log from "loglevel";
if (typeof LOG_LEVEL != 'undefined') {
    console.log("LOG_LEVEL: ", LOG_LEVEL);
    log.setLevel(LOG_LEVEL); // [trace, debug, info, warn, error]까지 나옴 
} else {
    console.log("LOG_LEVEL: all");
    log.enableAll(); // [trace, debug, info, warn, error]까지 나옴 
}
////////////////////////////////////////////////////////////////////////////////


class TP_Context {
    WordCache: TB_WordCache;
    masterClipboard: MasterClipboard;

    constructor(options: TB_ConfigOptions) {
        this.WordCache = new TB_WordCache;
        this.masterClipboard = options.masterClipboard;
    }
}

/*
	참고 사항.

	do_layout()을 호출하는 2가지 type이 있다.
	1. par_change_info.ci_change_start 만 적용한 경우.
	   주로 insert, delete, paste등 text수량에 변화가 있는 경우임.
		code:
			par_change_info.ci_change_start = cursor; //D10
			self.layout.do_layout(par_change_info, text_change_info);

	2. par_change_info.ci_change_start, par_change_info.ci_change_end 두 개 다 적용한 경우.
	   이 경우는 layout시 first par에서  optimal layout을 할 때
	   sel.end이후 부터 optimal layout을 적용하라는 의미임.
	   "set bold", "set font-size"등 text수량의 변화 없이 attribute만 변경하는 경우임.
	   그리고 undo/redo의 경우.

		code: 
			par_change_info.ci_change_start = sel.begin; //D10
			par_change_info.ci_change_end = sel.end;
			self.layout.do_layout(par_change_info, text_change_info);

*/
class textbox {
    private initialized: boolean;
    version: string;
    env: TextBoxEnv;
    tbcontext: TP_Context;
    tbpreference: TB_Preference;
    tbconfig: TB_Config;
    fontloader: TB_LocalFontLoader | null;            // schema 모드면 null
    element: HTMLElement;                             // .kayak-root
    seg_mgr: SeglayerManager;
    docFactory: TB_DocFactory | null;                 // schema 모드면 null
    layout: TB_Layout | null;                         // schema 모드면 null
    tbinput: TB_Input | null;                         // schema 모드면 null
    tbcursor: TB_Cursor;
    user_doc_change_listeners: DocChangeListener[];
    user_style_listener: ((cursor: TB_Cursor) => void) | null;
    user_font_listener: FontLoadingStateCallback | null;
    user_focus_listener: (() => void) | null;
    client_size_listener: unknown;                    // 원본에서 null로 두기만 하고 쓰지 않는다
    resize_sensor: ResizeObserverLike | ResizeSensorLike | null;
    tb_schema: textbox | null;                        // schema 모드면 null
    curStyle: Record<string, any>;
    opEdit: TextBox_Edit;
    opStyle: TextBox_Style;
    inout: TextBox_InOut;
    history: TB_History;
    text_on_path: TB_TextOnPath | null;
    format_service: TB_FormatService;
    /** 원본의 hoisted function. fontloader에 register/unregister할 때 같은 참조여야 하므로 자기 속성으로 둔다 */
    font_loading_state_callback: FontLoadingStateCallback;
    /** set_keyboard_event_filter()가 만든다 (생성자에서는 대입하지 않는다) */
    user_keyboard_event_filter: KeyboardEventFilter | undefined;
    // _init()이 만든다
    text_core!: TP_TextCore;
    m_Par!: GT_segmentLayer_Par<ATTR_Par>;
    m_DocLayer!: GT_segmentLayer_Par<ATTR_Doc>;
    m_FFamilyLayer!: GT_segmentLayer<ATTR_FontFamily>;
    m_FSizeLayer!: GT_segmentLayer<ATTR_FontSize>;
    m_Bold!: GT_segmentLayer<ATTR_Bold>;
    m_FontColor!: GT_segmentLayer<ATTR_FontColor>;
    m_LetterSpacing!: GT_segmentLayer<ATTR_LetterSpacing>;
    m_LetterScaleX!: GT_segmentLayer<ATTR_LetterScaleX>;
    m_Stroke!: GT_segmentLayer<ATTR_Stroke>;
    m_Shadow!: GT_segmentLayer<ATTR_Shadow>;
    m_NamedRange!: GT_segmentLayer<ATTR_NamedRange>;

    constructor(options: TB_ConfigOptions) {
        if (options.schema) {
            //console.log('by schema');
        }

        this.initialized = false;
        this.version = "1.0.0";
        this.env = new TextBoxEnv(this);
        this.tbcontext = new TP_Context(options);
        this.tbpreference = new TB_Preference(this);
        this.tbconfig = new TB_Config(options, this.tbpreference);
        this.fontloader = options.schema ? null : new TB_LocalFontLoader(this.tbconfig.font_list_id, this.tbconfig.node_env.base_folder_for_download);

        this.element = this.tbconfig.element!;   // .kayak-root (DOM element)
        this.seg_mgr = new SeglayerManager();
        this.docFactory = options.schema ? null : new TB_DocFactory(this);
        this.layout = options.schema ? null : new TB_Layout(this);
        this.tbinput = options.schema ? null : new TB_Input(this);
        this.tbcursor = new TB_Cursor(this);
        this.user_doc_change_listeners = [];
        this.user_style_listener = null;
        this.user_font_listener = null;
        this.user_focus_listener = null;
        this.client_size_listener = null;
        this.resize_sensor = null;

        // schema모드에서도 font_list_id를 알 수 있도록 전달한다.
        this.tb_schema = options.schema ? null : new textbox({ schema: true, font_list_id: options.font_list_id });
        /*
            원본의 `var schema_only = this.tb_schema ? false : true`는 init()에서 같은 식으로 다시 구한다 (tb_schema는 생성 뒤 바뀌지 않는다).
            속성으로 만들지 않는 이유: TextBox_Edit._paste가 `tb.schema_only`를 읽으므로(issues.md #12) 속성이 생기면 schema 모드 paste의 동작이 바뀐다.
        */
        /*
        	tb_schema는 html을 kayak content로 만들기 위해 logical 구조만 유지한 상태로 생성된 textbox다.
        	tb_schema에 대해 insert(), erase() 및 set_bold(), set_par_style()등의 edit method를 적용 가능함.
        */


        this.curStyle = {}; // selection없이 style을 설정하거나, erase직후 기억해야하는 style을 저장하는 목적.
        this.opEdit = new TextBox_Edit(this);
        this.opStyle = new TextBox_Style(this);
        this.inout = new TextBox_InOut(this);

        this.history = new TB_History();
        this.text_on_path = null;

        this.format_service = new TB_FormatService(this);


        this.font_loading_state_callback = (state: FontLoadingState): void => {
            let inp = this.tbinput!.get_inp();
            // console.log('>> font loading state : ', state);

            // input박스를 'display:none'하여 입력을 원천봉쇄함.
            if (state == 'loading') {
                inp.style.display = 'none';
            } else if (state == 'loaded') {
                inp.style.display = '';
                // font loading하는 동안 뺐었던 상태를 다시 복구. focus상태였다면 set_focus()를 명시적으로 해줘야 함.
                if (this.tbinput!.get_sel_state_text() == 'ST_FOCUSED')
                    this.tbinput!.set_focus();
            }

            this.user_font_listener && this.user_font_listener(state);
        }

        // 모든 member var/method가 셋업된 이후 init()을 호출함.
        this._init(options);
    }


    /*  "AA  --> p|AA" case에 대한 unit test
    this.unit_test = function() {
        // Segyayer : Font size
        var m_FSizeLayer = new GT_segmentLayer(SEGC.GRAVITY_LEFT, 'ATTR_FontSize', ATTR_FontSize.prototype);
        var fsize_10 = new ATTR_FontSize(10);
        var fsize_20 = new ATTR_FontSize(20);
        var fsize_30 = new ATTR_FontSize(30);
        m_FSizeLayer.insert(0, fsize_10);
        m_FSizeLayer.insert_string(0, [55, 56], fsize_20);
        m_FSizeLayer.insert_string(0, [55, 56], fsize_30);
        logVec(m_FSizeLayer);

        m_FSizeLayer.erase(0, 2);
        logVec(m_FSizeLayer);

        m_FSizeLayer.insert(0, fsize_30);
        logVec(m_FSizeLayer);

        m_FSizeLayer.undo();
        logVec(m_FSizeLayer);


        function logVec(layer) {
            var segVec = layer._get_vec();
            var str = '[';
            for (var i = 0; i < segVec.length; i++) {
                str += segVec[i].m_nCount;
                str += (i < (segVec.length - 1)) ? ', ' : '';
            }
            str += ']';
            console.log(str);    
        }
    }
    */


    private _init(options: TB_ConfigOptions): void {
        // text core test
        this.text_core = new TP_TextCore();
        this.text_core.insert('\n', 0);

        //D Layer

        // Seglayer : Par
        this.m_Par = new GT_segmentLayer_Par<ATTR_Par>(SEGC.GRAVITY_RIGHT, 'ATTR_Par', ATTR_Par.prototype);
        var attr_par_newline = new ATTR_Par(0);
        attr_par_newline.m_Align = this.tbconfig.content.default_align;
        this.m_Par.insert_newline(0, attr_par_newline);

        // Segyayer : Doc
        this.m_DocLayer = new GT_segmentLayer_Par<ATTR_Doc>(SEGC.GRAVITY_LEFT, 'ATTR_Doc', ATTR_Doc.prototype, { accept_newline: false });
        var attr_doc = new ATTR_Doc();
        this.m_DocLayer.insert(0, attr_doc);

        // Segyayer : FontFamily
        // this.fontloader.get_default_font()를 사용하지 않음. schema 모드에서 fontloader에 대한 dependency가 없도록 하기 위함
        let default_font = this.get_default_font();
        this.m_FFamilyLayer = new GT_segmentLayer<ATTR_FontFamily>(SEGC.GRAVITY_LEFT, 'ATTR_FontFamily', ATTR_FontFamily.prototype);
        var attr_ffamily = new ATTR_FontFamily(default_font.familyName, default_font.typeStyle);
        this.m_FFamilyLayer.insert(0, attr_ffamily);

        // Segyayer : Font size
        this.m_FSizeLayer = new GT_segmentLayer<ATTR_FontSize>(SEGC.GRAVITY_LEFT, 'ATTR_FontSize', ATTR_FontSize.prototype);
        var attr_fsize = new ATTR_FontSize(this.tbconfig.content.default_font_size);
        this.m_FSizeLayer.insert(0, attr_fsize);

        // Segyayer : bold
        this.m_Bold = new GT_segmentLayer<ATTR_Bold>(SEGC.GRAVITY_LEFT, 'ATTR_Bold', ATTR_Bold.prototype);
        this.m_Bold.insert(0, new ATTR_Bold(false));

        // Segyayer : Font color
        this.m_FontColor = new GT_segmentLayer<ATTR_FontColor>(SEGC.GRAVITY_LEFT, 'ATTR_FontColor', ATTR_FontColor.prototype);
        if (this.tbconfig.content.default_font_color)
            this.m_FontColor.insert(0, new ATTR_FontColor(this.tbconfig.content.default_font_color.rgb, this.tbconfig.content.default_font_color.cmyk));
        else
            this.m_FontColor.insert(0, new ATTR_FontColor('black', [0, 0, 0, 100]));

        // Segyayer : Letter Spacing
        this.m_LetterSpacing = new GT_segmentLayer<ATTR_LetterSpacing>(SEGC.GRAVITY_LEFT, 'ATTR_LetterSpacing', ATTR_LetterSpacing.prototype);
        this.m_LetterSpacing.insert(0, new ATTR_LetterSpacing(0));

        // Segyayer : Letter Scale X
        this.m_LetterScaleX = new GT_segmentLayer<ATTR_LetterScaleX>(SEGC.GRAVITY_LEFT, 'ATTR_LetterScaleX', ATTR_LetterScaleX.prototype);
        this.m_LetterScaleX.insert(0, new ATTR_LetterScaleX(100)); // 100%

        // Segyayer : Stroke
        this.m_Stroke = new GT_segmentLayer<ATTR_Stroke>(SEGC.GRAVITY_LEFT, 'ATTR_Stroke', ATTR_Stroke.prototype);
        this.m_Stroke.insert(0, new ATTR_Stroke());

        // Segyayer : Shadow
        this.m_Shadow = new GT_segmentLayer<ATTR_Shadow>(SEGC.GRAVITY_LEFT, 'ATTR_Shadow', ATTR_Shadow.prototype);
        this.m_Shadow.insert(0, new ATTR_Shadow());

        // Segyayer : Named Range
        this.m_NamedRange = new GT_segmentLayer<ATTR_NamedRange>(SEGC.GRAVITY_LEFT, 'ATTR_NamedRange', ATTR_NamedRange.prototype);
        this.m_NamedRange.insert(0, new ATTR_NamedRange());
		
        // SeglayerManager 
        this.seg_mgr.add(this.m_Par);
        this.seg_mgr.add(this.m_DocLayer);
        this.seg_mgr.add(this.m_FFamilyLayer);
        this.seg_mgr.add(this.m_FSizeLayer);
        this.seg_mgr.add(this.m_Bold);
        this.seg_mgr.add(this.m_FontColor);
        this.seg_mgr.add(this.m_LetterSpacing);
        this.seg_mgr.add(this.m_LetterScaleX);
        this.seg_mgr.add(this.m_Stroke);
        this.seg_mgr.add(this.m_Shadow);
        this.seg_mgr.add(this.m_NamedRange);


        if (this.tbconfig.text_on_path && options.schema == false) {
            this.tbconfig.build_dom_textonpath();
            let opt = {
                svg_path_data: this.tbconfig.text_on_path.svg_path_data,
                align_to_path: this.tbconfig.text_on_path.align_to_path,
                flip_path: this.tbconfig.text_on_path.flip_path,
                start_bracket: this.tbconfig.text_on_path.start_bracket,
                end_bracket: this.tbconfig.text_on_path.end_bracket
            }
            this.text_on_path = new TB_TextOnPath(this, opt);
        }
    }


    /*
        opt {
            svg_path_data : string
            align_to_path : string
        }
    */
    init_textonpath(opt: TextOnPathOptions): void {
        this.tbconfig.build_dom_textonpath();
        this.text_on_path = new TB_TextOnPath(this, opt);
    }


    /*  schema 모드에서 fontloader에 대한 dependency가 없도록 하기 위해 
        spFontManager를 직접 access함.
    */
    get_default_font(font_list?: FontList | null): FontItem {
        if (font_list == undefined) // font_list 객체를 직접 받은 경우
            return spFontManager._find_default_values(this.tbconfig.font_list_id);
        else
            return spFontManager.find_default_font_with_font_list(font_list);

    }


    init(): Promise<void> {
        const schema_only = this.tb_schema ? false : true;   // 원본 생성자의 var schema_only (위 주석 참고)
        return new Promise((resolve, reject) => {
            if (schema_only == false) {
                this.setup_fontManager().then(() => {
                    this.initialized = true;
                    this.document_changed({ cmd: 'initialized' });

                    this.tbcursor.repaint(); // 초기 커서 위치 갱신
                    resolve();
                })
            } else {
                this.initialized = true;
                resolve();
            }
        })
    }


    is_initialized(): boolean {
        return this.initialized;
    }


    class_name(): string {
        if (this.text_on_path)
            return 'textonpath';
        else
            return 'textbox';
    }


    /* font에 할당된 객체를 해제한다. */
    destroy(): void {
        this.fontloader!.destroy();
    }



    private setup_fontManager(): Promise<void> {
        this.fontloader!.register_font_loading_state_callback(this.font_loading_state_callback);

        let font_info = this.fontloader!.get_default_font();
        return this.fontloader!.load_font(font_info).then(font => {
            this.layout!.do_layout_all();

            if (this.tbconfig.placeholder_text) {
                var opt = { reset: true }
                this.opEdit.insert_string(0, this.tbconfig.placeholder_text, null, opt);
            }
        })
    }


    get_font_loading_state(): FontLoadingState {
        return this.fontloader!.get_state();
    }


    /* attachTo(), detach() 용도
        textbox 단위의 undo/redo처리시 textbox객체를 삭제하지 않고 history에서 관리하기 위함.
    */
    attachTo(base_node: HTMLElement, callback?: (err: string | null) => void): void {
        this.fontloader!.register_font_loading_state_callback(this.font_loading_state_callback);

        if (this.tbconfig.base_node != null)
            callback && callback('error')
        else {
            this.tbconfig.base_node = base_node;
            this.tbconfig.base_node.appendChild(this.tbconfig.element!);
            if (this.tbconfig.element_textonpath)
                this.tbconfig.base_node.appendChild(this.tbconfig.element_textonpath);
            callback && callback(null);

            this.document_changed({
                cmd: 'attached'
            });
        }
    }


    detach(): void {
        this.fontloader!.unregister_font_loading_state_callback(this.font_loading_state_callback);
        this.remove_doc_change_listener(); // 반드시 기존 listener를 제거해야 함.

        if (this.tbconfig.base_node) {
            var removedChild = this.tbconfig.base_node.removeChild(this.tbconfig.element!);
            if (this.tbconfig.element_textonpath)
                this.tbconfig.base_node.removeChild(this.tbconfig.element_textonpath);
            this.tbconfig.base_node = null;
        }
        this.unmount_resize_observer()
    }


    unmount_resize_observer(): void {
        if (this.resize_sensor != null) {
            if (typeof ResizeObserver == "undefined") {
                (this.resize_sensor as ResizeSensorLike).detach();
            } else {
                (this.resize_sensor as ResizeObserverLike).disconnect();
            }
            this.resize_sensor = null;
        }
    }


    setRenderMode(mode: string): void {
        if (mode != 'html' && mode != 'svg')
            return;
        this.tbconfig.text_render = mode;
        this.tb_schema!.tbconfig.text_render = mode; // 주의할 것.

        this.layout!.do_layout_all();
        this.tbcursor.repaint();
    }


    /*  layout된 내용을 this.tbconfig.mirror_node에 똑같이 보여줌.
        scale만 변형하여 storyboard에 표시하기 위한 용도.
    */
    mirror(opt: MirrorOptions): void {
        this.inout.mirror(opt);
    }



    reset_all(): void {
        this.opEdit.erase(0, 0, this.text_length());
        this.tbcursor.cursor = 0;
        this.reset_history();
    }


    reset_history(): void {
        this.seg_mgr.reset_history();
        this.history.reset();
    }


    scale(val: number): void {
        if (val != this.tbconfig.page.scale) {
            this.tbconfig.page.scale = val;
            TB_Dom.css(this.element, {
                "transform": "scale(" + val + ")",
                "transform-origin": "0 0"
            })

            if (this.text_on_path) {
                this.text_on_path.scale_changed(val);
            }

			if (this.is_state_focused())
				this.tbcursor.repaint();
        }
    }

    angle(val: number): void {
        this.tbconfig.transform.angle = val;
        if (this.text_on_path) {
            this.text_on_path.angle_changed(val);
        }
    }



    get_history_stack_pointer(): number {
        return this.seg_mgr.get_history_stack_pointer();
    }



    loadFromJson(json_str: string, opt?: LoadJsonOptions): Promise<LoadJsonResult> {
        return this.inout.loadFromJson(json_str, opt);
    }

    saveAsJson(opt?: FontEnvOptions): KayakJsonObject {
        return this.inout.saveAsJson(opt);
    }

    snapshotAsSVG(opt?: SnapshotSvgOptions, callback?: SnapshotSvgCallback): string {
        return this.inout.snapshotAsSVG(opt, callback);
    }

    snapshotAsSVGData(opt?: SnapshotSvgOptions): SvgSnapshotData {
        return this.inout.snapshotAsSVGData(opt);
    }

    importFromInDesignJson(json_str: string | IndTextFrame, fonst_list?: FontList | null): IndConvertResult {
        return this.inout.importFromInDesignJson(json_str, fonst_list);
    }

    getBBox(opt?: SnapshotSvgOptions): ContentBBox {
		return this.inout.getBBox(opt);
    }

    snapshotAsSVGInContentBBox(opt?: { padding?: number[] }): ContentBBoxSvg {
		return this.inout.snapshotAsSVGInContentBBox(opt);
    }



    // json_str이 null이면 현재 load되어 있는 tb의 color seglayer를 대상으로 수집한다.
    gather_used_colors(json_str?: string | null): Record<string, UsedColor> {
        return this.inout.gather_used_colors(json_str);
    }


    gather_used_fonts(): Record<string, FontItem> {
            return this.inout.gather_used_fonts();
    }

        // font group의 font list에서 사용된 폰트만 필터한 것을 리턴함
    gather_used_font_list_info(): UsedFontListInfo {
        return this.inout.gather_used_font_list_info();
    }

    get_font_group_id(): string | null {
        return this.fontloader!.get_font_group_id();
    }


    resizeBox(opt: ResizeOption): void {
        this.tbconfig.update_size(opt);

        if (this.initialized) {
            this.layout!.do_layout_all();
            this.tbcursor.repaint(); // 초기 커서 위치 갱신    

            this.document_changed({
                cmd: 'resizeBox'
            });

        } else {
            // throw Error("should be called after initialized.")
            log.warn('called before initialized. Layout and repaint not goint to be called');
        }

    }


    show_gutter(show: boolean): void {
        this.tbconfig.content_elem!.setAttribute("show-gutter", show ? "true" : "false");
    }


    add_doc_change_listener(callback: DocChangeListener | null): void {
        if (callback == null || (this.user_doc_change_listeners as any)[callback as any])   // 원본의 무의미한 검사(항상 거짓)를 그대로 둔다
            return;
        this.user_doc_change_listeners.push(callback);
    }

    remove_doc_change_listener(callback?: DocChangeListener | null): void {
        if (callback == null) {
            this.user_doc_change_listeners.length = 0;
        } else {
            let index = this.user_doc_change_listeners.indexOf(callback);
            if (index != -1)
                this.user_doc_change_listeners.splice(index, 1);
        }
    }


    style_listener(options?: { ime?: boolean; erase_cmd?: boolean } | null): void {
        if (!options || options.ime !== false) {
            // console.log('relocate_ime_box() called');
            this.tbinput!.relocate_ime_box();
        }

        // log.debug('curStyle:', this.curStyle);
        if (options && options.erase_cmd == true) {
            // erase가 되는 경우에는 this.curStyle를 reset하지 않는다. TB_Input의 on_keydown 참고.
            // log.debug('received erase_cmd. curStyle should not be reset.');
            // log.debug('curStyle:', this.curStyle);
        } else
            this.curStyle = {};

        // for user style listener
        this.user_style_listener && this.user_style_listener(this.tbcursor);
    }


    set_user_style_listener(callback: ((cursor: TB_Cursor) => void) | null): void {
        this.user_style_listener = callback;
    }


    set_user_font_listener(callback: FontLoadingStateCallback | null): void {
        this.user_font_listener = callback;
    }


    focus_listener(): void {
        this.user_focus_listener && this.user_focus_listener();
    }


    set_user_focus_listener(callback: (() => void) | null): void {
        this.user_focus_listener = callback;
    }



    set_client_size_listener(callback?: (dim: Dimension) => void): void {
        var self = this;

        this.unmount_resize_observer()
        var t0 = performance.now();


        /*
        	ResizeObserver의 생성시간이 ResizeSensor에 비해 매우 빠름 (대략0.01ms vs 14ms)
        	대략의 textbox생성시 차이가 많이남.
        */
        if (typeof ResizeObserver == "undefined") {
            this.resize_sensor = new ResizeSensor(this.tbconfig.content_elem!, function(val) {
                var dim = self.get_dimension();
                self.tbpreference.on_dimension_changed(dim);
                callback && callback(dim);
                // console.log('resize_sensor dim: ', dim);
            })
        } else {
            this.resize_sensor = new ResizeObserver(entries => {
                var dim = self.get_dimension();
                self.tbpreference.on_dimension_changed(dim);
                callback && callback(dim);
                // console.log('resize_sensor dim: ', dim);			
            })
            this.resize_sensor.observe(this.tbconfig.content_elem!)
        }

        // var t1 = performance.now(); console.log("resize observer consumed: " + (t1 - t0) + " milliseconds.");

    }


    set_keyboard_event_filter(callback: KeyboardEventFilter): void {
        this.user_keyboard_event_filter = callback;
    }


    /*  참고: transform이 적용되어 있으면 self.element의 bbox의 width, height가 리턴됨.

        returns : {
            visible_content_height  # 첫줄의 space_before, 마지막 줄의 (line_space + space_after)를 제외한 height
        }

     */
    get_dimension(): Dimension {
        /*  scrollHeight은 content의 height + padding까지 포함한 높이임.
            content높이 : tb.tbconfig.content_elem.scrollHeight
            .kayak-root element의 높이 : tb.element.scrollHeight (padding을 포함함)

            참고: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight
                 The scrollHeight value is equal to the minimum height the element would require 
                 in order to fit all the content in the viewpoint without using a vertical scrollbar. 
                 It includes the element's padding, but not its border or margin.
            
            element내부에 position:absolute 인 항목이 box영역 바깥에 있으면 그것을 포함하는 크기를
            리턴하므로, 추후 decoration등을 할 때 문제가 있을 수 있다.
            (지금은 눈에 보이지 않는 kayak-input-box의 위치가 dimension에 영향을 미침)
        */

        // method-A. scrollWidth/scrollHeight 방식으로 구하기. 
        /*
        var ret = {
            page_width: this.element.scrollWidth,
            page_height: this.element.scrollHeight
        }
        */

        // method-B.   직접 계산함.
        let visible_content_height = this.layout!.get_tbdom().get_full_height(); // 실제 dom영역이 차지하는 높이
        visible_content_height += this.tbpreference.computed_values.embox_height_offset_px;

        // legacy_181028에는 첫줄의 space_before가 유효한 공간을 가짐.
        if (this.version == 'legacy_181028')
            visible_content_height += this.tbpreference.computed_values.first_line_heading_space;

        let gutter_sum = this.tbconfig.page.gutter_top + this.tbconfig.page.gutter_bottom;
        var ret: Dimension = {
            page_width: this.tbconfig.page.width,
            page_height: 0,
            visible_content_height: visible_content_height,
            overflow: false
        }

        if (this.tbpreference.fit_to_content_height) {
            ret.page_height = visible_content_height + gutter_sum;
        } else {
            ret.page_height = this.tbpreference.frame_height;
        }

        // content overflow check
        let frame_content_height = ret.page_height - gutter_sum;
        if (ret.visible_content_height > frame_content_height)
            ret.overflow = true;

        return ret;
    }


    set_blur(): void {
        this.tbinput && this.tbinput.set_blur();
        this.tbcursor.clear_sel();
    }

    set_select(): void {
        this.tbinput && this.tbinput.set_select();
        this.tbcursor.clear_sel();
    }

    set_focus(event?: MouseEvent): void {
        if (this.is_initialized() == false) {
            log.warn('set_focus() called on not initialized textbox')
            return;
        }
        this.tbinput && this.tbinput.set_focus(event);
    }


    is_state_none(): boolean {
        return this.tbinput!.get_sel_state() == 0;
    }

    is_state_selected(): boolean {
        return this.tbinput!.get_sel_state() == 1;
    }

    is_state_focused(): boolean {
        return this.tbinput!.get_sel_state() == 2;
    }


    text_length(): number {
        return this.text_core.m_text.length;
    }

    getLength(): number {
        return this.text_core.m_text.length;
    }


    select_all_text(): void {
        this.tbcursor.set_selection(0, this.getLength());
    }




    /////////////////////////////////////////////////////
    /**
     * TB_Input.js의 _std_paste()에서 html문자열로 받은 것을 kayak방식으로 해석하여 textbox에 style을 적용한다.
     */
    apply_edit_operation(divs: Element[], fontloader: TB_LocalFontLoader): Promise<number> {
            return TB_ApplyEditOperation.apply_edit_operation(divs, this, fontloader) as Promise<number>;   // text_render가 'svg'/'html'이 아니면 alert 뒤 undefined (issues.md #8). TB_Input._std_paste가 .then()을 쓴다
    }

        /////////////////////////////////////////////////////



    // for test
    get_html(from: number, to: number): void {
        var rng = {
            begin: from,
            end: to
        }
        var str_html_or_svg = (this.docFactory as any).get_rendered_textline(rng);   // 인자가 모자라 TypeError가 난다(테스트용 메서드). issues.md #13
        console.log('html: ', str_html_or_svg);
    }


    get_style_info(ci_doc: number): CurrentStyleInfo {
        //D Layer
        var cur_style: CurrentStyleInfo = {}

        this.seg_mgr.get_style_info(ci_doc, cur_style);

        this.m_Par.getAttr_by_gravity(ci_doc, null, function(style: ATTR_Par) {
            cur_style.align = style.m_Align;
            cur_style.findent = style.m_Findent;
            cur_style.lindent = style.m_Lindent;
            cur_style.rindent = style.m_Rindent;
            cur_style.space_before = style.m_SpaceBefore;
            cur_style.space_after = style.m_SpaceAfter;
            cur_style.line_space = style.m_LineSpace;
            cur_style.leading = style.m_Leading;
        })

        if (this.text_on_path) {
            const state = this.history.get_state();
            cur_style.text_on_path = {
                align_to_path: state.present.tpath.align_to_path,
                flip_path: state.present.tpath.flip_path,
                start_bracket: state.present.tpath.start_bracket,
                end_bracket: state.present.tpath.end_bracket,
            }
        }

        return cur_style;
    }


    /*  ** 외부 history 시스템과 연계할 경우 참고 **
        change_data.cmd중 아래 항목처리시 특별히 유의 할 것.
        - 'undo', 'redo', 
        - 'insert_for_replacing'    <-- ime를 통해 composition update가 발생하고 있는 경우임.
    */
    document_changed(change_data: DocChangeData): void {
        //todo0419 - 아래는 삭제할 것.
        if (this.text_on_path && this.is_initialized() == true) {
            this.text_on_path.update_view(change_data);
        }

		// console.log('document_changed: ', change_data	)
        this.user_doc_change_listeners.forEach(callback => callback(change_data))
    }


    /* 
        opt {
            avoid_shrink : boolean,
            extra_margin : number (unit:pixel) fit 했지만 재수없게 line-break생기는 것을 방지하기 위한 것.
        }
    */
    fit_width_to_first_paragraph(opt?: { avoid_shrink?: boolean; extra_margin?: number }): void {
        // console.log(this.layout.get_tbdom().pars[0].lines);
        // console.log(this.m_Par.getAttr(0));

        let lines = this.layout!.get_tbdom().pars[0].lines;
        let parAttr = this.m_Par.getAttr(0)!;

        let w = lines.reduce((ctx, line) => ctx + line.content_width, 0);
        w += parAttr.m_Findent + parAttr.m_Lindent + parAttr.m_Rindent;

        // apply extra_margin
        if (opt && opt.extra_margin)
            w += opt.extra_margin;
        else
            w += 1; // 기본적으로 1pixel 만큼은 적용.

        // apply avoid_shrink
        if (opt && opt.avoid_shrink && (w < this.tbconfig.content.width)) {
            return;
        }

        let gap = this.tbconfig.page.width - this.tbconfig.content.width;

        var resize_opt: ResizeOption = {
            content: {
                width: w
            },
            page: {
                width: w + gap
            }
        }
        this.resizeBox(resize_opt);
    }



    layout_each_paragraph_in_a_single_line(opt?: { respect_segments_letter_scale?: boolean }): void {
        this.format_service.layout_first_paragraph_in_a_single_line(opt);
    }


    /* shrink font-size to fit page_height
    	조건
    	- paragraph가 1개 이어야 함. 
    	- "fit to content height" mode가 false인 경우 적용됨.
    	  (이 모드상에서만 content height가 page height보다 클 수 가 있기 때문임)
    	
    	목적
    	- font-size가 커서 page height를 넘어 가는 경우 font-size를 줄여 높이에 맞춤
    	- vertical align이 "center"인 경우에 효과적임.
    */
    shrink_font_size_to_fit_to_page_height(): void {
        if (this.tbpreference.fit_to_content_height == true)
            return;

        let bbox_info = this.layout!.get_tbdom().get_first_line_bbox_info();

        let dim = this.get_dimension();
        if (dim.page_height >= bbox_info.effective_height)
            return;

        // 첫줄 font-size를 얻기
        let shrink_ratio = dim.page_height / bbox_info.effective_height;
        let shrinked_font_size = (bbox_info.max_font_size_px * shrink_ratio) * (72 / 96)

        // 줄인 font-size를 적용
        var sel = this.tbcursor.sel_all();
        this.opStyle.set_font_size(shrinked_font_size, sel);
    }


    
    replace_font_color(opt: Parameters<TB_FormatService['replace_font_color']>[0]): void {
        this.format_service.replace_font_color(opt);
    }


    clamp_font_size(max_font_size: number): void {
		this.format_service.clamp_font_size(max_font_size)
    }


    replace_text_with_range_id(id: string, text: string): void {
		this.format_service.replace_text_with_range_id(id, text)
    }

    get_text_by_range_id(id: string): ReturnType<TB_FormatService['get_text_by_range_id']> {
		return this.format_service.get_text_by_range_id(id)
    }

    get_array_of_ranges(): ReturnType<TB_FormatService['get_array_of_ranges']> {
		return this.format_service.get_array_of_ranges()
    }
}





/* 
    파일에서 commonjs 방식의 require()와 es6의 import를 같이 사용한 경우
    export는 es6방식으로만 가능하다. (안그러면 이상한 error남)
    entery.js파일도 참고할 것.

    (x) module.exports = textbox;
    (o) export default textbox
*/
export default textbox