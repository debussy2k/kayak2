// Vite의 define으로 production 빌드에서만 주입되는 전역. (vite.config.mjs 참고)
// TextBox.js는 typeof 검사로 존재 여부를 확인한 뒤 쓴다.
declare var LOG_LEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' | number | undefined;   // loglevel.LogLevelDesc와 같다 (전역 d.ts라 import 불가)

// TB_Utils.detect_browser()가 `typeof safari !== 'undefined' && safari.pushNotification`로 Safari를 감지한다 (Safari 전용 전역).
declare var safari: any;
