---
name: web-performance
description: Measure and improve frontend loading and runtime performance against Core Web Vitals (LCP, INP, CLS) using Lighthouse, the web-vitals library, DevTools Performance panel, bundle analysis, code splitting, lazy loading, image and font optimization, caching, and list virtualization. Use when a page is slow, a bundle grew, Core Web Vitals regressed, adding heavy dependencies or images, or reviewing performance in React or Angular apps.
license: MIT
metadata:
  category: shared
  version: "1.0.0"
  frameworks: "react 18-19, angular 17-22, web-vitals 5"
  last-reviewed: "2026-11-25"
---

# Web Performance

## Purpose

Keep pages fast for real users by measuring first, fixing the largest bottleneck, and guarding against regressions. "Good" means the 75th percentile of real page loads (mobile and desktop separately) meets all three Core Web Vitals thresholds, and every optimization in the diff is justified by a measurement.

## When to Use

- A page, route, or interaction feels slow, or field data shows poor LCP, INP, or CLS.
- The production bundle grew, a heavy dependency is being added, or a route loads code it never uses.
- Adding hero images, web fonts, third-party scripts, or rendering lists with hundreds+ rows.
- Reviewing a PR that claims a performance improvement.

Do not use when: the issue is framework-specific render tuning — use `react-performance` or `angular-performance` for memoization, change detection, signals, and `@defer` details.

## Workflow

1. **Detect** — read `package.json` (framework, bundler: Vite, webpack, Angular CLI `@angular/build`/esbuild, Next.js), existing budgets (`angular.json` `budgets`, `size-limit`, Lighthouse CI config), RUM/analytics setup, and image/CDN tooling. Reuse what exists.
2. **Measure** — pick the right source:
   - Field (real users): CrUX / PageSpeed Insights, Search Console, or the project's RUM via `web-vitals`. This is the truth for prioritization.
   - Lab (reproducible): Lighthouse (no INP — use Total Blocking Time as a proxy), DevTools Performance panel with CPU/network throttling, a production build only (`vite build && vite preview`, `ng build` + static server). Dev builds are not representative.
3. **Diagnose** — find the dominant cost: LCP element and its sub-parts (TTFB, resource load delay, load duration, render delay); long tasks blocking the interaction for INP; elements shifting for CLS; bundle composition for JS weight.
4. **Fix the biggest item** — one change at a time, smallest diff that addresses the measured cause.
5. **Verify** — re-run the same measurement (same device profile, 3–5 runs, compare medians). Add a budget or test so it cannot regress silently.

## Best Practices

### Thresholds (p75 of page loads)

| Metric | Good | Poor | Measures |
| --- | --- | --- | --- |
| LCP | ≤ 2.5 s | > 4.0 s | When the largest content element rendered |
| INP | ≤ 200 ms | > 500 ms | Latency from user input to next paint (replaced FID in March 2024) |
| CLS | ≤ 0.1 | > 0.25 | Unexpected layout movement |

### Loading (LCP, JS weight)

- Make the LCP resource discoverable in the initial HTML: a real `<img src>` (not a CSS background or JS-injected image), `fetchpriority="high"`, never `loading="lazy"` on it. Preload only if it is discovered late.
- Split code by route: every route beyond the landing page is a lazy chunk. Then split heavy, rarely-used widgets (charts, editors, maps, PDF viewers) behind interaction or viewport.
- Analyze bundles before and after adding a dependency. Prefer ESM packages that tree-shake; import specific modules (`lodash-es/debounce`, not `lodash`); question any dependency > ~30 kB gzip that replaces a few lines or a platform API (`Intl`, `structuredClone`, `fetch`, CSS).
- Defer non-critical third-party scripts (`async`/`defer`, load after interaction or idle). Audit tag managers; they are often the largest main-thread cost.
- Serve compressed (Brotli/gzip) assets over HTTP/2+ with a CDN; this is infrastructure, but verify it in the Network panel.

### Images

- Always set `width` and `height` (or CSS `aspect-ratio`) to reserve space.
- Serve modern formats (AVIF/WebP) with `srcset` + `sizes` so phones do not download desktop images.
- `loading="lazy"` for below-the-fold images only. `decoding="async"` for non-critical images.
- Angular: use `NgOptimizedImage` (`ngSrc`, `priority` on the LCP image, `fill` for unknown sizes). React: use the meta-framework component if present (`next/image`); otherwise plain `<img>` with the attributes above.

### Fonts

- Self-host or preconnect to the font origin; subset to needed glyphs; ship WOFF2 only.
- `font-display: swap` (or `optional` for non-brand text) to avoid invisible text; use `size-adjust`/metric overrides on the fallback to cut CLS from font swap.
- Preload at most the one or two fonts used above the fold.

### Runtime (INP)

- Keep event handlers short: update the visible state first, defer analytics, heavy computation, and non-urgent rendering.
- Break long tasks (> 50 ms). Yield with `await scheduler.yield()` where supported, falling back to `setTimeout(0)`; move CPU-heavy work (parsing, diffing, crypto) to a Web Worker.
- React 18+: wrap non-urgent updates in `startTransition` / `useDeferredValue`. Angular: prefer `OnPush` + signals and avoid heavy work in template expressions; see the framework skills.
- Debounce input-driven searches; cancel stale requests.

### Layout stability (CLS)

- Reserve space for images, ads, embeds, and async content (skeletons with the final dimensions).
- Never insert content above existing content unless in response to user input.
- Animate `transform`/`opacity`, not `top`/`left`/`height`.

### Long lists

- Virtualize lists/tables beyond a few hundred rows or with expensive rows: `@tanstack/react-virtual` (React) or `ScrollingModule` / `cdk-virtual-scroll-viewport` from `@angular/cdk/scrolling` (Angular). Use the data-grid library's built-in virtualization if the project has one.
- Alternatives that need no library: pagination, or `content-visibility: auto` with `contain-intrinsic-size` for long static content.
- Virtualization breaks browser find-in-page and changes screen-reader behavior; keep pagination where those matter.

### Caching awareness

- Fingerprinted assets (`main.abc123.js`): `Cache-Control: public, max-age=31536000, immutable`.
- HTML / `index.html` and service-worker scripts: `no-cache` (revalidate) so deploys are picked up.
- API responses: rely on server headers or the data-fetching library's cache; do not invent ad-hoc localStorage caches for server data.

## Anti-patterns

- Optimizing without a baseline — the change may be neutral or harmful — measure, change, re-measure.
- Measuring a dev build or on a fast desktop only — misleading numbers — use a production build with mobile throttling, then confirm with field data.
- `loading="lazy"` on the hero image — delays LCP — eager load and `fetchpriority="high"`.
- Blanket `useMemo`/`memo`/`trackBy` everywhere "for performance" — adds complexity with no measured gain — apply to profiled hot paths.
- Lazy-loading everything, including above-the-fold components — creates request waterfalls — split by route and rarely-used heavy UI.
- Importing whole libraries for one function, or moment.js-style locale bundles — use targeted imports or platform APIs.
- Spinners that collapse to zero height, then content pops in — CLS — reserve final dimensions.
- Chasing a Lighthouse score of 100 — lab score is a proxy — prioritize field p75 metrics.

## Implementation Examples

### Field measurement with web-vitals 5

```ts
// src/vitals.ts — call once from main.ts / main.tsx after bootstrap
import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

function send(metric: Metric): void {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    path: location.pathname,
  });
  // sendBeacon survives page unload; fall back to keepalive fetch.
  if (!navigator.sendBeacon?.('/analytics/vitals', body)) {
    void fetch('/analytics/vitals', { method: 'POST', body, keepalive: true });
  }
}

onCLS(send);
onINP(send);
onLCP(send);
```

For debugging which element or script caused a poor score, import from `web-vitals/attribution`; each metric gains an `attribution` object (for example the LCP element and its timing breakdown). `onFID` no longer exists in v4+; remove it when upgrading.

### Route-level code splitting

```tsx
// src/router.tsx (React 18/19 + React Router 6.4+/7)
import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router'; // 'react-router-dom' on v6

const Reports = lazy(() => import('./features/reports/ReportsPage'));

export const router = createBrowserRouter([
  {
    path: '/reports',
    element: (
      <Suspense fallback={<p role="status">Loading reports…</p>}>
        <Reports />
      </Suspense>
    ),
  },
]);
```

`React.lazy` requires a default export. React Router 6.4+ also supports a `lazy` route property that loads the route module (including loaders) on navigation; prefer it when the project uses data routers.

```ts
// src/app/app.routes.ts (Angular 17+, standalone)
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'reports',
    loadComponent: () => import('./reports/reports.page').then((m) => m.ReportsPage),
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
];
```

Within a component template, Angular 17+ `@defer (on viewport) { <app-chart /> } @placeholder { <div class="chart-skeleton"></div> }` splits a heavy child into its own chunk; give the placeholder the final size to avoid CLS.

### Bundle analysis

```bash
# Vite (React): one-off treemap of the production bundle
npx vite-bundle-visualizer

# Angular CLI (esbuild builder, 17+): emit esbuild metadata, then inspect it
ng build --stats-json
npx esbuild-visualizer --metadata dist/<project>/stats.json --filename bundle.html

# Any bundler with sourcemaps
npx source-map-explorer 'dist/**/*.js'
```

If the project already wires `rollup-plugin-visualizer` into `vite.config.ts` or uses `webpack-bundle-analyzer`, use that. Compare gzip/brotli sizes, not raw; look for duplicate packages, whole-library imports, and polyfills the browser targets do not need.

### Budgets that fail the build

```json
// angular.json → projects.<app>.architect.build.configurations.production
"budgets": [
  { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
  { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
]
```

React/Vite projects: use `size-limit` or Lighthouse CI assertions in the pipeline. Set budgets from the current measured size plus a small margin, then ratchet down.

### LCP image

```html
<!-- Plain HTML. In React 19 JSX write fetchPriority="high"; React 18.x (including 18.3.1) warns on the camelCase prop, use lowercase fetchpriority there; React 19 warns on lowercase. No spelling works on both. -->
<img src="/hero-1200.avif"
     srcset="/hero-600.avif 600w, /hero-1200.avif 1200w"
     sizes="(max-width: 600px) 100vw, 1200px"
     width="1200" height="600" alt="Team reviewing a dashboard"
     fetchpriority="high">
```

```html
<!-- Angular template; NgOptimizedImage imported in the component -->
<img ngSrc="hero.jpg" width="1200" height="600" priority alt="Team reviewing a dashboard">
```

### Breaking up a long task

```ts
// src/utils/yield.ts
export function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s?.yield) return s.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// usage: process rows in chunks so input stays responsive
export async function processAll<T>(rows: readonly T[], work: (row: T) => void): Promise<void> {
  for (let i = 0; i < rows.length; i++) {
    work(rows[i]);
    if (i % 200 === 199) await yieldToMain();
  }
}
```

### Virtualized list (React)

```tsx
// src/features/audit/AuditLog.tsx (@tanstack/react-virtual 3)
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export function AuditLog({ rows }: { rows: readonly string[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 8,
  });

  return (
    <div ref={parentRef} style={{ height: 480, overflow: 'auto' }}>
      <ul style={{ height: virtualizer.getTotalSize(), position: 'relative', margin: 0, padding: 0 }}>
        {virtualizer.getVirtualItems().map((item) => (
          <li key={item.key} style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${item.start}px)`, height: item.size }}>
            {rows[item.index]}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Virtualized list (Angular)

```ts
// src/app/audit/audit-log.component.ts (Angular 17+, @angular/cdk)
import { Component, input } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  selector: 'app-audit-log',
  imports: [ScrollingModule], // add standalone: true on Angular 17/18
  template: `
    <cdk-virtual-scroll-viewport itemSize="36" style="height: 480px">
      <div *cdkVirtualFor="let row of rows(); trackBy: trackByIndex" style="height: 36px">{{ row }}</div>
    </cdk-virtual-scroll-viewport>
  `,
})
export class AuditLogComponent {
  readonly rows = input.required<readonly string[]>();
  trackByIndex = (i: number) => i;
}
```

## Validation Checklist

- [ ] A baseline measurement (field or lab, production build, throttled) exists for the metric being changed, and the after-measurement shows improvement.
- [ ] LCP element is in initial HTML, not lazy-loaded, has `fetchpriority="high"` or `priority`, and has dimensions.
- [ ] All images have width/height or aspect-ratio; below-the-fold images are lazy.
- [ ] Non-landing routes and heavy rarely-used widgets are in separate chunks; no new dependency added without bundle-size check.
- [ ] No event handler runs a long task (> 50 ms) in the profiled interaction.
- [ ] No layout shift from late content, fonts, or skeletons with wrong dimensions.
- [ ] Lists with hundreds+ rows are paginated or virtualized.
- [ ] Bundle budget or performance assertion exists in CI.
- [ ] Field monitoring (`web-vitals` or vendor RUM) reports LCP, INP, CLS with route context.

## References

- [web.dev: Web Vitals](https://web.dev/articles/vitals)
- [web.dev: Optimize LCP](https://web.dev/articles/optimize-lcp)
- [web.dev: Optimize INP](https://web.dev/articles/optimize-inp)
- [web.dev: Optimize CLS](https://web.dev/articles/optimize-cls)
- [web-vitals library](https://github.com/GoogleChrome/web-vitals)
- [Angular: Image optimization](https://angular.dev/guide/image-optimization)
- [Angular: Deferrable views](https://angular.dev/guide/templates/defer)
- [React: lazy](https://react.dev/reference/react/lazy)
- [MDN: HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
