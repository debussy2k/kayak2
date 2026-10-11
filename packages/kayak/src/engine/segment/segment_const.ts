/*
    webpage에 global로 들어가도록 별도로 포함시킬 것.
*/

const SEGC = {
    //
    GXFLAG_NULL: 0,
    GXFLAG_NONE: 1,
    GXFLAG_BOTH: 2,
    //
    GRAVITY_LEFT: 1,
    GRAVITY_RIGHT: 2,
    GRAVITY_EXCLUSIVE: 3,
    //
    OK_ALL: 1,
    OK_NEED_NEW_FIRST_SEGMENT: 2,
    OK_NEED_NEW_LAST_SEGMENT: 3,
    OK_NEED_INSERT_SEGMENT_BEFORE: 4,
    OK_END_POSITION: 5,
    OK_SEGMENT_ERASED: 6,
    OK_SEGMENT_MERGED: 7,
    OK_SEGMENT_NOT_MERGED: 8,
    OK_DELIMETER: 9, // OK인 곳까지의 위치
    ERR_OUT_OF_RANGE: 10,
    ERR_NEED_ATTRIBUTE: 11,
    ERR_SEGVEC_EMPTY: 12,
    ERR_RANGE_EMPTY: 13,
    ERR_BEGIN_OF_HISTORY: 14,
    ERR_END_OF_HISTORY: 15,
    ERR_ATTRIBUTE_IS_NULL: 16
} as const;

/** segment의 gravity 확장 플래그 (GXFLAG_*) */
export type GxFlag = typeof SEGC.GXFLAG_NULL | typeof SEGC.GXFLAG_NONE | typeof SEGC.GXFLAG_BOTH;

/** segment layer의 gravity (GRAVITY_*) */
export type Gravity = typeof SEGC.GRAVITY_LEFT | typeof SEGC.GRAVITY_RIGHT | typeof SEGC.GRAVITY_EXCLUSIVE;

/** seglayer 연산 결과 코드 (OK_* , ERR_*). OK_DELIMETER(9) 이하가 성공 */
export type SegResult =
    | typeof SEGC.OK_ALL | typeof SEGC.OK_NEED_NEW_FIRST_SEGMENT | typeof SEGC.OK_NEED_NEW_LAST_SEGMENT
    | typeof SEGC.OK_NEED_INSERT_SEGMENT_BEFORE | typeof SEGC.OK_END_POSITION | typeof SEGC.OK_SEGMENT_ERASED
    | typeof SEGC.OK_SEGMENT_MERGED | typeof SEGC.OK_SEGMENT_NOT_MERGED | typeof SEGC.OK_DELIMETER
    | typeof SEGC.ERR_OUT_OF_RANGE | typeof SEGC.ERR_NEED_ATTRIBUTE | typeof SEGC.ERR_SEGVEC_EMPTY
    | typeof SEGC.ERR_RANGE_EMPTY | typeof SEGC.ERR_BEGIN_OF_HISTORY | typeof SEGC.ERR_END_OF_HISTORY
    | typeof SEGC.ERR_ATTRIBUTE_IS_NULL;

export default SEGC;
