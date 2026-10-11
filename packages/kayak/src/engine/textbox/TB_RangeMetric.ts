import type { Font } from 'opentype.js';
import type { GlyphDimension, StyleKeyGroup } from './types';

export class TB_RangeMetric {
	width: number;
	width_without_last_glyph_ws: number;
	last_style_key: string | null;
	last_glyph_width: number;
	last_glyph_white_space: number;
	height: number;     // font-size의 px 환산값임.
	ascent: number;
	ascent_d: number;
	descent: number;
	max_font_size_px: number;
	style_keys: Record<string, StyleKeyGroup>;

	constructor() {
		this.width = 0;
		this.width_without_last_glyph_ws = 0;
		this.last_style_key = null;            
		this.last_glyph_width = 0;
		this.last_glyph_white_space = 0;
		this.height = 0;     // font-size의 px 환산값임.
		this.ascent = 0;
		this.ascent_d = 0;
		this.descent = 0;
		this.max_font_size_px = 0;
		this.style_keys = {}
		/* 아래와 같은 구성이 됨.
			style_keys: {
				"fS:18;ls:0;sx:100": {
					width: 57.2,
					count: 3
				}, ...
			}
		*/	
	}

	set_with_dimension(dim: GlyphDimension): void {
		this.width += dim.width;
		this.last_style_key = dim.key;
		this.last_glyph_width = dim.last_glyph_width;
		this.last_glyph_white_space = dim.last_glyph_white_space;
        // dim.height --> font-size를 px로 환산한 값. 즉 font-size-height-px임.
		this.height = Math.max(dim.height, this.height);
		if (dim.key)
			this._group_by_style_key_for_justification(dim);
	}

	set_with_font(font: Font, font_size_px: number): void {
		let ascender_px = font.tables.os2.sTypoAscender * font_size_px / font.unitsPerEm;
		let ascender_d_px = font.charToGlyph('d').getBoundingBox().y2 * font_size_px / font.unitsPerEm;
		let descender_px = -font.descender * font_size_px / font.unitsPerEm;

		if (ascender_d_px > this.ascent_d) {
			this.ascent   = ascender_px;
			this.ascent_d = ascender_d_px;
			this.descent  = descender_px;
		}
		// this.ascent = Math.max(ascender_px, this.ascent);
		// this.ascent_d = Math.max(ascender_d_px, this.ascent_d);

		// descender는 sTypoDescender보다 더 아랫쪽에 위치하며, glyph가 표시될 수 있는 마지막 경계임. (font.descender를 사용한 이유)
		// 참고: https://glyphsapp.com/tutorials/vertical-metrics
		// let descender_px = -font.tables.os2.sTypoDescender * font_size_px / font.unitsPerEm;
		// this.descent = Math.max(descender_px, this.descent);	
	}

	//D171205-justification
	_group_by_style_key_for_justification(dim: GlyphDimension): void {
		if (this.style_keys.hasOwnProperty(dim.key!)) {
			this.style_keys[dim.key!].width += dim.width;
			this.style_keys[dim.key!].count += dim.count;
		}
		else {
			this.style_keys[dim.key!] = {
				width: dim.width,
				count: dim.count
			}
		}
	}
}