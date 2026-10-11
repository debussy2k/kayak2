import type { ImeContext, ImeOptions } from '../types';

//////////////////////////////////////////////////////////////////////
// ie edge
//////////////////////////////////////////////////////////////////////
/*
    ToDo 
*/
function listener_msie_edge(e: any, ime_ctx: ImeContext, options: ImeOptions): void {
    // console.log('keyType: ', e.type, e.keyCode)
    if (e.type === 'keydown') {
        if (e.keyCode != 229) {
            // shift, ctrl, alt, Caps Lock
            var skip = e.keyCode == 16 || e.keyCode == 18 || e.keyCode == 20;
            if (ime_ctx.composing.length > 0 && skip == false) {
                // ime 입력이 아니고, shift같은 보조key가 아니면 다음번 keypress event에서
                // replace되던 것은 그대로 확정되고, keypress된 것이 insert되는 것으로 일단락 된다.
                ime_ctx.composing = '';
                ime_ctx.inp.textContent = '';
            }
            options.keydown(e);
        }
    } else if (e.type === 'keyup') {
        if (ime_ctx.need_clear_text)
            ime_ctx.inp.textContent = '';
        ime_ctx.need_clear_text = false;

        if (e.keyCode !== 229)
            options.keyup(e);
    } else if (e.type === 'compositionstart') {
        // options.log('-- compositionstart: ' + ime_ctx.inp.textContent);
        if (ime_ctx.composing.length > 0)
            options.composing_word(' ', 'replace');
        else
            options.composing_word(' ', 'insert');
        
        ime_ctx.composing = ime_ctx.inp.textContent;
    } else if (e.type === 'compositionupdate') {
        // options.log('-- compositionupdate: ' + ime_ctx.inp.textContent);
        options.composing_word(ime_ctx.inp.textContent);
        ime_ctx.composing = ime_ctx.inp.textContent;
    } else if (e.type === 'compositionend') {
        // options.log('-- compositionend: ' + ime_ctx.inp.textContent);
        // options.log('-- e.data: ' + e.data);
        if (ime_ctx.inp.textContent.length == 0) {
            options.composed_word(e.data, 'delete');
        }
        else {
            options.composing_word(ime_ctx.inp.textContent);
            ime_ctx.composing = ime_ctx.inp.textContent;
        }
    } else if (e.type === 'keypress') {
        // console.log('e.key', e.key)
        if (e.key == 'Enter')
            ime_ctx.composed = '\n';
        else
            ime_ctx.composed = e.key;
        options.composed_word(ime_ctx.composed, 'insert');

        // key입력이 repeat될 때 clear해줌.
        // ime_ctx.inp.textContent = ''; // 여기에서는 바로 clear가 안됨.
        ime_ctx.need_clear_text = true;

        options.log('-- clear input area. (on keypress)');
    } else if (e.type === 'copy') {
        // console.log('document-copy for IE');
        options.on_copy(e);
    } else if (e.type === 'cut') {
        // console.log('document-copy for IE');
        options.on_cut(e);
    } else if (e.type === 'beforepaste') {
        // console.log('beforepaste')
        options.on_beforepaste(e);
    } else if (e.type === 'paste') {
        // console.log('paste')
        options.on_paste(e);
    }
}

export default listener_msie_edge;
