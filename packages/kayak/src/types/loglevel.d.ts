// loglevel 1.6.1은 타입 선언을 제공하지 않는다. 이 프로젝트가 `import * as log from 'loglevel'`로 쓰는 API만 선언한다.
// tsconfig.json의 paths가 'loglevel'을 이 파일로 매핑한다 (Vite/Vitest는 paths를 무시하므로 런타임은 실제 패키지).
// ambient `declare module`이 아니라 모듈 파일이어야 dts-bundle-generator가 dist/m1textbox.d.ts에 인라인한다.
export type LogLevelDesc = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' | number;
export function trace(...msg: any[]): void;
export function debug(...msg: any[]): void;
export function info(...msg: any[]): void;
export function warn(...msg: any[]): void;
export function error(...msg: any[]): void;
export function setLevel(level: LogLevelDesc, persist?: boolean): void;
export function setDefaultLevel(level: LogLevelDesc): void;
export function getLevel(): number;
export function enableAll(persist?: boolean): void;
export function disableAll(persist?: boolean): void;
