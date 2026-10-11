# segment 원본 JS 기준본

TypeScript 전환(1b단계, 2026-10-06) 직전의 `src/segment/seglayer.js`, `seglayer_par.js`, `seglayer_manager.js`를
그대로 복사한 것이다. import 경로만 `src/segment`를 가리키도록 바꿨다.

`test/segment/parity_*.test.js`가 이 파일들과 현재 `src/segment`의 TS 구현에 같은 무작위 편집 시퀀스를 적용해
매 단계 결과를 비교한다. 전환 중 동작이 달라지면 여기서 잡힌다.

`seglayer`/`seglayer_par` 통합 작업(설계 문서 결정 2)이 끝나면 이 디렉터리와 parity 테스트를 지운다.
**이 파일들은 고치지 않는다.** 원본 결함을 고칠 때는 `src/segment`만 고치고 parity 테스트의 해당 시퀀스를 제외한다.
