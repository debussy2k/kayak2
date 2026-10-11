import * as log from "loglevel";
import ATTR_Par from '../segment/ATTR_Par';
import ATTR_Doc from '../segment/ATTR_Doc';
import ATTR_FontFamily from '../segment/ATTR_FontFamily';
import ATTR_FontSize from '../segment/ATTR_FontSize';
import ATTR_Bold from '../segment/ATTR_Bold';
import ATTR_FontColor from '../segment/ATTR_FontColor';
import ATTR_LetterSpacing from '../segment/ATTR_LetterSpacing';
import ATTR_LetterScaleX from '../segment/ATTR_LetterScaleX';
import type { KayakJsonObject, VerifyOptions, VerifyResult } from './types';

/*
	return
	{
		code: 'pass' or 'fail
		testcase_unresolved_fonts: {...}	// flag=='fail' 일때 포함됨
		testcase_ATTR_Count: {...}			// flag=='fail' 일때 포함됨
	}
*/
export class Textbox_Verify {
    run(obj: KayakJsonObject, opt?: VerifyOptions): VerifyResult {
		let result: VerifyResult = {
			code: 'pass'
		};

		let test_unresolved_fonts = this.check_Unresolved_font(obj, opt);
		if (test_unresolved_fonts.code != 'pass') {
			result.code = 'fail';
			result['testcase_unresolved_fonts'] = test_unresolved_fonts;
		}

		let tester = this.check_not_recoverable(obj, opt)
		if (tester.code != 'pass') {

		}


		let test_ATTR_Count = this.check_ATTR_Count(obj, opt);
		if (test_ATTR_Count.code != 'pass') {
			result.code = 'fail';
			result['testcase_ATTR_Count'] = test_ATTR_Count;
		}

		if (opt && opt.try_fix)
			this.fix_bug_preference_bug(obj)			

		return result;
	}

	verify_saved_json(obj: KayakJsonObject): VerifyResult {
		let result: VerifyResult | null = null;
		result = this.check_ATTR_is_empty(obj);
		if (result.code != 'pass')
			return result;
		
		result = this.check_ATTR_Count(obj) // opt.try_fix로 수정하지 말 것.
		if (result.code != 'pass')
			return result;

		return {
			code: 'pass'
		}
	}

	/*
		2019.5.3
		Problem : 
			photobook의 spine text를 ind2doc에서 처리할 때 
			kayak_json["preference"]에 값을 설정하고 ATTR_Doc에는 해당값을 설정하지 않아 불일치 문제가 발생함.
			이런 경우 kayak_json["ATTR_Doc"]이 없는 예전 버전도 있으니 별도 처리 할 것. 
		Solution :
			kayak_json["ATTR_Doc"]이 존재하는 경우 obj.preference에 있는 내용이 ATTR_Doc의 값이 일치 하지 않으면
			obj.ATTR_Doc의 내용을 obj.preference의 값으로 변경함.
			kayak_json["ATTR_Doc"]이 없는 경우에는 이것을 생성한 후 값을 복사함.

		참고 : ind2doc.ts:convertTextFrame()의 spine_text관련 코드
	*/
	fix_bug_preference_bug(obj: KayakJsonObject): void {
		if (obj.preference && obj.ATTR_Doc == undefined) {
			obj.ATTR_Doc = [{
				m_nCount : obj.text_arr.length,
				fit_to_content_height : obj.preference.fit_to_content_height,
				vertical_align : obj.preference.vertical_justification,
				frame_height : obj.preference.frame_height
			}]
		}
		else if (obj.preference && obj.ATTR_Doc && obj.ATTR_Doc.length == 1) {
			if (obj.preference.fit_to_content_height !== obj.ATTR_Doc[0].fit_to_content_height) {
				obj.ATTR_Doc[0].fit_to_content_height = obj.preference.fit_to_content_height;
				obj.ATTR_Doc[0].vertical_align = obj.preference.vertical_justification;
				obj.ATTR_Doc[0].frame_height = obj.preference.frame_height;

				log.warn('kayak json bug fixed: kayak_json["preference"] in photobook spine text')
			}
			else if (obj.preference.fit_to_content_height == false) {
				// test data : error_data/kayak-20200429-frame-height-not-match.json
				if (obj.ATTR_Doc[0].frame_height != obj.preference.frame_height) {
					obj.ATTR_Doc[0].frame_height = obj.preference.frame_height;
					log.warn('kayak json bug fixed: frame_height not matched')
				}
			}

			if (obj.preference.vertical_justification !== obj.ATTR_Doc[0].vertical_align) {
				obj.ATTR_Doc[0].vertical_align = obj.preference.vertical_justification;
				log.warn('kayak json bug fixed: vertical_justification not matched')
			}
		}
	}
	

	//////////////////////////////////////////////////////////////////////////////////////
	check_Unresolved_font(obj: KayakJsonObject, opt?: VerifyOptions): VerifyResult {
		let result: VerifyResult = {
			code:'pass',
			error_message: ''
		}
		if (obj.fonts_unresolved) {
			result.code = 'fail';
			result.error_message = 'unresolved fonts found',
			result.fonts_unresolved = obj.fonts_unresolved
		}

		return result;
	}

	check_not_recoverable(obj: KayakJsonObject, opt?: VerifyOptions): VerifyResult {
		let keys = Object.keys(obj)
		let text_length = obj.text_arr.length;		
		let result: VerifyResult = {
			code: 'pass',
			error_message: '',
		};
		
		let pass = true;
        for(let i=0; i<keys.length; i++) {
            let key = keys[i];
            if (key.substr(0, 5) == 'ATTR_') {
				if (obj[key].length == 0) {
					pass = false;
					break;
				}
            }
		}

		/* 2019/12/10 
			ATTR_*의 array length가 0인 경우 복구불가함. 내용을 reset하여 리턴함.
			문제의 샘플 json파일 위치 :
				./error_data/kayak-191210-not-recoverable.json
		*/
		if (pass == false && (opt && opt.try_fix))
			this.reset_data(obj, opt);

		return result;
	}

	reset_data(obj: KayakJsonObject, opt: VerifyOptions): void {
		let keys = Object.keys(obj)
		let default_font = opt.tb!.get_default_font(); 

		for(let i=0; i<keys.length; i++) {
			let key = keys[i];
			if (key.substr(0, 5) == 'ATTR_') {
				// console.log(key)
				switch(key) {
					case 'ATTR_Bold':
						obj[key] = [(new ATTR_Bold()).getDataObject()];
						break;
					case 'ATTR_Doc':
						obj[key] = [(new ATTR_Doc()).getDataObject()];
						break;
					case 'ATTR_FontColor':
						obj[key] = [(new ATTR_FontColor()).getDataObject()];
						break;
					case 'ATTR_FontFamily':
						// 원본은 getDataObject(default_font.familyName, default_font.typeStyle)로 불렀지만 getDataObject()는 인자를 받지 않는다(무시됨). issues.md #11
						obj[key] = [(new ATTR_FontFamily()).getDataObject()];
						break;
					case 'ATTR_FontSize':
						obj[key] = [(new ATTR_FontSize()).getDataObject()];
						break;
					case 'ATTR_LetterScaleX':
						obj[key] = [(new ATTR_LetterScaleX()).getDataObject()];
						break;
					case 'ATTR_LetterSpacing':
						obj[key] = [(new ATTR_LetterSpacing()).getDataObject()];
						break;
					case 'ATTR_Par':
						obj[key] = [(new ATTR_Par()).getDataObject()];
						break;
				} // swtich
			}
		}
		obj["text_arr"] = [10];
		obj["text_raw"] = "\n";
	}

	check_ATTR_Count(obj: KayakJsonObject, opt?: VerifyOptions): VerifyResult {
		let keys = Object.keys(obj)
		let text_length = obj.text_arr.length;		
		let result: VerifyResult = {
			code: 'pass',
			error_message: '',
			text_raw: obj.text_raw,
			text_length: text_length,
			data : []
		};
		
        for(let i=0; i<keys.length; i++) {
            let key = keys[i];
            if (key.substr(0, 5) == 'ATTR_') {
				let sum = obj[key].reduce((sum: number, item: { m_nCount: number }) => { return sum += item.m_nCount}, 0);
				result.data!.push({
					attr: key,
					sum: sum
				})

				if (sum !== text_length) {
					result.code ='fail';
					result.error_message = `sum of text count in ${key} is not equals ${text_length}`;

					if (opt && opt.try_fix) {
						let last_index = obj[key].length - 1;
						if (text_length == 1 && obj[key].length == 0) {
							/* 2020.1.28
								ATTR_Stroke, ATTR_Shadow가 []인 경우의 문제임.
								- text_length가 1인 경우는 \n만 가진 기본 상태이므로, 해당 key 자체를 제거해 줌.
								문제의 샘플 json :
									.error_data/kayak-200128-ATTR_Stroke-and-ATTR_Shadow-bug--kayak.json

							*/ 
							delete obj[key]
						}
						else if (text_length-sum > 0) { // text length보다 sum이 모자라면 보충하고, 넘치면 포기한다.
							// 보정작업
							/* 2019/2/21 
								ATTR_FontSize의 m_nCount 합계가 text_length보다 작은 경우가 발생하여 보정함. 
								- 원인파악은 하지 못했음
								- 보정하는 아래 if문 이하에 추가함.
								문제의 샘플 json파일은 파일 위치 :
									./error_data/kayak-190221-ATTR_FontSize-count-bug--kayak.json
							*/

							obj[key][last_index].m_nCount += (text_length-sum);
						}
					}							
				}
            }
		}
		// if (result.code !== 'pass')
		// 	console.log(result)
		return result;
	}

	check_ATTR_is_empty(obj: KayakJsonObject, opt?: VerifyOptions): VerifyResult {
		let result: VerifyResult = {
			code: 'pass',
			error_message : ''
		};

        let keys = Object.keys(obj)
        let ret = null;
        for(let i=0; i<keys.length; i++) {
            let key = keys[i];
            if (key.substr(0, 5) == 'ATTR_') {
                if (obj[key].length == 0) {
					result.code = 'fail'
					result.message = `${key} is empty`
                    break;
                }
            }
        }
        return result;		
	}
}