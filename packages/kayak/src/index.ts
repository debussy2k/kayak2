/// <reference path="./types/globals.d.ts" />
/// <reference path="./types/css-element-queries.d.ts" />
// (dts-bundle-generator는 entry의 import 그래프만 보므로 전역 선언 파일을 알려준다. Vite는 이 주석을 무시한다)
/*
    base.css를 번들 JS 안에 문자열로 포함하고, 로드될 때 <head>에 <style>로 넣는다.
    (예전 webpack의 style-loader와 같은 동작. 라이브러리를 JS 파일 하나로 배포하기 위함)
*/
import base_css from './engine/css/base.css?inline';

if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(base_css));
    document.head.appendChild(style);
}

/*  OLD SOURCE (ES5)
    ES5 commonjs 방식으로 로딩하였던 경우임.
var textbox = require("./textbox/TextBox.js");
var GT_MasterClipboard = require("./segment/master_clipboard.js");
var MeasureDiv = require("./textbox/word_fetch.js").MeasureDiv;
var TB_NormalizedIME = require("./engine/textbox/TB_NormalizedIME");

module.exports = {
    textbox: textbox,
    GT_MasterClipboard: GT_MasterClipboard,
    MeasureDiv: MeasureDiv,
    TB_NormalizedIME: TB_NormalizedIME
}
*/


/////////////////////////////////////////////////////////////////////////////
// NEW SOURCE (ES6 by Babel)

/* export-import Pattern 설명

    1A. commonjs로 export된 것을 import하는 방법
        export (commonjs)
            module.exports = GT_MasterClipboard;
        import (es6)
            import GT_MasterClipboard from "./engine/segment/master_clipboard";
    
    1B. commonjs로 여러개 export 된 것을 import하는 방법
        export (commonjs)
            module.exports = {
                findWord: findWord,
                MeasureDiv: MeasureDiv
            }
        import (es6)
            export { MeasureDiv } from "./textbox/word_fetch";

    2. 모두 es6
        export (es6)
            export default textbox
        import (es6)
            import  textbox from "./engine/textbox/TextBox";
            export { textbox }            

*/

import TB_PlatformEnv from './engine/textbox/TB_PlatformEnv';
export { TB_PlatformEnv }

// var textbox = require("./textbox/TextBox.js");                       // ES5
import  textbox from "./engine/textbox/TextBox";
export { textbox }

// var GT_MasterClipboard = require("./segment/master_clipboard.js");   // ES5
import GT_MasterClipboard from "./engine/segment/master_clipboard";
export { GT_MasterClipboard };

// var MeasureDiv = require("./textbox/word_fetch.js").MeasureDiv;      // ES5
import MeasureDiv from "./engine/textbox/MeasureDiv";
export { MeasureDiv };

// var TB_NormalizedIME = require("./engine/textbox/TB_NormalizedIME");        // ES5
import TB_NormalizedIME from "./engine/textbox/TB_NormalizedIME";
export { TB_NormalizedIME }

import { spFontManager } from './engine/textbox/TB_FontManager';
export { spFontManager }

import { TB_InDesignJsonConverter } from './engine/textbox/TB_InDesignJsonConverter';
export { TB_InDesignJsonConverter }

import { TB_FontSizeStepUtil } from './engine/textbox/TB_FontSizeStepUtil'
export { TB_FontSizeStepUtil }

// 호스트가 이름으로 쓸 수 있는 타입. dts-bundle.config.json의 exportReferencedTypes:false라서
// 여기 적은 것만 dist/*.d.ts에서 공개된다(나머지 내부 타입은 추론에만 쓰인다). 타입 전용이라 번들에는 영향 없음.
export type { TB_ConfigOptions, KayakJsonObject, DocChangeData, DocChangeListener, Dimension, LoadJsonOptions, LoadJsonResult } from './engine/textbox/types';
