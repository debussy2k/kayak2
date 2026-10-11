/*
	opentype.js 1.3.4의 GSUB 미지원 lookup 대응.
	https://github.com/opentypejs/opentype.js/issues/627

	opentype.js는 GSUB 전체를 순회하지 않는다. latinLigature가 latn/liga를,
	arabicRequiredLigatures가 arab/rlig를, arabicPresentationForms가
	arab/init,medi,fina를 조회할 뿐이다. 그 외 feature(calt, ccmp, locl, aalt 등)가
	참조하는 lookup은 방문하지 않으므로 어떤 형식이든 문제가 되지 않는다.

	순회 대상 feature가 FeatureQuery.getLookupMethod가 모르는 lookup을 참조하면
	"lookupType: N - substFormat: M is not yet supported" 예외가 발생한다.
	이 모듈은 폰트를 거부하는 대신 (1) 해당 폰트의 합자만 끄고 (2) 그래도 예외가
	나면 feature 없이 그리도록 후퇴시킨다.

	FeatureQuery는 export되지 않아 직접 patch할 수 없으므로 진입점을 감싼다.
*/

import type { Font } from 'opentype.js';

// FeatureQuery.getLookupMethod가 실제로 처리하는 (lookupType + substFormat) 조합.
const SUPPORTED_SUBST = ['11', '12', '21', '41', '63'];

// opentype.js가 실제로 순회하는 feature tag.
const WALKED_TAGS = ['liga', 'rlig', 'init', 'medi', 'fina'];

/*
	순회 대상 feature가 참조하는 lookup만 검사한다.
	false면 그 폰트는 합자를 끄고 써야 한다. 폰트 자체는 정상적으로 쓸 수 있다.
*/
function is_liga_safe(font: Font): boolean {
	let gsub = font && font.tables && font.tables.gsub;
	if (!gsub || !gsub.features || !gsub.lookups)
		return true;

	for (let rec of gsub.features) {
		if (!rec || WALKED_TAGS.indexOf(rec.tag) === -1)
			continue;

		let indexes = (rec.feature && rec.feature.lookupListIndexes) || [];
		for (let index of indexes) {
			let lookup = gsub.lookups[index];
			if (!lookup || !lookup.subtables)
				continue;

			for (let subtable of lookup.subtables) {
				let key = String(lookup.lookupType) + String(subtable.substFormat);
				if (SUPPORTED_SUBST.indexOf(key) === -1)
					return false;
			}
		}
	}
	return true;
}

/*
	Font.prototype.stringToGlyphs를 감싸 GSUB 예외를 흡수한다.
	여러 번 호출해도 한 번만 감싼다. 실제로 감쌌으면 true를 리턴한다.
*/
function install_safe_string_to_glyphs(opentype: { Font: typeof Font }): boolean {
	let proto = opentype.Font.prototype;
	if (proto.__kayak_safe_string_to_glyphs)
		return false;

	let original = proto.stringToGlyphs;

	proto.stringToGlyphs = function (s: string, options?: any) {
		try {
			return original.call(this, s, options);
		} catch (e) {
			// GSUB feature 적용 실패. feature 없이 코드포인트 1:1 매핑으로 후퇴한다.
			// opentype.js의 tokenizer도 Array.from()으로 코드포인트 단위로 자르므로
			// for...of를 써야 확장 한자 같은 surrogate pair에서 길이가 어긋나지 않는다.
			let notdef = this.glyphs.get(0);
			let glyphs = [];
			for (let ch of s)
				glyphs.push(this.glyphs.get(this.charToGlyphIndex(ch)) || notdef);
			return glyphs;
		}
	};

	// font 객체 열거시 딸려 나오지 않도록 숨긴다.
	Object.defineProperty(proto, '__kayak_safe_string_to_glyphs', {
		value: true,
		enumerable: false
	});
	return true;
}

export {
	is_liga_safe,
	install_safe_string_to_glyphs
};
