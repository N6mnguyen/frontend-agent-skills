# Store Patterns: Zustand Slices, SSR and Redux Toolkit

Companion to the `react-state-management` skill.

## Zustand slices (TypeScript)

Each slice declares the full store type as its first generic and its own slice type last. Middleware goes only on the combined store.

```ts
// src/app/store/ui.slice.ts
import type { StateCreator } from 'zustand';
import type { AppStore } from './app.store';

export type UiSlice = {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
};

export const createUiSlice: StateCreator<AppStore, [], [], UiSlice> = (set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
});
```

```ts
// src/app/store/prefs.slice.ts
import type { StateCreator } from 'zustand';
import type { AppStore } from './app.store';

export type PrefsSlice = {
  density: 'comfortable' | 'compact';
  setDensity: (density: PrefsSlice['density']) => void;
};

export const createPrefsSlice: StateCreator<AppStore, [], [], PrefsSlice> = (set) => ({
  density: 'comfortable',
  setDensity: (density) => set({ density }),
});
```

```ts
// src/app/store/app.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createPrefsSlice, type PrefsSlice } from './prefs.slice';
import { createUiSlice, type UiSlice } from './ui.slice';

export type AppStore = UiSlice & PrefsSlice;

export const useAppStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createUiSlice(...a),
      ...createPrefsSlice(...a),
    }),
    {
      name: 'app-prefs',
      partialize: (s) => ({ density: s.density }), // sidebar state is session-only
    },
  ),
);
```

If a slice must call `persist` APIs or other middleware-added methods inside its creator, the mutator list in `StateCreator<AppStore, [['zustand/persist', unknown]], [], UiSlice>` must match the middleware stack [VERIFY]; most slices do not need this and can keep `[]`.

The type-only circular import between `app.store.ts` and the slices is safe because it is erased at compile time (`import type`).

## Per-request Zustand store for SSR (Next.js App Router)

A module-level `create()` store is a singleton on the server and leaks state between requests. Create a vanilla store per provider instance instead.

```tsx
// src/features/cart/model/cart-store-provider.tsx
'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

type CartState = {
  items: string[];
  add: (id: string) => void;
};

function createCartStore(initialItems: string[]) {
  return createStore<CartState>()((set) => ({
    items: initialItems,
    add: (id) => set((s) => ({ items: [...s.items, id] })),
  }));
}

const CartStoreContext = createContext<StoreApi<CartState> | null>(null);

export function CartStoreProvider({ initialItems, children }: { initialItems: string[]; children: ReactNode }) {
  const [store] = useState(() => createCartStore(initialItems)); // one store per provider instance
  return <CartStoreContext.Provider value={store}>{children}</CartStoreContext.Provider>;
}

export function useCartStore<T>(selector: (state: CartState) => T): T {
  const store = useContext(CartStoreContext);
  if (!store) throw new Error('useCartStore must be used inside <CartStoreProvider>');
  return useStore(store, selector);
}
```

`initialItems` is only read on first render; later prop changes do not reset the store. Use a `key` on the provider to reset it deliberately.

## Redux Toolkit slice with typed hooks

```ts
// src/app/store.ts
import { configureStore } from '@reduxjs/toolkit';
import { filtersSlice } from '@/features/reports/model/filters.slice';

export const store = configureStore({
  reducer: {
    [filtersSlice.name]: filtersSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

```ts
// src/app/hooks.ts  (separate file avoids circular imports)
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

```ts
// src/features/reports/model/filters.slice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type FiltersState = { range: '7d' | '30d' | '90d'; compare: boolean };

const initialState: FiltersState = { range: '30d', compare: false };

export const filtersSlice = createSlice({
  name: 'reportFilters',
  initialState,
  reducers: {
    rangeChanged(state, action: PayloadAction<FiltersState['range']>) {
      state.range = action.payload; // Immer: mutation syntax produces an immutable update
    },
    compareToggled(state) {
      state.compare = !state.compare;
    },
  },
  selectors: {
    selectRange: (state) => state.range,
  },
});

export const { rangeChanged, compareToggled } = filtersSlice.actions;
export const { selectRange } = filtersSlice.selectors;
```

Note: report filters are often URL state; use a slice only when they must persist across routes and should not be shareable by link.

### RTK Query endpoint (when RTK Query is the server-state library)

```ts
// src/features/orders/api/orders.api.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Order } from '../model/order';

export const ordersApi = createApi({
  reducerPath: 'ordersApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Order'],
  endpoints: (build) => ({
    getOrder: build.query<Order, string>({
      query: (id) => `orders/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: 'Order', id }],
    }),
    cancelOrder: build.mutation<Order, string>({
      query: (id) => ({ url: `orders/${encodeURIComponent(id)}/cancel`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Order', id }],
    }),
  }),
});

export const { useGetOrderQuery, useCancelOrderMutation } = ordersApi;
```

Register `ordersApi.reducer` under `ordersApi.reducerPath` and add `ordersApi.middleware` via `middleware: (getDefault) => getDefault().concat(ordersApi.middleware)` in `configureStore`.
