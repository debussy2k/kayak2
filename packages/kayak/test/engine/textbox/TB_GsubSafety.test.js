/*  Test
	> npm test -w kayak -- test/engine/textbox/TB_GsubSafety.test.js

	opentype.js 1.3.4의 GSUB 미지원 lookup 대응 로직 테스트.
	https://github.com/opentypejs/opentype.js/issues/627

	이 환경(node 8.9 + mocha 5)의 제약 때문에 픽스처 구성이 조금 특이하다.
	  - should를 require하고 폰트를 파싱하면 프로세스가 죽는다. 그래서 node 내장 assert를 쓴다.
	  - it() 안에서 opentype.loadSync()를 부르면 스택이 넘쳐 죽는다.
	  - 폰트를 3개 이상 파싱해도 죽는다.
	그래서 실제 폰트는 모듈 최상단에서 2개만 읽고, 구조만 보면 되는 경우는
	opentype.js가 파싱해 내놓는 모양을 그대로 흉내낸 객체를 쓴다.
*/

import { describe, it, beforeAll } from 'vitest';
import assert from 'assert';
import opentype from 'opentype.js';
import { fileURLToPath } from 'url';

import * as gsub_safety from '../../../src/engine/textbox/TB_GsubSafety';

const FONT_WITH_LIGA = fileURLToPath(new URL('../../fixtures/fonts/Museo500-Regular.otf', import.meta.url));

const RENDER_OPTIONS = { kerning: true, features: { liga: true, rlig: true } };

// liga가 참조하는 첫 lookup을 주어진 형태로 바꾼다.
function break_liga(font, lookupType, substFormat) {
	const gsub = font.tables.gsub;
	const liga = gsub.features.filter(rec => rec.tag === 'liga')[0];
	const index = liga.feature.lookupListIndexes[0];
	gsub.lookups[index].lookupType = lookupType;
	gsub.lookups[index].subtables = [{ substFormat: substFormat }];
	return font;
}

// opentype.js가 파싱한 gsub 모양을 흉내낸다.
function fake_font(tag, lookupType, substFormat) {
	return {
		tables: {
			gsub: {
				features: [{ tag: tag, feature: { lookupListIndexes: [0] } }],
				lookups: [{ lookupType: lookupType, subtables: [{ substFormat: substFormat }] }]
			}
		}
	};
}

const font_healthy = opentype.loadSync(FONT_WITH_LIGA);
const font_extension = break_liga(opentype.loadSync(FONT_WITH_LIGA), 7, 1);

describe('GSUB safety', function () {

	describe('is_liga_safe()', function () {

		it('returns true for a font without a GSUB table', function () {
			assert.strictEqual(gsub_safety.is_liga_safe({ tables: {} }), true);
		});

		it('returns true for a font whose liga uses supported lookups', function () {
			assert.strictEqual(gsub_safety.is_liga_safe(font_healthy), true);
		});

		it('returns true when an unsupported lookup is only reachable from a feature opentype.js never visits', function () {
			// calt는 순회 대상이 아니므로 type 7을 참조해도 문제가 없다.
			// 기존 검사는 lookup 전체를 훑어서 이런 폰트까지 거부했다.
			assert.strictEqual(gsub_safety.is_liga_safe(fake_font('calt', 7, 1)), true);
		});

		it('returns false when liga reaches an extension lookup', function () {
			assert.strictEqual(gsub_safety.is_liga_safe(font_extension), false);
		});

		it('returns false when liga reaches a context lookup of format 2', function () {
			// 기존 검사는 substFormat === 1만 보아서 이 경우를 놓쳤다.
			assert.strictEqual(gsub_safety.is_liga_safe(fake_font('liga', 5, 2)), false);
		});

		it('returns false when an arabic shaping feature reaches an unsupported lookup', function () {
			assert.strictEqual(gsub_safety.is_liga_safe(fake_font('medi', 6, 1)), false);
		});
	});

	// install 하기 전에 실제 라이브러리가 던지는지 먼저 확인한다.
	describe('stringToGlyphs() before the patch is installed', function () {

		it('throws the opentype.js 627 error for a font whose liga reaches an extension lookup', function () {
			assert.throws(function () {
				font_extension.stringToGlyphs('office', RENDER_OPTIONS);
			}, /is not yet supported/);
		});
	});

	describe('install_safe_string_to_glyphs()', function () {

		beforeAll(function () {
			gsub_safety.install_safe_string_to_glyphs(opentype);
		});

		it('returns glyphs instead of throwing for a font whose liga reaches an extension lookup', function () {
			const glyphs = font_extension.stringToGlyphs('office', RENDER_OPTIONS);
			assert.strictEqual(glyphs.length, 6);
		});

		it('falls back to one glyph per code point, counting a non-BMP hanja as one', function () {
			const text = '가' + String.fromCodePoint(0x20000) + 'office'; // 8 code points
			const glyphs = font_extension.stringToGlyphs(text, RENDER_OPTIONS);
			assert.strictEqual(glyphs.length, 8);
		});

		it('leaves a healthy font ligature substitution intact', function () {
			const names = font_healthy.stringToGlyphs('office', RENDER_OPTIONS).map(g => g.name);
			assert.ok(names.indexOf('f_f_i') !== -1, 'expected ligature glyph, got ' + names.join(','));
		});

		it('does not wrap twice when installed again', function () {
			const wrapped = opentype.Font.prototype.stringToGlyphs;
			gsub_safety.install_safe_string_to_glyphs(opentype);
			assert.strictEqual(opentype.Font.prototype.stringToGlyphs, wrapped);
		});
	});
});
