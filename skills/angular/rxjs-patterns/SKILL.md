---
name: rxjs-patterns
description: Compose Angular asynchronous workflows with RxJS operators, lifecycle-safe subscriptions, interop, and stream testing. Use when implementing search, concurrent requests, event streams, Observable state, or debugging subscriptions.
license: MIT
metadata:
  category: angular
  version: "1.0.0"
  frameworks: "Angular 17+; RxJS 7"
  last-reviewed: "2026-11-25"
---

# Angular RxJS Patterns

## Purpose

Choose operators by concurrency semantics, handle errors at the correct stream boundary, and tie subscriptions to their owner. Use RxJS for temporal streams and signals for simpler synchronous UI state.

## When to Use

- Building search/autocomplete, request orchestration, websockets, form streams, or event-driven workflows.
- Reviewing RxJS subscriptions, interop, cancellation, or marble-based tests.

Do not use when: only synchronous local state is involved and signals are a clearer fit (see `angular-signals`).

## Workflow

1. **Detect first** — inspect `package.json`/lockfile for Angular and RxJS versions. Identify standalone/NgModule, zoneless/ZoneJS, signals adoption, `@if`/`@for` vs `*ngIf`, `inject()` vs constructor DI, and application/esbuild vs browser/webpack. Match local observable conventions; don't migrate unrelated code.
2. **Version table** —

   | Angular / RxJS | Guidance |
   |---|---|
   | Angular 17 | `takeUntilDestroyed` available, developer preview until stable in v19; verify minor API status. |
   | Angular 18 | `takeUntilDestroyed` and signal interop still developer preview [VERIFY]. |
   | Angular 19 | `takeUntilDestroyed` stable; signal interop still preview until v20. |
   | Angular 20 | `provideZonelessChangeDetection` stable since 20.2; RxJS operators unchanged. |
   | Angular 21 | Zoneless default for newly generated apps; RxJS 7 supported [VERIFY]. |
   | Angular 22 | RxJS 7 remains Angular-supported; `rxjs@8`/9 are not verified as stable Angular peer dependencies. |

   npm reports RxJS 7.8.2 as latest stable; 9.0.0-beta.1 is prerelease. Angular 22.3.0 declares RxJS `^6.5.3 || ^7.4.0`; use RxJS 7 in recommendations. [VERIFY]
3. **Select operator** — decide what happens to prior/in-flight work before composing the stream:

   | Operator | Concurrency behavior | Use for |
   |---|---|---|
   | `switchMap` | Unsubscribe previous inner stream; newest wins | Search, route-driven reads, latest selection |
   | `mergeMap` | Run inners concurrently | Independent requests, parallel work, bounded concurrency when passed |
   | `concatMap` | Queue and run one at a time | Ordered writes or sequential workflow |
   | `exhaustMap` | Ignore new source values until current inner completes | Prevent duplicate submit/login actions |

4. **Place errors** — catch request failures inside the flattening operator to keep outer interaction streams alive; catch outside only when the whole workflow should terminate/recover.
5. **Own lifetime** — prefer `async` pipe for template consumption; use `takeUntilDestroyed()` for imperative subscriptions. Use `DestroyRef` when teardown needs custom behavior.
6. **Verify** — test cancellation, order, duplicate emissions, errors, destruction, and timing. Use marble tests for operator time semantics; use `fakeAsync` only for Zone-based timer behavior when appropriate.

## Best Practices

- `debounceTime(250)`, normalize/distinct query values, then `switchMap` search requests; stale requests should not overwrite newer results.
- `combineLatest([a$, b$])` waits until each source emits once and recomputes on every later emission; seed sources when initial output is required.
- `forkJoin({a: a$, b: b$})` emits once after every source completes; not for long-lived streams.
- Use `shareReplay({ bufferSize: 1, refCount: true })` for a shared, replayed finite/current request only after considering completion, error reset, cache invalidation, and ref-count disconnect behavior.
- Keep `catchError` within `switchMap`/other inner work when a failed request should not kill the outer input stream.
- Avoid nested `subscribe`; compose with operators or use `async` pipe / signal interop.
- Prefer `async` pipe for template values; it subscribes/unsubscribes with view lifetime and marks the view for updates.
- Use `takeUntilDestroyed()` from `@angular/core/rxjs-interop`; in constructors/injection context it needs no argument. Outside one, pass an injected `DestroyRef`.
- `Subject` is an event channel; `BehaviorSubject` keeps current value and requires an initial value. For new local synchronous state, signals are often simpler. Keep Subjects private, expose `asObservable()`.
- `toSignal()` subscribes immediately and auto-cleans in its injection context; store the result once. `toObservable()` emits signal updates asynchronously after the initial value and can coalesce rapid changes.
- RxJS 7.8.2 is current stable on npm as checked 2026-11-25; Angular 22.3.0 peer dependencies accept RxJS 7, not RxJS 8. Do not recommend RxJS 8 as verified-supported. [VERIFY]
- Preserve cold vs hot semantics; avoid accidental multiple HTTP requests through repeated subscriptions.
- Marble-test complex timing and concurrency. For simple Angular timer tests, use the project's runner and zone mode consistently.

## Anti-patterns

- `switchMap` for writes that must all finish — use `concatMap` or `mergeMap` according to ordering needs.
- `mergeMap` for latest-only search — stale results race; use `switchMap`.
- `exhaustMap` when subsequent inputs must queue — ignored inputs are lost.
- `catchError` outside a long-lived UI interaction stream without recovery — one error ends future interactions.
- `shareReplay(1)` by reflex — omitted ref-count config can keep sources alive; decide cache lifetime explicitly.
- Nested subscriptions — errors and teardown become hard to coordinate.
- Manual `subscribe()` for template state — use `async` pipe or `toSignal`.
- `Subject` as a general-purpose state store without a reason — use a signal or `BehaviorSubject` when a current value is needed.
- Mixing `fakeAsync` timers with Jest/Vitest fake timers without a deliberate bridge — scheduler ownership becomes ambiguous.
- Assuming a source emits synchronously or completes — state these contracts in types/tests.

## Implementation Examples

```ts
// src/app/search/search-results.ts
import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, of, startWith, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SearchApi, SearchResult } from './search-api';

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <input aria-label="Search" [formControl]="query" />
    @for (result of results(); track result.id) { <p>{{ result.label }}</p> }
  `,
})
export class SearchResults {
  private readonly api = inject(SearchApi);
  readonly query = new FormControl('', { nonNullable: true });
  readonly results = signal<readonly SearchResult[]>([]);
  readonly error = signal<string | null>(null);

  constructor() {
    this.query.valueChanges.pipe(
      startWith(this.query.value),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(term => this.api.search(term).pipe(
        catchError(() => {
          this.error.set('Search failed');
          return of<readonly SearchResult[]>([]);
        }),
      )),
    ).pipe(takeUntilDestroyed()).subscribe(items => {
      this.error.set(null);
      this.results.set(items);
    });
  }
}
```

```ts
// src/app/orders/order-submitter.ts
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, exhaustMap } from 'rxjs';
import { OrderApi } from './order-api';

// Provide at component level so DestroyRef is the component's lifetime.
@Injectable()
export class OrderSubmitter {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(OrderApi);

  connect(submitClicks: Observable<void>): void {
    submitClicks.pipe(
      exhaustMap(() => this.api.submit()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }
}
```

### Stream design and lifetime

- `switchMap` cancellation works only when inner Observable teardown aborts its underlying work (Angular HttpClient does); a Promise-backed Observable may merely stop forwarding values.
- `mergeMap(project, concurrency)` can bound concurrency; include a limit for unbounded high-volume sources.
- `concatMap` queues indefinitely if producers outrun consumers; apply backpressure or cap input where this can occur.
- `exhaustMap` ignores source values while active; expose disabled/loading state so the UX matches that behavior.
- `debounceTime` waits for silence and does not emit the pending value until due; `auditTime` and `throttleTime` have different first/trailing semantics.
- `distinctUntilChanged` uses `===` by default; provide a comparator for object-valued form state only when structural comparison is needed.
- `combineLatest` requires one emission from each input. Use `startWith` only when a meaningful initial value exists.
- `forkJoin` requires all inputs to emit and complete; an empty source completes without a combined value; a never-ending source prevents output.
- `shareReplay({bufferSize: 1, refCount: true})` releases a live source when the last subscriber leaves. A completed source may remain replayable; it is not a universal cache invalidation strategy.
- `catchError` belongs inside `switchMap` when each request can fail independently. If placed outside, the resulting replacement stream completes after its own completion unless explicitly resumed.
- RxJS `retry` resubscribes to the source; do not use it on side-effecting cold sources without idempotency protection.
- Do not mutate objects emitted by shared streams; subscribers may share the same reference.
- Keep `Subject` and `BehaviorSubject` private. `asObservable()` prevents consumers from calling `next`, but does not make emitted values immutable.
- `BehaviorSubject` emits its current value synchronously to new subscribers; account for reentrancy if subscription happens during a state update.
- Prefer `AsyncPipe` in templates; its subscription follows view lifetime. In zoneless apps it also participates in Angular scheduling.
- `takeUntilDestroyed` operator should be last when downstream operators might create additional inner subscriptions, so teardown completes the full chain.
- Angular `toSignal` subscribes immediately; create it once in an injection context and reuse the signal.
- `toObservable` reflects stable signal state asynchronously and coalesces intermediate writes; use a Subject or explicit event stream when each interaction must be preserved.
- RxJS 7's object observer form (`subscribe({ next, error, complete })`) is clearer; prefer it for side effects and error handling. Avoid deprecated callback-argument overloads [VERIFY].
- RxJS 8 has no stable release verified in npm as of 2026-11-25; Angular's peer dependency is RxJS 6.5.3 or 7.4+. Never use an RxJS 8 API unless the installed package and official RxJS docs confirm it.

```ts
// src/app/notifications/notification-stream.ts
import { Injectable, inject } from '@angular/core';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, map, shareReplay, Subject } from 'rxjs';

interface Notification { readonly id: string; readonly unread: boolean; }

@Injectable({ providedIn: 'root' })
export class NotificationStream {
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshRequested = new Subject<void>();
  readonly unreadCount$ = this.refreshRequested.pipe(
    filter(() => true),
    map(() => 0), // Replace with API composition owned by this service.
    shareReplay({ bufferSize: 1, refCount: true }),
    takeUntilDestroyed(this.destroyRef),
  );

  refresh(): void {
    this.refreshRequested.next();
  }
}
```

### Testing and operator selection

- For debounced search, test that no request occurs before the debounce window, the latest query wins, and prior HttpClient requests are canceled when superseded.
- Operator selection is based on source emission semantics; flattening operators do not make a hot source cold or guarantee server cancellation.
- `switchMap` unsubscribes previous inner subscriptions, but the server may already have processed a request; never use it as write rollback.
- `mergeMap` supports concurrency limits; unconstrained concurrency can overload browser connections or backend rate limits.
- `concatMap` preserves order but can build an unbounded queue; consider disabling producer or dropping obsolete values upstream.
- `exhaustMap` prevents duplicate execution while active, but silently discards later emissions; show pending state or disable the triggering UI.
- `combineLatest` recomputes from latest values; use `withLatestFrom` when only a primary source should trigger output.
- `forkJoin` is appropriate for finite completion barriers; use `combineLatest` or `combineLatestWith` for live values.
- `shareReplay` is not equivalent to a permanent cache. Cache invalidation requires explicit keying, expiry, or a refresh trigger.
- `shareReplay({bufferSize: 1, refCount: true})` can disconnect a source when subscriber count reaches zero; ensure that reconnecting is expected.
- Keep errors as errors when callers need failure semantics; `catchError(() => of([]))` is a product fallback, not generic error handling.
- Use discriminated result types or separate status streams when the UI distinguishes loading, success, empty, and error states.
- Avoid `tap` for state transformation; keep `map` pure and `tap` for deliberate side effects only.
- Do not throw from `tap` for ordinary failures; use `throwError`/`catchError` so the Observable contract is explicit.
- `finalize` runs on completion, error, or unsubscribe; it is appropriate for cleanup but should not assume success.
- `firstValueFrom` rejects if source completes empty unless a default is provided; `lastValueFrom` waits for completion and hangs on infinite sources.
- Avoid converting infinite streams to Promises without an explicit `take`, timeout, or completion guarantee.
- In RxJS 7, use `subscribe({next, error, complete})`; callback overloads may remain accepted but should not be introduced [VERIFY].
- RxJS marble tests use `TestScheduler.run()` virtual time; keep assertions inside the run callback and avoid mixing wall-clock timers into marble tests.
- `fakeAsync`/`tick` requires ZoneJS test environment; zoneless tests should use async test utilities, controlled Observables, or runner fake timers.
- `HttpTestingController` can assert request cancellation and response order in Angular tests; marble tests are better for pure operator pipelines.
- `takeUntilDestroyed` completes the full subscription when the owner is destroyed; pass `DestroyRef` if creating pipeline outside injection context.
- Use `async` pipe if a stream is consumed only by a template; avoid extra subscription plus `async` subscription to same cold source.
- `toSignal` creates one subscription per call and immediately subscribes; convert once and reuse.
- If `toSignal` needs a synchronous initial value, only set `requireSync: true` when source guarantees it; otherwise use an explicit `initialValue`.
- A BehaviorSubject requires an initial value and emits it synchronously; don't use `null` as a placeholder if null is valid data without a separate state type.
- Subject events are not replayed; late subscribers miss past notifications. Choose `ReplaySubject` only when replay window and retention are explicit.
- `BehaviorSubject.value` exposes mutable current references; avoid mutating nested state after emission.
- Keep subjects private and expose Observable interfaces; use a signal for directly writable synchronous state.
- RxJS 8 stable availability is not confirmed in npm as of review; verify release and Angular peer support before using it [VERIFY]. Angular 22.3 peer range is `^6.5.3 || ^7.4.0`.

## Validation Checklist

- [ ] Confirmed Angular/RxJS versions and project scheduling/testing conventions.
- [ ] Operator matches required cancellation, concurrency, ordering, or duplicate-submit semantics.
- [ ] Errors are handled at the intended stream boundary.
- [ ] Subscriptions are view-owned or explicitly tied to `DestroyRef`.
- [ ] Shared streams have deliberate replay, ref-count, and cache lifetime.
- [ ] Tests cover ordering, cancellation, errors, completion, and teardown.
