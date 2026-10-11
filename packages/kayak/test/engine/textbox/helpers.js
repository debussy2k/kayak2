/*
    textbox 하위 모듈 특성 테스트 공용.
    - 모듈 최상단에서 jsdom window를 TB_PlatformEnv에 넣는다 (TB_Dom/MeasureDiv/TB_Config가 _g.document를 쓴다).
    - make_tb(): 실제 TextBox 대신 테스트가 필요한 필드만 가진 가짜 tb.
*/
import { JSDOM } from 'jsdom';
import path from 'path';
import { fileURLToPath } from 'url';
import _g from '../../../src/engine/textbox/TB_PlatformEnv';
import fs from 'fs';
import opentype from 'opentype.js';
import { is_liga_safe } from '../../../src/engine/textbox/TB_GsubSafety';

export const { window } = new JSDOM('<!DOCTYPE html><body></body>');
_g.set({ window });

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const TEST_FONT = path.join(ROOT, 'test/fixtures/fonts/KoPubDotumMedium.ttf');

export function round(v, digits = 6) {
    if (typeof v === 'number')
        return Math.round(v * 10 ** digits) / 10 ** digits;
    if (Array.isArray(v))
        return v.map(x => round(x, digits));
    if (v && typeof v === 'object') {
        const o = {};
        for (const k of Object.keys(v)) o[k] = round(v[k], digits);
        return o;
    }
    return v;
}

/** 'Hi\nBye' 두 문단짜리 가짜 tb (text_core.m_text는 char code 배열, m_Par는 문단별 글자 수) */
export function make_tb(extra) {
    const text = 'Hi\nBye';
    return Object.assign({
        text_core: {
            m_text: Array.from(text, ch => ch.charCodeAt(0)),
            toRawString: (b, e) => text.slice(b, e),
        },
        m_Par: { _get_vec: () => [{ m_nCount: 3 }, { m_nCount: 3 }] },
    }, extra);
}

/** 저장소 폰트를 opentype.js로 직접 파싱한다 (네트워크 없음). FontManager.load_and_parse처럼 __liga_safe를 붙인다. */
export function load_test_font() {
    const b = fs.readFileSync(TEST_FONT);
    const font = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    font.__liga_safe = is_liga_safe(font);
    return font;
}
