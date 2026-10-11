# 06. 예제 모음

## 툴바 연결

커서가 움직일 때 현재 서식을 툴바에 보여 주고, 버튼을 누르면 선택 범위(없으면 전체)에 적용한다.

```ts
tb.set_user_style_listener(cursor => {
    const style = tb.get_style_info(cursor.cursor);
    toolbar.update({
        family: style.familyName, style: style.typeStyle,
        size: style.FontSize, color: style.fontColor, align: style.align,
    });
});

function on_font_size(pt: number) {
    tb.opStyle.set_font_size(pt, tb.tbcursor.sel_by_rule());
}
function on_align(code: string) {
    tb.opStyle.set_text_align(code, tb.tbcursor.sel_by_rule());
}
async function on_font(family: string, style: string) {
    await tb.opStyle.set_font_family(family, style, tb.tbcursor.sel_by_rule());
}
```

- `sel_by_rule()`은 선택이 없으면 문서 전체를 준다. 커서 위치에만 "다음 입력 서식"으로 적용하고 싶으면 `sel()`을 넘긴다.
- 키우기/줄이기 버튼은 [`TB_FontSizeStepUtil`](05-helpers.md#tb_fontsizesteputil)의 `upper_font_size`/`lower_font_size`로 다음 값을 구한다.

## 호스트 undo와 연동

호스트가 문서 전체의 undo 스택을 가진 경우, textbox의 Ctrl+Z/Ctrl+Y를 가로채고 문서 변경 이벤트로 호스트 단계를 쌓는다.

```ts
tb.set_keyboard_event_filter(e => {
    if (e.ctrlKey && (e.key === 'z' || e.key === 'y')) {
        e.preventDefault();
        e.key === 'z' ? host_history.undo() : host_history.redo();
        return true;                          // textbox는 이 키를 처리하지 않는다
    }
    return false;
});

tb.add_doc_change_listener(e => {
    if (e.replacing) return;                  // IME 조합 중간 단계는 세지 않는다
    if (e.cmd === 'undo' || e.cmd === 'redo') return;   // 호스트가 부른 것과 IME 조합 중 내부 되돌리기 모두
    if (e.cmd === 'initialized' || e.cmd === 'attached' || e.cmd === 'loadFromJson') return;
    host_history.push({
        undo: () => tb.opEdit.undo(),
        redo: () => tb.opEdit.redo(),
    });
});
```

- `loadFromJson()` 직전에 오는 `erase` 이벤트도 걸러야 한다면, 불러오기 동안 플래그를 세워 무시한다.
- 한 동작이 이벤트를 여러 번 보내는 경우가 있다: `insert_multiline_string`(줄마다), `replace_text_with_range_id`(지우기+넣기), 일괄 서식(`clamp_font_size` 등), 장평 자동 맞춤이 켜진 박스의 편집.
  이 예제처럼 이벤트마다 단계를 쌓으면 호스트 단계 수와 textbox undo 단위가 어긋날 수 있다(장평 자동 맞춤과 `clamp_font_size`·`layout_each_paragraph_in_a_single_line`이 만든 여러 단계는 `opEdit.undo()` 한 번에 함께 되돌아가고, 그때 `undo` 이벤트는 단계 수만큼 온다).
  그런 동작은 호스트가 한 단계로 묶어 다루고, 필요하면 `get_history_stack_pointer()`로 textbox 쪽 위치를 확인한다.
- textbox 자체를 지우는 동작은 `detach()`로 빼 두고 undo 때 `attachTo()`로 되돌린다. `detach()`가 리스너를 지우므로 다시 등록한다.

## 외부에서 넣은 변경 구분하기

다른 입력창(예: 별도 textarea)과 내용을 맞출 때, 호스트가 넣은 변경이 다시 바깥으로 전파되지 않게 `user_data`로 표시한다.

```ts
function set_text_from_outside(text: string) {
    const opt = { user_data: { from_host: true } };
    tb.opEdit.erase(0, 0, tb.text_length(), null, opt);
    tb.opEdit.insert_multiline_string(0, text, null, opt);
}

tb.add_doc_change_listener(e => {
    if (e.user_data && e.user_data.from_host) return;
    textarea.value = tb.saveAsJson().text_raw!.replace(/\n$/, '');
});
```

## 고정 높이 박스와 넘침 확인

```ts
tb.opStyle.set_fit_to_content_height(false);   // 지금 높이로 고정
tb.opStyle.set_frame_height(120);              // px
tb.opStyle.set_vertical_align('center');
tb.set_client_size_listener(dim => {
    warning.hidden = !dim.overflow;            // 글이 박스를 넘치면 경고
});
```

넘친 글을 줄여 맞추려면 `tb.shrink_font_size_to_fit_to_page_height()`(문단 하나일 때), 한 줄로 맞추려면 `tb.layout_each_paragraph_in_a_single_line()`.

## 가변 데이터 템플릿

```ts
// 템플릿 만들기: "Dear NAME," 의 NAME에 이름을 붙인다
tb.opEdit.insert_string(0, 'Dear NAME,');
tb.opStyle.set_range_id('name', '받는 사람', { begin: 5, end: 9 });
const template = JSON.stringify(tb.saveAsJson());

// 채우기
tb.loadFromJson(template).then(() => {
    tb.replace_text_with_range_id('name', 'Alexander');
    const svg = tb.snapshotAsSVG();
});
```

바뀐 글은 원래 글의 서식(첫 글자 기준)과 range id를 이어받으므로, 다시 채울 수 있다.

## Node에서 kayak JSON을 SVG로

서버에서 화면 없이 렌더링한다. jsdom으로 DOM을 만들고, 폰트는 로컬 파일로 준비해 넘긴다.

```js
const fs = require('fs');
const { JSDOM } = require('jsdom');
const M1TextBox = require('./m1textbox_node.min.js');

const { window } = new JSDOM('<!DOCTYPE html><body></body>');
M1TextBox.TB_PlatformEnv.set({
    window,
    fsReadFile: () => fs.readFile,
    get_font_filepath: (font_url, font_issue, font_key_name, download_folder, cb) => {
        // font_url이 null이면 기본 폰트 경로를 준다. 아니면 download_folder에 받아 두고 경로를 준다.
        my_font_cache.get(font_url, font_issue, font_key_name, download_folder)
            .then(path => cb(null, path), err => cb(err));
    },
    delete_downloaded_font_file: (font_key_name, download_folder) => my_font_cache.remove(font_key_name, download_folder),
});

async function render(kayak_json_str, width) {
    const base = window.document.createElement('div');
    window.document.body.appendChild(base);

    const tb = new M1TextBox.textbox({
        schema: false,
        base_node: base,
        page: { width, height: 100, gutter_top: 0, gutter_bottom: 0, scale: 1 },
        content: { width, default_font_size: 12, default_align: 'left', default_font_color: { rgb: 'black', cmyk: [0, 0, 0, 100] } },
        font_list_id: 'default-host-ko',
        node_env: { base_folder_for_download: './font_download' },
        masterClipboard: M1TextBox.GT_MasterClipboard.getInstance(),
    });
    await tb.init();
    await tb.loadFromJson(kayak_json_str, { remove_textonpath_if_already_exist: true });
    const svg = tb.snapshotAsSVG();

    tb.detach();
    tb.destroy();
    base.remove();
    return svg;
}
```

- `TB_PlatformEnv.set()`은 프로세스에서 한 번, textbox를 만들기 전에 부른다.
- `remove_textonpath_if_already_exist: true`를 주어야 JSON의 text-on-path가 살아난다([03](03-textbox-api.md#loadfromjsonjson_str-string-opt-promiseloadjsonresult)).
- 그림자를 이미지로 넣어야 하는 출력(PDF 변환 등)은 `snapshotAsSVG({ shadow_as_image: true }, (shadow_info_arr, frame) => …)`로 그림자 정보를 받아 PNG를 만든다.
- 이 저장소의 `test/snapshot/helpers.js`가 같은 방식으로 Node 렌더링을 한다(모든 폰트 요청을 로컬 폰트 하나로 돌린다).

## InDesign JSON 가져오기

```ts
const r = tb.importFromInDesignJson(ind_json_str);      // 이 textbox의 폰트 목록으로 변환만 한다
tb.resizeBox({ content: { width: r.dim_px.width }, page: { width: r.dim_px.width } });
await tb.loadFromJson(JSON.stringify(r.kayak_json));
if (r.font_family_remap_occurred) console.log('폰트 이름을 폰트 목록에 맞게 바꿨다');
```

- 결과의 `dim_px`는 InDesign 프레임 크기(px)다. 박스 크기를 맞출 때 쓴다.
- InDesign에서 자동 크기 조절이 꺼진 프레임(`autoSizingType: 'OFF'`)은 고정 높이와 세로 정렬로 변환되어 결과의 `preference`에 들어가고, `loadFromJson()`이 적용한다. 그 밖의 프레임은 내용 맞춤 높이가 된다.
- text-on-path 프레임은 [`TB_InDesignJsonConverter`](05-helpers.md#tb_indesignjsonconverter)에 경로 `d`를 함께 넘겨 직접 변환한다.
