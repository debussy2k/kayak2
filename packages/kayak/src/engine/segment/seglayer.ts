import GT_SegRange from "./GT_SegRange";
import GT_SegHistory from "./GT_SegHistory";
import SEGC from './segment_const';
import type { Gravity, GxFlag, SegResult } from './segment_const';
import type GT_PasteInfo from './GT_PasteInfo';
import type { IAttrPrototype, ISegAttr, SegPos, ChangeRange, SegInfo, SegSpan, SegHistoryInfo } from './types';

/** A: 이 레이어가 담는 ATTR 클래스. 입력(insert/set)은 ISegAttr로 받고 조회만 A로 돌려준다 — 내부 m_SegVec는 ISegAttr[] 그대로 */
class GT_segmentLayer<A extends ISegAttr = ISegAttr> {
    _attr_class_name: string;
    _attr_prototype: IAttrPrototype;
    private _nGravity: Gravity;
    private m_SegRngCopy = new GT_SegRange;

    private m_SegVec: ISegAttr[] = [];

    // for undo/redo
    private m_History = new GT_SegHistory;
    private m_SegRngBefore = new GT_SegRange;
    private m_SegRngAfter = new GT_SegRange;

    constructor(nGravity: Gravity, attr_class_name: string, attr_prototype: IAttrPrototype) {
        this._nGravity = nGravity;
        this._attr_class_name = attr_class_name;
        this._attr_prototype = attr_prototype;
    }

    // for debugging (seglayer_par.js와 동일)
    assert(expr: any, obj?: any): void {
        console.assert(expr, obj);
    }

    set_history_limit(limit: number): void {
        this.m_History.set_history_limit(limit);
    }

    dup_segment_vec(that: GT_segmentLayer): void {
        // 1. 현재의 mm_SegVec을 비움
        this.m_SegVec.length = 0;

        var vec = that._get_vec();
        for (var i = 0; i < vec.length; i++)
            this.m_SegVec.push(vec[i].clone());
    }

    _get_vec(): A[] {
        return this.m_SegVec as A[];
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
        if (arr == undefined) {
            console.assert(false, "input arr should not be null.");
        }

        this.m_SegVec.length = 0;
        arr.forEach((data) => {
            var obj = factory();
            obj.set(data);
            this.m_SegVec.push(obj);
        })
    }


    canAccept(attrObj: ISegAttr | null): A | null {
        if (attrObj === null)
            return null;
        return (this._attr_class_name === attrObj._attr_class_name) ? attrObj as A : null;
    }

    log(): void {
        //console.log('m_SegVec: ', m_SegVec);
        var str = '';
        for (var i = 0; i < this.m_SegVec.length; i++)
            str += '[fsize:' + (this.m_SegVec[i] as any).FontSize + ', cnt:' + this.m_SegVec[i].m_nCount + ']  ';
        console.log(str);

        //m_History.log();
    }

    reset_history(): void {
        this.m_History.reset();
    }

    insert_newline(nPos: number, pAttr: ISegAttr | null): SegResult {
        return this.insert(nPos, pAttr);
    }

    insert(nPos: number, pAttr: ISegAttr | null): SegResult {
        var segPos: SegPos = { pIndex: 0, pOffset: 0 };
        var err_code = this.getInsertPosition(nPos, segPos);
        var nIndex = segPos.pIndex;
        var nOffset = segPos.pOffset;

        if (err_code === SEGC.OK_ALL) {
            this._insert(nIndex, nOffset, 1, pAttr);
        }
        else if (err_code === SEGC.ERR_SEGVEC_EMPTY) {
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
        return SEGC.OK_ALL;
    }

    insert_string(nPos: number, str_arr: ArrayLike<number>, pAttr: ISegAttr | null): SegResult {
        var segPos: SegPos = { pIndex: 0, pOffset: 0 };
        var err_code = this.getInsertPosition(nPos, segPos);
        var nIndex = segPos.pIndex;
        var nOffset = segPos.pOffset;

        if (err_code === SEGC.OK_ALL) {
            this._insert(nIndex, nOffset, str_arr.length, pAttr);
        }
        else {
            this.assert(false);
        }

        return SEGC.OK_ALL;
    }

    private _insert(nIndex: number, nOffset: number, str_length: number, pAttr: ISegAttr | null): void {
        if (pAttr == null) {
            this.save_undo_info(nIndex, nIndex + 1);
            this.m_SegVec[nIndex].m_nCount += str_length;
            this.save_redo_info(nIndex, nIndex + 1);
        }
        else {
            if (this.m_SegVec[nIndex].equal(pAttr)) {
                /*  insert위치가 nIndex의 seg내에 있고 속성이 같은 경우.
                    AAp|BB
                    pAttr의 속성이 AA와 같은 경우
                */
                this.save_undo_info(nIndex, nIndex + 1);
                this.m_SegVec[nIndex].m_nCount += str_length;
                this.save_redo_info(nIndex, nIndex + 1);
            }
            else if (nOffset == this.m_SegVec[nIndex].m_nCount && nIndex + 1 < this.m_SegVec.length && this.m_SegVec[nIndex+1].equal(pAttr)) {
                /*  insert위치가 nIndex seg의 끝(== nIndex+1 seg의 첫머리)에 있고 nIndex+1 seg의 속성과 같은 경우.
                    AA|BB    --> AA|pBB
                    pAttr의 속성이 BB와 같은 경우
                */
                this.save_undo_info(nIndex+1, nIndex + 2);
                this.m_SegVec[nIndex+1].m_nCount += str_length;
                this.save_redo_info(nIndex+1, nIndex + 2);
            }
            else if (nOffset == this.m_SegVec[nIndex].m_nCount && (nIndex + 1 >= this.m_SegVec.length || !this.m_SegVec[nIndex+1].equal(pAttr))) {
                /*  insert위치가 nIndex seg의 끝(== nIndex+1 seg의 첫머리)에 있고 nIndex+1 seg의 속성과 다른 경우.
                    AA|BB    --> AA|p|BB
                    pAttr의 속성이 AA와 같은 경우
                    nIndex가 마지막 seg이면(문서 끝) 뒤에 새 seg를 추가한다.
                    AA|      --> AA|p
                */
                this.save_undo_info(nIndex+1, nIndex + 1);
                let seg = pAttr.factory(str_length)
                this.insert_to(nIndex+1, seg);
                this.save_redo_info(nIndex+1, nIndex + 2);
            }
            else if (nOffset == 0 && !this.m_SegVec[nIndex].equal(pAttr)) {
                /*  Insert위치가 nIndex seg의 맨 앞쪽에 있고, nIndex seg의 속성과 다른 경우
                    문서의 가장 첫머리에서 발생한는 경우임
                    AA  --> p|AA
                */
               this.save_undo_info(nIndex, nIndex);
               let seg = pAttr.factory(str_length)
               this.insert_to(nIndex, seg);
               this.save_redo_info(nIndex, nIndex + 1);
            }
            else {
                /*  split 되어야 하는 경우
                    AA|AA --> AA|p|AA
                */
                this.save_undo_info(nIndex, nIndex + 1);
                this.split_and_insert_attr(nIndex, nOffset, pAttr, str_length);
                this.save_redo_info(nIndex, nIndex + 3);
            }
        }
    }

    erase(begin: number, end?: number): SegResult {
        var nPosBegin = begin;
        var nPosEnd = (end == undefined) ? (begin + 1) : end;
        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////
        var segPos_b: SegPos = { pIndex: 0, pOffset: 0 };
        this.getPosition(nPosBegin, segPos_b);
        var n = segPos_b.pIndex;
        var b_offset = segPos_b.pOffset;

        var chg: ChangeRange = { nUndo_Begin: 0, nUndo_End: 0, nRedo_Begin: 0, nRedo_End: 0 };
        this.get_changes_on_erasing(nPosBegin, nPosEnd, chg);

        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////

        this.save_undo_info(chg.nUndo_Begin, chg.nUndo_End);

        this.erase_range(nPosBegin, nPosEnd);
        this.merge_with_next_seg(n + (b_offset == 0 ? -1 : 0));

        this.save_redo_info(chg.nRedo_Begin, chg.nRedo_End);

        //_show_vec();
        return SEGC.OK_ALL;
    }

    set(nPosBegin: number, nPosEnd: number, pAttr: ISegAttr): SegResult {
        // 1. erase (begin ,end) without merge
        // 2. insert segment
        // 3. test and merge.

        var err_code: SegResult;

        // 빈 범위이면 layer는 바꾸지 않는다. (count 0인 segment가 생기는 것을 방지)
        // 단, manager history와 정렬을 유지하기 위해 빈 history 항목은 남긴다.
        if (nPosBegin >= nPosEnd) {
            this.save_undo_info(0, 0);
            this.save_redo_info(0, 0);
            return SEGC.OK_ALL;
        }

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


        // erase하면 변화되는 segment의 범위를 추적함.
        var nUndo_Begin!: number, nUndo_End!: number;
        var nRedo_Begin!: number, nRedo_End!: number;

        var nMergeOffset = 0;
        if (err_code != SEGC.OK_END_POSITION)
            nMergeOffset += this.m_SegVec[m].equal(pAttr) ? 0 : 1;
        else
            nMergeOffset = 1;

        if (b_offset > 0 && e_offset > 0) {
            if (this.m_SegVec[n].equal(pAttr)) {
                nUndo_Begin = n;
                nUndo_End = m + 1;
                nRedo_Begin = n;
                nRedo_End = nRedo_Begin + 1 + nMergeOffset;
            } else {
                nUndo_Begin = n;
                nUndo_End = m + 1;
                nRedo_Begin = n;
                nRedo_End = nRedo_Begin + 2 + nMergeOffset;
            }

        } else if (b_offset > 0 && e_offset == 0) {
            if (this.m_SegVec[n].equal(pAttr)) {
                nUndo_Begin = n;
                nUndo_End = m + (1 - nMergeOffset);
                nRedo_Begin = n;
                nRedo_End = nRedo_Begin + 1;
            } else {
                nUndo_Begin = n;
                nUndo_End = m + (1 - nMergeOffset);
                nRedo_Begin = n;
                // 병합 여부와 무관하게 변경 후 segment는 [n의 왼쪽 부분, 새 segment] 2개임.
                // (병합되면 새 segment가 m과 합쳐질 뿐 개수는 같다)
                nRedo_End = nRedo_Begin + 2;
            }
        } else if (b_offset == 0 && e_offset > 0) {
            if (n > 0 && this.m_SegVec[n - 1].equal(pAttr)) {
                nUndo_Begin = n - 1;
                nUndo_End = m + 1;
                nRedo_Begin = n - 1;
                nRedo_End = nRedo_Begin + 1 + nMergeOffset;
            } else {
                nUndo_Begin = n;
                nUndo_End = m + 1;
                nRedo_Begin = n;
                nRedo_End = nRedo_Begin + 1 + nMergeOffset;
            }
        } else if (b_offset == 0 && e_offset == 0) {
            if (n > 0 && this.m_SegVec[n - 1].equal(pAttr)) {
                nUndo_Begin = n - 1;
                nUndo_End = m + (1 - nMergeOffset);
                nRedo_Begin = n - 1;
                nRedo_End = nRedo_Begin + 1;
            } else {
                nUndo_Begin = n;
                nUndo_End = m + (1 - nMergeOffset);
                nRedo_Begin = n;
                nRedo_End = nRedo_Begin + 1;
            }
        }
        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////

        this.save_undo_info(nUndo_Begin, nUndo_End);

        this.erase_range(nPosBegin, nPosEnd);

        // 2. insert
        var segPos: SegPos = { pIndex: 0, pOffset: 0 };
        err_code = this.getPosition(nPosBegin, segPos);

        if (err_code == SEGC.ERR_SEGVEC_EMPTY)
            segPos.pIndex = 0;

        //GT_Segment seg(pAttr, nPosEnd - nPosBegin);
        var seg = pAttr.factory(nPosEnd - nPosBegin); //D
        this.split_and_insert_seg(segPos.pIndex, segPos.pOffset, seg);

		this.merge_with_next_seg(segPos.pIndex+1);
		/*
			이것이 필요한 case
			|RRRR$|
			   ^^
			^^부분을 같은 attribute으로  설정한 경우 아래로 m_SegVec이 나뉘게 되고
				RR RR R$
				0  1  2
			이것은 다시 RRRRR$로 만들어 져야 한다.
			위에서 1번과 2번이 merge되기 위해서 (segPos.pIndex+1)에서 merge되어야 함.
		*/

        this.merge_with_next_seg(segPos.pIndex);
        this.merge_with_next_seg(segPos.pIndex - 1);

        this.save_redo_info(nRedo_Begin, nRedo_End);

        //_show_vec();
        return SEGC.OK_ALL;
    }

    query_if_last_newline_being_erased(nPosBegin: number, nPosEnd: number): boolean {
        return false
    }

    paste(nPos: number, PasteInfo: GT_PasteInfo): SegResult {
        var err_code: SegResult;

        if (PasteInfo.non_clipboard_copy_string.length > 0) {
            var segPos: SegPos = { pIndex: 0, pOffset: 0 };
            err_code = this.getInsertPosition(nPos, segPos);
            var nIndex = segPos.pIndex;
            var nOffset = segPos.pOffset;

            this.save_undo_info(nIndex, nIndex + 1);
            this.m_SegVec[nIndex].m_nCount += PasteInfo.non_clipboard_copy_string.length;
            this.save_redo_info(nIndex, nIndex + 1);
        } else {
            if (this.m_SegRngCopy.m_SegVec.length == 0)
                return SEGC.ERR_RANGE_EMPTY;

            var segPos: SegPos = { pIndex: 0, pOffset: 0 };
            err_code = this.getPosition(nPos, segPos);
            var nIndex = segPos.pIndex;
            var nOffset = segPos.pOffset;

            /////////////////////////////////////////////////////////////////////
            /////////////////////////////////////////////////////////////////////
            var chg: ChangeRange = { nUndo_Begin: 0, nUndo_End: 0, nRedo_Begin: 0, nRedo_End: 0 };
            this.get_changes_on_pasting(nPos, nPos, chg);
            /////////////////////////////////////////////////////////////////////
            /////////////////////////////////////////////////////////////////////

            this.save_undo_info(chg.nUndo_Begin, chg.nUndo_End);
            this.paste_operation(nIndex, nOffset, PasteInfo);
            this.save_redo_info(chg.nRedo_Begin, chg.nRedo_End);
        }

        //_show_vec();
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
                if (segPos_b.pIndex === segPos_e.pIndex)
                    seg.m_nCount = nPosEnd - nPosBegin;
                else
                    seg.m_nCount = this.m_SegVec[i].m_nCount - segPos_b.pOffset;

                this.m_SegRngCopy.m_SegVec.push(seg);
            } else if (i === segPos_e.pIndex) {
                if (segPos_e.pOffset > 0) {
                    //GT_Segment seg(m_SegVec[i].m_pAttribute);
                    var seg = this.m_SegVec[i].factory(); //D
                    seg.m_nCount = segPos_e.pOffset;
                    this.m_SegRngCopy.m_SegVec.push(seg);
                }
            } else {
                this.m_SegRngCopy.m_SegVec.push(this.m_SegVec[i].clone());
            }
        }

        return SEGC.OK_ALL;
    }

    undo(): SegResult {
        // C++ source와는 조금 다르게 구현.
        var SegHistoryInfo = this.m_History.getPrevStep();
        if (SegHistoryInfo) {
            this.erase_with(SegHistoryInfo.m_pSegRngAfter);
            this.insert_with(SegHistoryInfo.m_pSegRngBefore);
            //_show_vec();
            return SEGC.OK_ALL;
        }

        return SEGC.ERR_BEGIN_OF_HISTORY;
    }
    redo(): SegResult {
        var SegHistoryInfo = this.m_History.getNextStep();
        if (SegHistoryInfo) {
            this.erase_with(SegHistoryInfo.m_pSegRngBefore);
            this.insert_with(SegHistoryInfo.m_pSegRngAfter);
            //_show_vec();
            return SEGC.OK_ALL;
        }

        return SEGC.ERR_END_OF_HISTORY;
    }

    getAttr(nPos: number, seg_info?: SegInfo | null, callback?: (attr: A) => void): A | null {
        if (this.m_SegVec.length == 0)
            return null;

        var nUpperBound = 0;
        for (var i = 0; i < this.m_SegVec.length; i++) {
            nUpperBound += this.m_SegVec[i].m_nCount;
            if (nPos < nUpperBound) {
                if (seg_info) {
                    seg_info.index_in_seg = nPos - (nUpperBound - this.m_SegVec[i].m_nCount);
                    seg_info.size_of_seg = this.m_SegVec[i].m_nCount;
                }
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

    getAttr_by_index(index: number): A | null {
        if (this.m_SegVec.length == 0)
            return null;

        //MT_ASSERT(index < m_SegVec.size());
        return this.m_SegVec[index] as A;
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

    is_in_single_segment(pos_from: number, pos_to: number): boolean {
            // from,to 영역이 단일 segment내의 범위인지 판단.

            var segPos_b: SegPos = { pIndex: 0, pOffset: 0 };
            var segPos_e: SegPos = { pIndex: 0, pOffset: 0 };

            this.getPosition(pos_from, segPos_b);
            this.getPosition(pos_to, segPos_e);

            if ((segPos_b.pIndex == segPos_e.pIndex) ||
                ((segPos_b.pIndex == segPos_e.pIndex - 1) && segPos_e.pOffset == 0)) {
                return true;
            }

            return false;
        }
        //////////////////////////////////////////////////////////////////////////////////////
        // private:
        //////////////////////////////////////////////////////////////////////////////////////

    private getPosition(nPos: number, segPos: SegPos): SegResult {
        // int* pIndex, int* pOffset

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
            // GT_SegLayer_Par.h의 같은 영역 참고할 것.
            // nPos가 끝단일 경우 가상의 다음 segment index와 offset=0를 리턴함.

            //segPos.pIndex = (int)i-1;
            //segPos.pOffset = m_SegVec[i-1].m_nCount;
            segPos.pIndex = i;
            segPos.pOffset = 0;
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

    //void get_changes_on_erasing(int nPosBegin, int nPosEnd, nUndo_Begin, int& nUndo_End, int& nRedo_Begin, int& nRedo_End)
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

        if (b_offset > 0 && e_offset > 0) {
            if (this.m_SegVec[n].equal(this.m_SegVec[m])) {
                chg.nUndo_Begin = n;
                chg.nUndo_End = m + 1;
                chg.nRedo_Begin = n;
                chg.nRedo_End = n + 1;
            } else {
                chg.nUndo_Begin = n;
                chg.nUndo_End = m + 1;
                chg.nRedo_Begin = n;
                chg.nRedo_End = n + 2;
            }

        } else if (b_offset > 0 && e_offset == 0) {
            if (this.m_SegVec.length == m) {
                chg.nUndo_Begin = n;
                chg.nUndo_End = m;
                chg.nRedo_Begin = n;
                chg.nRedo_End = n + 1;
            } else if (this.m_SegVec[n].equal(this.m_SegVec[m])) {
                chg.nUndo_Begin = n;
                chg.nUndo_End = m + 1;
                chg.nRedo_Begin = n;
                chg.nRedo_End = n + 1;
            } else {
                chg.nUndo_Begin = n;
                chg.nUndo_End = m;
                chg.nRedo_Begin = n;
                chg.nRedo_End = n + 1;
            }
        } else if (b_offset == 0 && e_offset > 0) {
            if (n > 0 && this.m_SegVec[n - 1].equal(this.m_SegVec[m])) {
                chg.nUndo_Begin = n - 1;
                chg.nUndo_End = m + 1;
                chg.nRedo_Begin = n - 1;
                chg.nRedo_End = n;
            } else {
                chg.nUndo_Begin = n;
                chg.nUndo_End = m + 1;
                chg.nRedo_Begin = n;
                chg.nRedo_End = n + 1;
            }
        } else if (b_offset == 0 && e_offset == 0) {
            //if ( (n > 0 && m < (int)m_SegVec.size())  && m_SegVec[n-1].equal(m_SegVec[m])) {
            //	chg.nUndo_Begin = n-1; chg.nUndo_End = m+1;
            //	chg.nRedo_Begin = n-1; chg.nRedo_End = n;
            //}
            //else {
            //	chg.nUndo_Begin = n; chg.nUndo_End = m;
            //	chg.nRedo_Begin = n; chg.nRedo_End = n;
            //}

            if ((n > 0 && m < this.m_SegVec.length) && this.m_SegVec[n - 1].equal(this.m_SegVec[m])) {
                chg.nUndo_Begin = n - 1;
                chg.nUndo_End = m + 1;
                chg.nRedo_Begin = n - 1;
                chg.nRedo_End = n;
            } else if (m == this.m_SegVec.length) { //D 10.11.26 - "Last $" 처리에 대한 것.

                // 뒤쪽 segment가 모두 지워지므로 n-1과의 merge는 일어나지 않는다.
                // 따라서 undo 범위는 지워지는 [n, m)만이어야 함.
                chg.nUndo_Begin = n;
                chg.nUndo_End = m;
                chg.nRedo_Begin = n;
                chg.nRedo_End = n;

            } else {
                chg.nUndo_Begin = n;
                chg.nUndo_End = m;
                chg.nRedo_Begin = n;
                chg.nRedo_End = n;
            }
        }
    }

    //ERR_CODE get_changes_on_pasting(int nPosBegin, int nPosEnd, int& nUndo_Begin, int& nUndo_End, int& nRedo_Begin, int& nRedo_End)
    private get_changes_on_pasting(nPosBegin: number, nPosEnd: number, chg: ChangeRange): SegResult {
        // chg = {nUndo_Begin, nUndo_End, nRedo_Begin, nRedo_End}
        var nRngSize = this.m_SegRngCopy.m_SegVec.length;

        var segPos_b: SegPos = { pIndex: 0, pOffset: 0 };
        var err_code = this.getPosition(nPosBegin, segPos_b);
        var nSegIndex = segPos_b.pIndex;
        var nOffset = segPos_b.pOffset;

        if (nPosBegin == this.getElementTotal()) //D 10.11.26 - "Last $" 처리에 대한 것.
        {
            chg.nUndo_Begin = nSegIndex - 1;
            chg.nUndo_End = nSegIndex;

            // calc redo range
            var nMergeCounter = this.m_SegVec[nSegIndex - 1].equal(this.m_SegRngCopy.m_SegVec[0]) ? 1 : 0;
            var count_of_copied_seg = this.m_SegRngCopy.m_SegVec.length;

            chg.nRedo_Begin = nSegIndex - 1;
            chg.nRedo_End = (chg.nRedo_Begin + count_of_copied_seg + 1) - nMergeCounter;
        } else {
            var nInsertIndex: number;
            nInsertIndex = this.get_insert_pos_after_split(nSegIndex, nOffset); // 실제 split()하기 전에 위치만 확보.

            var nMergeCounter = 0;
            if (nOffset > 0) {
                nMergeCounter += this.m_SegVec[nSegIndex].equal(this.m_SegRngCopy.m_SegVec[0]) ? 1 : 0;
                nMergeCounter += this.m_SegVec[nSegIndex].equal(this.m_SegRngCopy.m_SegVec[nRngSize - 1]) ? 1 : 0;

                chg.nUndo_Begin = nSegIndex;
                chg.nUndo_End = nSegIndex + 1;
                chg.nRedo_Begin = nSegIndex;
                chg.nRedo_End = (nSegIndex + nRngSize + 2) - nMergeCounter;
            } else {
                //int nFirstSegIndex = (nSegIndex-1) < 0 ? 0 : (nSegIndex-1);

                var nFirstMerge: number, nSecondMerge: number;
                if (nSegIndex == 0)
                    nFirstMerge = 0;
                else
                    nFirstMerge = this.m_SegVec[nSegIndex - 1].equal(this.m_SegRngCopy.m_SegVec[0]) ? 1 : 0;
                nSecondMerge = this.m_SegVec[nSegIndex].equal(this.m_SegRngCopy.m_SegVec[nRngSize - 1]) ? 1 : 0;

                chg.nUndo_Begin = nInsertIndex - nFirstMerge;
                chg.nUndo_End = nInsertIndex + nSecondMerge;
                chg.nRedo_Begin = nInsertIndex - nFirstMerge;
                chg.nRedo_End = (nInsertIndex - nFirstMerge) + nRngSize;
            }
        }

        return err_code;
    }

    private paste_operation(nSegIndex: number, nOffset: number, PasteInfo: GT_PasteInfo): void {
        // GT_PasteInfo& PasteInfo

        //D 10.11.26 - "Last $" 처리에 대한 것.
        if (nSegIndex == this.m_SegVec.length) {
            this.assert(nOffset == 0);

            for (var i = 0; i < this.m_SegRngCopy.m_SegVec.length; i++)
                this.insert_to(nSegIndex + i, this.m_SegRngCopy.m_SegVec[i].clone());
            this.merge_with_next_seg(nSegIndex - 1);
        } else {
            var nInsertPos = this.split(nSegIndex, nOffset);
            for (var i = 0; i < this.m_SegRngCopy.m_SegVec.length; i++)
                this.insert_to(nInsertPos + i, this.m_SegRngCopy.m_SegVec[i].clone());
            var nRngSize = this.m_SegRngCopy.m_SegVec.length;
            this.merge_with_next_seg(nInsertPos + nRngSize - 1);
            this.merge_with_next_seg(nInsertPos - 1);
        }

        //T10
        if (PasteInfo.m_last_newline_being_erased_case)
            this.m_SegVec[this.m_SegVec.length - 1].m_nCount += 1;
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

    private merge_with_next_seg(nSegIndex: number): SegResult {
        if (nSegIndex >= (this.m_SegVec.length-1))
            return SEGC.ERR_OUT_OF_RANGE;
        if (nSegIndex < 0)
            return SEGC.ERR_OUT_OF_RANGE;

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
}

export default GT_segmentLayer;
