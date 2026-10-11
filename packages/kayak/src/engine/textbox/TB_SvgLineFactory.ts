import { TB_TextFxService } from './services/TB_TextFxService'
import type { TB_SvgTextRender } from './TB_SvgTextRender';
import type { TB_StyleService } from './services/TB_StyleService';
import type { TB_LineRenderOptions } from './TB_LineRenderOptions';
import type { Point } from '../geometry/types';
import type { TextBoxHost, TextLineRange, RenderStyle, FontContext, SvgPathEntry, SvgGlyphItem, LineMaxMetrics, SvgTextLine, StyleEntry } from './types';


export class TB_SvgLineFactory {
    tb: TextBoxHost;
    styleSerivce: TB_StyleService;
    svgTextRender: TB_SvgTextRender;

    constructor(textbox_obj: TextBoxHost, svgTextRender: TB_SvgTextRender, styleSerivce: TB_StyleService) {
        this.tb = textbox_obj;        
        this.styleSerivce = styleSerivce;
        this.svgTextRender = svgTextRender;
    }

    get_svg_textline(rng: TextLineRange, domLine: any, line_render_options: TB_LineRenderOptions | null): SvgTextLine {
        let svgdata = this.text_to_svg_paths(rng, domLine, line_render_options);
        /*  {
                svg_paths
                svg_glyph_arr
                width 
                metrics
            }        
        */
   
        // display:block을 만드시 할 것. <svg>에서 display속성을 주지 않으면 이상한 height가 나오니 주의할 것.
        let svg_style = (!this.tb.tbconfig.debug.show_linebox) ? '' : 'outline:1px solid #ffc65b77';  
        // xmlns는 svg사용시 반드시 적용할 것.
        let svg_path_string = TB_TextFxService.generate_svg_path_string(svgdata.svg_paths, domLine.uuid).svg_string;
		let svg_str = `<svg xmlns="http://www.w3.org/2000/svg" class='kayak-svg-line' width='${svgdata.width}' height='${svgdata.metrics.max_height}' style='${svg_style}'>
			<defs for="gradient"></defs>
			${svg_path_string}
        </svg>
        `
        return {
            line_content: svg_str,
            metrics: svgdata.metrics,
            svg_paths: svgdata.svg_paths, 
            svg_glyph_arr: svgdata.svg_glyph_arr,
            width: svgdata.width
        }
    }
    
    text_to_svg_paths(rng: TextLineRange, domLine: any, line_render_options: TB_LineRenderOptions | null): { svg_paths: SvgPathEntry[]; svg_glyph_arr: SvgGlyphItem[]; width: number; metrics: LineMaxMetrics } {
        let font_context: FontContext = {} as FontContext;
        let pos: Point = {x:0, y:0};
        let svg_paths: SvgPathEntry[] = [];
        let svg_glyph_arr: SvgGlyphItem[] = [];

        let styles = this.styleSerivce.get_styles(rng);
        
        /* metrics
            {
                max_ascender : 0,
                max_height : 0,         // sTypoAscender가 고려된 visible hight
                max_font_size_px : 0    // text line의 높이가 됨 
            }
        */
        let metrics = this.calc_max_metrics(styles);

        // reset fstyle
        let fstyle: RenderStyle = {
            kerning: true,
            ligature : true
        } as RenderStyle
        for (let i=0; i < styles.length - 1; i++) {
            Object.assign(fstyle, styles[i]);
            
            // 몇몇 font에서 '\n'이 공백으로 나오지 않고, box형태로 나오는 문제가 있어, '\n'는 ' '로 대치하여 얻음.
            let text = this.tb.text_core.toRawString(styles[i].pos, styles[i+1].pos, {new_line_as_space: true});
            
            let font = this.tb.fontloader!.getSync(fstyle.familyName, fstyle.typeStyle);
            if (font) {
                font_context = {
                    font : font,
                    domLine: domLine,
                    text_on_path : this.tb.text_on_path ? true : false
                }

                pos.y = metrics.max_ascender; // baseline의 위치로 사용됨.

                let result = this.svgTextRender.getSvgPathGlyphs(text, pos, fstyle, font_context)
                /* result
                    {
                        glyphs_path
                        glyph_arr		// only for text on path use
                        width_px
                        last_glyph_white_space
                        fontColor
                    }
                */
				// console.log('result: ', result);
				
                let str = result.glyphs_path.toPathData();
                //D181820 TB_TextOnPath_Draw.js의 render_svg_text()참고
                svg_paths.push({
                    d : str,
                    fill : fstyle.fontColor,
					fill_cmyk : fstyle.fontColorCMYK,
					color_model : fstyle.fontColorModel,
					shadow: fstyle.shadow,
					stroke: fstyle.stroke,
					gradient : fstyle.gradient
                })

                result.glyph_arr.forEach(item => {
                    item.fontColor = fstyle.fontColor;
                    item.fontColorCMYK = fstyle.fontColorCMYK; //D181820
					item.fontColorModel = fstyle.fontColorModel,
                    svg_glyph_arr.push(item)
                })

                pos.x += result.width_px;
            }
        }
      
        return {
            svg_paths: svg_paths, 
            svg_glyph_arr: svg_glyph_arr,
            width: pos.x, 
            metrics: metrics
        }
    }

    calc_max_metrics(styles: StyleEntry[]): LineMaxMetrics {
        let fstyle: RenderStyle = {
            kerning: true,
            ligature : true
        } as RenderStyle

        let metrics: LineMaxMetrics = {
            max_ascender : 0,
            max_ascender_d : 0, // 'd'의 ascender
            max_height : 0,             // sTypoAscender가 고려된 visible hight
            max_font_size_px : 0,       // text line의 높이가 됨 
            embox_height_offset : 0     // ascender와 em-box간의 간격. font-size의 10%임
        }

        // max ascender와 height를 먼저 구함.
        for (let i=0; i < styles.length - 1; i++) {
            Object.assign(fstyle, styles[i]);
            let font = this.tb.fontloader!.getSync(fstyle.familyName, fstyle.typeStyle);
            if (font) {
                let font_size_px = fstyle.FontSize * 96 / 72; // "pt" to "px"
                let ascender_px = 0;
                let ascender_d_px = 0;

                ascender_px = font.tables.os2.sTypoAscender * font_size_px / font.unitsPerEm; 
                ascender_d_px = font.charToGlyph('d').getBoundingBox().y2 * font_size_px / font.unitsPerEm;
                
                // height_px는 svg가 표시될 box의 height임. 
                // 참고: https://glyphsapp.com/tutorials/vertical-metrics
                let height_px = font_size_px;
                // let height_px   = (font.tables.os2.sTypoAscender - font.descender) * font_size_px / font.unitsPerEm;


                metrics.max_font_size_px   = Math.max(font_size_px, metrics.max_font_size_px);
                metrics.max_ascender = Math.max(ascender_px, metrics.max_ascender);
                metrics.max_ascender_d = Math.max(ascender_d_px, metrics.max_ascender_d)
                metrics.max_height   = Math.max(height_px, metrics.max_height);
            }
        }        
       
        return metrics;
    }
}