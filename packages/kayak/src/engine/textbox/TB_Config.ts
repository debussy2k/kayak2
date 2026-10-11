import _g from './TB_PlatformEnv';
import TB_Dom from './TB_Dom';
import { TB_Preference } from "./TB_Preference";
import * as log from "loglevel";
import type { TB_ConfigOptions, PageConfig, ContentConfig, DebugConfig, ResizeOption } from './types';

/*
	interface options {
		schema: boolean,
		mode: string,
		base_node: DomElement,
		element: DomElement,
		page: {
			width:  number, 			// unit:px
			height: number, 			// unit:px
			gutter_top: number,
			gutter_bottom:number ,
			scale: number
		},
		content: {
			width: number,               // unit:px
			default_font_size: number
        },
        font_list_id: string,
        node_env: {
            base_folder_for_download : string   // font파일을 다운로드할 base folder
        }

		masterClipboard: object         //M1TextBox.GT_MasterClipboard.getInstance()
	}
*/

/*
    ## 수평 정보 ##
    |<------------------------------------------------------>|
                         page.width
    |<---->|<---------------------------------------->|<---->|
                        content.width
       ^                                                 ^
       |                                                 |
    computed_page_gutter_left                      computed_page_gutter_left


    ## 수직 정보 ##
    ------------------------  (page top)
    |    page.gutter_top
    ------------------------  (content top)
    |    ...
    ------------------------  (content bottom)
    |    page.gutter_bottom
    ------------------------  (page bottom)
*/

// update_size()가 쓰는 두 필드만 요구한다 (test/textbox/platform_utils.test.js는 가짜 객체를 넘긴다).
type PreferenceLike = Pick<TB_Preference, 'fit_to_content_height' | 'frame_height'>;

class TB_Config {
    mode: string;
    tbpreference: PreferenceLike;
    text_render: string;   // 'html', 'svg'
    text_on_path: any;
    base_node: HTMLElement | null;
    element: HTMLElement | null;
    element_textonpath: HTMLElement | null;
    page: PageConfig;
    content: ContentConfig;
    computed_page_gutter_left: number;
    computed_page_gutter_right: number;
    transform: { angle: number };
    font_list_id: string | null;
    use_embedded_default_font: boolean;
    node_env: { base_folder_for_download?: string };
    linebreak_tolerance: number;
    // schema 모드에서는 아래 셋이 만들어지지 않는다 (생성자가 먼저 return).
    debug!: DebugConfig;
    content_elem!: HTMLElement | null;
    lineview_container_elem!: HTMLElement | null;
    // Object.assign(this, options)로 들어오는 그 밖의 옵션 (masterClipboard 등)
    [key: string]: any;

    constructor(options: TB_ConfigOptions, tbpreference: PreferenceLike) {
        this.mode = "box";
        this.tbpreference = tbpreference;
        // this.text_render = 'html';   // 'html', 'svg'
        this.text_render = 'svg';   // 'html', 'svg'
        this.text_on_path = false;
        this.base_node = null; // 초기에 지정되면 바로 attach 됨.
        this.element = null;
        this.element_textonpath = null;
        this.page = {
                width: 500,
                height: 200,
                gutter_top: 10,
                gutter_bottom: 10,
                scale: 1
            }
            // content is centered in page.
        this.content = {
            width: 400, // layout에 사용되는 width이기도 함.
            default_font_size: 12,
            default_align: 'left',
            default_font_color: {
                rgb:'black',
                cmyk: [0, 0, 0, 100]
            }
        }

        this.computed_page_gutter_left = 0;
        this.computed_page_gutter_right = 0;

        // rotateAt()에 해당하는 정보만 가짐.
        this.transform = {
            angle: 0 // box의 center 기준.
        }

        /* nodejs환경에서 사용하는 값.
            font_list_id
            - node환경에서 다른 font list 정보를 사용하는 경우, 구분자로 사용함
            - edicus에서는 font group id가 사용됨. {font-class}-{div}-{lang} 형태임. 기본은 "default-host-ko"
            - null이면 font list항목의 default 항목을 사용함. (for browser only)
        */
        this.font_list_id = null;

        /*
            값이 true이면
            kayak json의 font_used항목에서 발견되는 default font를 사용함.
            font-class가 변경되더라도 kayak josn에 저장된 default font가 사용되도록 보장함.
        */
        this.use_embedded_default_font = false;

        // node 환경에서만 사용하는 값.
        this.node_env = {};

        /*
            글줄의 마지막 none white space word의 경우, 약간의 차이로 linebreak이 발생하는 것을 방지하는 기능
            - indesign에서는 한 줄에 다 나오지만, kayak에서는 마지막 word가 넘어가는 경우가 있음.
            - 이를 threshold값에 따라 왠만하면 한 줄에 나오도록 보상함.
            - test sample : test_sample/ind_sample_01.json
                설정값 : this.linebreak_tolerance = 0.1;
        */
        this.linebreak_tolerance = 0;   // meta정보에 기록됨. TextBox_InOut.ts 참고.

        // schema 이면 textbox의 logical한 구조만 생성한다.
        if (options.schema) {
            // schema모드에서도 default font를 얻어야 하므로 font_list_id 정보는 전달한다.
            if (options.font_list_id)
                this.font_list_id = options.font_list_id;
            return;
        }

        Object.assign(this, options)


        // for debug options
        // 위의 assign()에서 options.debug까지 미리 복사되지만 무시하고
        // default값에 options.debug를 추가되도록 함
        this.debug = {
            show_linebox : false,    // textline의 경계표시
            show_textonpath_bbox: false,
            show_line_gutter: false
        }
        if (options.debug)
            Object.assign(this.debug, options.debug)



        this.content_elem = null;
        this.lineview_container_elem = null;

        this.build_dom_skelelton();
        this.update_size();

        // MeasureDiv.Instance().show(true); // #kayak_metric_box를 show/hide함.
    }

    update_size(opt?: ResizeOption): void {
        if (opt != undefined) {
            var min_width = 1;
            this.content.width = opt.content.width > min_width ? opt.content.width : min_width;
            this.page.width = opt.page.width > min_width ? opt.page.width : min_width;
        }

        var gutter_side = (this.page.width - this.content.width) / 2;
        this.computed_page_gutter_left = gutter_side;
        this.computed_page_gutter_right = gutter_side;

        // .kayak-page 설정.
        TB_Dom.css(this.element, {
            'width': this.page.width,
            'height': this.tbpreference.fit_to_content_height ? 'auto' : (this.tbpreference.frame_height + 'px'),
            'padding-top': this.page.gutter_top,
            'padding-bottom': this.page.gutter_bottom,
            "transform": "scale(" + this.page.scale + ")",
            "transform-origin": "0 0"
        });

        TB_Dom.css(this.content_elem, {
            'width': this.content.width + 'px',
            'min-height': '4px',
            'margin-left': gutter_side + 'px',
            'margin-right': gutter_side + 'px',
            'border': 'none'
        });
    }

    build_dom_skelelton(): void {
        this.element = _g.document!.createElement('div');
        this.element.className = 'kayak-root'
        if (this.base_node)
            this.base_node.appendChild(this.element);

        // .kayak-content 설정
        var content = TB_Dom.createElement("<div class='kayak-content' ></div>") as HTMLElement;
        this.element.appendChild(content);
        this.content_elem = content;

        content.appendChild(TB_Dom.createElement("<div class='kayak_input_box inline_input'></div>"));

        var cursor = TB_Dom.createElement("<div class='kayak-cursor kayak-blink'></div>") as HTMLElement;
        content.appendChild(cursor);
        TB_Dom.css(cursor, {
            'left': '0px',
            'top': '0px'
        })

        content.appendChild(TB_Dom.createElement("<div class='kayak-selection kayak-sel-begin'></div>"));
        content.appendChild(TB_Dom.createElement("<div class='kayak-selection kayak-sel-end'></div>"));

        var lineview_container = TB_Dom.createElement("<div class='kayak-lineview-container'></div>") as HTMLElement;
        content.appendChild(lineview_container);
        this.lineview_container_elem = lineview_container;

    }

    build_dom_textonpath(): void {
        if (this.element_textonpath) {
            this.base_node!.removeChild(this.element_textonpath);
            this.element_textonpath = null;
        }

        /*
            1. text-on-path 모드에서는 textbox(즉,class=kayak-root)는 숨김.
            2.max-width및 overflow설정 이유 :
            - textbox가 path의 길이만큼 만들어져 의도하지 않은 scroll을 발생시킬 수 있음.
            - 이를 방지하기 위해 max-wdith를 설정함.
        */
        TB_Dom.css(this.element, {
            opacity: 0,
            'max-width': '100px',   // 적당히 작은 값을 설정한 것임.
            overflow: 'hidden'
        })

        this.element_textonpath = _g.document!.createElement('div');
        this.element_textonpath.className = 'kayak-textonpath'

        // .kayak-page 설정.
        let css = {
            'pointer-events': 'none',   // text-on-path에서 outline shape내에서만 mousedown을 받기 위해 설정함.
            position: 'absolute',
            left: '0px',
            top: '0px',
            cursor: 'text'
        };
        if (this.debug.show_textonpath_bbox) {
            Object.assign(css, {
                'outline': '1px solid gray',
            })
        }

        TB_Dom.css(this.element_textonpath, css);

        if (this.base_node)
            this.base_node.appendChild(this.element_textonpath);
    }
}


export default TB_Config;
