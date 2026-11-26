# React Testing Examples

## Form: validation, payload and server error

```tsx
// src/features/users/user-form.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render';
import { CreateUserForm } from './create-user-form';

describe('CreateUserForm', () => {
  it('shows field errors and focuses the first invalid field', async () => {
    const { user } = renderWithProviders(<CreateUserForm />);
    await user.click(screen.getByRole('button', { name: /save/i }));
    const name = screen.getByRole('textbox', { name: /name/i });
    expect(name).toHaveAccessibleDescription(/name is required/i);
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveFocus();
  });

  it('sends the parsed payload', async () => {
    const received = vi.fn();
    server.use(
      http.post('/api/users', async ({ request }) => {
        received(await request.json());
        return HttpResponse.json({ id: '9', name: 'Grace' }, { status: 201 });
      }),
    );
    const { user } = renderWithProviders(<CreateUserForm />);
    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Grace');
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'grace@example.com');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i);
    expect(received).toHaveBeenCalledWith({ name: 'Grace', email: 'grace@example.com' });
  });

  it('maps a 422 to the email field', async () => {
    server.use(
      http.post('/api/users', () =>
        HttpResponse.json({ errors: [{ field: 'email', message: 'Email already used' }] }, { status: 422 }),
      ),
    );
    const { user } = renderWithProviders(<CreateUserForm />);
    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Grace');
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'taken@example.com');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText('Email already used')).toBeInTheDocument();
  });
});
```

`toHaveAccessibleDescription` checks the `aria-describedby` wiring, so it doubles as an accessibility regression test.

## Hook with renderHook

```tsx
// src/features/users/use-users.test.tsx
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/render';
import { useUsers } from './use-users';

function createWrapper() {
  const client = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useUsers', () => {
  it('returns users', async () => {
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: '1', name: 'Ada' }]);
  });
});
```

Pure hooks (no providers) need no wrapper. Hooks with props: `renderHook((props: { id: string }) => useUser(props.id), { initialProps: { id: '1' } })`, then `rerender({ id: '2' })`.

## Debounced input with fake timers

```tsx
// src/components/search-box.test.tsx
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBox } from './search-box';

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

it('calls onSearch once after typing stops', async () => {
  const onSearch = vi.fn();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<SearchBox onSearch={onSearch} delayMs={300} />);
  await user.type(screen.getByRole('searchbox', { name: /search/i }), 'ada');
  await vi.advanceTimersByTimeAsync(300);
  expect(onSearch).toHaveBeenCalledTimes(1);
  expect(onSearch).toHaveBeenCalledWith('ada');
});
```

## Route guard / redirect

```tsx
// src/router/protected.test.tsx
import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { http, HttpResponse } from 'msw/http';
import { server } from '@/test/msw-server';
import { routes } from './routes'; // export the route array, not the browser router

it('redirects anonymous users to login with redirectTo', async () => {
  server.use(http.get('/api/session', () => HttpResponse.json(null, { status: 401 })));
  const router = createMemoryRouter(routes, { initialEntries: ['/orders?status=open'] });
  render(<RouterProvider router={router} />);
  expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/login');
  expect(router.state.location.search).toBe('?redirectTo=%2Forders%3Fstatus%3Dopen');
});
```

Export route objects separately from `createBrowserRouter(...)` so tests can build a memory router from the same config. Framework mode: use `createRoutesStub` from `react-router` for route-module components.

## Playwright

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'on-first-retry' },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
});
```

```ts
// e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL ?? '');
  await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await page.context().storageState({ path: authFile });
});
```

```ts
// e2e/create-order.spec.ts
import { test, expect } from '@playwright/test';

test('user creates an order', async ({ page }) => {
  await page.goto('/orders/new');
  await page.getByLabel('Customer').fill('Acme');
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Description').fill('Widget');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toHaveText(/order created/i);
  await expect(page).toHaveURL(/\/orders\/\w+$/);
});
```

Add `playwright/.auth` to `.gitignore` — the file holds session cookies. Read credentials from CI secrets, never commit them. Use dedicated test accounts and seed data per run.
