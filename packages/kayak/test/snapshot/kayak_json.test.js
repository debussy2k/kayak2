/*
    test/kayak_json_samples/*.json 렌더링 스냅샷.
    디버그 gutter on/off × (로드 직후 → 전체 선택) 단계마다 HTML/SVG/JSON을 비교한다.

    scale() 단계는 두지 않는다. textbox 모드에서 scale()은 kayak-root의 inline transform만 바꾸는데,
    이 프로젝트의 jsdom 11은 transform을 저장하지 않아 덤프에 아무 차이가 남지 않기 때문이다 (helpers.js 참고).
    scale이 실제 렌더링을 바꾸는 text-on-path 모드는 text_on_path.test.js에서 다룬다.

    스냅샷 갱신: npm test -w kayak -- -u test/snapshot (.claude/skills/update-snapshots 절차)
    (갱신했으면 PR 본문에 왜 바뀌었는지 적는다. TS 전환 PR에서는 바뀌면 안 된다.)
*/
import { describe, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SAMPLE_DIR, create_textbox, destroy_textbox, expect_dump } from './helpers';

const samples = fs.readdirSync(SAMPLE_DIR).filter(f => f.endsWith('.json')).sort();

describe('kayak json 렌더링 스냅샷', () => {
    for (const file of samples) {
        for (const gutter of [false, true]) {
            const tag = `${file}.${gutter ? 'gutter' : 'plain'}`;
            it(tag, async () => {
                const json = fs.readFileSync(path.join(SAMPLE_DIR, file), 'utf8');
                const tb = await create_textbox({ debug: { show_line_gutter: gutter } });
                try {
                    await tb.loadFromJson(json);
                    await expect_dump(tb, tag, '1-loaded');
                    tb.select_all_text();
                    await expect_dump(tb, tag, '2-selected');
                } finally {
                    destroy_textbox(tb);
                }
            }, 30000);
        }
    }
});
