# Auth and Role Guards

Use this when Data/Framework mode uses route middleware. Data mode middleware became stable in v7.9 behind `future.v8_middleware`; v8 enables it by default. Framework mode follows the installed version's generated route types and middleware config. [VERIFY] Confirm the project's v7 future-flag/module-augmentation syntax before enabling.

```ts
// app/auth-context.ts
import { createContext } from 'react-router';
import type { User } from './types';

export const userContext = createContext<User | null>(null);
```

```ts
// app/routes.ts — Data mode v7.9+/v8. `MiddlewareFunction` type export name [VERIFY]
// (framework mode uses generated `Route.MiddlewareFunction` instead).
import { redirect, type MiddlewareFunction } from 'react-router';
import { userContext } from './auth-context';
import { getSessionUser } from './auth/session'; // (request: Request) => Promise<User | null>
import { AppLayout, ProjectsPage, AdminPage } from './pages';

const requireUser: MiddlewareFunction = async ({ context, request }, next) => {
  const user = await getSessionUser(request);
  if (!user) {
    const url = new URL(request.url);
    throw redirect(`/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
  }
  context.set(userContext, user);
  await next();
};

const requireAdmin: MiddlewareFunction = async ({ context }, next) => {
  const user = context.get(userContext);
  if (!user?.roles.includes('admin')) throw new Response('Forbidden', { status: 403 });
  await next();
};

export const routes = [
  {
    path: '/app',
    middleware: [requireUser],
    Component: AppLayout,
    children: [
      { path: 'projects', Component: ProjectsPage },
      { path: 'admin', middleware: [requireAdmin], Component: AdminPage },
    ],
  },
];
```

A parent middleware runs before child middleware. Use `context.get(userContext)` in loaders/actions to consume the authenticated user. v7.9 requires the `v8_middleware` future flag; v8 does not. Do not assume middleware alone protects APIs: check permissions in the server operation too.

For an accessible forbidden state, throw a 403 response and render it in the nearest boundary with `isRouteErrorResponse(error)`. Keep 401 (not authenticated) distinct from 403 (authenticated, insufficient permissions).

```tsx
// src/routes/protected-route.tsx — Declarative mode fallback only
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export function RequireRole({
  user,
  role,
}: {
  user: { roles: string[] } | null;
  role: string;
}) {
  const location = useLocation();
  if (!user) {
    const redirectTo = location.pathname + location.search;
    return <Navigate to={`/login?redirectTo=${encodeURIComponent(redirectTo)}`} replace />;
  }
  return user.roles.includes(role) ? <Outlet /> : <p role="alert">Forbidden</p>;
}
```

Declarative guard is a UX affordance; it cannot stop direct API access. On v7/v8, import `Navigate`, `Outlet`, and `useLocation` from `react-router` instead.

Checklist:
- [ ] Session is verified by server/API, not trusted from local storage alone.
- [ ] Unauthenticated requests redirect; insufficient roles return 403.
- [ ] Redirect target rejects `//host`, backslashes, and non-local paths.
- [ ] Permission checks cover loaders, actions, and API mutations/data reads.
- [ ] Middleware context has explicit types and is request/navigation-scoped.
- [ ] Role names and policy match server-side definitions.
