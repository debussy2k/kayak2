/*  TB_Dom.js 단위 테스트 (jQuery 대체 헬퍼)

    ## 콘솔에서 테스트 실행
    > npm test -w kayak -- test/engine/textbox/TB_Dom.test.js
*/
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import _g from '../../../src/engine/textbox/TB_PlatformEnv';
import TB_Dom from '../../../src/engine/textbox/TB_Dom';

const { window } = new JSDOM(`<!DOCTYPE html><body></body>`);
_g.set({ window: window });

describe('TB_Dom', function () {

    describe('css()', function () {
        it('appends px to bare numbers like jQuery.css()', function () {
            let el = window.document.createElement('div');
            TB_Dom.css(el, { width: 300, 'padding-top': 0, left: 12.5 });
            expect(el.style.width).toBe('300px');
            expect(el.style.paddingTop).toBe('0px');
            expect(el.style.left).toBe('12.5px');
        });

        it('leaves unitless properties as plain numbers', function () {
            let el = window.document.createElement('div');
            TB_Dom.css(el, { opacity: 0, 'z-index': 3 });
            expect(el.style.opacity).toBe('0');
            expect(el.style.zIndex).toBe('3');
        });

        it('passes string values through unchanged', function () {
            let el = window.document.createElement('div');
            TB_Dom.css(el, { height: 'auto', transform: 'scale(1.5)', 'transform-origin': '0 0' });
            expect(el.style.height).toBe('auto');
            expect(el.style.transform).toBe('scale(1.5)');
            expect(el.style.transformOrigin).toBe('0 0');
        });

        it('accepts camelCase keys', function () {
            let el = window.document.createElement('div');
            TB_Dom.css(el, { backgroundColor: 'red', minHeight: 4 });
            expect(el.style.backgroundColor).toBe('red');
            expect(el.style.minHeight).toBe('4px');
        });

        it('ignores null, undefined and NaN values', function () {
            let el = window.document.createElement('div');
            el.style.width = '10px';
            TB_Dom.css(el, { width: null, height: undefined, top: NaN });
            expect(el.style.width).toBe('10px');
            expect(el.style.height).toBe('');
            expect(el.style.top).toBe('');
        });

        it('removes a property when given an empty string', function () {
            let el = window.document.createElement('div');
            el.style.width = '10px';
            TB_Dom.css(el, { width: '' });
            expect(el.style.width).toBe('');
        });

        it('cssAll() applies to every element in a list', function () {
            let a = window.document.createElement('div');
            let b = window.document.createElement('div');
            TB_Dom.cssAll([a, b], { visibility: 'hidden' });
            expect(a.style.visibility).toBe('hidden');
            expect(b.style.visibility).toBe('hidden');
        });
    });

    describe('createElement()', function () {
        it('builds a single element from an HTML string', function () {
            let el = TB_Dom.createElement("<div class='kayak-line' style='padding-left:0px;'></div>");
            expect(el.tagName).toBe('DIV');
            expect(el.className).toBe('kayak-line');
            expect(el.style.paddingLeft).toBe('0px');
            expect(el.parentNode).toBeNull();
        });

        it('builds SVG elements in the SVG namespace', function () {
            let el = TB_Dom.createElement(`
                <svg class='svg_tp'><g class="base-transform"></g></svg>
            `);
            expect(el.namespaceURI).toBe('http://www.w3.org/2000/svg');
            expect(el.querySelector('.base-transform').namespaceURI).toBe('http://www.w3.org/2000/svg');
        });
    });

    describe('parseHTML()', function () {
        it('returns an inert document that can be queried', function () {
            let doc = TB_Dom.parseHTML('<div kayak-doc><div kayak-par><span>a</span></div><div kayak-par></div></div>');
            expect(doc.querySelectorAll('div[kayak-par]').length).toBe(2);
            expect(doc).not.toBe(window.document);
        });

        it('does not throw on plain text (jQuery treated it as a selector)', function () {
            let doc = TB_Dom.parseHTML('hello world');
            expect(doc.querySelectorAll('div[data-kayak-html]').length).toBe(0);
        });
    });

    describe('removeAll()', function () {
        it('detaches every node in a NodeList', function () {
            let root = TB_Dom.createElement("<div><i class='x'></i><b></b><i class='x'></i></div>");
            TB_Dom.removeAll(root.querySelectorAll('.x'));
            expect(root.children.length).toBe(1);
            expect(root.firstElementChild.tagName).toBe('B');
        });
    });

    describe('setAttrs()', function () {
        it('sets every attribute of the object', function () {
            let el = TB_Dom.createElement('<svg><use/></svg>').firstElementChild;
            TB_Dom.setAttrs(el, { x: 1.5, y: 2, href: '#bracket-box', 'transform-origin': '1px 2px' });
            expect(el.getAttribute('x')).toBe('1.5');
            expect(el.getAttribute('y')).toBe('2');
            expect(el.getAttribute('href')).toBe('#bracket-box');
            expect(el.getAttribute('transform-origin')).toBe('1px 2px');
        });
    });

    describe('toArray()', function () {
        it('turns an HTMLCollection into a real array', function () {
            let root = TB_Dom.createElement('<div><span></span><span></span></div>');
            let arr = TB_Dom.toArray(root.children);
            expect(Array.isArray(arr)).toBe(true);
            expect(arr.length).toBe(2);
        });
    });
});
