import { spFontManager } from './TB_FontManager';
import * as log from "loglevel";
import type { Font } from 'opentype.js';
import type { FontItem, FontLoadItem, FontLoadingState, FontLoadingStateCallback, FontStyleEntry, FontFamilyEntry } from './types';

class TB_LocalFontLoader {
	private _font_list_id: string | null;
	base_folder_for_download: string | undefined;
	used_font_keys: Set<string>;
	loading_state: FontLoadingState;
	callbacks_for_font_loading_state: Set<FontLoadingStateCallback>;
	document_default_font_item: FontItem | null;

	constructor(font_list_id: string | null | undefined, base_folder_for_download?: string) {
		this._font_list_id = null;
		this.base_folder_for_download = base_folder_for_download; // node.js 환경에서만 유효
		this.used_font_keys = new Set();
		this.loading_state = 'loaded';
		this.callbacks_for_font_loading_state = new Set();

		// font_list_id에 있는 default font를 사용하지 않고
		// kayak json에 저장된 font_used항목에 있는 default font를 사용하는 경우 설정됨.
		// edicus-prepress등에서 font_used항목의 폰트만으로 렌더링 하는 경우 default폰트가 정상적으로 표시되도록 하기 위함.
		this.document_default_font_item = null;

		this.decide_font_list_id(font_list_id);
	}

	set_document_default_font(font_item: FontItem | null | undefined): void {
		if (font_item) {
			this.document_default_font_item = {
				familyName: font_item.familyName,
				typeStyle: font_item.typeStyle
			}
		}
		else
			this.document_default_font_item = null;
	}

	decide_font_list_id(font_list_id: string | null | undefined): void {
		/* spFontManager.font_rsc_list의 항목이 하나일 경우
			this._font_list_id는 그 첫번째 항목으로 설정한다.

			이유는,
			brwoser에서 사용하는 경우, font_list_id 값을 설정하더라도 
			spFontManager.font_rsc_list는 단일 항목으로 구성되기 때문임 
		*/
		let keys = Object.keys(spFontManager.font_groups_list);
		if (font_list_id == null || keys.length == 1) {
			this._font_list_id = keys[0];
		}
		else {
			if (keys.findIndex(key => key == font_list_id) !== -1)
				this._font_list_id = font_list_id;
			else {
				for(let i=0; i<keys.length; i++) {   // 원본은 `i`를 선언하지 않아 strict 모드(ESM)에서 ReferenceError가 났다.
					if (keys[i].substr(keys[i].length - 8) !== 'basefont') {
						this._font_list_id = keys[i];
						break;
					}
				}
			}
		}
	}

	destroy(): void {
		spFontManager.releaseFontResource(this);		
		this.used_font_keys.clear();
	}

	get_base_folder_for_download(): string | undefined {
		return this.base_folder_for_download;
	}

	get_font_group_id(): string | null {
		return this._font_list_id;
	}
	
	get_font_key(font_name: string, font_style: string): string {
		return this._font_list_id + '-' + font_name + '-' + font_style;	// ex. "base-MinionPro-Regular"
	}

    get_default_font(): FontItem {
		// embedded default가 설정되어 있으면 우선적으로 사용한다.
		if (this.document_default_font_item)
			return this.document_default_font_item;

        return spFontManager._find_default_values(this._font_list_id);
    }

	/*  font loading 상태를 callback으로 알려줌.
		주 목적은 font로딩 중이면 키보드 입력을 막는 데에 사용.
	*/
	register_font_loading_state_callback(callback: FontLoadingStateCallback): void {
		this.callbacks_for_font_loading_state.add(callback);
	}
	unregister_font_loading_state_callback(callback: FontLoadingStateCallback): void {
		this.callbacks_for_font_loading_state.delete(callback);
	}

	get_state(): FontLoadingState {
		return this.loading_state;
	}

	is_font_loaded(): boolean {
		return this.loading_state === 'loaded';
	}

	// this.loading_state가 갱신될 수 있도록 내부적으로 load_fonts()를 부르도록 한다.
	load_font(font_info: FontLoadItem): Promise<null> {
		return this.load_fonts([font_info]) ;
	}
		
	/* 	font_arr 구성 :
			[{ 
				familyName:<string>, 
				typeStyle:<string>,
				url:<string>		# null이면 font resource에서 찾게됨
				issue:<string>		# null이면 font resource에서 찾게됨
			 }, ...
			]
		Note.
		- font_arr의 item에서 url과 issue의 값이 있으면 그대로 사용함.
		- 만약 없으면 font rsc에서 찾아서 사용한다.
	 */
	load_fonts(font_arr: FontLoadItem[]): Promise<null> {
		this.loading_state = 'loading';
		this.callbacks_for_font_loading_state.forEach(callback => callback(this.loading_state))

		let promise_arr = font_arr.map(val => {
			let font_key = spFontManager.get_font_key_name(this._font_list_id, val.familyName, val.typeStyle);
			this.used_font_keys.add(font_key);
			// val에서 url과 issue 값이 null이면 font resource에서 찾아서 채움.
			return spFontManager._load(this._font_list_id, val, this);
		})

		return Promise.all(promise_arr).then((): null => {
			this.loading_state = 'loaded';
			this.callbacks_for_font_loading_state.forEach(callback => callback(this.loading_state))
			// this.callback_for_font_loading_state && this.callback_for_font_loading_state(this.loading_state);
			return null;
		}).catch(err => {
			log.error('load_fonts() failed: ', err);
			this.loading_state = 'failed';
			this.callbacks_for_font_loading_state.forEach(callback => callback(this.loading_state))
			throw err;
		})
	}

	/*
		performance를 고려하여 promise를 사용하지 않음.
	*/
	get(font_name: string, font_style: string, callback?: (err: any, font?: Font | null) => void): void {
		let font_key_name = this.get_font_key(font_name, font_style);	// ex. "base-MinionPro-Regular"
		
		if (spFontManager.get_font(font_key_name)) {
			callback && callback(null, spFontManager.get_font(font_key_name));
		}
		else {
			this.load_font({familyName:font_name, typeStyle:font_style}).then(err => {
				callback && callback(null);
			}).catch(err => {
				log.debug('err: ', err);
				callback && callback(err);
			})
		}
	}

	getSync(font_name: string, font_style: string): Font | null | undefined {
		let font_key_name = this.get_font_key(font_name, font_style);	// ex. "base-MinionPro-Regular"
		return spFontManager.get_font(font_key_name)
	}	

	//////////////////////////////////////////////////////////////

	get_family_list(locale?: string) {
		return spFontManager.get_family_list(this._font_list_id, locale);
	}
	get_family_disp_name(family_name: string, locale?: string): string {
		return spFontManager.get_family_disp_name(this._font_list_id, family_name, locale)
	}

	get_font_style_list(family_name: string, locale?: string) {
		return spFontManager.get_font_style_list(this._font_list_id, family_name, locale);
	}
	get_style_disp_name(family_name: string, style_name: string, locale?: string): string {
		return spFontManager.get_style_disp_name(this._font_list_id, family_name, style_name, locale)
	}

	get_font_info(font_name: string, font_style: string): FontStyleEntry | null {
		return spFontManager.get_font_info(this._font_list_id, font_name, font_style);
	}

	/*
		used_fonts : kayak에서 사용된 폰트. 
		used_font_unique_set : fontFamily와 typeStyle로 각각 구분되는 array

		Note 
		- used_fonts에 사용된 것중 font_list에 없는 폰트(= foreign font)를 찾아내어 font_list에 주입한다.
		- kayak json에 있는 "font_used" 항목의 내용을 주입하는 것임. 
		효과 :
		- Edicus에서 폰트리스트를 보여줄 경우, font-group-list에 없는 폰트가 사용되었더라도 
		  font dropdown 리스트에 정상적으로 표시되도록 함.
	*/
	add_foreign_fonts(used_fonts: Record<string, any>, used_font_unique_set: FontItem[]): void {
		// console.log("foreign_fonts: ", used_fonts);
		// console.log("used_font_unique_set: ", used_font_unique_set);

		let font_list = spFontManager._get_font_list(this._font_list_id)!;
		// console.log("font_list:", font_list)

		used_font_unique_set.forEach(item => {
			let name = item.familyName;
			let style = item.typeStyle;

			// font_list에서 찾을 수 없다면 foreign-font로 간주함.
			if (this.get_font_info(name, style) == null) {
				// console.log(item)
				if (font_list[name] == undefined) {
					font_list[name] = {} as FontFamilyEntry;
					Object.assign(font_list[name], {
						family: used_fonts[name].family
					})
					font_list[name].style = {};
				}
				if (font_list[name].style[style] == undefined) {
					font_list[name].style[style] = {} as FontStyleEntry;
					// font를 주입하는 경우 default정보는 전달하지 않도록 함.
					Object.assign(font_list[name].style[style], used_fonts[name].style[style], {default:false})
				}
			}
		})
	}
}


export { 
	TB_LocalFontLoader
};
