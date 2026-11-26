---
name: react-state-management
description: Classifies React state and places it in the right owner — component state, URL search params, form library, TanStack Query cache, React Context, Zustand or Redux Toolkit — with minimal global state. Use when deciding where state should live, adding a store or context, fixing prop drilling or excessive re-renders from context, syncing filters or pagination to the URL, or working in a project that uses Zustand, Redux Toolkit or RTK Query.
license: MIT
metadata:
  category: react
  version: "1.0.0"
  frameworks: "react 18-19, zustand 4-5, @reduxjs/toolkit 2, react-router 7-8"
  last-reviewed: "2026-11-25"
---

# React State Management

## Purpose

Put each piece of state where its lifetime, sharing and source of truth naturally belong. Most React apps need far less global state than they have: server data belongs to a cache, shareable view state belongs to the URL, form drafts belong to the form, and what remains is usually local. A good result has one source of truth per value, no copies to keep in sync, and global stores only for genuinely app-wide client state.

## When to Use

- Deciding where new state lives, or reviewing a PR that adds a store, slice or context.
- Fixing prop drilling, stale duplicated data, or context-driven re-render problems.
- Moving filters, tabs, sorting or pagination into the URL.
- Working in a codebase with Zustand, Redux Toolkit or RTK Query.

Do not use when: the task is query/mutation mechanics (see `tanstack-query`), form validation (see `react-forms`), routing setup (see `react-router`) or hook mechanics (see `react-hooks`).

## Workflow

1. **Detect.** In `package.json`: `@tanstack/react-query`, `swr`, `@reduxjs/toolkit` + `react-redux`, `zustand` (major 4 vs 5), `jotai`, `valtio`, `mobx`, `react-hook-form`, router (`react-router` / `react-router-dom` / `@tanstack/react-router` / Next.js), `nuqs`. Locate existing stores (`store/`, `*Slice.ts`, `use*Store.ts`) and providers.
2. **Classify the state** with the table below before writing code. Write the classification in the PR description when introducing a new store.
3. **Decide with the existing stack.**
   - Server data → the project's server-state library (TanStack Query, RTK Query, SWR). Never a new client store.
   - Global client state → the store already installed. Zustand present: use it. RTK present: add a slice. Neither present: start with Context; add Zustand only when the needs listed below appear.
   - Do not introduce a second global-state library alongside an existing one.
4. **Implement** with the narrowest scope: the lowest component that owns it, provider at the lowest subtree that needs it.
5. **Verify.** Type-check and tests. Check re-render behavior with React DevTools Profiler ("Highlight updates") for context/store changes. Confirm URL state survives reload and back/forward.

## Best Practices

### Classify first

| Kind | Examples | Owner |
| --- | --- | --- |
| Server state | lists, entities, current user profile, permissions | TanStack Query / RTK Query / SWR / framework loaders |
| URL state | filters, search text, sort, page, selected tab, open record id | router search params / path params |
| Form state | field values, touched, validation errors | form library or uncontrolled form + Actions |
| Local UI state | open/closed, hover, input draft, step index | `useState` / `useReducer` in the component |
| Shared client state (subtree) | wizard data across steps, table selection | lifted state or a scoped Context |
| Global client state | theme, sidebar collapsed, auth token presence, feature-flag overrides, cart before checkout | Context (low-frequency) or Zustand/RTK |
| Derived state | totals, filtered lists, `isValid` | compute during render (never store) |

Questions that decide it: Does it come from the server? Should a copied link reproduce it? Does it outlive the component? How many distant components read it? How often does it change?

### Local and lifted state

- Start local. Lift to the nearest common parent only when two siblings need it.
- Before adding Context to avoid prop drilling, try composition: pass `children` or element props so intermediate components do not need the data.
- Reset state by changing a `key` rather than syncing with effects.

### URL state

- Anything a user would expect to bookmark, share, or restore with Back belongs in the URL.
- Read from the URL every render; do not mirror it into `useState`. Parse and validate (unknown values fall back to defaults) at one place per page.
- Use `replace` for high-frequency updates (typing in a search box) to avoid flooding history; `push` for deliberate navigation (page change).
- Debounce text input before writing to the URL if it triggers fetching.
- Projects using `nuqs` or TanStack Router typed search params: use those instead of hand-rolled parsing.

### Context

- Context is dependency injection, not a performance-optimized store. Every consumer re-renders when the value identity changes.
- Split contexts by update frequency and by concern: state and dispatch/actions in separate contexts, so components that only dispatch do not re-render.
- Memoize object values (`useMemo`) unless the React Compiler is enabled and verified to handle the provider.
- Provide a `null` default and a guarded hook that throws outside the provider.
- Put providers as low as possible; a theme provider at the root is fine, a wizard provider belongs to the wizard route.
- React 19 allows `<MyContext value={...}>`; use `<MyContext.Provider>` when React 18 must be supported.

### Zustand (v5, and v4 where noted)

- Use it when it is already installed, or when Context is causing broad re-renders for frequently changing global client state, or when non-React code must read/write the state.
- TypeScript: `create<State>()((set, get) => ({ ... }))` — the curried call is required for correct middleware typing.
- Always select: `useCartStore((s) => s.items)`. Never `useCartStore()` without a selector in components; it re-renders on every change.
- Selectors returning new arrays/objects (`(s) => [s.a, s.b]`, `(s) => ({ a: s.a })`) cause "Maximum update depth exceeded" in v5 (and extra renders in v4). Wrap with `useShallow` (`import { useShallow } from 'zustand/react/shallow'`) or select primitives separately. Hoist fallback constants (`?? EMPTY_ARRAY`) outside the selector.
- Keep actions in the store next to the state they modify; components call `useStore((s) => s.addItem)`.
- Large stores: slices combined in one `create` call, with middleware (`persist`, `devtools`) applied only at the combined store.
- `persist`: set a `name`, a `version` + `migrate` when the shape changes, and `partialize` to store only what must survive reload. Never persist tokens or PII in `localStorage` (see the `frontend-security` skill). In v5 (and v4.5.5+), initial state is no longer written to storage at creation.
- SSR (Next.js): a module-level store is shared across requests on the server. Create the store per request (`createStore` from `zustand/vanilla` + context) or keep the store client-only.
- v5 requires React 18+; `createWithEqualityFn` moved to `zustand/traditional`; default exports were removed (use `import { create } from 'zustand'`).

### Redux Toolkit / RTK Query (follow if present)

- If the project uses RTK, add a slice with `createSlice` and register it in `configureStore`; do not add Zustand next to it.
- Use typed hooks: `useAppSelector = useSelector.withTypes<RootState>()` and `useAppDispatch = useDispatch.withTypes<AppDispatch>()` (react-redux 9.1+), defined in a separate `hooks.ts`.
- If RTK Query is present, server state goes into an `createApi` endpoint with `providesTags`/`invalidatesTags`, not TanStack Query.
- Keep selectors small and memoize derived data with `createSelector` when it computes new arrays/objects.
- Do not use legacy `createStore` from `redux`, hand-written action constants, or `connect` in new code.

### Avoid unnecessary global state

- Removing a store is a valid outcome. Before adding a field to a global store, check whether it is derived, URL, server, or local.
- Copying server data into a store (`setUsers(data)` in `onSuccess`) is the most common duplication bug; read from the cache instead.
- Global state makes components harder to reuse and test. Prefer props for leaf components, and pass store values from a feature-level container.

## Anti-patterns

- **Server data in Redux/Zustand/Context** — stale copies, manual loading flags, missed invalidation — use the server-state library.
- **Filters/page in `useState` on list pages** — lost on reload, not shareable, Back button breaks — use search params.
- **One giant `AppContext`** with user, theme, cart and modals — every consumer re-renders on any change — split by concern, or move frequently changing state to a store with selectors.
- **Context value as a fresh object literal each render** with no compiler — all consumers re-render — `useMemo` the value, split state/actions.
- **`useStore()` with no selector, or selector returning a new object without `useShallow`** — re-render storm or infinite loop in Zustand v5 — select narrowly.
- **Storing derived values** (`total`, `filteredItems`) in state — goes stale — compute in render or a selector.
- **Syncing state with `useEffect`** (`useEffect(() => setLocal(prop), [prop])`) — double render and drift — derive, or reset with `key`.
- **Adding a second global store library** — two mental models — use the installed one.
- **Persisting secrets or whole stores to `localStorage`** — security and migration problems — `partialize` and never store tokens there.
- **Module-level Zustand store in SSR** — state leaks between users — per-request store via context.

## Implementation Examples

### URL state with React Router search params

```tsx
// src/features/orders/hooks/useOrderFilters.ts
import { useSearchParams } from 'react-router'; // React Router 7 also exports this from 'react-router-dom'

const STATUSES = ['all', 'open', 'shipped', 'cancelled'] as const;
export type StatusFilter = (typeof STATUSES)[number];

function parseStatus(value: string | null): StatusFilter {
  return STATUSES.find((s) => s === value) ?? 'all';
}

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function useOrderFilters() {
  const [params, setParams] = useSearchParams();
  const filters = {
    status: parseStatus(params.get('status')),
    page: parsePage(params.get('page')),
    q: params.get('q') ?? '',
  };

  function update(patch: Partial<typeof filters>, options?: { replace?: boolean }) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          const isDefault = value === '' || value === 'all' || (key === 'page' && value === 1);
          if (isDefault) next.delete(key);
          else next.set(key, String(value));
        }
        if (!('page' in patch)) next.delete('page'); // filter change resets pagination
        return next;
      },
      { replace: options?.replace ?? false },
    );
  }

  return { filters, update };
}
```

Feed `filters` into the query key (`ordersQueries.list(filters)`), so URL changes drive fetching with no effect.

### Split Context for low-frequency global state

```tsx
// src/app/theme/theme-context.tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ThemeActions = { setTheme: (theme: Theme) => void };

const ThemeStateContext = createContext<Theme | null>(null);
const ThemeActionsContext = createContext<ThemeActions | null>(null);

export function ThemeProvider({ initial = 'system', children }: { initial?: Theme; children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const actions = useMemo(() => ({ setTheme }), []); // setState identity is stable

  return (
    <ThemeActionsContext.Provider value={actions}>
      <ThemeStateContext.Provider value={theme}>{children}</ThemeStateContext.Provider>
    </ThemeActionsContext.Provider>
  );
}

export function useTheme(): Theme {
  const value = useContext(ThemeStateContext);
  if (value === null) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}

export function useThemeActions(): ThemeActions {
  const value = useContext(ThemeActionsContext);
  if (value === null) throw new Error('useThemeActions must be used inside <ThemeProvider>');
  return value;
}
```

### Zustand v5 store with selectors and persist

```ts
// src/features/cart/model/cart.store.ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type CartItem = { productId: string; quantity: number };

type CartState = {
  items: CartItem[];
  addItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (productId) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === productId);
          return {
            items: existing
              ? state.items.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i))
              : [...state.items, { productId, quantity: 1 }],
          };
        }),
      removeItem: (productId) => set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'cart',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }), // persist data, not actions
    },
  ),
);

// Narrow selectors exported next to the store
export const selectItemCount = (s: CartState) => s.items.reduce((sum, i) => sum + i.quantity, 0);
```

```tsx
// src/features/cart/components/CartBadge.tsx
import { useShallow } from 'zustand/react/shallow';
import { selectItemCount, useCartStore } from '../model/cart.store';

export function CartBadge() {
  const count = useCartStore(selectItemCount); // number: no useShallow needed
  return <span aria-label={`${count} items in cart`}>{count}</span>;
}

export function CartActions({ productId }: { productId: string }) {
  const { addItem, removeItem } = useCartStore(
    useShallow((s) => ({ addItem: s.addItem, removeItem: s.removeItem })),
  );
  return (
    <>
      <button type="button" onClick={() => addItem(productId)}>Add</button>
      <button type="button" onClick={() => removeItem(productId)}>Remove</button>
    </>
  );
}
```

Slices pattern, RTK slice + typed hooks, and per-request Zustand store for SSR: [references/stores.md](references/stores.md).

## Validation Checklist

- [ ] Each new piece of state classified (server / URL / form / local / shared / global / derived).
- [ ] No server data copied into client stores or Context.
- [ ] Bookmarkable view state (filters, sort, page, tab) lives in the URL and is parsed with defaults.
- [ ] Derived values computed, not stored.
- [ ] Context values split by concern and memoized; providers placed as low as possible.
- [ ] Zustand: curried `create<T>()`, narrow selectors, `useShallow` for object/array selections, middleware only at the combined store, `partialize` on `persist`.
- [ ] RTK: slices + typed hooks; RTK Query for server state if it is the installed server-state library.
- [ ] No second global-state library introduced.
- [ ] Type-check, tests and a Profiler check of re-renders pass.

## References

- [Zustand slices, SSR store, Redux Toolkit setup](references/stores.md)
- https://react.dev/learn/choosing-the-state-structure
- https://react.dev/learn/scaling-up-with-reducer-and-context
- https://zustand.docs.pmnd.rs/
- https://redux.js.org/tutorials/typescript-quick-start
