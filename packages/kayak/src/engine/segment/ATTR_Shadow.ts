import SEGC from './segment_const';
import type { GxFlag } from './segment_const';
import type { ISegAttr, StyleInfo, StyleResultContext, ShadowSpec } from './types';
import isEqual from 'lodash/isEqual';

/*
	shadow Object는 immutable이어야 함.

	interface shadow {
		size : number		// unit:mm
		angle : number		// unit:degree
		distance : number 	// unit:mm
		opacity: number		// 0~100
		color: string
	}
*/
class ATTR_Shadow implements ISegAttr {
    _attr_class_name = 'ATTR_Shadow';

    // common values
    private _nGravityExFlag: GxFlag = SEGC.GXFLAG_BOTH;
    m_nCount = 1;

    shadow: ShadowSpec;

    constructor(shadow?: ShadowSpec | null) {
        if (shadow) {
            this.shadow = {
                size : shadow.size,
                angle  : shadow.angle,
                distance  : shadow.distance,
                opacity  : shadow.opacity,
                color  : shadow.color,
            }
        }
        else  {
            this.shadow = {
                size : 0,
                angle  : 135,
                distance  : 0,
                opacity  : 100,
                color : '#000'
            }
        }
    }

    clone(): ATTR_Shadow {
        var obj = new ATTR_Shadow(this.shadow);
        obj.setGravityExFlag(this._nGravityExFlag);
        obj.m_nCount = this.m_nCount;
        return obj;
    }

    factory(nCount?: number): ATTR_Shadow {
        // ATTR_Shadow.prototype.factory() 또는 bare function으로 불리면(this가 인스턴스가 아니면) 기본 인스턴스를 만든다.
        // seglayer_manager.setByDataObject()가 _attr_prototype.factory를 this 없이 호출한다.
        if (!(this instanceof ATTR_Shadow))
            return new ATTR_Shadow();
        var obj = this.clone();
        obj.m_nCount = (nCount === undefined) ? 1 : nCount;
        return obj;
    }

    equal(that: ISegAttr): boolean {
        return isEqual(this.shadow, (that as ATTR_Shadow).shadow);
    }

    getGravityExFlag(): GxFlag { return this._nGravityExFlag; }
    setGravityExFlag(val: GxFlag): void { this._nGravityExFlag = val; }

    set(that: any): void {
        this.m_nCount = that.m_nCount;
        this.shadow = that.shadow;
    }

    getDataObject(): { m_nCount: number; shadow: ShadowSpec } {
        var obj = {
            m_nCount: this.m_nCount,
            shadow: this.shadow,
        }
        return obj;
    }

    /*  css_string()과 style_setter()
        각각의 첫번째 argument인 style_info는 type이 동일함.
            - style_setter()로 지정한 것이 css_string()로 전달되는 구조임.

        style_setter()의 "attr" type은 ATTR_Shadow

        result_context.raw_data에 설정된 값은
        - clipboard로 export되는 경우에만 해석되어 사용됨.
        - css string으로 만들어질 때 "-kayak-"이 접두어로 붙어 생성된다.
        - 참고 : TB_StyleContext.js의 build_css_str()참고
    */
    css_string(style_info: StyleInfo, result_context: StyleResultContext): void {
        if (style_info.shadow) {
            //todo btoa()로 나온 결과를 IE로 copy하는 경우 필드가 무시되니 다른 방식으로 인코딩 할 것.
            result_context.raw_data.shadow = btoa(JSON.stringify(style_info.shadow))
        }
    }
    style_setter(style_info: StyleInfo, attr: ATTR_Shadow): void {
        style_info.shadow = {};
        Object.assign(style_info.shadow, attr.shadow)
    }
}

export default ATTR_Shadow;
