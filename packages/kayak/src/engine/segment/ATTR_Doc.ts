/*
    ATTR_* 추가시 "//D Layer"로 표시된 곳 찾아 추가 작업을 할 것.

    -----------------> 중요 <--------------
    - Textbox_Verify.js:fix_bug_preference_bug() 부분 항상 확인 할 것.
*/

import SEGC from './segment_const';
import type { GxFlag } from './segment_const';
import type { ISegAttr, StyleInfo, StyleResultContext } from './types';

/* set()의 setMask 인자. 항목이 있는 것만 값이 설정됨 */
export interface DocSetMask {
    m_nCount?: number;
    vertical_align?: string;
    fit_to_content_height?: boolean;
    frame_height?: number;
}

///////////////////////////////////////////////////////////
// ATTR_Doc
///////////////////////////////////////////////////////////
class ATTR_Doc implements ISegAttr {
    _attr_class_name = 'ATTR_Doc';

    // common values
    private _nGravityExFlag: GxFlag = SEGC.GXFLAG_BOTH;
    m_nCount = 1;

    vertical_align!: string;
    fit_to_content_height!: boolean;
    frame_height!: number;

    constructor() {
        this.reset();
    }

    reset(): void {
        this.m_nCount = 1;
        this.vertical_align = 'top';
        this.fit_to_content_height = true;
        this.frame_height = 100;
    }

    clone(): ATTR_Doc {
        var obj = new ATTR_Doc();
        obj.setGravityExFlag(this._nGravityExFlag);
        obj.m_nCount = this.m_nCount;
        obj.vertical_align = this.vertical_align;
        obj.fit_to_content_height = this.fit_to_content_height;
        obj.frame_height = this.frame_height;
        return obj;
    }

    factory(nCount?: number): ATTR_Doc {
        // ATTR_Doc.prototype.factory() 또는 bare function으로 불리면(this가 인스턴스가 아니면) 기본 인스턴스를 만든다.
        // seglayer_manager.setByDataObject()가 _attr_prototype.factory를 this 없이 호출한다.
        if (!(this instanceof ATTR_Doc))
            return new ATTR_Doc();
        var obj = this.clone();
        obj.m_nCount = (nCount === undefined) ? 1 : nCount;
        return obj;
    }

    equal(that: ISegAttr): boolean {
        const t = that as ATTR_Doc;
        // frame_height는 원본이 느슨한 비교(==)를 썼으므로 동작 보존을 위해 그대로 둔다.
        return (this.vertical_align === t.vertical_align) &&
            (this.fit_to_content_height === t.fit_to_content_height) &&
            (this.frame_height == t.frame_height);
    }

    getGravityExFlag(): GxFlag { return this._nGravityExFlag; }
    setGravityExFlag(val: GxFlag): void { this._nGravityExFlag = val; }

    set(that: any, setMask?: DocSetMask): void {
        var value = setMask ? setMask : that;

        if (value.m_nCount !== undefined)
            this.m_nCount = value.m_nCount;

        if (value.vertical_align !== undefined)
            this.vertical_align = value.vertical_align;
        if (value.fit_to_content_height !== undefined)
            this.fit_to_content_height = value.fit_to_content_height;
        if (value.frame_height !== undefined)
            this.frame_height = value.frame_height;
    }

    getDataObject(): { m_nCount: number; vertical_align: string; fit_to_content_height: boolean; frame_height: number } {
        var obj = {
            m_nCount: this.m_nCount,
            vertical_align: this.vertical_align,
            fit_to_content_height: this.fit_to_content_height,
            frame_height: this.frame_height
        }
        return obj;
    }

    /*  css_string()과 style_setter()
        각각의 첫번째 argument인 style_info는 type이 동일함.
            - style_setter()로 지정한 것이 css_string()로 전달되는 구조임.

        style_setter()의 "attr" type은 ATTR_Doc

        result_context.raw_data에 설정된 값은
        - clipboard로 export되는 경우에만 해석되어 사용됨.
        - css string으로 만들어질 때 "-kayak-"이 접두어로 붙어 생성된다.
        - 참고 : TB_StyleContext.js의 build_css_str()참고
    */
    css_string(style_info: StyleInfo, result_context: StyleResultContext): void {
    }
    style_setter(style_info: StyleInfo, attr: ATTR_Doc): void {
        style_info.vertical_align = attr.vertical_align;
        style_info.fit_to_content_height = attr.fit_to_content_height;
        style_info.frame_height = attr.frame_height;
    }
}

export default ATTR_Doc;
