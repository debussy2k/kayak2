import GT_PasteInfo from '../../../../src/engine/segment/GT_PasteInfo';
import SEGC from '../../../../src/engine/segment/segment_const';

function SeglayerManager() {
    var SegLayerVec = [];
    var HistoryStack = [];
    var stackPointer = -1;
    var ALL_SEG_LAYERS = 'all';
    var NO_SEG_LAYER = 'none';
    var HistoryLimit = 0; // undo history 최대 항목 수. 0이면 무제한(기본값).

    this.dup = function() {}

    this.get_history_stack_pointer = function() {
        return stackPointer;
    }
    this.get_history_stack = function() {
        return HistoryStack;
    }

    this.add = function(segLayer) {
        if (HistoryLimit > 0)
            segLayer.set_history_limit(HistoryLimit);
        SegLayerVec.push(segLayer);
    }

    /*  undo history의 최대 항목 수를 설정한다. (0 또는 미지정이면 무제한)
        manager와 모든 layer에 같은 값을 적용한다.
        하나의 command는 각 layer에 최대 1개의 history 항목만 남기므로,
        layer가 같은 수만큼 보관하면 manager가 보관한 command는 모두 undo할 수 있다.
    */
    this.set_history_limit = function(limit) {
        HistoryLimit = (limit > 0) ? limit : 0;
        for (var i = 0; i < SegLayerVec.length; i++)
            SegLayerVec[i].set_history_limit(HistoryLimit);
        trim_history_stack();
    }
    this.get_segPar = function() {
        return SegLayerVec[0];
    }
    this.get_segDoc = function() {
        return SegLayerVec[1];
    }

    this.nop = function() {
        //D180421
        addToHistoryStack(NO_SEG_LAYER);
    }

	this.get_curr_history = function() {
		if (stackPointer === -1)
			return null;
		return HistoryStack[stackPointer];
    }
    this.get_next_history = function() {
        if (this.can_redo() == false)
            return null;
		return HistoryStack[stackPointer+1];
	}

	this.can_undo = function() {
		return (stackPointer != -1)
	}
	this.can_redo = function() {
        let nStackSize = HistoryStack.length;
		return !(nStackSize == 0 || stackPointer == nStackSize - 1) 
	}

    /*  
        attr은 2가지 type 으로 옴
        type A: ATTR_FontColor처럼 attribute class자체가 오는 것.
        type B: attrbiute class의 object가 오는 것.
                { "ATTR_FontColor": obj_of_ATTR_FontColor, ...} 
    */
    this.insert = function(pos, attr) {
        for (var i = 0; i < SegLayerVec.length; i++) {
            let obj = null;
            if (attr && attr._attr_class_name)
                obj = SegLayerVec[i].canAccept(attr);           // type-A
            else
                obj = attr[SegLayerVec[i]._attr_class_name];    // type-B

            SegLayerVec[i].insert(pos, obj);
        }
        addToHistoryStack(ALL_SEG_LAYERS);
        return SEGC.OK_ALL;
    }

    this.insert_newline = function(pos, attr) {
        for (var i = 0; i < SegLayerVec.length; i++)
            SegLayerVec[i].insert_newline(pos, SegLayerVec[i].canAccept(attr));
        addToHistoryStack(ALL_SEG_LAYERS);
        return SEGC.OK_ALL;
    }

    /*  insert_string()은 paste()와 거의 동일하다. SegLayerVec[i].paste()를 그대로 사용함을 주의.
     */
    this.insert_string = function(pos, str_arr, attr) {
        for (var i = 0; i < SegLayerVec.length; i++) {
            let obj = null;
            if (attr && attr._attr_class_name)
                obj = SegLayerVec[i].canAccept(attr);           // type-A
            else
                obj = attr[SegLayerVec[i]._attr_class_name];    // type-B


            SegLayerVec[i].insert_string(pos, str_arr, obj);
        }
        addToHistoryStack(ALL_SEG_LAYERS);

        return SEGC.OK_ALL;
    }

    // posEnd를 생략하면 posBegin 위치의 한 글자를 지운다. (layer.erase()와 동일)
    this.erase = function(posBegin, posEnd) {
        for (var i = 0; i < SegLayerVec.length; i++)
            SegLayerVec[i].erase(posBegin, posEnd);
        addToHistoryStack(ALL_SEG_LAYERS);
        return SEGC.OK_ALL;
    }

	/*
		opt.skip
		- true인 경우 연속적인 undo/redo가 가능하게 한다.
	*/
    this.set = function(posBegin, posEnd, attr, setMask, opt) {
        if (attr === null || attr === undefined)
            return SEGC.ERR_ATTRIBUTE_IS_NULL;

        var i, bFound = false;
        var arr = [];
        for (i = 0; i < SegLayerVec.length; i++) {
            if (SegLayerVec[i].canAccept(attr)) {
                SegLayerVec[i].set(posBegin, posEnd, attr, setMask);
                arr.push(SegLayerVec[i]);
                bFound = true;
            }
        }
        if (bFound)
            addToHistoryStack(arr, opt);

        console.assert(bFound, 'shoud be found');
        return SEGC.OK_ALL;
    }

    this.paste = function(pos, non_clipboard_copy_string, pMasterClipboard) {
        // m_seg_mgr의 각 layer가 가지고 있는 local clipboard에 layer data를 주입한다.
        // (이후 paste()호출하면 local clipbaord의 값으로 paste하게 된다.)
        if (pMasterClipboard) {
            // layer 구성이 다른 클립보드는 어떤 layer도 바꾸기 전에 거부한다.
            if (!is_compatible_clipboard(pMasterClipboard))
                return SEGC.ERR_RANGE_EMPTY;
            import_from_clipboard_layer_data(pMasterClipboard);
        }

        var PasteInfo = new GT_PasteInfo;
        for (var i = 0; i < SegLayerVec.length; i++)
            if (SegLayerVec[i].query_if_last_newline_being_erased(pos, pos)) {
                PasteInfo.m_last_newline_being_erased_case = true;
                break;
            }
        PasteInfo.non_clipboard_copy_string = non_clipboard_copy_string.slice(0);

        for (var i = 0; i < SegLayerVec.length; i++)
            SegLayerVec[i].paste(pos, PasteInfo);
        addToHistoryStack(ALL_SEG_LAYERS);

        return SEGC.OK_ALL;
    }

    this.copy = function(posBegin, posEnd) {
        for (var i = 0; i < SegLayerVec.length; i++)
            SegLayerVec[i].copy(posBegin, posEnd);
        return SEGC.OK_ALL;
    }

    this.copy_layer_data = function(posBegin, posEnd, pMasterClipboard) {
        pMasterClipboard.clear_all();

        for (var i = 0; i < SegLayerVec.length; i++) {
            var SegRange = SegLayerVec[i].clone_SegRngCopy();
            pMasterClipboard.m_srv.push(SegRange);
        }
        return SEGC.OK_ALL;
    }

    this.undo = function() {
        var ret = {
            err : SEGC.OK_ALL,
            noop : false
        }

        if (stackPointer == -1) {
            ret.err = SEGC.ERR_BEGIN_OF_HISTORY
            return ret;
        }
        var pSL = HistoryStack[stackPointer].item;
        if (pSL === NO_SEG_LAYER) {
            ret.noop = true;
        }
        else if (pSL === ALL_SEG_LAYERS) {
            for (var i = 0; i < SegLayerVec.length; i++)
                SegLayerVec[i].undo();
        } else if (pSL instanceof Array) {
            for (var i = 0; i < pSL.length; i++)
                pSL[i].undo();
        } else if (pSL)
            ret.err = pSL.undo();

		--stackPointer;
		verify();
        return ret;
    }

    this.redo = function() {
        var ret = {
            err : SEGC.OK_ALL,
            noop : false
        }

        var nStackSize = HistoryStack.length;
        if (nStackSize == 0 || stackPointer == nStackSize - 1) {
            ret.err = SEGC.ERR_END_OF_HISTORY
            return ret;
        }

        ++stackPointer;
        var pSL = HistoryStack[stackPointer].item;
        if (pSL === NO_SEG_LAYER) {
            ret.noop = true;
        }
        else if (pSL === ALL_SEG_LAYERS) {
            for (var i = 0; i < SegLayerVec.length; i++)
                SegLayerVec[i].redo();
        } else if (pSL instanceof Array) {
            for (var i = 0; i < pSL.length; i++)
                pSL[i].redo();
        } else if (pSL)
            ret.err = pSL.redo();

		verify();
        return ret;
    }

    this.reset_history = function() {
        HistoryStack.length = 0;
        stackPointer = -1;

        for (var i = 0; i < SegLayerVec.length; i++)
            SegLayerVec[i].reset_history()
    }

    this.get_attributes_from_seglayer = function(ci_doc, cur_style) {
        // Par layer는 styles 추출 대상에서 제외임. i는 1부터 시작.
        for (var i = 1; i < SegLayerVec.length; i++) {
            var seglayer = SegLayerVec[i];
            seglayer.getAttr_by_gravity(ci_doc, null, function(style) {
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
    this.exctract_style_from_seglayer = function(styles, rng, segVec, style_setter) {
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
        var style_obj = null;
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
     * styles(array임)를 object.pos를 기준으로 정렬 상태를 유지하면서 access
     * @param  {string} styles - Style array. array element should have .pos variable as a sort key.
     * @param  {string} pos - array의 object.pos와 비교되며, 해당 object가 없으면 pos만 멤버로 가진 object를 만들어 리턴함.
     * @return {Object} 최소한 pos 변수를 가져야 함.
     */
    function sa_get(styles, pos) { // sa : sorted array
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
    function sortedIndex(arr, obj, iteratee) {
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
    this.get_span_style_string = function(style_info, context, options) {
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
    this.setByDataObject = function(obj) {
        /* interface obj {
                text_arr: Array<Number>
                text_raw: String
                ATTR_Par: Array<any>        <-- 여기서 부터 사용
                ATTR_FontSize: Array<any>
                ATTR_Bold: Array<any>
                ...
            }
        */
        for (var i = 0; i < SegLayerVec.length; i++) {
            var seglayer = SegLayerVec[i];
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
    this.saveToObject = function(obj) {
        /* obj에 아래 항목을 추가하게 됨.
            {
                ATTR_Par: Array<any>        <-- 여기서 부터 사용
                ATTR_FontSize: Array<any>
                ATTR_Bold: Array<any>
                ...
            }
        */
        for (var i = 0; i < SegLayerVec.length; i++) {
            var seglayer = SegLayerVec[i];
            obj[seglayer._attr_class_name] = seglayer.getDataObject();
        }
    }

    this.extract_styles_except_par_layer = function(styles, rng) {
        // Par layer는 styles 추출 대상에서 제외임. i는 1부터 시작.
        for (var i = 1; i < SegLayerVec.length; i++) {
            var seglayer = SegLayerVec[i];
            this.exctract_style_from_seglayer(styles, rng, seglayer._get_vec(), seglayer._attr_prototype.style_setter);
        }
    }

    this.css_string = function(style_info, context) {
        // Par layer는 styles 추출 대상에서 제외임. i는 1부터 시작.
        for (var i = 1; i < SegLayerVec.length; i++) {
            SegLayerVec[i]._attr_prototype.css_string(style_info, context)
        }
    }

    // ci_doc위치에서의 style 정보를 리턴함
    this.get_style_info = function(ci_doc, cur_style) {
        // Par layer는 styles 추출 대상에서 제외임. i는 1부터 시작.
        for (var i = 1; i < SegLayerVec.length; i++) {
            var seglayer = SegLayerVec[i];
            seglayer.getAttr_by_gravity(ci_doc, null, function(style) {
                seglayer._attr_prototype.style_setter(cur_style, style);
            })
        }
    }


    // private method
    ////////////////////////////////////////////////////////////////////////////////

	this.set_command_option = function(opt) {
		if (opt && opt.command_auto_play != undefined) {
			HistoryStack[stackPointer].command_auto_play = opt.command_auto_play
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
    function addToHistoryStack(pSegLayer, opt) {
		verify();

        if (HistoryStack.length > 0)
            HistoryStack.splice(stackPointer + 1, HistoryStack.length);
        HistoryStack.push({
			item: pSegLayer,
			command_auto_play: (opt && opt.command_auto_play != undefined) ? opt.command_auto_play : null
		});
        ++stackPointer;
        trim_history_stack();
    }

    // 상한을 넘으면 가장 오래된 항목부터 버린다.
    function trim_history_stack() {
        if (HistoryLimit > 0 && HistoryStack.length > HistoryLimit) {
            var nRemove = HistoryStack.length - HistoryLimit;
            HistoryStack.splice(0, nRemove);
            stackPointer = Math.max(stackPointer - nRemove, -1);
        }
    }

    /*  클립보드의 layer data(m_srv)가 현재 layer 구성과 맞는지 검사한다.
        - layer 수가 같아야 하고
        - 내용이 있는 range는 같은 순서의 layer와 attribute class가 같아야 한다.
    */
    function is_compatible_clipboard(pMasterClipboard) {
        var srv = pMasterClipboard.m_srv;
        if (!srv || srv.length !== SegLayerVec.length)
            return false;

        for (var i = 0; i < SegLayerVec.length; i++) {
            if (!srv[i] || !srv[i].m_SegVec)
                return false;
            if (srv[i].m_SegVec.length > 0 &&
                srv[i].m_SegVec[0]._attr_class_name !== SegLayerVec[i]._attr_class_name)
                return false;
        }
        return true;
    }

    function import_from_clipboard_layer_data(pMasterClipboard) {
        for (var i = 0; i < SegLayerVec.length; i++)
            SegLayerVec[i].load_new_SegRngCopy(pMasterClipboard.m_srv[i]);
        return SEGC.OK_ALL;
	}
	
	// 필요할 때만 comment제거하여 사용하기
	function verify() {
		// SegLayerVec.forEach(segLayer => {
		// 	// console.log(segLayer._attr_class_name, segLayer.getLength())
		// 	if (segLayer._attr_class_name == 'ATTR_FontColor')
		// 		console.log(segLayer._attr_class_name, segLayer.getLength(),  segLayer, segLayer._get_vec())
		// })
	}
}

export default SeglayerManager;