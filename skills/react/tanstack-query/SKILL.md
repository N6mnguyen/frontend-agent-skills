---
name: tanstack-query
description: Implements server-state fetching, caching, mutations and invalidation with TanStack Query v5 for React, including query key factories, queryOptions, optimistic updates, pagination, infinite queries, prefetching and testing. Use when a React project uses @tanstack/react-query (or react-query v4), when adding data fetching, mutations, cache invalidation or loading/error handling for API data, or when replacing useEffect-based fetching.
license: MIT
metadata:
  category: react
  version: "1.0.0"
  frameworks: "@tanstack/react-query 5, react 18-19"
  last-reviewed: "2026-11-25"
---

# TanStack Query

## Purpose

Treat server data as a cache that the client borrows, not state it owns. A correct TanStack Query setup has one place that defines each query (key + function + options), predictable keys that make invalidation precise, explicit freshness (`staleTime`) per data type, mutations that update or invalidate exactly the affected queries, and UI that handles pending, error and empty states.

## When to Use

- The project depends on `@tanstack/react-query` (v5) or `react-query` / `@tanstack/react-query` v4.
- Adding a query, mutation, pagination, infinite scroll or prefetch.
- Replacing `useEffect` + `useState` fetching with a cache.
- Debugging stale data, double fetching, missing invalidation, or flaky tests.

Do not use when: the project uses RTK Query, SWR or Apollo for server state (follow that library), or data comes only from Next.js Server Components with no client cache. HTTP client setup, auth headers and error normalization belong to the `frontend-api-integration` skill; where state should live overall is `react-state-management`.

## Workflow

1. **Detect.**
   - `package.json`: `@tanstack/react-query` major (5 or 4), `@tanstack/react-query-devtools`, `@tanstack/eslint-plugin-query`, `@tanstack/react-query-persist-client`.
   - Find the `QueryClient` creation and `QueryClientProvider` (usually `app/providers.tsx`). Read its `defaultOptions`.
   - Find existing key conventions: key factories (`ordersKeys`, `queries.ts`), `queryOptions` usage, or inline array keys. Find the HTTP client the query functions use.
   - Next.js / SSR: look for `HydrationBoundary`, `dehydrate`, or `@tanstack/react-query-next-experimental`.
2. **Decide.**
   - v4 project: use v4 APIs (see version table); do not mix v5 names in.
   - Existing key/option pattern: extend it. No pattern: create a per-feature `queryOptions` factory as shown below.
   - Suspense: use `useSuspenseQuery` only if the surrounding route already has Suspense + error boundaries; otherwise `useQuery`.
3. **Implement.** Query function in the feature `api/` folder, options factory next to it, hooks/components consume the factory. Mutations invalidate or update via the factory's keys.
4. **Verify.** Type-check, lint (enable `@tanstack/eslint-plugin-query` if installed — it catches missing key dependencies), tests with a fresh `QueryClient`, and manual check in Devtools that keys and staleness look right.

## Best Practices

### QueryClient setup

- Create the client once per app (module scope or `useState(() => new QueryClient())` in a provider). In SSR frameworks, create it per request on the server and once in the browser; never share a module-level client across server requests.
- Set a non-zero default `staleTime` that fits the app (for example 30–60 s for typical dashboards). The library default is `0` (always stale), which refetches on every mount and window focus.
- Leave `gcTime` (default 5 min) unless memory or offline persistence needs differ. `gcTime` only starts when a query has no observers.
- `retry` defaults to 3 with backoff in the browser. Disable retries for 4xx errors via a function: `retry: (count, error) => !isClientError(error) && count < 3`.
- Mount `ReactQueryDevtools` in development only if the package is installed.

### Query keys

- Keys are arrays, hashed deterministically: object property order does not matter, array order does.
- Put every variable the query function uses into the key (ids, filters, page, locale). A missing variable means two different requests share a cache entry.
- Structure keys from general to specific so `invalidateQueries({ queryKey: prefix })` hits a whole family: `['orders']` → `['orders', 'list', filters]` → `['orders', 'detail', id]`.
- Centralize per-feature keys in a factory. Pair them with `queryOptions` so key and function cannot drift apart.

### `queryOptions` and hooks

- `queryOptions({ queryKey, queryFn, ...})` returns a typed options object usable by `useQuery`, `useSuspenseQuery`, `useQueries`, `queryClient.query`, and whose `queryKey` is typed for `getQueryData`/`setQueryData`. Use `infiniteQueryOptions` for infinite queries.
- Pass the `signal` from the query function context to fetch/axios so React Query can cancel superseded requests.
- Override per call site with spread: `useQuery({ ...orderQueries.detail(id), select: (o) => o.status })`.
- `select` transforms or picks data per component; the cache keeps the raw data.
- `enabled: false`/conditional `enabled` for dependent queries. `skipToken` (imported from `@tanstack/react-query`) is type-safe for a missing query function; `refetch()` does not work with it, so use `enabled: false` when manual refetch is required.
- `useSuspenseQuery` returns `data` typed as defined (never `undefined`); errors go to the nearest error boundary. It does not accept `enabled` or `placeholderData`.

### Status flags (v5)

- `isPending`: no data yet (`status === 'pending'`). Use for the first-load skeleton.
- `isFetching`: any fetch in flight, including background refetches. Use for a subtle refresh indicator.
- `isLoading`: `isPending && isFetching` (first load actually fetching). A disabled query is pending but not loading.
- `isError` + `error`: error type defaults to `Error` in v5. Register a custom type via module augmentation if the HTTP client throws something else.
- `isPlaceholderData`: data shown is placeholder (e.g. previous page).
- Render order: pending → error → empty → data. If data exists and a background refetch fails, keep showing the data and surface the error non-destructively.

### Mutations

- Use `useMutation` for create/update/delete. `mutate` for fire-and-forget with callbacks; `mutateAsync` only when you need to `await` in sequence (and then handle the rejection).
- After success, either invalidate the affected keys (simple, always correct) or write the response into the cache with `setQueryData` (saves a request when the response contains the full updated entity). Often both: set the detail, invalidate lists.
- Return the invalidation promise from `onSettled`/`onSuccess` to keep the mutation pending until the refetch completes.
- v5 callback signatures: `onMutate(variables, context)`, `onError(error, variables, onMutateResult, context)`, `onSuccess(data, variables, onMutateResult, context)`, `onSettled(data, error, variables, onMutateResult, context)`. `context.client` is the `QueryClient`. Older v5 minors used `(variables)` and passed the `onMutate` return value as `context` in the third position; check the installed version's types [VERIFY].
- `useQuery` has no `onSuccess`/`onError`/`onSettled` in v5. For global error toasts use `QueryCache({ onError })`; for derived state, derive from `data`.

### Optimistic updates

- **Via variables (UI-only):** render `mutation.variables` while `isPending`. No rollback code; use when the pending item shows in one place. Use `useMutationState` to read it in another component.
- **Via the cache:** in `onMutate`, cancel outgoing queries for the key, snapshot, `setQueryData` optimistically, return the snapshot; in `onError`, restore it; in `onSettled`, invalidate. Use when many components read the same data.
- Always invalidate after an optimistic update; the server is the source of truth.

### Pagination and infinite queries

- Paginated lists: include `page` in the key and use `placeholderData: keepPreviousData` so the old page remains visible while the next loads; disable "Next" with `isPlaceholderData`.
- `useInfiniteQuery` in v5 requires `initialPageParam` and `getNextPageParam(lastPage, allPages, lastPageParam, allPageParams)`; return `undefined` or `null` when there are no more pages. `maxPages` limits stored pages (requires `getPreviousPageParam` too).
- Infinite query data is `{ pages, pageParams }`; flatten with `data.pages.flatMap((p) => p.items)` in render or `select`.

### Prefetching

- Hover/focus prefetch and router loaders: call `queryClient.query(options)` (v5.102+) — it returns cached data if fresh, otherwise fetches. Swallow errors with `.catch(() => {})` (`noop`) when prefetching is optional.
- Before v5.102, use `queryClient.prefetchQuery(options)` / `ensureQueryData(options)`; these still work but are deprecated in newer minors and will be removed in the next major.
- `usePrefetchQuery(options)` prefetches during render for Suspense-based trees to avoid waterfalls.

### Version differences (v4 → v5)

| v4 | v5 |
| --- | --- |
| `cacheTime` | `gcTime` |
| `status: 'loading'`, `isLoading` | `status: 'pending'`, `isPending`; `isLoading` now means `isPending && isFetching` |
| `isInitialLoading` | `isLoading` |
| `keepPreviousData: true` | `placeholderData: keepPreviousData` (imported function), `isPlaceholderData` |
| `useErrorBoundary` | `throwOnError` |
| `suspense: true` option | `useSuspenseQuery` / `useSuspenseInfiniteQuery` / `useSuspenseQueries` |
| `onSuccess`/`onError` on `useQuery` | removed (mutations keep them) |
| optional `pageParam` default | `initialPageParam` required |
| `Hydrate` | `HydrationBoundary` |
| overloads `useQuery(key, fn, opts)` | single object argument only |
| React 16.8+ | React 18+ |

## Anti-patterns

- **Copying query data into `useState`/Zustand** — two sources of truth that drift — read from the query; derive with `select`.
- **`useEffect` that calls `refetch()` when a filter changes** — fights the cache — put the filter in the key.
- **Inline keys repeated across files** (`['order', id]` here, `['orders', id]` there) — invalidation misses — key factory + `queryOptions`.
- **`staleTime: 0` everywhere by accident** — refetch storms on focus/mount — set a sensible default.
- **`invalidateQueries()` with no filter after a mutation** — refetches every active query — target the affected prefix.
- **Optimistic update without `cancelQueries`** — an in-flight refetch overwrites the optimistic value — cancel first.
- **`mutateAsync` without try/catch** — unhandled promise rejection — use `mutate` with callbacks or catch.
- **New `QueryClient` inside a component body without `useState`** — cache wiped every render — create once.
- **Shared `QueryClient` across tests or SSR requests** — leaking state — fresh client per test/request.
- **Using `isLoading` as "no data yet" in v5** — false for disabled queries — use `isPending`.

## Implementation Examples

### Client and provider

```tsx
// src/app/providers.tsx
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { HttpError } from '@/shared/lib/http';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: (failureCount, error) =>
          !(error instanceof HttpError && error.status >= 400 && error.status < 500) && failureCount < 3,
      },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

`import.meta.env.DEV` is Vite; use `process.env.NODE_ENV !== 'production'` elsewhere. Devtools are tree-shaken from production builds by default, so the guard is optional.

### Key factory with queryOptions

```ts
// src/features/orders/api/orders.queries.ts
import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { getOrder, getOrders, type OrderFilters } from './orders.api';

export const ordersQueries = {
  all: () => ['orders'] as const,
  lists: () => [...ordersQueries.all(), 'list'] as const,
  list: (filters: OrderFilters) =>
    queryOptions({
      queryKey: [...ordersQueries.lists(), filters] as const,
      queryFn: ({ signal }) => getOrders(filters, signal),
      placeholderData: keepPreviousData,
    }),
  details: () => [...ordersQueries.all(), 'detail'] as const,
  detail: (id: string) =>
    queryOptions({
      queryKey: [...ordersQueries.details(), id] as const,
      queryFn: ({ signal }) => getOrder(id, signal),
      staleTime: 5 * 60_000,
    }),
};
```

### Paginated list component

```tsx
// src/features/orders/components/OrderTable.tsx
import { useQuery } from '@tanstack/react-query';
import { ordersQueries } from '../api/orders.queries';

export function OrderTable({ page, onPageChange }: { page: number; onPageChange: (p: number) => void }) {
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } = useQuery(
    ordersQueries.list({ page, pageSize: 20 }),
  );

  if (isPending) return <p aria-busy="true">Loading orders…</p>;
  if (isError)
    return (
      <div role="alert">
        <p>Could not load orders: {error.message}</p>
        <button type="button" onClick={() => void refetch()}>Retry</button>
      </div>
    );
  if (data.items.length === 0) return <p>No orders yet.</p>;

  return (
    <section aria-busy={isFetching}>
      <ul>
        {data.items.map((o) => <li key={o.id}>{o.number}</li>)}
      </ul>
      <button type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)}>Previous</button>
      <button
        type="button"
        disabled={isPlaceholderData || !data.hasMore}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </section>
  );
}
```

Keep `page` in the URL (see `react-state-management`) so reload and back/forward work.

### Mutation with targeted invalidation

```ts
// src/features/orders/hooks/useCancelOrder.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelOrder } from '../api/orders.api';
import { ordersQueries } from '../api/orders.queries';

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId), // resolves to the updated Order
    onSuccess: (order) => {
      queryClient.setQueryData(ordersQueries.detail(order.id).queryKey, order);
      return queryClient.invalidateQueries({ queryKey: ordersQueries.lists() });
    },
  });
}
```

Optimistic (cache and variables), infinite query, prefetch, SSR hydration and testing examples: [references/examples.md](references/examples.md).

## Validation Checklist

- [ ] Installed major detected; only that major's API names used (`gcTime`, `isPending`, `initialPageParam` in v5).
- [ ] One `QueryClient` per app (per request on the server); sensible default `staleTime`.
- [ ] Every query uses a factory key containing all variables the query function reads.
- [ ] Query functions forward `signal`; data is typed/validated at the `api/` layer.
- [ ] Components handle pending, error (with retry where safe), empty and data states.
- [ ] Mutations invalidate or update only the affected key prefixes; optimistic updates cancel, snapshot, roll back and invalidate.
- [ ] No server data copied into local/global client state.
- [ ] Tests create a fresh `QueryClient` with `retry: false` per test.
- [ ] Type-check, lint and tests pass.

## References

- [Optimistic updates, infinite queries, prefetching, SSR and testing](references/examples.md)
- https://tanstack.com/query/latest/docs/framework/react/overview
- https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5
- https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults
- https://tanstack.com/query/latest/docs/framework/react/guides/query-options
