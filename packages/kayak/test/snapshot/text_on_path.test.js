/*
    text-on-path 모드(src/engine/geometry/*) 렌더링 스냅샷.
    textbox를 경로 위에 올린 상태로 샘플 하나를 로드한다.
*/
import { describe, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SAMPLE_DIR, create_textbox, destroy_textbox, expect_dump } from './helpers';

// SimpleTextBox.js의 test_for_textonpath()가 쓰던 닫힌 원형 경로 (반시계 방향)
const CIRCLE_CCW = 'M100, 200 C 155, 200, 200, 155, 200, 100 C 200, 45, 155, 0, 100, 0 C 45, 0, 0, 45, 0, 100 C 0, 155, 45, 200, 100, 200 Z';

describe('text-on-path 렌더링 스냅샷', () => {
    for (const flip of [false, true]) {
        const tag = `textonpath.noto-dohyeon-spoqa.${flip ? 'flip' : 'noflip'}`;
        it(tag, async () => {
            const json = fs.readFileSync(path.join(SAMPLE_DIR, 'noto-dohyeon-spoqa.json'), 'utf8');
            const tb = await create_textbox({
                text_on_path: { svg_path_data: CIRCLE_CCW, align_to_path: 'baseline', flip_path: flip },
            });
            try {
                await tb.loadFromJson(json, { ignore_text_on_path: true });
                await expect_dump(tb, tag, '1-loaded');
                tb.scale(1.5);
                await expect_dump(tb, tag, '2-scaled');
            } finally {
                destroy_textbox(tb);
            }
        }, 30000);
    }
});
