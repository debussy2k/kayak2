# kayak2

온라인 책 만들기 서비스에서 원고를 꾸미고 레이아웃을 잡는 텍스트 엔진이다. 텍스트 상자 편집, 한글 조판, opentype.js 기반 SVG 렌더링, InDesign 데이터 변환을 브라우저와 Node에서 같은 결과로 한다.
Kayak(10년 된 원본, TypeScript 전환 완료)을 옮겨 왔다 — `docs/decisions.md`.

## 시작

[Volta](https://volta.sh)가 있으면 Node 24가 자동으로 맞춰진다.

    npm ci
    npm run check      # 타입 검사 + lint + 테스트
    npm run build      # packages/kayak/dist (UMD·ESM 번들, d.ts)

## 구조

    packages/kayak/    라이브러리 (src/index.ts·node.ts 공개 진입점, src/engine 내부 구현)
    apps/              앱 자리 (비어 있음)
    docs/              설계·결정·용어·페르소나·사용 문서

AI 도구로 작업한다면 [AGENTS.md](AGENTS.md)부터 읽는다.
