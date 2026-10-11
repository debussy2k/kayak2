/*
    src/geometry 공용 타입. 값은 없고 타입만 있다.
*/
import type Bezier from 'bezier-js';
import type { TB_LineSeg } from './TB_LineSeg';

export interface Point { x: number; y: number }
/** MGeometry(clipper 식 대문자 좌표) */
export interface XYPoint { X: number; Y: number }
export interface Rect { x: number; y: number; width: number; height: number }

/** TB_Path.segments의 원소. 직선은 TB_LineSeg(type='line'), 곡선은 bezier-js의 Bezier */
export type Segment = TB_LineSeg | Bezier;

/** TB_Path.path의 원소 */
export type PathCmdM = { cmd: 'M'; x: number; y: number };
export type PathCmdL = { cmd: 'L'; x: number; y: number };
export type PathCmdC = { cmd: 'C'; x0: number; y0: number; x1: number; y1: number; x2: number; y2: number };
export type PathCmd = PathCmdM | PathCmdL | PathCmdC;

/** PathUtil.parse_svg_path의 결과 한 줄: ['M', x, y], ['C', x0, y0, x1, y1, x2, y2], ['Z'] … */
export type SvgPathCommand = [string, ...number[]];

/** MathUtil.getNearestPoint / TB_LineSeg.project 결과 */
export interface NearestPoint extends Point { t: number; d: number }

/** TB_Path.getPosByDistance 결과. pt는 항상 있다. nv/nv_angle은 opt에 따라 있을 수도 없을 수도 있다. */
export interface PosOnPath { pt: Point; nv?: Point; nv_angle?: number }
export interface PosOnPathOptions { normal?: boolean; angle?: boolean }

/** TB_Path.project_and_distance 결과 */
export interface ProjectResult { q: Point; d: number; length: number }

/** PathUtil.get_offset_svg_path 결과 */
export interface OffsetSvgPath { svg_str: string; begin_point: Point | null; end_point: Point | null }

export interface FindTOptions { epsilon?: number; max_step?: number }
export interface FlattenOptions { flatness: number; has_begin_point?: boolean }

/** TB_Path.clone이 요구하는 행렬. cg.js의 CGMatrix가 만족한다. */
export interface MatrixLike { transformPoint(pt: Point): Point }

/* ---- text-on-path ---- */

/** TextBox.js가 new TB_TextOnPath(tb, opt)로 넘기는 옵션 */
export interface TextOnPathOptions {
    svg_path_data?: string;
    align_to_path?: string;   // 'baseline' | 'ascender' | 'center' | 'descender'
    flip_path?: boolean;
    start_bracket?: number;
    end_bracket?: number;
}
/** TB_TextOnPath.save() 결과 (kayak JSON의 text_on_path) */
export interface TextOnPathSaveData {
    svg_path_data: string;
    align_to_path: string;
    flip_path: boolean;
    start_bracket: number;
    end_bracket: number;
}
/** TB_TextOnPath_Draw.svg_paths 원소 (pdf 생성용) */
export interface SvgGlyphPath {
    d: string;
    fill: string;
    fill_cmyk?: string;
    color_model?: string;
    transform: [{ translate: Point }, { rotate: { a: number; cx: number; cy: number } }];
}
/** TB_TextOnPath_Draw.generate_svg_path_string / get_svg_for_render / get_svg_data_for_pdf 옵션 */
export interface SvgRenderOptions {
    override_fill_color?: { fill: string; fill_cmyk?: string };
    render_master_color_only?: { fill: string };
    cropbox?: { x: number; y: number; w: number; h: number };
    padding?: number[];   // [left, top, right, bottom]
}
/** TB_TextOnPath_Bracket.get_bracket_line 결과 */
export interface BracketLine { b: Point; e: Point; pt_on_path: Point; nv: Point; nv_angle: number }
export type BracketTag = 'start' | 'end';
/** TextBox.document_changed → TB_TextOnPath.update_view(change_data) */
export interface ViewChangeData { cmd: string }

/** TextBox 인스턴스. src/textbox/types.ts가 정의한다. */
export type { TextBoxHost } from '../textbox/types';
