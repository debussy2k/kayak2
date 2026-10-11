/// <reference path="./types/globals.d.ts" />
/// <reference path="./types/css-element-queries.d.ts" />
// (dts-bundle-generator는 entry의 import 그래프만 보므로 전역 선언 파일을 알려준다. Vite는 이 주석을 무시한다)
import TB_PlatformEnv from './engine/textbox/TB_PlatformEnv';
export { TB_PlatformEnv }


import  textbox from "./engine/textbox/TextBox";
export { textbox }

import GT_MasterClipboard from "./engine/segment/master_clipboard";
export { GT_MasterClipboard };

import { spFontManager } from './engine/textbox/TB_FontManager';
export { spFontManager }

import { TB_InDesignJsonConverter } from './engine/textbox/TB_InDesignJsonConverter';
export { TB_InDesignJsonConverter }

// 호스트가 이름으로 쓸 수 있는 타입. dts-bundle.config.json의 exportReferencedTypes:false라서
// 여기 적은 것만 dist/*.d.ts에서 공개된다(나머지 내부 타입은 추론에만 쓰인다). 타입 전용이라 번들에는 영향 없음.
export type { TB_ConfigOptions, KayakJsonObject, DocChangeData, DocChangeListener, Dimension, LoadJsonOptions, LoadJsonResult } from './engine/textbox/types';
