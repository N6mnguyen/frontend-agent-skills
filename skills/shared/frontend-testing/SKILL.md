---
name: frontend-testing
description: Design reliable frontend tests with a practical testing pyramid, Testing Library role-based queries, MSW API mocking, test data builders, and Playwright end-to-end coverage. Use when creating or debugging React or Angular tests, selecting test scope, mocking APIs, addressing flaky tests, or setting meaningful coverage expectations.
license: MIT
metadata:
  category: shared
  version: "1.0.0"
  frameworks: "react, angular"
  last-reviewed: "2026-11-25"
---

# Frontend Testing

## Purpose

Build confidence in user-visible behavior with the smallest useful test at the appropriate boundary. Tests should catch realistic regressions, remain deterministic, and be understandable when they fail.

## When to Use

- Adding a feature or fixing a bug in UI, state, forms, API integration, or routing.
- Deciding whether a behavior belongs in a unit, integration, or browser test.
- Mocking APIs, diagnosing flakiness, or changing coverage policy.

Do not use when: testing server APIs or database invariants; use backend tests for those guarantees. Frontend tests must not imply server behavior is enforced.

## Workflow

1. **Detect** — inspect package scripts, framework/test versions, existing test folders, setup files, MSW handlers, and browser/e2e config. Keep the project runner and conventions.
2. **Choose by risk** — test pure logic cheaply; test user-visible behavior at component/page boundaries; use a small end-to-end suite for critical workflows and cross-browser/platform integration.
3. **Arrange** — create readable fixtures/builders, mock network boundaries with MSW, and keep each test isolated.
4. **Assert behavior** — query as a user would (`getByRole`, label, text); assert observable outcomes, not component internals or implementation call counts unless that is the behavior.
5. **Verify** — run the focused test, relevant suite, type-check, lint, and critical E2E tests. For a bug, demonstrate the regression test fails before the fix when practical.

## Best Practices

### What to test

| Risk / behavior | Best fit | Example |
| --- | --- | --- |
| Pure calculation, parser, formatter, reducer, validation rule | Unit | Currency formatting, permission predicate, reducer transition |
| Component interaction, form submission, loading/error state, accessibility behavior | Integration | User types, submits, sees validation/API outcome |
| Routing, real browser focus/layout, auth flow, critical purchase/login path | E2E (Playwright) | User can complete the core task in a browser |
| Server authorization, persistence, rate limits | Backend / contract tests | A client cannot bypass the UI to read another user's record |

- Prefer a testing trophy/pyramid balanced toward integration tests: many focused unit tests for logic, a strong middle of user-oriented integration tests, a few high-value E2E journeys. Do not measure value by test count.
- Test behavior that matters to users and failure modes with real consequences. Skip snapshot tests for large markup trees and tests of private state that only restate implementation.
- Every bug fix should add a regression test at the lowest layer that reliably reproduces the bug; add an E2E test only if the failure depends on browser-level integration.

### Testing Library queries

- Query in this order: `getByRole` (with accessible name) → `getByLabelText` → `getByPlaceholderText` (only if placeholder is the UX) → `getByText` → `getByTestId` (last resort).
- `getBy*` asserts immediate presence, `queryBy*` checks absence, `findBy*` waits for async appearance. Use `findBy` instead of manually waiting then querying.
- Prefer `user-event` for realistic typing/clicking/tabbing; use `fireEvent` only for low-level events user-event cannot represent.
- Do not query CSS classes, component instance fields, or test IDs if a role/name query expresses the behavior.

### Network isolation with MSW 3

- Mock at the HTTP boundary, not by replacing `fetch`, `HttpClient`, or internal API hooks. Use the same handlers in browser development, unit/integration tests, and Storybook where practical.
- MSW 3 imports `http` and `HttpResponse` from `msw/http`, `setupServer` from `msw/node`, `setupWorker` from `msw/browser`. No deprecated `rest.get`, `ctx.json`, or `res` APIs.
- In Node tests, `server.listen({ onUnhandledFrame: 'error' })` catches accidental live calls (MSW 2 named this option `onUnhandledRequest`); reset per-test overrides and close once in global teardown.
- Override handlers per test with `server.use(...)`; call `server.resetHandlers()` after each test so overrides do not leak.
- MSW 3 requires Node.js 22+; if CI still runs Node 18/20, stay on the repo-supported MSW version or upgrade the runtime first. The API below is the MSW 3 API; check migration docs before moving from v1/v2.

### Playwright E2E

- Use a small set of critical journeys (sign-in, core transaction, access denied, key form). Most component state combinations are cheaper at integration level.
- Prefer `page.getByRole`, `getByLabel`, `getByText`; use web-first assertions such as `await expect(locator).toBeVisible()`.
- Isolate tests: each test should own data and state; use a setup project + `storageState` for shared auth, but do not share mutable server data across parallel workers.
- Use `page.route` or MSW to stub external services; do not depend on third-party uptime or send real side-effecting requests from CI.
- Avoid fixed sleeps. Wait for a visible state, URL, response, or other meaningful condition; if the app has no observable readiness state, add one rather than waiting an arbitrary duration.
- Collect traces on first retry in CI; use trace viewer to diagnose. Do not use retries to mask flakiness; retry count is diagnostic, not a pass.

### Fixtures, builders, determinism

- Prefer small fixture factories/builders with explicit defaults and per-test overrides. Avoid giant shared fixtures that hide relevant fields.
- Generate dates, IDs, and random values deterministically or inject a clock/random source; restore fake timers and mocks in teardown.
- Do not couple tests through global mutable state, execution order, shared files, live network calls, real sleeps, or previous test output.
- Use fake timers only when time is the behavior (debounce, expiry); advance timers intentionally and flush pending promises. Avoid mixing fake timers with libraries that require real timers without careful cleanup.
- Await all async work; configure linting for unawaited promises. Fail fast on console errors and unhandled rejections when they indicate a user-visible defect.

### Coverage

- Coverage helps find untested code, not correctness. Do not target 100% as a proxy for quality.
- Track line/branch coverage on high-risk logic; require coverage for changed critical paths where it is inexpensive. Exclude generated code, not inconvenient production logic.
- Use mutation testing selectively for permission checks, financial calculations, and other high-impact logic if the repo already supports it.

## Anti-patterns

- Testing private component state — brittle and disconnected from users — assert the rendered outcome and accessible interaction.
- Mocking the function under test or every internal module — tests the mock wiring — mock network boundaries and external side effects.
- Live API requests in unit/integration tests — slow and nondeterministic — MSW with explicit handlers.
- `waitForTimeout(1000)` — timing guess — wait for the user-observable state with Playwright assertions.
- Retrying a flaky test until CI goes green — hides a race — remove shared state, arbitrary timing, or uncontrolled dependencies.
- One E2E test per tiny UI condition — slow suite — test state permutations in component integration tests.
- Snapshotting an entire page — noisy failures, weak intent — assert key roles, names, and outcomes.
- Coverage threshold without risk review — incentivizes meaningless tests — focus on changed/high-risk behavior and uncovered branches.
- Swallowing errors to pass tests — hides broken behavior — make mocks explicit and assert expected failure UX.

## Implementation Examples

### Unit and user-oriented integration tests (Vitest + Testing Library)

```tsx
// src/features/profile/EmailForm.test.tsx (@testing-library/react 16)
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { EmailForm } from './EmailForm';

it('shows a useful validation error and focuses the invalid field on submit', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<EmailForm onSave={onSave} />);

  await user.click(screen.getByRole('button', { name: 'Save email' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
  expect(screen.getByLabelText('Email address')).toHaveFocus();
  expect(onSave).not.toHaveBeenCalled();
});
```

React: `@testing-library/react` renders with the actual DOM. Angular: `@testing-library/angular` `render(Component)` provides the same `screen.getByRole` style; with Angular `TestBed`, use DOM queries and assert visible behavior, not injected component internals unless testing a service.

### MSW 3 handlers and Vitest setup (Node 22+)

```ts
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw/http';

export const handlers = [
  http.get('/api/profile', () => HttpResponse.json({ id: 'u-1', name: 'Ada' })),
  http.put('/api/profile', async ({ request }) => {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || !('name' in body)) {
      return HttpResponse.json({ message: 'Name is required' }, { status: 422 });
    }
    return HttpResponse.json({ ok: true });
  }),
];
```

```ts
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```ts
// vitest.setup.ts
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './src/mocks/server';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' })); // MSW 2: onUnhandledRequest
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```tsx
// src/features/profile/ProfilePage.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { expect, it } from 'vitest';
import { server } from '../../mocks/server';
import { ProfilePage } from './ProfilePage';

it('recovers after a failed profile load', async () => {
  let calls = 0;
  server.use(
    http.get('/api/profile', () =>
      ++calls === 1
        ? HttpResponse.json({ message: 'Unavailable' }, { status: 503 })
        : HttpResponse.json({ id: 'u-1', name: 'Ada' }),
    ),
  );
  render(<ProfilePage />); // wrap in the app's real providers (query client, router) via a test util

  expect(await screen.findByRole('alert')).toHaveTextContent('Profile could not be loaded');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Ada' })).toBeVisible();
});
```

- MSW 2 imports `http`/`HttpResponse` from `msw` (root); MSW 3 moved them to `msw/http`. MSW 1 (`rest`, `res(ctx.json())`) is deprecated; migrate rather than copy that style.
- `setupServer` intercepts `fetch` and `XMLHttpRequest` in Node, so it works for React fetch/axios clients and Angular `HttpClient` under Vitest/Jest with jsdom. Angular projects that already use `HttpTestingController` (`provideHttpClientTesting()`) for service tests can keep it; prefer MSW for component/page tests so the real interceptors run.
- In the browser (dev server, Storybook) use `setupWorker` from `msw/browser` and `await worker.start()`; run `npx msw init public/` once to generate the worker script.

### Angular component test with Testing Library

```ts
// src/app/profile/profile.component.spec.ts (Angular 17+, @testing-library/angular)
import { provideHttpClient } from '@angular/common/http';
import { render, screen } from '@testing-library/angular';
import { ProfileComponent } from './profile.component';

it('shows the loaded profile name', async () => {
  await render(ProfileComponent, { providers: [provideHttpClient()] });
  expect(await screen.findByRole('heading', { name: 'Ada' })).toBeInTheDocument();
});
```

The default MSW handler serves `/api/profile`; Angular resolves relative URLs against jsdom's `location`. New Angular CLI projects use Vitest (Karma still supported); Vitest became the CLI default for new projects in Angular CLI 21.0.0. Older projects often use Karma/Jasmine or Jest — keep the existing runner and adapt `vi.fn()` to `jasmine.createSpy()` where needed.

### Flaky test triage

1. Reproduce: `npx vitest run path/to.test.ts --repeats 20` or `npx playwright test path --repeat-each 20 --workers 4`.
2. Classify the cause: order dependence (run alone vs. in suite), timing (fixed waits, animations, debounce), shared data (parallel workers), unmocked network, real clock/time zone/locale.
3. Fix the cause: await the observable state, isolate data per test/worker, pin `TZ`/locale in config, mock time with `vi.useFakeTimers()` and restore in `afterEach`.
4. Quarantine only with an owner and a ticket; a skipped test is deleted coverage.

### Test data builder

```ts
// test/builders/user.ts
export type User = { id: string; name: string; role: 'member' | 'admin' };

export function buildUser(overrides: Partial<User> = {}): User {
  return { id: 'user-1', name: 'Ada Lovelace', role: 'member', ...overrides };
}
```

Keep builders deterministic and local to test utilities. Use explicit `buildUser({ role: 'admin' })` to make risk-relevant differences visible.

### Playwright critical journey

```ts
// e2e/profile.spec.ts (@playwright/test 1.65)
import { expect, test } from '@playwright/test';

test('member updates profile name', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('textbox', { name: 'Name' }).fill('Ada Byron');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved');
  await expect(page.getByRole('heading', { name: 'Ada Byron' })).toBeVisible();
});
```

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
```

Use a production-like server and explicit test data cleanup. Do not reuse one mutable account across workers unless each worker has isolated records.

## Validation Checklist

- [ ] Test level matches risk; core behavior asserted through user-visible output.
- [ ] Integration tests query controls by role/name or label; test IDs are last resort.
- [ ] Network calls are mocked at HTTP boundary; unhandled requests fail the test suite.
- [ ] Handlers reset after each test; no leaking overrides, live calls, or shared mutable fixtures.
- [ ] E2E tests cover critical flows, use web-first assertions, and do not sleep arbitrarily.
- [ ] CI records traces on retry; retries do not conceal flaky tests.
- [ ] Regression tests reproduce bugs at the lowest reliable layer.
- [ ] Coverage policy targets meaningful high-risk behavior, not 100%.

## References

- [Testing Library: Guiding Principles](https://testing-library.com/docs/guiding-principles/)
- [Testing Library: ByRole](https://testing-library.com/docs/queries/byrole/)
- [MSW: Quick start](https://mswjs.io/docs/quick-start)
- [MSW: 2.x to 3.x migration](https://mswjs.io/docs/migrations/2.x-to-3.x)
- [Playwright: Best practices](https://playwright.dev/docs/best-practices)
- [Playwright: Authentication](https://playwright.dev/docs/auth)
- [Playwright: Retries](https://playwright.dev/docs/test-retries)
- [Vitest](https://vitest.dev/)
