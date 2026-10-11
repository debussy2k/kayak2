import _g from '../textbox/TB_PlatformEnv';
import { CGMatrix } from '../textbox/cg'
import type { TB_TextOnPath } from './TB_TextOnPath'
import type { Point } from './types'


class TB_TextOnPath_MouseInput {
    tp: TB_TextOnPath;
    last_mousedown_time: number;

    constructor(tp: TB_TextOnPath) {
        this.tp = tp;

		this.last_mousedown_time = (new Date()).getTime();        
    }
    
	is_double_clicked(): boolean {
		let cur_time = (new Date()).getTime();
		let time_lapse = cur_time - this.last_mousedown_time;
		this.last_mousedown_time = cur_time;
		return time_lapse < 300 ? true : false; // 500ms내 
	}  
	
	// this.svg_container의 left-top을 (0,0) 하는 mouse position을 리턴함
	// transform 및 scroll에 독립적임. cross browser 대응됨.
	get_offsetXY(e: MouseEvent, tp: TB_TextOnPath): Point {
        // e.pageXY   : relative to the leftTop of the document(fully rendered content area).
        // e.clientXY : relative to the leftTop of the browser window.

		let scale = tp.tb.tbconfig.page.scale

        // A. 회전하기 전의 kayak-root box를 확보한다.
        // getBoundingClientRect()는 browser화면을 기준으로 (transform되어 있더라도 그것의) bbox를 리턴한다. 
        var domRect = tp.svg_container.getBoundingClientRect();
        var dom_center = {
            x: domRect.left + domRect.width / 2,
            y: domRect.top + domRect.height / 2,
        }

        var box_width = tp.bbox!.width * scale;
        var box_height = tp.bbox!.height * scale;

        // 화면에 보이면 크기와 동일하지만, rotate하기 전(angle=0)의 box 영역임. 
        var orthogonal_box = {
            x: dom_center.x - box_width / 2,
            y: dom_center.y - box_height / 2
        }		

        // B. click한 mouse pos를 회전전의 대응점을 구한다.
        //
        var mat = new CGMatrix();
        var radian = tp.tb.tbconfig.transform.angle / 180 * Math.PI;
        mat.rotateAtCenter(-radian, dom_center);
        var mpos = { x: e.clientX, y: e.clientY };
        var tr_pt = mat.transformPoint(mpos);
		
		let offset = {
			x: (tr_pt.x - orthogonal_box.x),
			y: (tr_pt.y - orthogonal_box.y)
		}
		return offset;
    } 
    
    consume_click_event(): void {
        let click_listener = function(e: Event) {
            // console.log('consumed click..')
            document.removeEventListener('click', click_listener, true);
            e.stopPropagation();
            e.preventDefault();
        }
        document.addEventListener('click', click_listener, true);
    }
}

export { TB_TextOnPath_MouseInput };