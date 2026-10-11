import GT_SegRange from "../../../../src/engine/segment/GT_SegRange";
import GT_SegHistory from "../../../../src/engine/segment/GT_SegHistory";
import SEGC from '../../../../src/engine/segment/segment_const';

function GT_segmentLayer(nGravity, attr_class_name, attr_prototype) {
    var _self_layer = this;
    var _nGravity = nGravity;
    this._attr_class_name = attr_class_name;
    this._attr_prototype = attr_prototype;
    var m_SegRngCopy = new GT_SegRange;

    var m_SegVec = [];

    // for undo/redo
    var m_History = new GT_SegHistory;
    var m_SegRngBefore = new GT_SegRange;
    var m_SegRngAfter = new GT_SegRange;

    // for debugging (seglayer_par.js와 동일)
    this.assert = function(expr, obj) {
        console.assert(expr, obj);
    }

    this.set_history_limit = function(limit) {
        m_History.set_history_limit(limit);
    }

    function Destruct() {
        // for(size_t i=0; i<m_SegVec.size(); i++)
        // 	if (m_SegVec[i].m_pAttribute)
        // 		delete m_SegVec[i].m_pAttribute;
        // m_SegVec.clear();

        // m_SegRngBefore.clear();
        // m_SegRngAfter.clear();		
    }

    this.dup_segment_vec = function(that) {
        // 1. 현재의 mm_SegVec을 비움
        m_SegVec.length = 0;

        var vec = that._get_vec();
        for (var i = 0; i < vec.length; i++)
            m_SegVec.push(vec[i].clone());
    }

    this._get_vec = function() {
        return m_SegVec;
	}

	this.getLength = function() {
		return m_SegVec.reduce((sum, seg) => {return sum += seg.m_nCount}, 0)
	}

    this.getDataObject = function() {
        var arr = m_SegVec.map(function(seg) {
            return seg.getDataObject();
        })
        return arr;
    }
    this.setByDataObject = function(arr, factory) {
        if (arr == undefined) {
            console.assert(false, "input arr should not be null.");
        }

        m_SegVec.length = 0;
        arr.forEach(function(data) {
            var obj = factory();
            obj.set(data);
            m_SegVec.push(obj);
        })
    }


    this.canAccept = function(attrObj) {
        if (attrObj === null)
            return null;
        return (this._attr_class_name === attrObj._attr_class_name) ? attrObj : null;
    }

    this.log = function() {
        //console.log('m_SegVec: ', m_SegVec);
        var str = '';
        for (var i = 0; i < m_SegVec.length; i++)
            str += '[fsize:' + m_SegVec[i].FontSize + ', cnt:' + m_SegVec[i].m_nCount + ']  ';
        console.log(str);

        //m_History.log();
    }

    this.reset_history = function() {
        m_History.reset();
    }
 
    this.insert_newline = function(nPos, pAttr) {
        return this.insert(nPos, pAttr);
    }

    this.insert = function(nPos, pAttr) {
        var segPos = { pIndex: 0, pOffset: 0 };
        var err_code = getInsertPosition(nPos, segPos);
        var nIndex = segPos.pIndex;
        var nOffset = segPos.pOffset;

        if (err_code === SEGC.OK_ALL) {
            _insert(nIndex, nOffset, 1, pAttr);            
        }
        else if (err_code === SEGC.ERR_SEGVEC_EMPTY) {
            if (pAttr === undefined || pAttr === null) {
                console.assert(false, "Attribute is needed");
                return SEGC.ERR_NEED_ATTRIBUTE;
            }
            //GT_Segment seg(pAttr); // GT_Segment::m_count는 자동으로 1로 셋팅됨.
            var seg = pAttr.factory(); //D

            save_undo_info(0, 0);
            m_SegVec.push(seg);
            save_redo_info(0, 1);
        } else if (err_code === SEGC.OK_NEED_INSERT_SEGMENT_BEFORE) {
            _self_layer.assert(false);
        }

        //_show_vec();
        return SEGC.OK_ALL;
    }

    this.insert_string = function(nPos, str_arr, pAttr) {
        var segPos = { pIndex: 0, pOffset: 0 };
        var err_code = getInsertPosition(nPos, segPos);
        var nIndex = segPos.pIndex;
        var nOffset = segPos.pOffset;

        if (err_code === SEGC.OK_ALL) {
            _insert(nIndex, nOffset, str_arr.length, pAttr);
        }
        else {
            _self_layer.assert(false);            
        }

        return SEGC.OK_ALL;
    }    

    var _insert = function(nIndex, nOffset, str_length, pAttr) {
        if (pAttr == null) {
            save_undo_info(nIndex, nIndex + 1);
            m_SegVec[nIndex].m_nCount += str_length;
            save_redo_info(nIndex, nIndex + 1);
        }    
        else {
            if (m_SegVec[nIndex].equal(pAttr)) {
                /*  insert위치가 nIndex의 seg내에 있고 속성이 같은 경우.
                    AAp|BB
                    pAttr의 속성이 AA와 같은 경우
                */
                save_undo_info(nIndex, nIndex + 1);
                m_SegVec[nIndex].m_nCount += str_length;
                save_redo_info(nIndex, nIndex + 1);
            }
            else if (nOffset == m_SegVec[nIndex].m_nCount && nIndex + 1 < m_SegVec.length && m_SegVec[nIndex+1].equal(pAttr)) {
                /*  insert위치가 nIndex seg의 끝(== nIndex+1 seg의 첫머리)에 있고 nIndex+1 seg의 속성과 같은 경우.
                    AA|BB    --> AA|pBB
                    pAttr의 속성이 BB와 같은 경우
                */
                save_undo_info(nIndex+1, nIndex + 2);
                m_SegVec[nIndex+1].m_nCount += str_length;
                save_redo_info(nIndex+1, nIndex + 2);
            }
            else if (nOffset == m_SegVec[nIndex].m_nCount && (nIndex + 1 >= m_SegVec.length || !m_SegVec[nIndex+1].equal(pAttr))) {
                /*  insert위치가 nIndex seg의 끝(== nIndex+1 seg의 첫머리)에 있고 nIndex+1 seg의 속성과 다른 경우.
                    AA|BB    --> AA|p|BB
                    pAttr의 속성이 AA와 같은 경우
                    nIndex가 마지막 seg이면(문서 끝) 뒤에 새 seg를 추가한다.
                    AA|      --> AA|p
                */
                save_undo_info(nIndex+1, nIndex + 1);
                let seg = pAttr.factory(str_length)
                insert_to(nIndex+1, seg);
                save_redo_info(nIndex+1, nIndex + 2);
            }
            else if (nOffset == 0 && !m_SegVec[nIndex].equal(pAttr)) {
                /*  Insert위치가 nIndex seg의 맨 앞쪽에 있고, nIndex seg의 속성과 다른 경우
                    문서의 가장 첫머리에서 발생한는 경우임 
                    AA  --> p|AA
                */
               save_undo_info(nIndex, nIndex);
               let seg = pAttr.factory(str_length)
               insert_to(nIndex, seg);
               save_redo_info(nIndex, nIndex + 1);
            }
            else {
                /*  split 되어야 하는 경우
                    AA|AA --> AA|p|AA
                */
                save_undo_info(nIndex, nIndex + 1);
                split_and_insert_attr(nIndex, nOffset, pAttr, str_length);
                save_redo_info(nIndex, nIndex + 3);
            }
        }
    }

    this.erase = function(begin, end) {
        var nPosBegin = begin;
        var nPosEnd = (end == undefined) ? (begin + 1) : end;
        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////
        var segPos_b = { pIndex: 0, pOffset: 0 };
        getPosition(nPosBegin, segPos_b);
        var n = segPos_b.pIndex;
        var b_offset = segPos_b.pOffset;

        var chg = { nUndo_Begin: 0, nUndo_End: 0, nRedo_Begin: 0, nRedo_End: 0 };
        get_changes_on_erasing(nPosBegin, nPosEnd, chg);

        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////

        save_undo_info(chg.nUndo_Begin, chg.nUndo_End);

        erase_range(nPosBegin, nPosEnd);
        merge_with_next_seg(n + (b_offset == 0 ? -1 : 0));

        save_redo_info(chg.nRedo_Begin, chg.nRedo_End);

        //_show_vec();
        return SEGC.OK_ALL;
    }

    this.set = function(nPosBegin, nPosEnd, pAttr) {
        // 1. erase (begin ,end) without merge
        // 2. insert segment
        // 3. test and merge.

        var err_code;

        // 빈 범위이면 layer는 바꾸지 않는다. (count 0인 segment가 생기는 것을 방지)
        // 단, manager history와 정렬을 유지하기 위해 빈 history 항목은 남긴다.
        if (nPosBegin >= nPosEnd) {
            save_undo_info(0, 0);
            save_redo_info(0, 0);
            return SEGC.OK_ALL;
        }

        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////
        var segPos_b = { pIndex: 0, pOffset: 0 };
        var segPos_e = { pIndex: 0, pOffset: 0 };

        getPosition(nPosBegin, segPos_b);
        err_code = getPosition(nPosEnd, segPos_e);

        var n = segPos_b.pIndex;
        var b_offset = segPos_b.pOffset;
        var m = segPos_e.pIndex;
        var e_offset = segPos_e.pOffset;


        // erase하면 변화되는 segment의 범위를 추적함.
        var nUndo_Begin, nUndo_End;
        var nRedo_Begin, nRedo_End;

        var nMergeOffset = 0;
        if (err_code != SEGC.OK_END_POSITION)
            nMergeOffset += m_SegVec[m].equal(pAttr) ? 0 : 1;
        else
            nMergeOffset = 1;

        if (b_offset > 0 && e_offset > 0) {
            if (m_SegVec[n].equal(pAttr)) {
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
            if (m_SegVec[n].equal(pAttr)) {
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
            if (n > 0 && m_SegVec[n - 1].equal(pAttr)) {
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
            if (n > 0 && m_SegVec[n - 1].equal(pAttr)) {
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

        save_undo_info(nUndo_Begin, nUndo_End);

        erase_range(nPosBegin, nPosEnd);

        // 2. insert
        var segPos = { pIndex: 0, pOffset: 0 };
        err_code = getPosition(nPosBegin, segPos);

        if (err_code == SEGC.ERR_SEGVEC_EMPTY)
            segPos.pIndex = 0;

        //GT_Segment seg(pAttr, nPosEnd - nPosBegin);
        var seg = pAttr.factory(nPosEnd - nPosBegin); //D
        split_and_insert_seg(segPos.pIndex, segPos.pOffset, seg);

		merge_with_next_seg(segPos.pIndex+1);
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
		
        merge_with_next_seg(segPos.pIndex);
        merge_with_next_seg(segPos.pIndex - 1);

        save_redo_info(nRedo_Begin, nRedo_End);

        //_show_vec();
        return SEGC.OK_ALL;
    }

    this.query_if_last_newline_being_erased = function(nPosBegin, nPosEnd) {
        return false
    }

    this.paste = function(nPos, PasteInfo) {
        var err_code;

        if (PasteInfo.non_clipboard_copy_string.length > 0) {
            var segPos = { pIndex: 0, pOffset: 0 };
            err_code = getInsertPosition(nPos, segPos);
            var nIndex = segPos.pIndex;
            var nOffset = segPos.pOffset;

            save_undo_info(nIndex, nIndex + 1);
            m_SegVec[nIndex].m_nCount += PasteInfo.non_clipboard_copy_string.length;
            save_redo_info(nIndex, nIndex + 1);
        } else {
            if (m_SegRngCopy.m_SegVec.length == 0)
                return SEGC.ERR_RANGE_EMPTY;

            var segPos = { pIndex: 0, pOffset: 0 };
            err_code = getPosition(nPos, segPos);
            var nIndex = segPos.pIndex;
            var nOffset = segPos.pOffset;

            /////////////////////////////////////////////////////////////////////
            /////////////////////////////////////////////////////////////////////
            var chg = { nUndo_Begin: 0, nUndo_End: 0, nRedo_Begin: 0, nRedo_End: 0 };
            get_changes_on_pasting(nPos, nPos, chg);
            /////////////////////////////////////////////////////////////////////
            /////////////////////////////////////////////////////////////////////

            save_undo_info(chg.nUndo_Begin, chg.nUndo_End);
            paste_operation(nIndex, nOffset, PasteInfo);
            save_redo_info(chg.nRedo_Begin, chg.nRedo_End);
        }

        //_show_vec();
        return SEGC.OK_ALL;
    }

    this.clone_SegRngCopy = function() {
        return m_SegRngCopy.clone();
    }
    this.load_new_SegRngCopy = function(pCopyBlock) {
        m_SegRngCopy.clear();
        m_SegRngCopy.copy(pCopyBlock);
        return SEGC.OK_ALL;
    }
    this.__get_copy_clone = function() {
        return m_SegRngCopy.clone();
    }
    this.__copy_from = function(pCopyBlock) {
        m_SegRngCopy.clear();
        m_SegRngCopy.copy(pCopyBlock); //D
        return SEGC.OK_ALL;
    }

    this.copy = function(nPosBegin, nPosEnd) {
        var err_code;
        m_SegRngCopy.clear();

        var segPos_b = { pIndex: 0, pOffset: 0 };
        var segPos_e = { pIndex: 0, pOffset: 0 };

        err_code = getPosition(nPosBegin, segPos_b);
        err_code = getPosition(nPosEnd, segPos_e);

        for (var i = segPos_b.pIndex; i <= segPos_e.pIndex; i++) {
            if (i == segPos_b.pIndex) {
                //GT_Segment seg(m_SegVec[i].m_pAttribute);
                var seg = m_SegVec[i].factory(); //D
                if (segPos_b.pIndex === segPos_e.pIndex)
                    seg.m_nCount = nPosEnd - nPosBegin;
                else
                    seg.m_nCount = m_SegVec[i].m_nCount - segPos_b.pOffset;

                m_SegRngCopy.m_SegVec.push(seg);
            } else if (i === segPos_e.pIndex) {
                if (segPos_e.pOffset > 0) {
                    //GT_Segment seg(m_SegVec[i].m_pAttribute);
                    var seg = m_SegVec[i].factory(); //D
                    seg.m_nCount = segPos_e.pOffset;
                    m_SegRngCopy.m_SegVec.push(seg);
                }
            } else {
                m_SegRngCopy.m_SegVec.push(m_SegVec[i].clone());
            }
        }

        return SEGC.OK_ALL;
    }

    this.undo = function() {
        // C++ source와는 조금 다르게 구현.
        var SegHistoryInfo = m_History.getPrevStep();
        if (SegHistoryInfo) {
            erase_with(SegHistoryInfo.m_pSegRngAfter);
            insert_with(SegHistoryInfo.m_pSegRngBefore);
            //_show_vec();
            return SEGC.OK_ALL;
        }

        return SEGC.ERR_BEGIN_OF_HISTORY;
    }
    this.redo = function() {
        var SegHistoryInfo = m_History.getNextStep();
        if (SegHistoryInfo) {
            erase_with(SegHistoryInfo.m_pSegRngBefore);
            insert_with(SegHistoryInfo.m_pSegRngAfter);
            //_show_vec();
            return SEGC.OK_ALL;
        }

        return SEGC.ERR_END_OF_HISTORY;
    }

    this.getAttr = function(nPos, seg_info, callback) {
        if (m_SegVec.length == 0)
            return null;

        var nUpperBound = 0;
        for (var i = 0; i < m_SegVec.length; i++) {
            nUpperBound += m_SegVec[i].m_nCount;
            if (nPos < nUpperBound) {
                if (seg_info) {
                    seg_info.index_in_seg = nPos - (nUpperBound - m_SegVec[i].m_nCount);
                    seg_info.size_of_seg = m_SegVec[i].m_nCount;
                }
                callback && callback(m_SegVec[i]);

                return m_SegVec[i];
            }
        }

        return null;
    }
    this.getAttr_by_gravity = function(nPos, seg_info, callback) {
        var sampling_pos = nPos;

        if (_nGravity === SEGC.GRAVITY_LEFT)
            sampling_pos = (nPos === 0) ? 0 : nPos - 1;
        else if (_nGravity === SEGC.GRAVITY_RIGHT)
            sampling_pos = nPos;

        return this.getAttr(sampling_pos, seg_info, callback);
    }

    this.getAttr_by_index = function(index) {
        if (m_SegVec.length == 0)
            return null;

        //MT_ASSERT(index < m_SegVec.size());
        return m_SegVec[index];
    }

    this.getElementTotal = function() {
        var nSize = 0;
        for (var i = 0; i < m_SegVec.length; i++)
            nSize += m_SegVec[i].m_nCount;

        return nSize;
    }

    this.get_segment_range_in_current_pos = function(nPos, pos) {
        if (m_SegVec.length == 0)
            return SEGC.ERR_SEGVEC_EMPTY;

        var nUpperBound = 0;
        for (var i = 0; i < m_SegVec.length; i++) {
            pos.from = nUpperBound;
            pos.to = pos.from + m_SegVec[i].m_nCount;

            nUpperBound += m_SegVec[i].m_nCount;
            if (nPos < nUpperBound)
                return SEGC.OK_ALL;
        }

        if (nPos == nUpperBound) {
            //MT_ASSERT(FALSE);
            return SEGC.ERR_OUT_OF_RANGE;
        }

        return SEGC.ERR_OUT_OF_RANGE;
    }

    this.is_in_single_segment = function(pos_from, pos_to) {
            // from,to 영역이 단일 segment내의 범위인지 판단.

            var segPos_b = { pIndex: 0, pOffset: 0 };
            var segPos_e = { pIndex: 0, pOffset: 0 };

            getPosition(pos_from, segPos_b);
            getPosition(pos_to, segPos_e);

            if ((segPos_b.pIndex == segPos_e.pIndex) ||
                ((segPos_b.pIndex == segPos_e.pIndex - 1) && segPos_e.pOffset == 0)) {
                return true;
            }

            return false;
        }
        //////////////////////////////////////////////////////////////////////////////////////
        // private: 
        //////////////////////////////////////////////////////////////////////////////////////

    var getPosition = function(nPos, segPos) {
        // int* pIndex, int* pOffset

        if (m_SegVec.length === 0) {
            segPos.pIndex = 0;
            segPos.pOffset = 0;
            return SEGC.ERR_SEGVEC_EMPTY;
        }

        var nUpperBound = 0;
        for (var i = 0; i < m_SegVec.length; i++) {
            nUpperBound += m_SegVec[i].m_nCount;
            if (nPos < nUpperBound) {
                segPos.pIndex = i;
                segPos.pOffset = nPos - (nUpperBound - m_SegVec[i].m_nCount);
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

    var getInsertPosition = function(nPos, segPos) {
        // segPos = {pIndex, pOffset}
        if (m_SegVec.length == 0)
            return SEGC.ERR_SEGVEC_EMPTY;
        if (nPos < 0)
            return SEGC.ERR_OUT_OF_RANGE;

        var nLength = 0;
        var nUpperBound = 0;
        var nSegOffset;
        var nLastGXFlag = SEGC.GXFLAG_NULL;

        for (var i = 0; i < m_SegVec.length; i++) {
            nUpperBound += m_SegVec[i].m_nCount;
            nSegOffset = nPos - nLength;
            if (_nGravity == SEGC.GRAVITY_LEFT) {
                // AAABBB --> (AAA#)BBB : offset이 segment의 길이(이 경우 3)와 같은경우, segment 마지막에 append되는 경우 임.|ABCD|
                if (nPos <= nUpperBound) {
                    segPos.pIndex = i;
                    segPos.pOffset = nSegOffset;
                    return SEGC.OK_ALL;
                }
            } else if (_nGravity == SEGC.GRAVITY_RIGHT) {
                // AAABBB --> AAA(#BBB) : offset이 0인 경우 segment 첫번째 element로 들어가는 경우임.
                if (nPos < nUpperBound) {
                    segPos.pIndex = i;
                    segPos.pOffset = nSegOffset;
                    return SEGC.OK_ALL;
                }
            } else if (_nGravity == SEGC.GRAVITY_EXCLUSIVE) {
                var nGxFlag = m_SegVec[i].getGravityExFlag();
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
                            _self_layer.assert(false);
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

            nLength += m_SegVec[i].m_nCount;
        }

        // 여기까지 오면 nPos는 가장 마지막에 위치하고 있는 것임.

        if (_nGravity == SEGC.GRAVITY_LEFT || _nGravity == SEGC.GRAVITY_RIGHT) {
            segPos.pIndex = i - 1;
            segPos.pOffset = nPos - (nLength - m_SegVec[i - 1].m_nCount);
            return SEGC.OK_ALL;
        } else if (_nGravity == SEGC.GRAVITY_EXCLUSIVE) {
            if (nLastGXFlag == SEGC.GXFLAG_BOTH)
                _self_layer.assert(false);
            else {
                segPos.pIndex = i - 1;
                segPos.pOffset = nPos - (nLength - m_SegVec[i - 1].m_nCount);
                // 현재 segment index 앞에 새로운 segment 삽입이 필요함.
                return SEGC.OK_ALL;
            }
        }

        return SEGC.ERR_OUT_OF_RANGE;
    }

    //void get_changes_on_erasing(int nPosBegin, int nPosEnd, nUndo_Begin, int& nUndo_End, int& nRedo_Begin, int& nRedo_End)
    var get_changes_on_erasing = function(nPosBegin, nPosEnd, chg) {
        // chg = {nUndo_Begin, nUndo_End, nRedo_Begin, nRedo_End}

        var segPos_b = { pIndex: 0, pOffset: 0 };
        var segPos_e = { pIndex: 0, pOffset: 0 };

        getPosition(nPosBegin, segPos_b);
        getPosition(nPosEnd, segPos_e);

        var n = segPos_b.pIndex;
        var b_offset = segPos_b.pOffset;
        var m = segPos_e.pIndex;
        var e_offset = segPos_e.pOffset;

        if (b_offset > 0 && e_offset > 0) {
            if (m_SegVec[n].equal(m_SegVec[m])) {
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
            if (m_SegVec.length == m) {
                chg.nUndo_Begin = n;
                chg.nUndo_End = m;
                chg.nRedo_Begin = n;
                chg.nRedo_End = n + 1;
            } else if (m_SegVec[n].equal(m_SegVec[m])) {
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
            if (n > 0 && m_SegVec[n - 1].equal(m_SegVec[m])) {
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

            if ((n > 0 && m < m_SegVec.length) && m_SegVec[n - 1].equal(m_SegVec[m])) {
                chg.nUndo_Begin = n - 1;
                chg.nUndo_End = m + 1;
                chg.nRedo_Begin = n - 1;
                chg.nRedo_End = n;
            } else if (m == m_SegVec.length) { //D 10.11.26 - "Last $" 처리에 대한 것.

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
    var get_changes_on_pasting = function(nPosBegin, nPosEnd, chg) {
        // chg = {nUndo_Begin, nUndo_End, nRedo_Begin, nRedo_End}
        var nRngSize = m_SegRngCopy.m_SegVec.length;

        var segPos_b = { pIndex: 0, pOffset: 0 };
        var err_code = getPosition(nPosBegin, segPos_b);
        var nSegIndex = segPos_b.pIndex;
        var nOffset = segPos_b.pOffset;

        if (nPosBegin == _self_layer.getElementTotal()) //D 10.11.26 - "Last $" 처리에 대한 것.
        {
            chg.nUndo_Begin = nSegIndex - 1;
            chg.nUndo_End = nSegIndex;

            // calc redo range
            var nMergeCounter = m_SegVec[nSegIndex - 1].equal(m_SegRngCopy.m_SegVec[0]) ? 1 : 0;
            var count_of_copied_seg = m_SegRngCopy.m_SegVec.length;

            chg.nRedo_Begin = nSegIndex - 1;
            chg.nRedo_End = (chg.nRedo_Begin + count_of_copied_seg + 1) - nMergeCounter;
        } else {
            var nInsertIndex;
            nInsertIndex = get_insert_pos_after_split(nSegIndex, nOffset); // 실제 split()하기 전에 위치만 확보.

            var nMergeCounter = 0;
            if (nOffset > 0) {
                nMergeCounter += m_SegVec[nSegIndex].equal(m_SegRngCopy.m_SegVec[0]) ? 1 : 0;
                nMergeCounter += m_SegVec[nSegIndex].equal(m_SegRngCopy.m_SegVec[nRngSize - 1]) ? 1 : 0;

                chg.nUndo_Begin = nSegIndex;
                chg.nUndo_End = nSegIndex + 1;
                chg.nRedo_Begin = nSegIndex;
                chg.nRedo_End = (nSegIndex + nRngSize + 2) - nMergeCounter;
            } else {
                //int nFirstSegIndex = (nSegIndex-1) < 0 ? 0 : (nSegIndex-1);

                var nFirstMerge, nSecondMerge;
                if (nSegIndex == 0)
                    nFirstMerge = 0;
                else
                    nFirstMerge = m_SegVec[nSegIndex - 1].equal(m_SegRngCopy.m_SegVec[0]) ? 1 : 0;
                nSecondMerge = m_SegVec[nSegIndex].equal(m_SegRngCopy.m_SegVec[nRngSize - 1]) ? 1 : 0;

                chg.nUndo_Begin = nInsertIndex - nFirstMerge;
                chg.nUndo_End = nInsertIndex + nSecondMerge;
                chg.nRedo_Begin = nInsertIndex - nFirstMerge;
                chg.nRedo_End = (nInsertIndex - nFirstMerge) + nRngSize;
            }
        }

        return err_code;
    }

    var paste_operation = function(nSegIndex, nOffset, PasteInfo) {
        // GT_PasteInfo& PasteInfo

        //D 10.11.26 - "Last $" 처리에 대한 것.
        if (nSegIndex == m_SegVec.length) {
            _self_layer.assert(nOffset == 0);

            for (var i = 0; i < m_SegRngCopy.m_SegVec.length; i++)
                insert_to(nSegIndex + i, m_SegRngCopy.m_SegVec[i].clone());
            merge_with_next_seg(nSegIndex - 1);
        } else {
            var nInsertPos = split(nSegIndex, nOffset);
            for (var i = 0; i < m_SegRngCopy.m_SegVec.length; i++)
                insert_to(nInsertPos + i, m_SegRngCopy.m_SegVec[i].clone());
            var nRngSize = m_SegRngCopy.m_SegVec.length;
            merge_with_next_seg(nInsertPos + nRngSize - 1);
            merge_with_next_seg(nInsertPos - 1);
        }

        //T10
        if (PasteInfo.m_last_newline_being_erased_case)
            m_SegVec[m_SegVec.length - 1].m_nCount += 1;
    }

    // split_and_insert_seg() 와 split_and_insert_attr()
    // split_and_insert_attr()는 파라미터 pAttr의 값을 이용하여 
    // segment를 만들어 split_and_insert_seg()를 호출.
    var split_and_insert_seg = function(nIndex, nOffset, seg) {
        if (nIndex >= m_SegVec.length) {
            insert_to(nIndex, seg);
            return SEGC.OK_ALL;
        }

        var nCurSegCount = m_SegVec[nIndex].m_nCount;
        if (nOffset == 0)
            insert_to(nIndex, seg);
        else if (nOffset == nCurSegCount)
            insert_to(nIndex + 1, seg);
        else {
            var nLeft = nOffset;
            var nRight = nCurSegCount - nOffset;
            m_SegVec[nIndex].m_nCount = nLeft;

            if (nRight == 0)
                insert_to(nIndex + 1, seg);
            else {
                // GT_Segment seg_right(m_SegVec[nIndex].m_pAttribute);
                var seg_right = m_SegVec[nIndex].factory(); //D

                seg_right.m_nCount = nRight;

                insert_to(nIndex + 1, seg);
                insert_to(nIndex + 2, seg_right);
            }
        }

        return SEGC.OK_ALL;
    }

    var split_and_insert_attr = function(nIndex, nOffset, pAttr, str_length) {
        //GT_Segment seg(pAttr);
        var seg = pAttr.factory(str_length); //D

        split_and_insert_seg(nIndex, nOffset, seg);
        return SEGC.OK_ALL;
    }

    var split = function(nIndex, nOffset) {
        var pNewIndex = -1;

        var nCurSegCount = m_SegVec[nIndex].m_nCount;
        if (0 < nOffset && nOffset < nCurSegCount) {
            m_SegVec[nIndex].m_nCount = nOffset;
            //GT_Segment seg(m_SegVec[nIndex].m_pAttribute);
            var seg = m_SegVec[nIndex].factory(); //D


            seg.m_nCount = nCurSegCount - nOffset;
            insert_to(nIndex + 1, seg);
            pNewIndex = nIndex + 1;
        } else if (nOffset == nCurSegCount) {
            // 가장 마지막 segment의 마지막 offset임.
            pNewIndex = nIndex + 1;
        } else {
            pNewIndex = nIndex;
        }

        return pNewIndex;
    }

    var get_insert_pos_after_split = function(nIndex, nOffset) {
        // (nIndex, nOffset) 위치에서 split된 후의 segment index의 위치 얻기

        var nInsertPosIndex;

        var nCurSegCount = m_SegVec[nIndex].m_nCount;
        if (0 < nOffset && nOffset < nCurSegCount)
            nInsertPosIndex = nIndex + 1;
        else if (nOffset == nCurSegCount)
            nInsertPosIndex = nIndex + 1; // 가장 마지막 segment의 마지막 offset임.
        else
            nInsertPosIndex = nIndex;

        return nInsertPosIndex;
    }

    var insert_to = function(i, seg) {
        // i가 iterator::end()위치이면, push_back()을, 아니면 insert()을 함.
        if (i < m_SegVec.length) // 마지막이 아니면
            m_SegVec.splice(i, 0, seg);
        else
            m_SegVec.push(seg);
    }

    var merge_with_next_seg = function(nSegIndex) {
        if (nSegIndex >= (m_SegVec.length-1))
            return SEGC.ERR_OUT_OF_RANGE;
        if (nSegIndex < 0)
            return SEGC.ERR_OUT_OF_RANGE;

        if (m_SegVec[nSegIndex].equal(m_SegVec[nSegIndex + 1])) {
            m_SegVec[nSegIndex].m_nCount += m_SegVec[nSegIndex + 1].m_nCount;
            erase_and_free_segment(nSegIndex + 1);
            return SEGC.OK_SEGMENT_MERGED;
        } else

            return SEGC.OK_SEGMENT_NOT_MERGED;
    }

    var erase_and_free_segment = function(nSegIndex) {
        m_SegVec.splice(nSegIndex, 1);
    }
    var erase_and_free_segments = function(nSegIndexBegin, nSegIndexEnd) {
        m_SegVec.splice(nSegIndexBegin, nSegIndexEnd - nSegIndexBegin)
    }
    var erase_range = function(nPosBegin, nPosEnd) {
        var err_code;

        var segPos_b = { pIndex: 0, pOffset: 0 };
        var segPos_e = { pIndex: 0, pOffset: 0 };

        getPosition(nPosBegin, segPos_b);
        getPosition(nPosEnd, segPos_e);

        var nSegIndexBegin = segPos_b.pIndex;
        var nOffsetBegin = segPos_b.pOffset;
        var nSegIndexEnd = segPos_e.pIndex;
        var nOffsetEnd = segPos_e.pOffset;

        for (var i = nSegIndexEnd; i >= nSegIndexBegin; i--) {
            if (i == nSegIndexEnd) {
                var nStart = (nSegIndexEnd == nSegIndexBegin) ? nOffsetBegin : 0;
                erase_in_segment(i, nStart, nOffsetEnd);
            } else if (i == nSegIndexBegin) {
                var nEnd = (nSegIndexBegin == nSegIndexEnd) ? nOffsetEnd : m_SegVec[i].m_nCount;
                erase_in_segment(i, nOffsetBegin, nEnd);
            } else {
                erase_and_free_segment(i);
            }
        }

        return SEGC.OK_ALL;
    }
    var erase_in_segment = function(nSegIndex, nBegin, nEnd) {
        var err;
        var seg_size = m_SegVec.length;
        if (nSegIndex >= seg_size)
            return SEGC.ERR_OUT_OF_RANGE;
        if (nBegin < 0 || nEnd > m_SegVec[nSegIndex].m_nCount)
            return SEGC.ERR_OUT_OF_RANGE;

        var nSize = nEnd - nBegin;
        if (nSize == m_SegVec[nSegIndex].m_nCount) {
            erase_and_free_segment(nSegIndex);
            err = SEGC.OK_SEGMENT_ERASED;
        } else {
            m_SegVec[nSegIndex].m_nCount -= nSize;
            err = SEGC.OK_ALL;
        }

        return err;
    }

    //////////////

    var save_undo_info = function(nFirstSegIndex, nLastSegIndex) {
        nFirstSegIndex = getInRange(nFirstSegIndex, 0, m_SegVec.length + 1);
        nLastSegIndex = getInRange(nLastSegIndex, 0, m_SegVec.length + 1);

        m_SegRngBefore.clear();
        m_SegRngBefore.m_nFirstSegIndex = nFirstSegIndex;
        m_SegRngBefore.m_nLastSegIndex = nLastSegIndex;
        if (nFirstSegIndex < nLastSegIndex) {
            for (var i = nFirstSegIndex; i < nLastSegIndex; i++)
                m_SegRngBefore.m_SegVec.push(m_SegVec[i].clone());
        }

        return SEGC.OK_ALL;
    }
    var save_redo_info = function(nFirstSegIndex, nLastSegIndex) {
        nFirstSegIndex = getInRange(nFirstSegIndex, 0, m_SegVec.length + 1);
        nLastSegIndex = getInRange(nLastSegIndex, 0, m_SegVec.length + 1);

        m_SegRngAfter.clear();
        m_SegRngAfter.m_nFirstSegIndex = nFirstSegIndex;
        m_SegRngAfter.m_nLastSegIndex = nLastSegIndex;
        if (nFirstSegIndex < nLastSegIndex) {
            for (var i = nFirstSegIndex; i < nLastSegIndex; i++)
                m_SegRngAfter.m_SegVec.push(m_SegVec[i].clone());
        }

        var SegHistoryInfo = {};
        SegHistoryInfo.m_pSegRngBefore = m_SegRngBefore.clone();
        SegHistoryInfo.m_pSegRngAfter = m_SegRngAfter.clone();
        m_History.push_shi(SegHistoryInfo);

        return SEGC.OK_ALL;
    }

    var erase_with = function(pSegRng) {
        erase_and_free_segments(pSegRng.m_nFirstSegIndex, pSegRng.m_nLastSegIndex);
    }

    var insert_with = function(pSegRng) {
        var iSrc = 0;
        for (var i = pSegRng.m_nFirstSegIndex; i < pSegRng.m_nLastSegIndex; i++) {
            insert_to(i, pSegRng.m_SegVec[iSrc].clone());
            ++iSrc;
        }
    }
    var getInRange = function(val, Begin, End) {
        return (val >= End) ? End - 1 : (val < Begin) ? Begin : val;
    }
}

export default GT_segmentLayer;






//////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////

//doTest3();

/* -------------------------------------------------------------
function doTest() {
    var sizeLayer = new GT_segmentLayer(SEGC.GRAVITY_LEFT);

    sizeLayer.log();

    var attr_fsize_10 = new ATTR_FontSize(10);
    var attr_fsize_20 = new ATTR_FontSize(20);

    sizeLayer.insert(0, attr_fsize_10);
    sizeLayer.insert(0, attr_fsize_10);
    sizeLayer.insert(0, attr_fsize_10);
    sizeLayer.log();

    sizeLayer.insert(1, attr_fsize_20);
    sizeLayer.log();

    // 여기서 부터 bug가 발견됨. 13.9.24
    // 지금 layer 상태는 [A][B][AA] 임.
    // 아래 실행되면 [A][BB][AA]가 되어야 하나 [A][B][B][AA] 가됨.
    // 분석 : 첫번째 segment의 끝([A])에 B가 들어 가면서 
    //        새로 들어가는 [B]가 다음 segment인 [B]와 merge가 되어야 하지만, 그렇지 못함.
    sizeLayer.insert(1, attr_fsize_20);
    sizeLayer.log();
}

function doTest2() {
    var FSizeLayer = new GT_segmentLayer(SEGC.GRAVITY_LEFT);

    var str_input, str_output;

    // case 1A
    console.log('case 1A ----------------------');
    str_input = "AAAABBBAAA";
    str_output = "AAAA";
    make_input(str_input);
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.erase(2, 8);
    console.log(str_output);
    FSizeLayer.log();
    FSizeLayer.undo();
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.redo();
    console.log(str_output);
    FSizeLayer.log();

    // case 1B
    console.log('case 1B ----------------------');
    str_input = "AAAABBB";
    str_output = "AAB";
    make_input(str_input);
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.erase(2, 6);
    console.log(str_output);
    FSizeLayer.log();
    FSizeLayer.undo();
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.redo();
    console.log(str_output);
    FSizeLayer.log();

    // case 2A
    console.log('case 2A ----------------------');
    str_input = "AABBAA";
    str_output = "AAAA";
    make_input(str_input);
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.erase(2, 4);
    console.log(str_output);
    FSizeLayer.log();
    FSizeLayer.undo();
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.redo();
    console.log(str_output);
    FSizeLayer.log();

    // case 2B
    console.log('case 2B ----------------------');
    str_input = "AABBCC";
    str_output = "AACC";
    make_input(str_input);
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.erase(2, 4);
    console.log(str_output);
    FSizeLayer.log();
    FSizeLayer.undo();
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.redo();
    console.log(str_output);
    FSizeLayer.log();

    // case 3A
    console.log('case 3A ----------------------');
    str_input = "AAABBBAAA";
    str_output = "AAAA";
    make_input(str_input);
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.erase(1, 6);
    console.log(str_output);
    FSizeLayer.log();
    FSizeLayer.undo();
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.redo();
    console.log(str_output);
    FSizeLayer.log();

    // case 3B
    console.log('case 3B ----------------------');
    str_input = "AAABBBCCC";
    str_output = "ACCC";
    make_input(str_input);
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.erase(1, 6);
    console.log(str_output);
    FSizeLayer.log();
    FSizeLayer.undo();
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.redo();
    console.log(str_output);
    FSizeLayer.log();

    // case 4A
    console.log('case 4A ----------------------');
    str_input = "AABBAA";
    str_output = "AAA";
    make_input(str_input);
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.erase(2, 5);
    console.log(str_output);
    FSizeLayer.log();
    FSizeLayer.undo();
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.redo();
    console.log(str_output);
    FSizeLayer.log();

    // case 4B
    console.log('case 4B ----------------------');
    str_input = "AABBCC";
    str_output = "AAC";
    make_input(str_input);
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.erase(2, 5);
    console.log(str_output);
    FSizeLayer.log();
    FSizeLayer.undo();
    console.log(str_input);
    FSizeLayer.log();
    FSizeLayer.redo();
    console.log(str_output);
    FSizeLayer.log();


    function make_input(str) {
        var end_position = FSizeLayer.getElementTotal();
        FSizeLayer.erase(0, end_position);

        var attr_fsize_10 = new ATTR_FontSize(10);
        var attr_fsize_20 = new ATTR_FontSize(20);
        var attr_fsize_30 = new ATTR_FontSize(30);

        for (var i = 0; i < str.length; i++) {
            switch (str[i]) {
                case 'A':
                    FSizeLayer.insert(i, attr_fsize_10);
                    break;
                case 'B':
                    FSizeLayer.insert(i, attr_fsize_20);
                    break;
                case 'C':
                    FSizeLayer.insert(i, attr_fsize_30);
                    break;
                default:
                    assert(false);
                    break;
            }
        }
    }
}



function doTest3() {
    var m_FSizeLayer = new GT_segmentLayer(SEGC.GRAVITY_LEFT);
    var m_FSizeLayer_Copy = new GT_segmentLayer(SEGC.GRAVITY_LEFT);

    var str_input, str_output;
    var PasteInfo = new GT_PasteInfo;
    // 조건 : in-segment offset != 0

    // case 1A
    str_input = "AAAA"; // 
    prepare_copy("AA");
    str_output = "AAAAAA"; // 
    make_input(m_FSizeLayer, str_input);
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.paste(2, PasteInfo);
    console.log(str_output);
    m_FSizeLayer.log();
    m_FSizeLayer.undo();
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.redo();
    console.log(str_output);
    m_FSizeLayer.log();

    // case 
    console.log('----------------------')
    str_input = "AAAA";
    prepare_copy("AABB");
    str_output = "AAAABBAA";
    make_input(m_FSizeLayer, str_input);
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.paste(2, PasteInfo);
    console.log(str_output);
    m_FSizeLayer.log();
    m_FSizeLayer.undo();
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.redo();
    console.log(str_output);
    m_FSizeLayer.log();


    // case 
    console.log('----------------------')
    str_input = "AAAA";
    prepare_copy("BB");
    str_output = "AABBAA";
    make_input(m_FSizeLayer, str_input);
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.paste(2, PasteInfo);
    console.log(str_output);
    m_FSizeLayer.log();
    m_FSizeLayer.undo();
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.redo();
    console.log(str_output);
    m_FSizeLayer.log();

    // case 
    console.log('----------------------')
    str_input = "AAAA";
    prepare_copy("BBAA");
    str_output = "AABBAAAA";
    make_input(m_FSizeLayer, str_input);
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.paste(2, PasteInfo);
    console.log(str_output);
    m_FSizeLayer.log();
    m_FSizeLayer.undo();
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.redo();
    console.log(str_output);
    m_FSizeLayer.log();

    // case 
    console.log('----------------------')
    str_input = "AAAA";
    prepare_copy("AABBAA");
    str_output = "AAAABBAAAA";
    make_input(m_FSizeLayer, str_input);
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.paste(2, PasteInfo);
    console.log(str_output);
    m_FSizeLayer.log();
    m_FSizeLayer.undo();
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.redo();
    console.log(str_output);
    m_FSizeLayer.log();

    // case 
    console.log('----------------------')
    str_input = "AAAA";
    prepare_copy("BBAABB");
    str_output = "AABBAABBAA";
    make_input(m_FSizeLayer, str_input);
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.paste(2, PasteInfo);
    console.log(str_output);
    m_FSizeLayer.log();
    m_FSizeLayer.undo();
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.redo();
    console.log(str_output);
    m_FSizeLayer.log();

    //
    // 조건 : in-segment offset == 0
    //

    // case 
    console.log('----------------------')
    str_input = "AABB";
    prepare_copy("AA");
    str_output = "AAAABB";
    make_input(m_FSizeLayer, str_input);
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.paste(2, PasteInfo);
    console.log(str_output);
    m_FSizeLayer.log();
    m_FSizeLayer.undo();
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.redo();
    console.log(str_output);
    m_FSizeLayer.log();

    // case 
    console.log('----------------------')
    str_input = "AABB";
    prepare_copy("BB");
    str_output = "AABBBB";
    make_input(m_FSizeLayer, str_input);
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.paste(2, PasteInfo);
    console.log(str_output);
    m_FSizeLayer.log();
    m_FSizeLayer.undo();
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.redo();
    console.log(str_output);
    m_FSizeLayer.log();

    // case 
    console.log('----------------------')
    str_input = "AABB";
    prepare_copy("AABB");
    str_output = "AAAABBBB";
    make_input(m_FSizeLayer, str_input);
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.paste(2, PasteInfo);
    console.log(str_output);
    m_FSizeLayer.log();
    m_FSizeLayer.undo();
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.redo();
    console.log(str_output);
    m_FSizeLayer.log();

    // case 
    console.log('----------------------')
    str_input = "AABB";
    prepare_copy("CC");
    str_output = "AACCBB";
    make_input(m_FSizeLayer, str_input);
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.paste(2, PasteInfo);
    console.log(str_output);
    m_FSizeLayer.log();
    m_FSizeLayer.undo();
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.redo();
    console.log(str_output);
    m_FSizeLayer.log();

    // case 
    console.log('----------------------')
    str_input = "AABB";
    prepare_copy("AACCBB");
    str_output = "AAAACCBBBB";
    make_input(m_FSizeLayer, str_input);
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.paste(2, PasteInfo);
    console.log(str_output);
    m_FSizeLayer.log();
    m_FSizeLayer.undo();
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.redo();
    console.log(str_output);
    m_FSizeLayer.log();

    // case 
    console.log('----------------------')
    str_input = "AABB";
    prepare_copy("AACC");
    str_output = "AAAACCBB";
    make_input(m_FSizeLayer, str_input);
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.paste(2, PasteInfo);
    console.log(str_output);
    m_FSizeLayer.log();
    m_FSizeLayer.undo();
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.redo();
    console.log(str_output);
    m_FSizeLayer.log();

    // case 
    console.log('----------------------')
    str_input = "AABB";
    prepare_copy("CCBB");
    str_output = "AACCBBBB";
    make_input(m_FSizeLayer, str_input);
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.paste(2, PasteInfo);
    console.log(str_output);
    m_FSizeLayer.log();
    m_FSizeLayer.undo();
    console.log(str_input);
    m_FSizeLayer.log();
    m_FSizeLayer.redo();
    console.log(str_output);
    m_FSizeLayer.log();

    function prepare_copy(str_copy) {
        make_input(m_FSizeLayer_Copy, str_copy); //console.log(str_copy);
        m_FSizeLayer_Copy.copy(0, str_copy.length);
        m_FSizeLayer.__copy_from(m_FSizeLayer_Copy.__get_copy_clone());
    }

    function make_input(layer, str) {
        var end_position = layer.getElementTotal();
        layer.erase(0, end_position);

        var attr_fsize_10 = new ATTR_FontSize(10);
        var attr_fsize_20 = new ATTR_FontSize(20);
        var attr_fsize_30 = new ATTR_FontSize(30);

        for (var i = 0; i < str.length; i++) {
            switch (str[i]) {
                case 'A':
                    layer.insert(i, attr_fsize_10);
                    break;
                case 'B':
                    layer.insert(i, attr_fsize_20);
                    break;
                case 'C':
                    layer.insert(i, attr_fsize_30);
                    break;
                default:
                    assert(false);
                    break;
            }
        }
    }
}

-------------------------------------------------------------*/