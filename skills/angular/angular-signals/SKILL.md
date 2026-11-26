---
name: angular-signals
description: Model Angular reactive state with signals, computed values, effects, resources, RxJS interop, queries, and zoneless change detection. Use when adding signal state, replacing reactive state patterns, or working with Angular resource APIs.
license: MIT
metadata:
  category: angular
  version: "1.0.0"
  frameworks: "Angular 17+"
  last-reviewed: "2026-11-25"
---

# Angular Signals

## Purpose

Use signals for synchronous reactive state, derived values, and template integration. Keep RxJS for stream semantics; bridge intentionally. Resource APIs are version-sensitive and resources remain experimental through Angular 21.

## When to Use

- Modeling component/service state with `signal`, `computed`, `linkedSignal`, or signal queries.
- Connecting Observables to signal-based UI, using async resources, effects, or zoneless change detection.

Do not use when: the task is chiefly operator selection or stream composition (see `rxjs-patterns`).

## Workflow

1. **Detect first** — inspect `package.json` for `@angular/core` and RxJS. Check whether the app uses standalone or NgModule, zoneless or `zone.js`, signal adoption, built-in `@if`/`@for` or `*ngIf`, `inject()` or constructor DI, `application`/esbuild or `browser`/webpack. Check version-specific API availability and stability. Preserve existing architecture.
2. **Version matrix** —

   | Angular | Signals and reactivity |
   |---|---|
   | 17 | Core signals stable; `input()` introduced in 17.1, `model()` in 17.2, `output()` in 17.3 as preview APIs; signal queries introduced 17.2. |
   | 18 | Signal inputs/outputs/queries remain preview; `resource`/`rxResource` experimental. |
   | 19 | Signal inputs/outputs/queries stable; `linkedSignal` introduced as preview; `effect` execution timing changed; resources experimental. |
   | 20 | `linkedSignal` stable; `effect`, `toSignal`, and `toObservable` stable; zoneless provider stable in 20.2. Resources remain experimental. |
   | 21 | Zoneless default in new apps; resources still experimental. |
   | 22 | `resource`, `rxResource`, and `httpResource` stable since v22.0. `debounced()` experimental. |

3. **Choose primitive** — `signal` for writable state, `computed` for pure derived state, `linkedSignal` for derived state that can be locally reset/edited. Do not use an effect to propagate state.
4. **Handle async** — use RxJS when cancellation, multi-value streams, operator composition, or event timing matters. Resource APIs suit one reactive request/read; preserve experimental markers below v22.
5. **Integrate** — convert at the UI/service boundary with `toSignal` or `toObservable`; account for initial values, error behavior, completion, and ownership of subscriptions.
6. **Verify** — test derived dependencies, unsubscription/cancellation, resource loading/error states, effect cleanup, and zone-free update scheduling if used.

## Best Practices

- Import `signal`, `computed`, `effect`, `linkedSignal`, `untracked`, `resource` from `@angular/core`.
- Expose writable state narrowly: `private readonly _count = signal(0); readonly count = this._count.asReadonly();`. Readonly signals do not prevent deep mutation of object values.
- Use `computed()` for values derived solely from signals; computations are lazy and memoized.
- Use `linkedSignal()` when dependent state needs a writable value that resets or recomputes when a source changes; use `computed()` for read-only derivation.
- Use `untracked()` to read a signal without making it a dependency of the surrounding reactive computation; do not hide real dependencies.
- Effects are for side effects with imperative/non-signal systems (logging, storage synchronization, third-party APIs), not state propagation. Use `onCleanup` to cancel timers or abort work.
- `effect()` needs an injection context or explicit injector. Component/view effects and root effects have different scheduling/lifetime; consult current API docs when ordering is material.
- Effect scheduling changed in v19; tests must trigger synchronization according to the installed version. Do not rely on microtask timing from pre-v19 behavior.
- `resource()` was introduced as experimental in v19.0; remains experimental through v21. In v22 it is stable. v19 uses `request` and `loader`; current docs use `params` and `loader`. The loader receives `{params, previous, abortSignal}`. [VERIFY]
- Resources cancel outstanding loading when parameters change. Avoid resource for mutations; cancellation may abort side effects unexpectedly.
- In v22 `rxResource()` is stable (`@angular/core/rxjs-interop`) and uses `params` plus an RxJS `stream` returning an Observable; it is not a `loader` property. [VERIFY]
- `httpResource()` is stable since v22.0 (`@angular/common/http`); it is eager, uses HttpClient, and suits reads, not POST/PUT mutations. Earlier it was experimental (v19.2+). [VERIFY]
- Resource `value()` may throw in error status; check `hasValue()`/`status()` or handle errors explicitly before reading.
- `toSignal()` subscribes immediately, auto-unsubscribes with its injection context, and throws Observable errors on signal read. Reuse one conversion; provide `initialValue` or `requireSync` when contract warrants it.
- `toObservable()` uses an effect: initial available value may emit synchronously; later updates are asynchronous and may coalesce to the latest value.
- Use `viewChild()`/`contentChild()` signal queries where supported (stable since v19); retain decorators if the existing code and version use them.
- Zoneless: use `provideZonelessChangeDetection()` from `@angular/core`; stable since v20.2, default for newly generated apps v21+ [VERIFY]. Existing ZoneJS apps do not need to migrate.
- `debounced(signal, duration)` is an experimental Angular 22 API; do not use in stable-library contracts without an explicit opt-in [VERIFY].

## Anti-patterns

- Copying one signal into another in `effect()` — use `computed`, `linkedSignal`, or move source-of-truth ownership.
- Creating `toSignal()` repeatedly for the same Observable — each call creates a subscription.
- Calling `toSignal()` outside an injection context without passing an `Injector` — fails at runtime.
- Treating `asReadonly()` as deep immutability — nested objects remain mutable.
- Reading resource `value()` without considering error/idle states — can throw or be undefined.
- Using resources for writes/mutations or long-lived event streams — use HttpClient/RxJS command flows.
- Converting every Observable to a signal — keep stream operators and cancellation in RxJS where they fit.
- Using `effect()` to read/write DOM before render — use render hooks or native observers for DOM lifecycle needs.
- Assuming Angular 18+ effects have pre-v19 scheduling — effect timing is version-sensitive.

## Implementation Examples

```ts
// src/app/cart/cart-state.service.ts
import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CartState {
  private readonly _items = signal<readonly { id: string; quantity: number }[]>([]);
  readonly items = this._items.asReadonly();
  readonly itemCount = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));

  add(id: string): void {
    this._items.update(items => {
      const existing = items.find(item => item.id === id);
      return existing
        ? items.map(item => item.id === id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...items, { id, quantity: 1 }];
    });
  }
}
```

```ts
// src/app/search/search-state.ts (Angular 22 experimental debounced API)
import { debounced, signal } from '@angular/core';

export class SearchState {
  readonly query = signal('');
  readonly settledQuery = debounced(this.query, 250);
}
```

```ts
// src/app/users/user-search.ts (RxJS interop)
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserApi } from './user-api';

@Component({ selector: 'app-user-search', template: '{{ users().length }} users' })
export class UserSearch {
  private readonly api = inject(UserApi);
  readonly users = toSignal(this.api.users$, { initialValue: [] });
}
```

### Signals and reactive contexts

- Signal reads inside a `computed` or `effect` establish dependencies; reads inside `untracked(() => ...)` do not.
- Computed derivations should be pure. Do not set other signals from a `computed` function.
- Signals use referential equality by default; supply an equality function only when the value contract justifies its cost.
- `asReadonly()` hides `set`/`update`, not mutation of nested references. Prefer immutable object/array replacement or deeply immutable domain types.
- A `linkedSignal` can use source and computation form when it needs the previous source/value to preserve or reset local selection. Simple derivation should remain `computed`.
- `effect` tracks synchronous reads only; async continuation reads should not be assumed dependencies. Capture needed values before scheduling work.
- Cleanup callback passed to `effect(onCleanup => ...)` runs before rerun and on destruction; cancel timers, listeners, and abortable requests there.
- Component effects run during Angular synchronization; root effects run as microtasks in documented versions. Avoid using effect ordering as a synchronization contract.
- DOM reads/writes after Angular renders belong in `afterRenderEffect` where supported. Use `ResizeObserver`, `IntersectionObserver`, or `MutationObserver` for corresponding browser events.
- `afterRenderEffect` is client-only and does not guarantee hydration is complete; guard browser globals in SSR code.
- For `toSignal`, `initialValue` determines pre-first-emission value; `requireSync: true` is valid only for Observables guaranteed to emit synchronously (for example BehaviorSubject).
- `toSignal` throws source errors when read; map errors before conversion or render an explicit error state. It retains last value on completion.
- `toObservable(signal)` uses an effect and ReplaySubject; later values are asynchronous and rapid changes may collapse to the latest value. Don't use it when every intermediate signal write must become an event.
- `takeUntilDestroyed()` is the right bridge for imperative RxJS subscriptions; it needs an injection context or explicit `DestroyRef`.
- Signal queries such as `viewChild.required()` and `contentChild()` return signals reflecting view changes; use decorator queries in older projects or when that API is already established.
- `resource` status includes `idle`, `loading`, `reloading`, `resolved`, `error`, and `local`; `value()` may throw in error status, so guard with `hasValue()`.
- Resource `params` is a reactive computation; if absent/undefined the loader does not run. `abortSignal` supports fetch cancellation; loader work must honor it.
- v19 resource options called the request computation `request`; current v22 calls it `params`. `rxResource`'s stream option is `stream`, not `loader` [VERIFY].
- `httpResource` is eager and automatically uses HttpClient; interceptors apply. Its `value` is a resource, not an Observable.
- Debounced signals v22 API takes a source signal and duration, e.g. `debounced(query, 250)`; still experimental, prefer RxJS `debounceTime` in stable library APIs.
- Zoneless notifications include signal writes read in templates, `markForCheck`, `ComponentRef.setInput`, and bound event listeners; arbitrary external callbacks should notify Angular (for example update a signal or call `markForCheck`).
- Avoid removing ZoneJS/polyfills in a partial migration; test setup, third-party libraries, and SSR must be aligned before changing scheduling mode.

```ts
// src/app/search/search-results.ts (Angular 22 resource read)
import { Component, computed, input, resource } from '@angular/core';

interface SearchResult { readonly id: string; readonly label: string; }

@Component({ selector: 'app-search-results', template: '' })
export class SearchResults {
  readonly query = input.required<string>();
  readonly results = resource({
    params: () => this.query().trim() || undefined,
    loader: async ({ params, abortSignal }) => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(params)}`, { signal: abortSignal });
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      return await response.json() as readonly SearchResult[];
    },
  });
  readonly count = computed(() => this.results.hasValue() ? this.results.value().length : 0);
}
```

### Signal interop and async state checks

- A writable signal's `update()` callback should be pure with respect to external state; return the next value rather than mutate the current value.
- Use `asReadonly()` to prevent external `.set()`/`.update()` calls, but use readonly domain types or copy-on-write to prevent nested mutation.
- A computed signal recalculates lazily when read after dependency invalidation; don't use it for side effects or to trigger requests.
- Equality functions can reduce downstream invalidation but may cost more than recomputation; measure before adding deep equality.
- `untracked` is useful for logging/context reads inside effects; never use it to suppress a dependency that should cause rerendering.
- Effects run at least once and rerun when tracked dependencies change; effect callbacks that access different conditional signals have dynamic dependencies.
- Effect cleanup runs before a new effect execution and on effect destruction; manual cleanup disables normal automatic disposal and requires explicit destroy.
- In Angular 19, effects triggered outside change detection changed from microtask behavior; tests that depended on exact flush sequence need version-specific synchronization.
- `allowSignalWrites` on `effect` became a no-op as writes became allowed; omit it in current code [VERIFY].
- Prefer `computed` over a cached mutable signal for a derived total/filter. Use `linkedSignal` only when a user can edit/reset a derived selection.
- `linkedSignal({source, computation})` receives prior `{source, value}` when available; handle missing previous state and source replacement explicitly.
- Resource parameter computations should return a stable, serializable request shape; avoid allocating unrelated mutable objects that retrigger work.
- Resource loader should pass `abortSignal` to `fetch` or other cancelable primitives and must not ignore cancellation for expensive reads.
- Resource loader errors are stored in resource state; `value()` can throw after an error. Render an error branch before reading it.
- `reload()` exists on writable resource refs; plain resource consumers may not have writable methods. Check current type to avoid relying on removed methods.
- `httpResource` is eagerly started and must not be used for mutations. Its `parse` callback can validate/transform untrusted response payloads when appropriate.
- `rxResource` stream must emit a value or error; an Observable that completes without an emission can throw. Provide a deliberate fallback where empty completion is possible.
- `toSignal` subscribes immediately, so avoid constructing it in a loop or getter. Store it in a field with injector lifetime matching intended subscription.
- If Observable emits synchronously, `requireSync: true` removes `undefined`; use it only for a guaranteed synchronous source.
- When combining `initialValue` with nullable emissions, the signal type must include both possibilities; don't cast away `undefined` without a contract.
- Observable errors from `toSignal` are rethrown on reads. Convert to a discriminated `{data, error, loading}` signal when the view needs recoverable state.
- `toObservable` emits only after reactive stabilization for later updates; use `Subject` for discrete actions that must never coalesce.
- `toSignal`/`toObservable` interop lives in `@angular/core/rxjs-interop`; `takeUntilDestroyed` is also there.
- Signal query `viewChild.required<T>(selector)` throws if no match exists at read time; use optional query where conditional templates may omit the child.
- Content/view query values can change as embedded views are inserted; derive from query signals instead of caching one-time values.
- Zoneless apps need notification from external library callbacks. Update a template-read signal, use `markForCheck`, or use a documented Angular API.
- `provideZonelessChangeDetection()` is stable since Angular 20.2; older v20 releases used the experimental name. Do not copy the old provider name into 20.2+.
- Zoneless is default only for new generated apps in v21+; existing ZoneJS apps still work and should not be migrated implicitly.
- Remove `zone.js` from build/test polyfills only after checking third-party dependencies, test setup, and SSR behavior. Changing scheduling is an app-level migration.
- Debounced signal APIs are experimental in v22. Use RxJS `debounceTime` for cross-version libraries or when stream cancellation/composition is needed.

## Validation Checklist

- [ ] Confirmed installed Angular and RxJS versions, project modes, and feature adoption.
- [ ] Chosen `signal`/`computed`/`linkedSignal`/RxJS/resource for appropriate semantics.
- [ ] Checked API stability and names against that version.
- [ ] Effects perform external side effects only; cleanup and injection context are explicit.
- [ ] Observable errors, initial value, completion, and subscription lifetime are handled.
- [ ] Resource pending, error, empty, and cancellation states are handled.
- [ ] Zoneless behavior is intentionally configured, not imposed as migration.
