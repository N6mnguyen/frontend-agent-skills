---
name: react-testing
description: Behaviour-focused React testing with Vitest (or the project's Jest), React Testing Library 16, user-event, a renderWithProviders helper (fresh QueryClient, memory router), MSW 3 network mocking, renderHook, async queries, and Playwright for critical end-to-end flows. Use when writing or fixing component, hook, form, routing or data-fetching tests, setting up a test harness, mocking APIs, debugging flaky async tests, or deciding unit vs e2e coverage.
license: MIT
metadata:
  category: react
  version: "1.0.0"
  frameworks: "vitest 4-5, jest 29-30, @testing-library/react 16, msw 2-3, @playwright/test 1"
  last-reviewed: "2026-11-25"
---

# React Testing

## Purpose

Tests that fail when user-visible behaviour breaks and pass through refactors. Query the DOM the way users and assistive tech do, mock the network (not your modules), give each test isolated providers, and keep end-to-end tests for a few revenue/safety-critical flows.

## When to Use

- New component, hook, form, route or data-fetching code needs tests.
- Setting up or repairing test infrastructure (Vitest/Jest, RTL, MSW, Playwright).
- Flaky async tests, `act(...)` warnings, unhandled request errors.
- Choosing what to cover with unit/integration vs e2e.

Do not use when: testing Angular code (`angular-testing`), or for test strategy across the whole frontend (`frontend-testing` skill).

## Workflow

1. **Detect.** Read `package.json`: `vitest` vs `jest`, `@testing-library/react`, `@testing-library/dom` (required peer for RTL 16), `@testing-library/user-event`, `@testing-library/jest-dom`, `msw` major, `@playwright/test`, `jsdom`/`happy-dom`. Find the existing setup file (`vitest.setup.ts`, `src/test/setup.ts`, `jest.setup.ts`) and any `renderWithProviders`/`test-utils`. Reuse them.
2. **Decide.**
   - Vite project without a runner → Vitest. Existing Jest → stay on Jest; APIs below map 1:1 (`vi.fn` → `jest.fn`).
   - MSW 3: Node 22+, ESM only, TypeScript 5.9+. Handlers import from `msw/http` (root `msw` still re-exports for now), `setupServer` from `msw/node`, `onUnhandledFrame` replaces `onUnhandledRequest`. On MSW 2, keep `msw` root imports and `onUnhandledRequest`.
   - Vitest 5: Node 22.12+, Vite 6.4+, `clearMocks` default `true`, `vi.mock` must be top level.
3. **Implement** the smallest test that proves the behaviour: render → interact via `userEvent` → assert on accessible output.
4. **Verify.** Run the single file in watch mode, then the full suite. Run each new test several times (`vitest --repeats 10`, `--sequence.shuffle.tests`) if it involves timers or async. Check no console errors/warnings leak.

## Best Practices

- **Query priority:** `getByRole` (with `name`) → `getByLabelText` → `getByPlaceholderText` → `getByText` → `getByDisplayValue` → `getByAltText`/`getByTitle` → `getByTestId` last. A failing role query often means an accessibility bug — fix the component.
- **Use `screen`** rather than destructuring from `render`.
- **`userEvent.setup()` per test**, then `await user.click(...)`, `await user.type(...)`. Prefer it over `fireEvent` (realistic focus, keyboard, pointer sequence).
- **Async:** `await screen.findByRole(...)` for things that appear; `await waitFor(() => expect(...))` only for non-DOM assertions; `waitForElementToBeRemoved` for spinners. One assertion per `waitFor`, no side effects inside.
- **Absence:** `expect(screen.queryByRole(...)).not.toBeInTheDocument()`.
- **jest-dom matchers** (`toBeInTheDocument`, `toHaveAccessibleName`, `toBeDisabled`, `toHaveValue`) — import `@testing-library/jest-dom/vitest` in Vitest setup.
- **Fresh providers per test:** new `QueryClient` with `retry: false` and `gcTime: Infinity` per render; a memory router with `initialEntries`. No shared module-level QueryClient.
- **Mock the network with MSW**, not `fetch`/axios/module mocks. Default handlers for the happy path; `server.use(...)` in a test for errors/edge cases; `resetHandlers` after each. Fail on unhandled requests.
- **Hooks:** test through a component when possible. For reusable hooks, `renderHook` from `@testing-library/react` (not the deprecated `@testing-library/react-hooks`) with the same wrapper.
- **Time:** `vi.useFakeTimers({ shouldAdvanceTime: true })` and `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` for debounce tests; restore with `vi.useRealTimers()`.
- **Forms:** assert what the user sees (error text linked to the field, submit disabled) and the payload received by the MSW handler.
- **Snapshots:** only for small, stable serialised output (e.g., generated config). Never whole component trees.
- **Playwright** for 3-10 critical journeys (login, checkout, create/edit core entity). Use role locators, web-first assertions (`await expect(locator).toBeVisible()`), `storageState` for auth, trace on first retry. Mock third parties with `page.route`, not your own backend unless the suite is explicitly front-end-only.

## Anti-patterns

- Asserting on component state, props, hooks called, or class names — breaks on refactor, misses real bugs.
- `getByTestId` everywhere — hides missing labels/roles.
- `await waitFor(() => screen.getByText(...))` — use `findByText`.
- Wrapping `render`/`user.click` in `act` manually — RTL already does; warnings mean an un-awaited update, so await the resulting UI.
- `vi.mock('../api/users')` to stub data fetching — skips serialisation, status handling, headers. Use MSW.
- Shared `QueryClient` across tests — cached data leaks between tests; retries make failures slow.
- `setTimeout`/`sleep` in tests — flaky. Await a UI condition.
- Large snapshot files reviewed by nobody.
- E2E for every edge case — slow and flaky; push edge cases down to component tests.
- Forgetting `@testing-library/dom` with RTL 16 — install fails or resolves a mismatched version.

## Implementation Examples

### Vitest config and setup

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
});
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw-server';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' })); // MSW 2: onUnhandledRequest
afterEach(() => {
  cleanup(); // automatic only when test globals are enabled
  server.resetHandlers();
});
afterAll(() => server.close());
```

```ts
// src/test/msw-server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```ts
// src/test/handlers.ts
import { http, HttpResponse } from 'msw/http'; // MSW 2: from 'msw'

export interface User { id: string; name: string }

export const handlers = [
  http.get('/api/users', () => HttpResponse.json<User[]>([{ id: '1', name: 'Ada' }])),
  http.post<never, { name: string }, User>('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: '2', name: body.name }, { status: 201 });
  }),
];
```

Relative handler URLs match requests resolved against jsdom's `location.origin`. If the API client uses an absolute base URL from env, use that same base in handlers (e.g. `${API_URL}/users`) or set `environmentOptions.jsdom.url` (default jsdom URL in the installed Vitest [VERIFY]).

### renderWithProviders

```tsx
// src/test/render.tsx
import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

interface Options extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
  path?: string;
  routes?: RouteObject[];
  queryClient?: QueryClient;
}

export function renderWithProviders(ui: ReactElement, { route = '/', path = '/', routes = [], queryClient = createTestQueryClient(), ...options }: Options = {}) {
  const router = createMemoryRouter([{ path, element: ui }, ...routes], { initialEntries: [route] });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    user: userEvent.setup(),
    queryClient,
    router,
    ...render(<RouterProvider router={router} />, { wrapper: Wrapper, ...options }),
  };
}
```

v6: import `createMemoryRouter`/`RouterProvider` from `react-router-dom`. Declarative-mode apps can wrap in `<MemoryRouter initialEntries={[route]}>` instead. Add the project's other providers (antd `ConfigProvider`/`App`, theme, i18n, store) inside `Wrapper`.

### Component test with MSW

```tsx
// src/features/users/users-page.test.tsx
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render';
import { UsersPage } from './users-page';

describe('UsersPage', () => {
  it('lists users from the API', async () => {
    renderWithProviders(<UsersPage />);
    expect(await screen.findByRole('cell', { name: 'Ada' })).toBeInTheDocument();
  });

  it('shows an error with retry when the API fails', async () => {
    server.use(http.get('/api/users', () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    const { user } = renderWithProviders(<UsersPage />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not load users/i);

    server.resetHandlers(); // next request succeeds
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByRole('cell', { name: 'Ada' })).toBeInTheDocument();
  });
});
```

More examples — form submit with payload capture, `renderHook` with a QueryClient wrapper, route/guard tests, and Playwright config with auth setup — are in [references/examples.md](references/examples.md).

## Validation Checklist

- [ ] RTL 16 installed with `@testing-library/dom`; jest-dom matchers wired in setup.
- [ ] Tests use role/label queries; any `getByTestId` has a reason.
- [ ] Interactions via `userEvent.setup()` and awaited.
- [ ] Async UI awaited with `findBy*`/`waitFor`; no sleeps; no `act` warnings in output.
- [ ] Network mocked with MSW; unhandled requests fail the test; handlers reset after each test.
- [ ] MSW imports and listen option match the installed major (v3: `msw/http`, `onUnhandledFrame`).
- [ ] Each test builds a fresh QueryClient (`retry: false`) and router.
- [ ] Error, empty and loading states covered, not just the happy path.
- [ ] No large component snapshots.
- [ ] Critical journeys covered in Playwright with role locators and `storageState` auth; `.auth` folder gitignored.

## References

- [references/examples.md](references/examples.md) — forms, hooks, routes, Playwright.
- https://testing-library.com/docs/queries/about#priority
- https://mswjs.io/docs/migrations/2.x-to-3.x
- https://vitest.dev/guide/migration
- https://playwright.dev/docs/best-practices
