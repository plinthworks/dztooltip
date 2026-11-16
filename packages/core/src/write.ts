/** An attribute set, changed or removed (null) — written only when it differs. */
export const setAttr = (el: Element, name: string, value: string | null): void => {
  if (value === null) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
  } else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
};

/** A length in px on a style property, written only when it differs. */
export const setPx = (el: HTMLElement, prop: string, v: number): void => {
  const s = `${v}px`;
  if (el.style.getPropertyValue(prop) !== s) el.style.setProperty(prop, s);
};

/** Adds or removes one id in an element's `aria-describedby`, the others kept. */
export const describe = (el: Element, id: string, on: boolean): void => {
  const t = (el.getAttribute('aria-describedby') ?? '').split(' ').filter((x) => x && x !== id);
  if (on) t.push(id);
  setAttr(el, 'aria-describedby', t.join(' ') || null);
};

/**
 * Listeners taken off together, by hand: an `AbortSignal` made by one window is refused by another window's targets in
 * some environments, and an anchor in an iframe with its bubble above listens in both (34).
 */
export class Ears {
  #offs: (() => void)[] = [];
  on(t: EventTarget, type: string, fn: (e: Event) => void, opts: AddEventListenerOptions = {}): void {
    t.addEventListener(type, fn, opts);
    this.#offs.push(() => t.removeEventListener(type, fn, opts));
  }
  off(): void {
    for (const f of this.#offs.splice(0)) f();
  }
}
