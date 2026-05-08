type FocusCallback = (latitude: number, longitude: number) => void;
let _callback: FocusCallback | null = null;

export function registerMapFocusCallback(cb: FocusCallback) {
    _callback = cb;
}

export function unregisterMapFocusCallback() {
    _callback = null;
}

export function setMapFocus(latitude: number, longitude: number) {
    _callback?.(latitude, longitude);
}
