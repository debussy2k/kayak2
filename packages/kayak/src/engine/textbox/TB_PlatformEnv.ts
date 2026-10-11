/*  
	NodeJs에서 실행하는 방법
	- jsdom이 필요함.

	Sample Code
		const jsdom = require('jsdom');
		const { JSDOM } = jsdom;
		const { window } = new JSDOM(`<!DOCTYPE html><p>Kayak TextBox</p>`);

		let M1TextBox = require("../jslib/kayak/m1textbox_node.min.js");
		M1TextBox.TB_PlatformEnv.set({
			window : window
		})


    m1font.get_font_filepath()의 역할은
    - font_url에 지정된 otf파일을 다운로드 받아 "./font_download"에 저장하고
    - 그 local path를 돌려준다.

    ## NodeJs환경에서의 font사용
    node환경에서는 font를 로컬폴더에 저장해 놓고 반복 사용해야 한다.
    이를 위한 서비스 함수인 m1font.get_font_filepath()를 M1Textbox node library에 제공한다.

    ## Test Code. (함수만 테스트)
    const m1font = require('./src/m1font').m1font;
    let font_url = 'https://s3.ap-northeast-2.amazonaws.com/redprintingweb.cloudfront/Edicus/font/Sandoll+GothicNeoRound+07+Bd.otf';
    m1font.get_font_filepath(font_url, 'sandol gothic', (err, font_file_path) => {
        console.log(font_file_path)
    })    

    ## m1textbox_node.min.js에 injection하는 방법은 아래와 같다
    let M1TextBox = require("../jslib/kayak/m1textbox_node.min.js");
    M1TextBox.TB_PlatformEnv.set({
        window : window,
        get_font_filepath: m1font.get_font_filepath     <<------
    })
*/

import type { PlatformEnvInit, GetFontFilepath, FsReadFile } from './types';

interface PlatformEnv {
	window: (Window & typeof globalThis) | null;
	document: Document | null;
	get_font_filepath: GetFontFilepath | null | undefined;
	delete_downloaded_font_file: ((font_key_name: string, download_folder: string) => Promise<unknown>) | null | undefined;
	fsReadFile: (() => FsReadFile) | null | undefined;
	set(env: PlatformEnvInit): void;
}

var _g: PlatformEnv = {
	window: null,
	document: null,
	get_font_filepath: null,
	delete_downloaded_font_file: null,
	fsReadFile: null,
	set: function(env: PlatformEnvInit) {
		// NodeJs에서 실행되는 경우에는 set()을 반드시 호출하여야 함.
		_g.window = env.window;
		_g.document = env.window.document;
		_g.get_font_filepath = env.get_font_filepath;
		_g.delete_downloaded_font_file = env.delete_downloaded_font_file;
		_g.fsReadFile = env.fsReadFile;

	}
}

if (typeof window == 'undefined') {
	console.log('run on NodeJs.');
}
else {
	_g.window = window;
	_g.document = document;
	_g.get_font_filepath = null;
	_g.delete_downloaded_font_file = null;
	_g.fsReadFile = null;
}

export default _g;
