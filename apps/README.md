# apps

kayak 라이브러리를 쓰는 앱(새 playground 등)을 둘 자리다. 첫 앱을 만들 때 루트 package.json의 `workspaces`에 `"apps/*"`를 더한다.

| 폴더 | 무엇 | workspace |
|---|---|---|
| `book-mockup/` | 책 만들기 서비스의 클릭되는 HTML 목업(파일 하나, 빌드·의존성 없음) | 아님 — package.json이 없다 |
