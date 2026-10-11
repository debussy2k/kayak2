/*
    TB_TextOnPath_MouseInput / Draw / Bracket 중 DOM 렌더링 없이 돌릴 수 있는 부분의 특성 테스트.
    실제 textbox 대신 필요한 필드만 가진 가짜 tp(text-on-path)를 넘긴다.
    렌더링 경로는 test/snapshot/text_on_path.test.js가 고정한다.
*/
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import _g from '../../../src/engine/textbox/TB_PlatformEnv';
import { TB_Path } from '../../../src/engine/geometry/TB_Path';
import { TB_TextOnPath_MouseInput } from '../../../src/engine/geometry/TB_TextOnPath_MouseInput';
import { TB_TextOnPath_Draw } from '../../../src/engine/geometry/TB_TextOnPath_Draw';
import { TB_TextOnPath_Bracket } from '../../../src/engine/geometry/TB_TextOnPath_Bracket';
import { round, CIRCLE_CCW } from './helpers';

const { window } = new JSDOM('<!DOCTYPE html><body></body>');
_g.set({ window });

describe('TB_TextOnPath_MouseInput', () => {
    function fake_tp(angle, scale) {
        return {
            tb: { tbconfig: { page: { scale }, transform: { angle } } },
            svg_container: { getBoundingClientRect: () => ({ left: 100, top: 200, width: 100 * scale, height: 50 * scale }) },
            bbox: { width: 100, height: 50 },
        };
    }
    it('is_double_clicked: 300ms 안에 두 번이면 true', () => {
        const mi = new TB_TextOnPath_MouseInput(fake_tp(0, 1));
        mi.last_mousedown_time = Date.now() - 1000;
        expect(mi.is_double_clicked()).toBe(false);
        expect(mi.is_double_clicked()).toBe(true);
    });
    it('get_offsetXY: 회전 0이면 컨테이너 left/top 기준 오프셋', () => {
        const tp = fake_tp(0, 1);
        const mi = new TB_TextOnPath_MouseInput(tp);
        expect(round(mi.get_offsetXY({ clientX: 130, clientY: 240 }, tp))).toEqual({ x: 30, y: 40 });
    });
    it('get_offsetXY: 90도 회전 + scale 2이면 중심 기준으로 되돌린다', () => {
        const tp = fake_tp(90, 2);
        const mi = new TB_TextOnPath_MouseInput(tp);
        // 중심 (200, 250). 중심에서 오른쪽 +10은 회전 전 좌표계의 위쪽(-y) 방향이다.
        expect(round(mi.get_offsetXY({ clientX: 210, clientY: 250 }, tp))).toMatchSnapshot();
        expect(round(mi.get_offsetXY({ clientX: 200, clientY: 250 }, tp))).toEqual({ x: 100, y: 50 });   // 중심 → box 중심
    });
});

describe('TB_TextOnPath_Draw: svg 문자열 생성 (pdf/mirror/render)', () => {
    function make_draw() {
        const tp = { bbox: { x: 10, y: 20 }, tb: null };
        const d = new TB_TextOnPath_Draw(tp);
        d.svg_paths = [
            { d: 'M0 0 L1 1', fill: '#ff0000', fill_cmyk: '0,100,100,0', color_model: 'cmyk', transform: [{ translate: { x: 5, y: 6 } }, { rotate: { a: 30, cx: 1, cy: 2 } }] },
            { d: 'M2 2 L3 3', fill: '#00ff00', fill_cmyk: '100,0,100,0', color_model: 'cmyk', transform: [{ translate: { x: 7, y: 8 } }, { rotate: { a: -15, cx: 0, cy: 0 } }] },
        ];
        return d;
    }
    it('generate_svg_path_string: 옵션 없음', () => {
        expect(make_draw().generate_svg_path_string()).toMatchSnapshot();
    });
    it('generate_svg_path_string: cropbox + padding + override_fill_color', () => {
        expect(make_draw().generate_svg_path_string({ cropbox: { x: 1, y: 2, w: 0, h: 0 }, padding: [3, 4, 0, 0], override_fill_color: { fill: '#ffffff', fill_cmyk: '0,0,0,0' } })).toMatchSnapshot();
    });
    it('generate_svg_path_string / get_svg_data_for_pdf: render_master_color_only는 fill이 같은 것만', () => {
        const d = make_draw();
        const s = d.generate_svg_path_string({ render_master_color_only: { fill: '#00ff00' } });
        expect(s).toContain('M2 2 L3 3');
        expect(s).not.toContain('M0 0 L1 1');
        const pdf = d.get_svg_data_for_pdf({ render_master_color_only: { fill: '#00ff00' } });
        expect(pdf.x).toBe(-10);
        expect(pdf.y).toBe(-20);
        expect(pdf.svg_paths.length).toBe(1);
        expect(d.get_svg_data_for_pdf().svg_paths.length).toBe(2);
    });
    it('get_svg_for_render / get_svg_for_mirror', () => {
        const d = make_draw();
        d.svg_text = d.generate_svg_path_string();
        expect(d.get_svg_for_render({ padding: [1, 1, 0, 0] })).toMatchSnapshot();
        expect(d.get_svg_for_mirror()).toMatchSnapshot();
    });
    it('get_shape_outline_css는 hover 색을 끼워 넣는다', () => {
        expect(make_draw().get_shape_outline_css('none')).toMatchSnapshot();
    });
    it('render_projection_line', () => {
        const d = make_draw();
        d.render_projection_line({ x: 1, y: 2 }, { x: 3, y: 4 });
        expect(d.svg_projection_line).toBe('<path d="M1 2 L3 4" stroke="gray" fill="transparent"/>');
    });
});

describe('TB_TextOnPath_Bracket: bracket 위치 갱신 (DOM은 jsdom)', () => {
    // tpath 위의 한 점을 마우스 위치로 돌려주는 가짜 tp
    function make_tp(path_data, flip) {
        const tpath = new TB_Path(path_data, { flip });
        tpath.precalc_length();
        const tp = {
            svg_container: window.document.createElement('div'),
            tpath,
            inter_bracket_path: null,
            start_bracket: 0,
            end_bracket: tpath.getLength(),
            mouse_pt: { x: 0, y: 0 },
            get_transformed_mouse_pt() { return this.mouse_pt; },
            update_view_calls: [],
            update_view(change) { this.update_view_calls.push(change); },
        };
        return tp;
    }
    it('init_brackets: svg가 컨테이너에 붙고 show_brackets/show_overflow_mark가 display를 바꾼다', () => {
        const tp = make_tp('M0 0 L100 0 L100 100', false);
        const br = new TB_TextOnPath_Bracket(tp);
        expect(tp.svg_container.querySelector('.bracket-layer')).not.toBeNull();
        br.show_brackets(false);
        expect(br.bracket_layer.style.display).toBe('none');
        br.show_brackets(true);
        expect(br.bracket_layer.style.display).toBe('block');
        br.show_overflow_mark(true);
        expect(br.overflow_layer.style.display).toBe('block');
    });
    it('update_bracket_pos: 열린 경로에서 start가 end를 넘으면 end-0.1로 막는다', () => {
        const tp = make_tp('M0 0 L100 0 L100 100', false);
        const br = new TB_TextOnPath_Bracket(tp);
        tp.end_bracket = 120;
        tp.mouse_pt = { x: 100, y: 50 };   // 길이 150 지점
        br.update_bracket_pos({}, 'start');
        expect(round(tp.start_bracket)).toBe(119.9);
        expect(tp.inter_bracket_path).not.toBeNull();
        expect(round(tp.inter_bracket_path.total_length)).toBe(0.1);
        expect(tp.update_view_calls).toEqual([{ cmd: 'TPath.START_BRACKET' }]);
    });
    it('update_bracket_pos: 열린 경로에서 end가 start 앞이면 start+0.1', () => {
        const tp = make_tp('M0 0 L100 0 L100 100', false);
        const br = new TB_TextOnPath_Bracket(tp);
        tp.start_bracket = 80;
        tp.mouse_pt = { x: 10, y: 0 };   // 길이 10 지점
        br.update_bracket_pos({}, 'end');
        expect(round(tp.end_bracket)).toBe(80.1);
    });
    it('update_bracket_pos: 닫힌 경로에서는 start > end를 허용하고(wrap) 같을 때만 0.1 띄운다', () => {
        const tp = make_tp(CIRCLE_CCW, true);
        const br = new TB_TextOnPath_Bracket(tp);
        tp.end_bracket = 100;
        tp.mouse_pt = { x: 200, y: 100 };   // 원 오른쪽 끝 — 시작점(100,200)에서 cw로 1/4 바퀴보다 먼 지점
        br.update_bracket_pos({}, 'start');
        expect(tp.start_bracket).toBeGreaterThan(tp.end_bracket);
        expect(round(tp.start_bracket)).toMatchSnapshot();
        tp.end_bracket = tp.start_bracket;
        br.update_bracket_pos({}, 'start');
        expect(round(tp.start_bracket)).toBe(round(tp.end_bracket - 0.1));
    });
    it('generate_inter_bracket_path: 길이 0 구간이면 0~0.01로 대체한다', () => {
        const tp = make_tp('M0 0 L100 0', false);
        const br = new TB_TextOnPath_Bracket(tp);
        br.generate_inter_bracket_path(50, 50);
        expect(round(tp.inter_bracket_path.total_length)).toBe(0.01);
    });
});
