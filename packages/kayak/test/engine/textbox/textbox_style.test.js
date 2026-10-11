/*
    TextBox_Style 특성 테스트. 'Hello world' 위에서 [0,5) 구간에 스타일을 주고 seglayer 값을 고정한다.
    sel은 TB_Cursor.sel() 모양({cursor, begin, end, exists_range})이다. exists_range:false면 curStyle에만 기록된다.
*/
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { create_textbox, destroy_textbox } from '../../snapshot/helpers';

const SEL = { cursor: 0, begin: 0, end: 5, exists_range: true };
const NO_RANGE = { cursor: 7, begin: 7, end: 7, exists_range: false };
let tb;
beforeEach(async () => { tb = await create_textbox(); tb.opEdit.insert_string(0, 'Hello world'); });
afterEach(() => destroy_textbox(tb));

describe('TextBox_Style 글자 스타일', () => {
    it('set_bold: "bold"/"normal"은 값을, null은 토글. 범위가 없으면 curStyle에 반대값', () => {
        tb.opStyle.set_bold('bold', SEL);
        expect([tb.m_Bold.getAttr(2).bold, tb.m_Bold.getAttr(7).bold]).toEqual([true, false]);
        tb.opStyle.set_bold(null, SEL);
        expect(tb.m_Bold.getAttr(2).bold).toBe(false);
        tb.opStyle.set_bold(null, NO_RANGE);
        expect(tb.curStyle.ATTR_Bold.bold).toBe(true);
    });

    it('set_font_size / set_fontColor / set_letter_space / set_letter_scale_x', () => {
        const size_before = tb.m_FSizeLayer.getAttr(7).FontSize;
        tb.opStyle.set_font_size(20, SEL);
        expect([tb.m_FSizeLayer.getAttr(2).FontSize, tb.m_FSizeLayer.getAttr(7).FontSize]).toEqual([20, size_before]);
        tb.opStyle.set_font_size(30, NO_RANGE);
        expect(tb.curStyle.ATTR_FontSize.FontSize).toBe(30);
        tb.opStyle.set_fontColor('#ff0000', [0, 100, 100, 0], null, SEL);
        expect([tb.m_FontColor.getAttr(2).fontColor, tb.m_FontColor.getAttr(7).fontColor]).toEqual(['#ff0000', 'black']);
        tb.opStyle.set_letter_space(2, SEL);
        tb.opStyle.set_letter_scale_x(80, SEL, null, null, { skip_post_process: true });
        expect([tb.m_LetterSpacing.getAttr(2).letter_space, tb.m_LetterScaleX.getAttr(2).letter_scale_x]).toEqual([2, 80]);
        expect([tb.m_LetterSpacing.getAttr(7).letter_space, tb.m_LetterScaleX.getAttr(7).letter_scale_x]).toEqual([0, 100]);
    });

    it('set_stroke / set_shadow / set_range_id, on_par_changed는 (null, text_change_info, par_change_info{ci_change_start, ci_change_end})', () => {
        const calls = [];
        tb.opStyle.set_stroke({ weight: 1, align: 'outside', color: '#000', join: 'round', miterlimit: 10 }, SEL,
            (err, t, p) => calls.push([err, t.edit_cmd, p.ci_change_start, p.ci_change_end]));
        expect(calls).toEqual([[null, 'set', 0, 5]]);
        expect(tb.m_Stroke.getAttr(2).stroke.weight).toBe(1);
        tb.opStyle.set_shadow({ size: 1, angle: 45, distance: 2, opacity: 50, color: '#000' }, SEL);
        expect(tb.m_Shadow._get_vec().length).toBe(2);
        tb.opStyle.set_range_id('r1', 'T', SEL);
        expect([tb.m_NamedRange.getAttr(2).var_name, tb.m_NamedRange.getAttr(7).var_name]).toEqual(['r1', '_na_']);
    });

    it('set_font_family는 Promise를 돌려주고 폰트 로딩 뒤 레이어를 바꾼다', async () => {
        await tb.opStyle.set_font_family('KoPubDotum', 'Medium', SEL);
        expect(tb.m_FFamilyLayer.getAttr(2).familyName).toBe('KoPubDotum');
        expect(tb.m_FFamilyLayer.getAttr(7).familyName).toBe(tb.get_default_font().familyName);
    });
});

describe('TextBox_Style 문단/문서 스타일', () => {
    it('set_text_align / set_par_style (모르는 이름은 무시하고 undefined)', () => {
        tb.opStyle.set_text_align('center', SEL);
        expect(tb.m_Par.getAttr(0).m_Align).toBe('center');
        expect(tb.opStyle.set_par_style('nope', 1, SEL)).toBeUndefined();
        tb.opStyle.set_par_style('first', 7, SEL);
        tb.opStyle.set_par_style('leading', 'auto', SEL);
        expect([tb.m_Par.getAttr(0).m_Findent, tb.m_Par.getAttr(0).m_Leading]).toEqual([7, 'auto']);
    });

    it('set_vertical_align: fit_to_content_height를 끄고 frame_height를 content 높이로. ATTR_Doc의 frame_height는 바뀌지 않는다 (원본 quirk, issues.md #14)', () => {
        const doc_before = tb.m_DocLayer.getAttr(0).frame_height;
        tb.opStyle.set_vertical_align('center');
        expect([tb.tbpreference.vertical_justification, tb.tbpreference.fit_to_content_height]).toEqual(['center', false]);
        expect(tb.tbpreference.frame_height).toBeCloseTo(tb.tbpreference.get_content_height(), 6);
        expect(tb.m_DocLayer.getAttr(0).frame_height).toBe(doc_before);
        expect(tb.m_DocLayer.getAttr(0).vertical_align).toBe('center');
    });

    it('set_fit_to_content_height: 같은 값이면 history에 넣지 않는다. set_frame_height는 replacing이면 레이어를 건드리지 않는다', () => {
        const hp = tb.get_history_stack_pointer();
        tb.opStyle.set_fit_to_content_height(true);                 // 이미 true
        expect(tb.get_history_stack_pointer()).toBe(hp);
        tb.opStyle.set_fit_to_content_height(false);
        expect([tb.tbpreference.fit_to_content_height, tb.m_DocLayer.getAttr(0).fit_to_content_height]).toEqual([false, false]);
        tb.opStyle.set_frame_height(123);
        expect([tb.tbpreference.frame_height, tb.m_DocLayer.getAttr(0).frame_height]).toEqual([123, 123]);
        tb.opStyle.set_frame_height(77, null, true);
        expect([tb.tbpreference.frame_height, tb.m_DocLayer.getAttr(0).frame_height]).toEqual([77, 123]);
    });

    it('set_textonpath_*는 history store에 dispatch하고 document_changed를 부른다', () => {
        const cmds = [];
        tb.add_doc_change_listener(e => cmds.push(e.cmd));
        tb.opStyle.set_textonpath_align('center');
        tb.opStyle.set_textonpath_flip_path(true);
        tb.opStyle.set_textonpath_bracket('begin', 3);
        tb.opStyle.set_textonpath_bracket('end', 9);
        const tp = tb.history.get_state().present.tpath;
        expect([tp.align_to_path, tp.flip_path, tp.start_bracket, tp.end_bracket]).toEqual(['center', true, 3, 9]);
        expect(cmds).toEqual(['TPath.ALIGN', 'TPath.FLIP_PATH', 'TPath.START_BRACKET', 'TPath.END_BRACKET']);
    });
});
