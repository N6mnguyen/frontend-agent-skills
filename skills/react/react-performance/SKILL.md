---
name: react-performance
description: Measure-first React performance guidance - Profiler and Performance panel workflow, React Compiler 1.0 vs manual memo, React.memo/useMemo/useCallback only where measured, re-render reduction (state colocation, children as props, context splitting, store selectors), list virtualization, useTransition/useDeferredValue, route code splitting, bundle analysis and image loading. Use when a React screen is slow, typing lags, lists are large, bundles are big, Core Web Vitals regress, or someone proposes adding memoization.
license: MIT
metadata:
  category: react
  version: "1.0.0"
  frameworks: "react 18-19, react compiler 1"
  last-reviewed: "2026-11-25"
---

# React Performance

## Purpose

Fix the bottleneck that a measurement shows, with the smallest change. Good looks like: a recorded before/after number (commit duration, INP, LCP, bundle KB), no speculative `useMemo`/`useCallback` sprinkled everywhere, and structural fixes (move state, split context, virtualize) preferred over memo patches.

## When to Use

- A component or page feels slow, typing or dragging lags, a list has hundreds+ rows.
- INP/LCP/CLS regressed, or the JS bundle grew.
- Reviewing a PR that adds `React.memo`/`useMemo`/`useCallback`.
- Enabling or troubleshooting React Compiler.

Do not use when: the slowness is network/API latency or caching (see `tanstack-query` and `frontend-api-integration`), or general web performance outside React (images/CDN headers belong to the hosting setup).

## Workflow

1. **Detect.** Read `package.json`: React version, bundler (Vite/Next/webpack/Rsbuild), `babel-plugin-react-compiler`, `@vitejs/plugin-react` major, state library (Zustand, Redux, Jotai), list libs (`@tanstack/react-virtual`, `react-window`), `eslint-plugin-react-hooks`. Check whether the compiler is already on (`reactCompilerPreset`, `babel-plugin-react-compiler` in config, or Next `reactCompiler: true`).
2. **Measure in a production build.** Dev mode with StrictMode double-renders and is much slower.
   - React DevTools Profiler: record the interaction, find the commit with the longest duration, check "Why did this render?" (enable "Record why each component rendered").
   - Chrome Performance panel: record the interaction; on React 19.2+ the React Performance Tracks show Scheduler and Components lanes. Look for long tasks (> 50 ms).
   - Field data: Web Vitals (INP, LCP) from RUM if the project has it (`web-vitals` package).
   - Bundle: analyser output (below).
3. **Classify the cause** and pick the matching fix:
   - Too many components re-render → colocate state, children-as-props, split context, store selectors; then memo.
   - One render is expensive → memoize the computation, move it off the render path, or virtualize.
   - Urgent input blocked by heavy update → `useTransition` / `useDeferredValue`.
   - Slow initial load → code splitting, smaller deps, image loading.
4. **Fix one thing, re-measure**, keep the change only if the number improved. Record numbers in the PR.
5. **Verify.** Type-check, tests, lint (`react-hooks` rules), and the same profile again.

## Best Practices

### React Compiler

- React Compiler 1.0 is stable (Oct 2025). It auto-memoizes components and hooks at build time, which makes most manual `useMemo`/`useCallback`/`React.memo` unnecessary in new code.
- React 19 needs only `babel-plugin-react-compiler`. React 17/18 needs the `target` option and the `react-compiler-runtime` package.
- Vite: `@vitejs/plugin-react` 6+ uses `reactCompilerPreset()` with `@rolldown/plugin-babel`; plugin-react 5 and older take `react({ babel: { plugins: ['babel-plugin-react-compiler'] } })`. Next.js 16+: top-level `reactCompiler: true` in `next.config` (Next 15 used `experimental.reactCompiler`).
- Lint with `eslint-plugin-react-hooks` latest (`recommended` / `recommended-latest`); the old `eslint-plugin-react-compiler` is superseded. Fix reported Rules-of-React violations — the compiler skips components it cannot safely compile.
- Do not mass-delete existing `useMemo`/`useCallback` after enabling it; removal can change effect firing. Remove only with tests.
- Opt a single component out with `"use no memo"` while debugging a regression.
- Confirm it works: DevTools shows a "Memo ✨" badge on compiled components.

### Without the compiler (or for what it cannot fix)

- `React.memo` only helps if props are referentially stable. Passing a new object/array/arrow each render defeats it.
- `useMemo` for computations that measurably cost (> ~1 ms) or for values used as effect/memo dependencies. Not for cheap expressions.
- `useCallback` only when the callback is passed to a memoized child or used as an effect dependency.
- Never use memo for correctness; code must work if memo is removed.

### Avoid re-renders structurally

- **Colocate state** in the lowest component that needs it. A search input's text should not live in the page root.
- **Children as props**: a stateful wrapper (`<Scroller>{children}</Scroller>`) does not re-render `children` created by the parent.
- **Split context** by update frequency (`AuthContext` vs `ThemeContext` vs `NotificationsContext`), and memoize the provider `value`. Consider a store with selectors for high-frequency shared state.
- **Store selectors**: Zustand `useStore((s) => s.count)`; for object picks use `useShallow`. Redux: `useSelector` returning primitives or memoized selectors.
- **Stable keys**: `key={item.id}`, never index for reorderable lists; never `Math.random()`.
- Lift expensive static JSX/consts out of components (module scope).

### Large lists

- Virtualize when rendering > ~200 complex rows or measurable jank: `@tanstack/react-virtual` (headless, dynamic heights via `measureElement`) or `react-window` (simple fixed-size lists). antd `Table` has a `virtual` prop with `scroll.y`.
- Keep virtualized items accessible: maintain row semantics (`role="row"`, `aria-rowcount`/`aria-rowindex` for grids) and ensure find-in-page limitation is acceptable.

### Concurrency

- `useTransition` for state updates that trigger heavy renders (tab switch, filter large list). The input stays responsive; show `isPending`.
- `useDeferredValue(value)` when you receive a fast-changing value as a prop and render something heavy from it. Wrap the heavy child in `memo` (or rely on the compiler) so the deferred value actually skips work.
- Neither makes code faster; they keep the UI responsive. Still fix the slow render.

### Loading

- Split by route (`lazy` in the router, `React.lazy` + `Suspense`), and by heavy optional widgets (charts, editors, maps). Do not split tiny components.
- Analyse bundles: Vite/Rollup `rollup-plugin-visualizer`; Next `@next/bundle-analyzer`; webpack `webpack-bundle-analyzer`. Look for duplicate libraries, full `lodash`/`moment`, icon packs, locales.
- Images: `loading="lazy"` and `decoding="async"` for below-fold; the LCP image eager with `fetchPriority="high"`; explicit `width`/`height` to prevent CLS; modern formats (AVIF/WebP) and `srcSet`/`sizes`.

## Anti-patterns

- Wrapping every component in `React.memo` and every function in `useCallback` "just in case" — adds comparison cost and noise; with the compiler, pure overhead.
- Profiling the dev build — numbers are misleading.
- `memo(Child)` while passing `style={{...}}` or `onClick={() => ...}` — never skips.
- One giant context with `{ user, theme, cart, setCart }` — every consumer re-renders on any change.
- Selecting the whole store: `const state = useStore()` — re-renders on every update.
- `useEffect` to derive state from props (`setFiltered(items.filter(...))`) — extra render pass; compute during render.
- Virtualizing a 30-row list — complexity, broken find-in-page, no gain.
- `React.lazy` inside a component body — remounts and refetches the chunk each render. Declare at module scope.
- `useTransition` around controlled input `setValue` — input lags. Keep input update urgent, defer the heavy one.

## Implementation Examples

### Enable React Compiler (Vite, @vitejs/plugin-react 6+)

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    visualizer({ filename: 'stats.html', template: 'treemap', gzipSize: true, brotliSize: true }),
  ],
});
```

Older plugin-react: `react({ babel: { plugins: ['babel-plugin-react-compiler'] } })`. React 18 target: `['babel-plugin-react-compiler', { target: '18' }]` plus `npm i react-compiler-runtime`.

### Children as props + context split

```tsx
// src/layout/scroll-tracker.tsx
import { useState, type ReactNode } from 'react';
import { ProgressBar } from './progress-bar';

export function ScrollTracker({ children }: { children: ReactNode }) {
  const [y, setY] = useState(0);
  return (
    <div onScroll={(e) => setY(e.currentTarget.scrollTop)} style={{ overflow: 'auto', height: '100vh' }}>
      <ProgressBar value={y} />
      {children /* created by the parent; not re-rendered when y changes */}
    </div>
  );
}
```

```ts
// src/stores/cart-store.ts
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

interface CartState { items: { id: string; qty: number }[]; add: (id: string) => void }
export const useCartStore = create<CartState>()((set) => ({
  items: [],
  add: (id) => set((s) => ({ items: [...s.items, { id, qty: 1 }] })),
}));

export const useCartCount = () => useCartStore((s) => s.items.length);
export const useCartActions = () => useCartStore(useShallow((s) => ({ add: s.add })));
```

### Responsive filtering with useDeferredValue

```tsx
// src/features/products/product-search.tsx
import { memo, useDeferredValue, useState } from 'react';

interface Product { id: string; name: string }

export function ProductSearch({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;
  return (
    <>
      <label htmlFor="product-search">Search products</label>
      <input id="product-search" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.6 : 1 }} aria-busy={isStale}>
        <ProductList products={products} query={deferredQuery} />
      </div>
    </>
  );
}

const ProductList = memo(function ProductList({ products, query }: { products: Product[]; query: string }) {
  const q = query.toLowerCase();
  const visible = products.filter((p) => p.name.toLowerCase().includes(q));
  return <ul>{visible.map((p) => <li key={p.id}>{p.name}</li>)}</ul>;
});
```

### Virtualized list

See [references/virtualization-and-profiling.md](references/virtualization-and-profiling.md) for `@tanstack/react-virtual`, a profiling recipe, and a `<Profiler>` logging hook.

## Validation Checklist

- [ ] A before/after measurement exists (Profiler commit ms, INP, bundle KB) on a production build.
- [ ] Compiler status known; if on, `react-hooks` lint errors are fixed, not silenced.
- [ ] New `memo`/`useMemo`/`useCallback` each justified by a measurement or a dependency need.
- [ ] State lives at the lowest common owner; contexts split by update frequency; provider values stable.
- [ ] Store hooks select minimal slices.
- [ ] Lists > ~200 complex rows virtualized, with accessible semantics.
- [ ] Heavy updates behind `useTransition`/`useDeferredValue`; input updates stay urgent.
- [ ] Routes and heavy widgets lazy-loaded at module scope; bundle report checked for duplicates.
- [ ] Below-fold images lazy, LCP image eager with dimensions.

## References

- [references/virtualization-and-profiling.md](references/virtualization-and-profiling.md)
- https://react.dev/learn/react-compiler
- https://react.dev/reference/react/useTransition
- https://react.dev/reference/react/useDeferredValue
- https://tanstack.com/virtual/latest
