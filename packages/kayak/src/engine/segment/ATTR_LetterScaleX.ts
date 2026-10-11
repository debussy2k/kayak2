/*
    ATTR_* 추가시 "//D Layer"로 표시된 곳 확인할 것.
*/

import SEGC from './segment_const';
import type { GxFlag } from './segment_const';
import type { ISegAttr, StyleInfo, StyleResultContext } from './types';

///////////////////////////////////////////////////////////
// ATTR_LetterScaleX
// value : %값임. 100은 100%
///////////////////////////////////////////////////////////
class ATTR_LetterScaleX implements ISegAttr {
    _attr_class_name = 'ATTR_LetterScaleX';

    // common values
    private _nGravityExFlag: GxFlag = SEGC.GXFLAG_BOTH;
    m_nCount = 1;

    letter_scale_x!: number;

    constructor(value?: number) {
        this.reset(value);
    }

    reset(value?: number): void {
        this.m_nCount = 1;
        this.letter_scale_x = value != undefined ? value : 100;
    }

    clone(): ATTR_LetterScaleX {
        var obj = new ATTR_LetterScaleX(this.letter_scale_x);
        obj.setGravityExFlag(this._nGravityExFlag);
        obj.m_nCount = this.m_nCount;
        return obj;
    }

    factory(nCount?: number): ATTR_LetterScaleX {
        // ATTR_LetterScaleX.prototype.factory() 또는 bare function으로 불리면(this가 인스턴스가 아니면) 기본 인스턴스를 만든다.
        // seglayer_manager.setByDataObject()가 _attr_prototype.factory를 this 없이 호출한다.
        if (!(this instanceof ATTR_LetterScaleX))
            return new ATTR_LetterScaleX();
        var obj = this.clone();
        obj.m_nCount = (nCount === undefined) ? 1 : nCount;
        return obj;
    }

    equal(that: ISegAttr): boolean {
        return (this.letter_scale_x === (that as ATTR_LetterScaleX).letter_scale_x);
    }

    getGravityExFlag(): GxFlag { return this._nGravityExFlag; }
    setGravityExFlag(val: GxFlag): void { this._nGravityExFlag = val; }

    set(that: any): void {
        this.m_nCount = that.m_nCount;
        this.letter_scale_x = that.letter_scale_x;
    }

    getDataObject(): { m_nCount: number; letter_scale_x: number } {
        var obj = {
            m_nCount: this.m_nCount,
            letter_scale_x: this.letter_scale_x
        }
        return obj;
    }

    /*  css_string()과 style_setter()
        각각의 첫번째 argument인 style_info는 type이 동일함.
            - style_setter()로 지정한 것이 css_string()로 전달되는 구조임.

        style_setter()의 "attr" type은 ATTR_LetterScaleX

        result_context.raw_data에 설정된 값은
        - clipboard로 export되는 경우에만 해석되어 사용됨.
        - css string으로 만들어질 때 "-kayak-"이 접두어로 붙어 생성된다.
        - 참고 : TB_StyleContext.js의 build_css_str()참고
    */
    css_string(style_info: StyleInfo, result_context: StyleResultContext): void {
        if (style_info.letter_scale_x != undefined) {
            result_context.raw_data.letter_scale_x = style_info.letter_scale_x;
        }
    }
    style_setter(style_info: StyleInfo, attr: ATTR_LetterScaleX): void {
        // attr의 type은 ATTR_LetterScaleX임.
        style_info.letter_scale_x = attr.letter_scale_x;
    }
}

export default ATTR_LetterScaleX;
