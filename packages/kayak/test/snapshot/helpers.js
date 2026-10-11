/*
    렌더링 스냅샷 테스트 공용 헬퍼.

    - 빌드 없이 src/node.ts를 직접 import해서 jsdom 위에 textbox를 만든다.
    - 샘플 JSON의 폰트 URL은 대부분 죽어 있으므로 네트워크를 쓰지 않는다.
      TB_PlatformEnv.get_font_filepath를 가로채 모든 폰트 요청을 저장소 안의 한글 폰트 하나로 돌린다.
    - shortid로 만든 id는 실행마다 달라지므로 normalize()로 고정 문자열로 바꾼다.
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expect } from 'vitest';
import { JSDOM } from 'jsdom';
import * as M1TextBox from '../../src/node';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SAMPLE_DIR = path.join(ROOT, 'test/fixtures/kayak_json_samples');
// KoPub 서체는 재배포가 허용된다. 한글 글리프가 있는 폰트가 저장소 안에서 이것뿐이다.
export const TEST_FONT = path.join(ROOT, 'test/fixtures/fonts/KoPubDotumMedium.ttf');

const { window } = new JSDOM('<!DOCTYPE html><body></body>');

M1TextBox.TB_PlatformEnv.set({
    window,
    fsReadFile: () => fs.readFile,
    // 어떤 폰트를 요청하든 TEST_FONT를 돌려준다. url이 null이면 기본 폰트 요청이다.
    get_font_filepath: (font_url, font_issue, font_key_name, download_folder, cb) => cb(null, TEST_FONT),
    delete_downloaded_font_file: () => Promise.resolve(),
});

/*
    id 속성값을 등장 순서대로 id1, id2…로 바꾸고, 그 id를 가리키는 참조(href="#…", url(#…))도 같은 이름으로 바꾼다.
    실행마다 달라지는 shortid를 지우면서도 "어떤 <use>가 어떤 <path>를 가리키는지"는 스냅샷에 남긴다.
    정의되지 않은 id를 가리키는 참조는 그대로 둔다 (끊어진 참조가 스냅샷에 드러나도록).
*/
export function normalize(s) {
    s = String(s);
    const map = new Map();
    for (const m of s.matchAll(/\sid="([^"]+)"/g)) {
        if (!map.has(m[1])) map.set(m[1], `id${map.size + 1}`);
    }
    return s.replace(/(\sid="|href="#|url\(#)([^"\)]+)/g, (whole, prefix, id) =>
        map.has(id) ? prefix + map.get(id) : whole);
}

/*
    화면 DOM 덤프. kayak-root(tb.element)만이 아니라 base_node 전체를 덤프한다.
    text-on-path 모드의 실제 렌더링은 kayak-root의 형제 노드 .kayak-textonpath에 그려지기 때문이다.

    한계: 이 프로젝트의 jsdom 11(cssstyle 0.2)은 transform, transform-origin 같은 CSS 속성을 저장하지 않는다.
    그래서 HTML 덤프에는 TextBox.scale()이 남기는 inline transform이 보이지 않는다.
    (SVG 속성으로 들어가는 변환은 보존되므로 text-on-path의 scale 결과는 덤프된다.)
*/
export function dump_html(tb) {
    return tb.__base_node.innerHTML;
}

export async function create_textbox(extra) {
    const base = window.document.createElement('div');
    window.document.body.appendChild(base);
    const tb = new M1TextBox.textbox(Object.assign({
        // TextBox.js는 `options.schema == false`를 엄격히 비교하므로 (undefined면 거짓)
        // text_on_path 옵션이 먹으려면 schema:false를 명시해야 한다.
        schema: false,
        base_node: base,
        page: { width: 300, height: 300, gutter_top: 0, gutter_bottom: 0, scale: 1 },
        content: { width: 300 },
        font_list_id: 'default-host-ko',
        node_env: { base_folder_for_download: 'test' },
        masterClipboard: M1TextBox.GT_MasterClipboard.getInstance(),
    }, extra));
    tb.__base_node = base;
    await tb.init();
    return tb;
}

export function destroy_textbox(tb) {
    try { tb.destroy(); } catch (e) { /* 이미 파괴된 경우 */ }
    tb.__base_node.remove();
}

function as_json_string(v) {
    return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
}

// HTML/SVG/JSON 세 가지를 test/snapshot/__snapshots__/<tag>.<step>.* 와 비교한다.
export async function expect_dump(tb, tag, step) {
    const base = `./__snapshots__/${tag}.${step}`;
    await expect(normalize(dump_html(tb))).toMatchFileSnapshot(`${base}.html`);
    await expect(normalize(tb.snapshotAsSVG({ path_only: false }))).toMatchFileSnapshot(`${base}.svg`);
    await expect(normalize(as_json_string(tb.saveAsJson()))).toMatchFileSnapshot(`${base}.json`);
}
