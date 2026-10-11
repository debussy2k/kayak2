/*
    segment 모듈 공용 타입 정의.

    원본 JS(src/segment)에는 명시적 타입이 없었으며,
    seglayer / ATTR_* 사이의 암묵적인 duck-typing 계약을 interface로 명문화한 것이다.
*/

import type { GxFlag } from './segment_const';
import type GT_SegRange from './GT_SegRange';

/** ATTR_*.style_setter()가 채우고 css_string()이 읽는 스타일 정보. 키는 ATTR 클래스마다 다르다. */
export type StyleInfo = Record<string, any>;

/** ATTR_*.css_string()의 두 번째 인자. TB_StyleContext.js 참고 */
export interface StyleResultContext {
    css_data: Record<string, string>;
    raw_data: Record<string, any>;
}

/**
 * 모든 ATTR_* 클래스가 만족해야 하는 계약.
 * segment layer는 이 인터페이스만 사용하여 attribute를 다룬다.
 * (하나의 인스턴스가 "속성값 + 연속 element 개수(m_nCount)"를 함께 가지는
 *  run-length encoding의 한 조각이다)
 */
export interface ISegAttr {
    /** attribute 클래스 식별자. ex) 'ATTR_FontSize' */
    _attr_class_name: string;
    /** 이 attribute가 연속 적용되는 element(문자) 개수 */
    m_nCount: number;

    /** 자신과 동일한 값(m_nCount 포함)의 새 인스턴스 생성 */
    clone(): ISegAttr;
    /** 자신과 동일한 속성값을 가지되 m_nCount를 지정하는 새 인스턴스 생성 (기본 1).
     *  ATTR_X.prototype.factory() 처럼 인스턴스 없이(this 없이) 불리면 기본 인스턴스를 만든다. */
    factory(nCount?: number): ISegAttr;
    /** 속성값(m_nCount 제외)이 같은지 비교 */
    equal(that: ISegAttr): boolean;
    /** that(또는 setMask)의 값으로 자신의 속성을 설정 */
    set(that: any, setMask?: any): void;
    /** 직렬화용 plain object 반환 */
    getDataObject(): Record<string, any>;

    getGravityExFlag(): GxFlag;
    setGravityExFlag(val: GxFlag): void;

    /** style_info의 값을 css/raw 데이터로 변환 (prototype에서 호출됨) */
    css_string(style_info: StyleInfo, result_context: StyleResultContext): void;
    /** attr의 값을 style_info에 기록 (prototype에서 호출됨) */
    style_setter(style_info: StyleInfo, attr: any): void;
}

/**
 * seglayer의 attr_prototype 인자로 전달되는 객체의 계약. 원본에서는 ATTR_*.prototype을 그대로 전달한다.
 * seglayer_manager는 factory를 bare function으로(this 없이) 호출하므로 factory()는 this에 의존하면 안 된다.
 */
export interface IAttrPrototype {
    factory(): ISegAttr;
    style_setter(style_info: StyleInfo, attr: any): void;
    css_string(style_info: StyleInfo, result_context: StyleResultContext): void;
}

/** segment layer 내부에서 (segment index, segment내 offset) 위치를 표현 */
export interface SegPos {
    pIndex: number;
    pOffset: number;
}

/** erase/paste 시 undo/redo 대상 segment 범위 추적용 */
export interface ChangeRange {
    nUndo_Begin: number;
    nUndo_End: number;
    nRedo_Begin: number;
    nRedo_End: number;
}

/** getAttr()의 out-parameter. 위치가 속한 segment 내의 상대 위치 정보 */
export interface SegInfo {
    index_in_seg?: number;
    size_of_seg?: number;
}

/** get_segment_range_in_current_pos()의 out-parameter */
export interface SegSpan {
    from?: number;
    to?: number;
}

/** undo/redo 한 단계의 정보 */
export interface SegHistoryInfo {
    m_pSegRngBefore: GT_SegRange;
    m_pSegRngAfter: GT_SegRange;
}

/** edit 명령 후 변화된 par 범위 정보. (seglayer_par의 get_command_change_info() 반환값) */
export interface CommandChangeInfo {
    edit_cmd: string;
    history_pointer: number;
    par_length: number;
    before?: GT_SegRange;
    after?: GT_SegRange;
}

/* ---- ATTR 값 객체 ---- */

/** ATTR_FontColor의 gradient. immutable로 다룬다. (ATTR_FontColor.ts 주석 참고) */
export interface GradientSpec {
    type: 'linear' | 'radial';
    geom: Record<string, number>;   // linear: x1,y1,x2,y2 / radial: cx,cy,r,fx,fy
    stops: { offset: string; rgb: string; cmyk?: number[] }[];
    angle?: number;
}

/** 별색 모델. ex) { type: 'SPOT', name: 'PANTONE 314 C' } */
export interface ColorModel {
    type: string;
    name: string;
}

/** ATTR_Shadow의 값. immutable로 다룬다. */
export interface ShadowSpec {
    size: number;       // unit: mm
    angle: number;      // unit: degree
    distance: number;   // unit: mm
    opacity: number;    // 0~100
    color: string;
}

/** ATTR_Stroke의 값. immutable로 다룬다. */
export interface StrokeSpec {
    weight: number;     // unit: pt (px 아님)
    align: string;      // 'center' | 'outside'
    color: string;
    join?: string;      // 'round' | 'bevel' | 'miter' (기본 'round')
    miterlimit?: number; // 기본 10
}

/* ---- seglayer / seglayer_manager ---- */

/** GT_segmentLayer_Par 생성 옵션. ATTR_Doc 레이어는 accept_newline:false로 만든다. */
export interface SegLayerOptions {
    accept_newline?: boolean;
}

/**
 * seglayer_manager의 undo/redo 스택 항목.
 * item: 'all'(모든 레이어) | 'none'(nop) | 변경된 레이어 배열(set) — TextBox_Edit.js가 get_curr_history()로 읽는다.
 */
export interface HistoryStackEntry {
    item: 'all' | 'none' | any[] | any;
    command_auto_play: string | null;
}
