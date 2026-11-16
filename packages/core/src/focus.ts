/**
 * A popover's focus (tooltips-popovers.md 11, 36): what Tab stops on, where the focus goes when it opens, and a modal
 * popover's outside made inert while it is open.
 */

/** What Tab stops on. */
export const FOCUSABLE = ':is(a[href], button, input, select, textarea, summary, [contenteditable=true]):not([disabled], [type=hidden], [tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

/** The controls Tab stops on inside `el`, its focus guards left out. */
export const controlsIn = (el: Element): HTMLElement[] => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => !x.hasAttribute('data-dzt-guard'));

/**
 * Where the focus goes when a popover opens (36): `initialFocus` — an element, a function given the bubble (its throw
 * reported), `false` (none; a modal's bubble itself) — else the element marked `autofocus`, else its first control,
 * else (modal) the bubble.
 */
export function firstFocus(bubble: HTMLElement, pick: HTMLElement | ((b: HTMLElement) => HTMLElement | null | undefined) | false | undefined, modal: boolean, report: (e: unknown) => void): HTMLElement | null {
  if (pick === false) return modal ? bubble : null;
  let to: HTMLElement | null = null;
  if (typeof pick === 'function') {
    try {
      to = pick(bubble) ?? null;
    } catch (err) {
      report(err);
    }
  } else if (pick && pick.nodeType === 1) to = pick;
  return (to && typeof to.focus === 'function' ? to : null) ?? bubble.querySelector<HTMLElement>('[autofocus]') ?? controlsIn(bubble)[0] ?? (modal ? bubble : null);
}

/** Never made inert: what holds no content of the page's, and a tooltip's bubble (a tooltip over the modal). */
const KEEP = 'script, style, link, template, .dzt-tooltip';
/** How many open modals shut each element (two at once, 36): it opens when the last of them closes. */
const shutBy = new WeakMap<Element, number>();

/**
 * A modal popover's outside shut while it is open (36): every element beside the path from the bubble up to its
 * document's body made `inert` — or, where a browser has none, `aria-hidden="true"` — except DzTooltip's bubbles and
 * what was already so. Returns the opening: exactly what it changed is given back.
 */
export function shut(bubble: HTMLElement): () => void {
  const doc = bubble.ownerDocument;
  const inert = hasInert(doc);
  const done: Element[] = [];
  for (let n: Element = bubble; n.parentElement && n !== doc.body; n = n.parentElement) {
    for (const s of n.parentElement.children) {
      if (s === n || s.matches(KEEP) || s === doc.head) continue;
      const by = shutBy.get(s) ?? 0;
      // The page's own: left as it is.
      if (!by && (inert ? (s as HTMLElement).inert : s.getAttribute('aria-hidden') === 'true')) continue;
      if (!by) {
        if (inert) (s as HTMLElement).inert = true;
        else s.setAttribute('aria-hidden', 'true');
      }
      shutBy.set(s, by + 1);
      done.push(s);
    }
  }
  return () => {
    for (const s of done) {
      const by = (shutBy.get(s) ?? 1) - 1;
      if (by > 0) {
        shutBy.set(s, by);
        continue;
      }
      shutBy.delete(s);
      if (inert) (s as HTMLElement).inert = false;
      else s.removeAttribute('aria-hidden');
    }
    done.length = 0;
  };
}

/** Whether the browser makes elements inert (36); without it a modal popover gets focus guards. */
export const hasInert = (doc: Document): boolean => 'inert' in doc.createElement('div');

/**
 * Two focus guards (36, a browser with no `inert`): empty focusable ends of the bubble; a focus landing on the first
 * goes to its last control, on the last to its first. Returns their removal.
 */
export function guards(bubble: HTMLElement, body: HTMLElement): () => void {
  const doc = bubble.ownerDocument;
  const make = (): HTMLElement => {
    const g = doc.createElement('span');
    g.tabIndex = 0;
    g.setAttribute('data-dzt-guard', '');
    g.setAttribute('aria-hidden', 'true');
    g.style.setProperty('position', 'fixed');
    g.style.setProperty('inline-size', '1px');
    g.style.setProperty('block-size', '1px');
    g.style.setProperty('overflow', 'hidden');
    g.style.setProperty('clip-path', 'inset(50%)');
    return g;
  };
  const [head, tail] = [make(), make()];
  const to = (last: boolean) => (): void => {
    const c = controlsIn(bubble);
    ((last ? c[c.length - 1] : c[0]) ?? bubble).focus();
  };
  head.addEventListener('focus', to(true));
  tail.addEventListener('focus', to(false));
  body.before(head);
  body.after(tail);
  return () => {
    head.remove();
    tail.remove();
  };
}
