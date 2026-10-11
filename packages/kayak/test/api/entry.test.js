/*
    번들 진입점 특성 테스트. export 이름을 고정하고, 브라우저 entry가 document가 있을 때 <style>을 head에 넣는 것을 고정한다.
    vitest는 CSS를 처리하지 않아 base.css?inline이 빈 문자열이므로 내용은 보지 않는다.
*/
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

const NODE_EXPORTS = ['GT_MasterClipboard', 'TB_InDesignJsonConverter', 'TB_PlatformEnv', 'spFontManager', 'textbox'];
const BROWSER_EXPORTS = [...NODE_EXPORTS, 'MeasureDiv', 'TB_FontSizeStepUtil', 'TB_NormalizedIME'].sort();

// 진입점 동적 import는 엔진 전체를 변환하므로, 테스트를 많이 병렬로 돌릴 때 기본 5초를 넘긴 적이 있다(Kayak 2026-10-11).
describe('entry', () => {
    it('entry_node: node 번들 export', async () => {
        const m = await import('../../src/node');
        expect(Object.keys(m).sort()).toEqual(NODE_EXPORTS);
        expect([typeof m.textbox, typeof m.GT_MasterClipboard.getInstance, typeof m.TB_PlatformEnv.set]).toEqual(['function', 'function', 'function']);
    }, 30_000);

    it('entry: 브라우저 번들 export, document가 있으면 <style type="text/css">를 head에 넣는다', async () => {
        const { window } = new JSDOM('<!DOCTYPE html><body></body>');
        globalThis.document = window.document;
        try {
            const m = await import('../../src/index');
            expect(Object.keys(m).sort()).toEqual(BROWSER_EXPORTS);
            const styles = window.document.head.querySelectorAll('style');
            expect([styles.length, styles[0].type]).toEqual([1, 'text/css']);
        } finally {
            delete globalThis.document;
        }
    }, 30_000);
});
