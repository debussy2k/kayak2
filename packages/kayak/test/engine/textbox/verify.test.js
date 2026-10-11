/*
    Textbox_Verify 특성 테스트. kayak JSON 객체를 손으로 만들어 검증/복구 규칙을 고정한다.
*/
import { describe, it, expect, vi } from 'vitest';
import { Textbox_Verify } from '../../../src/engine/textbox/Textbox_Verify';

const make_obj = () => ({ text_arr: [65, 66, 10], text_raw: 'AB\n', ATTR_Par: [{ m_nCount: 3 }], ATTR_FontSize: [{ m_nCount: 3 }] });
const verify = new Textbox_Verify();

describe('Textbox_Verify.run', () => {
    it('모두 맞으면 {code:"pass"}만 돌려준다', () => {
        expect(verify.run(make_obj())).toEqual({ code: 'pass' });
    });

    it('fonts_unresolved가 있으면 fail + testcase_unresolved_fonts', () => {
        const obj = Object.assign(make_obj(), { fonts_unresolved: ['Foo/Bold'] });
        expect(verify.run(obj)).toEqual({
            code: 'fail',
            testcase_unresolved_fonts: { code: 'fail', error_message: 'unresolved fonts found', fonts_unresolved: ['Foo/Bold'] },
        });
    });

    it('ATTR_* m_nCount 합이 text_arr 길이와 다르면 fail. try_fix면 마지막 항목에 모자란 만큼 보충하되 결과는 그대로 fail', () => {
        const obj = make_obj();
        obj.ATTR_FontSize = [{ m_nCount: 1 }, { m_nCount: 1 }];
        const r1 = verify.run(obj);
        expect(r1.code).toBe('fail');
        expect(r1.testcase_ATTR_Count).toEqual({
            code: 'fail', error_message: 'sum of text count in ATTR_FontSize is not equals 3', text_raw: 'AB\n', text_length: 3,
            data: [{ attr: 'ATTR_Par', sum: 3 }, { attr: 'ATTR_FontSize', sum: 2 }],
        });
        expect(obj.ATTR_FontSize).toEqual([{ m_nCount: 1 }, { m_nCount: 1 }]);   // try_fix 없으면 손대지 않는다
        const r2 = verify.run(obj, { try_fix: true });
        expect(r2.code).toBe('fail');
        expect(obj.ATTR_FontSize).toEqual([{ m_nCount: 1 }, { m_nCount: 2 }]);
    });

    it('합이 넘치면 try_fix여도 고치지 않는다 (Review Focus 4)', () => {
        const obj = make_obj();
        obj.ATTR_FontSize = [{ m_nCount: 5 }];
        verify.run(obj, { try_fix: true });
        expect(obj.ATTR_FontSize).toEqual([{ m_nCount: 5 }]);
    });

    it('check_ATTR_Count try_fix: 글자가 \\n 하나뿐이고 ATTR_*가 []이면 그 키를 지운다', () => {
        const obj = { text_arr: [10], text_raw: '\n', ATTR_Par: [{ m_nCount: 1 }], ATTR_Stroke: [] };
        const r = verify.check_ATTR_Count(obj, { try_fix: true });
        expect(r.code).toBe('fail');
        expect('ATTR_Stroke' in obj).toBe(false);
    });

    it('check_not_recoverable try_fix: ATTR_*가 []이면 모든 ATTR_*를 기본값 하나로, 텍스트를 \\n으로 되돌린다 (결과는 pass)', () => {
        const obj = { text_arr: [65, 10], text_raw: 'A\n', ATTR_Par: [], ATTR_FontFamily: [{ m_nCount: 2, familyName: 'X', typeStyle: 'Y' }], ATTR_Custom: [{ m_nCount: 2 }] };
        const tb = { get_default_font: () => ({ familyName: 'F', typeStyle: 'S' }) };
        expect(verify.check_not_recoverable(obj, { try_fix: true, tb })).toEqual({ code: 'pass', error_message: '' });
        expect(obj.text_arr).toEqual([10]);
        expect(obj.text_raw).toBe('\n');
        expect(obj.ATTR_Par.length).toBe(1);
        expect(obj.ATTR_Par[0].m_nCount).toBe(1);
        // default_font를 getDataObject()에 넘기지만 getDataObject()는 인자를 받지 않는다 → ATTR_FontFamily 기본값이 들어간다 (issues.md #11)
        expect(obj.ATTR_FontFamily).toEqual([{ m_nCount: 1, familyName: 'Noto Sans KR', typeStyle: 'Regular' }]);
        expect(obj.ATTR_Custom).toEqual([{ m_nCount: 2 }]);   // switch에 없는 키는 그대로
    });

    it('verify_saved_json: 빈 ATTR_*는 message로, 합 불일치는 check_ATTR_Count 결과로 알리고 고치지 않는다', () => {
        expect(verify.verify_saved_json(make_obj())).toEqual({ code: 'pass' });
        const empty = Object.assign(make_obj(), { ATTR_Bold: [] });
        expect(verify.verify_saved_json(empty)).toEqual({ code: 'fail', error_message: '', message: 'ATTR_Bold is empty' });
        const bad = make_obj(); bad.ATTR_Par = [{ m_nCount: 2 }];
        expect(verify.verify_saved_json(bad).error_message).toBe('sum of text count in ATTR_Par is not equals 3');
        expect(bad.ATTR_Par).toEqual([{ m_nCount: 2 }]);
    });

    it('fix_bug_preference_bug: preference와 ATTR_Doc 불일치를 preference 값으로 맞춘다', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const pref = { fit_to_content_height: false, vertical_justification: 'center', frame_height: 100 };
        const a = Object.assign(make_obj(), { preference: pref });
        verify.fix_bug_preference_bug(a);
        expect(a.ATTR_Doc).toEqual([{ m_nCount: 3, fit_to_content_height: false, vertical_align: 'center', frame_height: 100 }]);
        const b = Object.assign(make_obj(), { preference: pref, ATTR_Doc: [{ m_nCount: 3, fit_to_content_height: true, vertical_align: 'top', frame_height: 0 }] });
        verify.fix_bug_preference_bug(b);
        expect(b.ATTR_Doc[0]).toEqual({ m_nCount: 3, fit_to_content_height: false, vertical_align: 'center', frame_height: 100 });
        const c = Object.assign(make_obj(), { preference: pref, ATTR_Doc: [{ m_nCount: 3, fit_to_content_height: false, vertical_align: 'center', frame_height: 50 }] });
        verify.fix_bug_preference_bug(c);
        expect(c.ATTR_Doc[0].frame_height).toBe(100);
        const d = Object.assign(make_obj(), { preference: pref, ATTR_Doc: [{}, {}] });   // ATTR_Doc이 2개면 손대지 않는다
        verify.fix_bug_preference_bug(d);
        expect(d.ATTR_Doc).toEqual([{}, {}]);
        warn.mockRestore();
    });
});
