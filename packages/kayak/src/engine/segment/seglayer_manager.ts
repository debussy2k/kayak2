import GT_PasteInfo from './GT_PasteInfo';
import SEGC from './segment_const';
import type { SegResult } from './segment_const';
import type GT_segmentLayer from './seglayer';
import type GT_segmentLayer_Par from './seglayer_par';
import type GT_SegRange from './GT_SegRange';
import type { HistoryStackEntry, ISegAttr, StyleInfo, StyleResultContext, IAttrPrototype } from './types';

export type AnySegLayer = GT_segmentLayer | GT_segmentLayer_Par;

const ALL_SEG_LAYERS = 'all';
const NO_SEG_LAYER = 'none';

/** undo()/redo()의 반환값 */
export interface UndoRedoResult {
    err: SegResult;
    noop: boolean;
}

/** copy_layer_data()/paste()가 받는 클립보드. GT_MasterClipboard 인스턴스 또는 같은 모양의 객체 */
export interface ILayerClipboard {
    m_srv: GT_SegRange[];
    clear_all(): void;
}

/**
 * styles(array임)를 object.pos를 기준으로 정렬 상태를 유지하면서 access
 * @param  {string} styles - Style array. array element should have .pos variable as a sort key.
 * @param  {string} pos - array의 object.pos와 비교되며, 해당 object가 없으면 pos만 멤버로 가진 object를 만들어 리턴함.
 * @return {Object} 최소한 pos 변수를 가져야 함.
 */
function sa_get(styles: StyleInfo[], pos: number): StyleInfo { // sa : sorted array
    if (styles.length == 0) {
        var obj = { pos: pos };
        styles.push(obj);
        return obj;
    }

    var index_found = sortedIndex(styles, { pos: pos }, function(val) { return val.pos });
    if (styles[index_found] && styles[index_found].pos == pos)
        return styles[index_found];
    else {
        var obj = { pos: pos };
        styles.splice(index_found, 0, obj);
        return obj;
    }
}
function sortedIndex(arr: StyleInfo[], obj: StyleInfo, iteratee: (v: StyleInfo) => number): number {
    var low = 0, high = arr.length;
    var value = iteratee(obj);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(arr[mid]) < value)
        low = mid + 1;
      else
        high = mid;
    }
    return low;
  }

class SeglayerManager {
    private SegLayerVec: AnySegLayer[] = [];
    private HistoryStack: HistoryStackEntry[] = [];
    private stackPointer = -1;
    private HistoryLimit = 0; // undo history 최대 항목 수. 0이면 무제한(기본값).

    dup(): void {}

    get_history_stack_pointer(): number {
        return this.stackPointer;
    }
    get_history_stack(): HistoryStackEntry[] {
        return this.HistoryStack;
    }

    add(segLayer: AnySegLayer): void {
        if (this.HistoryLimit > 0)
            segLayer.set_history_limit(this.HistoryLimit);
        this.SegLayerVec.push(segLayer);
    }

    /*  undo history의 최대 항목 수를 설정한다. (0 또는 미지정이면 무제한)
        manager와 모든 layer에 같은 값을 적용한다.
        하나의 command는 각 layer에 최대 1개의 history 항목만 남기므로,
        layer가 같은 수만큼 보관하면 manager가 보관한 command는 모두 undo할 수 있다.
    */
    set_history_limit(limit: number): void {
        this.HistoryLimit = (limit > 0) ? limit : 0;
        for (var i = 0; i < this.SegLayerVec.length; i++)
            this.SegLayerVec[i].set_history_limit(this.HistoryLimit);
        this.trim_history_stack();
    }
    get_segPar(): AnySegLayer {
        return this.SegLayerVec[0];
    }
    get_segDoc(): AnySegLayer {
        return this.SegLayerVec[1];
    }

    nop(): void {
        //D180421
        this.addToHistoryStack(NO_SEG_LAYER);
    }

	get_curr_history(): HistoryStackEntry | null {
		if (this.stackPointer === -1)
			return null;
		return this.HistoryStack[this.stackPointer];
    }
    get_next_history(): HistoryStackEntry | null {
        if (this.can_redo() == false)
            return null;
		return this.HistoryStack[this.stackPointer+1];
	}

	can_undo(): boolean {
		return (this.stackPointer != -1)
	}
	can_redo(): boolean {
        let nStackSize = this.HistoryStack.length;
		return !(nStackSize == 0 || this.stackPointer == nStackSize - 1)
	}

    /*
        attr은 2가지 type 으로 옴
        type A: ATTR_FontColor처럼 attribute class자체가 오는 것.
        type B: attrbiute class의 object가 오는 것.
                { "ATTR_FontColor": obj_of_ATTR_FontColor, ...}
    */
    insert(pos: number, attr: any): SegResult {
        for (var i = 0; i < this.SegLayerVec.length; i++) {
            let obj = null;
            if (attr && attr._attr_class_name)
                obj = this.SegLayerVec[i].canAccept(attr);           // type-A
            else
                obj = attr[this.SegLayerVec[i]._attr_class_name];    // type-B

            this.SegLayerVec[i].insert(pos, obj);
        }
        this.addToHistoryStack(ALL_SEG_LAYERS);
        return SEGC.OK_ALL;
    }

    insert_newline(pos: number, attr: ISegAttr | null): SegResult {
        for (var i = 0; i < this.SegLayerVec.length; i++)
            this.SegLayerVec[i].insert_newline(pos, this.SegLayerVec[i].canAccept(attr));
        this.addToHistoryStack(ALL_SEG_LAYERS);
        return SEGC.OK_ALL;
    }

    /*  insert_string()은 paste()와 거의 동일하다. SegLayerVec[i].paste()를 그대로 사용함을 주의.
     */
    insert_string(pos: number, str_arr: ArrayLike<number>, attr: any): SegResult {
        for (var i = 0; i < this.SegLayerVec.length; i++) {
            let obj = null;
            if (attr && attr._attr_class_name)
                obj = this.SegLayerVec[i].canAccept(attr);           // type-A
            else
                obj = attr[this.SegLayerVec[i]._attr_class_name];    // type-B


            this.SegLayerVec[i].insert_string(pos, str_arr, obj);
        }
        this.addToHistoryStack(ALL_SEG_LAYERS);

        return SEGC.OK_ALL;
    }

    // posEnd를 생략하면 posBegin 위치의 한 글자를 지운다. (layer.erase()와 동일)
    erase(posBegin: number, posEnd?: number): SegResult {
        for (var i = 0; i < this.SegLayerVec.length; i++)
            this.SegLayerVec[i].erase(posBegin, posEnd);
        this.addToHistoryStack(ALL_SEG_LAYERS);
        return SEGC.OK_ALL;
    }

	/*
		opt.skip
		- true인 경우 연속적인 undo/redo가 가능하게 한다.
	*/
    set(posBegin: number, posEnd: number, attr: ISegAttr | null | undefined, setMask?: any, opt?: { command_auto_play?: string }): SegResult {
        if (attr === null || attr === undefined)
            return SEGC.ERR_ATTRIBUTE_IS_NULL;

        var i, bFound = false;
        var arr: AnySegLayer[] = [];
        for (i = 0; i < this.SegLayerVec.length; i++) {
            if (this.SegLayerVec[i].canAccept(attr)) {
                this.SegLayerVec[i].set(posBegin, posEnd, attr, setMask);
                arr.push(this.SegLayerVec[i]);
                bFound = true;
            }
        }
        if (bFound)
            this.addToHistoryStack(arr, opt);

        console.assert(bFound, 'shoud be found');
        return SEGC.OK_ALL;
    }

    paste(pos: number, non_clipboard_copy_string: number[], pMasterClipboard?: ILayerClipboard | null): SegResult {
        // m_seg_mgr의 각 layer가 가지고 있는 local clipboard에 layer data를 주입한다.
        // (이후 paste()호출하면 local clipbaord의 값으로 paste하게 된다.)
        if (pMasterClipboard) {
            // layer 구성이 다른 클립보드는 어떤 layer도 바꾸기 전에 거부한다.
            if (!this.is_compatible_clipboard(pMasterClipboard))
                return SEGC.ERR_RANGE_EMPTY;
            this.import_from_clipboard_layer_data(pMasterClipboard);
        }

        var PasteInfo = new GT_PasteInfo;
        for (var i = 0; i < this.SegLayerVec.length; i++)
            if (this.SegLayerVec[i].query_if_last_newline_being_erased(pos, pos)) {
                PasteInfo.m_last_newline_being_erased_case = true;
                break;
            }
        PasteInfo.non_clipboard_copy_string = non_clipboard_copy_string.slice(0);

        for (var i = 0; i < this.SegLayerVec.length; i++)
            this.SegLayerVec[i].paste(pos, PasteInfo);
        this.addToHistoryStack(ALL_SEG_LAYERS);

        return SEGC.OK_ALL;
    }

    copy(posBegin: number, posEnd: number): SegResult {
        for (var i = 0; i < this.SegLayerVec.length; i++)
            this.SegLayerVec[i].copy(posBegin, posEnd);
        return SEGC.OK_ALL;
    }

    copy_layer_data(posBegin: number, posEnd: number, pMasterClipboard: ILayerClipboard): SegResult {
        pMasterClipboard.clear_all();

        for (var i = 0; i < this.SegLayerVec.length; i++) {
            var SegRange = this.SegLayerVec[i].clone_SegRngCopy();
            pMasterClipboard.m_srv.push(SegRange);
        }
        return SEGC.OK_ALL;
    }

    undo(): UndoRedoResult {
        var ret: UndoRedoResult = {
            err : SEGC.OK_ALL,
            noop : false
        }

        if (this.stackPointer == -1) {
            ret.err = SEGC.ERR_BEGIN_OF_HISTORY
            return ret;
        }
        var pSL = this.HistoryStack[this.stackPointer].item;
        if (pSL === NO_SEG_LAYER) {
            ret.noop = true;
        }
        else if (pSL === ALL_SEG_LAYERS) {
            for (var i = 0; i < this.SegLayerVec.length; i++)
                this.SegLayerVec[i].undo();
        } else if (pSL instanceof Array) {
            for (var i = 0; i < pSL.length; i++)
                pSL[i].undo();
        } else if (pSL)
            ret.err = (pSL as AnySegLayer).undo();

		--this.stackPointer;
		this.verify();
        return ret;
    }

    redo(): UndoRedoResult {
        var ret: UndoRedoResult = {
            err : SEGC.OK_ALL,
            noop : false
        }

        var nStackSize = this.HistoryStack.length;
        if (nStackSize == 0 || this.stackPointer == nStackSize - 1) {
            ret.err = SEGC.ERR_END_OF_HISTORY
            return ret;
        }

        ++this.stackPointer;
        var pSL = this.HistoryStack[this.stackPointer].item;
        if (pSL === NO_SEG_LAYER) {
            ret.noop = true;
        }
        else if (pSL === ALL_SEG_LAYERS) {
            for (var i = 0; i < this.SegLayerVec.length; i++)
                this.SegLayerVec[i].redo();
        } else if (pSL instanceof Array) {
            for (var i = 0; i < pSL.length; i++)
                pSL[i].redo();
        } else if (pSL)
            ret.err = (pSL as AnySegLayer).redo();

		this.verify();
        return ret;
    }

    reset_history(): void {
        this.HistoryStack.length = 0;
        this.stackPointer = -1;

        for (var i = 0; i < this.SegLayerVec.length; i++)
            this.SegLayerVec[i].reset_history()
    }

    get_attributes_from_seglayer(ci_doc: number, cur_style: Record<string, ISegAttr>): void {
        // Par layer는 styles 추출 대상에서 제외임. i는 1부터 시작.
        for (var i = 1; i < this.SegLayerVec.length; i++) {
            var seglayer = this.SegLayerVec[i];
            seglayer.getAttr_by_gravity(ci_doc, null, (style) => {
                let attr = style.clone();
                attr.m_nCount = 1; // 큰 의미는 없으나 1로 재설정함.
                cur_style[attr._attr_class_name] = attr;
            })
        }
    }

    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    // 2017.10.2 TB_DocFactory.js 에서 이곳으로 method를 옮김
    // Style Extraction
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    exctract_style_from_seglayer(styles: StyleInfo[], rng: { begin: number; end: number }, segVec: ISegAttr[], style_setter: IAttrPrototype['style_setter']): void {   // 메서드 시그니처라 strictFunctionTypes에서 bivariant (ATTR_Par.prototype.style_setter를 넘긴다)
        /*
        	styles에 각 seglayer의 변화정보가 모두 다 들어가는 것은 아님.
        	변화가 시작되는 지점의 정보만 styles에 기록하는 방식임 (마치 스트림 처럼)

        	ex> "aabb"의 style정보가 아래와 같은 경우
        	bold      : {BB}{bb}
        	font-size : {ff  ff}

        	styles정보는 다음과 같이 3개의 정보를 가지게 됨.
        	[
        		{bold:true,  FontSize:20, pos:0}
        		{bold:false,              pos:2}
        		{                         pos:4}
        	]

        	- styles[0]은 style정보를 모두 빠짐없이 가지고 있음.
        	- styles[1]에서 FontSize정보가 없으며, 이는 styles[0]의 값을 그대로 사용해야함을 뜻함.
        */

        /*  style_obj는 아래의 interface형태임.
            interface style_obj {
                pos: number;
                bold: boolean;      // ATTR_BOLD.prototype.style_setter() 에서 추가됨.
                FontSize: number;   // ATTR_FontSize.prototype.style_setter() 에서 추가됨.
            }
        */
        var style_obj: StyleInfo | null = null;
        var pos = 0;
        var i = 0;
        for (; i < segVec.length; i++) {
            pos += segVec[i].m_nCount;
            if (rng.begin < pos) {
                style_obj = sa_get(styles, rng.begin); // styles array에 push된 항목이 style_obj로 리턴됨.
                style_setter(style_obj, segVec[i]);
                i++;
                break;
            }
        }
        for (; i < segVec.length; i++) {
            if (rng.begin < pos && pos < rng.end) { // middle
                style_obj = sa_get(styles, pos);
                style_setter(style_obj, segVec[i]);
            } else if (pos >= rng.end) {
                style_obj = sa_get(styles, rng.end);
                style_setter(style_obj, segVec[i]);
                break;
            }
            pos += segVec[i].m_nCount;
        }

        style_obj = sa_get(styles, rng.end);
    }

    /**

     * 목적 : style_info의 내용을 context의 값에 누적 시킨다.
     * 설명 : style_info의 해당항목에 대응하는 ATTR_*.prototype.css_string()함수를 방문하여 context를 갱신한다.
              context는 css를 만들기 위한 직전의 자료구조이다.

     * style_info {
            FontSize : 18
            bold : false
            fontColor : "black"
            letter_space : 0
            par : {m_Align: undefined, m_Findent: 0, m_Lindent: 0, m_LineSpace: 1, m_Rindent: 0, …}
            pos : 0
            start_of_par : true
       }
     * context:<TB_StyleContext> {
            font_family: "font-family:Arial;",
            FontSize: "font-size:18pt;",
            bold: "font-weight:normal;",
            fontColor: "color:black;",
            letter_space: "margin-right:0em;"
        }
    */
    get_span_style_string(style_info: StyleInfo, context: any, options?: { for_clipbaord_export?: boolean }): string {
        // ##exctract_style_from_seglayer 설명 참고할 것.

        ////////////////////////////
        //D Layer
        if (true) // font 선택 기능을 만들기 전까지만 이렇게 사용함.
            context.css_data.font_family = 'font-family:Arial;';

        // 모든 seg_layer를 돌면서 ATTR_*.prototype.css_string()함수를 방문한다.
        // 방문한 css_string()에서 style_info에서 선택적으로 context의 정보를 갱신(누적)한다.
        this.css_string(style_info, context);

        var for_clipbaord_export = options && options.for_clipbaord_export;
        var css_str = context.build_css_str(for_clipbaord_export);
        // console.log(css_str)

        return css_str;
    }


    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    // 2017.6.2 이후 추가
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////

    // obj의 내용으로 seglayer를 채움
    setByDataObject(obj: Record<string, any>): void {
        /* interface obj {
                text_arr: Array<Number>
                text_raw: String
                ATTR_Par: Array<any>        <-- 여기서 부터 사용
                ATTR_FontSize: Array<any>
                ATTR_Bold: Array<any>
                ...
            }
        */
        for (var i = 0; i < this.SegLayerVec.length; i++) {
            var seglayer = this.SegLayerVec[i];
            if (obj[seglayer._attr_class_name]) {
                seglayer.setByDataObject(obj[seglayer._attr_class_name], seglayer._attr_prototype.factory);
            }
            else {
                /*
                    layer가 새로 추가된 경우, 이전에 저장된 내용을 로딩하게 되면 이 경로로 온다.
                    새로 추가된 layer에 m_nCount만 동일하게 설정하여 값을 채운다.
                */
                let attr_obj = seglayer._attr_prototype.factory();
                attr_obj.m_nCount = obj.text_arr.length
                seglayer.setByDataObject([attr_obj], seglayer._attr_prototype.factory);

            }
        }
    }

    // seglayer의 내용을 obj에 채워줌
    saveToObject(obj: Record<string, any>): void {
        /* obj에 아래 항목을 추가하게 됨.
            {
                ATTR_Par: Array<any>        <-- 여기서 부터 사용
                ATTR_FontSize: Array<any>
                ATTR_Bold: Array<any>
                ...
            }
        */
        for (var i = 0; i < this.SegLayerVec.length; i++) {
            var seglayer = this.SegLayerVec[i];
            obj[seglayer._attr_class_name] = seglayer.getDataObject();
        }
    }

    extract_styles_except_par_layer(styles: StyleInfo[], rng: { begin: number; end: number }): void {
        // Par layer는 styles 추출 대상에서 제외임. i는 1부터 시작.
        for (var i = 1; i < this.SegLayerVec.length; i++) {
            var seglayer = this.SegLayerVec[i];
            this.exctract_style_from_seglayer(styles, rng, seglayer._get_vec(), seglayer._attr_prototype.style_setter);
        }
    }

    css_string(style_info: StyleInfo, context: StyleResultContext): void {
        // Par layer는 styles 추출 대상에서 제외임. i는 1부터 시작.
        for (var i = 1; i < this.SegLayerVec.length; i++) {
            this.SegLayerVec[i]._attr_prototype.css_string(style_info, context)
        }
    }

    // ci_doc위치에서의 style 정보를 리턴함
    get_style_info(ci_doc: number, cur_style: StyleInfo): void {
        // Par layer는 styles 추출 대상에서 제외임. i는 1부터 시작.
        for (var i = 1; i < this.SegLayerVec.length; i++) {
            var seglayer = this.SegLayerVec[i];
            seglayer.getAttr_by_gravity(ci_doc, null, (style) => {
                seglayer._attr_prototype.style_setter(cur_style, style);
            })
        }
    }


    // private method
    ////////////////////////////////////////////////////////////////////////////////

	set_command_option(opt?: { command_auto_play?: string }): void {
		if (opt && opt.command_auto_play != undefined) {
			this.HistoryStack[this.stackPointer].command_auto_play = opt.command_auto_play
		}
	}

	/*
		opt.command_auto_play에 가능한 값
		-> "start" 또는 "run"
			이 값이 있는 stackPoint의 command를 실행하고, 다음번 command를 연속 실행한다.
			다음번 command의 command_auto_play가 "run"이면 그 다음 command를 실행한다.
			그리고 과정을 "run"이 아닌 command가 나올 때 까지 반복한다.

		목적
			command group를 구현한 것임.
	*/
    private addToHistoryStack(pSegLayer: HistoryStackEntry['item'], opt?: { command_auto_play?: string }): void {
		this.verify();

        if (this.HistoryStack.length > 0)
            this.HistoryStack.splice(this.stackPointer + 1, this.HistoryStack.length);
        this.HistoryStack.push({
			item: pSegLayer,
			command_auto_play: (opt && opt.command_auto_play != undefined) ? opt.command_auto_play : null
		});
        ++this.stackPointer;
        this.trim_history_stack();
    }

    // 상한을 넘으면 가장 오래된 항목부터 버린다.
    private trim_history_stack(): void {
        if (this.HistoryLimit > 0 && this.HistoryStack.length > this.HistoryLimit) {
            var nRemove = this.HistoryStack.length - this.HistoryLimit;
            this.HistoryStack.splice(0, nRemove);
            this.stackPointer = Math.max(this.stackPointer - nRemove, -1);
        }
    }

    /*  클립보드의 layer data(m_srv)가 현재 layer 구성과 맞는지 검사한다.
        - layer 수가 같아야 하고
        - 내용이 있는 range는 같은 순서의 layer와 attribute class가 같아야 한다.
    */
    private is_compatible_clipboard(pMasterClipboard: ILayerClipboard): boolean {
        var srv = pMasterClipboard.m_srv;
        if (!srv || srv.length !== this.SegLayerVec.length)
            return false;

        for (var i = 0; i < this.SegLayerVec.length; i++) {
            if (!srv[i] || !srv[i].m_SegVec)
                return false;
            if (srv[i].m_SegVec.length > 0 &&
                srv[i].m_SegVec[0]._attr_class_name !== this.SegLayerVec[i]._attr_class_name)
                return false;
        }
        return true;
    }

    private import_from_clipboard_layer_data(pMasterClipboard: ILayerClipboard): SegResult {
        for (var i = 0; i < this.SegLayerVec.length; i++)
            this.SegLayerVec[i].load_new_SegRngCopy(pMasterClipboard.m_srv[i]);
        return SEGC.OK_ALL;
	}

	// 필요할 때만 comment제거하여 사용하기
	private verify(): void {
		// SegLayerVec.forEach(segLayer => {
		// 	// console.log(segLayer._attr_class_name, segLayer.getLength())
		// 	if (segLayer._attr_class_name == 'ATTR_FontColor')
		// 		console.log(segLayer._attr_class_name, segLayer.getLength(),  segLayer, segLayer._get_vec())
		// })
	}
}

export default SeglayerManager;
