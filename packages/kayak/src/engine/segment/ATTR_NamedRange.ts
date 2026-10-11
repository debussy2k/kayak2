/*
    ATTR_* 추가시 "//D Layer"로 표시된 곳 찾아 추가 작업을 할 것.
*/

import SEGC from './segment_const';
import type { GxFlag } from './segment_const';
import type { ISegAttr, StyleInfo, StyleResultContext } from './types';

///////////////////////////////////////////////////////////
// ATTR_NamedRange
///////////////////////////////////////////////////////////
class ATTR_NamedRange implements ISegAttr {
    _attr_class_name = 'ATTR_NamedRange';

    // common values
    private _nGravityExFlag: GxFlag = SEGC.GXFLAG_BOTH;
    m_nCount = 1;

    var_name!: string;
    title!: string;

    constructor(var_name?: string, title?: string) {
        this.reset(var_name, title);
    }

    reset(var_name?: string, title?: string): void {
        this.m_nCount = 1;
        this.var_name = var_name != undefined ? var_name : '_na_';
        this.title = title != undefined ? title : '';
    }

    clone(): ATTR_NamedRange {
        var obj = new ATTR_NamedRange(this.var_name, this.title);
        obj.setGravityExFlag(this._nGravityExFlag);
        obj.m_nCount = this.m_nCount;
        return obj;
    }

    factory(nCount?: number): ATTR_NamedRange {
        // ATTR_NamedRange.prototype.factory() 또는 bare function으로 불리면(this가 인스턴스가 아니면) 기본 인스턴스를 만든다.
        // seglayer_manager.setByDataObject()가 _attr_prototype.factory를 this 없이 호출한다.
        if (!(this instanceof ATTR_NamedRange))
            return new ATTR_NamedRange();
        var obj = this.clone();
        obj.m_nCount = (nCount === undefined) ? 1 : nCount;
        return obj;
    }

    equal(that: ISegAttr): boolean {
        const t = that as ATTR_NamedRange;
        return (this.var_name === t.var_name) && (this.title === t.title);
    }

    getGravityExFlag(): GxFlag { return this._nGravityExFlag; }
    setGravityExFlag(val: GxFlag): void { this._nGravityExFlag = val; }

    set(that: any): void {
        this.m_nCount = that.m_nCount;
        this.var_name = that.var_name;
        this.title = that.title;
    }

    getDataObject(): { m_nCount: number; var_name: string; title: string } {
        var obj = {
            m_nCount: this.m_nCount,
            var_name: this.var_name,
            title: this.title
        }
        return obj;
    }

    /*  css_string()과 style_setter()
        각각의 첫번째 argument인 style_info는 type이 동일함.
            - style_setter()로 지정한 것이 css_string()로 전달되는 구조임.

        style_setter()의 "attr" type은 ATTR_NamedRange

        result_context.raw_data에 설정된 값은
        - clipboard로 export되는 경우에만 해석되어 사용됨.
        - css string으로 만들어질 때 "-kayak-"이 접두어로 붙어 생성된다.
        - 참고 : TB_StyleContext.js의 build_css_str()참고
    */
    css_string(style_info: StyleInfo, result_context: StyleResultContext): void {
        // noop
    }
    style_setter(style_info: StyleInfo, attr: ATTR_NamedRange): void {
        style_info.var_name = attr.var_name;
        style_info.title = attr.title;
    }
}

export default ATTR_NamedRange;
