import GT_SegRange from "../../../../src/engine/segment/GT_SegRange";
import GT_SegHistory from "../../../../src/engine/segment/GT_SegHistory";
import SEGC from '../../../../src/engine/segment/segment_const';

function GT_segmentLayer_Par(nGravity, attr_class_name, attr_prototype, opt) {
    var _self_layer = this;
    var _nGravity = nGravity;
    this._attr_class_name = attr_class_name;
    this._attr_prototype = attr_prototype;
    /*  _accept_new_line는 ATTR_Par만 true로 설정하여 사용함.
        ATTR_Doc은 특수한 경우로, ATTR_Par와 같은 특성이지만 문서전체를 하나의 attribute로 관리하며
        이를 위해 newline이 발생되지 않도록 한다.
    */    
    var _accept_newline = (opt && opt.accept_newline == false) ? false : true;
    var m_SegRngCopy = new GT_SegRange;

    var m_SegVec = [];

    // for undo/redo
    var m_History = new GT_SegHistory;
    var m_SegRngBefore = new GT_SegRange;
    var m_SegRngAfter = new GT_SegRange;

    this.m_LastAction = null;

    this.get_command_change_info = function(edit_cmd) {
        if (this.m_LastAction == null)
            return null;

        // clone SegRange for prevent unexpected change.
        var change_info = {
            edit_cmd: edit_cmd,
            history_pointer: m_History.getPointer(),
            par_length: m_SegVec.length
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

    function Destruct() {}

    // for debugging
    this.assert = function(expr, obj) {
        console.assert(expr, obj);
    }

    this.set_history_limit = function(limit) {
        m_History.set_history_limit(limit);
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
	
	this.is_last_index = function(index) {
		return index == (m_SegVec.length - 1)
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
        m_SegVec.length = 0;

        arr.forEach(function(data) {
            var obj = factory();
            obj.set(data);
            m_SegVec.push(obj);
        })
    }

    this.canAccept = function(attrObj) {
        return attrObj;
        // if (attrObj === null)
        // 	return null;
        // return (this._attr_class_name === attrObj.constructor.name) ? attrObj : null;
    }

    this.log = function() {
        //console.log('m_SegVec: ', m_SegVec);
        var str = '';
        for (var i = 0; i < m_SegVec.length; i++)
            str += '[m_nLineGap:' + m_SegVec[i].m_nLineGap + ', cnt:' + m_SegVec[i].m_nCount + ']  ';
        console.log(str);

        //m_History.log();
    }

    this.reset_history = function() {
        m_History.reset();
    }

    this.insert = function(nPos, pAttr) {
        var segPos = { pIndex: 0, pOffset: 0 };
        var err_code = getInsertPosition(nPos, segPos);
        var nIndex = segPos.pIndex;
        var nOffset = segPos.pOffset;

        if (err_code === SEGC.OK_ALL) {
            save_undo_info(nIndex, nIndex + 1);
            ++m_SegVec[nIndex].m_nCount;
            save_redo_info(nIndex, nIndex + 1);
        } else if (err_code === SEGC.ERR_SEGVEC_EMPTY) {
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
        this.m_LastAction = m_History.getLastStep();
        return SEGC.OK_ALL;
    }

    this.insert_newline = function(nPos, pAttr) {
        if (_accept_newline == false)
            return this.insert(nPos, pAttr);
        
        var segPos = { pIndex: 0, pOffset: 0 };
        var err_code = getInsertPosition(nPos, segPos);
        var nIndex = segPos.pIndex;
        var nOffset = segPos.pOffset;

        if (err_code == SEGC.OK_ALL) {
            if (nOffset == 0) {
                // pAttr는 호출자가 재사용할 수 있으므로 복제하여 저장한다.
                var attr_obj = (pAttr === undefined || pAttr === null) ? m_SegVec[nIndex].factory() : pAttr.clone();
                save_undo_info(nIndex, nIndex);
                insert_to(nIndex, attr_obj);
                save_redo_info(nIndex, nIndex + 1);
            } else if (nOffset >= m_SegVec[nIndex].m_nCount) {
                // 가장 마지막 위치에 삽입하는 경우.
                var attr_obj = (pAttr === undefined || pAttr === null) ? m_SegVec[nIndex].factory() : pAttr.clone();
                save_undo_info(nIndex + 1, nIndex + 1);
                insert_to(nIndex + 1, attr_obj);
                save_redo_info(nIndex + 1, nIndex + 2);
            } else {
                save_undo_info(nIndex, nIndex + 1);

                var nInsertPos = split(nIndex, nOffset);
                ++m_SegVec[nIndex].m_nCount;
                save_redo_info(nIndex, nIndex + 2);
            }
        } else if (err_code == SEGC.ERR_SEGVEC_EMPTY) {
            _self_layer.assert(pAttr);
            this.insert(nPos, pAttr);
        } else if (err_code == SEGC.OK_NEED_INSERT_SEGMENT_BEFORE) {
            _self_layer.assert(false);
        }

        //_show_vec();
        this.m_LastAction = m_History.getLastStep();
        return SEGC.OK_ALL;
    }

    this.insert_string = function(nPos, str_arr, pAttr) {
        var segPos = { pIndex: 0, pOffset: 0 };
        var err_code = getInsertPosition(nPos, segPos);
        var nIndex = segPos.pIndex;
        var nOffset = segPos.pOffset;

        if (err_code === SEGC.OK_ALL) {
            save_undo_info(nIndex, nIndex + 1);
            m_SegVec[nIndex].m_nCount += str_arr.length;
            save_redo_info(nIndex, nIndex + 1);
        }
        else {
            _self_layer.assert(false);
        }

        this.m_LastAction = m_History.getLastStep();        
        return SEGC.OK_ALL;
    }

    this.erase = function(begin, end) {
        var nPosBegin = begin;
        var nPosEnd = (end == undefined) ? (begin + 1) : end;
        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////
        var segPos_b = { pIndex: 0, pOffset: 0 };
        var segPos_e = { pIndex: 0, pOffset: 0 };
        getPosition(nPosBegin, segPos_b);
        getPosition(nPosEnd, segPos_e);
        var n = segPos_b.pIndex;
        var b_offset = segPos_b.pOffset;
        var m = segPos_e.pIndex;
        var e_offset = segPos_e.pOffset;


        // erase하면 변화되는 segment의 범위를 추적함.
        var chg = { nUndo_Begin: 0, nUndo_End: 0, nRedo_Begin: 0, nRedo_End: 0 };
        get_changes_on_erasing(nPosBegin, nPosEnd, chg);

        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////

        save_undo_info(chg.nUndo_Begin, chg.nUndo_End);

        erase_range(nPosBegin, nPosEnd);
        if (b_offset > 0 && n < m)
            merge_with_next_seg(n, true);
        save_redo_info(chg.nRedo_Begin, chg.nRedo_End);

        //_show_vec();
        this.m_LastAction = m_History.getLastStep();
        return SEGC.OK_ALL;
    }

    this.set = function(nPosBegin, nPosEnd, pAttr, setMask) {
        // 이 함수는 원래 par의 시작과 끝을 항상 지정하여
        // par전체의 attr를 변경하는 식으로 사용되었다.
        // 즉 (1,0)~(2,0)처럼 항상 사용되었으면
        // 그 간접적인 증거는 오른쪽 소스임: MT_ASSERT(b_offset==0 && e_offset==0);

        // par 특성에 맞도록 변화를 추적하여 적용할 것

        var err_code;

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


        // sel은 char단위로 설정되지만, par속성은 par단위로 설정되므로,
        // sel이 포함되는 par의 범위(n~m)를 찾아내어 그것의 속성을 변경한다.
        var real_pIndex = m;
        if (nPosBegin === nPosEnd) { // case-1 : 범위가 없으면 [n, n+1) 범위
            // 문서 끝(total) 위치는 가상의 다음 segment(n == length)를 가리키므로 마지막 par로 본다.
            if (n >= m_SegVec.length)
                n = Math.max(m_SegVec.length - 1, 0);
            real_pIndex = Math.min(n + 1, m_SegVec.length);
        }
        else if (e_offset > 0) // case-2 : 범위가 있고, 해당 par의 0번째 char가 아니면 par의 끝까지 포함.
            real_pIndex = m + 1;
        // console.log(n, b_offset, m, e_offset, real_pIndex);

        /////////////////////////////////////////////////////////////////////
        //MT_ASSERT(b_offset==0 && e_offset==0);
        save_undo_info(n, real_pIndex);
        // pAttr가 "ATTR_Par"이 아닌 경우는, set을 한 범위만 기억하는 것을 의미.
        if (this._attr_class_name === pAttr._attr_class_name) {
            for (var i = n; i < real_pIndex; i++)
                m_SegVec[i].set(pAttr, setMask);
        }
        save_redo_info(n, real_pIndex);

        this.m_LastAction = m_History.getLastStep();
        return SEGC.OK_ALL;
        /////////////////////////////////////////////////////////////////////
    }

    this.query_if_last_newline_being_erased = function(nPosBegin, nPosEnd) {
        // selection block의 끝에 last $가 포함되어 있고, copy block의 끝에 $가 없는 경우
        // 문서의 마지막 $를 유지하기 위한 추가 작업이 필요한 지를 알려줌.
        // par layer에서는 true/false를 리턴할 수 있으며, 
        // 일반 layer에서는 항상 false를 리턴한다.

        var case_happened = false;

        if (nPosEnd == this.getElementTotal() && // selection block이 Last$를 포함하고,
            !m_SegRngCopy.m_last_whole_seg) // copy block의 끝에 $가 없는 경우
            case_happened = true;

        return case_happened;
    }

    this.paste = function(nPos, PasteInfo) {
        var err_code;

        //T10 par layer에서는 last $가 제거되는 경우를 검사하여
        // attr layer에게 그 정보를 넘겨주어야 함.
        PasteInfo.m_last_newline_being_erased_case = this.query_if_last_newline_being_erased(nPos, nPos);

        var segPos = { pIndex: 0, pOffset: 0 };
        err_code = getPosition(nPos, segPos);
        var nSegIndex = segPos.pIndex;
        var nOffset = segPos.pOffset;

        var pSegRngCopy = null;
        var SegRngCopy_Local = new GT_SegRange;
        if (PasteInfo.non_clipboard_copy_string.length > 0) {
            SegRngCopy_Local.make_from_string(PasteInfo.non_clipboard_copy_string, m_SegVec[nSegIndex]);
            pSegRngCopy = SegRngCopy_Local;
        } else
            pSegRngCopy = m_SegRngCopy;

        if (pSegRngCopy.m_SegVec.length == 0)
            return SEGC.ERR_RANGE_EMPTY;


        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////
        var chg = { nUndo_Begin: 0, nUndo_End: 0, nRedo_Begin: 0, nRedo_End: 0 };
        get_changes_on_pasting(pSegRngCopy, nPos, nPos, chg);
        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////

        save_undo_info(chg.nUndo_Begin, chg.nUndo_End);
        paste_operation(pSegRngCopy, nPos, nSegIndex, nOffset);
        save_redo_info(chg.nRedo_Begin, chg.nRedo_End);

        //_show_vec();
        this.m_LastAction = m_History.getLastStep();
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
                if (segPos_b.pIndex == segPos_e.pIndex) {
                    seg.m_nCount = nPosEnd - nPosBegin;
                    m_SegRngCopy.m_first_whole_seg = false;
                } else
                    seg.m_nCount = m_SegVec[i].m_nCount - segPos_b.pOffset;

                m_SegRngCopy.m_SegVec.push(seg);
            } else if (i == segPos_e.pIndex) {
                if (segPos_e.pOffset > 0) {
                    //GT_Segment seg(m_SegVec[i].m_pAttribute);
                    var seg = m_SegVec[i].factory(); //D
                    seg.m_nCount = segPos_e.pOffset;
                    m_SegRngCopy.m_SegVec.push(seg);
                    m_SegRngCopy.m_last_whole_seg = false;
                } else {
                    if (segPos_e.pOffset == 0)
                        m_SegRngCopy.m_last_whole_seg = true;
                }
            } else {
                m_SegRngCopy.m_SegVec.push(m_SegVec[i].clone());
            }
        }

        if (m_SegRngCopy.m_first_whole_seg == false && segPos_b.pIndex < segPos_e.pIndex)
            _self_layer.assert(false);


        if (segPos_b.pIndex == segPos_e.pIndex)
            m_SegRngCopy.m_last_whole_seg = m_SegRngCopy.m_first_whole_seg;

        return SEGC.OK_ALL;
    }

    this.undo = function(callback) {
        // C++ source와는 조금 다르게 구현.
        var SegHistoryInfo = m_History.getPrevStep();
        if (SegHistoryInfo) {
            erase_with(SegHistoryInfo.m_pSegRngAfter);
            insert_with(SegHistoryInfo.m_pSegRngBefore);
            //_show_vec();

            this.m_LastAction = SegHistoryInfo;
            return SEGC.OK_ALL;
        }

        return SEGC.ERR_BEGIN_OF_HISTORY;
    }
    this.redo = function(callback) {
        var SegHistoryInfo = m_History.getNextStep();
        if (SegHistoryInfo) {
            erase_with(SegHistoryInfo.m_pSegRngBefore);
            insert_with(SegHistoryInfo.m_pSegRngAfter);
            //_show_vec();

            this.m_LastAction = SegHistoryInfo;
            return SEGC.OK_ALL;
        }

        return SEGC.ERR_END_OF_HISTORY;
    }

    this.getAttr_by_pi = function(par_index) {
        return m_SegVec[par_index];
    }
    this.getAttr = function(nPos, seg_info, callback) {
        if (m_SegVec.length == 0)
            return null;

        var nUpperBound = 0;
        for (var i = 0; i < m_SegVec.length; i++) {
            nUpperBound += m_SegVec[i].m_nCount;
            if (nPos < nUpperBound) {
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


    //////////////////////////////////////////////////////////////////////////////////////
    // private: 
    //////////////////////////////////////////////////////////////////////////////////////

    var getPosition = function(nPos, segPos, last_element_pos_as_new_seg) {
        var _last_element_pos_as_new_seg = (last_element_pos_as_new_seg === undefined) ? true : last_element_pos_as_new_seg;
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
            // GT_SegLayerh의 getPosition()와는 다른 구현임.
            // nPos가 끝단일 경우 nPos가 있는 마지막 segment의 마지막 offset을 리턴하도록 함.
            // par의 경우 segment 끝에 있는 '\n'에 따라서만 segment의 끝으로 인식하기 때문임.
            // "Last $"처리를 위해 가장 끝의 위치는 offset이 0이 안되도록 함.

            if (_last_element_pos_as_new_seg) {
                segPos.pIndex = i;
                segPos.pOffset = 0;
            } else {
                segPos.pIndex = i - 1;
                segPos.pOffset = m_SegVec[i - 1].m_nCount;
            }
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


        // erase하면 변화되는 segment의 범위를 추적함.
        if (b_offset > 0 && e_offset > 0) {
            chg.nUndo_Begin = n;
            chg.nUndo_End = m + 1;
            chg.nRedo_Begin = n;
            chg.nRedo_End = n + 1;
        } else if (b_offset > 0 && e_offset == 0) {
            if (m_SegVec.length == m) {
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

    var get_changes_on_pasting = function(pSegRngCopy, nPosBegin, nPosEnd, chg) {
        // chg = {nUndo_Begin, nUndo_End, nRedo_Begin, nRedo_End}

        var err_code = SEGC.OK_ALL;

        //B10 /////////////////////////////////////////////////////////////////////
        if (nPosBegin == _self_layer.getElementTotal()) {
            _self_layer.assert(false);
        }
        //B10 /////////////////////////////////////////////////////////////////////
        else {
            var segPos_b = { pIndex: 0, pOffset: 0 };
            var err_code = getPosition(nPosBegin, segPos_b);
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
                _self_layer.assert(count_of_copied_seg > 1);
                chg.nRedo_Begin = nSegIndex;
                chg.nRedo_End = nSegIndex + count_of_copied_seg;
            } else {
                chg.nRedo_Begin = nSegIndex;
                chg.nRedo_End = nSegIndex + count_of_copied_seg + 1;
            }
        }

        return err_code;
    }

    var paste_operation = function(pSegRngCopy, nPosBegin, nSegIndex, nOffset) {
        var err_code;
        var nInsertPos;

        var count_of_copied_seg = pSegRngCopy.m_SegVec.length;

        //B10 /////////////////////////////////////////////////////////////////////
        if (nPosBegin == _self_layer.getElementTotal()) {
            _self_layer.assert(false);
        }
        //B10 /////////////////////////////////////////////////////////////////////
        else {
            if (nOffset > 0 && pSegRngCopy.m_first_whole_seg == true)
                nInsertPos = split(nSegIndex, nOffset);

            for (var i = count_of_copied_seg - 1; i >= 0; i--) {
                if (nOffset > 0) {
                    if (i == 0) {
                        if (pSegRngCopy.m_first_whole_seg == false) {
                            m_SegVec[nSegIndex].m_nCount += pSegRngCopy.m_SegVec[0].m_nCount;
                        } else if (pSegRngCopy.m_first_whole_seg == true) {
                            insert_to(nInsertPos, pSegRngCopy.m_SegVec[i].clone());
                            merge_with_next_seg(nInsertPos - 1, true);
                        }
                    } else if (i == count_of_copied_seg - 1) {
                        insert_to(nInsertPos, pSegRngCopy.m_SegVec[i].clone());
                        if (pSegRngCopy.m_last_whole_seg == false)
                            merge_with_next_seg(nInsertPos, true);
                    } else
                        insert_to(nInsertPos, pSegRngCopy.m_SegVec[i].clone());
                } else {
                    if (i == 0 && pSegRngCopy.m_first_whole_seg == false)
                        m_SegVec[nSegIndex].m_nCount += pSegRngCopy.m_SegVec[0].m_nCount;
                    else if (i == count_of_copied_seg - 1) {
                        insert_to(nSegIndex, pSegRngCopy.m_SegVec[i].clone());
                        if (pSegRngCopy.m_last_whole_seg == false)
                            merge_with_next_seg(nSegIndex, true);
                    } else
                        insert_to(nSegIndex, pSegRngCopy.m_SegVec[i].clone());
                }
            }
        }
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

    var merge_with_next_seg = function(nSegIndex, force_merge) {
        if (nSegIndex == m_SegVec.length - 1)
            return SEGC.ERR_OUT_OF_RANGE;
        if (nSegIndex < 0)
            return SEGC.ERR_OUT_OF_RANGE;

        if (force_merge) {
            m_SegVec[nSegIndex].m_nCount += m_SegVec[nSegIndex + 1].m_nCount;
            erase_and_free_segment(nSegIndex + 1);
            return SEGC.OK_SEGMENT_MERGED;
        }

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

        if (nPosBegin == nPosEnd)
            return SEGC.OK_ALL;

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

        // console.log('>before[',m_SegRngBefore.m_nFirstSegIndex, ',', m_SegRngBefore.m_nLastSegIndex, ']');
        // console.log('>after[',m_SegRngAfter.m_nFirstSegIndex, ',', m_SegRngAfter.m_nLastSegIndex, ']');

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

} // end of GT_segmentLayer_Par

export default GT_segmentLayer_Par;










//doTest();
// function doTest() {
//     var m_Par = new GT_segmentLayer_Par(SEGC.GRAVITY_RIGHT);
//     var m_Par_Copy = new GT_segmentLayer_Par(SEGC.GRAVITY_RIGHT);

//     var str_input, str_copy, str_output;
//     var PasteInfo = new GT_PasteInfo;

//     m_Par.log();

//     // case 1A
//     str_input = "AA$"; // 
//     prepare_copy("BB$");
//     str_output = "AAAA$"; // 실제: AABB$

//     make_input(m_Par, str_input);
//     console.log(str_input);
//     m_Par.log();
//     m_Par.paste(2, PasteInfo);
//     console.log(str_output);
//     m_Par.log();
//     console.assert(PasteInfo.m_last_newline_being_erased_case == false);
//     m_Par.undo();
//     console.log(str_input);
//     m_Par.log();
//     m_Par.redo();
//     console.log(str_output);
//     m_Par.log();



//     // case 1A
//     str_input = "AA$"; // 
//     prepare_copy("BB$CC$");
//     str_output = "AAAA$AA$"; // 실제: AABB$

//     make_input(m_Par, str_input);
//     console.log(str_input);
//     m_Par.log();
//     m_Par.paste(2, PasteInfo);
//     console.log(str_output);
//     m_Par.log();
//     console.assert(PasteInfo.m_last_newline_being_erased_case == false);
//     m_Par.undo();
//     console.log(str_input);
//     m_Par.log();
//     m_Par.redo();
//     console.log(str_output);
//     m_Par.log();


//     // case 2A
//     str_input = "AABB$CC$"; // 
//     //prepare_copy("BB");
//     //str_output = "AAAA$";	// 실제: AABB$

//     make_input(m_Par, str_input);
//     console.log(str_input);
//     m_Par.log();
//     m_Par.copy(2, 5);
//     m_Par.log();
//     m_Par.paste(4, PasteInfo);
//     m_Par.log();




//     function prepare_copy(str_copy) {
//         // GT_SegRangeT::m_first_whole_seg, GT_SegRangeT::m_last_whole_seg 값이 제대로 설정되도록 하기 위해
//         // str_copy의 끝에 $를 추가하고 그 직전까지가 copy block이 되도록 한다.
//         //str_copy += '$';

//         make_input(m_Par_Copy, str_copy); //console.log(str_copy);
//         m_Par_Copy.copy(0, str_copy.length);
//         m_Par.__copy_from(m_Par_Copy.__get_copy_clone());
//     }

//     function make_input(layer, str) {
//         var end_position = layer.getElementTotal();
//         if (end_position > 0)
//             layer.erase(0, end_position);

//         var attr_par = new ATTR_Par(10);

//         var count = str.length;
//         for (var i = str.length - 1; i >= 0; --i) {
//             switch (str[i]) {
//                 case '$':
//                     layer.insert_newline(0, attr_par);
//                     break;
//                 default:
//                     layer.insert(0, attr_par);
//                     break;
//             }
//         }
//     }
// }