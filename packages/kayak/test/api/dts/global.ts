/// <reference path="../../../dist/m1textbox.d.ts" />
// 스크립트 파일(비모듈)에서 전역 M1TextBox를 쓰는 호스트 (m1textbox.min.js를 <script>로 넣는 경우)
const tb_global = new M1TextBox.textbox({ schema: true });
const len_global: number = tb_global.getLength();
const mc_global = M1TextBox.GT_MasterClipboard.getInstance();
const opt_global: M1TextBox.TB_ConfigOptions = { schema: true };
// @ts-expect-error 내부 타입은 전역 namespace에서도 보이지 않는다
let hidden_global: M1TextBox.Point;
