/**
 * @dztooltip/core (docs/behaviors/tooltips-popovers.md): tooltips and popovers on any element of a page — placement
 * (twelve placements and `auto`, flip, shift, the arrow following), tones, shapes, CSS animations (`@dztooltip/theme`)
 * or the app's own (`animate`, a GSAP timeline welcome), rich content, and `safeHtml`, the cleaner that lets a tooltip or
 * a popover show HTML. No runtime dependency.
 */
export { tooltip, type TooltipHandle, type TooltipOptions } from './tooltip.js';
export { popover, type PopoverCloseReason, type PopoverHandle, type PopoverOptions } from './popover.js';
export { safeHtml } from './html.js';
export type { TipContent } from './float.js';
export type { TipAnimate, TipAnimateInfo, TipLook, TipThenable } from './bubble.js';
export type { TipAnimation, TipSide, TipTone, TooltipPlacement } from './types.js';
