import GT_SegRange from "./GT_SegRange";
import GT_SegHistory from "./GT_SegHistory";
import SEGC from './segment_const';
import type { Gravity, GxFlag, SegResult } from './segment_const';
import type GT_PasteInfo from './GT_PasteInfo';
import type { IAttrPrototype, ISegAttr, SegPos, ChangeRange, SegInfo, SegSpan, SegHistoryInfo, SegLayerOptions, CommandChangeInfo } from './types';

/** A: 이 레이어가 담는 ATTR 클래스 (ATTR_Par 또는 ATTR_Doc). 조회만 A로 돌려준다 — 내부 m_SegVec는 ISegAttr[] 그대로 */
class GT_segmentLayer_Par<A extends ISegAttr = ISegAttr> {
    _attr_class_name: string;
    _attr_prototype: IAttrPrototype;
    private _nGravity: Gravity;
    /*  _accept_new_line는 ATTR_Par만 true로 설정하여 사용함.
        ATTR_Doc은 특수한 경우로, ATTR_Par와 같은 특성이지만 문서전체를 하나의 attribute로 관리하며
        이를 위해 newline이 발생되지 않도록 한다.
    */
    private _accept_newline: boolean;
    private m_SegRngCopy = new GT_SegRange;

    private m_SegVec: ISegAttr[] = [];

    // for undo/redo
    private m_History = new GT_SegHistory;
    private m_SegRngBefore = new GT_SegRange;
    private m_SegRngAfter = new GT_SegRange;

    m_LastAction: SegHistoryInfo | null = null;

    constructor(nGravity: Gravity, attr_class_name: string, attr_prototype: IAttrPrototype, opt?: SegLayerOptions) {
        this._nGravity = nGravity;
        this._attr_class_name = attr_class_name;
        this._attr_prototype = attr_prototype;
        this._accept_newline = (opt && opt.accept_newline == false) ? false : true;
    }

    get_command_change_info(edit_cmd: string): CommandChangeInfo | null {
        if (this.m_LastAction == null)
            return null;

        // clone SegRange for prevent unexpected change.
        var change_info: CommandChangeInfo = {
            edit_cmd: edit_cmd,
            history_pointer: this.m_History.getPointer(),
            par_length: this.m_SegVec.length
        };
        if (edit_cmd != 'undo') {
            change_info.before = this.m_LastAction.m_pSegRngBefore.clone();
            change_info.after = this.m_LastAction.m_pSegRngAfter.clone();
        } else {
            change_info.before = this.m_LastAction.m_pSegRngAfter.clone();
            change_info.after = this.m_LastAction.m_pSegRngBefore.clone();
        }

        return change_info;
    }

    // for debugging
    assert(expr: any, obj?: any): void {
        console.assert(expr, obj);
    }

    set_history_limit(limit: number): void {
        this.m_History.set_history_limit(limit);
    }

    dup_segment_vec(that: GT_segmentLayer_Par): void {
        // 1. 현재의 mm_SegVec을 비움
        this.m_SegVec.length = 0;

        var vec = that._get_vec();
        for (var i = 0; i < vec.length; i++)
            this.m_SegVec.push(vec[i].clone());
    }

    _get_vec(): A[] {
        return this.m_SegVec as A[];
	}

	is_last_index(index: number): boolean {
		return index == (this.m_SegVec.length - 1)
	}

	getLength(): number {
		return this.m_SegVec.reduce((sum, seg) => {return sum += seg.m_nCount}, 0)
	}

    getDataObject(): Record<string, any>[] {
        var arr = this.m_SegVec.map((seg) => {
            return seg.getDataObject();
        })
        return arr;
    }
    setByDataObject(arr: Record<string, any>[], factory: () => ISegAttr): void {
        this.m_SegVec.length = 0;

        arr.forEach((data) => {
            var obj = factory();
            obj.set(data);
            this.m_SegVec.push(obj);
        })
    }

    canAccept(attrObj: ISegAttr | null): A | null {
        return attrObj as A;
        // if (attrObj === null)
        // 	return null;
        // return (this._attr_class_name === attrObj.constructor.name) ? attrObj : null;
    }

    log(): void {
        //console.log('m_SegVec: ', m_SegVec);
        var str = '';
        for (var i = 0; i < this.m_SegVec.length; i++)
            str += '[m_nLineGap:' + (this.m_SegVec[i] as any).m_nLineGap + ', cnt:' + this.m_SegVec[i].m_nCount + ']  ';
        console.log(str);

        //m_History.log();
    }

    reset_history(): void {
        this.m_History.reset();
    }

    insert(nPos: number, pAttr: ISegAttr | null): SegResult {
        var segPos: SegPos = { pIndex: 0, pOffset: 0 };
        var err_code = this.getInsertPosition(nPos, segPos);
        var nIndex = segPos.pIndex;
        var nOffset = segPos.pOffset;

        if (err_code === SEGC.OK_ALL) {
            this.save_undo_info(nIndex, nIndex + 1);
            ++this.m_SegVec[nIndex].m_nCount;
            this.save_redo_info(nIndex, nIndex + 1);
        } else if (err_code === SEGC.ERR_SEGVEC_EMPTY) {
            if (pAttr === undefined || pAttr === null) {
                console.assert(false, "Attribute is needed");
                return SEGC.ERR_NEED_ATTRIBUTE;
            }
            //GT_Segment seg(pAttr); // GT_Segment::m_count는 자동으로 1로 셋팅됨.
            var seg = pAttr.factory(); //D

            this.save_undo_info(0, 0);
            this.m_SegVec.push(seg);
            this.save_redo_info(0, 1);
        } else if (err_code === SEGC.OK_NEED_INSERT_SEGMENT_BEFORE) {
            this.assert(false);
        }

        //_show_vec();
        this.m_LastAction = this.m_History.getLastStep();
        return SEGC.OK_ALL;
    }

    insert_newline(nPos: number, pAttr: ISegAttr | null): SegResult {
        if (this._accept_newline == false)
            return this.insert(nPos, pAttr);

        var segPos: SegPos = { pIndex: 0, pOffset: 0 };
        var err_code = this.getInsertPosition(nPos, segPos);
        var nIndex = segPos.pIndex;
        var nOffset = segPos.pOffset;

        if (err_code == SEGC.OK_ALL) {
            if (nOffset == 0) {
                // pAttr는 호출자가 재사용할 수 있으므로 복제하여 저장한다.
                var attr_obj = (pAttr === undefined || pAttr === null) ? this.m_SegVec[nIndex].factory() : pAttr.clone();
                this.save_undo_info(nIndex, nIndex);
                this.insert_to(nIndex, attr_obj);
                this.save_redo_info(nIndex, nIndex + 1);
            } else if (nOffset >= this.m_SegVec[nIndex].m_nCount) {
                // 가장 마지막 위치에 삽입하는 경우.
                var attr_obj = (pAttr === undefined || pAttr === null) ? this.m_SegVec[nIndex].factory() : pAttr.clone();
                this.save_undo_info(nIndex + 1, nIndex + 1);
                this.insert_to(nIndex + 1, attr_obj);
                this.save_redo_info(nIndex + 1, nIndex + 2);
            } else {
                this.save_undo_info(nIndex, nIndex + 1);

                var nInsertPos = this.split(nIndex, nOffset);
                ++this.m_SegVec[nIndex].m_nCount;
                this.save_redo_info(nIndex, nIndex + 2);
            }
        } else if (err_code == SEGC.ERR_SEGVEC_EMPTY) {
            this.assert(pAttr);
            this.insert(nPos, pAttr);
        } else if (err_code == SEGC.OK_NEED_INSERT_SEGMENT_BEFORE) {
            this.assert(false);
        }

        //_show_vec();
        this.m_LastAction = this.m_History.getLastStep();
        return SEGC.OK_ALL;
    }

    insert_string(nPos: number, str_arr: ArrayLike<number>, pAttr: ISegAttr | null): SegResult {
        var segPos: SegPos = { pIndex: 0, pOffset: 0 };
        var err_code = this.getInsertPosition(nPos, segPos);
        var nIndex = segPos.pIndex;
        var nOffset = segPos.pOffset;

        if (err_code === SEGC.OK_ALL) {
            this.save_undo_info(nIndex, nIndex + 1);
            this.m_SegVec[nIndex].m_nCount += str_arr.length;
            this.save_redo_info(nIndex, nIndex + 1);
        }
        else {
            this.assert(false);
        }

        this.m_LastAction = this.m_History.getLastStep();
        return SEGC.OK_ALL;
    }

    erase(begin: number, end?: number): SegResult {
        var nPosBegin = begin;
        var nPosEnd = (end == undefined) ? (begin + 1) : end;
        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////
        var segPos_b: SegPos = { pIndex: 0, pOffset: 0 };
        var segPos_e: SegPos = { pIndex: 0, pOffset: 0 };
        this.getPosition(nPosBegin, segPos_b);
        this.getPosition(nPosEnd, segPos_e);
        var n = segPos_b.pIndex;
        var b_offset = segPos_b.pOffset;
        var m = segPos_e.pIndex;
        var e_offset = segPos_e.pOffset;


        // erase하면 변화되는 segment의 범위를 추적함.
        var chg: ChangeRange = { nUndo_Begin: 0, nUndo_End: 0, nRedo_Begin: 0, nRedo_End: 0 };
        this.get_changes_on_erasing(nPosBegin, nPosEnd, chg);

        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////

        this.save_undo_info(chg.nUndo_Begin, chg.nUndo_End);

        this.erase_range(nPosBegin, nPosEnd);
        if (b_offset > 0 && n < m)
            this.merge_with_next_seg(n, true);
        this.save_redo_info(chg.nRedo_Begin, chg.nRedo_End);

        //_show_vec();
        this.m_LastAction = this.m_History.getLastStep();
        return SEGC.OK_ALL;
    }

    set(nPosBegin: number, nPosEnd: number, pAttr: ISegAttr, setMask?: any): SegResult {
        // 이 함수는 원래 par의 시작과 끝을 항상 지정하여
        // par전체의 attr를 변경하는 식으로 사용되었다.
        // 즉 (1,0)~(2,0)처럼 항상 사용되었으면
        // 그 간접적인 증거는 오른쪽 소스임: MT_ASSERT(b_offset==0 && e_offset==0);

        // par 특성에 맞도록 변화를 추적하여 적용할 것

        var err_code: SegResult;

        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////
        var segPos_b: SegPos = { pIndex: 0, pOffset: 0 };
        var segPos_e: SegPos = { pIndex: 0, pOffset: 0 };

        this.getPosition(nPosBegin, segPos_b);
        err_code = this.getPosition(nPosEnd, segPos_e);

        var n = segPos_b.pIndex;
        var b_offset = segPos_b.pOffset;
        var m = segPos_e.pIndex;
        var e_offset = segPos_e.pOffset;


        // sel은 char단위로 설정되지만, par속성은 par단위로 설정되므로,
        // sel이 포함되는 par의 범위(n~m)를 찾아내어 그것의 속성을 변경한다.
        var real_pIndex = m;
        if (nPosBegin === nPosEnd) { // case-1 : 범위가 없으면 [n, n+1) 범위
            // 문서 끝(total) 위치는 가상의 다음 segment(n == length)를 가리키므로 마지막 par로 본다.
            if (n >= this.m_SegVec.length)
                n = Math.max(this.m_SegVec.length - 1, 0);
            real_pIndex = Math.min(n + 1, this.m_SegVec.length);
        }
        else if (e_offset > 0) // case-2 : 범위가 있고, 해당 par의 0번째 char가 아니면 par의 끝까지 포함.
            real_pIndex = m + 1;
        // console.log(n, b_offset, m, e_offset, real_pIndex);

        /////////////////////////////////////////////////////////////////////
        //MT_ASSERT(b_offset==0 && e_offset==0);
        this.save_undo_info(n, real_pIndex);
        // pAttr가 "ATTR_Par"이 아닌 경우는, set을 한 범위만 기억하는 것을 의미.
        if (this._attr_class_name === pAttr._attr_class_name) {
            for (var i = n; i < real_pIndex; i++)
                this.m_SegVec[i].set(pAttr, setMask);
        }
        this.save_redo_info(n, real_pIndex);

        this.m_LastAction = this.m_History.getLastStep();
        return SEGC.OK_ALL;
        /////////////////////////////////////////////////////////////////////
    }

    query_if_last_newline_being_erased(nPosBegin: number, nPosEnd: number): boolean {
        // selection block의 끝에 last $가 포함되어 있고, copy block의 끝에 $가 없는 경우
        // 문서의 마지막 $를 유지하기 위한 추가 작업이 필요한 지를 알려줌.
        // par layer에서는 true/false를 리턴할 수 있으며,
        // 일반 layer에서는 항상 false를 리턴한다.

        var case_happened = false;

        if (nPosEnd == this.getElementTotal() && // selection block이 Last$를 포함하고,
            !this.m_SegRngCopy.m_last_whole_seg) // copy block의 끝에 $가 없는 경우
            case_happened = true;

        return case_happened;
    }

    paste(nPos: number, PasteInfo: GT_PasteInfo): SegResult {
        var err_code: SegResult;

        //T10 par layer에서는 last $가 제거되는 경우를 검사하여
        // attr layer에게 그 정보를 넘겨주어야 함.
        PasteInfo.m_last_newline_being_erased_case = this.query_if_last_newline_being_erased(nPos, nPos);

        var segPos: SegPos = { pIndex: 0, pOffset: 0 };
        err_code = this.getPosition(nPos, segPos);
        var nSegIndex = segPos.pIndex;
        var nOffset = segPos.pOffset;

        var pSegRngCopy: GT_SegRange | null = null;
        var SegRngCopy_Local = new GT_SegRange;
        if (PasteInfo.non_clipboard_copy_string.length > 0) {
            SegRngCopy_Local.make_from_string(PasteInfo.non_clipboard_copy_string, this.m_SegVec[nSegIndex]);
            pSegRngCopy = SegRngCopy_Local;
        } else
            pSegRngCopy = this.m_SegRngCopy;

        if (pSegRngCopy.m_SegVec.length == 0)
            return SEGC.ERR_RANGE_EMPTY;


        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////
        var chg: ChangeRange = { nUndo_Begin: 0, nUndo_End: 0, nRedo_Begin: 0, nRedo_End: 0 };
        this.get_changes_on_pasting(pSegRngCopy, nPos, nPos, chg);
        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////

        this.save_undo_info(chg.nUndo_Begin, chg.nUndo_End);
        this.paste_operation(pSegRngCopy, nPos, nSegIndex, nOffset);
        this.save_redo_info(chg.nRedo_Begin, chg.nRedo_End);

        //_show_vec();
        this.m_LastAction = this.m_History.getLastStep();
        return SEGC.OK_ALL;
    }

    clone_SegRngCopy(): GT_SegRange {
        return this.m_SegRngCopy.clone();
    }
    load_new_SegRngCopy(pCopyBlock: GT_SegRange): SegResult {
        this.m_SegRngCopy.clear();
        this.m_SegRngCopy.copy(pCopyBlock);
        return SEGC.OK_ALL;
    }
    __get_copy_clone(): GT_SegRange {
        return this.m_SegRngCopy.clone();
    }
    __copy_from(pCopyBlock: GT_SegRange): SegResult {
        this.m_SegRngCopy.clear();
        this.m_SegRngCopy.copy(pCopyBlock); //D
        return SEGC.OK_ALL;
    }

    copy(nPosBegin: number, nPosEnd: number): SegResult {
        var err_code: SegResult;
        this.m_SegRngCopy.clear();

        var segPos_b: SegPos = { pIndex: 0, pOffset: 0 };
        var segPos_e: SegPos = { pIndex: 0, pOffset: 0 };

        err_code = this.getPosition(nPosBegin, segPos_b);
        err_code = this.getPosition(nPosEnd, segPos_e);

        for (var i = segPos_b.pIndex; i <= segPos_e.pIndex; i++) {
            if (i == segPos_b.pIndex) {
                //GT_Segment seg(m_SegVec[i].m_pAttribute);
                var seg = this.m_SegVec[i].factory(); //D
                if (segPos_b.pIndex == segPos_e.pIndex) {
                    seg.m_nCount = nPosEnd - nPosBegin;
                    this.m_SegRngCopy.m_first_whole_seg = false;
                } else
                    seg.m_nCount = this.m_SegVec[i].m_nCount - segPos_b.pOffset;

                this.m_SegRngCopy.m_SegVec.push(seg);
            } else if (i == segPos_e.pIndex) {
                if (segPos_e.pOffset > 0) {
                    //GT_Segment seg(m_SegVec[i].m_pAttribute);
                    var seg = this.m_SegVec[i].factory(); //D
                    seg.m_nCount = segPos_e.pOffset;
                    this.m_SegRngCopy.m_SegVec.push(seg);
                    this.m_SegRngCopy.m_last_whole_seg = false;
                } else {
                    if (segPos_e.pOffset == 0)
                        this.m_SegRngCopy.m_last_whole_seg = true;
                }
            } else {
                this.m_SegRngCopy.m_SegVec.push(this.m_SegVec[i].clone());
            }
        }

        if (this.m_SegRngCopy.m_first_whole_seg == false && segPos_b.pIndex < segPos_e.pIndex)
            this.assert(false);


        if (segPos_b.pIndex == segPos_e.pIndex)
            this.m_SegRngCopy.m_last_whole_seg = this.m_SegRngCopy.m_first_whole_seg;

        return SEGC.OK_ALL;
    }

    undo(callback?: unknown): SegResult {
        // C++ source와는 조금 다르게 구현.
        var SegHistoryInfo = this.m_History.getPrevStep();
        if (SegHistoryInfo) {
            this.erase_with(SegHistoryInfo.m_pSegRngAfter);
            this.insert_with(SegHistoryInfo.m_pSegRngBefore);
            //_show_vec();

            this.m_LastAction = SegHistoryInfo;
            return SEGC.OK_ALL;
        }

        return SEGC.ERR_BEGIN_OF_HISTORY;
    }
    redo(callback?: unknown): SegResult {
        var SegHistoryInfo = this.m_History.getNextStep();
        if (SegHistoryInfo) {
            this.erase_with(SegHistoryInfo.m_pSegRngBefore);
            this.insert_with(SegHistoryInfo.m_pSegRngAfter);
            //_show_vec();

            this.m_LastAction = SegHistoryInfo;
            return SEGC.OK_ALL;
        }

        return SEGC.ERR_END_OF_HISTORY;
    }

    getAttr_by_pi(par_index: number): A {
        return this.m_SegVec[par_index] as A;
    }
    getAttr(nPos: number, seg_info?: SegInfo | null, callback?: (attr: A) => void): A | null {
        if (this.m_SegVec.length == 0)
            return null;

        var nUpperBound = 0;
        for (var i = 0; i < this.m_SegVec.length; i++) {
            nUpperBound += this.m_SegVec[i].m_nCount;
            if (nPos < nUpperBound) {
                callback && callback(this.m_SegVec[i] as A);
                return this.m_SegVec[i] as A;
            }
        }

        return null;
    }
    getAttr_by_gravity(nPos: number, seg_info?: SegInfo | null, callback?: (attr: A) => void): A | null {
        var sampling_pos = nPos;

        if (this._nGravity === SEGC.GRAVITY_LEFT)
            sampling_pos = (nPos === 0) ? 0 : nPos - 1;
        else if (this._nGravity === SEGC.GRAVITY_RIGHT)
            sampling_pos = nPos;

        return this.getAttr(sampling_pos, seg_info, callback);
    }


    getElementTotal(): number {
        var nSize = 0;
        for (var i = 0; i < this.m_SegVec.length; i++)
            nSize += this.m_SegVec[i].m_nCount;

        return nSize;
    }

    get_segment_range_in_current_pos(nPos: number, pos: SegSpan): SegResult {
        if (this.m_SegVec.length == 0)
            return SEGC.ERR_SEGVEC_EMPTY;

        var nUpperBound = 0;
        for (var i = 0; i < this.m_SegVec.length; i++) {
            pos.from = nUpperBound;
            pos.to = pos.from + this.m_SegVec[i].m_nCount;

            nUpperBound += this.m_SegVec[i].m_nCount;
            if (nPos < nUpperBound)
                return SEGC.OK_ALL;
        }

        if (nPos == nUpperBound) {
            //MT_ASSERT(FALSE);
            return SEGC.ERR_OUT_OF_RANGE;
        }

        return SEGC.ERR_OUT_OF_RANGE;
    }


    //////////////////////////////////////////////////////////////////////////////////////
    // private:
    //////////////////////////////////////////////////////////////////////////////////////

    private getPosition(nPos: number, segPos: SegPos, last_element_pos_as_new_seg?: boolean): SegResult {
        var _last_element_pos_as_new_seg = (last_element_pos_as_new_seg === undefined) ? true : last_element_pos_as_new_seg;
        if (this.m_SegVec.length === 0) {
            segPos.pIndex = 0;
            segPos.pOffset = 0;
            return SEGC.ERR_SEGVEC_EMPTY;
        }

        var nUpperBound = 0;
        for (var i = 0; i < this.m_SegVec.length; i++) {
            nUpperBound += this.m_SegVec[i].m_nCount;
            if (nPos < nUpperBound) {
                segPos.pIndex = i;
                segPos.pOffset = nPos - (nUpperBound - this.m_SegVec[i].m_nCount);
                return SEGC.OK_ALL;
            }
        }

        if (nPos === nUpperBound) {
            // GT_SegLayerh의 getPosition()와는 다른 구현임.
            // nPos가 끝단일 경우 nPos가 있는 마지막 segment의 마지막 offset을 리턴하도록 함.
            // par의 경우 segment 끝에 있는 '\n'에 따라서만 segment의 끝으로 인식하기 때문임.
            // "Last $"처리를 위해 가장 끝의 위치는 offset이 0이 안되도록 함.

            if (_last_element_pos_as_new_seg) {
                segPos.pIndex = i;
                segPos.pOffset = 0;
            } else {
                segPos.pIndex = i - 1;
                segPos.pOffset = this.m_SegVec[i - 1].m_nCount;
            }
            return SEGC.OK_END_POSITION;
        }

        return SEGC.ERR_OUT_OF_RANGE;
    }

    private getInsertPosition(nPos: number, segPos: SegPos): SegResult {
        // segPos = {pIndex, pOffset}
        if (this.m_SegVec.length == 0)
            return SEGC.ERR_SEGVEC_EMPTY;
        if (nPos < 0)
            return SEGC.ERR_OUT_OF_RANGE;

        var nLength = 0;
        var nUpperBound = 0;
        var nSegOffset: number;
        var nLastGXFlag: GxFlag = SEGC.GXFLAG_NULL;

        for (var i = 0; i < this.m_SegVec.length; i++) {
            nUpperBound += this.m_SegVec[i].m_nCount;
            nSegOffset = nPos - nLength;
            if (this._nGravity == SEGC.GRAVITY_LEFT) {
                // AAABBB --> (AAA#)BBB : offset이 segment의 길이(이 경우 3)와 같은경우, segment 마지막에 append되는 경우 임.|ABCD|
                if (nPos <= nUpperBound) {
                    segPos.pIndex = i;
                    segPos.pOffset = nSegOffset;
                    return SEGC.OK_ALL;
                }
            } else if (this._nGravity == SEGC.GRAVITY_RIGHT) {
                // AAABBB --> AAA(#BBB) : offset이 0인 경우 segment 첫번째 element로 들어가는 경우임.
                if (nPos < nUpperBound) {
                    segPos.pIndex = i;
                    segPos.pOffset = nSegOffset;
                    return SEGC.OK_ALL;
                }
            } else if (this._nGravity == SEGC.GRAVITY_EXCLUSIVE) {
                var nGxFlag = this.m_SegVec[i].getGravityExFlag();
                if (nGxFlag == SEGC.GXFLAG_BOTH) {
                    // current segment가 SEGC.GXFLAG_BOTH이면 이전 segment의 exclusive flag는 고려할 필요 없음.
                    if (nPos <= nUpperBound) {
                        segPos.pIndex = i;
                        segPos.pOffset = nSegOffset;
                        return SEGC.OK_ALL;
                    }
                }
                if (nGxFlag == SEGC.GXFLAG_NONE) {
                    if (nLastGXFlag == SEGC.GXFLAG_NONE) {
                        if (nSegOffset == 0) {
                            segPos.pIndex = i;
                            segPos.pOffset = nSegOffset;
                            // 현재 segment index 앞에 새로운 segment 삽입이 필요함.
                            return SEGC.OK_NEED_INSERT_SEGMENT_BEFORE;
                        } else if (nPos < nUpperBound) {
                            segPos.pIndex = i;
                            segPos.pOffset = nSegOffset;
                            return SEGC.OK_ALL;
                        }
                    } else if (nLastGXFlag == SEGC.GXFLAG_BOTH) {
                        if (nSegOffset == 0)
                            this.assert(false);
                        else if (nPos < nUpperBound) {
                            segPos.pIndex = i;
                            segPos.pOffset = nSegOffset;
                            return SEGC.OK_ALL;
                        }
                    } else {
                        if (nPos <= nUpperBound) {
                            segPos.pIndex = i;
                            segPos.pOffset = nSegOffset;
                            return SEGC.OK_ALL;
                        }
                    }
                }

                nLastGXFlag = nGxFlag;
            }

            nLength += this.m_SegVec[i].m_nCount;
        }

        // 여기까지 오면 nPos는 가장 마지막에 위치하고 있는 것임.

        if (this._nGravity == SEGC.GRAVITY_LEFT || this._nGravity == SEGC.GRAVITY_RIGHT) {
            segPos.pIndex = i - 1;
            segPos.pOffset = nPos - (nLength - this.m_SegVec[i - 1].m_nCount);
            return SEGC.OK_ALL;
        } else if (this._nGravity == SEGC.GRAVITY_EXCLUSIVE) {
            if (nLastGXFlag == SEGC.GXFLAG_BOTH)
                this.assert(false);
            else {
                segPos.pIndex = i - 1;
                segPos.pOffset = nPos - (nLength - this.m_SegVec[i - 1].m_nCount);
                // 현재 segment index 앞에 새로운 segment 삽입이 필요함.
                return SEGC.OK_ALL;
            }
        }

        return SEGC.ERR_OUT_OF_RANGE;
    }

    private get_changes_on_erasing(nPosBegin: number, nPosEnd: number, chg: ChangeRange): void {
        // chg = {nUndo_Begin, nUndo_End, nRedo_Begin, nRedo_End}

        var segPos_b: SegPos = { pIndex: 0, pOffset: 0 };
        var segPos_e: SegPos = { pIndex: 0, pOffset: 0 };

        this.getPosition(nPosBegin, segPos_b);
        this.getPosition(nPosEnd, segPos_e);

        var n = segPos_b.pIndex;
        var b_offset = segPos_b.pOffset;
        var m = segPos_e.pIndex;
        var e_offset = segPos_e.pOffset;


        // erase하면 변화되는 segment의 범위를 추적함.
        if (b_offset > 0 && e_offset > 0) {
            chg.nUndo_Begin = n;
            chg.nUndo_End = m + 1;
            chg.nRedo_Begin = n;
            chg.nRedo_End = n + 1;
        } else if (b_offset > 0 && e_offset == 0) {
            if (this.m_SegVec.length == m) {
                chg.nUndo_Begin = n;
                chg.nUndo_End = m;
                chg.nRedo_Begin = n;
                chg.nRedo_End = n + 1;
                //T10 이 경우는 가장 마지막의 $가 없어지는 문제가 발생하므로 추가적인 대응이 필요함.
                //assert(false);
            } else {
                chg.nUndo_Begin = n;
                chg.nUndo_End = m + 1;
                chg.nRedo_Begin = n;
                chg.nRedo_End = n + 1;
            }
        } else if (b_offset == 0 && e_offset > 0) {
            chg.nUndo_Begin = n;
            chg.nUndo_End = m + 1;
            chg.nRedo_Begin = n;
            chg.nRedo_End = n + 1;
        } else if (b_offset == 0 && e_offset == 0) {
            chg.nUndo_Begin = n;
            chg.nUndo_End = m;
            chg.nRedo_Begin = n;
            chg.nRedo_End = n;
            //T10 모든 segment가 다 삭제되는 경우 마지막의 $도 존재하지 않는 문제 발생하므로 추가대응 필요.
            //if (n == 0 && m == m_SegVec.size()) {
            //	assert(false);
            //}
        }
    }

    private get_changes_on_pasting(pSegRngCopy: GT_SegRange, nPosBegin: number, nPosEnd: number, chg: ChangeRange): SegResult {
        // chg = {nUndo_Begin, nUndo_End, nRedo_Begin, nRedo_End}

        var err_code: SegResult = SEGC.OK_ALL;

        //B10 /////////////////////////////////////////////////////////////////////
        if (nPosBegin == this.getElementTotal()) {
            this.assert(false);
        }
        //B10 /////////////////////////////////////////////////////////////////////
        else {
            var segPos_b: SegPos = { pIndex: 0, pOffset: 0 };
            var err_code: SegResult = this.getPosition(nPosBegin, segPos_b);
            var nSegIndex = segPos_b.pIndex;
            var nOffset = segPos_b.pOffset;

            //err_code = getPosition(nPosBegin, &nSegIndex, &nOffset);

            // calc undo range
            chg.nUndo_Begin = nSegIndex;
            chg.nUndo_End = nSegIndex + 1;

            // calc redo range
            var count_of_copied_seg = pSegRngCopy.m_SegVec.length;
            if (count_of_copied_seg == 1 && pSegRngCopy.m_first_whole_seg == false) {
                chg.nRedo_Begin = nSegIndex;
                chg.nRedo_End = nSegIndex + 1;
            } else if (pSegRngCopy.m_last_whole_seg == false) {
                this.assert(count_of_copied_seg > 1);
                chg.nRedo_Begin = nSegIndex;
                chg.nRedo_End = nSegIndex + count_of_copied_seg;
            } else {
                chg.nRedo_Begin = nSegIndex;
                chg.nRedo_End = nSegIndex + count_of_copied_seg + 1;
            }
        }

        return err_code;
    }

    private paste_operation(pSegRngCopy: GT_SegRange, nPosBegin: number, nSegIndex: number, nOffset: number): void {
        var err_code: SegResult;
        var nInsertPos!: number;

        var count_of_copied_seg = pSegRngCopy.m_SegVec.length;

        //B10 /////////////////////////////////////////////////////////////////////
        if (nPosBegin == this.getElementTotal()) {
            this.assert(false);
        }
        //B10 /////////////////////////////////////////////////////////////////////
        else {
            if (nOffset > 0 && pSegRngCopy.m_first_whole_seg == true)
                nInsertPos = this.split(nSegIndex, nOffset);

            for (var i = count_of_copied_seg - 1; i >= 0; i--) {
                if (nOffset > 0) {
                    if (i == 0) {
                        if (pSegRngCopy.m_first_whole_seg == false) {
                            this.m_SegVec[nSegIndex].m_nCount += pSegRngCopy.m_SegVec[0].m_nCount;
                        } else if (pSegRngCopy.m_first_whole_seg == true) {
                            this.insert_to(nInsertPos, pSegRngCopy.m_SegVec[i].clone());
                            this.merge_with_next_seg(nInsertPos - 1, true);
                        }
                    } else if (i == count_of_copied_seg - 1) {
                        this.insert_to(nInsertPos, pSegRngCopy.m_SegVec[i].clone());
                        if (pSegRngCopy.m_last_whole_seg == false)
                            this.merge_with_next_seg(nInsertPos, true);
                    } else
                        this.insert_to(nInsertPos, pSegRngCopy.m_SegVec[i].clone());
                } else {
                    if (i == 0 && pSegRngCopy.m_first_whole_seg == false)
                        this.m_SegVec[nSegIndex].m_nCount += pSegRngCopy.m_SegVec[0].m_nCount;
                    else if (i == count_of_copied_seg - 1) {
                        this.insert_to(nSegIndex, pSegRngCopy.m_SegVec[i].clone());
                        if (pSegRngCopy.m_last_whole_seg == false)
                            this.merge_with_next_seg(nSegIndex, true);
                    } else
                        this.insert_to(nSegIndex, pSegRngCopy.m_SegVec[i].clone());
                }
            }
        }
    }

    // split_and_insert_seg() 와 split_and_insert_attr()
    // split_and_insert_attr()는 파라미터 pAttr의 값을 이용하여
    // segment를 만들어 split_and_insert_seg()를 호출.
    private split_and_insert_seg(nIndex: number, nOffset: number, seg: ISegAttr): SegResult {
        if (nIndex >= this.m_SegVec.length) {
            this.insert_to(nIndex, seg);
            return SEGC.OK_ALL;
        }

        var nCurSegCount = this.m_SegVec[nIndex].m_nCount;
        if (nOffset == 0)
            this.insert_to(nIndex, seg);
        else if (nOffset == nCurSegCount)
            this.insert_to(nIndex + 1, seg);
        else {
            var nLeft = nOffset;
            var nRight = nCurSegCount - nOffset;
            this.m_SegVec[nIndex].m_nCount = nLeft;

            if (nRight == 0)
                this.insert_to(nIndex + 1, seg);
            else {
                // GT_Segment seg_right(m_SegVec[nIndex].m_pAttribute);
                var seg_right = this.m_SegVec[nIndex].factory(); //D

                seg_right.m_nCount = nRight;

                this.insert_to(nIndex + 1, seg);
                this.insert_to(nIndex + 2, seg_right);
            }
        }

        return SEGC.OK_ALL;
    }

    private split_and_insert_attr(nIndex: number, nOffset: number, pAttr: ISegAttr, str_length: number): SegResult {
        //GT_Segment seg(pAttr);
        var seg = pAttr.factory(str_length); //D

        this.split_and_insert_seg(nIndex, nOffset, seg);
        return SEGC.OK_ALL;
    }

    private split(nIndex: number, nOffset: number): number {
        var pNewIndex = -1;

        var nCurSegCount = this.m_SegVec[nIndex].m_nCount;
        if (0 < nOffset && nOffset < nCurSegCount) {
            this.m_SegVec[nIndex].m_nCount = nOffset;
            //GT_Segment seg(m_SegVec[nIndex].m_pAttribute);
            var seg = this.m_SegVec[nIndex].factory(); //D


            seg.m_nCount = nCurSegCount - nOffset;
            this.insert_to(nIndex + 1, seg);
            pNewIndex = nIndex + 1;
        } else if (nOffset == nCurSegCount) {
            // 가장 마지막 segment의 마지막 offset임.
            pNewIndex = nIndex + 1;
        } else {
            pNewIndex = nIndex;
        }

        return pNewIndex;
    }

    private get_insert_pos_after_split(nIndex: number, nOffset: number): number {
        // (nIndex, nOffset) 위치에서 split된 후의 segment index의 위치 얻기

        var nInsertPosIndex: number;

        var nCurSegCount = this.m_SegVec[nIndex].m_nCount;
        if (0 < nOffset && nOffset < nCurSegCount)
            nInsertPosIndex = nIndex + 1;
        else if (nOffset == nCurSegCount)
            nInsertPosIndex = nIndex + 1; // 가장 마지막 segment의 마지막 offset임.
        else
            nInsertPosIndex = nIndex;

        return nInsertPosIndex;
    }

    private insert_to(i: number, seg: ISegAttr): void {
        // i가 iterator::end()위치이면, push_back()을, 아니면 insert()을 함.
        if (i < this.m_SegVec.length) // 마지막이 아니면
            this.m_SegVec.splice(i, 0, seg);
        else
            this.m_SegVec.push(seg);
    }

    private merge_with_next_seg(nSegIndex: number, force_merge?: boolean): SegResult {
        if (nSegIndex == this.m_SegVec.length - 1)
            return SEGC.ERR_OUT_OF_RANGE;
        if (nSegIndex < 0)
            return SEGC.ERR_OUT_OF_RANGE;

        if (force_merge) {
            this.m_SegVec[nSegIndex].m_nCount += this.m_SegVec[nSegIndex + 1].m_nCount;
            this.erase_and_free_segment(nSegIndex + 1);
            return SEGC.OK_SEGMENT_MERGED;
        }

        if (this.m_SegVec[nSegIndex].equal(this.m_SegVec[nSegIndex + 1])) {
            this.m_SegVec[nSegIndex].m_nCount += this.m_SegVec[nSegIndex + 1].m_nCount;
            this.erase_and_free_segment(nSegIndex + 1);
            return SEGC.OK_SEGMENT_MERGED;
        } else

            return SEGC.OK_SEGMENT_NOT_MERGED;
    }

    private erase_and_free_segment(nSegIndex: number): void {
        this.m_SegVec.splice(nSegIndex, 1);
    }
    private erase_and_free_segments(nSegIndexBegin: number, nSegIndexEnd: number): void {
        this.m_SegVec.splice(nSegIndexBegin, nSegIndexEnd - nSegIndexBegin)
    }
    private erase_range(nPosBegin: number, nPosEnd: number): SegResult {
        if (nPosBegin == nPosEnd)
            return SEGC.OK_ALL;

        var segPos_b: SegPos = { pIndex: 0, pOffset: 0 };
        var segPos_e: SegPos = { pIndex: 0, pOffset: 0 };

        this.getPosition(nPosBegin, segPos_b);
        this.getPosition(nPosEnd, segPos_e);

        var nSegIndexBegin = segPos_b.pIndex;
        var nOffsetBegin = segPos_b.pOffset;
        var nSegIndexEnd = segPos_e.pIndex;
        var nOffsetEnd = segPos_e.pOffset;

        for (var i = nSegIndexEnd; i >= nSegIndexBegin; i--) {
            if (i == nSegIndexEnd) {
                var nStart = (nSegIndexEnd == nSegIndexBegin) ? nOffsetBegin : 0;
                this.erase_in_segment(i, nStart, nOffsetEnd);
            } else if (i == nSegIndexBegin) {
                var nEnd = (nSegIndexBegin == nSegIndexEnd) ? nOffsetEnd : this.m_SegVec[i].m_nCount;
                this.erase_in_segment(i, nOffsetBegin, nEnd);
            } else {
                this.erase_and_free_segment(i);
            }
        }

        return SEGC.OK_ALL;
    }

    private erase_in_segment(nSegIndex: number, nBegin: number, nEnd: number): SegResult {
        var err: SegResult;
        var seg_size = this.m_SegVec.length;
        if (nSegIndex >= seg_size)
            return SEGC.ERR_OUT_OF_RANGE;
        if (nBegin < 0 || nEnd > this.m_SegVec[nSegIndex].m_nCount)
            return SEGC.ERR_OUT_OF_RANGE;

        var nSize = nEnd - nBegin;
        if (nSize == this.m_SegVec[nSegIndex].m_nCount) {
            this.erase_and_free_segment(nSegIndex);
            err = SEGC.OK_SEGMENT_ERASED;
        } else {
            this.m_SegVec[nSegIndex].m_nCount -= nSize;
            err = SEGC.OK_ALL;
        }

        return err;
    }

    //////////////

    private save_undo_info(nFirstSegIndex: number, nLastSegIndex: number): SegResult {
        nFirstSegIndex = this.getInRange(nFirstSegIndex, 0, this.m_SegVec.length + 1);
        nLastSegIndex = this.getInRange(nLastSegIndex, 0, this.m_SegVec.length + 1);

        this.m_SegRngBefore.clear();
        this.m_SegRngBefore.m_nFirstSegIndex = nFirstSegIndex;
        this.m_SegRngBefore.m_nLastSegIndex = nLastSegIndex;
        if (nFirstSegIndex < nLastSegIndex) {
            for (var i = nFirstSegIndex; i < nLastSegIndex; i++)
                this.m_SegRngBefore.m_SegVec.push(this.m_SegVec[i].clone());
        }
        return SEGC.OK_ALL;
    }
    private save_redo_info(nFirstSegIndex: number, nLastSegIndex: number): SegResult {
        nFirstSegIndex = this.getInRange(nFirstSegIndex, 0, this.m_SegVec.length + 1);
        nLastSegIndex = this.getInRange(nLastSegIndex, 0, this.m_SegVec.length + 1);

        this.m_SegRngAfter.clear();
        this.m_SegRngAfter.m_nFirstSegIndex = nFirstSegIndex;
        this.m_SegRngAfter.m_nLastSegIndex = nLastSegIndex;
        if (nFirstSegIndex < nLastSegIndex) {
            for (var i = nFirstSegIndex; i < nLastSegIndex; i++)
                this.m_SegRngAfter.m_SegVec.push(this.m_SegVec[i].clone());
        }

        // console.log('>before[',m_SegRngBefore.m_nFirstSegIndex, ',', m_SegRngBefore.m_nLastSegIndex, ']');
        // console.log('>after[',m_SegRngAfter.m_nFirstSegIndex, ',', m_SegRngAfter.m_nLastSegIndex, ']');

        var shi: SegHistoryInfo = {
            m_pSegRngBefore: this.m_SegRngBefore.clone(),
            m_pSegRngAfter: this.m_SegRngAfter.clone()
        };
        this.m_History.push_shi(shi);

        return SEGC.OK_ALL;
    }

    private erase_with(pSegRng: GT_SegRange): void {
        this.erase_and_free_segments(pSegRng.m_nFirstSegIndex, pSegRng.m_nLastSegIndex);
    }

    private insert_with(pSegRng: GT_SegRange): void {
        var iSrc = 0;
        for (var i = pSegRng.m_nFirstSegIndex; i < pSegRng.m_nLastSegIndex; i++) {
            this.insert_to(i, pSegRng.m_SegVec[iSrc].clone());
            ++iSrc;
        }
    }
    private getInRange(val: number, Begin: number, End: number): number {
        return (val >= End) ? End - 1 : (val < Begin) ? Begin : val;
    }

} // end of GT_segmentLayer_Par

export default GT_segmentLayer_Par;
