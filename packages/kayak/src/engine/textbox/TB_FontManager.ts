import _g from './TB_PlatformEnv';
// opentype.js v1.3.4 + hasChar() 수정. 수정 내용은 patches/opentype.js+1.3.4.patch (npm install 시 patch-package가 적용)
import opentype from "opentype.js";
import type { Font } from "opentype.js";

/*
	opentype.js가 처리하지 못하는 GSUB lookup을 만나도 예외로 죽지 않도록 감싼다.
	https://github.com/opentypejs/opentype.js/issues/627
*/
import * as gsub_safety from './TB_GsubSafety';
gsub_safety.install_safe_string_to_glyphs(opentype)


// https://github.com/ReactiveX/rxjs
//let Observable = require('rxjs/Observable').Observable;  

// https://github.com/Gozala/events
import { EventEmitter } from 'events';

import { font_rsc_list } from './TB_FontRscList';
import * as log from "loglevel";
import { FontDecoder } from './TB_FontDecoder'
import type { FontItem, FontLoadItem, FontList, FontGroupsList, FontStyleEntry, FontResourceUrlCallback, FontLoadCallback } from './types';

/** 로딩된 폰트 하나. referrer는 이 폰트를 쓰는 TB_LocalFontLoader들 */
interface FontRef { font: Font | null; count: number; referrer: WeakSet<object> }

class FontManager {
	font_groups_list: FontGroupsList;
	fonts: Record<string, FontRef>;
	private font_loading_events: Record<string, EventEmitter | null>;   // private이면 d.ts에 events 타입이 나가지 않는다
	loading_state: string;
	fontDecoder: FontDecoder;

	constructor() {
		this.font_groups_list = {}
		this.fonts = {};
		this.font_loading_events = {};
		this.loading_state = 'loaded';
		this.set_font_groups_list(font_rsc_list);

		this.fontDecoder = new FontDecoder();
	}

	clearFonts(): void {
		this.fonts = {};
	}

	// private
	releaseFontResource(lfm: { used_font_keys: Set<string> }): void {
		lfm.used_font_keys.forEach(key => {
			let font = this.fonts[key];
			if (font) {
				if (font.referrer.has(lfm) == true) {
					font.referrer.delete(lfm);
					font.count -= 1;
					if (font.count == 0) {
						font.font = null;
						delete this.fonts[key]
					}
				}
			}
		})

		// console.log('release fonts. current fonts state : ', Object.keys(this.fonts))
	}

	getFontInUseCount(): number {
		return Object.keys(this.fonts).length
	}


	// private
	get_font(font_key_name: string): Font | null | undefined {
		// console.log(this.fonts[font_key_name] && this.fonts[font_key_name].ref);
		return this.fonts[font_key_name] && this.fonts[font_key_name].font;
	}

	/* 
		usedFonts는 textbox::gather_used_fonts()로 부터 얻음.
	*/
    findUnregisteredFonts(kayak_font_list: FontList, usedFonts: Record<string, FontItem>): FontItem[] {
        let unregistered_font_list = Object.keys(usedFonts).map(key => usedFonts[key])
        .filter(val => {
            if (kayak_font_list[val.familyName] && kayak_font_list[val.familyName].style[val.typeStyle])
                return false;
            return true;
        })

        return unregistered_font_list;
    }	

	set_font_groups_list(font_groups_list: FontGroupsList): void {
		// 외부 font_rsc_list가 있으면 우선적으로 사용한다.
		this.font_groups_list = font_groups_list;
	}

	// set_font_rsc_list(font_rsc) {
	// 	// 외부 font_rsc_list가 있으면 우선적으로 사용한다.
	// 	this.font_rsc_list = font_rsc;
	// }

	_get_font_list(id?: string | null): FontList | null {
		let list =  this.font_groups_list[id || 'default-host-ko'];
		return list ? list.font_list : null;
	}
	_get_font_list_first_found(id?: string): FontList {
		let fid = Object.keys(this.font_groups_list)[0];
		return this.font_groups_list[fid].font_list;
	}


	// LocalFontLoader에서만 사용되도록 수정하기
	_find_default_values(font_list_id?: string | null): FontItem {
		let list = this._get_font_list(font_list_id);
		if (list == null) {
			list = this._get_font_list_first_found();
		}

		return this.find_default_font_with_font_list(list);
	}

	find_default_font_with_font_list(list: FontList): FontItem {
		for(let fontName in list) {
			let typeStyles = list[fontName].style;
			for(let styleName in typeStyles) {
				if (typeStyles[styleName].default === true) {
					let default_font =  {
						familyName: fontName,
						typeStyle: styleName
					};
					return default_font;
				}
			}
		}

		log.error(`<<Font Error>> : default font is not defined.`);

		// default로 지정한 font가 없을 경우에섯 첫번째 font를 사용한다.
		let font_family = Object.keys(list)[0];   // 원본은 선언 없이 참조해 ReferenceError가 났다.
		// 키 이름이 familyName/typeStyle과 다른 것은 원본 동작이다 (docs/ts-migration/issues.md #6). 타입만 맞춘다.
		return {
			font_family: font_family,
			type_style: Object.keys(list[font_family].style)[0]
		} as unknown as FontItem
	}

	get_font_info(font_list_id: string | null, font_name: string, font_style: string): FontStyleEntry | null {
		let font_list = this._get_font_list(font_list_id)!;
		if (font_list[font_name] && font_list[font_name].style[font_style])
			return font_list[font_name].style[font_style];
		return null;
	}

	_get_font_rsc_url(font_list_id: string | null, font_name: string, font_style: string, callback: FontResourceUrlCallback): void {
		let font_url: string | null = null;
		let font_issue: string | null = null;

		let alternative_font_family: string | null = null;
		let alternative_type_style: string | null = null;

		let font_list = this._get_font_list(font_list_id);
		if (font_list == undefined) {
			log.error(`<<Font Error>> : font_list_id "${font_list_id}" not exist.`);
			callback('font_list_id not exist');
			return ;
		}

		
		if (font_list[font_name] == undefined) {
			let default_font = this._find_default_values(font_list_id);

			log.debug(`<<Font Error>> : font-family "${font_name}" is not found.`);
			log.debug(`<<Font Error>> : 기본 폰트 "${default_font.familyName}"/"${default_font.typeStyle}"로 대체 됩니다.`);
			font_url = font_list[default_font.familyName].style[default_font.typeStyle].url;
			font_issue = font_list[default_font.familyName].style[default_font.typeStyle].issue;

			alternative_font_family = default_font.familyName;
			alternative_type_style = default_font.typeStyle;
		}
		else if (font_list[font_name].style[font_style] == undefined) {
			log.debug(`<<Font Error>> : type-style "${font_style}" of "${font_name}" is not found.`);

			let keys = Object.keys(font_list[font_name].style);
			if (keys.length == 0) {
				log.error(`<<Font Error>> : "${font_name}" has no type-style`)
				alert(`<<Font Error>> : "${font_name}" has no type-style`)
			}
			else {
				font_url = font_list[font_name].style[keys[0]].url;
				font_issue = font_list[font_name].style[keys[0]].issue;
				log.debug(`<<Font Error>> : 기본 style "${keys[0]}"로 대체 됩니다.`);

				alternative_font_family = font_name;
				alternative_type_style = keys[0];
			}
		}
		else {
			font_url = font_list[font_name].style[font_style].url;
			font_issue = font_list[font_name].style[font_style].issue;
		}

		callback(null, font_url, font_issue, alternative_font_family, alternative_type_style);		
	}



	get_font_key_name(font_list_id: string | null, font_name: string, font_style: string): string {
		return font_list_id + '-' + font_name + '-' + font_style;			// ex. "m1-MinionPro-Regular"
	}

	// private
	addRef_if_not_referred(font_key_name: string, lfm: object): void {
		if (this.fonts[font_key_name].referrer.has(lfm) == false) {
			this.fonts[font_key_name].referrer.add(lfm);
			this.fonts[font_key_name].count += 1;
		}
	}
	

		/*
			param: fo
			{ 
				familyName:<string>, 
				typeStyle:<string>,
				url:<string>		# null이면 font resource에서 찾게됨
				issue:<string>		# null이면 font resource에서 찾게됨
			 }		
		*/
		_load(font_list_id: string | null, fo: FontLoadItem, lfm: object): Promise<Font> {
		// 요청한 폰트가 없으면 대체폰트가 사용된다.
		// 그러나 font_key_name은 원래 요청한 폰트의 정보로 구성되며, font_url은 대체폰트의 url이 리턴된다.
		let font_url: string | null | undefined = null;
		let font_issue: string | null | undefined = null;
		let use_alternative_font = false;

		if (fo.url && fo.issue) {
			font_url = fo.url;
			font_issue = fo.issue;
			use_alternative_font = false;
		}
		else {
			this._get_font_rsc_url(font_list_id, fo.familyName, fo.typeStyle, (err, url, issue, alternative_font_family, alternative_type_style) => {
				font_url = url;
				font_issue = issue;
				use_alternative_font = (alternative_font_family || alternative_type_style) ? true : false;
			});
		}

		if (font_url == null)
			return Promise.reject('font resource is not defined.');
		let font_key_name = this.get_font_key_name(font_list_id, fo.familyName, fo.typeStyle);

		
		if (this.get_font(font_key_name)) {
			// A. 이미 로딩되어 있으면 바로 리턴한다.
			// console.log(`[FONT LOADER] ${font_key_name} alread exist`)

			// local font manager가 font를 참조하고 있지 않으면 참조 weakset에 넣고, count증가시킴
			this.addRef_if_not_referred(font_key_name, lfm)

			return Promise.resolve(this.get_font(font_key_name)!);
		}
		else if (this.font_loading_events[font_key_name]) {
			// B. C단계에서 폰트를 로딩중인 경우, 로딩이 끝나면 event를 받아 리턴한다.
			return new Promise((resolve, reject)=> {
				this.font_loading_events[font_key_name]!.on('loaded', (font) => {
					// console.log(`[FONT LOADER] ${font_key_name} is loaded after waiting.`)
					if (font) {
						// local font manager가 font를 참조하고 있지 않으면 참조 weakset에 넣고, count증가시킴
						this.addRef_if_not_referred(font_key_name, lfm)
						resolve(font)
					}
					else
						reject({ font_key_name: font_key_name })
				})
			})
		}
		else {
			// C. 폰트를 로딩함. 
			//    이 단계에서는 대기 event를 만들어 동일한 폰트 로딩 요구하는 경우(즉, B단계)에 대응한다.

			this.font_loading_events[font_key_name] = new EventEmitter();
			// api 참고: https://nodejs.org/api/events.html#events_emitter_setmaxlisteners_n
			// https://stackoverflow.com/questions/9768444/possible-eventemitter-memory-leak-detected
			this.font_loading_events[font_key_name].setMaxListeners(999);

			return new Promise((resolve, reject) => {
				// console.log(`---> request loading ${font_key_name}`)
				this.font_loader_by_platform(lfm, font_url!, font_issue!, font_key_name, font_list_id, use_alternative_font, (err, font) => {
					if (err) {
						reject({
							info: {
								font_url : font_url,
								font_issue: font_issue,
								font_key_name : font_key_name
							},
							err: err
						});

						this.font_loading_events[font_key_name]!.emit('loaded', null);	// 'loaded' 이벤트를 보내지만 font를 null로 리턴함.
						// let count = this.font_loading_events[font_key_name].listenerCount('loaded');
						// console.log(`===> ${count} listener(s) removed`);
						this.font_loading_events[font_key_name]!.removeAllListeners();
						this.font_loading_events[font_key_name] = null;
						
					} else {
						// console.log(`[FONT LOADER] ${font_key_name} is loaded from network.`)
						this.fonts[font_key_name] = {
							font: font!,
							count: 1,
							referrer: new WeakSet([lfm])
						}
						resolve(font!);
						this.font_loading_events[font_key_name]!.emit('loaded', font);
						// let count = this.font_loading_events[font_key_name].listenerCount('loaded');
						// console.log(`===> ${count} listener(s) removed`);
						this.font_loading_events[font_key_name]!.removeAllListeners();
						this.font_loading_events[font_key_name] = null;
					}
				})
			})
		}
	}


	// private
	font_loader_by_platform(lfm: any, font_url: string, font_issue: string, font_key_name: string, font_list_id: string | null, use_alternative_font: boolean, callback: FontLoadCallback): void {
		const isNode = typeof window === 'undefined';
		
		let url = '';
		if (isNode == false) {
			url = font_url;
			// opentype.load(url, callback)
			let opt = {
				lowMemory: true
			}
			this.load_and_parse(url, opt, callback)

		}
		else {
			// node환경일 경우 임.
			// font_url에서 폰트파일을 다운로드 받고, local file path를 리턴한다.
			if (_g.get_font_filepath == null)
				throw "_g.get_font_filepath() is null."
			
			// TB_PlatformEnv.js의 설명 참고 및 edicus-server의 m1font.js 참고
			// font_url를 download받아 로컬폴더에 저장하고 그 위치를 font_file_path로 리턴한다.
			if (use_alternative_font == false) {
				let download_folder = lfm.get_base_folder_for_download() + '/' + font_list_id;
				_g.get_font_filepath(font_url, font_issue, font_key_name, download_folder, (err, font_file_path) => {
						// opentype.load(font_file_path, (err, font) => {
						this.load_and_parse(font_file_path, null, (err, font) => {
						if (err) {
							_g.delete_downloaded_font_file!(font_key_name, download_folder).then(_ => {
								callback (err);
							}).catch(err_inner => {
								callback(err_inner);
							})
						}
						else
							callback (err, font);
					})
				})
			}
			else {
				// get default font path. 
				// 미리 준비된 기본폰트의 filepath를 리턴한다.
				_g.get_font_filepath(null, null, null, null, (err, font_file_path) => {
					// opentype.load(font_file_path, callback)
					this.load_and_parse(font_file_path, null, callback)
				})
				
			}
		}
/*
		// request.js 사용시. 
		
		request.get(download_link)
		.on('response', (res) => {
			FileObj.mimetype = res.headers['content-type'];
			total_types = parseInt(res.headers['content-length'], 10);

			res.on('data', function(chunk) {
				download_bytes += chunk.length;
				// console.log('chunk len: ' + download_bytes);
			});
		})
		.on('end', (res) => {
			console.log(res);
		})
		.on('error', (err) => {
			console.log('error: ', err)
		})
*/		
		
	}

	load_and_parse(url: string, opt: { lowMemory?: boolean } | null, callback: FontLoadCallback): void {
		let isNode$$1 = typeof window === 'undefined';
		let loadFn = isNode$$1 ? this.loadFromFile : this.loadFromUrl;

		// member method를 local variable로 받아 호출하는 경우, this가 유지안되므로, call을 사용함.
		loadFn.call(this, url, (err, arrayBuffer) => {
			if (err) {
				return callback(err);
			}
			var font: Font;
			try {
				// arrayBuffer가 encoding되어 있으면 풀어서 리턴함.
				let buf = this.fontDecoder.decode_buffer(arrayBuffer!);
				font = opentype.parse(buf, opt);
				/*
					합자(liga)가 opentype.js의 미지원 GSUB lookup을 참조하는 폰트가 있다.
					폰트를 거부하지 않고 그 폰트만 합자를 끄도록 표시해 둔다.
					TB_SvgTextRender._getGlyphs()가 이 값을 본다.
				*/
				font.__liga_safe = gsub_safety.is_liga_safe(font);
			} catch (e) {
				return callback(e, null);
			}
			return callback(null, font);
		})
	}

	// opentype.js에서 복사한 method.
	loadFromUrl(url: string, callback: (err: string | null, buffer?: ArrayBuffer) => void): void {
		var request = new XMLHttpRequest();
		request.open('get', url, true);
		request.responseType = 'arraybuffer';
		request.onload = function() {
			if (request.response) {
				return callback(null, request.response);
			} else {
				return callback('Font could not be loaded: ' + request.statusText);
			}
		};
	
		request.onerror = function () {
			callback('Font could not be loaded');
		};
	
		request.send();
	}

	loadFromFile(path: string, callback: (err: string | null, buffer?: ArrayBuffer) => void): void {
		// var fs = require('fs');
		
		/* 
			_g.fsReadFile는 
				var fs = require('fs');
				fs.readFile과 동일한 것이어야 함.
		*/
		let fs_readFile = _g.fsReadFile!();
		fs_readFile(path, (err, buffer) => {
			if (err) {
				return callback(err.message);
			}
	
			callback(null, this.nodeBufferToArrayBuffer(buffer));
		});
	}
	nodeBufferToArrayBuffer(buffer: Uint8Array): ArrayBuffer {
		var ab = new ArrayBuffer(buffer.length);
		var view = new Uint8Array(ab);
		for (var i = 0; i < buffer.length; ++i) {
			view[i] = buffer[i];
		}
	
		return ab;
	}

	// private
	get_locale_value(obj: { locale: Record<string, string> }, _locale?: string): string {
		let locale = _locale ? _locale : 'en';
		return obj.locale[locale] ? obj.locale[locale] : obj.locale['en']
	}

	/* return
		[{
			name,
			disp_name
		}]
	*/
	get_family_list(font_list_id: string | null, locale?: string): { name: string; disp_name: string; lang: string[] }[] {
		let font_list = this._get_font_list(font_list_id);
		if (font_list == undefined)
			return [];

		return Object.keys(font_list)
		.map(family_name => {
			let lang: string[] = [];
			let fm = font_list[family_name];
			let first_style = Object.keys(fm.style)[0];
			if (first_style && fm.style[first_style].lang)
				lang = fm.style[first_style].lang;

			return {
				name   : family_name,
				disp_name : this.get_locale_value(fm.family, locale),
				lang: lang
			}
		})
	}

	// locale에 해당하는 disp_name을 리턴한다.
	get_family_disp_name(font_list_id: string | null, family_name: string, locale?: string): string {
		let font_list = this._get_font_list(font_list_id);
		if (font_list == undefined)
			return family_name;

		let disp_name =  font_list[family_name] && this.get_locale_value(font_list[family_name].family, locale);
		return disp_name ? disp_name : family_name;
	}

	/*  
		return [{
			name,
			disp_name
		}]
	*/
	get_font_style_list(font_list_id: string | null, family_name: string, locale?: string): { name: string; disp_name: string; font_prv_url?: string; font_url: string; default?: boolean }[] {
		let font_list = this._get_font_list(font_list_id);
		if (font_list == undefined)
			return [];

		if (font_list[family_name] == undefined)
			return [];

		return Object.keys(font_list[family_name].style)
		.map(style_name => {
			return {
				name : style_name,
				disp_name  : this.get_locale_value(font_list[family_name].style[style_name], locale),
				font_prv_url : font_list[family_name].style[style_name].font_prv_url,
				font_url : font_list[family_name].style[style_name].url,
				default: font_list[family_name].style[style_name].default
			}
		})
	}

	// locale에 해당하는 disp_name을 리턴한다.
	get_style_disp_name(font_list_id: string | null, family_name: string, style_name: string, locale?: string): string {
		let font_list = this._get_font_list(font_list_id);
		if (font_list == undefined)
			return style_name;
		
		let disp_name =  font_list[family_name] && this.get_locale_value(font_list[family_name].style[style_name], locale);
		return disp_name ? disp_name : style_name;
	}

}
let spFontManager = new FontManager();


export { 
	spFontManager 		// export as Singleton
};
