---
name: verify
description: kayak2에서 작업을 끝냈다고 말하기 전이나 커밋 전에 타입 검사·lint·테스트를 돌리고 실패를 해석한다.
---

# verify

1. 저장소 루트에서 `node -v`가 v24인지 본다. 아니면 멈추고 알린다(Volta 설정 문제).
2. `npm run check`를 돌린다(typecheck → lint → test, 앞이 실패하면 멈춤).
3. 실패를 이렇게 처리한다.
   - typecheck: 오류 위치를 고친다. `any`나 `@ts-ignore`로 덮지 않는다.
   - lint: 고친다. 규칙을 끄지 않는다. 엔진 완화 목록(`eslint.config.js`)은 사람 승인 없이 늘리지 않는다.
   - 스냅샷 불일치: 렌더링이 바뀐 것이다. 의도한 변경이 아니면 코드를 되돌린다. 의도했으면 `update-snapshots` 스킬.
   - 시간 초과: `npm test -w kayak -- <파일>`로 단독 실행해 부하 때문인지 확인하고 둘 다 보고한다.
4. 테스트 뒤 `git status --porcelain`으로 새로 생기거나 바뀐 스냅샷 파일이 없는지 본다. 있으면 테스트가 새 스냅샷을 몰래 쓴 것이다(경로 오류일 가능성이 크다).
5. 보고에는 통과·실패 수를 출력 그대로 적는다.
