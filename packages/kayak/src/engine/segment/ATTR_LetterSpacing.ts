/*
    ATTR_* 추가시 "//D Layer"로 표시된 곳 확인할 것.
*/

import SEGC from './segment_const';
import type { GxFlag } from './segment_const';
import type { ISegAttr, StyleInfo, StyleResultContext } from './types';

///////////////////////////////////////////////////////////
// ATTR_LetterSpacing
// value : em단위의 x1000된 값임.
///////////////////////////////////////////////////////////
class ATTR_LetterSpacing implements ISegAttr {
    _attr_class_name = 'ATTR_LetterSpacing';

    // common values
    private _nGravityExFlag: GxFlag = SEGC.GXFLAG_BOTH;
    m_nCount = 1;

    letter_space!: number;

    constructor(value?: number) {
        this.reset(value);
    }

    reset(value?: number): void {
        this.m_nCount = 1;
        this.letter_space = value != undefined ? value : 0;
    }

    clone(): ATTR_LetterSpacing {
        var obj = new ATTR_LetterSpacing(this.letter_space);
        obj.setGravityExFlag(this._nGravityExFlag);
        obj.m_nCount = this.m_nCount;
        return obj;
    }

    factory(nCount?: number): ATTR_LetterSpacing {
        // ATTR_LetterSpacing.prototype.factory() 또는 bare function으로 불리면(this가 인스턴스가 아니면) 기본 인스턴스를 만든다.
        // seglayer_manager.setByDataObject()가 _attr_prototype.factory를 this 없이 호출한다.
        if (!(this instanceof ATTR_LetterSpacing))
            return new ATTR_LetterSpacing();
        var obj = this.clone();
        obj.m_nCount = (nCount === undefined) ? 1 : nCount;
        return obj;
    }

    equal(that: ISegAttr): boolean {
        return (this.letter_space === (that as ATTR_LetterSpacing).letter_space);
    }

    getGravityExFlag(): GxFlag { return this._nGravityExFlag; }
    setGravityExFlag(val: GxFlag): void { this._nGravityExFlag = val; }

    set(that: any): void {
        this.m_nCount = that.m_nCount;
        this.letter_space = that.letter_space;
    }

    getDataObject(): { m_nCount: number; letter_space: number } {
        var obj = {
            m_nCount: this.m_nCount,
            letter_space: this.letter_space
        }
        return obj;
    }

    /*  css_string()과 style_setter()
        각각의 첫번째 argument인 style_info는 type이 동일함.
            - style_setter()로 지정한 것이 css_string()로 전달되는 구조임.

        style_setter()의 "attr" type은 ATTR_LetterSpacing

        result_context.raw_data에 설정된 값은
        - clipboard로 export되는 경우에만 해석되어 사용됨.
        - css string으로 만들어질 때 "-kayak-"이 접두어로 붙어 생성된다.
        - 참고 : TB_StyleContext.js의 build_css_str()참고
    */
    css_string(style_info: StyleInfo, result_context: StyleResultContext): void {
        if (style_info.letter_space != undefined) {
            result_context.raw_data.letter_space = style_info.letter_space;
        }
    }
    style_setter(style_info: StyleInfo, attr: ATTR_LetterSpacing): void {
        // attr의 type은 ATTR_LetterSpacing임.
        style_info.letter_space = attr.letter_space;
    }
}

export default ATTR_LetterSpacing;
