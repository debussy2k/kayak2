/*
    공개 이름 검증: 호스트가 이름으로 쓸 수 있는 타입은 entry의 `export type`에 적은 것뿐이다.
    내부 타입(geometry Point, redux Store 등)은 d.ts 안에 있어 추론은 되지만 이름으로는 못 쓴다.
*/
import type { TB_ConfigOptions, KayakJsonObject, DocChangeData, DocChangeListener, Dimension, LoadJsonOptions, LoadJsonResult } from '../../../dist/m1textbox';
import { textbox } from '../../../dist/m1textbox';

const opt: TB_ConfigOptions = { schema: true };
const tb_pt = new textbox(opt);
const saved: KayakJsonObject = tb_pt.saveAsJson();
const listener: DocChangeListener = (e: DocChangeData) => { const c: string = e.cmd; };
tb_pt.add_doc_change_listener(listener);
const dim_pt: Dimension = tb_pt.get_dimension();
const lopt: LoadJsonOptions = { ignore_text_on_path: true };
const loaded: Promise<LoadJsonResult> = tb_pt.loadFromJson(JSON.stringify(saved), lopt);
void dim_pt; void loaded;

// @ts-expect-error 내부 타입은 공개 이름이 아니다
type HiddenPoint = import('../../../dist/m1textbox').Point;
// @ts-expect-error 내부 타입은 공개 이름이 아니다
type HiddenLayer = import('../../../dist/m1textbox').AnySegLayer;
