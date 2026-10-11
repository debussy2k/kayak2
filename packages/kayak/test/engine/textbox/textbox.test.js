/*
    TextBox(src/engine/textbox/TextBox.ts) 특성 테스트. 생성 모드별 필드, 초기화, 리스너, 치수, 크기 맞춤, 상태, 위임 메서드를 고정한다.
    set_client_size_listener()는 vitest(SSR)에서 css-element-queries ResizeSensor의 default import가 생성자가 아니라 부를 수 없다 — unmount만 가짜 sensor로 고정한다.
    get_html()은 docFactory.get_rendered_textline()를 인자 하나로 불러 TypeError가 난다 (issues.md #13) — 테스트하지 않는다.
*/
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { create_textbox, destroy_textbox } from '../../snapshot/helpers';
import * as M1TextBox from '../../../src/node';
import GT_MasterClipboard from '../../../src/engine/segment/master_clipboard';
import { spFontManager } from '../../../src/engine/textbox/TB_FontManager';
import _g from '../../../src/engine/textbox/TB_PlatformEnv';

const CIRCLE = 'M100, 200 C 155, 200, 200, 155, 200, 100 C 200, 45, 155, 0, 100, 0 C 45, 0, 0, 45, 0, 100 C 0, 155, 45, 200, 100, 200 Z';
const FIELDS = ['version', 'env', 'tbcontext', 'tbpreference', 'tbconfig', 'fontloader', 'element', 'seg_mgr', 'docFactory', 'layout', 'tbinput', 'tbcursor',
    'user_doc_change_listeners', 'user_style_listener', 'user_font_listener', 'user_focus_listener', 'client_size_listener', 'resize_sensor', 'tb_schema',
    'curStyle', 'opEdit', 'opStyle', 'inout', 'history', 'text_on_path', 'format_service',
    'text_core', 'm_Par', 'm_DocLayer', 'm_FFamilyLayer', 'm_FSizeLayer', 'm_Bold', 'm_FontColor', 'm_LetterSpacing', 'm_LetterScaleX', 'm_Stroke', 'm_Shadow', 'm_NamedRange'];

let tb;
beforeEach(async () => { tb = await create_textbox(); });
afterEach(() => destroy_textbox(tb));

describe('TextBox 생성/초기화', () => {
    it('일반 모드: 필드가 모두 있고 init 뒤 initialized, version 1.0.0, class_name textbox', () => {
        const keys = Object.keys(tb).filter(k => typeof tb[k] !== 'function');
        expect(keys).toEqual(expect.arrayContaining(FIELDS));
        expect([tb.version, tb.is_initialized(), tb.class_name(), tb.text_length(), tb.getLength()]).toEqual(['1.0.0', true, 'textbox', 1, 1]);
        expect(tb.tb_schema.tb_schema).toBeNull();           // schema textbox는 다시 schema를 만들지 않는다
        expect(tb.user_keyboard_event_filter).toBeUndefined();
        expect(tb.env.empty_range_rule).toBeDefined();
        expect([tb.get_font_group_id(), tb.get_font_loading_state()]).toEqual(['default-host-ko', 'loaded']);
    });

    it('schema 모드: layout/docFactory/tbinput/fontloader/tb_schema/text_on_path가 null, init은 폰트 없이 resolve', async () => {
        const s = new M1TextBox.textbox({ schema: true, masterClipboard: GT_MasterClipboard.getInstance() });
        expect([s.layout, s.docFactory, s.tbinput, s.fontloader, s.tb_schema, s.text_on_path]).toEqual([null, null, null, null, null, null]);
        expect(s.is_initialized()).toBe(false);
        await s.init();
        expect([s.is_initialized(), s.class_name(), s.text_length(), s.get_style_info(0).align]).toEqual([true, 'textbox', 1, 'left']);
    });

    it('get_default_font: 인자 없으면 font_list_id의 기본 폰트, font_list를 주면 그 목록에서', () => {
        expect(tb.get_default_font()).toEqual(spFontManager._find_default_values('default-host-ko'));
        const list = { A: { family: { locale: {} }, style: { R: { default: true, url: '', issue: '', locale: {} } } } };
        expect(tb.get_default_font(list)).toEqual({ familyName: 'A', typeStyle: 'R' });
    });

    it('text-on-path 모드: class_name textonpath, get_style_info에 text_on_path', async () => {
        const tp = await create_textbox({ text_on_path: { svg_path_data: CIRCLE, align_to_path: 'baseline', flip_path: false } });
        try {
            expect(tp.class_name()).toBe('textonpath');
            const info = tp.get_style_info(0).text_on_path;
            expect(info).toMatchObject({ align_to_path: 'baseline', flip_path: false, start_bracket: 0 });
            expect(info.end_bracket).toBeCloseTo(tp.text_on_path.tpath_length, 6);   // end_bracket 기본값은 경로 길이
        } finally { destroy_textbox(tp); }
    });
});

describe('TextBox 리스너', () => {
    it('add/remove_doc_change_listener: null 무시, 같은 콜백 두 번이면 두 번 불림, 인자 없이 remove면 모두 제거 (Review Focus 5)', () => {
        const cmds = [];
        const cb = e => cmds.push(e.cmd);
        tb.add_doc_change_listener(null);
        tb.add_doc_change_listener(cb);
        tb.add_doc_change_listener(cb);
        expect(tb.user_doc_change_listeners.length).toBe(2);
        tb.document_changed({ cmd: 'x' });
        expect(cmds).toEqual(['x', 'x']);
        tb.remove_doc_change_listener(cb);
        tb.document_changed({ cmd: 'y' });
        expect(cmds).toEqual(['x', 'x', 'y']);
        tb.remove_doc_change_listener();
        tb.document_changed({ cmd: 'z' });
        expect([cmds.length, tb.user_doc_change_listeners.length]).toEqual([3, 0]);
    });

    it('style_listener: erase_cmd면 curStyle 유지, 아니면 비우고 user_style_listener(tbcursor) 호출. focus_listener', () => {
        const got = [];
        tb.set_user_style_listener(c => got.push(c));
        tb.set_user_focus_listener(() => got.push('focus'));
        tb.curStyle = { a: 1 };
        tb.style_listener({ erase_cmd: true });
        expect(tb.curStyle).toEqual({ a: 1 });
        tb.style_listener();
        expect(tb.curStyle).toEqual({});
        tb.focus_listener();
        expect(got).toEqual([tb.tbcursor, tb.tbcursor, 'focus']);
    });

    it('set_user_font_listener는 폰트 로딩 상태 콜백에 연결된다', async () => {
        const states = [];
        tb.set_user_font_listener(s => states.push(s));
        await tb.opStyle.set_font_family('KoPubDotum', 'Medium', { cursor: 0, begin: 0, end: 1, exists_range: true });
        expect(states.length).toBeGreaterThan(0);
        expect(states[states.length - 1]).toBe('loaded');
    });

    it('unmount_resize_observer: ResizeObserver가 없는 환경에서는 sensor.detach()', () => {
        const detach = vi.fn();
        tb.resize_sensor = { detach };
        tb.unmount_resize_observer();
        expect([detach.mock.calls.length, tb.resize_sensor]).toEqual([1, null]);
        tb.unmount_resize_observer();                          // null이면 무시
    });
});

describe('TextBox 치수/크기', () => {
    beforeEach(() => tb.opEdit.insert_string(0, 'Hello world'));

    it('get_dimension: fit_to_content_height면 page_height = content 높이(+gutter), 아니면 frame_height와 overflow', () => {
        const d = tb.get_dimension();
        expect([d.page_width, d.overflow]).toEqual([300, false]);
        expect(d.page_height).toBeCloseTo(d.visible_content_height, 6);
        expect(d.visible_content_height).toBeGreaterThan(0);
        tb.tbpreference.set_fit_to_content_height(false);
        tb.tbpreference.set_height(5);
        const d2 = tb.get_dimension();
        expect([d2.page_height, d2.overflow]).toEqual([5, true]);
    });

    it('resizeBox: 크기를 바꾸고 다시 레이아웃하며 document_changed(resizeBox)', () => {
        const cmds = [];
        tb.add_doc_change_listener(e => cmds.push(e.cmd));
        tb.resizeBox({ content: { width: 40 }, page: { width: 40 } });
        expect([tb.tbconfig.content.width, tb.tbconfig.page.width, cmds]).toEqual([40, 40, ['resizeBox']]);
        expect(tb.layout.get_tbdom().get_total_line_count()).toBeGreaterThan(1);
    });

    it('fit_width_to_first_paragraph: 글줄 폭 합 + 들여쓰기 + 1(또는 extra_margin). avoid_shrink면 줄이지 않는다', () => {
        const sum = () => tb.layout.get_tbdom().pars[0].lines.reduce((s, l) => s + l.content_width, 0);
        const w = sum() + 1;
        tb.fit_width_to_first_paragraph();
        expect(tb.tbconfig.content.width).toBeCloseTo(w, 6);
        expect(tb.tbconfig.page.width).toBeCloseTo(w, 6);        // page/content 폭 차(gap)가 0
        tb.fit_width_to_first_paragraph({ extra_margin: 10 });
        expect(tb.tbconfig.content.width).toBeCloseTo(sum() + 10, 6);
        tb.resizeBox({ content: { width: 200 }, page: { width: 200 } });
        tb.fit_width_to_first_paragraph({ avoid_shrink: true });
        expect(tb.tbconfig.content.width).toBe(200);
    });

    it('shrink_font_size_to_fit_to_page_height: fit_to_content_height면 무시, 아니면 page_height에 맞춰 줄인다', () => {
        const size = tb.m_FSizeLayer.getAttr(0).FontSize;
        tb.shrink_font_size_to_fit_to_page_height();
        expect(tb.m_FSizeLayer.getAttr(0).FontSize).toBe(size);
        tb.tbpreference.set_fit_to_content_height(false);
        tb.tbpreference.set_height(5);
        tb.shrink_font_size_to_fit_to_page_height();
        expect(tb.m_FSizeLayer.getAttr(0).FontSize).toBeLessThan(size);
    });

    it('scale/angle은 tbconfig에 기록, setRenderMode는 html/svg만, show_gutter', () => {
        tb.scale(2); tb.angle(30);
        expect([tb.tbconfig.page.scale, tb.tbconfig.transform.angle]).toEqual([2, 30]);
        tb.setRenderMode('xxx');
        expect(tb.tbconfig.text_render).toBe('svg');
        tb.setRenderMode('svg');
        expect(tb.tb_schema.tbconfig.text_render).toBe('svg');
        tb.show_gutter(true);
        expect(tb.tbconfig.content_elem.getAttribute('show-gutter')).toBe('true');
        tb.show_gutter(false);
        expect(tb.tbconfig.content_elem.getAttribute('show-gutter')).toBe('false');
    });
});

describe('TextBox 상태/히스토리/위임', () => {
    beforeEach(() => tb.opEdit.insert_string(0, 'Hello world'));

    it('attachTo는 base_node가 있으면 error, detach 뒤에는 붙이고 document_changed(attached)', () => {
        const r = [];
        tb.add_doc_change_listener(() => {});
        tb.add_doc_change_listener(() => {});
        tb.attachTo(_g.document.createElement('div'), e => r.push(e));
        expect(r).toEqual(['error']);
        expect(tb.user_doc_change_listeners.length).toBe(2);
        tb.detach();                                                   // 리스너를 모두 지운다 (Review Focus 5)
        expect([tb.tbconfig.base_node, tb.user_doc_change_listeners.length]).toEqual([null, 0]);
        const cmds = [];
        tb.add_doc_change_listener(e => cmds.push(e.cmd));
        const base = _g.document.createElement('div');
        tb.attachTo(base, e => r.push(e));
        expect([r, cmds, base.firstChild]).toEqual([['error', null], ['attached'], tb.element]);
    });

    it('font_loading_state_callback은 같은 참조로 등록/해제된다 (init → detach → attachTo)', () => {
        const set = tb.fontloader.callbacks_for_font_loading_state;
        const cb = tb.font_loading_state_callback;
        expect(set.size).toBe(1);                                      // init()의 setup_fontManager가 등록
        expect(set.has(cb)).toBe(true);
        tb.detach();
        expect([set.size, tb.font_loading_state_callback]).toEqual([0, cb]);
        tb.attachTo(_g.document.createElement('div'));
        expect([set.size, set.has(cb)]).toEqual([1, true]);
    });

    it('is_state_*, set_select/set_blur/set_focus, select_all_text', () => {
        expect([tb.is_state_none(), tb.is_state_selected(), tb.is_state_focused()]).toEqual([true, false, false]);
        tb.set_select();
        expect(tb.is_state_selected()).toBe(true);
        tb.set_focus();
        expect(tb.is_state_focused()).toBe(true);
        tb.set_blur();
        expect(tb.is_state_none()).toBe(true);
        tb.select_all_text();
        const sel = tb.tbcursor.sel();
        expect([sel.begin, sel.end, sel.exists_range]).toEqual([0, tb.getLength(), true]);
    });

    it('get_history_stack_pointer / reset_history / reset_all', () => {
        expect(tb.get_history_stack_pointer()).toBe(0);
        tb.opEdit.insert(1, 65);
        expect(tb.get_history_stack_pointer()).toBe(1);
        tb.reset_history();
        expect(tb.get_history_stack_pointer()).toBe(-1);
        tb.reset_all();
        expect([tb.text_core.toString(), tb.tbcursor.cursor, tb.get_history_stack_pointer()]).toEqual(['$', 0, -1]);
    });

    it('get_style_info는 seglayer 값에 문단 값을 더한다', () => {
        expect(tb.get_style_info(2)).toMatchObject({ bold: false, letter_scale_x: 100, findent: 0, lindent: 0, rindent: 0, line_space: 1.2, leading: 'auto', vertical_align: 'top', var_name: '_na_' });
        expect(tb.get_style_info(2).text_on_path).toBeUndefined();
    });

    it('format_service 위임: named range 조회/치환, clamp_font_size, layout_each_paragraph_in_a_single_line', () => {
        tb.opStyle.set_range_id('r1', 'T', { cursor: 0, begin: 0, end: 5, exists_range: true });
        expect(tb.get_text_by_range_id('r1')).toEqual({ range: { begin: 0, end: 5 }, text: 'Hello' });
        expect(tb.get_array_of_ranges().map(r => r.var_name)).toEqual(['r1']);
        tb.replace_text_with_range_id('r1', 'Bye');
        expect(tb.text_core.toString()).toBe('Bye world$');
        tb.clamp_font_size(5);
        expect(tb.m_FSizeLayer.getAttr(0).FontSize).toBeLessThanOrEqual(5);
        tb.layout_each_paragraph_in_a_single_line();
        expect(tb.layout.get_tbdom().pars[0].lines.length).toBe(1);
    });

    it('loadFromJson/saveAsJson/snapshotAsSVG*/getBBox/mirror/gather_*는 inout에 위임한다', () => {
        for (const name of ['loadFromJson', 'saveAsJson', 'snapshotAsSVG', 'snapshotAsSVGData', 'importFromInDesignJson', 'getBBox',
            'snapshotAsSVGInContentBBox', 'gather_used_colors', 'gather_used_fonts', 'gather_used_font_list_info']) {
            const spy = vi.spyOn(tb.inout, name).mockImplementation(() => 'r:' + name);
            expect(tb[name]('a', 'b')).toBe('r:' + name);
            spy.mockRestore();
        }
        const spy = vi.spyOn(tb.inout, 'mirror').mockImplementation(() => 'r');
        expect(tb.mirror('a')).toBeUndefined();                // mirror만 반환값을 돌려주지 않는다
        expect(spy).toHaveBeenCalledWith('a');
        spy.mockRestore();
    });
});
