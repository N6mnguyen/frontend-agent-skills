# Profiling workflow and refactor examples

## Profiling recipe

1. Build and serve production config: `ng serve --configuration production` (or serve `dist/` statically). Dev mode adds extra checks and skews timings.
2. Angular DevTools → Profiler → Start recording → perform the slow interaction once → Stop.
3. Read the bar chart: each bar is one change-detection cycle. Click the tallest bar; the flame graph shows which components took time and how often they were checked.
4. Note the source event (click, timer, XHR). Many cycles triggered by `setInterval`, `mousemove`, or `scroll` in a zone app point to third-party code running inside the zone.
5. Chrome Performance panel: record the same interaction; look for long tasks over 50 ms, forced layouts (purple), and script attributed to your component files.
6. Fix one thing, repeat the recording, compare cycle count and duration.

## Bundle analysis

```bash
# esbuild application builder (Angular 17+ default)
ng build --stats-json
# open https://esbuild.github.io/analyze/ and load dist/<app>/browser-stats.json

# any builder, via source maps (do not deploy maps publicly unless intended)
ng build --source-map
npx source-map-explorer "dist/<app>/browser/*.js"
```

Look for: duplicate libraries in several lazy chunks (move to shared chunk or trim), large locale data (`moment` locales), full icon sets, polyfills no longer needed for the browserslist.

## Refactor: getter in template to computed

Before (runs `filter` + `reduce` on every change-detection pass, for every component instance):

```ts
// src/app/cart/cart.component.ts (before)
get total(): number {
  return this.items.filter((i) => i.selected).reduce((s, i) => s + i.price * i.qty, 0);
}
```

After (recomputed only when `items` changes):

```ts
// src/app/cart/cart.component.ts (after)
import { Component, computed, input } from '@angular/core';

interface CartItem { id: string; price: number; qty: number; selected: boolean }

@Component({ selector: 'app-cart', template: `<strong>{{ total() }}</strong>` })
export class CartComponent {
  readonly items = input.required<CartItem[]>();
  protected readonly total = computed(() =>
    this.items().filter((i) => i.selected).reduce((s, i) => s + i.price * i.qty, 0),
  );
}
```

On Angular 17.0 (before signal inputs), use a pure pipe: `{{ items | cartTotal }}`.

## Refactor: markForCheck after subscribe to toSignal

Before:

```ts
// src/app/user/user-badge.component.ts (before)
constructor(private api: UserApi, private cdr: ChangeDetectorRef) {}
ngOnInit() {
  this.api.me().subscribe((u) => { this.user = u; this.cdr.markForCheck(); });
}
```

After (no leak, no manual CD, works under OnPush and zoneless):

```ts
// src/app/user/user-badge.component.ts (after)
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserApi } from './user-api';

@Component({
  selector: 'app-user-badge',
  template: `@if (user(); as u) { <span>{{ u.name }}</span> }`,
})
export class UserBadgeComponent {
  protected readonly user = toSignal(inject(UserApi).me());
}
```

## Refactor: third-party timer outside the zone (zone-based apps)

```ts
// src/app/live/clock.component.ts
import { Component, DestroyRef, NgZone, inject, signal } from '@angular/core';

@Component({ selector: 'app-clock', template: `{{ now() }}` })
export class ClockComponent {
  protected readonly now = signal(new Date().toLocaleTimeString());

  constructor() {
    const zone = inject(NgZone);
    // Interval fires outside Angular's zone; only the signal write schedules a view update.
    const id = zone.runOutsideAngular(() =>
      setInterval(() => this.now.set(new Date().toLocaleTimeString()), 1000),
    );
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
```

In zoneless apps `runOutsideAngular` is unnecessary; signal writes alone schedule rendering.

## Zoneless readiness checks (before removing zone.js)

- No component relies on mutation of plain fields from `setTimeout`, promises, or third-party callbacks to update the view.
- Libraries in use document zoneless support (check each UI kit's release notes).
- Tests: TestBed uses zoneless by default on recent versions; tests that relied on `fakeAsync` auto-flushing may need `await fixture.whenStable()`.
- Remove `zone.js` from `polyfills` in both `build` and `test` targets only after the above pass.
