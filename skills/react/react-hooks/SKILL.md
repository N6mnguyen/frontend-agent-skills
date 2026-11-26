---
name: react-hooks
description: Applies React hook rules and designs custom hooks, effects and external-store subscriptions without stale closures or redundant state. Use when adding or reviewing a hook, useEffect, useRef, useReducer, useSyncExternalStore, useId, useTransition or useDeferredValue, diagnosing dependency or cleanup bugs, or checking React Compiler memoization behavior.
license: MIT
metadata:
  category: react
  version: "1.0.0"
  frameworks: "react 18-19"
  last-reviewed: "2026-11-25"
---

# React Hooks

## Purpose

Use hooks to connect components to React state and external systems—not to wrap every function or derive values that can be computed during render. Correct hooks preserve identity, clean up subscriptions and timers, declare all reactive dependencies, and remain safe under Strict Mode's development re-runs.

## When to Use

- Adding or debugging `useState`, `useReducer`, `useRef`, `useEffect`, or custom hooks.
- Diagnosing stale closures, unexpected effect loops, subscriptions, timers or fetch races.
- Integrating a mutable external store with `useSyncExternalStore`.
- Choosing `useTransition` / `useDeferredValue` for non-urgent rendering.
- Deciding whether manual memoization is useful when React Compiler is enabled.

Do not use when: state ownership across the app is the core problem (see `react-state-management`), server data caching is the problem (see `tanstack-query`), or component composition is the core issue (see `react-components`).

## Workflow

1. **Read the hook in context.** Inspect the component, its callers, React version, existing lint setup (especially `eslint-plugin-react-hooks`), and whether React Compiler is configured.
2. **Classify the value.** Is it render-derived data, interaction state, a mutable handle, or a live external-system value? Choose render calculation, `useState`/`useReducer`, `useRef`, or an Effect/subscription accordingly.
3. **Remove unnecessary Effects first.** Apply the checklist in Best Practices before adding or changing an Effect.
4. **Define lifecycle.** List setup, dependencies, cleanup, and what happens on changed dependencies/unmount. Make setup/cleanup symmetrical and safe to run twice.
5. **Verify.** Run React hook lint rules and type-check. Test rerender with changed inputs, unmount cleanup, Strict Mode, error/retry paths, and relevant races.

## Best Practices

### Rules of Hooks

- Call hooks only at the top level of a function component or custom hook—not in conditions, loops, nested functions, event handlers or `try/catch`.
- Call hooks in the same order on every render. Early return only after all hooks have run.
- Hook names start with `use` followed by a capitalized word (`useOnlineStatus`); a function that calls hooks must follow this naming convention so the linter can inspect it.
- Run `eslint-plugin-react-hooks` rules. Do not suppress `rules-of-hooks` or `exhaustive-deps` to silence a real ordering/dependency issue.

### Custom hook API

- Extract only behavior that is reused, stateful, lifecycle-bound, or independently meaningful. Do not create `useFoo` around a one-line pure calculation.
- Name by purpose (`useOnlineStatus`, `useSearchParamsState`), not implementation (`useEffectAndState`).
- Return the smallest useful contract: an object for multiple named values; a tuple only when there are one or two positional values where callers commonly rename both (`const [value, setValue] = ...`).
- Keep custom hooks composable and avoid hidden global effects. Document what is returned, whether state is per-caller or shared, and how it cleans up.
- A custom hook does not share state between callers unless it uses a shared store/context; each call normally creates independent hook state.

### Effects: external synchronization only

`useEffect` synchronizes React with an external system: DOM APIs, timers, network subscriptions, browser events, third-party widgets. If there is no external system, the Effect is likely unnecessary.

Before adding an Effect, ask:

1. Can the value be calculated from props/state during render? If so, calculate it directly; use `useMemo` only after measurement proves it expensive.
2. Is it a response to a user event (submit, click, select)? Do it in the event handler, not an Effect watching a state flag.
3. Is state being reset when an identity prop changes? Give the inner component a different `key` so React resets its state tree.
4. Is derived state being copied from props? Store the minimal source of truth; derive the rest.
5. Is this app initialization? Put one-time initialization at the app entry point or use an explicit guard, not an Effect that assumes mount happens once.
6. Is it a subscription to an external store? Use `useSyncExternalStore` instead of a manual Effect + state pair.

When an Effect is needed:

- List every reactive value it reads in its dependency array. Dependencies are determined by the code; do not choose them by preference.
- If adding a function/object dependency creates churn, move creation inside the Effect or lift a stable constant outside the component. Use `useCallback`/`useMemo` only if there is a real identity requirement.
- Cleanup runs before the Effect re-runs with changed dependencies and on unmount. It must undo the setup: unsubscribe, clear timer, abort/ignore request, disconnect observer.
- In Strict Mode development, React runs setup → cleanup → setup to expose bugs. Do not use a `didRun` ref to hide this; make the lifecycle idempotent.
- For request races, abort the request where supported or ignore stale results in cleanup. Prefer router/framework loaders or TanStack Query for ordinary server data fetching.
- Do not use Effects as a state pipeline (`A` updates `B`, then `B` updates `C`). Derive or update related state together in the event.

### Closures and dependencies

- Every render has its own props/state snapshot. An async callback, timer or subscription created in that render closes over that snapshot.
- Include values read by an Effect in the dependency array. For callbacks run later by an external system that must see the latest value without resubscribing, choose deliberately: restructure, keep latest value in a ref updated during commit, or use `useEffectEvent` on React 19.2+ where supported.
- `useEffectEvent` is only callable from an Effect/Effect Event in the same component/custom hook; do not call during render/event handlers or pass it to children. It is intentionally not an Effect dependency. Do not use it to hide a value that should resynchronize the external system.
- Use functional updates when a state update depends on prior state inside a delayed callback: `setCount((count) => count + 1)`.
- `useCallback(fn, deps)` stabilizes a function identity; it does not make the callback see fresh state when dependencies are omitted. Missing dependencies create stale closures.

### Choosing a hook

- **`useState`**: independent UI state with simple updates. Functional updater when based on previous state.
- **`useReducer`**: related state fields and transitions with meaningful named actions, or a reducer that benefits from pure unit tests. Keep reducer pure; do I/O in event handlers/effects, not the reducer.
- **`useRef`**: mutable value that is not rendered (DOM handle, timeout ID, previous committed value). Changing `.current` does not trigger render. Do not read/write refs during render except initialization.
- **`useId`**: stable IDs for accessibility relationships (`aria-describedby`, label/input); not list keys, cache IDs or data IDs.
- **`useSyncExternalStore`**: subscribe to mutable external source (browser API, custom store). `getSnapshot` must return the same reference/value while the store has not changed; cache snapshots for mutable data. Provide `getServerSnapshot` for SSR and make it match the client's initial hydrated snapshot.
- **`useTransition`**: mark state updates as non-urgent so urgent interactions stay responsive; `isPending` indicates transition work. It does not debounce network requests.
- **`useDeferredValue`**: let a slow subtree render an older value while a newer value is pending; it does not prevent extra network requests or replace explicit debouncing.
- Do not reach for `useMemo`/`useCallback` by default. They are performance tools, not correctness tools; profile before optimizing.

### React Compiler

- The React Compiler can automatically memoize component work and values when enabled. Confirm compiler configuration and React DevTools compiler status; do not assume it is enabled just because the project uses React 19.
- With the compiler enabled, avoid adding manual `memo`, `useMemo` or `useCallback` just to prevent ordinary rerenders. Keep existing manual memoization unless a measured, tested cleanup proves it safe; React's guidance warns removal can change compilation output.
- Manual memoization can remain appropriate for explicit external identity contracts (e.g. a callback dependency in an Effect or a library API requirement) and as an escape hatch.
- The compiler relies on the Rules of React. Fix lint/compiler diagnostics rather than masking them. Compiler setup and compatibility depend on toolchain/version; check the project's official React Compiler docs before changing config.

### React 18 / 19 / 19.2 versions

- `use` (reading Context/Promise during render, including conditional calls) is React 19; do not confuse it with a general replacement for `useContext` or data fetching. Promise must be cached/supplied by a Suspense-compatible framework.
- `useEffectEvent` is a React 19.2 API. Older React versions: restructure the Effect; if necessary, use a carefully maintained ref to latest committed callback. Do not import it on React 18/19.0-19.1.
- `useTransition`, `useDeferredValue`, `useSyncExternalStore`, `useId` are available in React 18; some React 18 SSR behavior requires matching server snapshots.

## Anti-patterns

- **Effect to derive state** (`useEffect(() => setFullName(first + last), [first, last])`) — creates an extra render and stale intermediate value — derive `fullName` during render.
- **Effect for a click-triggered POST** — runs because state changed, obscuring causality — submit from the event handler/form Action.
- **Effect dependency suppression** — stale closure or incorrect lifecycle — restructure code to express the actual synchronization.
- **Effect-on-mount ref guard** — breaks Strict Mode diagnostics and may skip legitimate setup — make setup/cleanup repeatable.
- **`useRef` for render state** — mutation does not rerender — use state/reducer.
- **`useMemo` as correctness or state storage** — React may discard memoized values — use state/ref for persistence, derive values normally.
- **`useId` as array key** — IDs are not data identity — use stable domain IDs.
- **Non-cached `getSnapshot()` returning `{...}` on each call** — infinite rerender — cache the snapshot and change it only when store data changes.
- **Manual memoization in compiler-managed code without a measured need** — noise and stale dependencies — rely on compiler for routine memoization, retain only intentional identity contracts.

## Implementation Examples

### External browser subscription with SSR-safe snapshot

```tsx
// src/shared/hooks/useOnlineStatus.ts
import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true; // Must match the initial snapshot used during hydration.
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

For client-only code without SSR, `getServerSnapshot` can be omitted. Do not access `navigator` in the server snapshot.

### Reducer for related state transitions

```tsx
// src/features/search/hooks/useSearch.ts
import { useReducer } from 'react';

type State = { query: string; page: number; submitted: boolean };
type Action =
  | { type: 'queryChanged'; query: string }
  | { type: 'pageChanged'; page: number }
  | { type: 'submitted' }
  | { type: 'reset' };

const initialState: State = { query: '', page: 1, submitted: false };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'queryChanged':
      return { ...state, query: action.query, page: 1, submitted: false };
    case 'pageChanged':
      return { ...state, page: action.page };
    case 'submitted':
      return { ...state, submitted: true };
    case 'reset':
      return initialState;
  }
}

export function useSearch() {
  const [state, dispatch] = useReducer(reducer, initialState);
  return { state, dispatch };
}
```

### Effect that synchronizes an external widget

```tsx
// src/features/map/components/MapCanvas.tsx
import { useEffect, useRef } from 'react';
import { createMap, type MapInstance } from '../lib/map';

export function MapCanvas({ center, zoom }: { center: [number, number]; zoom: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const map = createMap(host);
    mapRef.current = map;
    return () => {
      map.destroy();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setView(center, zoom);
  }, [center, zoom]);

  return <div ref={hostRef} aria-label="Map" />;
}
```

If callers recreate `center` every render, either stabilize the tuple at the caller or depend on scalar latitude/longitude props. Do not omit the dependency to silence the linter.

### Fetch in an Effect without races (when no data library is available)

```tsx
// src/features/users/hooks/useUser.ts
import { useEffect, useState } from 'react';

type User = { id: string; name: string };
type UserState =
  | { status: 'pending' }
  | { status: 'success'; user: User }
  | { status: 'error'; error: Error };

export function useUser(userId: string): UserState {
  const [state, setState] = useState<UserState>({ status: 'pending' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'pending' });
    fetch(`/api/users/${encodeURIComponent(userId)}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<User>;
      })
      .then((user) => setState({ status: 'success', user }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return; // superseded or unmounted
        setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      });
    return () => controller.abort();
  }, [userId]);

  return state;
}
```

If the project has TanStack Query, SWR or router loaders, use them instead: this hook has no caching, deduplication or retry. The `as Promise<User>` trusts the server; validate at the boundary (see `typescript-react`) when the API is not under your control.

### Effect Event for a non-reactive value (React 19.2+)

```tsx
// src/features/chat/hooks/useChatRoom.ts
import { useEffect, useEffectEvent } from 'react';
import { connect } from '../lib/chat';

export function useChatRoom(roomId: string, onMessage: (text: string) => void) {
  // Always calls the latest onMessage without reconnecting when the parent re-renders.
  const handleMessage = useEffectEvent((text: string) => onMessage(text));

  useEffect(() => {
    const connection = connect(roomId);
    connection.on('message', (text: string) => handleMessage(text));
    return () => connection.disconnect();
  }, [roomId]); // Effect Events are not dependencies.
}
```

On React below 19.2, store `onMessage` in a ref updated in a layout/regular Effect and read `ref.current` inside the subscription callback.

## Validation Checklist

- [ ] Every hook is called at the component/custom-hook top level in stable order.
- [ ] No Effect derives render data or handles an interaction that belongs in an event handler.
- [ ] Effects declare all reactive dependencies; cleanup exactly reverses setup.
- [ ] Strict Mode setup → cleanup → setup is safe; unmount removes subscriptions/timers.
- [ ] Async work cannot commit stale results after inputs change/unmount.
- [ ] `useRef` is not used for values that should trigger rendering; `useId` is not a data key.
- [ ] `getSnapshot` is stable until external data changes; SSR snapshot matches hydration.
- [ ] React version supports imported APIs; compiler status verified before changing memoization.
- [ ] Hook lint, type-check and focused lifecycle/race tests pass.

## References

- https://react.dev/learn/you-might-not-need-an-effect
- https://react.dev/reference/react/useEffect
- https://react.dev/reference/react/useSyncExternalStore
- https://react.dev/reference/react/useEffectEvent
- https://react.dev/learn/react-compiler/introduction
