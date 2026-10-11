/*
    src/textbox 공용 타입. 값은 없고 타입만 있다.
*/
import type { ShadowSpec, StrokeSpec, GradientSpec, CommandChangeInfo, StyleInfo, ColorModel } from '../segment/types';
import type { TextOnPathSaveData } from '../geometry/types';
import type { Font, Path } from 'opentype.js';
import type { TBLocator, DomLine } from './TextBoxDom';
import type textbox from './TextBox';

/** TextBox 인스턴스 (src/textbox/TextBox.ts의 class). 4b에서 실타입이 되었다. geometry/types.ts도 이것을 재export한다. */
export type TextBoxHost = textbox;

/* ---- 폰트 ---- */

export interface FontItem { familyName: string; typeStyle: string }
/** TB_LocalFontLoader.load_fonts()의 항목. url/issue가 없으면 폰트 목록에서 찾는다. */
export interface FontLoadItem extends FontItem { url?: string | null; issue?: string | null }
export interface FontStyleEntry {
    url: string;
    issue: string;
    locale: Record<string, string>;
    default?: boolean;
    lang?: string[];
    font_prv_url?: string;
    full_name?: string;      // 19.2.28 이후 폰트 목록. TB_InDesignJsonConverter.remap_font_family가 본다
}
export interface FontFamilyEntry {
    family: { locale: Record<string, string>; postscriptName?: string };
    style: Record<string, FontStyleEntry>;
}
export type FontList = Record<string, FontFamilyEntry>;
export interface FontGroup { font_list: FontList }
/** TB_FontRscList.font_rsc_list 와 spFontManager.font_groups_list 의 모양. key는 font_list_id */
export type FontGroupsList = Record<string, FontGroup>;

export type FontLoadingState = 'loaded' | 'loading' | 'failed';
export type FontLoadingStateCallback = (state: FontLoadingState) => void;
/** FontManager._get_font_rsc_url 콜백 */
export type FontResourceUrlCallback = (err: string | null, url?: string | null, issue?: string | null, alternative_font_family?: string | null, alternative_type_style?: string | null) => void;
/** FontManager.font_loader_by_platform / load_and_parse 콜백 */
export type FontLoadCallback = (err: any, font?: Font | null) => void;
/** TB_PlatformEnv.get_font_filepath (node 환경에서 호스트가 주입). 인자가 모두 null이면 기본 폰트 요청 */
export type GetFontFilepath = (font_url: string | null, font_issue: string | null, font_key_name: string | null, download_folder: string | null, cb: (err: any, font_file_path: string) => void) => void;
/** fs.readFile과 같은 모양. node 타입(NodeJS.ErrnoException, Buffer)을 공개 d.ts에 내지 않으려고 Error/Uint8Array로 적는다 (Buffer는 Uint8Array다) */
export type FsReadFile = (path: string, cb: (err: Error | null, data: Uint8Array) => void) => void;

/** TB_PlatformEnv.set()의 인자 */
export interface PlatformEnvInit {
    window: Window & typeof globalThis;
    get_font_filepath?: GetFontFilepath | null;
    delete_downloaded_font_file?: ((font_key_name: string, download_folder: string) => Promise<unknown>) | null;
    fsReadFile?: (() => FsReadFile) | null;
}

/* ---- 설정 ---- */

export interface PageConfig { width: number; height: number; gutter_top: number; gutter_bottom: number; scale: number }
export interface ContentConfig {
    width: number;
    default_font_size: number;
    default_align: string;
    default_font_color: { rgb: string; cmyk: number[] };
}
export interface DebugConfig { show_linebox: boolean; show_textonpath_bbox: boolean; show_line_gutter: boolean }
/** new textbox(options) / new TB_Config(options, pref)의 options. 나머지 키는 Object.assign으로 그대로 복사된다. */
export interface TB_ConfigOptions {
    schema?: boolean;
    mode?: string;
    base_node?: HTMLElement | null;
    page?: Partial<PageConfig>;
    content?: Partial<ContentConfig>;
    font_list_id?: string | null;
    node_env?: { base_folder_for_download?: string };
    masterClipboard?: any;
    text_on_path?: any;
    debug?: Partial<DebugConfig>;
    [key: string]: any;
}
/** TB_Config.update_size(opt) / TextBox.resizeBox(opt) */
export interface ResizeOption { content: { width: number }; page: { width: number } }
/** TB_Preference.save()/apply() */
export interface PreferenceData {
    single_line_mode: boolean;
    fit_to_line_width_by_scale_x: boolean;
    first_line_baseline_offset: string;
    fit_to_content_height: boolean;
    vertical_justification: string;
    frame_height: number;
}

/* ---- 스타일/렌더 ---- */

/** seg_mgr.extract_styles_*()가 만드는 스타일 구간. pos 외 속성은 레이어마다 다르다. */
export interface StyleEntry {
    pos: number;
    familyName?: string;
    typeStyle?: string;
    start_of_par?: boolean;
    par?: any;
    letter_scale_x?: number;
    [key: string]: any;
}
/** TB_TextFxService.generate_svg_path_string()의 svg_paths 항목 (TB_SvgLineFactory가 만든다) */
export interface SvgPathEntry {
    d: string;
    fill?: string;
    gradient?: GradientSpec | Record<string, any>;
    stroke?: StrokeSpec;
    shadow?: ShadowSpec;
    [key: string]: any;
}
export interface TextFxOptions {
    override_fill_color?: { fill: string; transparent_by_src_color?: string[] };
    shadow_as_image?: boolean;
    relative_path?: string;
}
export interface ShadowGeom { size_grow: number; anchor_offset_x: number; anchor_offset_y: number }
export interface TextFxResult {
    svg_string: string;
    shadow_info_arr: { shadow_name: string; svg_path: SvgPathEntry; shadow_dim: { width: number; height: number } }[];
}
/** TB_JustificationService: (font-size, letter-space, letter-scale-x)가 같은 글리프 묶음 */
export interface JstfStyleKey { width: number; count: number; balance_space_ratio?: number }
export type JstfBalanceInfo = Record<string, JstfStyleKey>;

/** TB_LayoutAux.get_pars_text_arr() 항목 */
export interface ParTextObject { par_text: string; ci_doc: number }
export interface CiRange { begin: number; end: number }
/** TB_ExportHtml.generate_html_for_export 옵션 */
export interface ExportHtmlOptions { keep_cr?: boolean; include_html_data?: boolean; for_clipbaord_export?: boolean }
/** TB_Utils.get_browser_info() */
export interface BrowserInfo { name: 'ie' | 'safari_mac' | 'safari_ios' | 'chrome'; version: number }
/** TB_HtmlMeasure.measure_html_dimension() */
export interface HtmlDimension { width: number; last_glyph_white_space: number; height: number; ascent: number; descent: number }

/* ---- 3b: 편집/입력/렌더 ---- */

/** TB_Cursor.sel()/sel_by_rule()/sel_all() */
export interface SelInfo { cursor: number; begin: number; end: number; exists_range: boolean; empty_originally?: boolean }
/** TB_LocationFinder.find_cursor_location_by_ci()의 결과 (TB_LocationFinder는 4단계) */
export interface CursorLocationInfo {
    x_pos: number; y_pos: number; height: number; ascent: number; descent: number;
    max_word_ascent: number; max_word_descent: number; max_word_height: number;
    location: TBLocator;
}
/** TextBox_Edit의 편집 명령에 넘기는 콜백 */
export type ParChangedCallback = (err: any, text_change_info?: any, par_change_info?: any) => void;

/* IME */
export type ImeCmd = 'insert' | 'replace' | 'delete' | null | undefined;
/** TB_NormalizedIME.ime_ctx — ime/* 리스너가 상태를 저장하는 곳 */
export interface ImeContext {
    inp_box: HTMLElement;
    inp: HTMLElement;
    isComposing: boolean;
    composing: string;
    composed: string;
    last_composing_state: string | null;
    focus_blurred: boolean;
    need_clear_text: boolean;
    dom_str_new: string;
    dom_str_prev: string;
    key_pressed: boolean;
    key_pressed_keyCode: number | null;
    last_event: string;
}
/** TB_Keyboard.init_ime()가 만드는 options. ime/* 리스너는 이것만 호출한다. */
export interface ImeOptions {
    kbd_input_box: HTMLElement;
    kbd_input: HTMLElement;
    flag_composition_start: boolean;
    composition_start(): void;
    composing_word(word: string, cmd?: ImeCmd): void;
    composed_word(word: string, cmd?: ImeCmd): void;
    keydown(e: KeyboardEvent): void;
    keyup(e: KeyboardEvent): void;
    on_copy(e: ClipboardEvent): void;
    on_cut(e: ClipboardEvent): void;
    on_beforepaste(e: Event): void;
    on_paste(e: ClipboardEvent): void;
    kbd_listener(e: Event): void;
    log(str: string): void;
    log_norm(str: string): void;
}
/** ime/TB_Ime_*.js의 모양. e는 브라우저마다 다른 속성(data, char, key…)을 쓰므로 any */
export type ImeListener = (e: any, ime_ctx: ImeContext, options: ImeOptions) => void;
/** TB_Keyboard.focus(target)의 target — TB_Input이 만드는 options 객체 */
export interface KeyboardTarget {
    textbox: TextBoxHost;
    on_insert_word(word: string, cmd: ImeCmd): void;
    on_remove_by_ime_backspace(): void;
    on_keydown(e: KeyboardEvent): void;
    on_keyup(e: KeyboardEvent): void;
    on_copy(e: ClipboardEvent): void;
    on_cut(e: ClipboardEvent): void;
    on_beforepaste(e: Event): void;
    on_paste(e: ClipboardEvent): void;
}

/* SVG 렌더 */
/** TB_SvgTextRender가 받는 style. seg_mgr 스타일(StyleEntry)에 kerning/ligature가 합쳐진 것 */
export interface RenderStyle {
    FontSize: number;
    letter_space: number;
    letter_scale_x: number;
    kerning: boolean;
    ligature: boolean;
    [key: string]: any;
}
export interface FontContext {
    font: Font;
    align?: string | null;
    domLine?: DomLine;
    textRng?: TextLineRange;
    text_on_path?: boolean;
}
export interface TextLineRange { begin: number; end: number; ci_lbegin_doc?: number; ci_lend_doc?: number }
export interface GlyphBox { full_width: number; glyph_width: number; space_width: number }
export interface GlyphMeasured { width_px: number; last_glyph_width: number; last_glyph_white_space: number }
/** TB_SvgTextRender.getGlyphsDimension() → TB_RangeMetric.set_with_dimension() */
export interface GlyphDimension {
    key: string | null;
    count: number;
    width: number;
    last_glyph_width: number;
    last_glyph_white_space: number;
    height: number;
}
/** text-on-path용 글리프 하나 (TB_TextOnPath_Draw가 쓴다) */
export interface SvgGlyphItem {
    glyphPath: Path; gx: number; gy: number; glyph_width: number; ascender: number; descender: number;
    fontColor: string; fontColorCMYK: string; fontColorModel?: any;
}
export interface SvgPathGlyphsResult { glyphs_path: Path; glyph_arr: SvgGlyphItem[]; width_px: number; last_glyph_white_space: number }
/** TB_SvgLineFactory.calc_max_metrics() */
export interface LineMaxMetrics { max_ascender: number; max_ascender_d: number; max_height: number; max_font_size_px: number; embox_height_offset: number }
/** TB_SvgLineFactory.get_svg_textline() / TB_DocFactory.get_rendered_textline() */
export interface SvgTextLine { line_content: string; metrics: LineMaxMetrics; svg_paths: SvgPathEntry[]; svg_glyph_arr: SvgGlyphItem[]; width: number }
/** TB_WordFetch.build_word() → TB_LineMetric.measure_by_adding_word() */
export interface BuiltWord {
    text: string; width: number; last_glyph_white_space: number; height: number;
    ascent: number; ascent_d: number; descent: number; max_font_size_px: number; whiteSpace: boolean;
}
/** TB_DocFactory.create_line_view_obj() */
export interface LineViewObj { line_view: HTMLElement; gutter: HTMLElement; linespace_top: HTMLElement; line: HTMLElement }
/** TB_RangeMetric.style_keys의 값 (JstfStyleKey와 같은 모양, balance_space_ratio 없음) */
export interface StyleKeyGroup { width: number; count: number }
/** TB_ApplyEditOperation이 쓰는 선택 구간 */
export interface EditSel { begin: number; end: number }

/* ---- 4a: 레이아웃/문서 모델 ---- */

/** TextBox_Edit/Style이 TB_Layout.do_layout()에 넘기는 것: seglayer_par의 CommandChangeInfo에 변화 위치를 덧붙인 것 */
export interface LayoutChangeInfo extends CommandChangeInfo { ci_change_start: number; ci_change_end?: number }
/** TB_LayoutWalker.traverse_by_line() 반환값 */
export interface FrameSize { frame_width: number; frame_height: number }
/** TB_LocationFinder.find_cursor_location_by_mouse_point() / find_cursor_location_by_line_num() 결과 */
export interface MouseLocationInfo { x_mouse: number; li_doc: number; ci_doc: number; ci_line: number; x_pos: number; y_pos: number; max_word_height: number }
export interface MouseLocationOptions { find_outof_box?: boolean; find_pos_to_line_end?: boolean }
/** TextBox_InOut.snapshotAsSVGData() 결과 (inout/inout.ts가 받는다) */
export interface SvgPathInfoItem { x: number; y: number; svg_paths: SvgPathEntry[] }
export interface SvgSnapshotData {
    frame_width: number;
    frame_height: number;
    svg_path_info: SvgPathInfoItem[];
    viewbox_offset?: { x: number; y: number };
    bbox?: { w: number; h: number };
}
/** inout.getBBoxFromSvgDPath() 결과 */
export interface PathBBox { x: number; y: number; width: number; height: number }
/** SVG path의 transform 항목. text-on-path의 글리프 path가 가진다 (geometry/types.ts의 SvgGlyphPath 참고) */
export interface PathTransform { translate?: { x: number; y: number }; rotate?: { a: number; cx: number; cy: number } }
/** Textbox_Verify.run()/check_*()의 옵션과 결과 */
export interface VerifyOptions { try_fix?: boolean; tb?: { get_default_font(): FontItem } }
export interface VerifyResult {
    code: 'pass' | 'fail';
    error_message?: string;
    message?: string;              // check_ATTR_is_empty만 이 이름을 쓴다
    text_raw?: string;
    text_length?: number;
    data?: { attr: string; sum: number }[];
    fonts_unresolved?: string[];
    testcase_unresolved_fonts?: VerifyResult;
    testcase_ATTR_Count?: VerifyResult;
}
/** kayak JSON (saveAsJson 결과 / loadFromJson 입력). ATTR_* 키는 seglayer 데이터 객체 배열 */
export interface KayakJsonObject {
    version?: string;
    meta?: { linebreak_tolerance?: number };
    preference?: PreferenceData;
    text_arr: number[];
    text_raw?: string;
    font_used?: Record<string, { family?: any; style: Record<string, { url?: string; issue?: string; default?: boolean }> }>;
    fonts_unresolved?: string[];
    text_on_path?: TextOnPathSaveData;
    ATTR_Doc?: { m_nCount: number; fit_to_content_height: boolean; vertical_align: string; frame_height: number }[];
    [key: string]: any;   // ATTR_Par, ATTR_FontFamily … (각 레이어의 getDataObject() 배열)
}

/* ---- 4b: TextBox 공개 API ---- */

/** TextBox.document_changed()가 리스너에 넘기는 것 */
export interface DocChangeData { cmd: string; replacing?: boolean; user_data?: any }
export type DocChangeListener = (change_data: DocChangeData) => void;
/** TextBox.set_keyboard_event_filter(). true를 돌려주면 TB_Input이 키 입력을 더 처리하지 않는다 */
export type KeyboardEventFilter = (event: KeyboardEvent) => boolean | void;
/** TextBox.get_dimension() */
export interface Dimension { page_width: number; page_height: number; visible_content_height: number; overflow: boolean }
/** TextBox.get_style_info(): seg_mgr.get_style_info()가 채운 StyleInfo에 문단/text-on-path 값을 더한 것 */
export interface CurrentStyleInfo extends StyleInfo {
    align?: string; findent?: number; lindent?: number; rindent?: number;
    space_before?: number; space_after?: number; line_space?: number; leading?: 'auto' | number;
    text_on_path?: { align_to_path: string; flip_path: boolean; start_bracket: number; end_bracket: number };
}
/** css-element-queries의 ResizeSensor (ResizeObserver가 없는 브라우저용). 타입 선언이 없어 쓰는 메서드만 적는다 */
export interface ResizeSensorLike { detach(): void }
/** ResizeObserver 중 쓰는 메서드. 공개 d.ts에서 DOM lib의 ResizeObserver(TS 4.2+)를 참조하지 않으려고 구조 타입으로 적는다 (Edicus는 TS 3.8) */
export interface ResizeObserverLike { observe(target: Element): void; disconnect(): void }

/* TextBox_Edit / TextBox_Style */
/** insert/insert_string/erase의 opt. reset은 insert_string에서만 본다 */
export interface EditOptions { replace?: boolean; user_data?: any; reset?: boolean }
/** undo/redo의 opt */
export interface UndoOptions { dont_select_range?: boolean; undo_for_replace?: boolean }
/** TextBox_Style.set_*가 받는 선택 구간: TB_Cursor.sel()(SelInfo) 또는 {begin, end}(TB_InDesignJsonConverter) */
export interface StyleSel { begin: number; end: number; exists_range?: boolean; cursor?: number }
/** set_font_size/set_fontColor/set_letter_scale_x의 opt. seg_mgr.set()에 그대로 넘어가고 skip_post_process는 set_letter_scale_x만 본다 */
export interface StyleSetOptions { command_auto_play?: string; skip_post_process?: boolean }

/* TextBox_InOut */
export interface LoadJsonOptions { remove_textonpath_if_already_exist?: boolean; ignore_text_on_path?: boolean }
export interface LoadJsonResult { verify_result?: VerifyResult; default_font_used?: boolean; warning?: string }
/** saveAsJson()/gather_used_font_list_info()의 opt */
export interface FontEnvOptions { font_list?: FontList | null }
/** _get_used_fonts_set() 항목 (kayak JSON의 font_used에서 모은 것) */
export interface UsedFontItem extends FontLoadItem { default?: boolean }
export interface UsedFontListInfo {
    used_fonts: Record<string, { family: FontFamilyEntry['family']; style: Record<string, FontStyleEntry> }>;
    unresolved_fonts: string[];
}
export interface UsedColor { rgb: string; cmyk: number[] | string }   // InDesign 변환·clipboard HTML은 문자열을 넣는다 (issues.md #16)
/** snapshotAsSVG*()/getBBox() 옵션. geometry/types.ts의 SvgRenderOptions와 TextFxOptions를 모두 담는다 */
export interface SnapshotSvgOptions {
    path_only?: boolean;
    shadow_as_image?: boolean;
    cropbox?: { x: number; y: number; w: number; h: number };
    padding?: number[];   // [left, top, right, bottom]
    viewbox_offset?: { x: number; y: number };
    fix_20210402?: boolean;
    render_master_color_only?: { fill: string };
    override_fill_color?: { fill: string; fill_cmyk?: any; transparent_by_src_color?: string[] };
    relative_path?: string;
}
/** snapshotAsSVG()의 callback (opt.shadow_as_image일 때만 의미 있다) */
export type SnapshotSvgCallback = (shadow_info_arr: TextFxResult['shadow_info_arr'], frame: FrameSize) => void;
export interface ContentBBox { min_x: number; min_y: number; max_x: number; max_y: number; w: number; h: number }
export interface ContentBBoxSvg { bbox: ContentBBox; padded_box: { x: number; y: number; w: number; h: number }; svg_str: string }
export interface SvgInBoxResult { svg_str: string; frame: { w: number; h: number }; viewbox_offset: { x: number; y: number }; bbox: { w: number; h: number } }
export interface MirrorOptions { node: HTMLElement; scale?: number; enable_debounce?: boolean }

/* TB_InDesignJsonConverter (InDesign 스크립트가 내보낸 JSON) */
export interface IndColor {
    rgb_color?: number[]; src_color?: number[]; src_color_space?: string; model?: ColorModel;
    gradientType?: string; gradientStops?: { location: number; stopColor: IndColor }[];
    [key: string]: any;
}
export interface IndTextObject {
    contents: string; font_family: string; font_style: string; font_size: number; postscriptName?: string | null;
    kerning?: string; tracking: number; h_scale: number; justification: string;
    first_indent: number; left_indent: number; right_indent: number; space_before: number; space_after: number;
    auto_leading: number; leading?: string | number;
    fill_color: IndColor; gradient_fill?: { start: number[]; length: number; angle: number };
    stroke_weight?: number; stroke_color?: IndColor | null; stroke_alignment?: string; stroke_endjoin?: string; stroke_miterlimit?: number;
    dropShadow?: { color: IndColor; size: number; angle: number; distance: number; opacity: number };
    [key: string]: any;
}
export interface IndTextPath { text_list: IndTextObject[]; flip_path_effect?: string; text_alignment?: string; start_bracket?: number | null; end_bracket?: number | null }
export interface IndFramePreferences { autoSizingType: string; verticalJustification?: string }
export interface IndTextFrame {
    type: string;
    frame: { origin?: { x: number; y: number }; size: { width: number; height: number } };
    text_list?: IndTextObject[];
    text_paths?: IndTextPath[];
    paths?: any;
    textFramePreferences?: IndFramePreferences;
    [key: string]: any;
}
export interface IndConvertOptions { src_unit: 'mm' | 'indesign_px'; font_list: FontList | null }
export interface IndConvertResult { kayak_json: KayakJsonObject; dim_px: { width: number; height: number }; font_family_remap_occurred: boolean }
/** _parse_indesign_solid_color()/parse_indesign_color() 결과. 원본대로 cmyk는 '100,0,0,0' 문자열, gradient의 geom은 '50%' 문자열 (issues.md #16) */
export interface IndParsedColor { rgb: string | Record<string, any>; cmyk?: string; cmyk_arr?: number[]; model?: ColorModel }
/** _parse_indesign_solid_color() 결과 (rgb가 '#rrggbb' 문자열) */
export interface IndParsedSolidColor extends IndParsedColor { rgb: string }
/** parse_dropShadow() 결과. dropShadow가 없으면 키가 `shadow`, 있으면 `color`이고 size/distance는 toFixed(2) 문자열 (원본 그대로, issues.md #16) */
export interface IndParsedShadow { size: number | string; angle: number; distance: number | string; opacity: number; color?: string; shadow?: string }
