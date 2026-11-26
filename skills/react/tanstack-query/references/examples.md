# TanStack Query v5: Extended Examples

Companion to the `tanstack-query` skill. Import paths and examples assume `@tanstack/react-query` 5.x and React 18+.

## Infinite query

```ts
// src/features/activity/api/activity.queries.ts
import { infiniteQueryOptions } from '@tanstack/react-query';
import { getActivityPage } from './activity.api';

// getActivityPage returns Promise<ActivityPage>
export type ActivityPage = {
  items: { id: string; label: string }[];
  nextCursor: string | null;
  previousCursor: string | null;
};

export const activityQueries = {
  infinite: (filter: string) =>
    infiniteQueryOptions({
      queryKey: ['activity', 'infinite', { filter }] as const,
      initialPageParam: null as string | null,
      queryFn: ({ pageParam, signal }) => getActivityPage({ cursor: pageParam, filter, signal }),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      getPreviousPageParam: (firstPage) => firstPage.previousCursor ?? undefined,
      maxPages: 8,
    }),
};
```

```tsx
// src/features/activity/components/ActivityFeed.tsx
import { useInfiniteQuery } from '@tanstack/react-query';
import { activityQueries } from '../api/activity.queries';

export function ActivityFeed({ filter }: { filter: string }) {
  const query = useInfiniteQuery(activityQueries.infinite(filter));
  if (query.isPending) return <p aria-busy="true">Loading activity…</p>;
  if (query.isError) return <p role="alert">Could not load activity: {query.error.message}</p>;
  const rows = query.data.pages.flatMap((page) => page.items);
  return (
    <>
      <ul>{rows.map((item) => <li key={item.id}>{item.label}</li>)}</ul>
      <button
        type="button"
        disabled={!query.hasNextPage || query.isFetchingNextPage}
        onClick={() => void query.fetchNextPage()}
      >
        {query.isFetchingNextPage ? 'Loading…' : query.hasNextPage ? 'Load more' : 'No more activity'}
      </button>
    </>
  );
}
```

`getPreviousPageParam` is optional unless using `maxPages` to support backwards page eviction. For forward-only lists with no `maxPages`, omit it. v5 requires `initialPageParam`; do not rely on a `pageParam = 0` default in `queryFn`.

## Optimistic cache update with rollback (v5 callback context)

```tsx
// src/features/todos/hooks/useAddTodo.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { todoQueries } from '../api/todo.queries';
import { addTodo, type Todo } from '../api/todo.api';

type AddVariables = { text: string };
type Snapshot = { previous: Todo[] | undefined };

export function useAddTodo() {
  const queryClient = useQueryClient();
  return useMutation<Todo, Error, AddVariables, Snapshot>({
    mutationFn: addTodo,
    onMutate: async (variables, context) => {
      const key = todoQueries.list().queryKey;
      await context.client.cancelQueries({ queryKey: key });
      const previous = context.client.getQueryData<Todo[]>(key);
      context.client.setQueryData<Todo[]>(key, (old = []) => [
        ...old,
        { id: `optimistic-${Date.now()}`, text: variables.text, completed: false },
      ]);
      return { previous };
    },
    onError: (_error, _variables, onMutateResult, context) => {
      if (onMutateResult?.previous) {
        context.client.setQueryData(todoQueries.list().queryKey, onMutateResult.previous);
      }
    },
    onSettled: (_data, _error, _variables, _onMutateResult, context) =>
      context.client.invalidateQueries({ queryKey: todoQueries.list().queryKey }),
  });
}
```

If multiple concurrent mutations can target the same list, a full snapshot rollback from one failed mutation can erase another in-flight optimistic item. Use the per-mutation variable overlay pattern below, or reconcile only the failed item by ID.

## Optimistic UI through mutation variables

Best for one display location and no shared cache mutation. `variables` remain available on an error to support a retry affordance.

```tsx
// src/features/todos/components/TodoList.tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { todoQueries } from '../api/todo.queries';
import { addTodo } from '../api/todo.api';

export function TodoList() {
  const queryClient = useQueryClient();
  const todos = useQuery(todoQueries.list());
  const add = useMutation({
    mutationFn: addTodo, // (variables: { text: string }) => Promise<Todo>
    // Returning the promise keeps isPending true until the list has refetched,
    // so the pending row and the real row never show at the same time.
    onSettled: () => queryClient.invalidateQueries({ queryKey: todoQueries.list().queryKey }),
  });

  if (todos.isPending) return <p>Loading…</p>;
  if (todos.isError) return <p role="alert">{todos.error.message}</p>;
  return (
    <ul>
      {todos.data.map((todo) => <li key={todo.id}>{todo.text}</li>)}
      {add.isPending && <li aria-busy="true">{add.variables.text} (sending…)</li>}
      {add.isError && (
        <li role="alert">
          {add.variables.text} failed. <button type="button" onClick={() => add.mutate(add.variables)}>Retry</button>
        </li>
      )}
    </ul>
  );
}
```

To show the pending item in a different component, give the mutation a `mutationKey` and read pending variables there with `useMutationState({ filters: { mutationKey, status: 'pending' }, select: (m) => m.state.variables })`.

## Prefetch on hover and in a router loader (v5.102+)

```tsx
// src/features/orders/components/OrderLink.tsx
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ordersQueries } from '../api/orders.queries';

export function OrderLink({ id, number }: { id: string; number: string }) {
  const queryClient = useQueryClient();
  const prefetch = () => {
    void queryClient.query(ordersQueries.detail(id)).catch(() => undefined);
  };
  return (
    <Link to={`/orders/${id}`} onMouseEnter={prefetch} onFocus={prefetch}>
      {number}
    </Link>
  );
}
```

```ts
// src/features/orders/routes/orderDetail.loader.ts
import type { LoaderFunctionArgs } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { ordersQueries } from '../api/orders.queries';

// Inject the request-scoped client via router context in SSR; never share this instance across server requests.
export function createOrderLoader(queryClient: QueryClient) {
  return async ({ params }: LoaderFunctionArgs) => {
    const id = params.orderId;
    if (!id) throw new Response('Order ID missing', { status: 400 });
    return queryClient.query(ordersQueries.detail(id)); // required data: loader waits and errors reach route boundary
  };
}
```

`queryClient.query` was added in v5.102.0. Older v5 versions use `fetchQuery` or `prefetchQuery`; these methods are deprecated in current v5 minors.

## SSR hydration (framework-neutral outline)

```tsx
// src/app/orders/page.tsx — server request handler/framework-specific entry
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { ordersQueries } from '@/features/orders/api/orders.queries';
import { OrderDetail } from '@/features/orders/components/OrderDetail';

export default async function OrderPage({ id }: { id: string }) {
  const queryClient = new QueryClient(); // new client for each server request
  await queryClient.query(ordersQueries.detail(id));
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrderDetail id={id} />
    </HydrationBoundary>
  );
}
```

The exact server entry signature differs by framework; the invariant is request-scoped server QueryClient + dehydration + client provider/hydration boundary. Do not expose secrets in dehydrated query data.

## Isolated tests

```tsx
// src/test/renderWithQueryClient.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

export function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { ...render(ui, { wrapper: Wrapper }), queryClient };
}
```

Create one `QueryClient` per test to prevent cache leakage. With Jest, `gcTime: Infinity` avoids timers keeping the test process alive when the test overrides defaults; the server default is already Infinity.
