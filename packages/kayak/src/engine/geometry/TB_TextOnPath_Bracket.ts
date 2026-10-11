import TB_Dom from '../textbox/TB_Dom';
import { MathUtil } from './MathUtil'
import type { TB_TextOnPath } from './TB_TextOnPath'
import type { Point, BracketLine, BracketTag } from './types'

class TB_TextOnPath_Bracket {
    tp: TB_TextOnPath;
    svg_bracket: Element | null;
    base_transform: Element | null;
    bracket_layer: SVGElement | null;
    svg_bracket_start: string;
    svg_bracket_end: string;
    overflow_layer: SVGElement | null;
    overflow_mark: Element | null;
    // init_brackets()에서 채운다
    bracket_start!: Element;
    bracket_start_box!: Element;
    bracket_end!: Element;
    bracket_end_box!: Element;

    constructor(tp: TB_TextOnPath) {
        this.tp = tp;

        this.svg_bracket = null;
        this.base_transform = null;
        this.bracket_layer = null;
		this.svg_bracket_start = '';
        this.svg_bracket_end = '';
        this.overflow_layer = null;
        this.overflow_mark = null;
        this.init_brackets();
    }

	init_brackets(): void {
		let svg_bracket = `
			<svg width="100%" height="100%" style='overflow:visible; pointer-events:none; position:absolute; left:0px; top:0px'>
				<style> 
					.bracket {
						pointer-events:all;
						cursor: pointer;
					}
					.bracket:hover {
						stroke: red;
                    }
                    
					.bracket-group {
						pointer-events:all;
						cursor: pointer;
					}
                </style>	
                
                <defs>
                    <g id="bracket-box">
                        <rect x="0" y="-4" width="8" height="8" vector-effect="non-scaling-stroke" style="fill:none; stroke-width:1; stroke:gray" />
                    </g>
                    <g id="bracket-box-overflow">
                        <rect x="0" y="-4" width="8" height="8" vector-effect="non-scaling-stroke" style="fill:none; stroke-width:1 ;stroke:rgb(255,0,0)" />
                        <line x1="0" y1="0" x2="8" y2="0" vector-effect="non-scaling-stroke" style="fill:none; stroke-width:1 ;stroke:rgb(255,0,0)" />
                        <line x1="4" y1="-4" x2="4" y2="4" vector-effect="non-scaling-stroke" style="fill:none; stroke-width:1 ;stroke:rgb(255,0,0)" />
                    </g>                    
                </defs>

                <g class="base-transform">
                    <g class='bracket-layer'>
                        <g class="bracket-group right-bracket-group">
                            <use class="bracket-end-box" x="0" y="0" href=""/>
                            <path class="bracket bracket-end" d="" vector-effect="non-scaling-stroke" stroke="#61a5f4" stroke-width="3" fill="transparent"></path>
                        </g>

                        <g class="bracket-group left-bracket-group">
                            <use class="bracket-start-box" x="0" y="0" href=""/>
                            <path class="bracket bracket-start" d="" vector-effect="non-scaling-stroke" stroke="#61a5f4" stroke-width="3" fill="transparent"></path>
                        </g>
                    </g>

                    <g class='overflow-layer'>
                        <use class="overflow-mark" x="0" y="0" href=""/>
                    </g>
                </g>
			</svg>
        `
        
        this.svg_bracket = TB_Dom.createElement(svg_bracket);
		this.tp.svg_container.appendChild(this.svg_bracket);

        this.base_transform = this.svg_bracket.querySelector('.base-transform');

        // for brakcets
        this.bracket_layer = this.svg_bracket.querySelector<SVGElement>('.bracket-layer');
		this.bracket_start =  this.svg_bracket.querySelector('.bracket-start')!;
		this.bracket_start_box =  this.svg_bracket.querySelector('.bracket-start-box')!;
		this.bracket_end = this.svg_bracket.querySelector('.bracket-end')!;
        this.bracket_end_box =  this.svg_bracket.querySelector('.bracket-end-box')!;

        let left_group = this.svg_bracket.querySelector('.left-bracket-group')!;
        let right_group = this.svg_bracket.querySelector('.right-bracket-group')!;
        this.setup_mouse_for_bracket(left_group, 'start');
        this.setup_mouse_for_bracket(right_group, 'end');

        // for overflow mark
        this.overflow_layer = this.svg_bracket.querySelector<SVGElement>('.overflow-layer');
        this.overflow_mark =  this.svg_bracket.querySelector('.overflow-mark');

    }

    show_brackets(val: boolean): void {
        if (this.svg_bracket == null)
            return;

        this.bracket_layer!.style.display = (val == true) ? 'block' : 'none';
    }

    show_overflow_mark(val: boolean): void {
        if (this.svg_bracket == null)
            return;

        this.overflow_layer!.style.display = (val == true) ? 'block' : 'none';
    }

    setup_mouse_for_bracket(bracket_elem: Element, bracket_tag: BracketTag): void {
        let self = this;
        let tp = this.tp
        
        // mouseup일 때만 history에 command를 발생시키도록 함.
		let mousedown_listener = function(e: MouseEvent) {
            let mouse_moved = false;
            e.stopPropagation();
            e.preventDefault();     // 반드시 해 줄것. drag event 유발 방지.

            self.update_bracket_pos(e, bracket_tag);

            let mousemove_listener = function(e: MouseEvent) {
				mouse_moved = true;
                e.stopPropagation();
                
                self.update_bracket_pos(e, bracket_tag);
            }    
			let mouseup_listener = function(e: MouseEvent) {
				document.removeEventListener('mousemove', mousemove_listener);
				document.removeEventListener('mouseup', mouseup_listener);

				e.stopPropagation();

                self.update_bracket_pos(e, bracket_tag);

                let val = (bracket_tag == 'start') ? tp.start_bracket : tp.end_bracket;
                tp.tb.opStyle.set_textonpath_bracket(bracket_tag, val);

				//////////////////////////////////////////////////////////////////////
                // 배경에서 발생하는 click event를 무시하도록 함.
                // --> 필요없음. 
				// tp.mi.consume_click_event();
            }        
            
            document.addEventListener('mousemove', mousemove_listener)
			document.addEventListener('mouseup', mouseup_listener)
        }
        
        bracket_elem.addEventListener('mousedown', mousedown_listener as EventListener, true);   // Element의 리스너 타입은 (e: Event). 브라우저는 MouseEvent를 준다
    }
    
    update_bracket_pos(e: MouseEvent, bracket_tag: BracketTag): void {
        let tp = this.tp;
        
        let p = tp.get_transformed_mouse_pt(e);
        let ret = tp.tpath!.project_and_distance(p.x, p.y);
        
        /* 
            tp.start_bracket, tp.end_bracket가 같아져 inter bracket path의 길이가 0가 되지 않도록 함
        */
        if (bracket_tag == 'start') {
            tp.start_bracket = ret.length;
            if (!tp.tpath!.closed_path && ret.length >= tp.end_bracket) {
                tp.start_bracket = tp.end_bracket - 0.1;
            }
            else if (tp.tpath!.closed_path) {
                if (tp.start_bracket === tp.end_bracket)
                    tp.start_bracket = tp.end_bracket - 0.1; 
            }
        }
        else if (bracket_tag == 'end') {
            tp.end_bracket = ret.length;
            if (!tp.tpath!.closed_path && ret.length <= tp.start_bracket) {
                tp.end_bracket = tp.start_bracket + 0.1;
            }
            else if (tp.tpath!.closed_path) {
                if (tp.start_bracket === tp.end_bracket)
                    tp.end_bracket = tp.start_bracket + 0.1; 
            }
        }

        this.generate_inter_bracket_path(tp.start_bracket, tp.end_bracket)
        this.tp.update_view({cmd:'TPath.START_BRACKET'});
    }
    
    generate_inter_bracket_path(begin: number, end: number): void {
        this.tp.inter_bracket_path = this.tp.tpath!.getSubPath(begin, end); // TP_Path
        if (this.tp.inter_bracket_path.segments.length == 0) {
            console.error('inter bracket path segmentlength is zero')
            // prevent empty path
            this.tp.inter_bracket_path = this.tp.tpath!.getSubPath(0, 0.01);
        }
        this.tp.inter_bracket_path.precalc_length();
        // let svg = this.tp.inter_bracket_path.getSvgPathData();
        // console.log(svg);
    }
 
    render(): void {
        let tp = this.tp;
        this.render_bracket_start(tp.start_bracket)
        this.render_bracket_end(tp.end_bracket)
    }
 
    render_bracket_start(dist: number): void {
        let line_obj = this.tp.tb.layout!.get_tbdom().get_line_by_line_counter(0)
        if (line_obj.line == null)
            return;
        let max_word_height = line_obj.line.max_word_height;

        let {b, e, pt_on_path, nv, nv_angle} = this.get_bracket_line(dist, max_word_height);
        let center_pt = {
            x : (b.x + e.x)/2 - (nv.y * 1), 
            y : (b.y + e.y)/2  + (nv.x * 1)
        }
        let scale = 1/this.tp.tb.tbconfig.page.scale;
        TB_Dom.setAttrs(this.bracket_start_box, {
            x: center_pt.x,
            y: center_pt.y,
            'transform-origin': `${center_pt.x}px ${center_pt.y}px`,
            transform: `rotate(${nv_angle+90}) scale(${scale})`,
            href: "#bracket-box"            
        })

		this.svg_bracket_start = MathUtil.getSvgPathData_Line(b.x, b.y, e.x, e.y);
    }
    render_bracket_end(dist: number): void {
        let tbdom = this.tp.tb.layout!.get_tbdom();
        let show_more_symbol = tbdom.lineview_arr.length > 1;
        let line_obj = tbdom.get_line_by_line_counter(0)
        if (line_obj.line == null)
            return;

        let max_word_height = line_obj.line.max_word_height;

        let {b, e, pt_on_path, nv, nv_angle} = this.get_bracket_line(dist, max_word_height);
        let center_pt = {
            x : (b.x + e.x)/2 + (nv.y * 1), 
            y : (b.y + e.y)/2  - (nv.x * 1)
        }
        let scale = 1/this.tp.tb.tbconfig.page.scale;
        TB_Dom.setAttrs(this.bracket_end_box, {
            x: center_pt.x,
            y: center_pt.y,
            'transform-origin': `${center_pt.x}px ${center_pt.y}px`,
            transform: `rotate(${nv_angle-90}) scale(${scale})`,
            href: show_more_symbol ? "#bracket-box-overflow" : "#bracket-box"
        })

        this.svg_bracket_end = MathUtil.getSvgPathData_Line(b.x, b.y, e.x, e.y);
        
        // bracket end계산을 하는 김에 overflow mark도 계산함. (원래는 따로 계산하는게 나음)
        // text on path가 "focus" 상태일때 표시할 overflow mark의 계산
        TB_Dom.setAttrs(this.overflow_mark!, {
            x: center_pt.x,
            y: center_pt.y,
            'transform-origin': `${center_pt.x}px ${center_pt.y}px`,
            transform: `rotate(${nv_angle-90}) scale(${scale})`,
            href: show_more_symbol ? "#bracket-box-overflow" : ""
        })
    }

    get_bracket_line(dist: number, height: number): BracketLine {
        let p = this.tp.tpath!.getPosByDistance(dist, { normal:true, angle:true });        
        let b: Point, e: Point;

        const state = this.tp.tb.history.get_state().present.tpath;
        if (state.align_to_path == 'baseline') {
            b = {
                x: p.pt.x,
                y: p.pt.y
            }
            e = {
                x: p.pt.x - (p.nv!.x * height),
                y: p.pt.y - (p.nv!.y * height)                    
            }
        }
        else {
            b = {
                x: p.pt.x - (p.nv!.x * height/2),
                y: p.pt.y - (p.nv!.y * height/2)                
            }
            e = {
                x: p.pt.x + (p.nv!.x * height/2),
                y: p.pt.y + (p.nv!.y * height/2)
            }
        }
        return {b, e, pt_on_path:p.pt, nv:p.nv!, nv_angle:p.nv_angle!}
    }

    draw(): void {
        let tp = this.tp;
        
        let base_transform = `
            scale(${tp.tb.tbconfig.page.scale})
			translate(${-tp.bbox!.x}, ${-tp.bbox!.y})
		`
        
		this.base_transform!.setAttribute('transform', base_transform);
		this.bracket_start.setAttribute('d', this.svg_bracket_start);
        this.bracket_end.setAttribute('d', this.svg_bracket_end);
    }
}

export { TB_TextOnPath_Bracket }