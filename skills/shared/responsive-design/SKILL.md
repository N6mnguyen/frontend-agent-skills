---
name: responsive-design
description: Build layouts that work from small phones to wide desktops using CSS first - mobile-first media queries, breakpoint tokens, container queries, fluid typography with clamp(), grid and flex patterns, responsive tables, responsive images with srcset/sizes, and viewport testing - in React and Angular projects. Use when building or fixing a layout, adding breakpoints, making a component adapt to its container, handling tables or images on mobile, replacing JS window-size logic with CSS, or when the user mentions mobile, tablet, responsive, breakpoints, or layout overflow.
license: MIT
metadata:
  category: shared
  version: "1.0.0"
  frameworks: "css, react 18-19, angular 17+"
  last-reviewed: "2026-11-25"
---

# Responsive Design

## Purpose

Make UI adapt to available space with CSS, not JavaScript. Good looks like: base styles target the narrowest screen and add complexity upward; breakpoints come from one token source; reusable components respond to their container, not the viewport; text and spacing scale fluidly without breaking zoom; tables, images, and forms work at 320 CSS px wide with no horizontal page scroll; and JS reads viewport size only when behaviour, not appearance, must change.

## When to Use

- Building a new page or component layout, or fixing overflow/wrapping on small screens.
- Adding or consolidating breakpoints.
- A component is used in both a narrow sidebar and a wide main area.
- Data tables, images, or media need to work on mobile.
- Code uses `window.innerWidth`, `resize` listeners, `matchMedia`, Angular CDK `BreakpointObserver`, or a `useMediaQuery` hook for styling.

Do not use when: the issue is component-library-specific grid props (see `ant-design-react`, `ng-zorro`, `devextreme-angular`), or accessibility beyond reflow/zoom (see `web-accessibility`).

## Workflow

1. **Detect**
   - Styling approach: plain CSS/CSS Modules, Sass, Tailwind (`tailwind.config.*` or `@theme` in CSS for v4), CSS-in-JS, Angular component styles, UI library grid.
   - Existing breakpoints: search for `@media`, `$breakpoint`, `screens:`, `--breakpoint`, `BreakpointObserver`, `useMediaQuery`. Reuse them; do not add a second scale.
   - Browser support targets: `browserslist` in `package.json` or `.browserslistrc`. Container queries, `clamp()`, `:has()`, and media query range syntax need modern evergreen browsers.
   - `index.html` has `<meta name="viewport" content="width=device-width, initial-scale=1">`. Never add `maximum-scale=1` or `user-scalable=no`.
2. **Decide** per element:
   - Depends on the page width (app shell, nav, page grid) → media query.
   - Reusable component placed in containers of different widths (cards, list items, widgets) → container query.
   - Continuous scaling (type, spacing, gaps) → `clamp()`.
   - Content-driven wrapping (card grids, toolbars) → intrinsic grid/flex with no breakpoint at all.
   - Behaviour changes (render a drawer vs sidebar component, load different data) → JS `matchMedia`, last resort.
3. **Implement** mobile-first: unprefixed styles for narrow, `min-width` queries upward. Use the project's tokens.
4. **Verify** — devtools device mode at 320, 375, 768, 1024, 1280, 1920 px; 200% and 400% browser zoom at 1280 px (WCAG 1.4.10 reflow equals 320 CSS px); landscape phone; real touch device if available. Check no horizontal page scroll (`document.documentElement.scrollWidth <= innerWidth`).

## Best Practices

### Mobile-first and breakpoints

- Base styles are the single-column mobile layout. Add `@media (min-width: …)` (or range syntax `(width >= …)`) for wider layouts. Avoid mixing `max-width` and `min-width` queries for the same property.
- Choose breakpoints where the content breaks, not at device widths. A typical scale (only if the project has none): 480, 768, 1024, 1280, 1536 px. Use `em`/`rem` in media queries if the project does so; they respond to user font-size settings.
- CSS custom properties cannot be used inside `@media` conditions (`@media (min-width: var(--bp-md))` does not work). Keep breakpoint tokens in Sass variables/mixins, Tailwind theme, PostCSS `@custom-media` (via plugin), or a TS constant shared with JS. Expose them as custom properties only for documentation or JS reads.
- Media query range syntax (`width >= 768px`) is Baseline 2023; use `min-width` if `browserslist` targets older browsers.

### Container queries

- Mark the wrapper, not the component itself: `container-type: inline-size` (optionally `container-name`). A container cannot query its own size.
- `inline-size` containment means the container's width must come from its parent/layout, not from its content. Do not put it on shrink-to-fit elements (inline-block, absolutely positioned without width, flex items with `width: auto` that depend on content) or they collapse.
- Use container query units (`cqi`, `cqw`) for sizes relative to the container.
- Container size queries are Baseline 2023 (Chrome 105, Safari 16, Firefox 110). For older targets, provide a usable default layout without the query.
- Use container queries for components; media queries for page-level layout. This lets the same card render correctly in a sidebar and a main column.

### Fluid typography and spacing

- `font-size: clamp(min, preferred, max)` with a `rem` component in `preferred` (e.g. `clamp(1.5rem, 1.1rem + 1.5vw, 2.5rem)`). Pure `vw` font sizes do not respond to browser zoom and fail WCAG 1.4.4 resize text.
- Keep body text near 1rem; scale headings and section spacing fluidly. Line length 45–75 characters: `max-inline-size: 70ch` on prose.
- Use `rem` for type and spacing, `%`/`fr`/`min()`/`max()` for widths. Avoid fixed pixel widths on containers.

### Layout patterns

- Auto-fitting card grid without breakpoints: `grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr))`. The `min(100%, …)` prevents overflow on very narrow screens.
- Wrapping toolbar: `display: flex; flex-wrap: wrap; gap: …`.
- Sidebar layout: single column by default; at a breakpoint, `grid-template-columns: minmax(14rem, 20rem) 1fr`.
- Use `gap` instead of margins between flex/grid children.
- Give flex/grid children that contain long text or tables `min-width: 0` so they can shrink instead of overflowing.
- Long words/URLs: `overflow-wrap: anywhere` on user content.
- Full-height mobile sections: `min-height: 100dvh` (dynamic viewport unit, Baseline 2022) instead of `100vh`, which ignores mobile browser toolbars.
- Respect safe areas on notched devices with `env(safe-area-inset-*)` when using `viewport-fit=cover`.

### Responsive tables

Pick by data shape:
1. **Horizontal scroll wrapper** (default for data grids): wrap the `<table>` in a container with `overflow-x: auto`, make it focusable (`tabindex="0"`), labelled (`role="region"` + `aria-label`), so keyboard users can scroll. Keep the first column sticky if identifiers matter.
2. **Priority columns**: hide low-priority columns below a breakpoint and expose them in a row-detail view. Never hide data with no alternative way to reach it.
3. **Stacked cards**: for few columns and read-mostly data, render each row as a card with label/value pairs below a breakpoint. Changing `display` (block/flex/grid) on table elements has historically stripped table semantics in some browser/screen-reader pairs; if you restyle the table, add explicit `role="table"`, `role="row"`, `role="cell"`/`columnheader` attributes, or render separate list markup for the narrow view. Test with a screen reader. [VERIFY] which current browsers still drop semantics.

Library data grids (AG Grid, DevExtreme, Ant Design Table, ng-zorro) have their own responsive features; use those over custom CSS.

### Images and media

- Always set `width` and `height` attributes (or CSS `aspect-ratio`) to reserve space and avoid layout shift; then `max-width: 100%; height: auto`.
- Resolution switching: `srcset` with `w` descriptors + `sizes` describing the rendered width per layout (`sizes="(min-width: 1024px) 33vw, 100vw"`). Wrong `sizes` downloads oversized images.
- Art direction (different crop on mobile): `<picture>` with `<source media="…">`.
- Below-the-fold images: `loading="lazy"`; the LCP hero image: no lazy loading, `fetchpriority="high"`.
- `object-fit: cover` for fixed-ratio thumbnails.
- Angular: `NgOptimizedImage` (`ngSrc`, `width`, `height`, `priority`, `ngSrcset`/`sizes`) generates srcset with a loader — use it if the project does. React frameworks: Next.js `next/image` if on Next; plain React uses native attributes.

### CSS over JS

- Visual changes belong in CSS. JS width checks cause hydration mismatches (SSR has no window), flash of wrong layout, and extra renders.
- When behaviour must change, use `window.matchMedia` with a `change` listener — not `resize` + `innerWidth`. React: `useSyncExternalStore` over `matchMedia` (provide `getServerSnapshot` for SSR). Angular: CDK `BreakpointObserver` if `@angular/cdk` is installed, else `matchMedia` wrapped in a signal with `DestroyRef` cleanup.
- Read breakpoint values from the same token source CSS uses.
- Also prefer media features over UA sniffing: `(hover: hover)`, `(pointer: coarse)`, `prefers-reduced-motion`.

### Touch and input

- Target size at least 24×24 CSS px (WCAG 2.2 AA 2.5.8); aim for 44×44 for primary touch actions.
- Do not rely on hover to reveal actions on touch devices; gate hover effects with `@media (hover: hover)`.
- Form inputs: font-size at least 16px avoids iOS auto-zoom on focus; set appropriate `inputmode`/`type`/`autocomplete`.

## Anti-patterns

- `if (window.innerWidth < 768) return <MobileNav />` for styling — SSR mismatch, flicker, re-render on every resize — CSS media query or `matchMedia` for true behaviour changes.
- Desktop-first `max-width` overrides layered on each other — specificity tangles — mobile-first `min-width`.
- New breakpoint values in every component — inconsistent layout shifts — use shared tokens.
- `@media (min-width: var(--bp-md))` — silently never matches — Sass variable, Tailwind screen, or custom media plugin.
- `font-size: 4vw` — ignores zoom, tiny on phones, huge on monitors — `clamp()` with a `rem` term.
- Viewport media queries inside a reusable card — breaks when placed in a sidebar — container query.
- `container-type: inline-size` on a shrink-to-fit element — collapses to zero width — put it on a block-level wrapper with defined width.
- `<meta name="viewport" content="…, maximum-scale=1, user-scalable=no">` — blocks zoom, accessibility failure — remove.
- `overflow-x: hidden` on `body` to hide overflow — hides the bug and breaks `position: sticky` — find the overflowing element (`min-width: 0`, `overflow-wrap`).
- `height: 100vh` for mobile full-screen panels — content hidden behind browser UI — `100dvh`.
- `display: none` on table columns with no other way to see the data — information loss — row detail or scroll.

## Implementation Examples

### Breakpoint tokens (Sass) shared with TS

```scss
// src/styles/_breakpoints.scss
$breakpoints: (sm: 480px, md: 768px, lg: 1024px, xl: 1280px);

@mixin up($name) {
  @media (min-width: map-get($breakpoints, $name)) { @content; }
}
```

```ts
// src/shared/lib/breakpoints.ts — keep in sync with _breakpoints.scss
export const BREAKPOINTS = { sm: 480, md: 768, lg: 1024, xl: 1280 } as const;
export const up = (bp: keyof typeof BREAKPOINTS) => `(min-width: ${BREAKPOINTS[bp]}px)`;
```

With `@use 'sass:map'` (Dart Sass module system) write `map.get(...)` instead of the global `map-get`, which is deprecated in Dart Sass.

### Mobile-first page shell + container-query card

```css
/* src/styles/layout.css */
.page {
  display: grid;
  gap: 1rem;
  padding-inline: clamp(1rem, 0.5rem + 2vw, 2.5rem);
}
@media (min-width: 1024px) {
  .page { grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr); }
}

.card-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
}

.card-slot { container-type: inline-size; container-name: card; }

.card { display: grid; gap: 0.75rem; }
.card__media { aspect-ratio: 16 / 9; object-fit: cover; inline-size: 100%; }

@container card (min-width: 28rem) {
  .card { grid-template-columns: 10rem 1fr; align-items: start; }
  .card__media { aspect-ratio: 1; }
}

h1 { font-size: clamp(1.75rem, 1.2rem + 2.2vw, 3rem); line-height: 1.15; }
.prose { max-inline-size: 70ch; }
```

### Accessible scrollable table

```html
<!-- React: use className and tabIndex={0}. Angular: as written. -->
<div class="table-scroll" role="region" aria-labelledby="orders-caption" tabindex="0">
  <table>
    <caption id="orders-caption">Recent orders</caption>
    <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Total</th></tr></thead>
    <tbody><!-- rows --></tbody>
  </table>
</div>
```

```css
.table-scroll { overflow-x: auto; max-inline-size: 100%; }
.table-scroll:focus-visible { outline: 2px solid var(--focus-ring, Highlight); outline-offset: 2px; }
.table-scroll th:first-child, .table-scroll td:first-child { position: sticky; inset-inline-start: 0; background: var(--surface, Canvas); }
```

### Responsive image

```html
<img
  src="/img/team-800.jpg"
  srcset="/img/team-400.jpg 400w, /img/team-800.jpg 800w, /img/team-1600.jpg 1600w"
  sizes="(min-width: 1024px) 50vw, 100vw"
  width="1600" height="900"
  alt="Support team at the Berlin office"
  loading="lazy" decoding="async" />
```

```ts
// Angular — NgOptimizedImage (standalone import)
import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-hero',
  imports: [NgOptimizedImage],
  template: `<img ngSrc="hero.jpg" width="1600" height="900" priority sizes="100vw" alt="Product dashboard overview" />`,
})
export class HeroComponent {}
```

### Behaviour-only media query in JS

```ts
// React: src/shared/hooks/useMediaQuery.ts
import { useCallback, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string, serverDefault = false): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => serverDefault);
}
// const isDesktop = useMediaQuery(up('lg')); → render <Sidebar/> vs <Drawer/>
```

```ts
// Angular: src/app/shared/media-query.ts — call in an injection context
import { DestroyRef, inject, signal, type Signal } from '@angular/core';

export function mediaQuery(query: string): Signal<boolean> {
  const mql = window.matchMedia(query); // guard with isPlatformBrowser for SSR
  const matches = signal(mql.matches);
  const onChange = (e: MediaQueryListEvent) => matches.set(e.matches);
  mql.addEventListener('change', onChange);
  inject(DestroyRef).onDestroy(() => mql.removeEventListener('change', onChange));
  return matches.asReadonly();
}
```

If `@angular/cdk` is installed, use `BreakpointObserver.observe(query)` with `toSignal` instead.

## Validation Checklist

- [ ] Reused the project's breakpoint tokens; no new ad-hoc values.
- [ ] Base styles are mobile; wider layouts added with `min-width` queries.
- [ ] Reusable components adapt via container queries; containers have a defined width.
- [ ] Font sizes use `rem`/`clamp()` with a `rem` term; text resizes at 200% zoom.
- [ ] No horizontal page scroll at 320 CSS px or 400% zoom on 1280 px.
- [ ] Tables scroll in a focusable, labelled region or provide an alternate view; no data hidden without access.
- [ ] Images have `width`/`height` or `aspect-ratio`, correct `srcset`/`sizes`, LCP image not lazy.
- [ ] No `innerWidth`/`resize` logic for styling; JS `matchMedia` only for behaviour, SSR-safe.
- [ ] Viewport meta allows zoom; touch targets at least 24×24 px; hover-only affordances gated.
- [ ] Checked at 320, 375, 768, 1024, 1280, 1920 px and landscape phone.

## References

- MDN container queries: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries
- MDN `clamp()`: https://developer.mozilla.org/en-US/docs/Web/CSS/clamp
- MDN responsive images: https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images
- WCAG 2.2 Reflow (1.4.10): https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- Angular NgOptimizedImage: https://angular.dev/guide/image-optimization
- React `useSyncExternalStore`: https://react.dev/reference/react/useSyncExternalStore
