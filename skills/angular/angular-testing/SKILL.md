---
name: angular-testing
description: Write and fix Angular unit, component, HTTP, router and e2e tests with the project's existing runner (Vitest, Jest via jest-preset-angular, or Karma/Jasmine), TestBed with standalone components, HttpTestingController, Angular Testing Library, CDK component harnesses, zoneless-friendly async, signal inputs and Playwright. Use when adding or debugging Angular tests, choosing a runner, or testing components, services, guards, interceptors or routes.
license: MIT
metadata:
  category: angular
  version: "1.0.0"
  frameworks: "angular 17+, @testing-library/angular 17+, jest-preset-angular 14+, vitest 3+, @playwright/test 1.4x+"
  last-reviewed: "2026-11-25"
---

# Angular Testing

## Purpose

Write tests that check what users and callers observe, in whatever runner the repo already uses, with async handling that works under both zone-based and zoneless change detection. Good tests: query by role/label, mock at the HTTP or service boundary, verify no outstanding requests, and avoid `setTimeout` sleeps.

## When to Use

- Adding tests for a component, service, pipe, directive, guard, resolver, or interceptor.
- Fixing flaky or failing Angular tests after an upgrade (zoneless, OnPush default, signal inputs).
- Testing HTTP calls, routing, or Material/CDK widgets.
- Adding Playwright end-to-end coverage for an Angular app.

Do not use when: the task is framework-agnostic test strategy (see the `frontend-testing` skill) or React testing (see `react-testing`).

## Workflow

1. **Detect the runner — never switch it as part of another task.**
   - `angular.json` → `test.builder`:
     - `@angular/build:unit-test` → Vitest by default (`runner` option may set `karma`). Default for new projects in current CLI; earliest version where this became default not verified [VERIFY: believed v21].
     - `@angular-devkit/build-angular:karma` or `@angular/build:karma` → Karma + Jasmine. Karma is still supported per current docs.
     - `@angular-builders/jest` or a `jest.config.*` + `jest-preset-angular` → Jest.
   - `package.json` devDependencies confirm (`vitest`, `jsdom`, `jest`, `jest-preset-angular`, `karma`, `jasmine-core`, `@testing-library/angular`, `@playwright/test`).
   - Spec style: `describe/it/expect` are similar across runners; spies differ (`vi.fn()` / `jest.fn()` / `jasmine.createSpy()`). Copy the style of neighbouring specs.
2. **Detect app features affecting tests.**
   - Zoneless: TestBed runs zoneless by default on current versions even if `zone.js` is in polyfills. Zone-based tests add `provideZoneChangeDetection()` to TestBed providers.
   - Standalone vs NgModule: standalone components go in `imports`; NgModule components need their module imported or `declarations`.
   - Signal inputs (`input()`): set with `fixture.componentRef.setInput()`, never by assigning the property.
   - v22 OnPush default: direct field mutation followed by `detectChanges()` won't re-render an OnPush view; drive through inputs/signals.
3. **Version notes.**
   - `provideHttpClientTesting()`: v15+; `HttpClientTestingModule` is legacy.
   - `RouterTestingHarness`: v15.2+; `RouterTestingModule` is legacy, use `provideRouter`.
   - `@testing-library/angular` 19.x targets Angular 21-22; Angular 17-20 use 17.x (and 18.x on 20). Options `componentInputs`/`componentOutputs`/`componentProperties` are deprecated — use `inputs`/`on`.
   - `fakeAsync`/`tick` need Zone.js. With Vitest, add `zone.js/plugins/vitest-patch` to test polyfills; docs recommend native `async` + Vitest fake timers instead.
   - `jest-preset-angular` setup: `setupZoneTestEnv()` from `jest-preset-angular/setup-env/zone`; zoneless variant `setupZonelessTestEnv()` [VERIFY path].
4. **Write the test** using the patterns below.
5. **Run** the narrowest command first (`ng test --include src/app/orders/**` for the unit-test builder, `npx jest path`, or the repo's script), then the full suite and lint.

## Best Practices

- Test behavior through the DOM or public API; avoid asserting private fields or calling lifecycle hooks manually.
- Query by role, label, or text (Testing Library `screen.getByRole`, or `fixture.nativeElement.querySelector('[aria-label=…]')`); use `data-testid` only when nothing semantic exists.
- Prefer `await fixture.whenStable()` after triggering async work; it is the zoneless-compatible way to wait. Keep existing `detectChanges()` calls in older suites — no need to rewrite them.
- HTTP: `provideHttpClient()` then `provideHttpClientTesting()` (order matters); `expectOne({ method, url })`, `flush(body)` or `flush(err, { status: 500, statusText: 'Error' })`; `httpTesting.verify()` in `afterEach`.
- Test interceptors by registering them with `provideHttpClient(withInterceptors([fn]))` in the test and asserting on `req.request.headers`.
- Mock dependencies via providers: `{ provide: OrdersApi, useValue: fake }` with a typed fake (`Partial<OrdersApi>` cast once) rather than a heavy spy framework.
- Functional guards/resolvers: call inside `TestBed.runInInjectionContext(() => guard(route, state))`.
- Router: `RouterTestingHarness.create()` + `navigateByUrl('/x', Component)`; assert on rendered content and `TestBed.inject(Router).url`.
- Material/CDK widgets: use harnesses (`TestbedHarnessEnvironment.loader(fixture)`, `MatButtonHarness`, `MatSelectHarness`); use `documentRootLoader` for overlays (dialogs, menus).
- Signals: assert by reading the signal; for `effect`s, flush with `TestBed.tick()` (v20+) [VERIFY] or `await fixture.whenStable()`.
- Keep one `TestBed.configureTestingModule` per `describe` in `beforeEach`; don't share mutable fakes between tests.
- Playwright: `webServer` in config, role-based locators (`getByRole`), web-first assertions (`await expect(locator).toBeVisible()`), `page.route()` to stub third-party/unstable APIs, separate auth via `storageState`.

## Anti-patterns

- Migrating Karma → Vitest/Jest inside a feature PR — large config churn; do it as its own change (schematic `ng g @schematics/angular:refactor-jasmine-vitest` is experimental).
- `component.myInput = value` for `input()` signals — fails to compile or bypasses binding; use `setInput`.
- `setTimeout(done, 500)` / `await sleep()` — flaky; use `whenStable`, fake timers, or Playwright auto-waiting.
- `HttpClientTestingModule` + `HttpClientModule` in new tests — legacy; use the provider functions.
- `RouterTestingModule` in new tests — legacy; use `provideRouter` + `RouterTestingHarness`.
- `NO_ERRORS_SCHEMA` to silence unknown elements — hides template bugs; import the child or override with a stub standalone component.
- Selecting by CSS classes from a UI library (`.mat-mdc-button`) — breaks on library upgrades; use harnesses or roles.
- Playwright `page.waitForTimeout()` — flaky; use locators and `expect` polling.
- Snapshot tests of whole component HTML — noisy diffs, low signal.

## Implementation Examples

### Standalone component with signal input and HTTP (runner-agnostic)

```ts
// src/app/orders/order-summary.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrderSummaryComponent } from './order-summary.component';

describe('OrderSummaryComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OrderSummaryComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads the order for the given id and shows the total', async () => {
    const fixture = TestBed.createComponent(OrderSummaryComponent);
    fixture.componentRef.setInput('orderId', '42');
    await fixture.whenStable();

    httpTesting.expectOne({ method: 'GET', url: '/api/orders/42' }).flush({ id: '42', total: 99.5 });
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('99.50');
  });

  it('shows an error message when the request fails', async () => {
    const fixture = TestBed.createComponent(OrderSummaryComponent);
    fixture.componentRef.setInput('orderId', '7');
    await fixture.whenStable();

    httpTesting.expectOne('/api/orders/7').flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
  });
});
```

On zone-based suites that still need it, add `fixture.detectChanges()` after `setInput`; it is harmless under zoneless.

### Service with a mocked dependency

```ts
// src/app/orders/orders.facade.spec.ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OrdersApi } from './orders.api';
import { OrdersFacade } from './orders.facade';

it('exposes only open orders', async () => {
  const api: Pick<OrdersApi, 'list'> = {
    list: () => of([{ id: '1', status: 'open' }, { id: '2', status: 'closed' }] as const).pipe(),
  };
  TestBed.configureTestingModule({ providers: [{ provide: OrdersApi, useValue: api }] });

  const facade = TestBed.inject(OrdersFacade);
  facade.load();
  expect(facade.openOrders().map((o) => o.id)).toEqual(['1']); // `of()` emits synchronously
});
```

For an async service, use a component fixture and `await fixture.whenStable()` or await the service's observable directly.

### Router with RouterTestingHarness

```ts
// src/app/orders/order-detail.routes.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { OrderDetailComponent } from './order-detail.component';

it('renders the order id from the route', async () => {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'orders/:id', component: OrderDetailComponent }])],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/orders/42', OrderDetailComponent);
  expect(harness.routeNativeElement?.textContent).toContain('Order 42');
});
```

More: Angular Testing Library, harnesses, functional guards, Vitest fake timers, Jest setup, Playwright config — [references/runners-and-e2e.md](references/runners-and-e2e.md).

## Validation Checklist

- [ ] Detected runner from `angular.json`/`package.json`; used its spy/mock API; no runner migration.
- [ ] Detected Angular version, zoneless vs zone, standalone vs NgModule, signal inputs.
- [ ] Signal inputs set via `componentRef.setInput`.
- [ ] Async waits use `whenStable`/fake timers, not sleeps.
- [ ] HTTP tests use `provideHttpClient` + `provideHttpClientTesting`, call `verify()`.
- [ ] Router tests use `provideRouter` + `RouterTestingHarness`.
- [ ] Queries are role/label based or harness based; no library CSS selectors.
- [ ] No `NO_ERRORS_SCHEMA`; no deprecated ATL options.
- [ ] Error and empty states tested, not only happy path.
- [ ] Playwright tests use role locators and web-first assertions.
- [ ] Focused tests and full suite pass.

## References

- [Runner setup, ATL, harnesses, guards, Playwright](references/runners-and-e2e.md)
- https://angular.dev/guide/testing
- https://angular.dev/guide/testing/migrating-to-vitest
- https://angular.dev/guide/testing/components-scenarios
- https://angular.dev/guide/http/testing
- https://testing-library.com/docs/angular-testing-library/api
- https://playwright.dev/docs/test-webserver
