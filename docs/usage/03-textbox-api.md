# 03. textbox API

`tb`는 `new textbox(options)`로 만든 인스턴스다. 편집·서식은 [04. 편집과 서식](04-editing-and-style.md)에 따로 정리했다.
"편집 모드 전용"이라고 적힌 메서드는 schema 모드에서 부르면 TypeError가 난다([02](02-config.md#편집-모드와-schema-모드)).

## 수명주기

| 메서드 | 설명 |
|---|---|
| `init(): Promise<void>` | 기본 폰트를 로딩하고 레이아웃한 뒤 resolve. schema 모드는 바로 resolve. 폰트 로딩에 실패하면 reject되지 않고 pending으로 남는다(`set_user_font_listener`의 `'failed'`로 안다) |
| `is_initialized(): boolean` | `init()`이 끝났는지 |
| `attachTo(node, callback?)` | `node`에 붙인다. 이미 붙어 있으면 `callback('error')`, 성공하면 `callback(null)` 뒤 `'attached'` 이벤트. 편집 모드 전용 |
| `detach()` | DOM에서 떼고, **문서 변경 리스너를 모두 지우고**, 크기 감시(`set_client_size_listener`)를 끈다. 편집 모드 전용 |
| `destroy()` | 이 textbox가 쓰던 폰트 참조를 놓는다. DOM은 그대로이므로 `detach()` 뒤에 부른다. 편집 모드 전용 ([#20](../issues.md)) |
| `init_textonpath(opt)` | 이 textbox를 text-on-path로 바꾼다. `opt`는 [`text_on_path` 옵션](02-config.md#text-on-path)과 같다 |
| `class_name(): string` | `'textonpath'` 또는 `'textbox'` |
| `version: string` | 저장 JSON의 `version`에 들어가는 값. 새 textbox는 `'1.0.0'`이고, `loadFromJson()` 뒤에는 불러온 JSON의 `version`(없으면 `'legacy_181028'`)이 되어 이후 `saveAsJson()`에도 그 값이 저장된다 |

## 포커스와 선택 상태

textbox는 세 가지 상태를 가진다. 호스트의 마우스 처리에서 상태를 바꿔 준다.

| 상태 | 확인 | 들어가는 방법 | 의미 |
|---|---|---|---|
| none | `is_state_none()` | `set_blur()` | 선택 안 됨. 키 입력을 받지 않는다 |
| selected | `is_state_selected()` | `set_select()` | 박스가 객체로 선택됨(이동·크기 조절 대상). 키 입력을 받지 않는다 |
| focused | `is_state_focused()` | `set_focus(event?)` | 글 편집 중. 커서가 보이고 키보드·IME 입력을 받는다 |

- `set_focus(event)`에 마우스 이벤트를 넘기면 그 위치에 커서를 놓는다. 박스를 눌렀다가 움직이지 않고 뗐을 때 쓴다.
  `init()` 전에 부르면 경고만 남기고 무시한다.
- `set_blur()`, `set_select()`는 글 선택 범위도 지운다.
- 박스 안의 `click` 이벤트는 상태와 상관없이 전파가 막힌다. 호스트는 `mousedown`/`mouseup`으로 판단한다.
- focused 상태에서는 textbox가 자기 영역의 mousedown을 처리하고 전파를 막는다. 그 밖의 상태에서는 호스트가 받아
  드래그면 `set_select()`, 클릭이면 `set_focus(e)`를 부르고, 박스 바깥을 누르면 `set_blur()`를 부른다.
- `is_state_*`는 편집 모드 전용이다.

## 크기와 표시

| 메서드 | 설명 |
|---|---|
| `resizeBox({ content: { width }, page: { width } })` | 너비를 바꾸고 다시 레이아웃한 뒤 `'resizeBox'` 이벤트. 너비는 최소 1px. `init()` 전에는 크기만 바꾼다 |
| `get_dimension(): Dimension` | `{ page_width, page_height, visible_content_height, overflow }`. 편집 모드 전용. 아래 참고 |
| `scale(val)` | 화면 배율(CSS transform). 레이아웃 결과는 바뀌지 않는다 |
| `angle(val)` | 회전 각도(도)를 기록한다. 화면 회전은 호스트가 한다. text-on-path에는 반영된다 |
| `show_gutter(show)` | 박스 왼쪽 바깥에 글줄별 정보 패널을 보이거나 숨긴다(디버그용) |
| `setRenderMode(mode)` | `'svg'`(기본) 또는 `'html'`. 다른 값은 무시. 편집 모드 전용 |
| `mirror({ node, scale?, enable_debounce? })` | 현재 화면을 `node`에 복제한다(축소 미리보기용). `enable_debounce`면 300ms 디바운스 |
| `fit_width_to_first_paragraph({ avoid_shrink?, extra_margin? })` | 첫 문단이 한 줄에 들어가도록 박스 너비를 맞춘다. `avoid_shrink`면 줄어드는 경우는 하지 않는다. `extra_margin`(px, 기본 1) |

`get_dimension()`의 값:

- `page_width`: `page.width`
- `page_height`: 내용에 맞춤(`fit_to_content_height`, 기본)이면 `visible_content_height + gutter_top + gutter_bottom`, 아니면 프레임 높이
- `visible_content_height`: 글이 실제로 차지하는 높이
- `overflow`: 고정 높이에서 글이 넘치면 `true`

박스 높이 모드는 [04 — 박스 설정](04-editing-and-style.md#박스-설정)을 본다.

## 텍스트와 서식 조회

| 메서드 | 설명 |
|---|---|
| `text_length(): number` / `getLength()` | 문서 길이. 끝의 `\n` 포함(빈 문서는 1) |
| `select_all_text()` | 전체를 선택 상태로 만든다 |
| `get_style_info(ci): CurrentStyleInfo` | 위치 `ci`의 글자·문단 서식. 아래 참고 |
| `get_history_stack_pointer(): number` | undo 스택의 현재 위치. 호스트 undo와 맞출 때 쓴다 |
| `reset_all()` | 내용을 모두 지우고 undo 기록도 지운다 |
| `reset_history()` | undo 기록만 지운다 |

평문 텍스트가 필요하면 `saveAsJson().text_raw`를 쓴다(끝의 `\n` 포함. schema 모드에서는 `saveAsJson({ font_list })`).
`saveAsJson()`은 매번 검사와 폰트 정보 수집을 하므로 이벤트마다 부르기에는 가볍지 않다.

`get_style_info(ci)`가 돌려주는 키:

| 키 | 값 |
|---|---|
| `familyName`, `typeStyle` | 폰트 |
| `FontSize` | 글자 크기(pt) |
| `bold` | boolean |
| `fontColor`, `fontColorCMYK`, `fontColorModel`, `gradient` | 색. `gradient`가 있으면 그라디언트 |
| `letter_space`, `letter_scale_x` | 자간(em/1000), 장평(%) |
| `stroke`, `shadow` | 외곽선, 그림자 ([04](04-editing-and-style.md#외곽선과-그림자)) |
| `var_name`, `title` | named range. 범위 밖이면 `var_name`이 `'_na_'` |
| `align`, `findent`, `lindent`, `rindent`, `space_before`, `space_after`, `line_space`, `leading` | 문단 서식 |
| `vertical_align`, `fit_to_content_height`, `frame_height` | 박스 설정 |
| `text_on_path` | text-on-path일 때만. `{ align_to_path, flip_path, start_bracket, end_bracket }` |

## JSON 저장과 불러오기

### `saveAsJson(opt?: { font_list? }): KayakJsonObject`

현재 문서를 kayak JSON 객체로 돌려준다(문자열이 아니다). 주요 키:

| 키 | 내용 |
|---|---|
| `version`, `meta`, `preference` | 버전, `linebreak_tolerance`, 박스 설정(높이 모드, 세로 정렬 등) |
| `text_arr`, `text_raw` | 문자 코드 배열, 평문 |
| `font_used` | 쓰인 폰트의 url/issue. 기본 폰트는 `default: true`. 폰트 목록이 바뀌어도 다시 불러올 수 있게 한다 |
| `fonts_unresolved` | 폰트 목록에서 찾지 못한 폰트(`"family/style"`). 있을 때만 |
| `ATTR_Par`, `ATTR_Doc`, `ATTR_FontFamily`, `ATTR_FontSize`, `ATTR_Bold`, `ATTR_FontColor`, `ATTR_LetterSpacing`, `ATTR_LetterScaleX`, `ATTR_Stroke`, `ATTR_Shadow`, `ATTR_NamedRange` | 서식 레이어 (run-length) |
| `text_on_path` | text-on-path일 때만 |

`opt.font_list`는 schema 모드에서 필수다([#17](../issues.md)). 편집 모드는 textbox의 폰트 목록을 쓴다.

주의: 돌려받은 객체의 `text_arr`는 복사본이 아니라 textbox 내부 배열 그 자체다. 저장한 뒤 편집하면 그 객체의 `text_arr`도 함께 바뀌어 `text_raw`와 어긋난다.
저장해 둘 때는 바로 `JSON.stringify()`하거나 `text_arr`를 복사한다.

### `loadFromJson(json_str: string, opt?): Promise<LoadJsonResult>`

kayak JSON **문자열**을 불러온다. 편집 모드 전용.

1. 기존 내용과 undo 기록을 지운다(내용이 있었으면 `'erase'` 이벤트가 한 번 간다)
2. JSON을 검사하고 고칠 수 있는 것은 고친다. 결과는 `verify_result`(`code`가 `'pass'`가 아니면 에러 로그)
3. 쓰인 폰트를 모두 로딩한다(`font_used`의 url 우선, 없으면 폰트 목록에서 찾는다)
4. 내용을 채우고 레이아웃한 뒤 `'loadFromJson'` 이벤트

결과:
- `{ verify_result, default_font_used }`. `default_font_used`는 지정 폰트에 없는 글자를 기본 폰트로 그린 곳이 있으면 `true`
- `text_arr`가 비어 있으면 `{ warning: 'invalid kayak json.' }` (내용은 이미 지워진 상태)

`opt`(`LoadJsonOptions`):
- JSON에 `text_on_path`가 있어도 기본적으로는 **무시한다**. `remove_textonpath_if_already_exist: true`이면서 `ignore_text_on_path`가 `true`가 아닐 때만 JSON의 경로로 text-on-path를 만든다.
- 일반 textbox로 만든 것에 text-on-path JSON을 넣지 않으려면 `{ remove_textonpath_if_already_exist: true, ignore_text_on_path: !tb.text_on_path }`처럼 쓴다(샘플 호스트 `SimpleTextBox.js`의 방식).

### `importFromInDesignJson(json, font_list?): IndConvertResult`

InDesign 스크립트가 내보낸 TextFrame JSON(문자열 또는 객체)을 kayak JSON으로 **변환만** 한다. 이 textbox의 내용은 바뀌지 않는다.
결과는 `{ kayak_json, dim_px: { width, height }, font_family_remap_occurred }`이고, 불러오려면 `loadFromJson(JSON.stringify(r.kayak_json))`.
`font_list`를 생략하면 이 textbox의 폰트 목록을 쓴다(schema 모드에서는 생략할 수 없다, [#20](../issues.md)).
text-on-path 프레임의 경로는 이 메서드로는 변환되지 않는다. 직접 변환은 [`TB_InDesignJsonConverter`](05-helpers.md#tb_indesignjsonconverter)를 본다.

## SVG 내보내기

모두 편집 모드 전용이다. 좌표 단위는 px.

| 메서드 | 결과 |
|---|---|
| `snapshotAsSVG(opt?, callback?): string` | 박스 크기의 `<svg>` 문자열. 글자는 `<path>`로 그려져 폰트 없이도 같게 보인다 |
| `snapshotAsSVGData(opt?): SvgSnapshotData` | SVG를 만들기 전의 데이터. 글줄마다 `{ x, y, svg_paths: [{ d, fill, fill_cmyk, stroke, shadow, gradient … }] }`와 `frame_width/height`, `viewbox_offset`, `bbox`. PDF 생성 등에서 직접 그릴 때 쓴다 |
| `getBBox(opt?): ContentBBox` | 실제 잉크 영역 `{ min_x, min_y, max_x, max_y, w, h }`(외곽선 두께 포함). 글이 없으면 모두 0 |
| `snapshotAsSVGInContentBBox({ padding? }): ContentBBoxSvg` | 잉크 영역만 잘라낸 SVG. `{ bbox, padded_box, svg_str }`. `padding`은 `[left, top, right, bottom]` |

`snapshotAsSVG`의 `opt`:

| 옵션 | 설명 |
|---|---|
| `path_only` | `<svg>` 바깥 태그 없이 내용만 |
| `cropbox: { x, y, w, h }` | 이 영역만 잘라서 그 크기의 SVG로 |
| `padding: [l, t, r, b]` | 바깥에 여백을 더한다 |
| `viewbox_offset: { x, y }` | viewBox 원점을 옮긴다(외곽선이 박스 밖으로 나가는 만큼 키울 때). `cropbox`와 같이 쓰지 않는다 |
| `render_master_color_only: { fill }` | 이 색으로 칠한 글자만 그린다(색 분판) |
| `shadow_as_image` | 그림자를 이미지로 바꿀 정보를 `callback(shadow_info_arr, frame)`으로 준다. 서버에서 그림자를 PNG로 만들어 넣을 때 쓴다 |

`snapshotAsSVGData`는 이 밖에 `override_fill_color: { fill, fill_cmyk?, transparent_by_src_color? }`로 모든 글자 색을 바꿔 받을 수 있다.

## 폰트와 색 정보

| 메서드 | 설명 |
|---|---|
| `gather_used_fonts(): Record<string, FontItem>` | 쓰인 폰트. 키는 `"family/style"`. 기본 폰트는 실제로 안 쓰여도 항상 들어간다(다른 폰트에 없는 글자를 기본 폰트로 그리므로) |
| `gather_used_font_list_info(): { used_fonts, unresolved_fonts }` | 위 폰트를 폰트 목록에서 찾은 항목(url 포함)과 찾지 못한 것. `saveAsJson()`의 `font_used`가 이것이다 |
| `gather_used_colors(json_str?)` | 쓰인 글자 색. 키는 `rgb`, 값은 `{ rgb, cmyk }`. `json_str`을 주면 현재 문서 대신 그 JSON에서 모은다 |
| `get_font_group_id(): string \| null` | 이 textbox가 실제로 쓰는 폰트 목록 id(옵션 값 그대로가 아닐 수 있다, [05](05-helpers.md#폰트-목록-고르기)). 편집 모드 전용 |
| `get_font_loading_state()` | `'loaded' \| 'loading' \| 'failed'`. 편집 모드 전용 |

`gather_used_colors`의 `cmyk`는 문서에 따라 `number[]`이거나 `'0,0,0,100'` 같은 문자열이다(InDesign 변환·HTML 붙여넣기로 들어온 색, [#16](../issues.md)).

## 리스너

| 메서드 | 콜백이 불리는 때 |
|---|---|
| `add_doc_change_listener(cb)` / `remove_doc_change_listener(cb?)` | 문서가 바뀔 때. `cb({ cmd, replacing?, user_data? })`. `remove`에 인자를 주지 않으면 모두 지운다. 이벤트 목록은 [01](01-getting-started.md#문서-변경-이벤트) |
| `set_user_style_listener(cb)` | 커서가 움직이거나 선택이 바뀔 때. `cb(tbcursor)`. 툴바 갱신에 쓴다 ([06](06-recipes.md#툴바-연결)) |
| `set_user_font_listener(cb)` | 폰트 로딩 상태가 바뀔 때. `cb('loading' \| 'loaded' \| 'failed')`. 로딩 중에는 입력이 막힌다. `init()` 전에 건다 |
| `set_user_focus_listener(cb)` | focused 상태에서 textbox 안을 마우스/터치로 눌렀다 뗄 때 |
| `set_client_size_listener(cb?)` | 내용 크기가 바뀔 때. `cb(dimension)`. 이때 고정 높이 박스의 세로 정렬도 다시 계산한다. `detach()`가 감시를 끈다 |
| `set_keyboard_event_filter(cb)` | 키를 누를 때(keydown). `cb(event)`가 `true`를 돌려주면 textbox는 그 키를 처리하지 않는다. 호스트 단축키(예: Ctrl+Z를 호스트 undo로)를 가로챌 때 쓴다 |

각 `set_*` 리스너는 하나만 유지된다(다시 부르면 바뀐다). 문서 변경 리스너만 여러 개 둘 수 있다.

## 일괄 서식

글 전체를 대상으로 하는 편의 메서드. 편집 모드 전용이고, 결과는 일반 서식 명령처럼 undo 스택에 쌓인다.

| 메서드 | 설명 |
|---|---|
| `layout_each_paragraph_in_a_single_line({ respect_segments_letter_scale? })` | 문단마다 장평을 줄여 한 줄에 들어가게 한다. 기본은 문단 안의 장평 비율을 유지하며 줄이고, `respect_segments_letter_scale: false`면 장평을 100%로 되돌린 뒤 다시 계산한다 |
| `shrink_font_size_to_fit_to_page_height()` | 고정 높이 박스에서 글이 넘치면 전체 글자 크기를 줄여 맞춘다. 문단이 하나일 때를 위한 것이고, 내용 맞춤 모드에서는 아무것도 하지 않는다 |
| `clamp_font_size(max)` | `max`(pt)보다 큰 글자를 `max`로. 여러 구간이 바뀌어도 `opEdit.undo()` 한 번에 함께 되돌아간다 |
| `replace_font_color([{ src: { fontColor }, dst: { fontColor, fontColorCMYK, fontColorModel } }, …])` | `src.fontColor`와 같은 색인 글자를 `dst`로 바꾼다. 바뀐 구간마다 따로 undo 단계와 `'set'` 이벤트가 생긴다(`clamp_font_size`와 달리 한 번에 되돌아가지 않는다) |

참고: `TB_Format.service.ts` 주석에는 `layout_each_paragraph_in_a_single_line()` 뒤의 undo가 한 단계 더 되돌아간다는 알려진 버그가 적혀 있다. 문서 작성 시점에 재현되지는 않았다.

## Named range

글의 일부에 이름(id)을 붙여 두고 나중에 그 부분만 읽거나 바꾼다(가변 데이터 템플릿용). 이름 붙이기는 `opStyle.set_range_id(id, title, sel)`([04](04-editing-and-style.md#named-range)).

| 메서드 | 설명 |
|---|---|
| `get_array_of_ranges()` | `[{ var_name, title, range: { begin, end } }, …]` |
| `get_text_by_range_id(id)` | `{ range, text }`. 없으면 `undefined` |
| `replace_text_with_range_id(id, text)` | 그 범위의 글을 `text`로 바꾼다(지우고 넣기 두 단계). 새 글은 지운 범위 첫 글자의 서식과 range id를 이어받는다 |

## 호스트가 부르지 않는 public 멤버

`style_listener`, `focus_listener`, `document_changed`, `apply_edit_operation`, `unmount_resize_observer`, `get_default_font`는 내부 모듈끼리 쓰는 것이다.
`get_html()`은 테스트용이며 부르면 TypeError가 난다([#13](../issues.md)).
`tb.tbconfig`, `tb.tbpreference`, `tb.layout` 같은 필드도 내부 구조이므로 이 문서에 적은 경로로만 쓴다(예외: 선택 범위를 얻는 `tb.tbcursor`, [04](04-editing-and-style.md#선택-범위)).
