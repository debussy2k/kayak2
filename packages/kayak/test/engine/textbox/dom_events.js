/*
    jsdom 이벤트 헬퍼. jsdom 11은 KeyboardEvent/ClipboardEvent 초기화 옵션을 다 지원하지 않으므로
    plain Event를 만들고 필요한 속성(keyCode, ctrlKey, data, clipboardData…)을 직접 붙인다.
*/
export function fire(el, type, props) {
    const win = el.ownerDocument.defaultView;
    const e = new win.Event(type, { bubbles: true, cancelable: true });
    for (const k of Object.keys(props || {}))
        Object.defineProperty(e, k, { value: props[k], configurable: true });
    el.dispatchEvent(e);
    return e;
}

/** 호출 기록. rec.calls에 [이름, ...인자]가 쌓인다. undefined 인자는 '∅'로 적어 스냅샷에 남긴다. */
export function recorder(names) {
    const rec = { calls: [], fns: {} };
    for (const name of names)
        rec.fns[name] = (...args) => { rec.calls.push([name, ...args.map(a => a === undefined ? '∅' : a)]); };
    return rec;
}

/** 가짜 clipboardData */
export function fake_clipboard(initial) {
    const data = Object.assign({}, initial);
    return { data, setData(k, v) { data[k] = v; }, getData(k) { return data[k] === undefined ? '' : data[k]; } };
}
