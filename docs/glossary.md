# 용어집 — 조판 용어 ↔ 코드 이름

> 언제 읽나: 요청에 나온 조판 용어가 코드의 어디에 해당하는지 찾을 때, 반대로 코드 이름의 뜻을 알고 싶을 때.

경로는 `packages/kayak/src/engine/` 기준. 메서드는 `textbox`의 `opStyle`(서식)·`opEdit`(편집)·본체 메서드다(사용법은 `docs/usage/04-editing-and-style.md`).

## 글자 속성

글자 속성은 글자 범위마다 값을 갖는 속성 레이어(`seglayer`)에 run-length로 저장된다. 레이어 이름은 `TextBox.ts`의 `m_*Layer`/`m_*` 필드.

| 용어 | 코드 이름 | 위치 | 설명 |
|---|---|---|---|
| 서체 (폰트 패밀리·스타일) | `ATTR_FontFamily`, `m_FFamilyLayer`, `set_font_family` | `segment/ATTR_FontFamily.ts` | family 이름과 type style(Regular, Bold 등). 편집 모드에서는 폰트를 내려받은 뒤 적용 |
| 글자 크기 | `ATTR_FontSize`, `m_FSizeLayer`, `set_font_size` | `segment/ATTR_FontSize.ts` | 단위 pt |
| 굵게 | `ATTR_Bold`, `m_Bold`, `set_bold` | `segment/ATTR_Bold.ts` | `'bold'`/`'normal'`. SVG 렌더에는 효과가 없다는 기록이 있다(usage 문서 "주의") |
| 글자색 | `ATTR_FontColor`, `m_FontColor`, `set_fontColor` | `segment/ATTR_FontColor.ts` | RGB와 CMYK, 색 모델 |
| 자간 | `ATTR_LetterSpacing`, `m_LetterSpacing`, `set_letter_space` | `segment/ATTR_LetterSpacing.ts` | 단위 em/1000 (예: `-50`, `100`). InDesign의 tracking |
| 장평 | `ATTR_LetterScaleX`, `m_LetterScaleX`, `set_letter_scale_x` | 저장 `segment/ATTR_LetterScaleX.ts`, 설정 `textbox/TextBox_Style.ts`(`do_set_letter_scale_x`), SVG 렌더 `textbox/TB_SvgTextRender.ts`(`letter_scale_x`로 글리프 xScale·글자 폭), HTML `textbox/TB_StyleContext.ts`(`scaleX`) | 글자 가로 비율 %, 기본 100. InDesign의 horizontal scale(`TB_InDesignJsonConverter`의 `h_scale`). 한 줄 맞춤 때 `services/TB_Format.service.ts`가 자동으로 바꾼다 |
| 외곽선 | `ATTR_Stroke`, `m_Stroke`, `set_stroke` | `segment/ATTR_Stroke.ts` | 두께, 색, `align`(`'center'`/`'outside'`), join |
| 그림자 | `ATTR_Shadow`, `m_Shadow`, `set_shadow` | `segment/ATTR_Shadow.ts` | |
| 커닝 | `kerning` (스타일 플래그) | `textbox/TB_SvgTextRender.ts`, `TB_SvgLineFactory.ts` | 폰트의 kerning 값(`font.getKerningValue`)을 쓴다. 지금은 항상 켜져 있다. InDesign의 Optical 커닝은 지원하지 않는다(Metrics만) |
| 합자 (ligature) | `TB_GsubSafety`, `is_liga_safe` | `textbox/TB_GsubSafety.ts` | opentype.js 1.3.4가 처리하지 못하는 GSUB lookup이 있는 폰트에서 liga를 끄기 위한 검사 |
| 두부 (tofu, 글리프 없는 글자) | `TB_TofuService` | `textbox/services/TB_TofuService.ts` | 폰트에 없는 글자 위치에 기본 폰트 스타일을 넣어 글리프가 나오게 한다 |

## 문단 속성

`ATTR_Par`(`segment/ATTR_Par.ts`), 레이어 `m_Par`. 문단마다 값 하나. 설정은 `set_text_align`(정렬)과 `set_par_style(name, val, …)`(나머지).
`get_style_info()`가 돌려주는 키 이름은 괄호 안(`docs/issues.md` #21 참고).

| 용어 | 필드 (`get_style_info` 키) | `set_par_style` 이름 | 설명 |
|---|---|---|---|
| 정렬 | `m_Align` (`align`) | — (`set_text_align`) | `'left'`, `'center'`, `'right'`, 양쪽 맞춤 `'left-justified'`·`'center-justified'`·`'right-justified'`(마지막 줄만 왼쪽/가운데/오른쪽)·`'fully-justified'`(마지막 줄까지) |
| 양쪽 맞춤 계산 | `TB_JustificationService` | — | `textbox/services/TB_JustificationService.ts`. `TB_LineComposer.get_jstf_balance_info`가 정렬 값에 따라 부른다 |
| 첫 줄 들여쓰기 | `m_Findent` (`findent`) | `'first'` | px, 왼쪽 들여쓰기에 대한 상대값 |
| 왼쪽·오른쪽 들여쓰기 | `m_Lindent`, `m_Rindent` (`lindent`, `rindent`) | `'left'`, `'right'` | px |
| 문단 앞·뒤 간격 | `m_SpaceBefore`, `m_SpaceAfter` (`space_before`, `space_after`) | `'space_before'`, `'space_after'` | px |
| 줄 간격 배수 (자동 행간) | `m_LineSpace` (`line_space`) | `'line_space'` | 기본 1.2. `m_Leading`이 `'auto'`일 때 글줄 높이 = 글줄의 가장 큰 글자 높이 × 이 배수 |
| 행간 (고정) | `m_Leading` (`leading`) | `'leading'` | `'auto'`(기본, `line_space` 사용) 또는 pt 숫자. 숫자면 글줄 높이 = pt × 96/72 px (`TB_DocFactory.set_line_height_by_leading`) |

## 상자(문서) 속성

| 용어 | 코드 이름 | 설명 |
|---|---|---|
| 문서 속성 | `ATTR_Doc`, `m_DocLayer` (`segment/ATTR_Doc.ts`) | 상자 전체에 하나: `vertical_align`, `fit_to_content_height`, `frame_height` |
| 세로 정렬 | `set_vertical_align` | `'top'`, `'center'`, `'bottom'`. 고정 높이 상자에서 의미가 있다 |
| 내용에 맞춘 높이 / 고정 높이 | `set_fit_to_content_height`, `set_frame_height` | |
| 페이지 여백 (위·아래) | `page.gutter_top`, `page.gutter_bottom` (생성 옵션) | `docs/usage/02-config.md` |
| 글줄 거터 (디버그 표시) | `debug.show_line_gutter` (생성 옵션) | 글줄 옆에 위치 정보를 표시하는 디버그 기능. 스냅샷 테스트의 `gutter` 변형이 켠다 |

## 편집과 구조

| 용어 | 코드 이름 | 위치 | 설명 |
|---|---|---|---|
| 텍스트 상자 | `textbox` (클래스 `TextBox`) | `textbox/TextBox.ts` | 공개 진입점이 내보내는 본체 |
| 원고 텍스트 | `text_core` (`TP_TextCore`) | `textbox/TP_TextCore.ts` | 글자 코드 배열과 텍스트 편집 이력 |
| 속성 레이어 | `seglayer`(`GT_segmentLayer`), `seglayer_par`(`GT_segmentLayer_Par`), `seglayer_manager` | `segment/` | 글자/문단 범위별 속성을 run-length로 저장. 매니저가 레이어들을 함께 편집·undo한다 |
| 이름 붙은 범위 (named range) | `ATTR_NamedRange`, `m_NamedRange`, `opStyle.set_range_id` | `segment/ATTR_NamedRange.ts` | 글의 일부에 id를 붙여 나중에 그 부분만 읽거나 바꾼다(가변 데이터 템플릿) |
| 선택 범위 | `TB_SelRange`, `tbcursor.sel()` | `textbox/TB_SelRange.ts`, `TB_Cursor.ts` | |
| 되돌리기 | `TB_History` (redux + redux-undo) | `textbox/TB_History.ts` | |
| 글줄 경로 (text on path) | `TB_TextOnPath*`, 생성 옵션 `text_on_path` | `geometry/TB_TextOnPath*.ts` | 경로를 따라 글을 놓는다. bracket = 글이 놓이는 구간의 시작·끝 |
| 레이아웃 | `TB_Layout` (`do_layout`, `do_layout_all`) | `textbox/TB_Layout.ts` | 문단 → 글줄. `docs/architecture.md` |

## 데이터 형식과 모드

| 용어 | 코드 이름 | 설명 |
|---|---|---|
| kayak json | `saveAsJson()` / `loadFromJson()` (`textbox/TextBox_InOut.ts`) | Kayak의 저장 형식. `font_used`에 사용 폰트의 url·issue가 들어간다 |
| InDesign json | `TB_InDesignJsonConverter`, `importFromInDesignJson()` | InDesign 내보내기 데이터를 kayak json으로 바꾼다 |
| SVG 스냅샷 | `snapshotAsSVG()` | 렌더 결과를 SVG 문자열로 |
| 편집 모드 / schema 모드 | 생성 옵션 `schema` | schema 모드는 DOM·폰트 로딩·레이아웃 없이 JSON만 다룬다(`docs/usage/02-config.md`) |
