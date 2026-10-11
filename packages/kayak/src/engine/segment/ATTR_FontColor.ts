/*
    ATTR_* 추가시 "//D Layer"로 표시된 곳 찾아 추가 작업을 할 것.
*/

import SEGC from './segment_const';
import type { GxFlag } from './segment_const';
import type { ISegAttr, StyleInfo, StyleResultContext, GradientSpec, ColorModel } from './types';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';

/* ATTR_FontColor

	fontColorCMYK는 printing용으로 편집기를 사용할 경우, source color로 사용됨.

	fontColor가 Object이면 gradient 정보를 가진 것임
	이 경우 gradient object는 immutable임
	interface gradient {
		type:string 			// "linear" | "radial"
		geom: {
			x1, y1, x2, y2 		// if type is "linear"   #둘 중 하나
			cx, c,y r, fx, fy	// if type is "radial"
		}
		stops: [
			{
				offset:string			// ex. "50%"
				rgb:string				// ex. "#ff0000"
				cymk: Array<number>[4]	// ex.[100, 0, 100, 0]

			}
		],
		angle: number
	}

	model
	interface model {
		"type": "SPOT",
		"name": "PANTONE 314 C"
	}

*/
class ATTR_FontColor implements ISegAttr {
    _attr_class_name = 'ATTR_FontColor';

    // common values
    private _nGravityExFlag: GxFlag = SEGC.GXFLAG_BOTH;
    m_nCount = 1;

    // this.gradient가 null이 아니면 gradient color 상태임
    fontColor: string | null = null;
    fontColorCMYK: number[] | null = null;
    gradient: GradientSpec | null = null;
    fontColorModel: ColorModel | null = null;

    constructor(fontColor?: string | GradientSpec, fontColorCMYK?: number[] | null, fontColorModel?: ColorModel | null) {
        this.reset(fontColor, fontColorCMYK, fontColorModel);
    }

    reset(fontColor?: string | GradientSpec, fontColorCMYK?: number[] | null, fontColorModel?: ColorModel | null): void {
        this.m_nCount = 1;

        this.fontColor = null;
        this.fontColorCMYK = null;
        this.gradient = null;

        let is_gradient = fontColor instanceof Object;
        if (is_gradient == false) {
            this.fontColor = fontColor != undefined ? (fontColor as string) : "#000000";
            this.fontColorCMYK = fontColorCMYK != undefined ? fontColorCMYK : null; // [c, m, y, k]
        }
        else {
            this.gradient = cloneDeep(fontColor as GradientSpec);
        }

        if (fontColorModel) {
            this.fontColorModel = cloneDeep(fontColorModel)
        }
    }

    clone(): ATTR_FontColor {
        var obj: ATTR_FontColor;
        if (this.gradient)
            obj = new ATTR_FontColor(this.gradient);
        else
            obj = new ATTR_FontColor(this.fontColor!, this.fontColorCMYK, this.fontColorModel);

        obj.setGravityExFlag(this._nGravityExFlag);
        obj.m_nCount = this.m_nCount;
        return obj;
    }

    factory(nCount?: number): ATTR_FontColor {
        // ATTR_FontColor.prototype.factory() 또는 bare function으로 불리면(this가 인스턴스가 아니면) 기본 인스턴스를 만든다.
        // seglayer_manager.setByDataObject()가 _attr_prototype.factory를 this 없이 호출한다.
        if (!(this instanceof ATTR_FontColor))
            return new ATTR_FontColor();
        var obj = this.clone();
        obj.m_nCount = (nCount === undefined) ? 1 : nCount;
        return obj;
    }

    equal(that: ISegAttr): boolean {
        const t = that as ATTR_FontColor;
        // lodash isEqual() for deep comparison.
        // CMYK·별색(model)이 다르면 병합되지 않도록 함께 비교한다. (인쇄용 색상 정보 보존)
        return (this.fontColor === t.fontColor &&
            isEqual(this.fontColorCMYK, t.fontColorCMYK) &&
            isEqual(this.gradient, t.gradient) &&
            isEqual(this.fontColorModel, t.fontColorModel));
    }

    getGravityExFlag(): GxFlag { return this._nGravityExFlag; }
    setGravityExFlag(val: GxFlag): void { this._nGravityExFlag = val; }

    set(that: any): void {
        this.m_nCount = that.m_nCount;
        this.fontColor = that.fontColor;
        this.fontColorCMYK = that.fontColorCMYK;
        this.gradient = that.gradient;
        this.fontColorModel = that.fontColorModel
    }

    getDataObject(): Record<string, any> {
        var obj = {
            m_nCount: this.m_nCount,
            fontColor: this.fontColor,
            fontColorCMYK: this.fontColorCMYK,
            gradient: this.gradient,
            fontColorModel: this.fontColorModel
        }
        return obj;
    }

    /*  css_string()과 style_setter()
        각각의 첫번째 argument인 style_info는 type이 동일함.
            - style_setter()로 지정한 것이 css_string()로 전달되는 구조임.

        style_setter()의 "attr" type은 ATTR_FontColor

        result_context.raw_data에 설정된 값은
        - clipboard로 export되는 경우에만 해석되어 사용됨.
        - css string으로 만들어질 때 "-kayak-"이 접두어로 붙어 생성된다.
        - 참고 : TB_StyleContext.js의 build_css_str()참고
    */
    css_string(style_info: StyleInfo, result_context: StyleResultContext): void {
        if (style_info.fontColor != undefined) {
            result_context.css_data.fontColor = 'color:' + style_info.fontColor + ';';

            if (style_info.fontColorCMYK)
                result_context.raw_data.color_cmyk = style_info.fontColorCMYK;
            else
                delete result_context.raw_data.color_cmyk;

            if (style_info.fontColorModel)
                result_context.raw_data.fontColorModel = btoa(JSON.stringify(style_info.fontColorModel));
            else
                delete result_context.raw_data.fontColorModel;

            delete result_context.raw_data.gradient_fill;
        }
        else if (style_info.gradient) {
            //todo btoa()로 나온 결과를 IE로 copy하는 경우 필드가 무시되니 다른 방식으로 인코딩 할 것.
            result_context.raw_data.gradient_fill = btoa(JSON.stringify(style_info.gradient))
            delete result_context.css_data.fontColor;
            delete result_context.raw_data.color_cmyk;
            delete result_context.raw_data.fontColorModel;
        }
    }
    style_setter(style_info: StyleInfo, attr: ATTR_FontColor): void {
        style_info.fontColor = attr.fontColor;
        style_info.fontColorCMYK = attr.fontColorCMYK;
        style_info.gradient = cloneDeep(attr.gradient);
        style_info.fontColorModel = cloneDeep(attr.fontColorModel)
    }
}

export default ATTR_FontColor;
