/*
    ATTR_* 추가시 "//D Layer"로 표시된 곳 찾아 추가 작업을 할 것.
*/

import SEGC from './segment_const';
import type { GxFlag } from './segment_const';
import type { ISegAttr, StyleInfo, StyleResultContext } from './types';

/* seglayer_Par에서만 적용되는 것.
   항목이 있는 것만 값이 설정됨 (set()의 setMask 인자) */
export interface ParSetMask {
    m_nCount?: number;
    m_nLineGap?: number;
    m_Align?: string;
    m_Findent?: number;
    m_Lindent?: number;
    m_Rindent?: number;
    m_SpaceBefore?: number;
    m_SpaceAfter?: number;
    m_LineSpace?: number;
    m_Leading?: 'auto' | number;
}

///////////////////////////////////////////////////////////
// ATTR_PAR
///////////////////////////////////////////////////////////
class ATTR_Par implements ISegAttr {
    _attr_class_name = 'ATTR_Par';

    // common values
    private _nGravityExFlag: GxFlag = SEGC.GXFLAG_BOTH;
    m_nCount = 1;

    m_nLineGap!: number;
    m_Align!: string;              // left, center, right
    m_Findent!: number;            // m_Lindent에 대한 상대값 개념(offset)	First Line Indent
    m_Lindent!: number;            // 왼쪽 벽으로 부터의 거리					Left Indent
    m_Rindent!: number;            // 오른쪽 벽으로 부터의 거리				Right Indent
    m_SpaceBefore!: number;        // 단락 앞 공백 px
    m_SpaceAfter!: number;         // 단락 앞 공백 px
    m_LineSpace!: number;          // ratio. auto-leading.
    m_Leading!: 'auto' | number;   // leading. 'auto' 또는 number.

    constructor(nLineGap?: number) {
        this.reset(nLineGap);
    }

    reset(nLineGap?: number): void {
        this.m_nCount = 1;
        this.m_nLineGap = nLineGap != undefined ? nLineGap : 0;
        this.m_Align = 'left';
        this.m_Findent = 0;
        this.m_Lindent = 0;
        this.m_Rindent = 0;
        this.m_SpaceBefore = 0;
        this.m_SpaceAfter = 0;
        this.m_LineSpace = 1.2;
        this.m_Leading = 'auto';
    }

    clone(): ATTR_Par {
        var obj = new ATTR_Par(this.m_nLineGap);
        obj.setGravityExFlag(this._nGravityExFlag);
        obj.m_nCount = this.m_nCount;
        obj.m_Align = this.m_Align;
        obj.m_Findent = this.m_Findent;
        obj.m_Lindent = this.m_Lindent;
        obj.m_Rindent = this.m_Rindent;
        obj.m_SpaceBefore = this.m_SpaceBefore;
        obj.m_SpaceAfter = this.m_SpaceAfter;
        obj.m_LineSpace = this.m_LineSpace;
        obj.m_Leading = this.m_Leading;
        return obj;
    }

    factory(nCount?: number): ATTR_Par {
        // ATTR_Par.prototype.factory() 또는 bare function으로 불리면(this가 인스턴스가 아니면) 기본 인스턴스를 만든다.
        // seglayer_manager.setByDataObject()가 _attr_prototype.factory를 this 없이 호출한다.
        if (!(this instanceof ATTR_Par))
            return new ATTR_Par();
        var obj = this.clone();
        obj.m_nCount = (nCount === undefined) ? 1 : nCount;
        return obj;
    }

    equal(that: ISegAttr): boolean {
        const t = that as ATTR_Par;
        return (this.m_nLineGap === t.m_nLineGap) && (this.m_Align === t.m_Align) &&
            (this.m_Findent === t.m_Findent) &&
            (this.m_Lindent === t.m_Lindent) &&
            (this.m_Rindent === t.m_Rindent) &&
            (this.m_SpaceBefore === t.m_SpaceBefore) &&
            (this.m_SpaceAfter === t.m_SpaceAfter) &&
            (this.m_LineSpace === t.m_LineSpace) &&
            (this.m_Leading === t.m_Leading);
    }

    getGravityExFlag(): GxFlag { return this._nGravityExFlag; }
    setGravityExFlag(val: GxFlag): void { this._nGravityExFlag = val; }

    /* seglayer_Par에서만 적용되는 것.
    	항목이 "true"인 것만 값이 설정됨
    	setMask = {
    		m_nCount : Number,
    		m_Align  : String
    	}
    */
    set(that: any, setMask?: ParSetMask): void {
        var value = setMask ? setMask : that;

        if (value.m_nCount !== undefined) // 특수한 경우임.
            this.m_nCount = value.m_nCount;

        if (value.m_nLineGap !== undefined)
            this.m_nLineGap = value.m_nLineGap;
        if (value.m_Align !== undefined)
            this.m_Align = value.m_Align;
        if (value.m_Findent !== undefined)
            this.m_Findent = value.m_Findent;
        if (value.m_Lindent !== undefined)
            this.m_Lindent = value.m_Lindent;
        if (value.m_Rindent !== undefined)
            this.m_Rindent = value.m_Rindent;

        if (value.m_SpaceBefore !== undefined)
            this.m_SpaceBefore = value.m_SpaceBefore;
        if (value.m_SpaceAfter !== undefined)
            this.m_SpaceAfter = value.m_SpaceAfter;
        if (value.m_LineSpace !== undefined)
            this.m_LineSpace = value.m_LineSpace;

        if (value.m_Leading !== undefined)
            this.m_Leading = value.m_Leading;
    }

    getDataObject(): Record<string, any> {
        var obj = {
            m_nCount: this.m_nCount,
            m_nLineGap: this.m_nLineGap,
            m_Align: this.m_Align,
            m_Findent: this.m_Findent,
            m_Lindent: this.m_Lindent,
            m_Rindent: this.m_Rindent,
            m_SpaceBefore: this.m_SpaceBefore,
            m_SpaceAfter: this.m_SpaceAfter,
            m_LineSpace: this.m_LineSpace,
            m_Leading: this.m_Leading
        }
        return obj;
    }

    // ATTR_Par는 css를 만들지 않는다. 원본에는 css_string이 없었다. seglayer_manager.css_string()은
    // Par 레이어(index 0)를 건너뛰므로 호출되지 않는다. ISegAttr 계약을 위해 빈 메서드를 둔다.
    css_string(style_info: StyleInfo, result_context: StyleResultContext): void {
    }
    style_setter(style: StyleInfo, attr: ATTR_Par): void {
        style.start_of_par = true;
        style.par = {
            m_nLineGap: attr.m_nLineGap,
            m_Align: attr.m_Align,
            m_Findent: attr.m_Findent,
            m_Lindent: attr.m_Lindent,
            m_Rindent: attr.m_Rindent,
            m_SpaceAfter: attr.m_SpaceAfter,
            m_SpaceBefore: attr.m_SpaceBefore,
            m_LineSpace: attr.m_LineSpace,
            m_Leading: attr.m_Leading
        }
    }
}

export default ATTR_Par;
