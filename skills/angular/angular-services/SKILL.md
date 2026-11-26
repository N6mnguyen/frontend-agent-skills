---
name: angular-services
description: Design Angular injectable services, DI scopes, typed configuration tokens, and signal-backed state. Use when adding shared logic, application state, configuration providers, or choosing service lifetime.
license: MIT
metadata:
  category: angular
  version: "1.0.0"
  frameworks: "Angular 17+"
  last-reviewed: "2026-11-25"
---

# Angular Services

## Purpose

Use services for reusable behavior, application state, and boundaries to external systems. Make injection scope and lifetime explicit; preserve constructor-injection and NgModule conventions in existing projects.

## When to Use

- Creating a service, facade, API abstraction, state holder, or configurable dependency.
- Deciding between root, route, component, or module provider scope.

Do not use when: the task is only HTTP pipeline configuration (see `angular-http`) or application directory layout (see `angular-architecture`).

## Workflow

1. **Detect first** — inspect `package.json` Angular version and existing service style. Identify standalone/NgModule, zoneless/ZoneJS, signals adoption, built-in control flow vs structural directives, `inject()` vs constructor DI, and `application`/esbuild vs `browser`/webpack. Check root and route/component providers. Follow conventions; no migration by default.
2. **Version matrix** —

   | Angular | Service considerations |
   |---|---|
   | 17 | `inject()` and `@Injectable({providedIn: 'root'})` available; use `@Injectable` for compatible code. |
   | 18 | Both standalone and NgModule DI patterns supported; retain constructor DI where established. |
   | 19 | Standalone default for new declarations does not require converting service registrations. |
   | 20 | `provideZonelessChangeDetection()` stable in 20.2; service scope unchanged. |
   | 21 | Zoneless is default in new apps; existing services work without migration. |
   | 22 | `@Service()` is documented modern shorthand for root singletons using `inject()`; don't assume available before v22. [VERIFY] |

3. **Choose lifetime** — root for app-wide shared singleton; route providers for route-tree lifetime; component providers for per-component subtree. Module providers only in legacy module conventions.
4. **Choose API** — `@Injectable({providedIn: 'root'})` is the broadly compatible option and supports constructor DI. In v22, `@Service()` may be used for new root singleton classes that use `inject()`; use `@Injectable` for constructor DI and advanced provider configuration.
5. **Implement** — keep service cohesive and typed. Signal state should have private writable signals and public read-only views. Introduce a facade only to coordinate multiple dependencies or simplify a real consumer boundary.
6. **Verify** — test behavior and provider identity at intended scope; run type-check and project tests.

## Best Practices

- Use `@Injectable({ providedIn: 'root' })` for widely compatible tree-shakable app-wide services; Angular 22's `@Service()` is a newer shorthand documented for `inject()`-based singleton classes. [VERIFY]
- `inject()` works in constructors/field initializers and other injection contexts; don't call it arbitrarily in later methods unless an explicit injector context is established.
- Use constructor DI where project code relies on it; do not rewrite services solely for syntax uniformity.
- Root service is one instance per root injector. `Route.providers` scopes feature services to route injector. Component `providers` creates instances for each component subtree; component destruction ends that instance's lifetime.
- A provider in multiple scopes can shadow an ancestor instance. Place stateful services at the narrowest scope that should share state.
- Define `InjectionToken<T>` for runtime values or interface-typed configuration; interfaces do not exist at runtime. Provide validated configuration rather than scattering environment reads.
- Signal-backed state: keep writable signal private; expose `.asReadonly()`; return immutable updates for object/array state.
- A facade is useful when it coordinates multiple repositories/services or provides a stable UI-oriented API. Avoid one-service-per-verb wrappers.
- Keep services focused on one coherent capability (domain state, API access, platform integration); UI presentation remains in components.
- Generic CRUD/base services often erase domain-specific query, error, and authorization behavior. Use one only when operations and contracts are genuinely shared.
- In v22, `@Service()` auto-provides a root singleton by default; `@Service({autoProvided: false})` requires manual registration for route/component scope. It supports `inject()` only, not constructor parameter injection [VERIFY].
- `@Injectable` continues to support advanced provider keys and non-root scopes; choose it when those are required.

## Anti-patterns

- Providing a root state service again in a component by accident — creates shadow state.
- Adding `providedIn: 'root'` to transient UI state that must reset with a route/component.
- Reading runtime config from global variables across many services — define one typed token/config provider.
- Generic abstract CRUD service with many hooks but one concrete consumer — keep the implementation explicit.
- Facade that merely forwards every method unchanged — inject the dependencies directly until coordination is useful.
- Exposing writable signals publicly — callers can bypass invariants.
- Using `@Service()` with constructor parameter injection — the documented decorator supports only `inject()` [VERIFY].
- Testing only class methods when provider scope and instance identity are part of the requirement.

## Implementation Examples

```ts
// src/app/config/api-config.ts
import { InjectionToken } from '@angular/core';

export interface ApiConfig {
  readonly baseUrl: string;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG');
```

```ts
// src/app/cart/cart-state.service.ts
import { Injectable, computed, signal } from '@angular/core';

export interface CartLine {
  readonly sku: string;
  readonly quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CartStateService {
  private readonly _lines = signal<readonly CartLine[]>([]);
  readonly lines = this._lines.asReadonly();
  readonly totalItems = computed(() => this.lines().reduce((sum, line) => sum + line.quantity, 0));

  add(sku: string): void {
    this._lines.update(lines => {
      const current = lines.find(line => line.sku === sku);
      return current
        ? lines.map(line => line.sku === sku ? { ...line, quantity: line.quantity + 1 } : line)
        : [...lines, { sku, quantity: 1 }];
    });
  }
}
```

```ts
// src/app/reports/report.routes.ts (route lifetime)
import { Routes } from '@angular/router';
import { ReportSession } from './report-session.service';

export const REPORT_ROUTES: Routes = [
  {
    path: '',
    providers: [ReportSession],
    loadComponent: () => import('./report.page').then(m => m.ReportPage),
  },
];
```

### Service boundaries and provider behavior

- A service instance is singleton per injector, not necessarily singleton process-wide: tests, microfrontends, and child injectors can create separate instances.
- `providedIn: 'root'` means application-root scope and tree-shakable registration; `providedIn: 'platform'` shares across apps on one platform and is not a normal app-state default.
- `providedIn: 'any'` is deprecated in Angular; don't introduce it for lazy-module instance semantics [VERIFY]. Use route providers when the route boundary is explicit.
- A service with `providedIn: 'root'` can still be overridden by a component or route provider; document the override when it is a deliberate test/feature seam.
- Route injector services are available to child routes and route components; component-scoped services are destroyed with that component injector.
- `DestroyRef` injected in a service follows the injector lifetime. A root service's cleanup does not run when a consuming component disappears.
- Avoid caching a component's `DestroyRef` in root scope; scope the service to the owner or pass an explicit lifecycle handle to an operation.
- Use `InjectionToken<T>` for interfaces, primitives, runtime options, or multi-provider extension points. Give tokens clear descriptions and defaults only when safe.
- Injection tokens with factory providers can use `inject()` in the token factory's injection context; do not hide expensive async startup work in a synchronous factory.
- Use `multi: true` only for composable lists (plugins, handlers, interceptors); single-value config tokens should have one provider unless override is deliberate.
- Validate external configuration once at the boundary; downstream services should receive a normalized typed configuration.
- Do not expose environment-specific objects to every service if only one API client needs them; inject config at the boundary that consumes it.
- Keep service methods explicit about errors and cancellation. Return `Observable<T>` for stream composition; return `Promise<T>` only when project APIs naturally use Promises.
- For HTTP services, use typed DTOs and encode path identifiers; centralize transport conventions in the HTTP layer.
- Signal state in a service should expose selectors/computed read-only signals, not public mutable collections or writable signals.
- `asReadonly()` is shallow; protect nested records through immutable updates or readonly domain types.
- Avoid effects inside a service constructor unless syncing with an imperative system is necessary; they persist for the service injector lifetime.
- Use `@Service()` only when targeting Angular 22+ and following its `inject()`-only model; verify new decorators in the actual installed version [VERIFY].
- Angular 22 `@Service({autoProvided: false})` requires explicit `providers: [MyService]`; provider scope remains hierarchical DI, not a special service cache.
- `@Injectable` remains preferred for cross-version libraries and services requiring constructor DI, `providedIn` options, or advanced provider metadata.
- Unit tests can instantiate a service directly for pure logic; use TestBed when validating DI tokens, injector scope, effects, or teardown.
- `TestBed.inject()` returns the current test injector's instance; configure providers before injection and reset between tests where state leaks.
- A facade should coordinate meaningful dependencies or derive a view model; it should not duplicate domain logic owned by a repository.
- Generic service bases are appropriate only when real implementations share a stable operation contract and behavior; keep concrete API methods explicit otherwise.
- Keep service classes free of component imports and DOM assumptions; inject platform abstractions for browser-specific work.

### Token, state, and lifetime details

- Do not conflate provider registration with service construction; an injectable class can be constructed manually but bypasses DI lifecycle and dependencies.
- Root-provided services are lazy-instantiated when first requested; avoid expensive side effects in constructors.
- Keep constructors/field initializers limited to synchronous dependency setup. Expose explicit methods for work that can fail or require user action.
- Constructor DI provides visible dependency lists; `inject()` works well for field initializers and functional providers. Prefer the repository's established style.
- `inject()` requires an active injection context; methods called later from event handlers cannot call it unless wrapped in a valid `runInInjectionContext` with an injector.
- `@Injectable({providedIn: 'root'})` services can be tree-shaken when no reachable code injects them; avoid root providers for things that must always initialize unless an initializer explicitly injects them.
- In Angular 22, `@Service()` is for root singleton services using `inject()`; do not use it in Angular 17–21 examples without checking package declarations.
- `@Service({autoProvided: false})` opts out of automatic root registration. Add the class to the intended route/component/module provider list.
- `@Service` does not support constructor parameter injection or all advanced provider keys; `@Injectable` remains necessary for those cases.
- A service with component scope can be shared by descendants but not sibling component instances unless provided by their common ancestor.
- `viewProviders` differs from `providers`: projected content does not see view-only providers. Use the latter only when projection isolation is intended.
- Route providers should be declared at the highest route that owns shared state; child routes can resolve parent route providers.
- Do not use `providedIn: 'any'` to approximate route scope; use explicit route providers and verify version support/deprecation.
- A service injected from a lazy route may be retained by router route reuse; do not assume every navigation destroys it immediately.
- For unit tests of state logic, avoid TestBed when direct construction is sufficient; use TestBed for DI, effects, and scoped providers.
- Test service identity via `TestBed.inject()` at root and component fixture injectors to catch accidental duplicate providers.
- Signal service selectors should be readonly and stable references; computed values are lazy and update from their dependencies.
- Avoid deep mutable service state; updates should replace arrays/records so signal equality can detect changes.
- Do not expose an internal `Subject` directly; consumers could emit values and bypass validation.
- Facades should aggregate existing APIs and expose use-case methods, not become a second home for business rules.
- A repository/API service should own transport and serialization; a state service should own cache/state; avoid mixing both without a cohesive use case.
- A generic CRUD abstraction should preserve typed resource-specific methods and error contracts. If consumers need many overrides, remove the base abstraction.
- Configuration providers are runtime dependencies, not secret storage; browser bundles expose values regardless of token visibility.
- Validate URL configuration (scheme/host/path) when it comes from a runtime source; do not concatenate untrusted input into API origins.
- Services using browser APIs should be SSR-safe: inject `DOCUMENT`/platform identity where appropriate and guard globals.

## Validation Checklist

- [ ] Confirmed Angular version, DI style, standalone/module mode, and provider placement.
- [ ] Chosen service lifetime matches intended shared state and teardown.
- [ ] Runtime config uses a typed token and contains no client-side secrets.
- [ ] Public state is read-only; mutations preserve service invariants.
- [ ] Facade or abstraction has multiple real responsibilities/consumers.
- [ ] Tests verify scoped instance identity and destruction where relevant.
