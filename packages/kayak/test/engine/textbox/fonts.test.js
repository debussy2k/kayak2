/*
    C 폰트 묶음 특성 테스트: FontDecoder, FontSizeStepUtil, FontRscList, FontManager(spFontManager), LocalFontLoader.
    spFontManager는 싱글턴이라 폰트 목록을 복제해서 쓰고 끝나면 원본으로 되돌린다.
    실제 폰트 파싱은 저장소 안의 KoPubDotumMedium.ttf 하나만 쓴다 (네트워크 없음).
*/
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import cloneDeep from 'lodash/cloneDeep';
import { window, TEST_FONT } from './helpers';
import _g from '../../../src/engine/textbox/TB_PlatformEnv';
import { FontDecoder } from '../../../src/engine/textbox/TB_FontDecoder';
import { TB_FontSizeStepUtil } from '../../../src/engine/textbox/TB_FontSizeStepUtil';
import { font_rsc_list } from '../../../src/engine/textbox/TB_FontRscList';
import { spFontManager } from '../../../src/engine/textbox/TB_FontManager';
import { TB_LocalFontLoader } from '../../../src/engine/textbox/TB_LocalFontLoader';

const LIST_ID = 'default-host-ko';

describe('FontDecoder', () => {
    const dec = new FontDecoder();
    function encode(payload) {
        const { prefix, infix, postfix, offset_to_infix } = dec.env;
        const bytes = [...prefix, ...payload.slice(0, offset_to_infix), ...infix, ...payload.slice(offset_to_infix), ...postfix];
        return Uint8Array.from(bytes).buffer;
    }
    it('인코딩된 버퍼는 풀고, 아닌 버퍼는 그대로 돌려준다', () => {
        const payload = Array.from({ length: 300 }, (_, i) => i % 251);
        const decoded = dec.decode_buffer(encode(payload));
        expect(Array.from(new Uint8Array(decoded))).toEqual(payload);
        const plain = Uint8Array.from([1, 2, 3]).buffer;
        expect(dec.decode_buffer(plain)).toBe(plain);
    });
});

describe('TB_FontSizeStepUtil', () => {
    const u = new TB_FontSizeStepUtil();
    it('단계표와 상하 이동', () => {
        expect(u.font_size_steps).toMatchSnapshot();
        expect([u.lower_font_size(10), u.upper_font_size(10)]).toEqual([9, 11]);
        expect([u.lower_font_size(13), u.upper_font_size(13)]).toEqual([12, 14]);
        expect([u.lower_font_size(2), u.lower_font_size(1)]).toEqual([2, 2]);
        expect([u.upper_font_size(990), u.upper_font_size(5000)]).toEqual([990, 990]);
    });
});

describe('font_rsc_list', () => {
    it('default-host-ko 목록에 default 폰트가 정확히 하나 있다', () => {
        const list = font_rsc_list[LIST_ID].font_list;
        const defaults = [];
        for (const fam of Object.keys(list))
            for (const st of Object.keys(list[fam].style))
                if (list[fam].style[st].default) defaults.push([fam, st]);
        expect(defaults).toEqual([['NanumMyeongjoOTF', 'Regular']]);
    });
});

describe('FontManager (spFontManager)', () => {
    const fm = spFontManager;
    const original_groups = fm.font_groups_list;
    beforeEach(() => { fm.set_font_groups_list(cloneDeep(font_rsc_list)); fm.clearFonts(); });
    afterEach(() => { fm.set_font_groups_list(original_groups); fm.clearFonts(); });

    it('폰트 목록 조회', () => {
        expect(fm._get_font_list(LIST_ID)).toBe(fm.font_groups_list[LIST_ID].font_list);
        expect(fm._get_font_list()).toBe(fm.font_groups_list[LIST_ID].font_list);
        expect(fm._get_font_list('nope')).toBeNull();
        expect(fm._find_default_values(LIST_ID)).toEqual({ familyName: 'NanumMyeongjoOTF', typeStyle: 'Regular' });
        expect(fm._find_default_values('nope')).toEqual({ familyName: 'NanumMyeongjoOTF', typeStyle: 'Regular' });   // 첫 목록으로 대체
        expect(fm.get_font_info(LIST_ID, 'Noto Sans KR', 'Bold').url).toContain('NotoSansKR-Bold');
        expect(fm.get_font_info(LIST_ID, 'Noto Sans KR', 'Nope')).toBeNull();
        expect(fm.get_font_key_name('g', 'f', 's')).toBe('g-f-s');
    });
    it('_get_font_rsc_url: 있는 폰트 / 없는 family → 기본 폰트 / 없는 style → 첫 style / 없는 목록', () => {
        const results = [];
        const cb = (...a) => results.push(a);
        fm._get_font_rsc_url(LIST_ID, 'Noto Sans KR', 'Bold', cb);
        fm._get_font_rsc_url(LIST_ID, 'Nope', 'Bold', cb);
        fm._get_font_rsc_url(LIST_ID, 'Noto Sans KR', 'Nope', cb);
        fm._get_font_rsc_url('nope-list', 'Noto Sans KR', 'Bold', cb);
        expect(results).toMatchSnapshot();
    });
    it('표시 이름 목록 (locale)', () => {
        expect(fm.get_family_list(LIST_ID, 'kr')).toMatchSnapshot();
        expect(fm.get_family_list('nope', 'kr')).toEqual([]);
        expect(fm.get_family_disp_name(LIST_ID, 'NanumBarunGothic', 'kr')).toBe('나눔바른고딕');
        expect(fm.get_family_disp_name(LIST_ID, 'NanumBarunGothic', 'jp')).toBe('NanumBarunGothic');   // 없는 locale은 en
        expect(fm.get_family_disp_name(LIST_ID, 'Nope', 'kr')).toBe('Nope');
        expect(fm.get_font_style_list(LIST_ID, 'Noto Sans KR', 'en')).toMatchSnapshot();
        expect(fm.get_font_style_list(LIST_ID, 'Nope', 'en')).toEqual([]);
        expect(fm.get_style_disp_name(LIST_ID, 'Noto Sans KR', 'Bold', 'kr')).toBe('Bold');
    });
    it('find_default_font_with_font_list: default가 없으면 첫 폰트/첫 스타일로 대체한다 (원본은 ReferenceError)', () => {
        const list = { A: { family: { locale: { en: 'A' } }, style: { R: { url: 'u', issue: '001', locale: { en: 'R' } }, B: { url: 'u2', issue: '001', locale: { en: 'B' } } } } };
        // 반환 키 이름이 familyName/typeStyle이 아닌 것은 원본 그대로다 (issues.md #6).
        expect(fm.find_default_font_with_font_list(list)).toEqual({ font_family: 'A', type_style: 'R' });
    });
    it('findUnregisteredFonts', () => {
        const used = { a: { familyName: 'Noto Sans KR', typeStyle: 'Bold' }, b: { familyName: 'Nope', typeStyle: 'X' }, c: { familyName: 'Noto Sans KR', typeStyle: 'X' } };
        expect(fm.findUnregisteredFonts(fm._get_font_list(LIST_ID), used)).toEqual([used.b, used.c]);
    });

    describe('_load (font_loader_by_platform 스텁)', () => {
        const original_loader = fm.font_loader_by_platform;
        afterEach(() => { fm.font_loader_by_platform = original_loader; });
        const fo = { familyName: 'F', typeStyle: 'S', url: 'u', issue: '001' };
        const KEY = 'L-F-S';
        it('C(새 로딩) → B(대기) → A(캐시): 같은 Font, 참조 수, 해제', async () => {
            let loads = 0;
            fm.font_loader_by_platform = (lfm, url, issue, key, lid, alt, cb) => { loads++; setTimeout(() => cb(null, { name: key }), 5); };
            const lfm1 = { used_font_keys: new Set([KEY]) }, lfm2 = { used_font_keys: new Set([KEY]) };
            const [f1, f2] = await Promise.all([fm._load('L', fo, lfm1), fm._load('L', fo, lfm2)]);
            expect(loads).toBe(1);
            expect(f1).toBe(f2);
            expect(fm.fonts[KEY].count).toBe(2);
            expect(fm.font_loading_events[KEY]).toBeNull();
            expect(await fm._load('L', fo, lfm1)).toBe(f1);
            expect(fm.fonts[KEY].count).toBe(2);
            expect(fm.getFontInUseCount()).toBe(1);
            fm.releaseFontResource(lfm1);
            expect(fm.fonts[KEY].count).toBe(1);
            fm.releaseFontResource(lfm1);   // 두 번 해제해도 더 줄지 않는다
            expect(fm.fonts[KEY].count).toBe(1);
            fm.releaseFontResource(lfm2);
            expect(fm.fonts[KEY]).toBeUndefined();
        });
        it('로딩 실패: 요청자와 대기자 모두 reject, 캐시에 남지 않는다', async () => {
            fm.font_loader_by_platform = (lfm, url, issue, key, lid, alt, cb) => setTimeout(() => cb('boom'), 5);
            const r = await Promise.allSettled([fm._load('L', fo, {}), fm._load('L', fo, {})]);
            expect(r.map(x => x.status)).toEqual(['rejected', 'rejected']);
            expect(r[0].reason).toEqual({ info: { font_url: 'u', font_issue: '001', font_key_name: KEY }, err: 'boom' });
            expect(r[1].reason).toEqual({ font_key_name: KEY });
            expect(fm.fonts[KEY]).toBeUndefined();
            expect(fm.font_loading_events[KEY]).toBeNull();
        });
        it('url/issue 없이 폰트 목록에서 찾는다 (없는 목록이면 reject)', async () => {
            const seen = [];
            fm.font_loader_by_platform = (lfm, url, issue, key, lid, alt, cb) => { seen.push([url, issue, key, lid, alt]); cb(null, { name: key }); };
            await fm._load(LIST_ID, { familyName: 'Nope', typeStyle: 'X' }, {});
            expect(seen).toMatchSnapshot();   // 기본 폰트 url + use_alternative_font true
            await expect(fm._load('nope-list', { familyName: 'Nope', typeStyle: 'X' }, {})).rejects.toBe('font resource is not defined.');
        });
    });

    it('load_and_parse: node 경로(fsReadFile)로 실제 ttf를 파싱하고 __liga_safe를 붙인다', async () => {
        _g.set({ window, fsReadFile: () => fs.readFile });
        try {
            const font = await new Promise((resolve, reject) => fm.load_and_parse(TEST_FONT, null, (err, f) => err ? reject(err) : resolve(f)));
            expect(typeof font.hasChar).toBe('function');
            expect(font.hasChar('가')).toBe(true);
            expect(font.__liga_safe).toMatchSnapshot();
            const err = await new Promise(resolve => fm.load_and_parse('/no/such/font.ttf', null, (e) => resolve(e)));
            expect(typeof err).toBe('string');
        } finally {
            _g.set({ window });
        }
    });
});

describe('TB_LocalFontLoader', () => {
    const fm = spFontManager;
    const original_groups = fm.font_groups_list;
    beforeEach(() => { fm.set_font_groups_list(cloneDeep(font_rsc_list)); fm.clearFonts(); });
    afterEach(() => { fm.set_font_groups_list(original_groups); fm.clearFonts(); });

    it('font_list_id 결정: null이거나 목록이 하나면 첫 항목', () => {
        const l = new TB_LocalFontLoader(null, 'dl');
        expect(l.get_font_group_id()).toBe(LIST_ID);
        expect(new TB_LocalFontLoader('anything', 'dl').get_font_group_id()).toBe(LIST_ID);
        expect(l.get_base_folder_for_download()).toBe('dl');
        expect(l.get_font_key('A', 'B')).toBe(`${LIST_ID}-A-B`);
    });
    it('목록이 여럿이면 정확히 일치하는 id를 쓴다', () => {
        fm.set_font_groups_list({ a: { font_list: {} }, 'b-basefont': { font_list: {} } });
        expect(new TB_LocalFontLoader('b-basefont', 'dl').get_font_group_id()).toBe('b-basefont');
        expect(new TB_LocalFontLoader('a', 'dl').get_font_group_id()).toBe('a');
    });
    it('목록이 여럿이고 id가 없으면 "basefont"로 끝나지 않는 첫 목록을 쓴다 (원본은 ReferenceError)', () => {
        fm.set_font_groups_list({ 'x-basefont': { font_list: {} }, a: { font_list: {} }, b: { font_list: {} } });
        expect(new TB_LocalFontLoader('zzz', 'dl').get_font_group_id()).toBe('a');
    });
    it('기본 폰트: 문서 기본 폰트가 설정되면 그것을 우선', () => {
        const l = new TB_LocalFontLoader(null, 'dl');
        expect(l.get_default_font()).toEqual({ familyName: 'NanumMyeongjoOTF', typeStyle: 'Regular' });
        l.set_document_default_font({ familyName: 'X', typeStyle: 'Y', extra: 1 });
        expect(l.get_default_font()).toEqual({ familyName: 'X', typeStyle: 'Y' });
        l.set_document_default_font(null);
        expect(l.get_default_font()).toEqual({ familyName: 'NanumMyeongjoOTF', typeStyle: 'Regular' });
    });
    it('load_fonts: 상태 콜백 loading → loaded, 실패면 failed + throw', async () => {
        const original = fm._load;
        const states = [];
        const l = new TB_LocalFontLoader(null, 'dl');
        l.register_font_loading_state_callback(s => states.push(s));
        try {
            fm._load = () => Promise.resolve({});
            expect(await l.load_fonts([{ familyName: 'A', typeStyle: 'B' }])).toBeNull();
            expect(states).toEqual(['loading', 'loaded']);
            expect(l.is_font_loaded()).toBe(true);
            expect([...l.used_font_keys]).toEqual([`${LIST_ID}-A-B`]);
            fm._load = () => Promise.reject('x');
            await expect(l.load_font({ familyName: 'A', typeStyle: 'C' })).rejects.toBe('x');
            expect(states).toEqual(['loading', 'loaded', 'loading', 'failed']);
            expect(l.get_state()).toBe('failed');
        } finally {
            fm._load = original;
        }
    });
    it('get/getSync: 캐시된 폰트는 바로 콜백', () => {
        const l = new TB_LocalFontLoader(null, 'dl');
        const font = { name: 'cached' };
        fm.fonts[l.get_font_key('A', 'B')] = { font, count: 1, referrer: new WeakSet() };
        expect(l.getSync('A', 'B')).toBe(font);
        const got = [];
        l.get('A', 'B', (err, f) => got.push([err, f]));
        expect(got).toEqual([[null, font]]);
        l.destroy();
        expect(l.used_font_keys.size).toBe(0);
    });
    it('add_foreign_fonts: 목록에 없는 폰트만 default:false로 주입', () => {
        const l = new TB_LocalFontLoader(null, 'dl');
        const used = {
            Foreign: { family: { locale: { en: 'Foreign' } }, style: { R: { url: 'u', issue: '001', locale: { en: 'R' }, default: true } } },
            'Noto Sans KR': { family: { locale: { en: 'x' } }, style: { Bold: { url: 'overwritten', issue: '9', locale: { en: 'B' } } } },
        };
        l.add_foreign_fonts(used, [{ familyName: 'Foreign', typeStyle: 'R' }, { familyName: 'Noto Sans KR', typeStyle: 'Bold' }]);
        const list = fm._get_font_list(LIST_ID);
        expect(list.Foreign.style.R).toEqual({ url: 'u', issue: '001', locale: { en: 'R' }, default: false });
        expect(list.Foreign.family).toEqual({ locale: { en: 'Foreign' } });
        expect(list['Noto Sans KR'].style.Bold.url).toContain('NotoSansKR-Bold');   // 기존 항목은 그대로
    });
});
