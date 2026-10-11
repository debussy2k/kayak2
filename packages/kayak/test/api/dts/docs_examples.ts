/*
    docs/usage/*.md의 TypeScript 예제를 dist/m1textbox.d.ts에 대고 컴파일한다 (npm run check_types_dist).
    공개 API가 바뀌어 여기가 깨지면 해당 문서의 예제도 같이 고친다.
    문서 밖의 값(툴바, 호스트 undo 스택 등)은 declare로 대신한다.
*/
import { textbox, GT_MasterClipboard, spFontManager, TB_InDesignJsonConverter, TB_FontSizeStepUtil, MeasureDiv } from '../../../dist/m1textbox';

declare const toolbar: { update(v: Record<string, unknown>): void };
declare const host_history: { undo(): void; redo(): void; push(step: { undo(): void; redo(): void }): void };
declare const textarea: { value: string };
declare const warning: { hidden: boolean };
declare const ind_json_str: string;

// ---- 01-getting-started.md: 최소 예제 ----
const tb = new textbox({
    page:    { width: 400, height: 200, gutter_top: 0, gutter_bottom: 0, scale: 1 },
    content: { width: 380, default_font_size: 18, default_align: 'left',
               default_font_color: { rgb: 'black', cmyk: [0, 0, 0, 100] } },
    masterClipboard: GT_MasterClipboard.getInstance(),
});

tb.set_user_font_listener(state => console.log('font', state));

tb.init().then(() => {
    tb.attachTo(document.getElementById('box')!);
    tb.add_doc_change_listener(e => console.log('changed:', e.cmd));
    tb.opEdit.insert_string(0, 'Hello Kayak');
    tb.set_focus();
});

// ---- 02-config.md: text-on-path ----
const tp = new textbox({
    schema: false,
    page: { width: 600, height: 300, gutter_top: 0, gutter_bottom: 0, scale: 1 },
    content: { width: 600, default_font_size: 18, default_align: 'left', default_font_color: { rgb: 'black', cmyk: [0, 0, 0, 100] } },
    masterClipboard: GT_MasterClipboard.getInstance(),
    text_on_path: {
        svg_path_data: 'M 50 150 C 150 80, 200 80, 250 150',
        align_to_path: 'baseline',
        flip_path: false,
    },
});
void tp;

// ---- 02-config.md: schema 모드 ----
const font_list = spFontManager._get_font_list('default-host-ko');
const s = new textbox({ schema: true, masterClipboard: GT_MasterClipboard.getInstance() });
s.init().then(() => {
    s.opEdit.insert_string(0, 'Hello');
    s.opStyle.set_font_size(24, { begin: 0, end: 5 });
    const json = s.saveAsJson({ font_list });
    void json;
});

// ---- 04-editing-and-style.md ----
{
    const len = tb.text_length();
    tb.opEdit.erase(0, 0, len);
    tb.opEdit.insert_multiline_string(0, 'line 1\nline 2');
    tb.opEdit.undo();

    const sel = tb.tbcursor.sel_by_rule();
    tb.opStyle.set_fontColor('#ff0000', [0, 100, 100, 0], null, sel);
    tb.opStyle.set_fontColor('#0072bc', [100, 43, 0, 0], { type: 'SPOT', name: 'PANTONE 300 C' }, sel);

    tb.opStyle.set_stroke({ weight: 1, align: 'outside', color: '#000000', join: 'round' }, sel);
    tb.opStyle.set_shadow({ size: 0.5, angle: 135, distance: 1, opacity: 60, color: '#000000' }, sel);

    tb.opStyle.set_range_id('customer_name', '고객 이름', { begin: 5, end: 9 });
    tb.replace_text_with_range_id('customer_name', 'Alexander');
}

// ---- 05-helpers.md ----
spFontManager.set_font_groups_list({
    'my-fonts': {
        font_list: {
            'Noto Sans KR': {
                family: { locale: { en: 'Noto Sans KR', kr: '본고딕' } },
                style: {
                    'Regular': {
                        url: 'https://example.com/NotoSansKR-Regular.woff',
                        issue: '001',
                        locale: { en: 'Regular', kr: '보통' },
                        default: true,
                    },
                },
            },
        },
    },
});

{
    const conv = new TB_InDesignJsonConverter({
        src_unit: 'mm',
        font_list: spFontManager._get_font_list('default-host-ko'),
    });
    const r = conv.load_json(ind_json_str);
    const w: number = r.dim_px.width;
    const remapped: boolean = r.font_family_remap_occurred;
    void w; void remapped;
}

{
    const steps = new TB_FontSizeStepUtil();
    steps.upper_font_size(10);
    steps.lower_font_size(10);
    steps.upper_font_size(13);
}

MeasureDiv.Instance().show(true);

// ---- 06-recipes.md: 툴바 연결 ----
tb.set_user_style_listener(cursor => {
    const style = tb.get_style_info(cursor.cursor);
    toolbar.update({
        family: style.familyName, style: style.typeStyle,
        size: style.FontSize, color: style.fontColor, align: style.align,
    });
});

function on_font_size(pt: number) {
    tb.opStyle.set_font_size(pt, tb.tbcursor.sel_by_rule());
}
function on_align(code: string) {
    tb.opStyle.set_text_align(code, tb.tbcursor.sel_by_rule());
}
async function on_font(family: string, style: string) {
    await tb.opStyle.set_font_family(family, style, tb.tbcursor.sel_by_rule());
}
void on_font_size; void on_align; void on_font;

// ---- 06-recipes.md: 호스트 undo와 연동 ----
tb.set_keyboard_event_filter(e => {
    if (e.ctrlKey && (e.key === 'z' || e.key === 'y')) {
        e.preventDefault();
        e.key === 'z' ? host_history.undo() : host_history.redo();
        return true;
    }
    return false;
});

tb.add_doc_change_listener(e => {
    if (e.replacing) return;
    if (e.cmd === 'undo' || e.cmd === 'redo') return;
    if (e.cmd === 'initialized' || e.cmd === 'attached' || e.cmd === 'loadFromJson') return;
    host_history.push({
        undo: () => tb.opEdit.undo(),
        redo: () => tb.opEdit.redo(),
    });
});

// ---- 06-recipes.md: 외부에서 넣은 변경 구분하기 ----
function set_text_from_outside(text: string) {
    const opt = { user_data: { from_host: true } };
    tb.opEdit.erase(0, 0, tb.text_length(), null, opt);
    tb.opEdit.insert_multiline_string(0, text, null, opt);
}
void set_text_from_outside;

tb.add_doc_change_listener(e => {
    if (e.user_data && e.user_data.from_host) return;
    textarea.value = tb.saveAsJson().text_raw!.replace(/\n$/, '');
});

// ---- 06-recipes.md: 고정 높이 박스와 넘침 확인 ----
tb.opStyle.set_fit_to_content_height(false);
tb.opStyle.set_frame_height(120);
tb.opStyle.set_vertical_align('center');
tb.set_client_size_listener(dim => {
    warning.hidden = !dim.overflow;
});
tb.shrink_font_size_to_fit_to_page_height();
tb.layout_each_paragraph_in_a_single_line();

// ---- 06-recipes.md: 가변 데이터 템플릿 ----
{
    tb.opEdit.insert_string(0, 'Dear NAME,');
    tb.opStyle.set_range_id('name', '받는 사람', { begin: 5, end: 9 });
    const template = JSON.stringify(tb.saveAsJson());

    tb.loadFromJson(template).then(() => {
        tb.replace_text_with_range_id('name', 'Alexander');
        const svg: string = tb.snapshotAsSVG();
        void svg;
    });
}

// ---- 06-recipes.md: InDesign JSON 가져오기 ----
async function import_ind() {
    const r = tb.importFromInDesignJson(ind_json_str);
    tb.resizeBox({ content: { width: r.dim_px.width }, page: { width: r.dim_px.width } });
    await tb.loadFromJson(JSON.stringify(r.kayak_json));
    if (r.font_family_remap_occurred) console.log('폰트 이름을 폰트 목록에 맞게 바꿨다');
}
void import_ind;

// ---- 03-textbox-api.md: 이름이 나온 메서드들의 반환 타입 ----
{
    const bbox = tb.getBBox();
    const w: number = bbox.w;
    const cut = tb.snapshotAsSVGInContentBBox({ padding: [4, 4, 4, 4] });
    const svg_str: string = cut.svg_str;
    const ranges = tb.get_array_of_ranges();
    const first: string = ranges[0].var_name;
    const got = tb.get_text_by_range_id('name');
    const text: string | undefined = got && got.text;
    const fonts = tb.gather_used_font_list_info();
    const unresolved: string[] = fonts.unresolved_fonts;
    tb.snapshotAsSVG({ shadow_as_image: true }, (shadow_info_arr, frame) => { void shadow_info_arr; void frame.frame_width; });
    tb.mirror({ node: document.body, scale: 0.5, enable_debounce: true });
    tb.replace_font_color([{ src: { fontColor: '#ff0000' }, dst: { fontColor: '#0000ff', fontColorCMYK: [100, 100, 0, 0], fontColorModel: null } }]);
    tb.clamp_font_size(72);
    tb.fit_width_to_first_paragraph({ avoid_shrink: true, extra_margin: 2 });
    void w; void svg_str; void first; void text; void unresolved;
}
