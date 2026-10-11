/*
    dist/m1textbox.d.ts 소비자 검증 (npm run check_types_dist). @types/node 없이 strict로 컴파일된다.
    여기서 쓰는 API가 호스트에 약속하는 공개 표면이다.
*/
import { textbox, GT_MasterClipboard, spFontManager, TB_PlatformEnv, TB_InDesignJsonConverter, MeasureDiv, TB_NormalizedIME, TB_FontSizeStepUtil } from '../../../dist/m1textbox';

const tb = new textbox({ schema: true, masterClipboard: GT_MasterClipboard.getInstance() });
tb.opEdit.insert_string(0, 'hi');
const n: number = tb.text_length();
const json = tb.saveAsJson();
const text: number[] = json.text_arr;
tb.add_doc_change_listener(e => { const c: string = e.cmd; });
const dim = tb.get_dimension();
const h: number = dim.page_height;
const font = spFontManager._find_default_values('default-host-ko');
const fam: string = font.familyName;
TB_PlatformEnv.set({ window: window });
const conv = new TB_InDesignJsonConverter({ src_unit: 'mm', font_list: null });
const px: number = conv.toPx(25.4);
const util = new TB_FontSizeStepUtil();
const up: number = util.upper_font_size(10);
void MeasureDiv; void TB_NormalizedIME;
