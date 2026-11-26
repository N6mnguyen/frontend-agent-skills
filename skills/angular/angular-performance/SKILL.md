---
name: angular-performance
description: Measure and improve Angular runtime and load performance with OnPush, signals, zoneless change detection, @for track, @defer, lazy routes and preloading, cheap templates, NgOptimizedImage, bundle budgets and analysis, SSR with incremental hydration, and the Angular DevTools profiler. Use when an Angular app is slow, bundles are large, budgets fail, Core Web Vitals regress, or when reviewing Angular code for performance.
license: MIT
metadata:
  category: angular
  version: "1.0.0"
  frameworks: "angular 17+"
  last-reviewed: "2026-11-25"
---

# Angular Performance

## Purpose

Fix the bottleneck that measurement shows, using the cheapest Angular-native mechanism the installed version provides. Good outcome: a before/after number (profiler cycle time, bundle kB, LCP/INP), no new manual change-detection calls, and no architecture migration smuggled into a perf fix.

## When to Use

- Slow interactions, janky lists, long change-detection cycles.
- Initial bundle over budget, slow first load, poor LCP/INP/CLS.
- Reviewing templates, routes, images, or SSR configuration for performance.
- Planning `@defer`, lazy routes, preloading, hydration.

Do not use when: the problem is backend latency (fix the API or caching; see the `angular-http` skill) or generic web vitals outside Angular (see the `web-performance` skill).

## Workflow

1. **Detect.**
   - `package.json`: `@angular/core` major, `@angular/ssr`, builder (`@angular/build:application` = esbuild; `@angular-devkit/build-angular:browser` = legacy webpack).
   - `app.config.ts` / `main.ts`: `provideZoneChangeDetection` (zone-based), `provideZonelessChangeDetection` (v20 opt-in), or neither on v21+ (zoneless default). `polyfills` containing `zone.js`?
   - Components: `changeDetection` settings. On v22+, `OnPush` is the default and `ChangeDetectionStrategy.Default` is deprecated in favour of `Eager`; on v17-21, the default is eager checking.
   - Templates: `@for`/`@if` (v17+) vs `*ngFor`/`*ngIf`; signals vs RxJS vs plain fields.
   - `angular.json`: `budgets`, `optimization`, `sourceMap`, `outputMode`/SSR.
2. **Measure before changing.**
   - Angular DevTools → Profiler: record the slow interaction; find components with long or frequent checks.
   - Chrome Performance panel for long tasks; Lighthouse/field data for LCP/INP.
   - `ng build --stats-json`, then load `dist/<app>/browser-stats.json` (esbuild builder) into the esbuild bundle analyzer; or `ng build --source-map` + `npx source-map-explorer dist/<app>/browser/*.js` (works with both builders).
3. **Pick the smallest fix** from Best Practices that addresses the measured hotspot. Version-gate it:
   - `@for`/`@if`/`@defer`: v17+.
   - Signal inputs `input()`: v17.1+; `linkedSignal()` stable since v20.0. Do not use `resource()` unless the project already uses it; exact status differs by release.
   - Zoneless: `provideZonelessChangeDetection()` is stable since v20.2; default v21+. On v20, opt in explicitly; on v17-19, do not recommend production use without checking preview status.
   - Incremental hydration: enabled by `withIncrementalHydration()` before v22; in v22 enabled by default with `provideClientHydration()`, and the explicit helper is deprecated.
   - Do not migrate a zone app to zoneless, or NgModules to standalone, as part of a perf fix unless that is the agreed task.
4. **Verify.** Re-measure the same scenario; run `ng build` with budgets; run tests.

## Best Practices

- **OnPush:** on v17-21 add `changeDetection: ChangeDetectionStrategy.OnPush` to new components. Then state changes must arrive via inputs (new references), template events, signals, or `async` pipe. On v22+ it's already the default; don't add it redundantly unless the codebase style requires.
- **Signals for view state:** use `signal`/`computed` for state read in templates; signal reads mark exactly the consuming view dirty and work identically under zone and zoneless.
- **No function calls that compute in templates:** `{{ total(items) }}` runs every check. Replace with `computed()` or a pure pipe. Calling a signal getter `{{ total() }}` is fine (memoized).
- **`@for` track:** `track` is required; use a stable unique ID (`track item.id`). `track $index` only for static lists. Legacy `*ngFor`: add `trackBy` returning the ID.
- **`@defer`:** wrap below-the-fold or interaction-only heavy standalone components; choose `on viewport`, `on interaction`, `on idle`, `on hover`, `on timer(…)`, or `when cond`; add `prefetch on idle` for likely interactions; provide `@placeholder` with fixed dimensions to avoid CLS. Deferred components must be standalone and not referenced elsewhere in the same file (else eagerly bundled). Import them directly, not through barrels.
- **Lazy routes:** `loadComponent` / `loadChildren` for every feature route. Preloading: `withPreloading(PreloadAllModules)` for small apps; a custom `PreloadingStrategy` (route `data.preload`) or `withPreloading` + network-aware logic for large ones. Don't preload admin-only areas.
- **Subscriptions:** prefer `async` pipe or `toSignal()`; for manual subscriptions use `takeUntilDestroyed()`. Avoid nested subscribes and per-row subscriptions.
- **Manual CD calls:** `detectChanges()`/`markForCheck()` usually hide a non-reactive state update. Convert the state to a signal instead. Keep manual calls only for third-party callbacks outside Angular, with a comment.
- **Zone-heavy third-party code** (charts, maps, `setInterval`): in zone apps, run in `NgZone.runOutsideAngular()`; in zoneless apps it no longer triggers CD at all.
- **Images:** `NgOptimizedImage` (`ngSrc`, `width`/`height` or `fill`, `priority` on the LCP image, configured loader for your CDN). It warns about missing dimensions and oversized images in dev mode.
- **Budgets:** set `initial` and `anyComponentStyle` budgets in `angular.json` production config with `maximumWarning` and `maximumError`; tighten after each win so regressions fail CI.
- **Heavy dependencies:** check analyzer for moment/lodash/full icon sets; prefer ESM, per-function imports, or native APIs. Keep CommonJS dependencies out (`allowedCommonJsDependencies` warnings).
- **SSR + hydration:** `provideClientHydration()` (v16+). Add `withEventReplay()` if not using incremental hydration; incremental hydration enables event replay automatically. Use `@defer (hydrate on viewport)` to defer hydration and `hydrate never` for static content.
- **Long lists:** CDK virtual scrolling (`cdk-virtual-scroll-viewport`) for hundreds of rich rows; paginate on the server for thousands.
- **Profile in production mode:** dev mode runs extra checks; use `ng serve --configuration production` or a production build for timing.

## Anti-patterns

- Adding `OnPush` then calling `cdr.detectChanges()` after every mutation — reintroduces cost and hides bugs; use signals or immutable inputs.
- Mutating arrays/objects passed to `OnPush` children (`items.push(x)`) — child never updates; create new references or use signals.
- `track $index` on sortable/filterable lists — DOM reuse bugs and full re-render; track by ID.
- Getters doing filtering/sorting in templates — runs on every check; use `computed`.
- `@defer` around above-the-fold content or the LCP element — delays render and hurts LCP.
- `PreloadAllModules` on a 50-route enterprise app — wastes bandwidth on first load; preload selectively.
- Importing a whole library for one helper — inspect the analyzer before adding dependencies.
- Removing `zone.js` without testing third-party libs and `setTimeout`-driven UI — silent stale views.
- Raising budgets to make CI green — investigate the analyzer first.

## Implementation Examples

### Signals, computed and tracked list (v17.1+)

```ts
// src/app/orders/order-list.component.ts
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

export interface Order { id: string; customer: string; total: number; status: 'open' | 'closed' }

@Component({
  selector: 'app-order-list',
  imports: [CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush, // redundant on v22+, required for intent on v17-21
  template: `
    <label>Filter <input [value]="query()" (input)="query.set($any($event.target).value)" /></label>
    <p>{{ visible().length }} orders, {{ sum() | currency }}</p>
    <ul>
      @for (o of visible(); track o.id) {
        <li>{{ o.customer }} — {{ o.total | currency }}</li>
      } @empty {
        <li>No orders.</li>
      }
    </ul>
  `,
})
export class OrderListComponent {
  readonly orders = input.required<Order[]>();
  protected readonly query = signal('');
  protected readonly visible = computed(() => {
    const q = this.query().toLowerCase();
    return q ? this.orders().filter((o) => o.customer.toLowerCase().includes(q)) : this.orders();
  });
  protected readonly sum = computed(() => this.visible().reduce((s, o) => s + o.total, 0));
}
```

### @defer with triggers, prefetch and hydration

```html
<!-- src/app/dashboard/dashboard.component.html -->
<app-kpi-header />  <!-- above the fold: never deferred -->

@defer (on viewport; prefetch on idle) {
  <app-revenue-chart [data]="revenue()" />
} @placeholder (minimum 300ms) {
  <div class="chart-skeleton" style="height: 320px" aria-hidden="true"></div>
} @loading (after 150ms) {
  <p>Loading chart…</p>
} @error {
  <p role="alert">Chart failed to load.</p>
}

<!-- SSR + incremental hydration (v19+; default-on with provideClientHydration in v22) -->
@defer (hydrate on interaction) {
  <app-comments [postId]="postId()" />
} @placeholder {
  <div style="min-height: 200px"></div>
}
```

### Lazy routes with selective preloading

```ts
// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent) },
  { path: 'orders', data: { preload: true }, loadChildren: () => import('./orders/orders.routes').then((m) => m.ORDER_ROUTES) },
  { path: 'admin', loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES) },
];
```

```ts
// src/app/core/selective-preloading.ts
import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, EMPTY } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SelectivePreloading implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return route.data?.['preload'] === true && !conn?.saveData ? load() : EMPTY;
  }
}
```

```ts
// src/app/app.config.ts (excerpt)
import { provideRouter, withPreloading } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { routes } from './app.routes';
import { SelectivePreloading } from './core/selective-preloading';

export const appConfig = {
  providers: [
    provideRouter(routes, withPreloading(SelectivePreloading)),
    provideClientHydration(), // SSR apps only; v19-21 add withIncrementalHydration() to use hydrate triggers
  ],
};
```

### NgOptimizedImage

```ts
// src/app/home/hero.component.ts
import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-hero',
  imports: [NgOptimizedImage],
  template: `<img ngSrc="/images/hero.webp" width="1200" height="600" priority alt="Team reviewing a dashboard" />`,
})
export class HeroComponent {}
```

### Budgets

```jsonc
// angular.json → projects.<app>.architect.build.configurations.production
"budgets": [
  { "type": "initial", "maximumWarning": "500kb", "maximumError": "800kb" },
  { "type": "anyComponentStyle", "maximumWarning": "4kb", "maximumError": "8kb" }
]
```

Set numbers from the current build plus a small margin, then ratchet down. Profiling steps and a zone-to-signals refactor example: [references/profiling-and-refactors.md](references/profiling-and-refactors.md).

## Validation Checklist

- [ ] Detected Angular major, zone vs zoneless, default CD strategy, builder, SSR before changes.
- [ ] Baseline measurement recorded (profiler, bundle size, or vitals) and re-measured after.
- [ ] Every `@for` tracks a stable ID; legacy `*ngFor` lists have `trackBy`.
- [ ] No computing functions/getters in hot templates; `computed` or pure pipes used.
- [ ] No new `detectChanges`/`markForCheck` without a written reason.
- [ ] Feature routes lazy; preloading selective.
- [ ] `@defer` only below the fold or on interaction, with sized placeholders.
- [ ] LCP image uses `NgOptimizedImage` with `priority` and dimensions.
- [ ] Budgets present and passing; analyzer checked for heavy dependencies.
- [ ] SSR apps: hydration enabled, no hydration mismatch warnings in console.
- [ ] Tests pass.

## References

- [Profiling workflow and refactor examples](references/profiling-and-refactors.md)
- https://angular.dev/best-practices/runtime-performance
- https://angular.dev/best-practices/skipping-subtrees
- https://angular.dev/guide/templates/defer
- https://angular.dev/guide/zoneless
- https://angular.dev/guide/incremental-hydration
- https://angular.dev/tools/cli/build
- https://angular.dev/tools/devtools
