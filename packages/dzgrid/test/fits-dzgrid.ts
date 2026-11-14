// Compiled, not run (`npm run typecheck`, with a DzGrid checkout beside this one): `dzTooltips()` is a DzGrid feature —
// the bridge's structural types fit DzGrid's own (`GridFeature`, `FeatureHandle.tooltips`, `TooltipSeam`).
import type { GridFeature } from '@dzgrid/dom';
import { dzTooltips } from '../src/index.js';

export const features: GridFeature[] = [dzTooltips(), dzTooltips({ tone: 'neutral', placement: 'top', header: true, html: true })];
