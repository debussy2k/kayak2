# 05. 보조 모듈

## TB_PlatformEnv

Kayak이 쓰는 `window`/`document`와 Node용 파일 함수를 담는 객체. 브라우저에서는 로드될 때 전역 `window`를 스스로 잡으므로 부를 필요가 없다.
**Node에서는 textbox를 만들기 전에 반드시 `set()`을 부른다.**

```ts
TB_PlatformEnv.set({
    window,                                   // jsdom의 window
    fsReadFile: () => fs.readFile,            // fs.readFile을 돌려주는 함수
    get_font_filepath,                        // 폰트를 로컬 파일로 준비해 경로를 넘기는 함수 (아래)
    delete_downloaded_font_file,              // (font_key_name, download_folder) => Promise. 받은 파일이 깨졌을 때 지우는 함수
});
```

`get_font_filepath(font_url, font_issue, font_key_name, download_folder, cb)`:
- `font_url`의 폰트를 `download_folder`(= `node_env.base_folder_for_download` + `/` + `font_list_id`)에 내려받아 두고 `cb(null, 로컬경로)`를 부른다. 이미 있으면 그 경로를 바로 준다.
- 인자가 모두 `null`이면 기본 폰트(폰트 목록에 없는 폰트를 대신할 폰트)의 경로를 요청하는 것이다.
- `font_issue`는 폰트 목록의 `issue` 값(폰트 파일의 판 구분)이다. Kayak은 해석하지 않고 넘기기만 한다.

Node에서 폰트를 읽다가 실패하면 `delete_downloaded_font_file`로 그 파일을 지우고 에러를 돌려준다(다음에 다시 받게).

## spFontManager

폰트 목록과 로딩된 폰트를 관리하는 싱글턴. 모든 textbox가 공유한다.

### 폰트 목록

폰트 목록은 `font_list_id`별로 나뉜다. 번들에는 `'default-host-ko'` 하나가 들어 있고(`src/textbox/TB_FontRscList.ts`),
`set_font_groups_list()`로 통째로 바꿀 수 있다. 바꾸면 번들의 `'default-host-ko'`는 없어지므로(새 목록에 같은 id가 없다면) `_get_font_list('default-host-ko')`는 `null`이 된다.

### 폰트 목록 고르기

편집 모드 textbox는 생성 옵션 `font_list_id`로 목록을 고른다. 실제로 고른 id는 `tb.get_font_group_id()`로 확인한다.

- `font_list_id`가 `null`이면 등록된 첫 번째 목록
- 등록된 목록이 **하나뿐이면** `font_list_id` 값과 상관없이 그 목록
- 등록되지 않은 id면 이름이 `basefont`로 끝나지 않는 첫 목록

schema 모드는 폰트 로더가 없으므로 기본 폰트를 `_find_default_values(font_list_id)`로 찾는다. 이때는 `null`이면 `'default-host-ko'`, 그 목록이 없으면 첫 목록을 쓴다.

```ts
spFontManager.set_font_groups_list({
    'my-fonts': {
        font_list: {
            'Noto Sans KR': {                                       // 키 = family 이름 (JSON에 저장되는 이름)
                family: { locale: { en: 'Noto Sans KR', kr: '본고딕' } },
                style: {
                    'Regular': {                                    // 키 = style 이름
                        url: 'https://example.com/NotoSansKR-Regular.woff',
                        issue: '001',
                        locale: { en: 'Regular', kr: '보통' },
                        default: true,                              // 목록에 하나: 기본 폰트
                    },
                },
            },
        },
    },
});
```

- `default: true`인 스타일이 기본 폰트다. 새 문서의 폰트이자, 지정 폰트에 없는 글자(예: 영문 폰트의 한글)를 그릴 때 쓰는 폰트다. 목록마다 하나 둔다.
  없으면 에러 로그를 남기고 대체값을 돌려주지만 그 값의 키 이름이 달라 쓸 수 없다([issues.md #6](../issues.md)).
- `url`은 반드시 `https://`로 쓴다(혼합 콘텐츠 차단).
- 선택 키: `lang`(지원 언어 배열, `get_family_list`가 돌려준다), `font_prv_url`(미리보기 이미지), `full_name`(InDesign 변환 때 폰트 이름 맞추기에 쓴다).
- 목록에 없는 family를 요청하면 기본 폰트로, family는 있는데 style이 없으면 그 family의 첫 style로 대신 그린다.

### 메서드

| 메서드 | 설명 |
|---|---|
| `set_font_groups_list(groups)` | 폰트 목록 전체를 바꾼다 |
| `font_groups_list` | 현재 목록 (`{ [font_list_id]: { font_list } }`) |
| `_get_font_list(id?)` | `id`의 `font_list`. 없으면 `null`. `id`가 없으면 `'default-host-ko'` |
| `_find_default_values(id?)` | 기본 폰트 `{ familyName, typeStyle }`. `id` 목록이 없으면 첫 목록에서 찾는다 |
| `find_default_font_with_font_list(font_list)` | 주어진 `font_list`의 기본 폰트 |
| `get_family_list(id, locale?)` | `[{ name, disp_name, lang }]`. 폰트 선택 UI용. `locale`(`'en'` 기본, 없는 언어면 `'en'`) |
| `get_font_style_list(id, family, locale?)` | `[{ name, disp_name, font_url, font_prv_url, default }]` |
| `get_family_disp_name(id, family, locale?)`, `get_style_disp_name(id, family, style, locale?)` | 표시 이름. 못 찾으면 받은 이름 그대로 |
| `get_font_info(id, family, style)` | 폰트 목록의 그 항목(`url`, `issue` …) 또는 `null`. 주의: 등록되지 않은 `id`면 TypeError([#19](../issues.md)) |
| `findUnregisteredFonts(font_list, used_fonts)` | `used_fonts`(`tb.gather_used_fonts()`) 중 `font_list`에 없는 것 |
| `getFontInUseCount()` | 지금 메모리에 있는 폰트 수 |

폰트는 처음 쓰일 때 내려받아 메모리에 두고, 그 폰트를 쓰는 textbox가 모두 `destroy()`되면 놓는다.
textbox마다 다른 목록을 쓸 수 있지만 같은 family/style이라도 목록이 다르면 따로 로딩된다.

## GT_MasterClipboard

textbox끼리 서식까지 포함해 복사·붙여넣기하는 내부 클립보드. `GT_MasterClipboard.getInstance()`로만 얻으며(싱글턴),
모든 textbox의 `masterClipboard` 옵션에 이 인스턴스를 넘긴다.

키보드 복사·붙여넣기는 textbox가 알아서 이 클립보드와 시스템 클립보드를 함께 쓴다. 호스트가 직접 부를 만한 것:

| 메서드 | 설명 |
|---|---|
| `copy_from_string_data(str)` | 평문을 클립보드에 넣는다(서식 없음). 이어서 `tb.opEdit.paste(clipboard, sel)` |
| `get_text(opt?)` | 클립보드의 문자 코드 배열. CRLF는 LF로. `{ single_line_mode: true }`면 LF를 공백으로 |
| `get_element_size()` | 글자 수 |

`copy_from_system_clipboard()`는 고정된 예문을 넣는 테스트용이다. 쓰지 않는다.

## TB_InDesignJsonConverter

InDesign 스크립트가 내보낸 TextFrame JSON을 kayak JSON으로 바꾼다. 보통은 [`tb.importFromInDesignJson()`](03-textbox-api.md#importfromindesignjsonjson-font_list-indconvertresult)을 쓰고,
text-on-path 프레임의 경로까지 변환하거나 textbox 없이 변환할 때 직접 쓴다.

```ts
const conv = new TB_InDesignJsonConverter({
    src_unit: 'mm',                                   // 'mm' 또는 'indesign_px' (InDesign 72dpi px)
    font_list: spFontManager._get_font_list('default-host-ko'),
});
const r = conv.load_json(ind_json);                   // 문자열 또는 객체
// r.kayak_json: KayakJsonObject, r.dim_px: { width, height }, r.font_family_remap_occurred: boolean
```

- **변환 한 번에 인스턴스 하나**를 쓴다. 내부 schema textbox에 글을 이어 붙이므로 같은 인스턴스로 두 번 변환하면 앞의 글이 남는다.
- `font_list`는 필수로 본다. `null`이면 `load_json()`이 TypeError를 낸다([#18](../issues.md)).
- InDesign의 폰트 이름(full name)을 폰트 목록의 family 이름으로 바꿔 저장한다. 바꾼 것이 있으면 `font_family_remap_occurred`가 `true`.
- text-on-path 프레임은 `load_json(ind_json, d_path)`처럼 경로 SVG `d` 문자열을 함께 넘겨야 `kayak_json.text_on_path`가 만들어진다.
- 결과의 `meta.linebreak_tolerance`는 `2`로 정해진다(InDesign 줄바꿈과 맞추기 위함).
- `conv.toPx(val)`: `src_unit` 값을 px(96dpi)로 바꾼다.
- 색의 cmyk, 그림자 크기 등이 숫자가 아니라 문자열로 들어간다. 렌더링에는 문제없다([#16](../issues.md)).

## TB_FontSizeStepUtil

글자 크기 키우기/줄이기 버튼용. 단계: 2~9pt는 0.5, 9~12는 1, 12~48은 2, 48~100은 4, 100~990은 10 간격.

```ts
const steps = new TB_FontSizeStepUtil();
steps.upper_font_size(10);    // 11
steps.lower_font_size(10);    // 9
steps.upper_font_size(13);    // 14 (단계 사이 값은 다음 단계로)
```

## MeasureDiv

글자 폭 측정에 쓰는 숨은 div(`#kayak_metric_box`)의 싱글턴. 디버그할 때 화면에 보이게 할 수 있다.

```ts
MeasureDiv.Instance().show(true);    // 화면 왼쪽 위에 보인다. false면 화면 밖으로
```

## TB_NormalizedIME

브라우저마다 다른 키보드·IME(조합 입력) 이벤트를 하나의 콜백 모양으로 맞추는 클래스. textbox가 내부에서 쓴다.
호스트가 Kayak 밖의 입력 요소에 같은 IME 처리를 붙이려는 경우가 아니면 쓸 일이 없다.
