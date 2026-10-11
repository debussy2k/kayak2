/*
    ATTR_* 11개 클래스가 공통으로 지켜야 하는 계약(src/engine/segment/types.ts의 ISegAttr) 테스트.

    TS 전환 전 JS 상태에서 통과하는 것을 먼저 확인하고, 전환 후에도 그대로 통과해야 한다.
    (동작 보존 테스트. PR #21의 attr.test.ts를 현재 main의 동작에 맞게 옮긴 것)
*/
import { describe, it } from 'vitest';
import assert from 'assert';
import SEGC from '../../../src/engine/segment/segment_const';
import ATTR_Bold from '../../../src/engine/segment/ATTR_Bold';
import ATTR_Doc from '../../../src/engine/segment/ATTR_Doc';
import ATTR_FontColor from '../../../src/engine/segment/ATTR_FontColor';
import ATTR_FontFamily from '../../../src/engine/segment/ATTR_FontFamily';
import ATTR_FontSize from '../../../src/engine/segment/ATTR_FontSize';
import ATTR_LetterScaleX from '../../../src/engine/segment/ATTR_LetterScaleX';
import ATTR_LetterSpacing from '../../../src/engine/segment/ATTR_LetterSpacing';
import ATTR_NamedRange from '../../../src/engine/segment/ATTR_NamedRange';
import ATTR_Par from '../../../src/engine/segment/ATTR_Par';
import ATTR_Shadow from '../../../src/engine/segment/ATTR_Shadow';
import ATTR_Stroke from '../../../src/engine/segment/ATTR_Stroke';

// make: 기본값 인스턴스, makeOther: 기본값과 equal()이 아닌 인스턴스
const cases = [
    { name: 'ATTR_Bold', ctor: ATTR_Bold, make: () => new ATTR_Bold(), makeOther: () => new ATTR_Bold(true) },
    { name: 'ATTR_Doc', ctor: ATTR_Doc, make: () => new ATTR_Doc(),
      makeOther: () => { const a = new ATTR_Doc(); a.vertical_align = 'bottom'; return a; } },
    { name: 'ATTR_FontColor', ctor: ATTR_FontColor, make: () => new ATTR_FontColor(), makeOther: () => new ATTR_FontColor('#ff0000') },
    { name: 'ATTR_FontFamily', ctor: ATTR_FontFamily, make: () => new ATTR_FontFamily(), makeOther: () => new ATTR_FontFamily('Arial', 'Bold') },
    { name: 'ATTR_FontSize', ctor: ATTR_FontSize, make: () => new ATTR_FontSize(), makeOther: () => new ATTR_FontSize(20) },
    { name: 'ATTR_LetterScaleX', ctor: ATTR_LetterScaleX, make: () => new ATTR_LetterScaleX(), makeOther: () => new ATTR_LetterScaleX(50) },
    { name: 'ATTR_LetterSpacing', ctor: ATTR_LetterSpacing, make: () => new ATTR_LetterSpacing(), makeOther: () => new ATTR_LetterSpacing(100) },
    { name: 'ATTR_NamedRange', ctor: ATTR_NamedRange, make: () => new ATTR_NamedRange(), makeOther: () => new ATTR_NamedRange('other', 't') },
    { name: 'ATTR_Par', ctor: ATTR_Par, make: () => new ATTR_Par(),
      makeOther: () => { const a = new ATTR_Par(); a.m_Align = 'center'; return a; } },
    { name: 'ATTR_Shadow', ctor: ATTR_Shadow, make: () => new ATTR_Shadow(),
      makeOther: () => new ATTR_Shadow({ size: 1, angle: 90, distance: 2, opacity: 50, color: '#fff' }) },
    { name: 'ATTR_Stroke', ctor: ATTR_Stroke, make: () => new ATTR_Stroke(),
      makeOther: () => new ATTR_Stroke({ weight: 2, align: 'center', color: '#f00' }) },
];

describe('ATTR_* 공통 계약 (ISegAttr)', function () {
    cases.forEach(c => {
        describe(c.name, function () {
            it('_attr_class_name과 기본 m_nCount=1, 기본 gravity flag를 가진다', function () {
                const a = c.make();
                assert.strictEqual(a._attr_class_name, c.name);
                assert.strictEqual(a.m_nCount, 1);
                assert.strictEqual(a.getGravityExFlag(), SEGC.GXFLAG_BOTH);
            });

            it('clone()은 m_nCount와 gravity flag까지 복사한 동등 인스턴스를 만든다', function () {
                const a = c.make();
                a.m_nCount = 7;
                a.setGravityExFlag(SEGC.GXFLAG_NONE);
                const b = a.clone();
                assert.notStrictEqual(b, a);
                assert.strictEqual(b.m_nCount, 7);
                assert.strictEqual(b.getGravityExFlag(), SEGC.GXFLAG_NONE);
                assert.strictEqual(a.equal(b), true);
                assert.deepStrictEqual(b.getDataObject(), a.getDataObject());
            });

            it('getDataObject()에는 gravity flag와 메서드가 들어가지 않는다', function () {
                const a = c.make();
                const data = a.getDataObject();
                assert.strictEqual(data.m_nCount, 1);
                Object.keys(data).forEach(k => {
                    assert.notStrictEqual(typeof data[k], 'function', k + ' is a function');
                });
                assert.strictEqual('_nGravityExFlag' in data, false);
            });

            it('factory(n)은 같은 속성으로 m_nCount=n인 인스턴스를 만든다 (기본 1)', function () {
                const a = c.make();
                a.m_nCount = 7;
                assert.strictEqual(a.factory().m_nCount, 1);
                assert.strictEqual(a.factory(4).m_nCount, 4);
                assert.strictEqual(a.equal(a.factory(4)), true);
            });

            it('prototype.factory()는 unbound 호출로 기본 인스턴스를 만든다 (seglayer_manager 호환)', function () {
                // seglayer_manager.setByDataObject는 _attr_prototype.factory를 bare function으로 호출한다.
                const bare = c.ctor.prototype.factory;
                const viaPrototype = c.ctor.prototype.factory();
                const viaBare = bare();
                assert.strictEqual(viaPrototype instanceof c.ctor, true);
                assert.strictEqual(viaBare instanceof c.ctor, true);
                assert.strictEqual(viaBare.m_nCount, 1);
                assert.strictEqual(viaBare.equal(c.make()), true);
            });

            it('prototype.style_setter / css_string은 함수다 (seglayer_manager가 prototype에서 호출)', function () {
                assert.strictEqual(typeof c.ctor.prototype.style_setter, 'function');
                // 원본 ATTR_Par에는 css_string이 없다. seglayer_manager.css_string()은 Par 레이어(index 0)를
                // 건너뛰므로 호출되지 않는다. TS 전환 후에는 ISegAttr 계약을 위해 빈 함수가 생기므로 Par만 제외한다.
                if (c.name !== 'ATTR_Par')
                    assert.strictEqual(typeof c.ctor.prototype.css_string, 'function');
            });

            it('equal()은 속성값만 비교한다 (m_nCount는 무관)', function () {
                const a = c.make();
                const b = c.make();
                b.m_nCount = 99;
                assert.strictEqual(a.equal(b), true);
                assert.strictEqual(a.equal(c.makeOther()), false);
            });

            it('set()은 대상의 값을 복사한다', function () {
                const a = c.make();
                const other = c.makeOther();
                other.m_nCount = 3;
                a.set(other);
                assert.strictEqual(a.equal(other), true);
                assert.strictEqual(a.m_nCount, 3);
            });

            it('getDataObject() 결과를 set()으로 복원할 수 있다 (직렬화 round-trip)', function () {
                const src = c.makeOther();
                src.m_nCount = 5;
                const data = src.getDataObject();
                const restored = c.ctor.prototype.factory();
                restored.set(data);
                assert.deepStrictEqual(restored.getDataObject(), data);
            });
        });
    });
});

describe('ATTR_* 클래스별 고유 동작', function () {
    it('ATTR_FontSize 기본값은 10pt', function () {
        assert.strictEqual(new ATTR_FontSize().FontSize, 10);
    });

    it('ATTR_FontColor: 문자열 색상이면 fontColor에, gradient는 null', function () {
        const a = new ATTR_FontColor('#123456', [1, 2, 3, 4]);
        assert.strictEqual(a.fontColor, '#123456');
        assert.deepStrictEqual(a.fontColorCMYK, [1, 2, 3, 4]);
        assert.strictEqual(a.gradient, null);
    });

    it('ATTR_FontColor: object를 넘기면 gradient로 저장되고 fontColor는 null', function () {
        const g = { type: 'linear', geom: { x1: 0, y1: 0, x2: 1, y2: 0 }, stops: [{ offset: '0%', rgb: '#000' }] };
        const a = new ATTR_FontColor(g);
        assert.strictEqual(a.fontColor, null);
        assert.deepStrictEqual(a.gradient, g);
        assert.notStrictEqual(a.gradient, g);   // cloneDeep
        assert.strictEqual(a.clone().equal(a), true);
    });

    it('ATTR_FontColor: css_string은 gradient면 raw_data.gradient_fill을 쓰고 color는 지운다', function () {
        const ctx = { css_data: { fontColor: 'color:#000;' }, raw_data: { color_cmyk: [0, 0, 0, 1] } };
        ATTR_FontColor.prototype.css_string({ gradient: { type: 'linear' } }, ctx);
        assert.strictEqual('fontColor' in ctx.css_data, false);
        assert.strictEqual('color_cmyk' in ctx.raw_data, false);
        assert.strictEqual(typeof ctx.raw_data.gradient_fill, 'string');
    });

    it('ATTR_Par 기본값', function () {
        const p = new ATTR_Par();
        assert.strictEqual(p.m_nLineGap, 0);
        assert.strictEqual(p.m_Align, 'left');
        assert.strictEqual(p.m_LineSpace, 1.2);
        assert.strictEqual(p.m_Leading, 'auto');
    });

    it('ATTR_Par.set(that, setMask): setMask가 있으면 setMask의 항목만 적용된다', function () {
        const p = new ATTR_Par(5);
        p.m_Findent = 3;
        const other = new ATTR_Par(9);
        other.m_Align = 'right';
        other.m_Findent = 7;
        p.set(other, { m_Align: 'center' });
        assert.strictEqual(p.m_Align, 'center');
        assert.strictEqual(p.m_nLineGap, 5);   // mask에 없으므로 그대로
        assert.strictEqual(p.m_Findent, 3);
    });

    it('ATTR_Par.style_setter는 start_of_par와 par 객체를 기록한다', function () {
        const style = {};
        ATTR_Par.prototype.style_setter(style, new ATTR_Par(4));
        assert.strictEqual(style.start_of_par, true);
        assert.strictEqual(style.par.m_nLineGap, 4);
        assert.strictEqual(style.par.m_Leading, 'auto');
    });

    it('ATTR_Doc.set(that, setMask): setMask의 m_nCount가 적용된다', function () {
        const d = new ATTR_Doc();
        d.set(new ATTR_Doc(), { m_nCount: 12, frame_height: 50 });
        assert.strictEqual(d.m_nCount, 12);
        assert.strictEqual(d.frame_height, 50);
        assert.strictEqual(d.vertical_align, 'top');
    });

    it('ATTR_Stroke: 일부 필드 생략시 join/miterlimit 기본값이 채워진다', function () {
        const s = new ATTR_Stroke({ weight: 2, align: 'center', color: '#f00' });
        assert.deepStrictEqual(s.stroke, { weight: 2, align: 'center', color: '#f00', join: 'round', miterlimit: 10 });
    });

    it('ATTR_Shadow: 기본 인스턴스의 clone은 equal이다 (PR #23에서 고친 M2)', function () {
        const s = new ATTR_Shadow();
        assert.strictEqual(s.shadow.color, '#000');
        assert.strictEqual(s.clone().equal(s), true);
    });

    it('ATTR_Shadow.style_setter는 shadow 객체를 복사해 넣는다 (같은 참조가 아님)', function () {
        const s = new ATTR_Shadow({ size: 1, angle: 90, distance: 2, opacity: 50, color: '#fff' });
        const style = {};
        ATTR_Shadow.prototype.style_setter(style, s);
        assert.deepStrictEqual(style.shadow, s.shadow);
        assert.notStrictEqual(style.shadow, s.shadow);
    });

    it('ATTR_NamedRange.equal()은 var_name과 title을 모두 비교한다 (PR #23에서 고친 M4)', function () {
        assert.strictEqual(new ATTR_NamedRange('a', 't1').equal(new ATTR_NamedRange('a', 't2')), false);
    });

    it('ATTR_FontFamily.css_string은 raw_data.font_family에 "family,style"을 쓴다', function () {
        const ctx = { css_data: {}, raw_data: {} };
        ATTR_FontFamily.prototype.css_string({ familyName: 'Noto Sans KR', typeStyle: 'Bold' }, ctx);
        assert.strictEqual(ctx.raw_data.font_family, 'Noto Sans KR,Bold');
    });

    it('ATTR_Bold.css_string은 font-weight css를 만든다', function () {
        const ctx = { css_data: {}, raw_data: {} };
        ATTR_Bold.prototype.css_string({ bold: true }, ctx);
        assert.strictEqual(ctx.css_data.bold, 'font-weight:bold;');
    });
});
