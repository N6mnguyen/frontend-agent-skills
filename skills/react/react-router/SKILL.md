---
name: react-router
description: Version-aware React Router guidance for v6, v7 and v8 in declarative, data (createBrowserRouter) and framework modes - route config, nested layouts, lazy routes, loaders/actions, middleware, auth and role guards, search params as state, error boundaries, 404 and navigation blocking. Use when adding or changing routes, protecting pages, wiring loaders or actions, syncing filters to the URL, handling route errors, or upgrading react-router-dom to react-router.
license: MIT
metadata:
  category: react
  version: "1.0.0"
  frameworks: "react-router 6-8"
  last-reviewed: "2026-11-25"
---

# React Router

## Purpose

Route code that matches the installed major version and the mode the project already uses. Good routing here means: one route tree, layouts via `<Outlet />`, data and auth checks at the route boundary (loader or middleware) when a data router exists, URL as the source of truth for shareable UI state, an error boundary at every level that can fail, and a catch-all 404.

## When to Use

- Adding pages, nested layouts, lazy routes, 404 handling.
- Protecting routes by login or role.
- Moving filters, tabs, pagination into the URL.
- Writing loaders, actions, middleware, error boundaries, unsaved-changes prompts.
- Upgrading v6 to v7 or v7 to v8.

Do not use when: the app routes with Next.js, TanStack Router or another router. Server-state caching belongs to the `tanstack-query` skill; form mechanics to `react-forms`.

## Workflow

1. **Detect version.** Read `package.json` and the lockfile.
   - `react-router-dom@6` → v6. Imports from `react-router-dom`.
   - `react-router@7` (maybe still `react-router-dom@7` as a re-export shim) → v7.
   - `react-router@8` → v8. `react-router-dom` no longer exists; DOM-only `RouterProvider` comes from `react-router/dom`. Needs React 19.2.7+ and Node 22.22+.
2. **Detect mode.** Grep the entry file.
   - `<BrowserRouter>` + `<Routes>` → **declarative**. No loaders, actions, `useBlocker`, `useNavigation`, route `lazy`, or route `ErrorBoundary`.
   - `createBrowserRouter` + `<RouterProvider>` → **data**.
   - `react-router.config.ts`, `app/routes.ts`, `@react-router/dev` → **framework** (route modules, typegen `./+types/*`).
3. **Decide.** Stay in the detected mode. Do not migrate declarative to data as a side effect of a feature; propose it separately when the feature needs loaders or `useBlocker`. If the project fetches with TanStack Query, loaders should prime or `ensureQueryData` that cache instead of creating a second data path.
4. **Implement** following the examples below, matching file layout and naming already in `src/routes` (or `app/routes`).
5. **Verify.** `tsc --noEmit` (framework mode: `react-router typegen` first), lint, route tests with `createMemoryRouter` (see `react-testing` skill). Manually hit: deep link, refresh, unknown URL, unauthorized URL, back button after redirect.

### Version differences that bite

| Topic | v6 | v7 | v8 |
| --- | --- | --- | --- |
| Package | `react-router-dom` | `react-router` (dom package optional shim) | `react-router` only |
| `RouterProvider` import | `react-router-dom` | `react-router/dom` | `react-router/dom` |
| `json()` / `defer()` | available | removed; return plain objects or `data()` [VERIFY] | removed |
| Route `lazy` object form | no | 7.5+ | yes |
| Middleware + `createContext` | no | stable 7.9+ behind `future.v8_middleware` | default |
| `meta` / `useMatches` data field | `data` | `data` (deprecated) | `loaderData` only |

Upgrade path to v8: move to latest 7.x, enable each `future.v8_*` flag one at a time, replace `react-router-dom` imports, rename `data` to `loaderData` in `meta`/`useMatches`, then bump and delete the flags. v6 to v7: enable v6 `future.v7_*` flags first, then swap packages. [VERIFY] exact v7 flag list against the v6 upgrade guide.

## Best Practices

- **Create the router once at module scope.** Never inside a component or `useState`; recreating it resets all navigation state.
- **Layouts are routes without (or with) a path that render `<Outlet />`.** Use pathless layout routes for auth shells; use `index: true` for the default child.
- **Lazy-load at the route level.** Data mode: `lazy` (object form on 7.5+ loads each property independently, so loader and component fetch in parallel). Declarative: `React.lazy` + `<Suspense>`. Framework: automatic per-route splitting.
- **Auth belongs before render.** Data/framework mode: a middleware (v7.9+/v8) or a loader that `throw redirect('/login?redirectTo=...')`. Declarative: a guard component returning `<Navigate replace />`. Client guards are UX only; the API must enforce authorization.
- **Roles via route `handle` or per-route middleware**, not scattered `if` in pages. Return 403 (`throw data(null, { status: 403 })` or a `Response`) so the error boundary renders "forbidden", distinct from 404.
- **Validate `redirectTo`**: accept only paths starting with `/` and not `//` to avoid open redirects.
- **URL as state** for filters, sort, page, tab, selected id. Parse with a schema (Zod) and defaults; write with `setSearchParams(prev => ..., { replace: true })` for typing-heavy inputs so history is not spammed.
- **Error boundaries per layer.** Root boundary for crashes; a boundary on data-heavy child routes so the shell stays usable. Use `isRouteErrorResponse(error)` to branch on thrown responses vs exceptions.
- **404**: `path: "*"` as the last child of the root layout so it keeps the app chrome. In loaders, `throw data(null, { status: 404 })` when the entity is missing.
- **Pending UI** via `useNavigation().state` (data/framework) instead of per-page spinners for route transitions.
- **Block navigation** only for unsaved work: `useBlocker` (data/framework) for in-app links plus a `beforeunload` listener for tab close. It does not catch reloads or external URLs.
- **Links**: `<Link>` / `<NavLink>` for navigation, `useNavigate` only after side effects. Never `window.location.href` for in-app routes.

## Anti-patterns

- Mixing `react-router-dom` and `react-router` imports in one v7 app — two contexts, "useNavigate outside Router" errors. Pick `react-router`.
- `useEffect(() => { if (!user) navigate('/login') }, [])` — flashes protected content and races. Use loader/middleware redirect or a guard that renders `<Navigate>`.
- Fetching in `useEffect` inside a data-router route — waterfalls and duplicate loading state. Use the loader or the project's query library.
- Hiding admin links as the only protection — anyone can type the URL. Guard the route and the API.
- Storing filter state in `useState` and syncing to the URL in an effect — two sources of truth, back button breaks. Read from `useSearchParams` directly.
- One error boundary at the root only — any child loader failure blanks the whole app.
- `json()` / `defer()` in v7+ code — removed; return objects or `data()`.

## Implementation Examples

### Data mode router (v7/v8)

```tsx
// src/router.tsx
import { createBrowserRouter, redirect, type LoaderFunctionArgs } from 'react-router';
import { RootLayout } from './routes/root-layout';
import { RouteError } from './routes/route-error';
import { NotFound } from './routes/not-found';
import { getSession } from './auth/session';

function safeRedirectTo(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

async function requireUser({ request }: LoaderFunctionArgs) {
  const session = await getSession();
  if (!session) {
    const url = new URL(request.url);
    throw redirect(`/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
  }
  return session;
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    ErrorBoundary: RouteError,
    children: [
      { index: true, lazy: { Component: async () => (await import('./routes/home')).Home } },
      {
        path: 'login',
        loader: ({ request }) => ({ redirectTo: safeRedirectTo(new URL(request.url).searchParams.get('redirectTo')) }),
        lazy: { Component: async () => (await import('./routes/login')).Login },
      },
      {
        // pathless protected layout
        id: 'app',
        loader: requireUser,
        lazy: { Component: async () => (await import('./routes/app-layout')).AppLayout },
        ErrorBoundary: RouteError,
        children: [
          {
            path: 'orders',
            lazy: async () => {
              const m = await import('./routes/orders');
              return { Component: m.OrdersPage, loader: m.ordersLoader };
            },
          },
        ],
      },
      { path: '*', Component: NotFound },
    ],
  },
]);
```

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { router } from './router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

v6: import everything from `react-router-dom`, and replace the `lazy` object with the function form returning `{ Component, loader }`.

### Middleware auth + roles (v7.9+ with flag, v8 default)

See [references/auth-and-roles.md](references/auth-and-roles.md) for middleware with `createContext`, role checks via `handle`, and the declarative-mode guard component.

### Error boundary

```tsx
// src/routes/route-error.tsx
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return <p role="alert">Not found. <Link to="/">Go home</Link></p>;
    if (error.status === 403) return <p role="alert">You do not have access to this page.</p>;
    return <p role="alert">Request failed ({error.status}).</p>;
  }
  console.error(error); // or report to the project's error tracker
  return <p role="alert">Something went wrong.</p>;
}
```

### Search params as state

```tsx
// src/routes/orders/use-order-filters.ts
import { useSearchParams } from 'react-router';
import { z } from 'zod';

const filtersSchema = z.object({
  q: z.string().catch(''),
  status: z.enum(['all', 'open', 'shipped']).catch('all'),
  page: z.coerce.number().int().min(1).catch(1),
});
export type OrderFilters = z.output<typeof filtersSchema>;

export function useOrderFilters() {
  const [params, setParams] = useSearchParams();
  const filters = filtersSchema.parse(Object.fromEntries(params));

  function update(patch: Partial<OrderFilters>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries({ ...patch, page: patch.page ?? 1 })) {
          next.set(key, String(value));
        }
        return next;
      },
      { replace: true },
    );
  }
  return { filters, update };
}
```

`setSearchParams` updaters in the same tick do not compose like `setState`; batch changes into one call.

### Navigation blocking (data/framework mode)

```tsx
// src/hooks/use-unsaved-changes-prompt.ts
import { useEffect } from 'react';
import { useBlocker } from 'react-router';

export function useUnsavedChangesPrompt(isDirty: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => isDirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);
  return blocker; // render a dialog when blocker.state === 'blocked'; call proceed() or reset()
}
```

### Framework mode route module

```tsx
// app/routes/order.tsx
import { data } from 'react-router';
import type { Route } from './+types/order';
import { getOrder } from '~/api/orders';

export async function loader({ params }: Route.LoaderArgs) {
  const order = await getOrder(params.orderId);
  if (!order) throw data(null, { status: 404 });
  return { order };
}

export default function OrderPage({ loaderData }: Route.ComponentProps) {
  return <h1>Order {loaderData.order.number}</h1>;
}
```

## Validation Checklist

- [ ] Imports match the installed major (`react-router-dom` only on v6; `react-router/dom` for `RouterProvider` on v7/v8).
- [ ] Router created once at module scope.
- [ ] Every protected subtree redirects before render; `redirectTo` validated as an internal path.
- [ ] API enforces the same authorization as the route guard.
- [ ] Root and data-heavy child routes have error boundaries handling `isRouteErrorResponse`.
- [ ] `path: "*"` 404 route exists inside the root layout.
- [ ] Shareable UI state (filters, page, tab) lives in search params with parsed defaults.
- [ ] Unsaved forms use `useBlocker` + `beforeunload` (data/framework) or an equivalent.
- [ ] Route pages lazy-loaded; no `json()`/`defer()` on v7+.
- [ ] Tests render routes with `createMemoryRouter` / `MemoryRouter`.

## References

- [references/auth-and-roles.md](references/auth-and-roles.md) — middleware, role guards, declarative guard component.
- https://reactrouter.com/start/modes
- https://reactrouter.com/start/data/route-object
- https://reactrouter.com/how-to/middleware
- https://reactrouter.com/upgrading/v7
