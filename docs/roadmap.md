# 로드맵

> 언제 읽나: 다음 작업을 고를 때, 요청이 지금 범위 밖인지 확인할 때.

순서는 대략의 우선순위다. 각 항목은 시작할 때 `docs/specs/`에 설계를 쓴다.

1. **공개 API 재설계** — `src/api/`에 엔진을 감싸는 새 API를 만든다. 지금 API는 `kayak/legacy` 하위 경로로 남기고 호스트 팀과 전환한다. 기준은 `docs/personas.md`.
2. **전문 기능 (다단 등)** — 지금 레이아웃은 텍스트 상자 하나를 전제한다. 다단은 여러 영역으로 이어지는 흐름이 필요하므로 API 재설계 때 "영역/흐름" 개념이 들어갈 자리를 미리 고려한다.
3. **seglayer/seglayer_par 통합** — `packages/kayak/test/engine/segment/parity_*.test.js`로 검증하고, 끝나면 `legacy/`와 함께 지운다.
4. **결함 수정** — `docs/issues.md`.
5. **런타임 의존성 현대화** — shortid → nanoid(지금은 shortid의 하위 nanoid를 2.0.3으로 고정), css-element-queries 제거(ResizeObserver), redux/immutable 정리, lodash → lodash-es, lodash 4.17.11의 보안 패치 버전.
6. **jsdom 업그레이드** — 30.1.2에서 렌더링 스냅샷 14개와 platform_utils 테스트 2개가 실패한다. 스냅샷 차이는 HTML 덤프의 inline style뿐(새 jsdom이 `transform` 등을 저장)이고, legacy Edge UA 판별 테스트 1개는 원인 미확인. 스냅샷을 갱신할지, legacy Edge 경로를 지울지 정한다(`docs/decisions.md`).
7. **Prettier 일괄 포맷** — API 재설계 직전, 커밋 하나로.
8. **새 playground** — `apps/playground`. 루트 workspaces에 `"apps/*"`를 더한다.
9. **호스트 배포 전환** — Edicus 등이 kayak2의 번들을 받도록. 출력 파일 이름은 Kayak과 같다.
