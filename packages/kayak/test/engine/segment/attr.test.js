/*
    ATTR_* 및 보조 클래스 결함 회귀 테스트.
    결함 번호는 PR #21의 src/segment_ts/docs/bug-report.md 기준.
*/
import { describe, it } from 'vitest';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import * as h from './helpers';
import GT_segmentLayer from '../../../src/engine/segment/seglayer';
import ATTR_FontColor from '../../../src/engine/segment/ATTR_FontColor';
import ATTR_Shadow from '../../../src/engine/segment/ATTR_Shadow';
import ATTR_Doc from '../../../src/engine/segment/ATTR_Doc';
import ATTR_NamedRange from '../../../src/engine/segment/ATTR_NamedRange';
import GT_PasteInfo from '../../../src/engine/segment/GT_PasteInfo';

var require = createRequire(import.meta.url);
var __dirname = path.dirname(fileURLToPath(import.meta.url));

var SEGC = h.SEGC;

var SPOT_485 = { type: 'spot', name: 'PANTONE 485 C' };

describe('ATTR_* / 보조 클래스', function() {

    describe('S2: 글자색 병합 시 CMYK·별색 정보 유실', function() {
        it('RGB가 같아도 CMYK가 다르면 equal()이 false다', function() {
            var a = new ATTR_FontColor('#336699', [80, 47, 0, 40]);
            var b = new ATTR_FontColor('#336699', [75, 50, 5, 35]);
            assert.strictEqual(a.equal(b), false);
        });

        it('RGB가 같아도 별색(fontColorModel)이 다르면 equal()이 false다', function() {
            var spot = new ATTR_FontColor('#FF0000', [0, 100, 100, 0], SPOT_485);
            var plain = new ATTR_FontColor('#FF0000', [0, 100, 100, 0]);
            assert.strictEqual(spot.equal(plain), false);
            assert.strictEqual(plain.equal(spot), false);
        });

        it('RGB·CMYK·별색이 모두 같으면 equal()이 true다 (회귀 방지)', function() {
            var a = new ATTR_FontColor('#FF0000', [0, 100, 100, 0], SPOT_485);
            var b = new ATTR_FontColor('#FF0000', [0, 100, 100, 0], { type: 'spot', name: 'PANTONE 485 C' });
            assert.strictEqual(a.equal(b), true);
            assert.strictEqual(a.equal(a.clone()), true);
        });

        it('CMYK가 다른 글자를 이어 입력해도 layer에서 병합되지 않고 각자 보존된다', function() {
            var layer = new GT_segmentLayer(SEGC.GRAVITY_LEFT, 'ATTR_FontColor', ATTR_FontColor.prototype);
            layer.insert(0, new ATTR_FontColor('#336699', [80, 47, 0, 40]));
            layer.insert(1, new ATTR_FontColor('#336699', [75, 50, 5, 35]));

            var vec = layer._get_vec();
            assert.strictEqual(vec.length, 2);
            assert.deepStrictEqual(vec[0].fontColorCMYK, [80, 47, 0, 40]);
            assert.deepStrictEqual(vec[1].fontColorCMYK, [75, 50, 5, 35]);
        });
    });

    describe('M2: ATTR_Shadow 기본값의 오타 키(shadow → color)', function() {
        it('기본 그림자 색은 color 키로 저장된다', function() {
            var s = new ATTR_Shadow();
            assert.strictEqual(s.shadow.color, '#000');
            assert.strictEqual(s.shadow.shadow, undefined);
        });

        it('기본 인스턴스는 자신의 clone과 equal()이다', function() {
            var s = new ATTR_Shadow();
            assert.strictEqual(s.equal(s.clone()), true);
        });
    });

    describe('M3: ATTR_Doc.set()이 m_nCount만 that에서 읽음', function() {
        it('setMask로 지정한 m_nCount가 적용된다', function() {
            var doc = new ATTR_Doc();
            doc.set(new ATTR_Doc(), { m_nCount: 5 });
            assert.strictEqual(doc.m_nCount, 5);
        });

        it('setMask에 m_nCount가 없으면 m_nCount는 바뀌지 않는다', function() {
            var doc = new ATTR_Doc();
            doc.m_nCount = 7;
            doc.set(new ATTR_Doc(), { frame_height: 300 });
            assert.strictEqual(doc.m_nCount, 7);
            assert.strictEqual(doc.frame_height, 300);
        });
    });

    describe('M4: ATTR_NamedRange.equal()이 title을 비교하지 않음', function() {
        it('var_name이 같아도 title이 다르면 equal()이 false다', function() {
            var a = new ATTR_NamedRange('v1', '제목1');
            var b = new ATTR_NamedRange('v1', '제목2');
            assert.strictEqual(a.equal(b), false);
        });

        it('var_name과 title이 모두 같으면 equal()이 true다 (회귀 방지)', function() {
            var a = new ATTR_NamedRange('v1', '제목1');
            assert.strictEqual(a.equal(a.clone()), true);
        });
    });

    describe('M6: lodash 모듈 경로 대소문자', function() {
        it('src/segment의 lodash require 경로는 실제 파일명과 대소문자까지 일치한다', function() {
            var seg_dir = path.resolve(__dirname, '../../../src/engine/segment');
            var lodash_files = fs.readdirSync(path.dirname(require.resolve('lodash/package.json')));
            var re = /(?:require\(\s*|from\s+)['"]lodash\/([^'"]+)['"]/g;
            var checked = 0;
            var bad = [];

            fs.readdirSync(seg_dir).filter(function(f) { return /\.(js|ts)$/.test(f); }).forEach(function(f) {
                var src = fs.readFileSync(path.join(seg_dir, f), 'utf8');
                var m;
                while ((m = re.exec(src)) !== null) {
                    checked++;
                    var name = /\.js$/.test(m[1]) ? m[1] : m[1] + '.js';
                    if (lodash_files.indexOf(name) < 0)
                        bad.push(f + ': lodash/' + m[1]);
                }
            });
            assert.ok(checked > 0, 'lodash import를 하나도 찾지 못함 (정규식 확인 필요)');
            assert.deepStrictEqual(bad, []);
        });
    });

    describe('M7: GT_PasteInfo.non_clipboard_copy_string 타입', function() {
        it('기본값은 char code 배열과 같은 타입(Array)이다', function() {
            var info = new GT_PasteInfo();
            assert.ok(Array.isArray(info.non_clipboard_copy_string));
            assert.strictEqual(info.non_clipboard_copy_string.length, 0);
        });
    });
});
