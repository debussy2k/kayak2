// css-element-queries 1.x는 타입 선언을 제공하지 않는다. TextBox.set_client_size_listener가 ResizeObserver가 없는 브라우저에서만 쓴다.
declare module 'css-element-queries/src/ResizeSensor.js' {
    class ResizeSensor {
        constructor(element: Element | Element[], callback: (size: { width: number; height: number }) => void);
        detach(callback?: () => void): void;
        reset(): void;
    }
    export default ResizeSensor;
}
