import _g from '../textbox/TB_PlatformEnv';
import TextBoxDom from "./TextBoxDom";
import { TB_LayoutWalker } from './TB_layoutWalker'
import { TB_SvgGradientFactory } from './TB_SvgGradientFactory'
import type { TextBoxHost } from './types';

class TB_PostLayoutProcess {
	tb: TextBoxHost;
	layoutWalker: TB_LayoutWalker;

	constructor(tb: TextBoxHost) {
		this.tb = tb;
		this.layoutWalker = new TB_LayoutWalker(tb)
	}

	/*
		linear gradient의 위치를 보정한다.
		- indesign의 gradient는 적용된 텍스트 범위에 상관없이 textframe 전체 크기를 gradient영역이 대상이 된다.
	*/
	adjust_gradient(): void {
        let tbdom: TextBoxDom = this.tb.layout!.get_tbdom();
		let dim = this.tb.get_dimension();

		/* traverse_by_line(callback(data))
            param 
                data: { x, y, line, index }
            return
                { page_width, page_height}
       */
	   let frame = this.layoutWalker.traverse_by_line(data => {
		   	// console.log(data)
			let lineview = tbdom.lineview_arr[data.index];
			let svg_defs_node = lineview.querySelector('.kayak-line svg defs[for=gradient]')
			if (svg_defs_node)
				svg_defs_node.innerHTML = TB_SvgGradientFactory.build_gradient_defs(data, dim);
		})
	}
}

export { 
    TB_PostLayoutProcess
};
