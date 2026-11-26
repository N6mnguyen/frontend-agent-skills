---
name: react-architecture
description: Structures React applications into feature folders with explicit dependency direction, shared layers, route-based code splitting and correct server/client boundaries. Use when creating or reorganizing a React app, adding a new feature or route, deciding where a component, hook or API call belongs, setting up lazy loading with React.lazy or router lazy routes, or working in a Next.js App Router project with Server Components and 'use client'.
license: MIT
metadata:
  category: react
  version: "1.0.0"
  frameworks: "react 18-19, react-router 7-8, next 14+"
  last-reviewed: "2026-11-25"
---

# React Architecture

## Purpose

Give a React codebase a predictable shape: every file has one obvious home, imports flow in one direction, features can be added or deleted without touching unrelated code, and the initial bundle only contains what the first screen needs. Good architecture here is boring: an agent (or a new teammate) can guess the path of any file before searching for it.

## When to Use

- Adding a new feature, page or route and deciding which folders to create.
- Moving code that has outgrown `components/` or `utils/` dumping grounds.
- Introducing code splitting for routes or heavy widgets (charts, editors, maps).
- Reviewing imports that cross feature boundaries or create cycles.
- Working in a Next.js App Router project and deciding what is a Server vs Client Component.

Do not use when: the question is about component API design (see the `react-components` skill), hook design (`react-hooks`), where state should live (`react-state-management`), or routing APIs in depth (`react-router`). Framework-agnostic layering rules live in the `frontend-architecture` skill.

## Workflow

1. **Detect the project.** Read before proposing anything:
   - `package.json`: `react`/`react-dom` major (18 or 19), build tool (`vite`, `next`, `react-scripts`, `@rsbuild/core`, `webpack`), router (`react-router`, `react-router-dom`, `@tanstack/react-router`, Next's file router), state/data libs (`@tanstack/react-query`, `zustand`, `@reduxjs/toolkit`, `jotai`), UI lib (`antd`, `@mui/material`, shadcn-style `components/ui`, `@chakra-ui/react`).
   - Config: `vite.config.*`, `next.config.*`, `tsconfig.json` `paths` (aliases like `@/`), ESLint config (look for `import/no-restricted-paths`, `boundaries`, or `no-restricted-imports` rules).
   - Folders: does `src/features/`, `src/modules/`, `src/pages/`, `app/` or `src/app/` already exist? Count how many files live in `src/components/` flat.
2. **Classify the stack and branch.**
   - **Next.js with `app/` directory** → App Router. Components are Server Components by default; follow the server/client rules below. File-based routing replaces manual route config.
   - **Next.js with `pages/` only** → Pages Router; no Server Components. Use `next/dynamic` for splitting.
   - **Vite / Rsbuild / webpack SPA** → client-only; route config lives in code; split with `React.lazy` or router `lazy`.
   - **`react-scripts` (Create React App)** → legacy, unmaintained. Keep it working; do not restructure the build as a side effect. Recommend a separate migration (usually to Vite) only if asked.
3. **Follow what exists.** If the project already has a structure (`modules/`, `domains/`, `pages/` + `widgets/` as in Feature-Sliced Design), extend it with the same naming. Only propose the layout below for new projects or when the user asks for a restructure.
4. **Place the change.** Use the decision table in Best Practices. Create the smallest set of folders the change needs; never scaffold empty folders "for later".
5. **Split code at route boundaries first**, then for heavy components that are not on the first paint.
6. **Verify.** Run the project's type-check (`tsc --noEmit` or `npm run typecheck`), lint (import boundary rules), and build. For splitting, inspect the build output (Vite prints chunk sizes; `next build` prints route sizes) and confirm the new route is its own chunk.

## Best Practices

### Target layout (SPA: Vite + React Router)

```
src/
├── app/                    # composition root: providers, router, global styles, error boundary
│   ├── providers.tsx
│   ├── router.tsx
│   └── main.tsx
├── features/               # one folder per business capability
│   └── orders/
│       ├── api/            # request functions, query options, DTO mapping
│       ├── components/     # UI used only by this feature
│       ├── hooks/
│       ├── model/          # domain types, pure logic, local stores
│       ├── routes/         # route-level components (lazy-loaded entry points)
│       └── index.ts        # public API of the feature
├── shared/                 # no business knowledge
│   ├── ui/                 # design-system wrappers: Button, Modal, DataTable
│   ├── hooks/              # useDebouncedValue, useMediaQuery
│   ├── lib/                # http client, date/number formatting, invariant
│   ├── config/             # env parsing, constants
│   └── types/
└── test/                   # test utilities, MSW handlers, render helpers
```

Names vary (`modules/`, `common/`, `core/`); the rules below matter more than the names.

### Dependency direction

`app` → `features` → `shared`. Never the reverse.

- `shared/*` imports nothing from `features/` or `app/`. If a "shared" component needs `Order`, it is not shared.
- A feature imports another feature only through its `index.ts` public API, and only for things that are genuinely cross-feature (a `UserAvatar`, a `useCurrentUser` hook). Two features importing each other is a cycle: extract the common part to `shared/` or to a third feature.
- Route components (`features/*/routes/`) may compose several features; feature internals should not.
- Enforce it with tooling the project already has. With `eslint-plugin-import`: `import/no-restricted-paths` zones; or `no-restricted-imports` patterns like `@/features/*/*` to forbid deep imports. Add the rule in the same change that introduces the structure, otherwise it erodes.

### Where does this file go?

| Thing | Home |
| --- | --- |
| Button, Modal, Input wrapper around the UI library | `shared/ui/` |
| Hook with no domain knowledge (`useDebouncedValue`) | `shared/hooks/` |
| HTTP client instance, interceptors | `shared/lib/http.ts` |
| `getOrders()`, `ordersQueries`, DTO → domain mapping | `features/orders/api/` |
| `OrderStatusBadge` used only by orders | `features/orders/components/` |
| `OrderStatusBadge` used by orders and invoices | still `features/orders/`, exported from `index.ts`; move to `shared/` only if it loses the domain type |
| Page/screen for `/orders/:id` | `features/orders/routes/OrderDetailRoute.tsx` |
| Providers (QueryClient, theme, i18n) | `app/providers.tsx` |

### Barrel files

- One `index.ts` per feature as its public API is fine. Avoid barrels inside `shared/ui/` that re-export dozens of modules: they hurt tree-shaking in some setups, slow down dev servers and test runners, and make cycles easy. Import `@/shared/ui/Button` directly.
- Never `export *` from a feature's internals; list exports explicitly so the public API is reviewable.

### Container vs presentational: only where it pays

- Do not split every component into a container and a view. Hooks already separate data from rendering.
- Split when (a) the same view renders data from two sources, (b) the view is complex enough to deserve isolated tests or stories, or (c) the data part is a Server Component and the interactive part must be a Client Component.
- The "container" is usually the route component or a custom hook (`useOrderDetail`), not a separate class of files.

### Code splitting

- Split per route first: it is the largest, safest win. Every route entry under `features/*/routes/` should be lazy unless it is the landing route.
- Then split heavy, below-the-fold or interaction-only widgets: rich text editors, charts, maps, PDF viewers, large modals.
- `React.lazy` needs a module with a default export (or a `.then` that remaps a named export). Declare lazy components at module top level, never inside a component.
- Every lazy boundary needs a `Suspense` fallback and an error boundary above it: chunk loads fail on flaky networks and after deployments that remove old chunks.
- Prefer the router's own lazy mechanism when using a data router: it loads the component and its loader in parallel and avoids a render-then-fetch waterfall.
- In Next.js App Router, routes are split automatically; use `next/dynamic` only for heavy client widgets.

### Next.js App Router: server/client boundary

- Files under `app/` are Server Components by default. Add `'use client'` only at the top of a file that needs state, effects, event handlers, browser APIs, or a client-only library (most UI kits, TanStack Query hooks, Zustand).
- Push `'use client'` to the leaves. A page that fetches data stays a Server Component and renders a small client island (`<AddToCartButton />`), instead of marking the whole page as client.
- `'use client'` marks a module boundary: everything that file imports becomes client code. Do not put it in a barrel file.
- Props crossing from server to client must be serializable: primitives, plain objects, arrays, `Date`, `Map`, `Set`, typed arrays, Promises and JSX. Class instances and ordinary functions cannot cross; Server Functions (`'use server'`) can.
- Server-only code (DB access, secrets) goes in modules that import `server-only` so a client import fails the build.
- Client Components can still receive Server Components as `children` props; use that to keep providers client-side without turning the tree into client code.

### React version notes

- React 19 is the default for new work. React 18 projects can use every structural rule here; differences are in component APIs (see `react-components`).
- React Router v8 requires React 19.2.7+ and drops the `react-router-dom` package (import from `react-router`, DOM-specific APIs from `react-router/dom`). React 18 projects stay on React Router v7, which still accepts `react-router-dom` imports.

## Anti-patterns

- **Type-based top-level folders only** (`components/`, `hooks/`, `services/`, `utils/` with 200 files each) — every feature change touches five folders and nothing can be deleted safely — group by feature, keep type folders inside the feature.
- **`shared/` importing from `features/`** — creates hidden coupling and cycles — move the domain-specific piece into the feature, or pass it in as props/children.
- **Deep imports into another feature** (`@/features/billing/components/internal/Foo`) — breaks encapsulation and makes refactors cascade — export it from `features/billing/index.ts` or keep it private.
- **`'use client'` on `app/layout.tsx` or every page** — ships the whole tree to the browser and loses server rendering benefits — mark only interactive leaves.
- **`React.lazy` inside a component body** — creates a new component type each render and resets state — declare at module scope.
- **Lazy without an error boundary** — a failed chunk load blanks the page — wrap with an error boundary that offers reload.
- **Lazy-loading tiny components** — adds a network round-trip for a few hundred bytes — split routes and genuinely heavy modules only.
- **Restructuring the whole repo in the same PR as a feature** — unreviewable diff — propose the structure, move code in a dedicated change.
- **Scaffolding empty folders** (`features/x/{api,components,hooks,model,routes}` with `.gitkeep`) — noise — create folders when the first file arrives.

## Implementation Examples

### Feature public API

```ts
// src/features/orders/index.ts
export { OrderStatusBadge } from './components/OrderStatusBadge';
export { ordersQueries } from './api/orders.queries';
export type { Order, OrderStatus } from './model/order';
// Route components are not exported here; the router imports them lazily by path.
```

### Route-based splitting with a React Router data router (v7/v8)

```tsx
// src/app/router.tsx
import { createBrowserRouter } from 'react-router';
import { RootLayout } from './RootLayout';
import { RouteErrorBoundary } from './RouteErrorBoundary';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      {
        index: true,
        lazy: async () => {
          const { DashboardRoute } = await import('@/features/dashboard/routes/DashboardRoute');
          return { Component: DashboardRoute };
        },
      },
      {
        path: 'orders/:orderId',
        lazy: async () => {
          // Component and loader download in parallel.
          const [{ OrderDetailRoute }, { orderDetailLoader }] = await Promise.all([
            import('@/features/orders/routes/OrderDetailRoute'),
            import('@/features/orders/routes/orderDetail.loader'),
          ]);
          return { Component: OrderDetailRoute, loader: orderDetailLoader };
        },
      },
    ],
  },
]);
```

```tsx
// src/app/main.tsx  (React Router v8: RouterProvider from 'react-router/dom'; v7: 'react-router' or 'react-router-dom')
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { AppProviders } from './providers';
import { router } from './router';

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
```

### Component-level splitting with React.lazy

```tsx
// src/features/reports/components/ReportPanel.tsx
import { lazy, Suspense, useState } from 'react';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { Spinner } from '@/shared/ui/Spinner';

// Module scope. Named export remapped to default for React.lazy.
const RevenueChart = lazy(() =>
  import('./RevenueChart').then((m) => ({ default: m.RevenueChart })),
);

export function ReportPanel({ reportId }: { reportId: string }) {
  const [showChart, setShowChart] = useState(false);

  return (
    <section aria-labelledby="report-heading">
      <h2 id="report-heading">Revenue</h2>
      <button type="button" onClick={() => setShowChart(true)}>
        Show chart
      </button>
      {showChart && (
        <ErrorBoundary fallback={<p role="alert">Chart failed to load. Reload the page to retry.</p>}>
          <Suspense fallback={<Spinner label="Loading chart" />}>
            <RevenueChart reportId={reportId} />
          </Suspense>
        </ErrorBoundary>
      )}
    </section>
  );
}
```

`ErrorBoundary` is a class component in `shared/ui` (React has no hook equivalent) or the `react-error-boundary` package if the project already depends on it.

### Enforcing boundaries with ESLint (flat config, eslint-plugin-import)

```js
// eslint.config.js (excerpt)
import importPlugin from 'eslint-plugin-import';

export default [
  {
    plugins: { import: importPlugin },
    rules: {
      'import/no-restricted-paths': ['error', {
        zones: [
          { target: './src/shared', from: './src/features', message: 'shared must not depend on features' },
          { target: './src/shared', from: './src/app' },
          { target: './src/features', from: './src/app' },
        ],
      }],
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['@/features/*/*'], message: 'Import features through their index.ts' }],
      }],
    },
  },
];
```

If the project uses `eslint-plugin-boundaries` or Nx module boundaries instead, express the same zones there.

### Next.js App Router: server page with a client island

```tsx
// app/orders/[orderId]/page.tsx  (Server Component: no 'use client')
import { getOrder } from '@/features/orders/api/orders.server';
import { CancelOrderButton } from '@/features/orders/components/CancelOrderButton';

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params; // params is a Promise in Next 15+; a plain object in 14
  const order = await getOrder(orderId);

  return (
    <article>
      <h1>Order {order.number}</h1>
      <p>Status: {order.status}</p>
      <CancelOrderButton orderId={order.id} disabled={order.status !== 'open'} />
    </article>
  );
}
```

```tsx
// src/features/orders/components/CancelOrderButton.tsx
'use client';

import { useTransition } from 'react';
import { cancelOrder } from '../api/orders.actions'; // file starts with 'use server'

export function CancelOrderButton({ orderId, disabled }: { orderId: string; disabled: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={disabled || isPending}
      onClick={() => startTransition(() => cancelOrder(orderId))}
    >
      {isPending ? 'Cancelling…' : 'Cancel order'}
    </button>
  );
}
```

```ts
// src/features/orders/api/orders.server.ts
import 'server-only';
// DB or internal API access with secrets lives here; importing it from a client file fails the build.
```

Async functions passed to `startTransition` require React 19; on React 18, call the action and track pending state manually.

## Validation Checklist

- [ ] Project type detected (Vite/Next App/Next Pages/CRA/other) and existing structure followed.
- [ ] New code lives in one feature folder (or `shared/` only if it has no domain knowledge).
- [ ] No imports from `features/` or `app/` inside `shared/`; no deep imports into other features.
- [ ] No new import cycles (check with the lint rule or `madge --circular` if available).
- [ ] New routes are lazy-loaded; lazy components are declared at module scope.
- [ ] Every lazy boundary has a `Suspense` fallback and an error boundary above it.
- [ ] Next.js App Router: `'use client'` only on files that need it; server-only modules import `server-only`.
- [ ] Type-check, lint and build pass; build output shows the expected new chunk.

## References

- https://react.dev/reference/react/lazy
- https://react.dev/reference/react/Suspense
- https://reactrouter.com/start/data/route-object
- https://reactrouter.com/upgrading/v7
- https://nextjs.org/docs/app/getting-started/server-and-client-components
