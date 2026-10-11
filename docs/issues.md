# 알려진 결함 (백로그)

> 언제 읽나: 이상한 동작을 만났을 때(알려진 결함인지), 결함을 고치거나 새로 올릴 때(`.claude/skills/record-issue`).
> #1~#21은 Kayak TypeScript 전환과 playground 작업 중 기록했다. 그 항목들의 경로는 Kayak 기준이다: `src/<dir>/…` → `packages/kayak/src/engine/<dir>/…`. #21이 언급하는 `playground/`는 kayak2에 없다.

전환 PR에서 고치지 않고 넘긴 것만 적는다. 작은 수정(스냅샷 변화 없음)은 해당 PR의 커밋 메시지에 있다.

| # | 발견 단계 | 파일:줄 | 증상 | 왜 별도 작업인가 |
|---|---|---|---|---|
| 1 | 0 | `src/textbox/TB_InDesignJsonConverter.js:507` (`parse_indesign_color`), `:493` (`parse_shadow`) | InDesign이 [None] 스와치를 `null`로 내보내는데(`stroke_color`에서 확인, 0단계에서 수정함) `fill_color`·`dropShadow.color`는 null 확인 없이 읽어 TypeError가 날 수 있음 | 재현 샘플이 없어 수정 결과를 검증할 수 없음. [None] 채움을 "투명"으로 볼지 "검정"으로 볼지 결정 필요 |
| 2 | 1a | `src/textbox/Textbox_Verify.js:174` | `(new ATTR_FontFamily()).getDataObject(familyName, typeStyle)` — `getDataObject()`는 인자를 받지 않으므로 복구 불가 JSON을 리셋할 때 기본 폰트 대신 "Noto Sans KR/Regular"가 들어감. 의도는 `new ATTR_FontFamily(familyName, typeStyle).getDataObject()`로 보임 | 고치면 저장되는 JSON(복구 결과)이 바뀜. 4단계에서 `Textbox_Verify`를 TS로 바꾸면 TS2554가 나므로 그때 결정 |

## #3 `TB_Path.getSubPath(dist_begin, dist_end)`의 wrap-around 조각 연결 오류

`src/geometry/TB_Path.ts` `getSubPath`. `dist_begin > dist_end`(닫힌 경로에서 bracket 구간이 경로 시작점을 넘는 경우)이면
`[dist_begin, total_length]`와 `[0, dist_end]` 두 조각을 `append_with_segments`로 이어 붙인다. 두 번째 호출 때
`this.path.length != 0`이라 `moveTo`를 건너뛰고 첫 segment의 **끝점**으로 `lineTo`만 하므로, 두 번째 조각의 첫 segment가
"첫 조각의 끝 → 두 번째 조각 첫 segment의 끝"을 잇는 엉뚱한 직선으로 바뀌고 원래의 첫 segment는 사라진다.
예: `M0 0 L100 0 L100 100`에서 `getSubPath(150, 50)` → 기대 `M100 50 L100 100 (M0 0) L50 0`(길이 100), 실제 `M100 50 L100 100 L50 0`(길이 161.8).

고치면 닫힌 경로 text-on-path의 글줄 위치/길이(`resize_tb`)가 바뀌므로 2단계 전환 PR에서 고치지 않는다.
`test/geometry/tb_path.test.js`의 `getSubPath wrap-around` 스냅샷이 현재 출력을 고정하고 있다. 고칠 때 그 스냅샷을 갱신한다.

## #4 `TB_Path.getPosByDistance(dist)`의 `dist < 0` 처리가 무의미함

`src/geometry/TB_Path.ts` `getPosByDistance`. `if (dist < 0)` 블록이 첫 segment의 t=0 위치를 `ret.pt`/`ret.nv`에 넣지만,
바로 뒤 루프가 `dist < l` 조건으로 다시 계산해 덮어쓴다. 첫 segment가 직선이면 `seg.get(음수 t)`로 경로 시작점 **밖으로 외삽**된
점이 나오고(`M0 0 L100 0 …`에서 dist=-1 → (-1, 0)), 곡선이면 bezier-js가 t=0으로 clamp한다.
`test/geometry/tb_path.test.js`의 `getPosByDistance(-1)` 스냅샷이 현재(외삽) 출력을 고정하고 있다.
고치면 bracket이 음수 위치일 때(#5)의 표시 위치가 바뀐다. 2단계 전환 PR에서 고치지 않는다 (2026-10-06 리뷰에서 발견).

## #5 닫힌 경로에서 bracket이 음수가 되어 글줄이 경로 전체에 깔림

`src/geometry/TB_TextOnPath_Bracket.ts` `update_bracket_pos`. 닫힌 경로에서 end bracket을 경로 시작점에 정확히 투영해 `end = 0`으로
만든 뒤(start ≠ 0이라 허용됨) start도 시작점으로 끌면 `start === end`라서 `start = end - 0.1 = -0.1`이 된다.
`getSubPath(-0.1, 0)` → `clip_path`에서 어떤 segment도 start/end-in-seg 조건과 `length < dist_start` 조건에 걸리지 않아
**경로 전체**가 inter-bracket-path가 된다. 두 bracket이 같은 지점인데 글줄이 원 전체에 깔리고 start bracket은 #4의 외삽 위치에 그려진다.
의도적인 조작이 필요해 심각도는 낮다. 코드 추적으로 확인했고 실행으로는 확인하지 않았다. 고칠 때 #4와 함께 본다 (2026-10-06 리뷰에서 발견).

## #6 `FontManager.find_default_font_with_font_list` fallback의 반환 키 이름 불일치

`src/textbox/TB_FontManager.ts`. 폰트 목록에 `default:true`인 스타일이 없으면 첫 폰트/첫 스타일을 돌려주는데, 키 이름이
`{font_family, type_style}`이다. 호출자(`_find_default_values` → `TB_LocalFontLoader.get_default_font`, `TB_TofuService`,
`TextBox.get_default_font`)는 모두 `{familyName, typeStyle}`을 기대하므로 이 경우 기본 폰트가 `undefined`로 처리된다.
3a 전환 PR에서는 ReferenceError만 고쳤고(선언 없는 `font_family`), 키 이름은 동작 변경이라 그대로 두었다.
`test/textbox/fonts.test.js`의 `find_default_font_with_font_list` 테스트가 현재 반환값을 고정한다. 고칠 때 그 테스트를 바꾼다.

## #7 `FontManager._get_font_rsc_url`이 node 환경에서 `alert()`를 부름

`src/textbox/TB_FontManager.ts`. 요청한 font family에 스타일이 하나도 없으면 `alert(…)`를 부른다. node(jsdom)에는
`alert`가 없어 ReferenceError가 난다. 브라우저에서는 모달이 뜬다. 어느 쪽으로 고치든 동작이 바뀌므로 기록만 한다.

## #8 `TB_ApplyEditOperation.apply_edit_operation`이 node 환경에서 `alert()`를 부름

`src/textbox/TB_ApplyEditOperation.ts`. `tbconfig.text_render`가 'html'도 'svg'도 아니면 `return alert('text_render not defined!!')`.
node에는 `alert`가 없어 ReferenceError가 나고, 브라우저에서는 모달이 뜨며 Promise가 아닌 `undefined`를 돌려줘 호출자(`TB_Input._std_paste`, `TextBox.apply_edit_operation` 경유)의
`.then()`에서 다시 TypeError가 난다. `text_render`는 TB_Config가 'svg'로 고정하므로 실제로는 닿지 않는 분기다. 고치면 동작이 바뀌므로 기록만 한다.

## #9 `cg`의 `instanceof $` — jQuery 제거 뒤 남은 참조 (4a에서 가드 추가)

`src/textbox/cg.ts` `CGPoint/CGSize/CGRect.set()`. PR #24에서 jQuery를 제거했지만 1개 인자가 CGPoint/CGSize/CGRect가 아니면
`src instanceof $`를 평가해 `ReferenceError: $ is not defined`가 났다. export된 `CGMatrix`의 공개 경로(`transformPoint`, `transformRect`, `transform`)에서는
닿지 않는다. 4a 전환 PR에서 `typeof $ !== 'undefined' &&` 가드를 넣어 고쳤다(jQuery가 있을 때의 동작은 그대로). `test/textbox/cg.test.js`가 고정한다.
`$`가 있을 때의 분기(`src.css('left')`)는 jQuery 객체 전용이라 이제 죽은 코드다. 5단계 strict에서 지울지 결정한다.

## #10 `TB_LocationFinder.find_cursor_location_by_ci`가 node 환경에서 `alert()`를 부름

`src/textbox/TB_LocationFinder.ts`. `tbdom.get_line_by_line_counter(li_doc).line`이 null이면(레이아웃이 비어 있는 상태에서 커서 위치 조회)
`log.error` 뒤에 `alert(...)`를 부른다. node에는 `alert`가 없어 ReferenceError가 나고 브라우저에서는 모달이 뜬 뒤 다음 줄의 `line_obj.line.max_font_size_px`에서
TypeError가 난다. #7, #8과 같은 부류다. 고치면 동작이 바뀌므로 기록만 한다.

## #11 `Textbox_Verify.reset_data`가 기본 폰트를 `getDataObject()`의 인자로 넘기지만 무시됨

`src/textbox/Textbox_Verify.ts`. 복구 불가한 kayak JSON(ATTR_*가 `[]`)을 되돌릴 때 `ATTR_FontFamily`를
`(new ATTR_FontFamily()).getDataObject(default_font.familyName, default_font.typeStyle)`로 만들었는데 `getDataObject()`는 인자를 받지 않는다.
그래서 호스트의 기본 폰트가 아니라 `ATTR_FontFamily`의 기본값('Noto Sans KR'/'Regular')이 들어간다. 의도는 `new ATTR_FontFamily(default_font.familyName, default_font.typeStyle).getDataObject()`였을 것이다.
4a 전환에서는 무시되던 인자만 지웠다(동작 동일). `test/textbox/verify.test.js`가 현재 값을 고정한다. 고칠 때 그 테스트를 바꾼다.

## #12 `TextBox_Edit._paste`가 `tb.schema_only`를 읽음 (textbox에 없는 속성)

`src/textbox/TextBox_Edit.ts`. `_paste`의 마지막 줄 `tb.schema_only && tb.tbcursor.set(…)`에서 `tb.schema_only`는 textbox에 없는 속성이라 항상 undefined다.
다른 편집 메서드(`_insert`, `_insert_string`, `_erase`)는 `this.schema_only`를 쓰므로 오타로 보인다. 고치면 schema 모드에서 paste 뒤 커서가 움직이게 되어
동작이 바뀐다(현재 schema 모드에서 paste를 쓰는 경로는 없다). 4b 전환에서는 `(tb as any).schema_only`로 두고, TextBox class의 `schema_only`도 속성으로 만들지 않았다(속성이 생기면 이 줄이 참이 된다).

## #13 `TextBox.get_html()`이 `docFactory.get_rendered_textline()`을 인자 하나로 부름

`src/textbox/TextBox.ts`. 테스트용 메서드 `get_html(from, to)`가 `get_rendered_textline(rng)`를 부르지만 `get_rendered_textline(rng, domLine, line_render_options)`는
domLine이 필요해 `domLine.uuid`에서 TypeError가 난다. 4b 전환에서는 `(this.docFactory as any)`로 두었다. 쓰는 곳이 없으므로 지우거나 고치는 것은 별도 작업.

## #14 `TextBox_Style.do_set_vertical_align`이 `setMask.frame_height`를 `seg_mgr.set()` 뒤에 대입

`src/textbox/TextBox_Style.ts`. `ATTR_Doc.set(that, setMask)`는 호출 시점에 mask를 복사하므로, 그 뒤에 `setMask.frame_height = get_content_height()`를 대입해도
ATTR_Doc 레이어에는 frame_height가 기록되지 않는다(`tbpreference.frame_height`만 바뀐다). undo/redo로 vertical align을 되돌릴 때 `on_execute_ATTR_Doc`이
레이어의 옛 frame_height를 쓰게 된다. `do_set_fit_to_content_height`는 mask를 set 전에 완성한다. `test/textbox/textbox_style.test.js`가 현재 값(레이어 100 유지)을 고정한다. 고칠 때 그 테스트를 바꾼다.

## #15 `TextBox_InOut.snapshotAsSVGInContentBBox()`를 padding 없이 부르면 TypeError (4b에서 수정)

`src/textbox/TextBox_InOut.ts`. `opt = {}` 기본값과 `opt.padding || [0,0,0,0]`을 svg 생성에는 썼지만 `padded_box` 계산은 `opt.padding[0]`을 직접 읽어
padding을 주지 않으면 TypeError가 났다(호출자 `TextBox.snapshotAsSVGInContentBBox(opt)`도 그대로 넘긴다). 4b 전환 PR에서 `padding` 지역 변수를 두 곳에 같이 쓰도록 고쳤다
(padding을 준 경우의 결과는 동일). `test/textbox/textbox_inout.test.js`가 고정한다.

## #16 InDesign 변환이 넘기는 색/그림자 값의 타입 불일치

`src/textbox/TB_InDesignJsonConverter.ts`. `_parse_indesign_solid_color`는 cmyk를 `'100,0,0,0'` 문자열로(`ATTR_FontColor`는 `number[]`를 기대), `_parse_indesign_linear_gradient`는
gradient geom을 `'50%'` 문자열로(`GradientSpec.geom`은 number), `parse_dropShadow`는 size/distance를 `toFixed(2)` 문자열로(`ShadowSpec`은 number), 그리고 dropShadow가 없을 때는 `color` 대신
`shadow` 키로 넘긴다. `TB_ApplyEditOperation`도 clipboard HTML의 `-kayak-color_cmyk` 값을 문자열 그대로 `set_fontColor`에 넘긴다. 모두 원본부터 그랬고 렌더링은 문자열을 그대로 출력하므로 동작한다.
4b에서는 호출부를 `as any`로 두고 `TextBox_Style.set_fontColor`의 cmyk 매개변수를 `number[] | string | null`로 넓혔다. 저장 JSON의 `fontColorCMYK` 타입이 문서마다 다른 셈이라 5단계 strict에서 정리할지 결정한다.
`test/textbox/indesign_converter.test.js`가 현재 값을 고정한다.

## #17 schema 모드에서 `gather_used_font_list_info()`를 `opt.font_list` 없이 부르면 TypeError (5b에서 발견)

`src/textbox/TextBox_InOut.ts` `gather_used_font_list_info` → `_get_used_font_list_for_embedding`. schema 모드(`fontloader`가 null)에서
`opt.font_list`가 없으면 `log.error('no font_list available in gather_used_font_list_info()')`만 남기고 `font_list = null`인 채 진행한다.
`used_fonts`에는 기본 폰트가 항상 들어가므로 `font_list[familyName]`에서 반드시
`TypeError: Cannot read properties of null`이 난다(2026-10-08 재현: `new textbox({schema:true})` → `init()` → `insert_string` → `inout.gather_used_font_list_info()`).
고치는 방법은 둘이다: 빈 결과(`unresolved_fonts`에 전부)를 돌려주거나, 명시적으로 throw하거나. 어느 쪽이든 호스트(edicus-resource 등)가 받는 결과가 바뀌므로
5b(타입만)에서 고치지 않는다. 5b에서는 `font_list!`로 표시만 했다.
호스트가 실제로 부르는 진입점은 `textbox.saveAsJson()`이다(`saveAsJson(fontEnv)` → `gather_used_font_list_info(fontEnv)`). schema 모드에서는 `saveAsJson({ font_list })`처럼 font_list를 넘기지 않으면 **항상** 이 TypeError가 난다(2026-10-08 재현: `new textbox({schema:true})` → `init()` → `saveAsJson()`).

## #18 `TB_InDesignJsonConverter`를 `font_list: null`로 만들면 `load_json`이 TypeError (5b에서 발견)

`src/textbox/TB_InDesignJsonConverter.ts` `remap_font_family`·`fix_font_family`. `IndConvertOptions.font_list`는 null을 허용하고(공개 d.ts 픽스처 `test/dts/use.ts`도
`font_list: null`로 만든다) 생성과 단위 변환은 동작하지만, `text_list` 프레임을 `load_json`하면 `Object.keys(this.opt.font_list)`에서
`TypeError: Cannot convert undefined or null to object`가 난다(2026-10-08 재현: `test/ind-json-conv-sample/ind_textframe.json`).
font_list가 없으면 폰트 이름 보정을 건너뛰는 것이 자연스러워 보이지만, 그러면 변환 결과(kayak JSON의 폰트 이름)가 달라지므로 별도 작업으로 둔다.
또는 `IndConvertOptions.font_list`를 필수로 좁히는 방법도 있다(공개 타입 변경).

## #19 등록되지 않은 `font_list_id`로 `spFontManager.get_font_info()`를 부르면 TypeError (5b 리뷰에서 발견)

`src/textbox/TB_FontManager.ts` `get_font_info`(그리고 `TB_LocalFontLoader.add_foreign_fonts`). `_get_font_list(id)`는 모르는 id에 `null`을 돌려주는데,
바로 옆 `_get_font_rsc_url`은 이 경우를 `log.error` + 에러 콜백으로, `_find_default_values`는 첫 목록으로 fallback해 처리하는 반면 `get_font_info`만 처리가 없다.
재현(2026-10-08): `spFontManager.get_font_info('no-such-list', 'Arial', 'Regular')` → `TypeError: Cannot read properties of null (reading 'Arial')`.
도달 경로: `new textbox({ font_list_id: '<미등록>' })` → `loadFromJson` → `fontloader.add_foreign_fonts` → `get_font_info`. `get_font_info`에 `if (!font_list) return null`을
넣어도 `add_foreign_fonts`가 곧바로 `font_list[name]`에서 다시 터지므로, 미등록 id를 `_get_font_rsc_url`처럼 다룰지 한 번에 결정해야 한다. 5b에서는 `!`로 표시만 했다.

## #20 schema 모드에서 `destroy()`·`importFromInDesignJson()`이 TypeError (5b 리뷰에서 발견)

schema 모드에서는 `fontloader`가 null인데 다음 공개 메서드가 확인 없이 쓴다(2026-10-08 재현).
- `textbox.destroy()` → `this.fontloader.destroy()` (`src/textbox/TextBox.ts` `destroy`). 정리 경로라 모드와 상관없이 부를 만하다.
- `textbox.importFromInDesignJson(json_str)`을 font_list 없이 부르면 `get_font_group_id()` → `this.fontloader.get_font_group_id()`에서 터진다 (`src/textbox/TextBox_InOut.ts`). #18과 같은 계열.
- `get_font_group_id()`, `get_font_loading_state()`도 같은 식이다.
`attachTo`·`get_dimension`·`is_state_*` 같은 DOM 전용 메서드는 설계상 schema 모드에서 부르지 않으므로 여기 넣지 않았다.
고치는 방법(schema 모드면 건너뛰기 vs 명시적 throw)에 따라 호스트가 받는 결과가 달라지므로 별도 작업으로 둔다. 5b에서는 `!`로 표시만 했다.

## #21 `get_style_info(getLength())`가 문단 서식 키를 돌려주지 않음 (playground 작업 중 발견)

`select_all_text()` 뒤 `tbcursor.sel()`은 `{ begin: 0, end: getLength() }`이고, 호스트가 흔히 쓰는 "선택이 있으면 선택 끝 위치의 서식"
(기존 `SimpleTextBox.js`의 `update_editor_ui_value`)으로 `get_style_info(sel.end)`를 부르면 문서 끝 다음 위치를 읽게 된다.
이때 글자 서식 키는 오지만 문단 서식 키(`align`, `findent`, `lindent`, `rindent`, `space_before`, `space_after`, `line_space`, `leading`)가 빠진다
(2026-10-11 재현: 기본 3문단(길이 103) → `get_style_info(102)`에는 있고 `get_style_info(103)`에는 없음).
기존 테스트 페이지에서는 전체 선택 뒤 정렬 select가 비어 보였다. playground는 문단 키가 없으면 한 글자 앞에서 다시 읽도록 피해 갔다
(`playground/src/shared/kayak/inspect.ts` `readStyle`). `get_style_info`가 끝 위치를 마지막 문단으로 처리할지는 호스트 동작에 영향이 있어 별도로 정한다.
