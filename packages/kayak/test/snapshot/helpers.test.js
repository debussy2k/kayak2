import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { normalize, dump_html, create_textbox, destroy_textbox, TEST_FONT, SAMPLE_DIR } from './helpers';

describe('snapshot helpers', () => {
    it('normalize()는 shortid 기반 id를 등장 순서대로 id1, id2…로 바꾸고 참조도 같이 바꾼다', () => {
        const a = '<defs><path id="p-Hk3_x9Ab"/><linearGradient id="grad-Hk3_x9Ab-0"/></defs>'
            + '<use xlink:href="#p-Hk3_x9Ab" fill="url(#grad-Hk3_x9Ab-0)"/>';
        const b = '<defs><path id="p-rY7qLmP2"/><linearGradient id="grad-rY7qLmP2-0"/></defs>'
            + '<use xlink:href="#p-rY7qLmP2" fill="url(#grad-rY7qLmP2-0)"/>';
        expect(normalize(a)).toBe(normalize(b));
        expect(normalize(a)).toBe('<defs><path id="id1"/><linearGradient id="id2"/></defs>'
            + '<use xlink:href="#id1" fill="url(#id2)"/>');
    });

    it('normalize()는 참조가 다른 id를 가리키면 다른 결과를 낸다 (참조 구조 보존)', () => {
        const c = '<defs><path id="a1"/><path id="a2"/></defs><use xlink:href="#a1"/>';
        const d = '<defs><path id="a1"/><path id="a2"/></defs><use xlink:href="#a2"/>';
        expect(normalize(c)).not.toBe(normalize(d));
    });

    it('normalize()는 id가 아닌 내용은 바꾸지 않는다', () => {
        const s = '<div class="kayak-root" style="width: 300px;" data-uuid="keep">한글 text</div>';
        expect(normalize(s)).toBe(s);
    });
});

describe('font interception', () => {
    it('TEST_FONT가 존재하고 한글 글리프를 가진다', async () => {
        expect(fs.existsSync(TEST_FONT)).toBe(true);
        const tb = await create_textbox();
        try {
            await tb.fontloader.load_font({ familyName: 'Noto Sans KR', typeStyle: 'Regular' });
            const font = tb.fontloader.getSync('Noto Sans KR', 'Regular');
            expect(font).toBeTruthy();
            expect(font.hasChar('한')).toBe(true);
        } finally {
            destroy_textbox(tb);
        }
    });
});

describe('dump_html()', () => {
    it('text-on-path 모드에서는 실제 렌더링이 들어가는 .kayak-textonpath도 포함한다', async () => {
        const json = fs.readFileSync(path.join(SAMPLE_DIR, 'noto-dohyeon-spoqa.json'), 'utf8');
        const tb = await create_textbox({
            text_on_path: { svg_path_data: 'M 0 100 L 300 100', align_to_path: 'baseline', flip_path: false },
        });
        try {
            await tb.loadFromJson(json, { ignore_text_on_path: true });
            const html = dump_html(tb);
            expect(html).toContain('kayak-root');
            expect(html).toContain('kayak-textonpath');
        } finally {
            destroy_textbox(tb);
        }
    });
});
