# 04. 편집과 서식

키보드·마우스·IME 입력은 textbox가 스스로 처리한다. 이 문서의 메서드는 호스트가 **코드로** 편집할 때(툴바 버튼, 템플릿 채우기, 서버 측 변환) 쓴다.
모든 편집은 undo 스택에 쌓이고 [문서 변경 이벤트](01-getting-started.md#문서-변경-이벤트)를 보낸다(schema 모드는 이벤트 없음).

## 선택 범위

서식 메서드는 범위 `sel`을 받는다. 현재 선택은 `tb.tbcursor`에서 얻는다.

| 멤버 | 설명 |
|---|---|
| `tb.tbcursor.cursor` | 커서 위치 |
| `tb.tbcursor.sel()` | 현재 선택. 선택이 없으면 `{ cursor, begin: cursor, end: cursor, exists_range: false }` |
| `tb.tbcursor.sel_by_rule()` | 선택이 없으면 **문서 전체**를 돌려준다(`{ begin: 0, end: text_length(), exists_range: true, empty_originally: true }`). 툴바 버튼에 쓰는 기본값 |
| `tb.tbcursor.sel_all()` | 문서 전체 |
| `tb.tbcursor.set_selection(begin, end)` | 선택을 바꾼다. 커서는 `end`로 간다 |

직접 만든 범위를 넘겨도 된다: `{ begin: 0, end: 5 }`.

**`exists_range: false`의 의미.** 글자 서식 메서드(`set_font_size`, `set_bold`, `set_fontColor` 등)에 `exists_range: false`인 범위를 넘기면
문서는 바꾸지 않고 "다음에 입력할 글자의 서식"으로만 기억한다(undo 기록·이벤트 없음). 커서가 다른 곳으로 가면 잊는다.
`exists_range`를 생략한 범위는 실제 범위로 본다. 문단 서식과 박스 설정은 `exists_range`를 보지 않는다.

## 공통 매개변수

대부분의 메서드가 끝에 다음 두 매개변수를 받는다. 보통은 생략한다.

- `on_par_changed?: (err, text_change_info, par_change_info) => void` — 레이아웃 뒤에 불리는 콜백. 내부 변경 정보를 받는다
- `replacing?: boolean` — `true`면 문서 변경 이벤트에 `replacing: true`가 실린다. 연속 조작의 중간 값처럼 호스트 undo 단계로 세지 않을 변경에 쓴다

## 텍스트 편집 — `tb.opEdit`

| 메서드 | 설명 |
|---|---|
| `insert_string(cursor, str, on_par_changed?, opt?)` | `cursor` 위치에 `str`을 넣는다. **`str`에 `\n`이 있으면 안 된다.** `&nbsp;`(U+00A0)는 일반 공백으로 바뀐다 |
| `insert_multiline_string(cursor, str, on_par_changed?, opt?)` | `\n`을 포함한 글을 넣는다. 줄마다 따로 넣으므로 undo 단계가 여러 개 생긴다 |
| `insert(cursor, charCode, on_par_changed?, opt?)` | 문자 하나. `10`/`13`이면 문단 나누기(한 줄 모드·text-on-path에서는 무시) |
| `erase(cursor, sel_begin, sel_end, on_par_changed?, opt?)` | `sel_begin < sel_end`면 그 범위를 지운다. 같으면 `cursor` 위치의 한 글자를 지운다(Delete 키). 문서 끝의 `\n`은 지우지 않는다 |
| `undo(on_par_changed?, opt?)`, `redo(on_par_changed?, opt?)` | 한 단계 되돌리기/다시 하기. 되돌린 범위가 선택된다(`opt.dont_select_range: true`면 선택하지 않음) |
| `copy(clipboard, begin, end)`, `cut(clipboard, begin, end)` | 범위를 클립보드로. `clipboard`는 `GT_MasterClipboard.getInstance()` |
| `paste(clipboard, sel, on_par_changed?)` | `sel` 범위를 지우고 클립보드 내용을 넣는다 |

`opt`(`insert`, `insert_string`, `insert_multiline_string`, `erase`):

| 키 | 설명 |
|---|---|
| `user_data` | 문서 변경 이벤트에 그대로 실린다 |
| `replace` | (`insert`, `insert_string`, `insert_multiline_string`만) 이벤트에 `replacing: true` |
| `reset` | (`insert_string`만) 넣은 뒤 undo 기록을 지우고 이벤트를 보내지 않는다 |

`paste`의 이벤트에는 `user_data`와 `replacing`이 실리지 않는다.

글자를 넣으면 넣은 자리 바로 앞 글자의 서식을 이어받는다. 지운 직후 같은 자리에 넣으면 지운 범위 첫 글자의 서식을 쓴다.

```ts
const len = tb.text_length();
tb.opEdit.erase(0, 0, len);                           // 전부 지우기 (끝의 \n은 남는다)
tb.opEdit.insert_multiline_string(0, 'line 1\nline 2');
tb.opEdit.undo();                                     // 'line 2'만 사라진다 (줄마다 한 단계)
```

## 글자 서식 — `tb.opStyle`

| 메서드 | 값 |
|---|---|
| `set_font_family(family, style, sel, on_par_changed?): Promise<void>` | 폰트 목록의 family/style 이름. 편집 모드에서는 폰트를 내려받은 뒤 적용하므로 Promise를 기다린다. 폰트 로딩에 실패하면 적용하지 않고 Promise도 끝나지 않는다(reject 없음) |
| `set_font_size(pt, sel, on_par_changed?, replacing?, opt?)` | pt |
| `set_bold(val, sel, on_par_changed?)` | `'bold'`/`'700'` → 굵게, `'normal'`/`'400'` → 보통, `null` → 토글(범위가 한 가지 상태면 반대로, 섞여 있으면 굵게). 그 밖의 문자열은 보통 |
| `set_fontColor(color, cmyk?, model?, sel?, on_par_changed?, replacing?, opt?)` | 아래 참고 |
| `set_letter_space(val, sel, on_par_changed?, replacing?)` | em/1000 (예: `-50`, `100`) |
| `set_letter_scale_x(percent, sel, on_par_changed?, replacing?, opt?)` | 장평 %. 100이 기본 |
| `set_stroke(stroke, sel, on_par_changed?, replacing?)` | [외곽선](#외곽선과-그림자) |
| `set_shadow(shadow, sel, on_par_changed?, replacing?)` | [그림자](#외곽선과-그림자) |

주의: `bold`는 속성으로 저장되고 `'html'` 렌더 모드와 복사할 때 만드는 HTML에서 `font-weight`로 쓰일 뿐, 기본인 SVG 렌더링(화면과 `snapshotAsSVG`)에서는 글자 모양이 **바뀌지 않는다**. 굵은 글자가 필요하면 `set_font_family`로 폰트의 Bold 스타일을 고른다.

### 색

```ts
const sel = tb.tbcursor.sel_by_rule();
tb.opStyle.set_fontColor('#ff0000', [0, 100, 100, 0], null, sel);                       // 단색 (rgb, cmyk)
tb.opStyle.set_fontColor('#0072bc', [100, 43, 0, 0], { type: 'SPOT', name: 'PANTONE 300 C' }, sel);   // 별색
```

- `color`: CSS 색 문자열(`'#rrggbb'`, `'black'` …) 또는 그라디언트 객체
- `cmyk`: `[c, m, y, k]` (0~100). 인쇄용 값으로 저장만 되고 화면에는 `color`를 쓴다
- `model`: 별색일 때 `{ type, name }`, 아니면 `null`
- 그라디언트: `{ type: 'linear' | 'radial', geom, stops: [{ offset, rgb, cmyk? }], angle? }`.
  `geom`은 linear면 `x1, y1, x2, y2`, radial이면 `cx, cy, r, fx, fy`. `offset`은 `'0%'` 같은 문자열

### 외곽선과 그림자

```ts
tb.opStyle.set_stroke({ weight: 1, align: 'outside', color: '#000000', join: 'round' }, sel);
tb.opStyle.set_shadow({ size: 0.5, angle: 135, distance: 1, opacity: 60, color: '#000000' }, sel);
```

| 외곽선 키 | 값 |
|---|---|
| `weight` | pt. `0`이면 없음 |
| `align` | `'center'`(글자 윤곽 중앙) 또는 `'outside'`(바깥) |
| `color` | CSS 색 |
| `join`, `miterlimit` | `'round'`(기본) / `'bevel'` / `'miter'`, miter 한계(기본 10) |

| 그림자 키 | 값 |
|---|---|
| `size` | 흐림 크기, mm. `0`과 `distance: 0`이면 없음 |
| `angle` | 도. 빛이 오는 방향(InDesign과 같다). 기본 135면 그림자가 오른쪽 아래로 생긴다 |
| `distance` | mm |
| `opacity` | 0~100 |
| `color` | CSS 색 |

## 문단 서식

범위가 걸친 문단 전체에 적용된다. 커서만 있으면(`begin == end`) 그 문단에 적용된다.

| 메서드 | 값 |
|---|---|
| `set_text_align(code, sel, on_par_changed?)` | `'left'`, `'center'`, `'right'`, `'left-justified'`, `'center-justified'`, `'right-justified'`, `'fully-justified'` (`left/center/right-justified`는 양쪽 맞춤에 문단 마지막 줄만 왼쪽/가운데/오른쪽 정렬, `fully-justified`는 마지막 줄까지 양쪽 맞춤) |
| `set_par_style(name, val, sel, on_par_changed?, replacing?)` | 아래 표. 모르는 `name`은 아무것도 하지 않는다 |

| `name` | 값 | 기본 |
|---|---|---|
| `'first'` | 첫 줄 들여쓰기, px (`'left'` 기준 상대값) | 0 |
| `'left'`, `'right'` | 왼쪽/오른쪽 들여쓰기, px | 0 |
| `'space_before'`, `'space_after'` | 문단 앞/뒤 간격, px | 0 |
| `'line_space'` | 줄 간격 배수(자동 행간) | 1.2 |
| `'leading'` | 행간 pt, 또는 `'auto'`(`line_space` 사용) | `'auto'` |

## 박스 설정

박스 전체에 적용되며 undo 스택에 쌓인다. `sel`을 받지 않는다.

고정 높이 박스의 세로 정렬은 아래 setter를 부를 때, `snapshotAsSVG*`를 부를 때, 그리고 `set_client_size_listener()`가 건 크기 감시가 동작할 때만 다시 계산된다.
편집 중에 화면의 세로 정렬이 따라오게 하려면 `set_client_size_listener()`를(콜백 없이라도) 한 번 불러 둔다.

| 메서드 | 설명 |
|---|---|
| `set_fit_to_content_height(bool, on_par_changed?)` | `true`(기본): 박스 높이가 내용에 맞춰 늘고 준다. `false`: 지금 높이로 고정한다 |
| `set_frame_height(px, on_par_changed?, replacing?)` | 고정 높이를 정한다. `replacing: true`면 높이만 바꾸고 undo 기록·이벤트를 남기지 않는다(드래그 중 미리보기), 끝날 때 `replacing` 없이 한 번 더 부른다 |
| `set_vertical_align(val, on_par_changed?)` | `'top'`, `'center'`, `'bottom'`. 고정 높이 박스에서 의미가 있으며, 부르면 고정 높이 모드로 바뀐다 |

이 값들과 한 줄 모드(`single_line_mode`), 장평 자동 맞춤(`fit_to_line_width_by_scale_x`)은 JSON의 `preference`에 저장된다.
한 줄 모드와 장평 자동 맞춤은 opStyle에 메서드가 없고 `tb.tbpreference.set_single_line_mode(bool)`, `tb.tbpreference.set_fit_to_line_width_by_scale_x(bool)`로 바꾼다(undo 기록 없음, 편집 모드 전용).
한 줄 모드는 문단이 하나일 때만 켜지고(아니면 경고 후 `false` 반환), 장평 자동 맞춤을 켜면 한 줄 모드도 함께 켠다.
한 줄 모드에서는 줄바꿈 입력이 무시되고 붙여넣은 글의 줄바꿈은 공백이 된다.
장평 자동 맞춤이 켜져 있으면 편집·서식 명령마다 [`layout_each_paragraph_in_a_single_line()`](03-textbox-api.md#일괄-서식)이 따라 실행되고, undo는 둘을 한 번에 되돌린다.

주의: `set_vertical_align` 뒤의 undo는 박스 높이를 정확히 되돌리지 못할 수 있다([issues.md #14](../issues.md)).

## text-on-path 설정

text-on-path textbox에서만 쓴다. undo 스택에 쌓인다.

| 메서드 | 값 |
|---|---|
| `set_textonpath_align(code)` | 글줄의 어느 높이를 경로에 맞출지: `'baseline'`, `'ascender'`, `'center'`, `'descender'` |
| `set_textonpath_flip_path(bool)` | 경로 반대편(뒤집힌 방향)에 놓는다 |
| `set_textonpath_bracket('begin' \| 'end', val)` | 글이 놓이는 구간의 시작/끝 bracket 위치 |

현재 값은 `tb.get_style_info(0).text_on_path`로 읽는다.

## Named range

```ts
tb.opStyle.set_range_id('customer_name', '고객 이름', { begin: 5, end: 9 });
tb.replace_text_with_range_id('customer_name', 'Alexander');
```

`id`는 문서 안에서 유일해야 한다. `exists_range: false` 범위를 넘기면 다음 입력에 붙는다. 읽기·바꾸기는 [03 — Named range](03-textbox-api.md#named-range).
