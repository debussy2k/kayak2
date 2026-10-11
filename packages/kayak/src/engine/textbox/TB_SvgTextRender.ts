
// opentype.js v1.3.4 + hasChar() 수정. 수정 내용은 patches/opentype.js+1.3.4.patch (npm install 시 patch-package가 적용)
import opentype from "opentype.js";
import type { Glyph, Path } from "opentype.js";
import type { Point } from '../geometry/types';
import type { RenderStyle, FontContext, GlyphBox, GlyphMeasured, GlyphDimension, SvgGlyphItem, SvgPathGlyphsResult } from './types';

interface GlyphCtx { fontScale: number; jstf_space: number; space_by_letter_space_em: number; glyph_horz_scale: number; glyphs: Glyph[] }

/*  
	Note
	- OpenType.js에서 사용하는 font-size단위는 "px"임.
*/

/* sample usage
		this.fontManager.get(this.fstyle.name, this.fstyle.style, (err, font) => {
			if (err) {
				console.log("FONT ERR", err);

				this.text_line_glyphs_path = '';
				this.line_width = 0;
				return;
			}


			let metrics = {
				height_px   : (font.ascender - font.descender) * this.fstyle.size / font.unitsPerEm,
				ascender_px : font.ascender * this.fstyle.size / font.unitsPerEm
			}
	
			let style = {
				FontSize : this.fstyle.size,
				letter_space : this.fstyle.letter_space,
				letter_scale_x : this.fstyle.letter_scale_x,
				kerning : this.fstyle.kerning,
				ligature : this.fstyle.ligature	
			}
	
			this.font_context = {
				font: font,
				metrics: metrics,
			};
	
			let pos = {
				x : 0,
				y:  font.ascender * this.fstyle.size / font.unitsPerEm
			}
	
			this.svgTextRender.getSvgPathGlyphs(this.text, pos, style, this.font_context, result => {
				// 	result.glyphs_path
				//	result.width_px

				this.text_line_glyphs_path = result.glyphs_path.toPathData();	// convert to "svg path data"
				this.line_width = result.width_px;
			})
	
			let dim = this.svgTextRender.getGlyphsDimension(this.text, pos, style, this.font_context);
			console.log(dim);
		})
*/


class TB_SvgTextRender {
	// public	
	/*
		interface style {
			FontSize		: Number
			letter_space 	: Number (unit:1/1000em)
			letter_scale_x 	: Number (unit:%)
			kerning 		: Boolean
			ligature 		: Boolean
		}
		interface font_context {
			font : <opentype Font>
			domLine : <DomLine>domLine
		}

		result type of "callback(result)" : {
			glyphs_path : <svg path data>
			width_px : Number
		}
	*/
	getSvgPathGlyphs(text: string, pos: Point, style: RenderStyle, font_context: FontContext): SvgPathGlyphsResult {
		let font_size_px = style.FontSize * 96 / 72;				
		let glyphs_path = new opentype.Path();
		let glyph_arr: SvgGlyphItem[] = [];

		// 이 options은 아래 Glyph::getPath()에 사용되기 위한 것. 
		// 이 options은 아래 Glyph::getPath()에 사용되기 위한 것. 
		let glyph_options = {
			xScale : (style.letter_scale_x/100) / font_context.font.unitsPerEm * font_size_px,
			yScale : 1 / font_context.font.unitsPerEm * font_size_px,
		}

		let glyph_measured = this.forEachGlyph(text, pos.x, pos.y, style, font_context, (glyph: Glyph, gx: number, gy: number, gFontSize: number, glyph_box: GlyphBox) => {
			// line:123 - https://github.com/nodebox/opentype.js/blob/6aa2e73910167940bc19642099ea08d316416f10/src/glyph.js
			const glyphPath = glyph.getPath(gx, gy, gFontSize, glyph_options, font_context.font);

			// https://github.com/nodebox/opentype.js/blob/6aa2e73910167940bc19642099ea08d316416f10/src/path.js
			// Add the given path or list of commands to the commands of this path.
			glyphs_path.extend(glyphPath);

			if (font_context.text_on_path) {
				let font = font_context.font;
				glyph_arr.push({
					glyphPath: glyph.getPath(0, 0, gFontSize, glyph_options, font),
					gx: gx,
					gy: gy,
					glyph_width: glyph_box.glyph_width,
					ascender: font.tables.os2.sTypoAscender * font_size_px / font.unitsPerEm,
					descender: font.descender * font_size_px / font.unitsPerEm,
					fontColor: '',
					fontColorCMYK: '',

				})
			}
		})

		return {
			glyphs_path : glyphs_path,
			glyph_arr: glyph_arr,	// only for text on path use
			width_px : glyph_measured.width_px,
			last_glyph_white_space : glyph_measured.last_glyph_white_space
		};
	}

	// public 
	getGlyphsDimension(text: string, pos: Point, style: RenderStyle, font_context: FontContext): GlyphDimension {
		if (style.FontSize == undefined)
			throw "error";
			
		let font_size_px = style.FontSize * 96 / 72;		
		let glyph_measured = this.forEachGlyph(text, pos.x, pos.y, style, font_context, null);

		let key: string | null = null;
		if (this._is_justified(font_context.align)) {
			key = this._getStyleKey(style);
			console.assert(key != null);
		}

		return {
			key: key,
			count: text.length,
			width : glyph_measured.width_px,
			last_glyph_width : glyph_measured.last_glyph_width,
			last_glyph_white_space : glyph_measured.last_glyph_white_space,
			// 글줄의 높이는 지정된 폰트의 px환산값과 동일하다.
			// DomLine.max_word_height 값으로 전달됨
			height: font_size_px 
		}
	}	

	// private 
	// 참고 : https://github.com/nodebox/opentype.js/blob/c888fc38ff49dd050c77fcf06dd4eadef902ad26/src/font.js
	forEachGlyph(text: string, x: number, baseline_y: number, style: RenderStyle, font_context: FontContext, callback: ((glyph: Glyph, gx: number, gy: number, gFontSize: number, glyph_box: GlyphBox) => void) | null): GlyphMeasured {
		let font_size_px = style.FontSize * 96 / 72;
		let glyphs = this._getGlyphs(text, style, font_context)	// ligature를 처리하면 원래 text의 length보다 glyphs의 length가 작을 수 있다.
		
		let ctx: GlyphCtx = {
			fontScale 				 : 1 / font_context.font.unitsPerEm * font_size_px,
			jstf_space 				 : this._getJustificationSpace(style, font_context),
			space_by_letter_space_em : (style.letter_space / 1000) * font_size_px,
			glyph_horz_scale 		 : style.letter_scale_x/100,
			glyphs 					 : glyphs
		}

		let width_px = 0;
		let glyph_box: GlyphBox | null = null;
		for (let i = 0; i < glyphs.length; i++) {
			glyph_box = this._getGlyphBox(glyphs[i], glyphs[i+1], style, font_context, ctx);

			callback && callback(glyphs[i], x+width_px, baseline_y, font_size_px, glyph_box);

			if (font_context.domLine && font_context.textRng) {
				let cur_ci_doc = font_context.textRng.begin + i;
				let core_end = font_context.textRng.ci_lend_doc! - font_context.domLine.trailing_ws_count -1;
				if (cur_ci_doc >= core_end)
					ctx.jstf_space = 0;
			}

			// InDesign은 letter space까지 포함된 advance에 해새 scale-x를 적용함.
			let rendered_advance = glyph_box.glyph_width + glyph_box.space_width + ctx.jstf_space;
		
			width_px += rendered_advance;
		}
		
		//D171205-justification
		return {
			width_px : width_px,
			// glyph가 차지하는 width를 제외한 white space 영역 (right align 및 justification에 필요)
			last_glyph_width : glyph_box!.glyph_width,
			last_glyph_white_space : ctx.space_by_letter_space_em * ctx.glyph_horz_scale
		}
	}	

	// private 
	// ---------------------------------------------------------------------------------------

	_getGlyphBox(glyph: Glyph, glyph_next: Glyph | undefined, style: RenderStyle, font_context: FontContext, ctx: GlyphCtx): GlyphBox {
		let glyph_box: GlyphBox = {
			full_width : 0,
			glyph_width : 0,
			space_width : 0				
		}

		if (glyph.advanceWidth) {
			glyph_box.glyph_width = glyph.advanceWidth * ctx.fontScale;
		}

		if (style.kerning && glyph_next) {
			const kerningValue = ctx.fontScale * font_context.font.getKerningValue(glyph, glyph_next);
			glyph_box.space_width += kerningValue;
		}

		if (style.letter_space) {
			glyph_box.space_width += ctx.space_by_letter_space_em;
		}

		glyph_box.glyph_width = glyph_box.glyph_width * ctx.glyph_horz_scale;
		glyph_box.space_width = glyph_box.space_width * ctx.glyph_horz_scale;

		return glyph_box;
	}

	_getGlyphs(text: string, style: RenderStyle, font_context: FontContext): Glyph[] {
		/* 
			inDesign Ligature의 특성
			- letter space를 적용시 20em을 넘어가면  ligature가 풀리는 작동을 함.
			  (그와 관련하여 규칙을 아직 찾지는 못하였음.)
		*/
		//D171205-justification
		let liga_enabled = (style.ligature && style.letter_space <= 20) ? true : false;
		if (this._is_justified(font_context.align) || font_context.domLine && this._is_justified(font_context.domLine.alignment_option))
			liga_enabled = false;

		// 합자가 opentype.js의 미지원 GSUB lookup을 참조하는 폰트는 합자를 끈다. TB_GsubSafety.js 참고.
		if (font_context.font.__liga_safe === false)
			liga_enabled = false;

		let options = {
			kerning: style.kerning,
			features: {
				liga: liga_enabled,		// ligature
				rlig: liga_enabled		// recomended ligature
			},
			hinting : false // defalut:false
		}

		// glyph가 font에 없으면 공백문자열로 치환한다.
		let filtered_text = ''; 
		for (let ch of text)
			filtered_text += font_context.font.hasChar(ch) ? ch : ' '

		// ligature를 처리하면 원래 text의 length보다 glyphs의 length가 작을 수 있다.
		const glyphs = font_context.font.stringToGlyphs(filtered_text, options); // ligature등의 옵션
		return glyphs;
	}

		
	
	//D171205-justification
	_getStyleKey(style: RenderStyle): string {
		return `fS:${style.FontSize};ls:${style.letter_space};sx:${style.letter_scale_x}`;
	}
	
	//D171205-justification
	_getJustificationSpace(style: RenderStyle, font_context: FontContext): number {
		let jstf_space = 0;
		if (font_context.domLine && font_context.domLine.jstf_balance_info) {
			let key = this._getStyleKey(style);
			console.assert(key != undefined);
			let balance_info = font_context.domLine.jstf_balance_info[key];
			// balance_info sample in case of key "fS:18;ls:0;sx:100".
			// --> {width: 45.96, count: 4, balance_space_ratio: 0.027079130451177436}

			// undefined인 경우에는 non white space 글자가 2개 이하인 경우임. 
			if (balance_info != undefined) {
				let real_space = (font_context.domLine.line_width - font_context.domLine.core_width);
				jstf_space = real_space * balance_info.balance_space_ratio!;
			}
		}

		return jstf_space;
	}

	_is_justified(val?: string | null): boolean {
		return val == 'left-justified' ||
		val == 'center-justified' ||
		val == 'right-justified' ||
		val == 'fully-justified';
	}	
}

export { 
	TB_SvgTextRender 
};
