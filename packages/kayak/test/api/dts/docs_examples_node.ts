/*
    docs/usage/06-recipes.md "Node에서 kayak JSON을 SVG로" 예제를 dist/m1textbox_node.d.ts에 대고 컴파일한다.
    문서의 예제는 JS(require)이고 여기서는 import로 쓴다. fs·jsdom·폰트 캐시는 @types/node 없이 컴파일하려고 declare로 대신한다.
*/
import * as M1TextBox from '../../../dist/m1textbox_node';

declare const fs: { readFile(path: string, cb: (err: Error | null, data: Uint8Array) => void): void };
declare const window: Window & typeof globalThis;      // new JSDOM(...).window
declare const my_font_cache: {
    get(font_url: string | null, font_issue: string | null, font_key_name: string | null, download_folder: string | null): Promise<string>;
    remove(font_key_name: string, download_folder: string): Promise<void>;
};

M1TextBox.TB_PlatformEnv.set({
    window,
    fsReadFile: () => fs.readFile,
    get_font_filepath: (font_url, font_issue, font_key_name, download_folder, cb) => {
        my_font_cache.get(font_url, font_issue, font_key_name, download_folder)
            .then(path => cb(null, path), err => cb(err, ''));
    },
    delete_downloaded_font_file: (font_key_name, download_folder) => my_font_cache.remove(font_key_name, download_folder),
});

async function render(kayak_json_str: string, width: number): Promise<string> {
    const base = window.document.createElement('div');
    window.document.body.appendChild(base);

    const tb = new M1TextBox.textbox({
        schema: false,
        base_node: base,
        page: { width, height: 100, gutter_top: 0, gutter_bottom: 0, scale: 1 },
        content: { width, default_font_size: 12, default_align: 'left', default_font_color: { rgb: 'black', cmyk: [0, 0, 0, 100] } },
        font_list_id: 'default-host-ko',
        node_env: { base_folder_for_download: './font_download' },
        masterClipboard: M1TextBox.GT_MasterClipboard.getInstance(),
    });
    await tb.init();
    await tb.loadFromJson(kayak_json_str, { remove_textonpath_if_already_exist: true });
    const svg = tb.snapshotAsSVG();

    tb.detach();
    tb.destroy();
    base.remove();
    return svg;
}
void render;
