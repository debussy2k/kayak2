# Kayak 사용 가이드

> 언제 읽나: 현재 공개 API(legacy)를 쓰거나 고칠 때.
> Kayak에서 옮겨 온 문서다. 공개 API 재설계 때 다시 쓴다. 문서 안의 `src/entry.ts`는 `packages/kayak/src/index.ts`, 빌드·배포 명령은 Kayak 기준이다(kayak2의 명령은 루트 [README](../../README.md)).

Kayak은 웹 페이지에 올리는 텍스트 박스 편집기 겸 렌더러다. 글리프를 opentype.js로 직접 읽어 SVG로 그리므로,
화면과 서버(Node)에서 같은 결과를 얻고 그 결과를 SVG/JSON으로 내보낼 수 있다.

이 문서는 Kayak을 가져다 쓰는 호스트(Edicus 등) 개발자를 위한 것이다. 공개 API(`src/entry.ts`가 내보내는 것)만 다루며,
내부 구조와 빌드는 저장소 루트의 [README.md](../../README.md)를 본다.

## 목차

| 문서 | 내용 |
|---|---|
| [01. 시작하기](01-getting-started.md) | 번들 로딩, 최소 예제, 수명주기(생성 → `init` → `attachTo` → `detach`/`destroy`) |
| [02. 생성 옵션](02-config.md) | `new textbox(options)`의 옵션, 편집 모드와 schema 모드의 차이 |
| [03. textbox API](03-textbox-api.md) | `textbox` 메서드 레퍼런스 (상태, 크기, JSON, SVG, 리스너, 일괄 서식, named range) |
| [04. 편집과 서식](04-editing-and-style.md) | `tb.opEdit`(입력·삭제·undo), `tb.opStyle`(글자·문단 서식), 선택 범위 |
| [05. 보조 모듈](05-helpers.md) | `GT_MasterClipboard`, `spFontManager`, `TB_PlatformEnv`, `TB_InDesignJsonConverter` 등 |
| [06. 예제 모음](06-recipes.md) | 툴바 연결, 외부 undo 연동, Node에서 JSON → SVG, InDesign JSON 가져오기 |

## 배포 파일

| 파일 | 환경 | 비고 |
|---|---|---|
| `dist/m1textbox.min.js` | 브라우저 | UMD. `<script>`로 넣으면 전역 `M1TextBox`. 로드될 때 `base.css`를 `<head>`에 `<style>`로 넣는다 |
| `dist/m1textbox.d.ts` | 브라우저 | 타입 선언. `import`로 써도, 전역 `M1TextBox`로 써도 타입이 붙는다 (TypeScript 3.8 이상) |
| `dist/m1textbox_node.min.js` | Node | UMD. DOM은 jsdom으로 만들어 [`TB_PlatformEnv.set()`](05-helpers.md#tb_platformenv)으로 넘긴다. CSS는 넣지 않는다 |
| `dist/m1textbox_node.d.ts` | Node | 타입 선언 |

빌드 방법은 루트 [README.md](../../README.md#build-vite)를 본다.

## 공개 export

| 이름 | 종류 | 브라우저 | Node | 설명 |
|---|---|:-:|:-:|---|
| `textbox` | class | O | O | 텍스트 박스 본체. [03](03-textbox-api.md), [04](04-editing-and-style.md) |
| `GT_MasterClipboard` | 싱글턴 | O | O | textbox끼리 공유하는 내부 클립보드. [05](05-helpers.md#gt_masterclipboard) |
| `spFontManager` | 싱글턴 | O | O | 폰트 목록과 로딩된 폰트 관리. [05](05-helpers.md#spfontmanager) |
| `TB_PlatformEnv` | 객체 | O | O | window/document와 Node용 파일 함수 주입. [05](05-helpers.md#tb_platformenv) |
| `TB_InDesignJsonConverter` | class | O | O | InDesign 스크립트 JSON → kayak JSON. [05](05-helpers.md#tb_indesignjsonconverter) |
| `TB_FontSizeStepUtil` | class | O | - | 글자 크기 한 단계 키우기/줄이기. [05](05-helpers.md#tb_fontsizesteputil) |
| `MeasureDiv` | 싱글턴 | O | - | 측정용 숨은 div. 디버그 표시용. [05](05-helpers.md#measurediv) |
| `TB_NormalizedIME` | class | O | - | 브라우저별 IME 이벤트 정규화. textbox가 내부에서 쓴다. [05](05-helpers.md#tb_normalizedime) |

호스트가 **이름으로** 쓸 수 있는 타입은 다음 7개뿐이다(`src/entry.ts` 끝의 `export type`).
나머지 타입은 추론과 자동완성에는 쓰이지만 `import type`으로 가져올 수 없다.

`TB_ConfigOptions`, `KayakJsonObject`, `DocChangeData`, `DocChangeListener`, `Dimension`, `LoadJsonOptions`, `LoadJsonResult`

## 먼저 알아둘 개념

**문서 끝의 줄바꿈.** 문서는 항상 `\n` 하나로 끝난다. 빈 textbox의 `text_length()`는 `1`이고, `"Hello"`를 넣으면 `6`이다.
이 마지막 `\n`은 지울 수 없다(`erase`가 범위 끝을 자동으로 한 칸 줄인다).

**위치와 범위.** 위치(문서에서는 `ci` 또는 `cursor`)는 0부터 센 문자 인덱스다. 범위 `{ begin, end }`는 `begin` 이상 `end` 미만이다.
문단 경계는 `\n` 문자이고, 문단 서식(정렬·들여쓰기 등)은 범위가 걸친 문단 전체에 적용된다.

**두 가지 모드.** `new textbox({ schema: true })`는 DOM·레이아웃·폰트 로딩 없이 텍스트와 서식만 다루는 schema 모드다.
JSON을 만들거나 고칠 때 쓴다. 기본값은 화면에 그리는 편집 모드다. 차이는 [02. 생성 옵션](02-config.md#편집-모드와-schema-모드)에 있다.

**단위.**

| 값 | 단위 |
|---|---|
| 박스 크기, 여백, 들여쓰기, 문단 앞뒤 간격 | px (96dpi) |
| 글자 크기(`FontSize`), 행간(`leading`), 외곽선 두께(`stroke.weight`) | pt |
| 자간(`letter_space`) | em의 1/1000 |
| 장평(`letter_scale_x`) | % (100이 기본) |
| 줄 간격(`line_space`) | 글자 크기에 대한 배수 (기본 1.2) |
| 그림자 크기·거리(`shadow.size`, `shadow.distance`) | mm |

## 예제 코드의 타입 검사

이 문서의 TypeScript 예제는 [test/dts/docs_examples.ts](../../packages/kayak/test/api/dts/docs_examples.ts)와
[test/dts/docs_examples_node.ts](../../packages/kayak/test/api/dts/docs_examples_node.ts)에도 들어 있어,
`npm run build_types`(→ `npm run check_types_dist`)가 배포용 `.d.ts`에 대고 컴파일한다.
공개 API가 바뀌어 예제가 깨지면 빌드가 실패하므로, 그때 문서도 같이 고친다.

## 알려진 결함

공개 API에서 알려진 결함은 각 메서드 설명에 "주의"로 적고 [docs/issues.md](../issues.md)의 번호로 연결했다.
