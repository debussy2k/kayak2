import { TB_InDesignJsonConverter } from './TB_InDesignJsonConverter';
import _g from './TB_PlatformEnv';
import { spFontManager } from './TB_FontManager';
import { TB_SvgLineFactory } from './TB_SvgLineFactory';
import { Textbox_Verify } from './Textbox_Verify';
import { TB_LayoutWalker } from './TB_layoutWalker'
import { TB_SvgGradientFactory } from './TB_SvgGradientFactory'
import { TB_TextFxService } from './services/TB_TextFxService'
import { getMaxStrokeWeightPx, getBBoxFromSvgDPath } from './inout/inout'


import cloneDeep from 'lodash/cloneDeep';
import debounce from 'lodash/debounce';

import * as log from "loglevel";
import type { TextBoxHost, FontItem, FontList, KayakJsonObject, FrameSize, SvgSnapshotData, TextFxResult,
    LoadJsonOptions, LoadJsonResult, FontEnvOptions, UsedFontItem, UsedFontListInfo, UsedColor,
    SnapshotSvgOptions, SnapshotSvgCallback, ContentBBox, ContentBBoxSvg, SvgInBoxResult, MirrorOptions, IndTextFrame, IndConvertOptions, IndConvertResult } from './types';


export class TextBox_InOut {
    tb: TextBoxHost;
    schema_only: boolean;
    verify: Textbox_Verify;
    layoutWalker: TB_LayoutWalker;
    mirror_debounce: (opt: MirrorOptions) => void;

    constructor(tb: TextBoxHost) {
        this.tb = tb;
        this.schema_only = this.tb.tb_schema ? false : true;
        this.verify = new Textbox_Verify();
        this.layoutWalker = new TB_LayoutWalker(tb)

        this.mirror_debounce = debounce(this._mirror,
            300,
            // { 'maxWait': 1000 } // 1000ms마다 call됨.
        )
    }

    /* 
        font로딩 관련 노트
        - kayak josn에서 obj.ATTR_FontFamily항목을 읽어 사용된 폰트 내역을 만듦
        - obj.font_used에는 사용된 font의 url과 issue이 있다. 이 정보가 없으면 font loader가 font-group-id를 통해 url과 issue를 확보한다.
        - 즉 obj.font_used이 없어도 로딩이 되며, 다만 지정된 font group에서 폰트가 없으면 문제가 된다.(default로 지정된 폰트를 사용하게 됨)
    */
    loadFromJson(json_str: string, opt?: LoadJsonOptions): Promise<LoadJsonResult> {
        let tb = this.tb;

        tb.reset_all();

        var obj: KayakJsonObject = JSON.parse(json_str);
        let verify_result = this.verify.run(obj, {
            try_fix: true,
            tb: tb
        });
        if (verify_result.code != 'pass') {
            log.error('verify_result:', verify_result)
        }

        // this.setup_base_scale_x(obj);

        if (obj.text_arr.length == 0) {
            log.error('invalid kayak json.')
            return new Promise((resolve, reject) => {
                resolve({
                    warning: 'invalid kayak json.'
                })
            })
        }

        this.tb.tbpreference.set_legacy_181028(obj.version)

        this._applyMetaInfo(obj.meta);

        // obj.text_on_path : {svg_path_data, align_to_path}
        if (obj.text_on_path) {
            if (opt && opt.remove_textonpath_if_already_exist && opt.ignore_text_on_path !== true)
                tb.init_textonpath(obj.text_on_path);
        }


        let used_font_unique_set = this._get_used_fonts_set(obj);
        // console.log(`${used_font_unique_set.length} fonts to be loaded.`)

        // obj.font_used에서 font_list에 없는 폰트가 있으면 주입한다.
        tb.fontloader!.add_foreign_fonts(obj.font_used!, used_font_unique_set)

        // kayak json에 저장된 font_used항목에 있는 default font를 사용하는 경우 설정됨.
        this._set_document_default_font(used_font_unique_set);

        return tb.fontloader!.load_fonts(used_font_unique_set).then(_ => {
            tb.text_core.m_text = obj.text_arr.slice(0);

            //D Layer
            tb.seg_mgr.setByDataObject(obj);
			
			tb.docFactory!.styleSerivce.tofuService.clear_default_font_used_flag();

            tb.layout!.do_layout_all();
            tb.tbcursor.repaint(); // 초기 커서 위치 갱신

            /////////////////////////////////
            if (obj.preference) {
                tb.tbpreference.apply(obj.preference);
            }
            /////////////////////////////////
			
            tb.document_changed({
                cmd: 'loadFromJson'
            });

            return {
                verify_result: verify_result,
				default_font_used: tb.docFactory!.styleSerivce.tofuService.default_font_used
            }
        })
    }

    // setup_base_scale_x(json_obj) {
    //     let val = json_obj.ATTR_LetterScaleX[0].letter_scale_x;
    //     this.tb.format_service.set_base_letter_scale_x(val);
    // }

    _set_document_default_font(uniqueSet: UsedFontItem[]): void {
        let item: UsedFontItem | null | undefined = null;
        let arr: UsedFontItem[] | null = this.tb.tbconfig.use_embedded_default_font ? uniqueSet : null;
        if (arr) {
            item = arr.find(item => item.default);
            if (item == undefined)
                log.warn("No embedded default font was found.")
        }
        this.tb.fontloader!.set_document_default_font(item)

        // TB_SvgLineFactory는 default_font를 가지고 있으므로, 
        // _set_document_default_font()호출뒤에 갱신해 주어야 한다.
        this.tb.docFactory!.update_default_font_state();
    }

    _get_used_fonts_set(obj: KayakJsonObject): UsedFontItem[] {
            let arr: UsedFontItem[];

            let latest = false;
            if (obj.font_used) {
                let keys = Object.keys(obj.font_used);
                if (keys.length > 0)
                    latest = true;
            }

            // obj.font_used가 없이 저장된 예전 버전의 kayak을 위한 처리
            if (latest)
                arr = this._get_used_fonts_set__latest_kayak(obj);
            else
                arr = this._get_used_fonts_set__legacy_kayak(obj);

            return arr;
        }
        // obj.font_used가 있으면 이것만 활용한다. (font used는 최신의 kayak에 추가된 기능)
    _get_used_fonts_set__latest_kayak(obj: KayakJsonObject): UsedFontItem[] {
            let arr: UsedFontItem[] = [];
            Object.keys(obj.font_used!).forEach(fn_key => {
                let styleObj = obj.font_used![fn_key].style;
                Object.keys(styleObj).forEach(ts_key => { //ts_key = "typeStype key"
                    let val: UsedFontItem = {
                        familyName: fn_key,
                        typeStyle: ts_key,
                        url: styleObj[ts_key].url,
                        issue: styleObj[ts_key].issue
                    };

                    // kayak doc에 있는 폰트 정보만으로 폰트를 처리할 때 필요한 default font 임.
                    if (styleObj[ts_key].default == true)
                        val.default = true;
                    arr.push(val);
                })
            })

            return arr;
        }
        // obj.font_used가 없는 예전 버전으로 저장된 것 까지 포함한 버전
    _get_used_fonts_set__legacy_kayak(obj: KayakJsonObject): UsedFontItem[] {
        let fontArr: any = [];   // 원본은 배열을 string key 객체로 쓴다
        obj.ATTR_FontFamily.forEach((item: { familyName: string; typeStyle: string }) => {

            let val: UsedFontItem = {
                familyName: item.familyName,
                typeStyle: item.typeStyle,
                url: null,
                issue: null,
                default: false
            };
            if (obj.font_used) {
                let tmp = obj.font_used[item.familyName];
                if (tmp && tmp.style[item.typeStyle]) {
                    val.url = tmp.style[item.typeStyle].url;
                    val.issue = tmp.style[item.typeStyle].issue;

                    if (tmp.style[item.typeStyle].default == true)
                        val.default = true;
                }
            }

            let key = item.familyName + item.typeStyle;
            fontArr[key] = val;
        })

        // Object에서 Array로 변환
        let uniqueSet = Object.keys(fontArr).map(key => fontArr[key]);
        return uniqueSet;
    }


    /*
        fontEnv : {
            font_list: ...
        }
    */
    saveAsJson(fontEnv?: FontEnvOptions): KayakJsonObject {
        let tb = this.tb;

        let fl = this.gather_used_font_list_info(fontEnv)
        var obj: KayakJsonObject = {
            version: tb.version,
            meta: this._generateMetaInfo(),
            preference: tb.tbpreference.save(),
            text_arr: tb.text_core.m_text,
            text_raw: tb.text_core.toRawString(),
            font_used: fl.used_fonts
        };
        if (fl.unresolved_fonts.length > 0)
            obj['fonts_unresolved'] = fl.unresolved_fonts

        //D Layer
        tb.seg_mgr.saveToObject(obj);

        if (tb.text_on_path) {
            obj['text_on_path'] = tb.text_on_path.save();
        }

        // console.log('Textbox JSON Object -----')
        // console.log(obj);
        // console.log(JSON.stringify(obj));

        let veify_result = this.verify.verify_saved_json(obj);
        if (veify_result.code != 'pass') {
            log.error("result.data:", veify_result.data);
            log.error("result.error_message:", veify_result.error_message);
            // alert(`fail to save. message:"${veify_result.error_message}"`)
        }

        // let has_error = this.verify_saved_json(obj)
        // if (has_error) {
        //     alert('fail to save. message:"${has_error.error}"')
        // }
        return obj;
    }

    verify_saved_json(json_obj: Record<string, any>): { error: string } | null {
        let keys = Object.keys(json_obj)
        let ret: { error: string } | null = null;
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            if (key.substr(0, 5) == 'ATTR_') {
                if (json_obj[key].length == 0) {
                    ret = {
                        error: `${key} is empty`
                    }
                    break;
                }
            }
        }
        return ret;
    }



    _applyMetaInfo(meta?: KayakJsonObject['meta']): void {
        if (meta == undefined)
            return;
        if (meta.linebreak_tolerance != undefined)
            this.tb.tbconfig.linebreak_tolerance = meta.linebreak_tolerance;
    }
    _generateMetaInfo(): { linebreak_tolerance: number } {
        let meta = {
            linebreak_tolerance: this.tb.tbconfig.linebreak_tolerance
        };
        return meta;
    }


    /* 
        opt : {
			path_only : boolean,
			shadow_as_image : boolean,	// 이 경우 callback이 발생한다.
			cropbox: {x, y, w, h}, 		// unit:px. viewbox_offset과 함께 사용하지 못한다.
		}
		
		opt.shadow_as_image 관련 노트
			주요 목적 
			- textbox를 svg로 생성시, 적용된 shadow를 png 파일로 생성하여 구성함.
			- redprint의 경우 최종 결과물을 svg로 만들어 주고, 이것을 pdf로 변환하는데 shadow는 이미화 되어 있어야 함.

			기능노트
			- opt.shadow_as_image가 true이면 callback(shadow_info_arr)이 호출됨.
			- shadow_info_arr를 이용하여 shadow png image를 생성해야 함.
			- doc2svg에서 shadow를 png로 생성하여 svg를 구성하는 데에 사용함.
    */
    snapshotAsSVG(opt?: SnapshotSvgOptions, callback?: SnapshotSvgCallback): string {
        let svg: string | null = null;
        let shadow_info_arr: TextFxResult['shadow_info_arr'];
        let frame: FrameSize;

        /*
        	편집이 발생한 직후, snapshotAsSVG()를 하면 vertical align값이 계산안되는 경우가 있음.
        	즉, 편집이 발생하면 text frame 크기가 변하고 TB_Preference.on_dimension_changed()이 불리면서
        	calc_vertical_align()가 호출되는데, 이것이 호출되기 전에 snapshotAsSVG()이 호출될 수 있어 계산을 미리 한다.

        	이 부분은 문제점이므로, 아래 처럼 호출하지 않도록 수정할 것.

        */
        this.tb.tbpreference.calc_vertical_align();

        if (this.tb.text_on_path)
            svg = this.snapshotAsSVG_textonpath(opt);
        else {
            // opt.shadow_as_image == true인 경우에만 callback이 유효함
            ({ svg, shadow_info_arr, frame } = this.snapshotAsSVG_textbox(opt));
            callback && callback(shadow_info_arr, frame);
        }

        return svg;
    }
    snapshotAsSVG_textbox(opt?: SnapshotSvgOptions): { svg: string; shadow_info_arr: TextFxResult['shadow_info_arr']; frame: FrameSize } {
        let full_svg = '';
        let shadow_info_arr: TextFxResult['shadow_info_arr'] = [];

        let dim = this.tb.get_dimension();
        /*
            param 
                data: { x, y, line, index }
            return
                { page_width, page_height}
        */
        let frame = this.layoutWalker.traverse_by_line(data => {});

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        this.layoutWalker.traverse_by_line(data => {
			minX = Math.min(minX, data.x);

            full_svg += TB_SvgGradientFactory.build_gradient_defs(data, dim);
			
			let svg_paths = data.line.svg_paths;
			if (opt && opt.render_master_color_only)
				svg_paths = data.line.svg_paths.filter(svg_path => svg_path.fill == opt.render_master_color_only!.fill)

			let r = TB_TextFxService.generate_svg_path_string(svg_paths, data.line.uuid, data.line, opt);
			// opt.shadow_as_image가 true인 경우에만 r.shadow_info_arr가 유효하다.
			shadow_info_arr = shadow_info_arr.concat(r.shadow_info_arr);

			let x = data.x;
			let y = data.y;
			if (opt && opt.cropbox) {
				x -= opt.cropbox.x;
				y -= opt.cropbox.y;				
			}
			if (opt && opt.padding) {
				x += opt.padding[0]; // left
				y += opt.padding[1]; // top
			}

            full_svg += `<g transform="translate(${x} ${y})">${r.svg_string}</g>`
        })


        // display:block을 만드시 할 것. <svg>에서 display속성을 주지 않으면 이상한 height가 나오니 주의할 것.
        let svg_style = 'display:block; overflow:visible';
        // svg_style += 'outline:1px solid lightgray';

        if (opt && opt.path_only) {
            // do nothing
        } else {
            if (opt && opt.viewbox_offset !== undefined) {
                let offset = opt.viewbox_offset;
                let bbox = this.getBbox(frame.frame_width, frame.frame_height, opt.viewbox_offset)
				let bbox_w = bbox.w;
				let bbox_h = bbox.h;
				if (opt.fix_20210402) {
					bbox_w -= offset.x;
					bbox_h -= offset.y;
				}
				
                full_svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${bbox_w}" height="${bbox_h}" viewBox="${offset.x} ${offset.y} ${bbox.w} ${bbox.h}"  style='${svg_style}'>
                    ${full_svg}
                </svg>
                `
            } else {
				let width = frame.frame_width;
				let height = frame.frame_height;
				// 만약 cropbox가 지정되어 있으면 그것을 사용한다.
				if (opt && opt.cropbox) {
					width = opt.cropbox.w;
					height = opt.cropbox.h;
				}
				if (opt && opt.padding) {
					width += opt.padding[0] + opt.padding[2]; // left + right
					height += opt.padding[1] + opt.padding[3]; // top + bottom
				}


                // local image를 포함하기 위해서는 xmlns:xlink 정의를 해 주어야 한다.
                full_svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style='${svg_style}'>
                    ${full_svg}
                </svg>
                `
            }
        }

        return { svg: full_svg, shadow_info_arr, frame };
    }

    snapshotAsSVG_textonpath(opt?: SnapshotSvgOptions): string {
        let svg_str = this.tb.text_on_path!.tp_draw.get_svg_for_render(opt);

        if (opt && opt.path_only) {
            return svg_str;
        }

        let frame = this.layoutWalker.traverse_by_line(data => {});
		let width = frame.frame_width;
		let height = frame.frame_height;
		// 만약 cropbox가 지정되어 있으면 그것을 사용한다.
		if (opt && opt.cropbox) {
			width = opt.cropbox.w;
			height = opt.cropbox.h;
		}
		if (opt && opt.padding) {
			width += opt.padding[0] + opt.padding[2]; // left + right
			height += opt.padding[1] + opt.padding[3]; // top + bottom
		}

		// display:block을 만드시 할 것. <svg>에서 display속성을 주지 않으면 이상한 height가 나오니 주의할 것.
		let svg_style = 'display:block; overflow:visible';
		let full_svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" style='${svg_style}'>
			${svg_str}
		</svg>
		`

        return full_svg;
    }


    // 
    /*
		svg의 모든 내용이 box내에 있도록 렌더링하기
		- 적용된 stroke weight중 가장 큰 값을 기준으로 크기를 늘린다.
		- 글줄 상단의 embox_height_offset_px값을 포함한다.
   */
    snapshotAsSVGInBox(): SvgInBoxResult {
        let max_offset_pt = 0;

        var obj = this.snapshotAsSVGData();
        obj.svg_path_info.forEach(path_info => {
            path_info.svg_paths.forEach(svg_path => {
                if (svg_path.stroke!.align == 'center')
                    max_offset_pt = Math.max(svg_path.stroke!.weight / 2, max_offset_pt);
                else if (svg_path.stroke!.align == 'outside')
                    max_offset_pt = Math.max(svg_path.stroke!.weight, max_offset_pt);
            })
        })

        // console.log(max_offset_pt);

        let pt2px = 96 / 72;
		/*
			fix_20210402 설명
			- "Spoqa Han Sans / Regular"폰트에서 snapshotAsSVGInBox()를 호출하면 
			  svg의 width/height와 그것의 viewbox width/height가 차이 나는 부분을 보정함.
			- 다른 부작용 있는지 체크할 것.
			- snapshotAsSVGInBox()함수는 Edicus 스티커 생성시에만 사용하고 있으므로 임시방편으로 수정하여 사용함.
		*/
        let opt = {
            viewbox_offset: {
                x: -(max_offset_pt * pt2px),
                y: -(max_offset_pt * pt2px - this.tb.tbpreference.computed_values.embox_height_offset_px)
            },
			fix_20210402:true 
        }
        var svg_str = this.snapshotAsSVG(opt);
        // console.log(svg_str)

        return {
            svg_str, // svg string
            frame: { w: obj.frame_width, h: obj.frame_height }, // textbox의 width, height
            viewbox_offset: opt.viewbox_offset, // stroke weight가 고려된 viewbox origin 값
            bbox: this.getBbox(obj.frame_width, obj.frame_height, opt.viewbox_offset) // 새로 만들어진 svg를 포함한 bounding box
        }
    }

    getBbox(frame_w: number, frame_h: number, viewbox_offset: { x: number; y: number }): { w: number; h: number } {
        return {
            w: frame_w - (2 * viewbox_offset.x),
            h: frame_h - (2 * viewbox_offset.y),
        }
    }



    /////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////
	/*
		opt: {
			render_master_color_only : { fill }
		}
	*/
    snapshotAsSVGData(opt?: SnapshotSvgOptions): SvgSnapshotData {
        /*
        	편집이 발생한 직후, snapshotAsSVG()를 하면 vertical align값이 계산안되는 경우가 있음.
        	즉, 편집이 발생하면 text frame 크기가 변하고 TB_Preference.on_dimension_changed()이 불리면서
        	calc_vertical_align()가 호출되는데, 이것이 호출되기 전에 snapshotAsSVG()이 호출될 수 있어 계산을 미리 한다.

        	이 부분은 문제점이므로, 아래 처럼 호출하지 않도록 수정할 것.
        */
        this.tb.tbpreference.calc_vertical_align();

        let obj: SvgSnapshotData | null = null;
        if (this.tb.text_on_path)
            obj = this.snapshotAsSVGData_textonpath(opt);
        else
            obj = this.snapshotAsSVGData_textbox(opt);

        let max_offset_pt = 0;
        if (!this.tb.text_on_path) {
            obj.svg_path_info.forEach(item => {
                item.svg_paths.forEach(svg_path => {
                    if (svg_path.stroke!.align == 'center')
                        max_offset_pt = Math.max(svg_path.stroke!.weight / 2, max_offset_pt);
                    else if (svg_path.stroke!.align == 'outside')
                        max_offset_pt = Math.max(svg_path.stroke!.weight, max_offset_pt);
                })
            })
        }

        // svg_paths를 특정 색상으로 override한다.
        if (opt && opt.override_fill_color) {
            let transparent_by_src_color = opt.override_fill_color.transparent_by_src_color || [];
            obj.svg_path_info.forEach(item => {
                item.svg_paths = cloneDeep(item.svg_paths) // 원본 데이터에 지장을 주지 않기 위해.
                item.svg_paths.forEach(svg_path => {
                    let color_skip = transparent_by_src_color.find(val => val == svg_path.fill) !== undefined;
                    svg_path.fill = color_skip ? 'none' : opt.override_fill_color!.fill;
                    svg_path.fill_cmyk = opt.override_fill_color!.fill_cmyk;
                })
            })
        }

        let pt2px = 96 / 72;
        obj.viewbox_offset = {
            x: -(max_offset_pt * pt2px),
            y: -(max_offset_pt * pt2px - this.tb.tbpreference.computed_values.embox_height_offset_px)
        };
        obj.bbox = this.getBbox(obj.frame_width, obj.frame_height, obj.viewbox_offset);
        return obj;
    }

    snapshotAsSVGData_textbox(opt?: SnapshotSvgOptions): SvgSnapshotData {
        let ret: SvgSnapshotData = {  
            frame_width: 0,
            frame_height: 0,
            svg_path_info: []
        };

        /*
            param 
                data: { x, y, line, index }
            return
                { frame_width, frame_height}
        */
        let frame = this.layoutWalker.traverse_by_line(data => {
            /*
                data.line.svg_paths : [{
                    d : string,
                    fill : string,
                    fill_cmyk : [c,m,y,k]
                }, 
                ...]
            */

		   let svg_paths = data.line.svg_paths;
		   if (opt && opt.render_master_color_only)
			   svg_paths = data.line.svg_paths.filter(svg_path => svg_path.fill == opt.render_master_color_only!.fill)

            ret.svg_path_info.push({
                x: data.x,
                y: data.y,
                svg_paths: svg_paths
            })
        })

        ret.frame_width = frame.frame_width;
        ret.frame_height = frame.frame_height;

        return ret;
    }

    snapshotAsSVGData_textonpath(opt?: SnapshotSvgOptions): SvgSnapshotData {
        let single_svg_path_info = this.tb.text_on_path!.tp_draw.get_svg_data_for_pdf(opt);

        let obj: SvgSnapshotData = {
            frame_width: 0,
            frame_height: 0,
            svg_path_info: [single_svg_path_info]
        };

        return obj;
    }
    /////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////

	/*
		실제 표시되는 path의 BBox의 우상단을 원점으로 하는 svg를 생성한다.
		opt: {
			padding: [left, top, right, bottom]
		}

		return:
			{
				bbox: {min_x, min_y, max_x, max_y, w, h}
				padded_box: {x, y, w, h} // padding이 적용된 box
				svg_str: string
			}
		svg_str은 원래의 좌표를 {min_x, min_y}을 원점으로 하는 svg로 생성된 것임.
	*/
	snapshotAsSVGInContentBBox(opt: { padding?: number[] } = {}): ContentBBoxSvg {
		let bbox = this.getBBox();
		let padding = opt.padding || [0, 0, 0, 0];   // 원본은 svg에만 기본값을 쓰고 padded_box는 opt.padding[0]을 읽어 padding이 없으면 TypeError가 났다. issues.md #15
		let cropbox = {
			x: bbox.min_x,
			y: bbox.min_y,
			w: bbox.w,
			h: bbox.h
		}
		let svg_str = this.snapshotAsSVG({
			cropbox,
			padding: padding
		});

		return {
			bbox,
			padded_box: {
				x: bbox.min_x - padding[0],
				y: bbox.min_y - padding[1],
				w: bbox.w + padding[0] + padding[2],
				h: bbox.h + padding[1] + padding[3]
			},
			svg_str
		}
		
	}

    /////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////

	/*
		Content Boundary Box (BBox)를 구한다.
	*/
	getBBox(opt?: SnapshotSvgOptions): ContentBBox {
		let svgData = this.snapshotAsSVGData(opt);
		// console.log(svgData)

		let processed = false;
		let abs_bbox: ContentBBox = {
			min_x:Infinity, min_y:Infinity, max_x:-Infinity, max_y:-Infinity,
			w:0, h:0
		}
		svgData.svg_path_info.forEach(item => {
			/* item
				svg_paths: [{d, fill, shadow, stroke, gradient, ...}]
				x
				y
			*/
			if (item.svg_paths[0].d.length > 0) {
				processed = true;
				item.svg_paths.forEach(svg_path => {
					let bbox = getBBoxFromSvgDPath(svg_path); // bbox: {x, y, width, height}
					if (bbox !== null) {
						// console.log(bbox)
		
						abs_bbox.min_x = Math.min(abs_bbox.min_x, item.x + bbox.x);
						abs_bbox.min_y = Math.min(abs_bbox.min_y, item.y + bbox.y);
						abs_bbox.max_x = Math.max(abs_bbox.max_x, item.x + bbox.x + bbox.width);
						abs_bbox.max_y = Math.max(abs_bbox.max_y, item.y + bbox.y + bbox.height);
					}
				});
			}
		})
		// console.log("abs_bbox", abs_bbox)
		if (processed) {
			// stoke weight중 가장 큰 값을 기준으로 크기를 늘린다.
			let offset = getMaxStrokeWeightPx(svgData);
			abs_bbox.min_x -= offset;
			abs_bbox.min_y -= offset;
			abs_bbox.max_x += offset;
			abs_bbox.max_y += offset;
		}
		
		abs_bbox.w = abs_bbox.max_x - abs_bbox.min_x;
		abs_bbox.h = abs_bbox.max_y - abs_bbox.min_y;
		return processed ? abs_bbox : {min_x:0, min_y:0, max_x:0, max_y:0, w:0, h:0};
	}

    /////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////

    importFromInDesignJson(json_str: string | IndTextFrame, font_list?: FontList | null): IndConvertResult {
        var opt: IndConvertOptions = {
            src_unit: 'mm',
            font_list: null
        }

        // font list 결정 
        if (font_list)
            opt.font_list = font_list;
        else
            opt.font_list = spFontManager._get_font_list(this.tb.get_font_group_id());

        var conv = new TB_InDesignJsonConverter(opt);

        var kayak_obj = conv.load_json(json_str)
            // console.log(kayak_obj);
        return kayak_obj;
    }


    /*  layout된 내용을 this.tbconfig.mirror_node에 똑같이 보여줌.
        scale만 변형하여 storyboard에 표시하기 위한 용도.
    */
    mirror(opt: MirrorOptions): void {
        if (opt.enable_debounce)
            this.mirror_debounce(opt);
        else
            this._mirror(opt);
    }

    _mirror(opt: MirrorOptions): void {
        if (this.tb.tbconfig.element_textonpath)
            this.mirror_textonpath(opt);
        else
            this.mirror_textbox(opt)
    }
    mirror_textbox(opt: MirrorOptions): void {
        let tb = this.tb;

        // console.log(this.tbconfig.mirror_node);

        // mirror_node에 있는 모든 element를 제거함.
        var m = opt.node;
        while (m.hasChildNodes())
            m.removeChild(m.firstChild!);

        var fragment = _g.document!.createDocumentFragment();
        fragment.appendChild(tb.tbconfig.element!.cloneNode()); // kayak-root

        // clone content_elm
        var frag_kayak_root = fragment.firstChild as HTMLElement;
        if (opt && opt.scale)
            frag_kayak_root.style.transform = 'scale(' + opt.scale + ')';
        frag_kayak_root.appendChild(tb.tbconfig.content_elem!.cloneNode());

        //
        var farg_content_elem = frag_kayak_root.firstChild as HTMLElement; // ==> <div class="kayak-content">...</div>

        // farg_content_elem에 <div class="kayak-lineview-container">...</div>을 추가한다.
        var frag_lineview_container = _g.document!.createElement('div');
        frag_lineview_container.className = 'kayak-lineview-container';
        farg_content_elem.appendChild(frag_lineview_container);

        var arr = tb.tbconfig.content_elem!.querySelectorAll('div.kayak-lineview')
        for (var i = 0; i < arr.length; i++) {
            // console.log(arr[i]);
            frag_lineview_container.appendChild(arr[i].cloneNode(true))
        }

        // console.log(fragment);

        // fragment의 모든 하위 element가 m으로 옮겨지고, fragment는 비게 됨
        m.appendChild(fragment);
    }

    mirror_textonpath(opt: MirrorOptions): void {
        let tb = this.tb;

        // console.log(this.tbconfig.mirror_node);

        // mirror_node에 있는 모든 element를 제거함.
        var m = opt.node;
        while (m.hasChildNodes())
            m.removeChild(m.firstChild!);

        var fragment = _g.document!.createDocumentFragment();
        fragment.appendChild(tb.tbconfig.element_textonpath!.cloneNode());

        // clone content_elm
        var frag_kayak_textonpath = fragment.firstChild as HTMLElement;
        if (opt && opt.scale)
            frag_kayak_textonpath.style.transform = 'scale(' + opt.scale + ')';
        (frag_kayak_textonpath.style as any)['transform-origin'] = '0px 0px 0px';   // CSSStyleDeclaration에 kebab 색인이 없다. setProperty로 바꾸면 런타임 변경

        frag_kayak_textonpath.style.position = 'relative';

        let svg_str = this.tb.text_on_path!.tp_draw.get_svg_for_mirror();
        frag_kayak_textonpath.innerHTML = svg_str;


        // fragment의 모든 하위 element가 m으로 옮겨지고, fragment는 비게 됨
        m.appendChild(fragment);
    }

    /*
        json_str이 있으면 parsing하여 값을 얻고,
        null이면 현재 load되어 있는 this.tb의 color seglayer에서 값을 모은다.
    */
    gather_used_colors(json_str?: string | null): Record<string, UsedColor> {
        let used_colors: Record<string, UsedColor> = {};

        let arr: any[] | null = null;
        if (json_str) {
            let obj = JSON.parse(json_str);
            arr = obj.ATTR_FontColor;
        } else {
            arr = this.tb.m_FontColor._get_vec();
        }

        arr!.forEach(item => {
            used_colors[item.fontColor] = {
                rgb: item.fontColor,
                cmyk: item.fontColorCMYK
            }
        })

        // console.log(used_colors);
        return used_colors;
    }

    /*
        font_list는 null일 수 있음.
    */
    gather_used_fonts(font_list?: FontList | null): Record<string, FontItem> {
        let used_fonts: Record<string, FontItem> = {};

        this.tb.m_FFamilyLayer._get_vec().forEach(attr => {
            // console.log(attr);

            let key = attr.familyName + '/' + attr.typeStyle;
            if (used_fonts[key] == undefined) {
                used_fonts[key] = {
                    familyName: attr.familyName,
                    typeStyle: attr.typeStyle
                }
            }
        });

        // 실제 사용유무와 상관없이 default 폰트를 포함한다.
        // 영문폰트에서 한글을 사용한 경우 default 폰트가 사용됨.
        let default_font = this.tb.get_default_font(font_list);
        let key = default_font.familyName + '/' + default_font.typeStyle;
        if (used_fonts[key] == undefined) {
            used_fonts[key] = {
                familyName: default_font.familyName,
                typeStyle: default_font.typeStyle
            }
        }

        // console.log(used_fonts)
        return used_fonts;
    }

    /*  
        // default 폰트는 항상 포함된다.
        // 영문폰트에서 한글을 사용한 경우 default 폰트가 사용됨.

        opt : {
            font_list: ...
        }

        return { 
            used_fonts, 
            unresolved_fonts : Array[string]
        }
    */
    gather_used_font_list_info(opt?: FontEnvOptions): UsedFontListInfo {
        var used_fonts = this.gather_used_fonts(opt ? opt.font_list : null); // <-- opt.font_list를 활용해야 한다. 특히 default font를 얻기 위해

        let font_list: FontList | null = null;
        if (this.tb.fontloader) {
            let fontGroupId = this.tb.fontloader.get_font_group_id()
            font_list = spFontManager._get_font_list(fontGroupId)
        } else { // schema mode인 경우임.
            if (opt && opt.font_list)
                font_list = opt.font_list;
            else {
                log.error('no font_list available in gather_used_font_list_info()')
            }
        }

        return this._get_used_font_list_for_embedding(used_fonts, font_list);
    }

    _get_used_font_list_for_embedding(used_fonts: Record<string, FontItem>, font_list: FontList | null): UsedFontListInfo {
        let result: UsedFontListInfo['used_fonts'] = {};
        let unresolved_fonts: string[] = [];

        Object.keys(used_fonts).forEach(key => {
            let familyName = used_fonts[key].familyName;
            let typeStyle = used_fonts[key].typeStyle;

            if (font_list![familyName] && font_list![familyName].style[typeStyle]) {
                if (result[familyName] == undefined) {
                    result[familyName] = {
                        family: font_list![familyName].family,
                        style: {}
                    }
                }

                // console.assert(font_list[familyName].style[typeStyle])
                result[familyName].style[typeStyle] = font_list![familyName].style[typeStyle];
            } else {
                // 있어서는 안되는 상태로 온 것임. 반드시 맵핑되는 경우가 있어야 함.
                unresolved_fonts.push(key);
            }
        })

        // console.log(result);
        return {
            used_fonts: result,
            unresolved_fonts: unresolved_fonts
        }
    }
}