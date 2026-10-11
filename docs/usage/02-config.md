# 02. 생성 옵션

`new textbox(options: TB_ConfigOptions)`

## 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `schema` | boolean | `false` | `true`면 schema 모드. [아래](#편집-모드와-schema-모드) 참고 |
| `base_node` | HTMLElement | `null` | 주면 생성할 때 바로 이 노드에 붙는다. 나중에 `attachTo()`로 붙여도 된다 |
| `page` | object | 아래 | 박스 바깥 크기 |
| `page.width` | number (px) | `500` | 박스 전체 너비 |
| `page.height` | number (px) | `200` | **현재 읽는 곳이 없다.** 박스 높이는 [`set_fit_to_content_height`/`set_frame_height`](04-editing-and-style.md#박스-설정)로 정한다 |
| `page.gutter_top`, `page.gutter_bottom` | number (px) | `10`, `10` | 위·아래 여백 |
| `page.scale` | number | `1` | 화면 배율. 생성 뒤에는 `scale()`로 바꾼다 |
| `content` | object | 아래 | 글이 놓이는 영역과 기본 서식 |
| `content.width` | number (px) | `400` | 줄바꿈 기준 너비. 좌우 여백은 `(page.width - content.width) / 2`씩 |
| `content.default_font_size` | number (pt) | `12` | 새 문서의 글자 크기 |
| `content.default_align` | string | `'left'` | 새 문서 첫 문단의 정렬 ([정렬 코드](04-editing-and-style.md#문단-서식)) |
| `content.default_font_color` | `{ rgb, cmyk }` | `{ rgb: 'black', cmyk: [0,0,0,100] }` | 새 문서의 글자 색 |
| `masterClipboard` | object | 없음 | `GT_MasterClipboard.getInstance()`. 편집 모드에서는 사실상 필수 |
| `font_list_id` | string | `null` | 쓸 폰트 목록의 id. `null`이거나 등록된 목록이 하나뿐이면 첫 번째 목록을 쓴다. [폰트 목록 고르기](05-helpers.md#폰트-목록-고르기) 참고 |
| `use_embedded_default_font` | boolean | `false` | `true`면 `loadFromJson()` 때 JSON의 `font_used`에 `default: true`로 적힌 폰트를 문서 기본 폰트로 쓴다. 폰트 목록이 바뀌어도 저장 당시의 대체 폰트를 유지하려는 용도 |
| `text_on_path` | object | `false` | 경로를 따라 글을 놓는 text-on-path 모드로 만든다. `{ svg_path_data, align_to_path?, flip_path?, start_bracket?, end_bracket? }`. **`schema: false`를 명시해야 적용된다** |
| `placeholder_text` | string | 없음 | `init()`이 이 글을 넣는다. undo 기록은 남지 않는다 |
| `linebreak_tolerance` | number | `0` | 줄 끝 단어가 아주 조금 넘칠 때 줄을 바꾸지 않고 허용하는 정도. JSON의 `meta`에 저장되고, `loadFromJson()`은 JSON에 이 값이 있으면 그 값으로 바꾼다 |
| `node_env.base_folder_for_download` | string | 없음 | Node에서 폰트 파일을 내려받을 폴더. 실제 폴더는 `<이 값>/<font_list_id>` |
| `debug` | object | 모두 `false` | `show_linebox`(글줄 경계), `show_textonpath_bbox`, `show_line_gutter` |

- `mode`(`'box'`)는 저장만 되고 읽는 곳이 없다.
- 렌더링 방식(`'svg'`가 기본)은 생성 뒤 `setRenderMode('html' | 'svg')`로 바꾼다.
- 위에 없는 키도 그대로 내부 설정 객체(`tb.tbconfig`)에 복사된다.

### 주의: `page`와 `content`는 통째로 바뀐다

옵션은 `Object.assign`으로 기본값 위에 복사된다. 중첩 객체는 합쳐지지 않고 **교체**되므로,
`page: { width: 300 }`만 주면 `gutter_top`·`gutter_bottom`·`scale`이 없어져 `get_dimension().page_height`가 `NaN`이 된다.
`page`와 `content`를 줄 때는 위 표의 필드를 모두 준다. (`debug`만 기본값과 합쳐진다.)

`content`에서 빠진 필드는 이렇게 된다: `default_font_size`가 없으면 글자 크기 10pt,
`default_font_color`가 없으면 검정, `default_align`이 없으면 문단 정렬이 비어 있다(`get_style_info().align`이 `undefined`. 뒤에 만든 문단도 같다).

### text-on-path

```ts
const tb = new textbox({
    schema: false,                                   // 반드시 명시 (undefined면 text_on_path가 무시된다)
    page: { width: 600, height: 300, gutter_top: 0, gutter_bottom: 0, scale: 1 },
    content: { width: 600, default_font_size: 18, default_align: 'left', default_font_color: { rgb: 'black', cmyk: [0, 0, 0, 100] } },
    masterClipboard: GT_MasterClipboard.getInstance(),
    text_on_path: {
        svg_path_data: 'M 50 150 C 150 80, 200 80, 250 150',
        align_to_path: 'baseline',                   // 'baseline' | 'ascender' | 'center' | 'descender'
        flip_path: false,
    },
});
```

생성 뒤에 `tb.init_textonpath({ svg_path_data, ... })`로 바꿀 수도 있다.
text-on-path 모드에서는 줄바꿈 입력이 막히고, 화면에는 `.kayak-root`가 숨겨진 채 형제 노드 `.kayak-textonpath`에 그려진다.

## 편집 모드와 schema 모드

|  | 편집 모드 (기본) | schema 모드 (`schema: true`) |
|---|---|---|
| 용도 | 화면에 그리고 사용자가 편집 | JSON 생성·변환, 서버 측 텍스트 조작 |
| DOM | `.kayak-root` 생성 | 만들지 않음 |
| `init()` | 기본 폰트를 로딩한 뒤 resolve | 바로 resolve |
| 폰트 로딩 | 함 (`set_font_family`가 폰트 로딩 후 적용) | 하지 않음 (`set_font_family`가 즉시 적용) |
| 레이아웃 | 편집할 때마다 다시 계산 | 하지 않음 |
| 옵션 | 모두 읽음 | `font_list_id`와 `masterClipboard`만 읽음 |

schema 모드에서 쓸 수 있는 것: `opEdit`의 입력·삭제·undo/redo, `opStyle`의 서식 설정,
`text_length()`, `get_style_info()`, `saveAsJson({ font_list })`,
`gather_used_colors()`, `gather_used_fonts()`, named range 메서드.

schema 모드에서 쓰면 안 되는 것(TypeError): 화면·레이아웃에 닿는 메서드(`attachTo`, `detach`, `get_dimension`, `resizeBox`,
`snapshotAsSVG*`, `getBBox`, `mirror`, `is_state_*` 등)와 `loadFromJson()`(폰트 로더를 쓴다).
`set_focus`/`set_select`/`set_blur`는 오류 없이 아무것도 하지 않는다.

주의 (schema 모드):
- `saveAsJson()`은 `{ font_list }`를 넘겨야 한다. 넘기지 않으면 TypeError가 난다([issues.md #17](../issues.md)).
- `destroy()`, `get_font_group_id()`, `get_font_loading_state()`, font_list 없이 부른 `importFromInDesignJson()`은 TypeError가 난다([issues.md #20](../issues.md)).

```ts
const font_list = spFontManager._get_font_list('default-host-ko');
const s = new textbox({ schema: true, masterClipboard: GT_MasterClipboard.getInstance() });
s.init().then(() => {
    s.opEdit.insert_string(0, 'Hello');
    s.opStyle.set_font_size(24, { begin: 0, end: 5 });
    const json = s.saveAsJson({ font_list });     // schema 모드에서는 font_list 필수
});
```

편집 모드 textbox도 내부에 schema 모드 textbox를 하나 더 만들어 둔다(`tb.tb_schema`). HTML 붙여넣기를 해석할 때 쓰며 호스트가 만질 일은 없다.
