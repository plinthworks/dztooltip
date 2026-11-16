# @dztooltip/angular

`[dzTooltip]` and `[dzPopover]` for Angular 19 to 22 (standalone, signals, zoneless or not): words, an
`<ng-template>`, a component, or HTML through Angular's sanitizer and then DzTooltip's `safeHtml`. Nothing runs on the
server.

```sh
npm install @dztooltip/angular @dztooltip/theme
```

```ts
import { DzTooltip, DzPopover } from '@dztooltip/angular';

@Component({
  imports: [DzTooltip, DzPopover],
  template: `
    <button [dzTooltip]="'Delete the row'" dzTooltipTone="danger" dzTooltipPlacement="top">Delete</button>
    <button [dzPopover]="details" [dzPopoverContext]="row" #p="dzPopover" (closed)="saved($event)">More</button>
    <ng-template #details let-row let-close="close">{{ row.name }} <button (click)="close()">Done</button></ng-template>
  `,
})
```

Add `@dztooltip/theme/dztooltip.css` to your styles. Every input: https://github.com/plinthworks/dztooltip#readme. MIT © Plinthworks.
