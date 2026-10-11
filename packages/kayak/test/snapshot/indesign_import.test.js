/*
    InDesign JSON → kayak JSON 변환(TB_InDesignJsonConverter) 스냅샷.
    변환 결과 객체를 고정하고, 그것을 다시 loadFromJson해 렌더링까지 고정한다.
*/
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ROOT, create_textbox, destroy_textbox, expect_dump, normalize } from './helpers';

const IND_SAMPLES = [
    'test/fixtures/indesign/ind_textframe.json',
    'test/fixtures/indesign/gradient-fill-indesign.json',
];

describe('InDesign json 변환 스냅샷', () => {
    for (const rel of IND_SAMPLES) {
        const tag = path.basename(rel);
        it(tag, async () => {
            const json = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            const tb = await create_textbox();
            try {
                // 반환값은 { kayak_json, dim_px, font_family_remap_occurred }
                const result = tb.importFromInDesignJson(json);
                await expect(normalize(JSON.stringify(result, null, 2)))
                    .toMatchFileSnapshot(`./__snapshots__/indesign.${tag}.converted.json`);
                await tb.loadFromJson(JSON.stringify(result.kayak_json));
                await expect_dump(tb, `indesign.${tag}`, '1-loaded');
            } finally {
                destroy_textbox(tb);
            }
        }, 30000);
    }
});
