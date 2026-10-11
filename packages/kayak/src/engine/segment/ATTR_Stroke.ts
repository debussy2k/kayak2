import SEGC from './segment_const';
import type { GxFlag } from './segment_const';
import type { ISegAttr, StyleInfo, StyleResultContext, StrokeSpec } from './types';
import isEqual from 'lodash/isEqual';

/*
	stroke Object는 immutable이어야 함.

	interface stroke {
		weight: number				// unit: "pt" (중요: px아님)
		align: string				// "center" | "outside"

		color:
		colorCMYK:

		// 추후 필요시 구현
		// indesign의 옵션 참고: https://www.indesignjs.de/extendscriptAPI/indesign-latest/#TextFrame.html
		endCap:
		endJoin:
		miterLimit:
		...등등
	}
*/
class ATTR_Stroke implements ISegAttr {
    _attr_class_name = 'ATTR_Stroke';

    // common values
    private _nGravityExFlag: GxFlag = SEGC.GXFLAG_BOTH;
    m_nCount = 1;

    stroke: StrokeSpec;

    constructor(stroke?: StrokeSpec | null) {
        if (stroke) {
            this.stroke = {
                weight : stroke.weight,
                align  : stroke.align,
                color  : stroke.color,
                join   : (stroke.join == undefined) ? 'round' : stroke.join,
                miterlimit: (stroke.miterlimit === undefined) ? 10 : stroke.miterlimit
            }
        }
        else  {
            this.stroke = {
                weight: 0,
                align: 'outside',
                color: '#000',
                join   : 'round',
                miterlimit: 10
            }
        }
    }

    clone(): ATTR_Stroke {
        var obj = new ATTR_Stroke(this.stroke);
        obj.setGravityExFlag(this._nGravityExFlag);
        obj.m_nCount = this.m_nCount;
        return obj;
    }

    factory(nCount?: number): ATTR_Stroke {
        // ATTR_Stroke.prototype.factory() 또는 bare function으로 불리면(this가 인스턴스가 아니면) 기본 인스턴스를 만든다.
        // seglayer_manager.setByDataObject()가 _attr_prototype.factory를 this 없이 호출한다.
        if (!(this instanceof ATTR_Stroke))
            return new ATTR_Stroke();
        var obj = this.clone();
        obj.m_nCount = (nCount === undefined) ? 1 : nCount;
        return obj;
    }

    equal(that: ISegAttr): boolean {
        return isEqual(this.stroke, (that as ATTR_Stroke).stroke);
    }

    getGravityExFlag(): GxFlag { return this._nGravityExFlag; }
    setGravityExFlag(val: GxFlag): void { this._nGravityExFlag = val; }

    set(that: any): void {
        this.m_nCount = that.m_nCount;
        this.stroke = that.stroke;
    }

    getDataObject(): { m_nCount: number; stroke: StrokeSpec } {
        var obj = {
            m_nCount: this.m_nCount,
            stroke: this.stroke,
        }
        return obj;
    }

    /*  css_string()과 style_setter()
        각각의 첫번째 argument인 style_info는 type이 동일함.
            - style_setter()로 지정한 것이 css_string()로 전달되는 구조임.

        style_setter()의 "attr" type은 ATTR_Stroke

        result_context.raw_data에 설정된 값은
        - clipboard로 export되는 경우에만 해석되어 사용됨.
        - css string으로 만들어질 때 "-kayak-"이 접두어로 붙어 생성된다.
        - 참고 : TB_StyleContext.js의 build_css_str()참고
    */
    css_string(style_info: StyleInfo, result_context: StyleResultContext): void {
        if (style_info.stroke) {
            //todo btoa()로 나온 결과를 IE로 copy하는 경우 필드가 무시되니 다른 방식으로 인코딩 할 것.
            result_context.raw_data.stroke = btoa(JSON.stringify(style_info.stroke))
        }
    }
    style_setter(style_info: StyleInfo, attr: ATTR_Stroke): void {
        style_info.stroke = {};
        Object.assign(style_info.stroke, attr.stroke)
    }
}

export default ATTR_Stroke;
