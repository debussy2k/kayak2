# 01. 시작하기

## 번들 넣기

`<script>`로 넣으면 전역 `M1TextBox`가 생긴다.

```html
<script src="m1textbox.min.js"></script>
<div id="box"></div>
```

모듈로 쓰는 경우:

```ts
import { textbox, GT_MasterClipboard } from './m1textbox';   // m1textbox.min.js + m1textbox.d.ts
```

로드되는 순간 Kayak 기본 CSS(`.kayak-root`, `.kayak-cursor` 등)가 `<head>`에 들어간다. 따로 CSS 파일을 넣을 필요는 없다.

## 최소 예제

```ts
import { textbox, GT_MasterClipboard } from './m1textbox';

const tb = new textbox({
    page:    { width: 400, height: 200, gutter_top: 0, gutter_bottom: 0, scale: 1 },
    content: { width: 380, default_font_size: 18, default_align: 'left',
               default_font_color: { rgb: 'black', cmyk: [0, 0, 0, 100] } },
    masterClipboard: GT_MasterClipboard.getInstance(),
});

// 폰트 로딩 리스너는 init() 전에 건다 (init()이 기본 폰트를 로딩하므로)
tb.set_user_font_listener(state => console.log('font', state));   // 'loading' | 'loaded' | 'failed'

tb.init().then(() => {
    tb.attachTo(document.getElementById('box')!);
    tb.add_doc_change_listener(e => console.log('changed:', e.cmd));
    tb.opEdit.insert_string(0, 'Hello Kayak');
    tb.set_focus();
});
```

- `page`와 `content`는 **모든 필드를 준다**. 일부만 주면 나머지 필드가 사라진다([02. 생성 옵션](02-config.md#주의-page와-content는-통째로-바뀐다)).
- `masterClipboard`를 주지 않으면 복사·잘라내기·붙여넣기에서 TypeError가 난다. 모든 textbox에 같은 `GT_MasterClipboard.getInstance()`를 넘긴다.
- `base_node` 옵션으로 생성할 때 바로 붙일 수도 있다. 그 경우 `attachTo()`를 다시 부르면 실패한다(콜백에 `'error'`).

## 수명주기

```
new textbox(options)      DOM(.kayak-root)과 내부 객체 생성. base_node가 있으면 여기서 붙는다
  │
  ├─ set_user_font_listener(...)     ← init() 전에
  │
init()  → Promise         기본 폰트 로딩 → 전체 레이아웃 → placeholder_text 입력
  │                       → 'initialized' 이벤트. (schema 모드는 바로 resolve)
  │                       기본 폰트 로딩에 실패하면 reject되지 않고 계속 pending이다
  │
attachTo(node, cb?)       node에 .kayak-root를 붙인다 → 'attached' 이벤트
  │
  ├─ 리스너 등록, 편집, loadFromJson(), snapshotAsSVG() ...
  │
detach()                  DOM에서 떼고, 문서 변경 리스너를 **모두** 지우고, 크기 감시를 끈다
  │                       (다시 attachTo() 할 수 있다. 리스너는 다시 등록해야 한다)
  │
destroy()                 이 textbox가 쓰던 폰트 참조를 놓는다. DOM은 건드리지 않으므로 detach() 뒤에 부른다
```

- `detach()`/`attachTo()`는 textbox를 버리지 않고 화면에서만 뺐다가 되돌리는 용도다(호스트의 "textbox 삭제"를 undo할 수 있게).
- `init()`의 실패는 Promise로 알 수 없다. `set_user_font_listener`로 `'failed'`를 받아 처리한다.
- `init()`이 끝나기 전에는 `set_focus()`가 경고만 남기고 무시되고, `resizeBox()`는 크기만 바꾸고 레이아웃을 하지 않는다.
- 주의: schema 모드에서 `destroy()`를 부르면 TypeError가 난다([issues.md #20](../issues.md)). schema 모드 textbox는 정리할 것이 없으므로 부르지 않는다.

## 문서 변경 이벤트

`add_doc_change_listener(cb)`로 등록한 콜백은 문서가 바뀔 때마다 `{ cmd, replacing?, user_data? }`를 받는다.

| `cmd` | 언제 |
|---|---|
| `initialized` | `init()` 완료 |
| `attached` | `attachTo()` 완료 |
| `insert`, `insert_string`, `erase`, `paste` | 텍스트 입력·삭제·붙여넣기 (키보드 입력 포함) |
| `set` | 글자 서식 변경 (`set_font_size`, `set_bold`, `set_fontColor` …) |
| `set_par` | 문단 서식 변경 (`set_text_align`, `set_par_style`) |
| `set_vertical_align`, `fit_to_content_height`, `set_frame_height` | 박스 설정 변경 |
| `undo`, `redo` | undo/redo |
| `resizeBox` | `resizeBox()` (init 뒤에만) |
| `loadFromJson` | `loadFromJson()` 완료. 내용이 있던 박스면 바로 앞에 기존 내용을 지우는 `erase`가 한 번 온다(빈 박스면 오지 않는다) |
| `TPath.ALIGN`, `TPath.FLIP_PATH`, `TPath.START_BRACKET`, `TPath.END_BRACKET` | text-on-path 설정 변경 |

- `replacing: true`는 IME 조합 중 글자가 바뀌는 중간 단계다. 조합 중에는 textbox가 직전 조합 글자를 내부적으로 되돌리므로 `undo` 이벤트 뒤에 `replacing: true`인 `insert_string`이 온다. 호스트가 자체 undo 스택을 운영한다면 이 둘로 단계를 쌓지 않는다.
- `user_data`는 `opEdit.insert_string(…, { user_data })`처럼 호출자가 넘긴 값이 그대로 온다. 호스트가 일으킨 변경과 사용자 입력을 구분할 때 쓴다([06. 예제](06-recipes.md#외부에서-넣은-변경-구분하기)).
- `insert_string(…, null, { reset: true })`는 이벤트를 보내지 않고 undo 기록을 지운다(`placeholder_text`가 이렇게 들어간다).

## Node에서 쓰기

Node 번들은 화면이 없으므로 jsdom의 `window`와 폰트 파일을 읽는 함수를 먼저 넘긴다.
전체 예제는 [06. 예제 모음 — Node에서 kayak JSON을 SVG로](06-recipes.md#node에서-kayak-json을-svg로)를 본다.
