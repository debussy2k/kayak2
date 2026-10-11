# 아키텍처

> 언제 읽나: 엔진 코드(`packages/kayak/src/engine`)를 고치기 전, 어떤 파일이 무엇을 하는지 찾을 때.

경로는 `packages/kayak/src/` 기준. 여기 적은 것은 지도다. 고치기 전에는 해당 파일과 그 특성 테스트(`test/engine/…`)를 읽는다.

## 1. 한눈에

- 텍스트 상자 하나를 편집하고 렌더링하는 엔진이다. 원고 텍스트와 서식 속성을 갖고, 문단을 글줄로 나누고, 글리프를 opentype.js로 직접 읽어 SVG로 그린다. 그래서 브라우저와 Node에서 같은 결과가 나온다.
- 저장은 kayak json(`saveAsJson`/`loadFromJson`), 가져오기는 InDesign json(`TB_InDesignJsonConverter`), 내보내기는 SVG(`snapshotAsSVG`).
- 진입점 두 개:
  - `index.ts`(브라우저): `engine/css/base.css`를 번들 문자열로 넣었다가 `document`가 있으면 `<head>`에 `<style>`로 넣는다. 값 8개를 내보낸다.
  - `node.ts`(Node): 값 5개. Node에서는 호스트가 jsdom `window`와 폰트 파일 함수를 `TB_PlatformEnv.set({ window, get_font_filepath, … })`로 넣어야 한다(`engine/textbox/TB_PlatformEnv.ts`).

## 2. 디렉터리 지도

| 폴더 | 하는 일 | 대표 파일 |
|---|---|---|
| `engine/segment/` | 서식 속성 레이어. 글자 범위(또는 문단)마다 속성값을 run-length로 저장하고, 편집 때 범위를 밀고 당긴다 | `seglayer.ts`(글자), `seglayer_par.ts`(문단), `seglayer_manager.ts`(레이어 묶음 편집·undo), `ATTR_*.ts`(속성 11종), `master_clipboard.ts` |
| `engine/geometry/` | 경로 계산과 글줄 경로(text on path) | `TB_Path.ts`, `PathUtil.ts`, `TB_TextOnPath*.ts`, `MathUtil.ts` |
| `engine/textbox/` | 텍스트 상자 본체: 편집, 레이아웃, 렌더, 폰트, 입출력 | `TextBox.ts` 외 아래 |
| `engine/textbox/ime/` | 브라우저별 IME(조합 입력) 처리 | `TB_Ime_Chrome.ts`, `TB_Ime_Safari_Mac.ts` 등 |
| `engine/textbox/layout_service/` | 레이아웃 중간 상태 | `TB_LayoutContext.ts`, `TB_PosTracker.ts`, `TB_ParChangeInfo.ts`, `TB_LayoutAux.ts` |
| `engine/textbox/services/` | 레이아웃·렌더 보조 | `TB_JustificationService.ts`(양쪽 맞춤), `TB_TofuService.ts`(없는 글리프 대체), `TB_StyleService.ts`, `TB_TextFxService.ts`(그림자 등), `TB_Format.service.ts`(글을 한 줄에 맞추는 등 서식 자동 조정 — 장평을 바꾼다) |
| `engine/textbox/inout/` | SVG 입출력 보조 | `inout.ts` |
| `engine/css/` | 편집 화면 기본 CSS | `base.css` |
| `types/` | 타입 없는 외부 패키지의 shim, 전역 선언 | `opentype.js.d.ts`, `globals.d.ts` 등 |

`engine/textbox/`의 주요 파일:

- **본체와 설정**: `TextBox.ts`(공개 클래스), `TB_Config.ts`(생성 옵션·DOM 골격), `TB_Preference.ts`, `TextBoxEnv.ts`, `types.ts`(내부 타입)
- **편집 API**: `TextBox_Edit.ts`(`opEdit`), `TextBox_Style.ts`(`opStyle`), `TextBox_InOut.ts`(`inout` — JSON·SVG·InDesign), `Textbox_Verify.ts`(불러온 JSON 검사·복구)
- **원고와 이력**: `TP_TextCore.ts`(글자 코드 배열과 텍스트 편집), `TP_TextHistory*.ts`, `TB_History.ts`(redux + redux-undo)
- **입력**: `TB_Input.ts`, `TB_Keyboard.ts`, `TB_KeydownAction.ts`, `TB_NormalizedIME.ts`, `TB_Cursor.ts`, `TB_SelRange.ts`, `TB_ApplyEditOperation.ts`(붙여넣은 HTML 적용)
- **레이아웃**: `TB_Layout.ts`, `TB_LineComposer.ts`, `TB_WordFetch.ts`/`TB_WordFinder.ts`/`TB_WordInfo.ts`/`TB_WordCache.ts`(단어 단위 측정), `TB_LineMetric.ts`, `TB_DocFactory.ts`, `TextBoxDom.ts`(논리 문서 모델: `DomPar`, `DomLine`), `TB_layoutWalker.ts`, `TB_PostLayoutProcess.ts`, `TB_LocationFinder.ts`(좌표 ↔ 글자 위치)
- **렌더**: `TB_SvgLineFactory.ts`, `TB_SvgTextRender.ts`(opentype 글리프 → SVG path. 글자 크기·장평·자간·커닝을 여기서 적용), `TB_SvgGradientFactory.ts`, `TB_SvgDimension.ts`, `TB_StyleContext.ts`(속성 → HTML/CSS 스타일, 클립보드 복사 HTML), `TB_ExportHtml.ts`(seglayer → HTML)
- **폰트**: `TB_FontManager.ts`(전역 `spFontManager`), `TB_LocalFontLoader.ts`(텍스트 상자별), `TB_FontRscList.ts`(폰트 목록 `font_rsc_list`), `TB_FontDecoder.ts`, `TB_GsubSafety.ts`
- **기반**: `TB_PlatformEnv.ts`(window/document·Node 함수 주입), `TB_Dom.ts`(jQuery를 대신하는 DOM 헬퍼), `cg.ts`(`CGPoint`/`CGSize`/`CGRect`/`CGMatrix`), `TB_Utils.ts`, `MeasureDiv.ts`

## 3. 데이터 흐름

**상태.** `TextBox` 생성자가 만드는 것: `text_core`(`TP_TextCore`), 속성 레이어들(`m_Par`, `m_DocLayer`, `m_FFamilyLayer`, `m_FSizeLayer`, `m_Bold`, `m_FontColor`, `m_LetterSpacing`, `m_LetterScaleX`, `m_Stroke`, `m_Shadow`, `m_NamedRange`)과 이를 묶는 `seg_mgr`(`SeglayerManager`), `tbconfig`, `tbcursor`, `history`, `opEdit`/`opStyle`/`inout`.

**편집 → 화면.**

1. 키보드·IME 입력(`TB_Input`, `TB_Keyboard`, `ime/*`)이나 호스트의 `opEdit`/`opStyle` 호출
2. `TextBox_Edit`/`TextBox_Style`이 `text_core`와 `seg_mgr`를 바꾸고 변경 정보(par/text change info)를 만든다
3. `TB_Layout.do_layout(change_info_par, change_info_text)` — `set_par`면 바뀐 문단 전체를 다시(`full_layout`), 아니면 바뀐 문단 하나에서 가능한 글줄을 재사용(`smart_layout`). 처음 불러올 때는 `do_layout_all()`
4. 문단마다 `TB_LayoutContext`를 만들고 `TB_LineComposer.do_par_to_lines()`가 단어를 측정해 글줄로 나눈다(`TB_WordFetch`). 양쪽 맞춤이면 `get_jstf_balance_info()`가 `TB_JustificationService`를 부른다
5. 글줄마다 `TB_DocFactory`가 글줄 객체를 만들고(`create_line_view_obj`, `build_lineview`) 행간에 따라 높이를 정한다(`set_line_height_by_leading`). SVG 글리프는 `TB_SvgLineFactory`/`TB_SvgTextRender`가 그린다
6. `on_complete_layout()` 뒤 `TB_PostLayoutProcess`(그라디언트 조정 등)

**저장·불러오기.** `TextBox_InOut.saveAsJson()`이 레이어와 텍스트를 kayak json으로, `loadFromJson()`이 반대로(폰트 로딩 후 레이아웃). `importFromInDesignJson()`은 `TB_InDesignJsonConverter`로 kayak json을 만든 뒤 불러온다. `snapshotAsSVG()`는 현재 렌더 결과를 SVG 문자열로 준다.

**schema 모드.** 생성 옵션 `schema: true`면 DOM·폰트 로딩·레이아웃 없이 `text_core`와 레이어만 다룬다(JSON 생성·변환용, `docs/usage/02-config.md`). 이 모드에서 부르면 안 되는 메서드가 있다(`docs/issues.md` #17, #20).

## 4. 공개 표면

- 브라우저 `index.ts`: `TB_PlatformEnv`, `textbox`, `GT_MasterClipboard`, `MeasureDiv`, `TB_NormalizedIME`, `spFontManager`, `TB_InDesignJsonConverter`, `TB_FontSizeStepUtil`. Node `node.ts`: 그중 `MeasureDiv`, `TB_NormalizedIME`, `TB_FontSizeStepUtil`을 뺀 5개.
- 이름으로 공개하는 타입 7개: 각 진입점 끝의 `export type` (`TB_ConfigOptions`, `KayakJsonObject`, `DocChangeData`, `DocChangeListener`, `Dimension`, `LoadJsonOptions`, `LoadJsonResult`).
- `dts-bundle.config.json`의 `exportReferencedTypes: false` 때문에 나머지 내부 타입은 d.ts에서 이름으로 나가지 않는다.
- 사용법: `docs/usage/`.

## 5. 폰트와 메모리

- `spFontManager`(전역)가 폰트를 내려받아 파싱하고 참조 수를 센다. 텍스트 상자마다 `TB_LocalFontLoader`가 자기가 쓰는 폰트를 관리한다.
- 텍스트 상자를 다 쓰면 `destroy()`를 부른다: `TextBox.destroy()` → `TB_LocalFontLoader.destroy()` → `TB_FontManager.releaseFontResource()`. 참조 수가 0이 된 폰트는 메모리에서 지워진다.
- 전부 지우려면 `spFontManager.clearFonts()`(hard reset — 다른 텍스트 상자가 없을 때만).
- kayak json의 `font_used`에는 쓰인 폰트의 url과 issue가 있다. 없으면 폰트 목록(`font_list_id`)에서 찾는다. 목록에 없는 폰트는 기본 폰트로 대체된다.
- Node에서는 폰트 파일을 로컬 폴더에 저장해 두고 반복해 쓴다. 호스트가 `TB_PlatformEnv.set`의 `get_font_filepath`로 "url → 로컬 파일 경로" 함수를 넣는다.
- 알려진 문제: 폰트 로딩이 실패하면 `init()`/`set_font_family`가 끝나지 않을 수 있다(usage 문서 "주의").

## 6. 테스트 구성

| 폴더 | 무엇을 | 방식 |
|---|---|---|
| `test/engine/segment` | 속성 레이어 | 단위 테스트 + parity 테스트(`parity_*.test.js`: TS 전환 전 원본 JS `legacy/`와 같은 무작위 편집 시퀀스를 비교) |
| `test/engine/geometry` | 경로·글줄 경로 계산 | 특성 테스트, 결과를 vitest 스냅샷으로 고정 |
| `test/engine/textbox` | textbox 하위 모듈과 편집기 | 특성 테스트. 필요한 필드만 가진 가짜 tb(`helpers.js`의 `make_tb`), 실제 textbox 위 키보드·IME·클립보드(`editor.test.js`) |
| `test/snapshot` | 렌더링 전체 | jsdom 위 실제 textbox → HTML·SVG·JSON 덤프를 파일 스냅샷과 비교. shortid id는 정규화, 모든 폰트 요청은 `test/fixtures/fonts/KoPubDotumMedium.ttf`로 돌린다(네트워크 없음) |
| `test/api` | 공개 표면 | export 이름 목록(`entry.test.js`), d.ts 소비자 픽스처(`dts/`, `npm run build`가 strict로 컴파일) |

jsdom 11은 `transform` 같은 CSS 속성을 저장하지 않으므로 HTML 덤프에 나타나지 않는다(`test/snapshot/helpers.js` 주석, `docs/roadmap.md`의 jsdom 항목).
