import type { ImeContext, ImeOptions } from '../types';

//////////////////////////////////////////////////////////////////////
// Safari ime
//////////////////////////////////////////////////////////////////////
function listener_safari_mac(e: any, ime_ctx: ImeContext, options: ImeOptions): void {
    console.log('e: ', e.type, e.data)
    
    if (e.type === 'keydown') {
        console.log('keydown e: ', e.type, e.keyCode)
        options.keydown(e);
    } else if (e.type === 'keyup') {
        options.keyup(e);
    }
    // 'input' 이벤트의 경우, enter키 입력시 ime_ctx.inp.textContent에 값이 없음어 textInput을 사용함.
    // } else if (e.type === 'input') {
    //     if (ime_ctx.isComposing == false) {
    //         ime_ctx.composed = ime_ctx.inp.textContent;

    //         // char code 160(즉 nbsp)를 일반 space로 변환함. chrome에서만 해당.
    //         ime_ctx.composed = ime_ctx.composed.replace(/\xA0/g, " ");
    //         options.composed_word(ime_ctx.composed);

    //         // key입력이 repeat될 때 clear해줌.
    //         ime_ctx.inp.textContent = '';
    //         options.log('-- clear input area. (on textInput)');
    //     }
    else if (e.type === 'textInput') {
        if (ime_ctx.isComposing == false && ime_ctx.last_composing_state != 'compositionend' ) {
            options.log('-- inner textInput: '  + ime_ctx.inp.textContent);

            ime_ctx.composed = e.data;

            // char code 160(즉 nbsp)를 일반 space로 변환함. chrome에서만 해당.
            ime_ctx.composed = ime_ctx.composed.replace(/\xA0/g, " ");
            options.composed_word(ime_ctx.composed, 'insert');

            // key입력이 repeat될 때 clear해줌.
            ime_ctx.inp.textContent = '';
            options.log('-- clear input area. (on textInput)');
        }

        ime_ctx.last_composing_state = '';
    } else if (e.type === 'compositionstart') {
        options.log('-- compositionstart: ' + ime_ctx.inp.textContent);
        
        // 이전 입력되어 있던 내용을 삭제해 주는 것임. 매우 중요
        ime_ctx.inp.textContent = '';
        options.composition_start();
        ime_ctx.isComposing = true;
    } else if (e.type === 'compositionupdate') {
        options.log('-- compositionupdate: ' + ime_ctx.inp.textContent);        
        options.log('-- e.data: ' + e.data);

        if (e.data.length > 0) {// ime composing중 focus를 잃은 경우에 length가 0임.
            ime_ctx.composing = e.data;
            options.composing_word(ime_ctx.composing);
        }
    } else if (e.type === 'compositionend') {
        options.log('-- compositionend: ' + ime_ctx.inp.textContent);
        options.log('-- e.data: ' + e.data);
        if (e.data.length == 0) { // backspace로 composition이 소멸되는 case
            // console.log('delete should be called.')
            options.composed_word(e.data, 'delete');
        }
        else {
            options.composed_word(e.data, 'replace');
        }

        ime_ctx.isComposing = false;
        ime_ctx.inp.textContent = '';

        // compositionend 직후, textInput이 이어서 발생하는데, 이때의 textInput을 무시하기 위해 상태를 설정.
        ime_ctx.last_composing_state = 'compositionend'
        
    } else if (e.type === 'copy') {// only for chrome
        console.log('copy called');
        options.on_copy(e);
    }
    else if (e.type === 'cut') // only for chrome
        options.on_cut(e);        
    else if (e.type === 'paste') // only for chrome
        options.on_paste(e);
}

export default listener_safari_mac;
