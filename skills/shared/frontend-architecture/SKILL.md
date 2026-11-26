---
name: frontend-architecture
description: Analyze an existing React or Angular codebase's structure before changing it, then add features inside clear boundaries - feature-based vs layered folders, component boundaries, dependency direction rules, public APIs, and when domain folders pay off. Use when adding a new feature or route, moving files between folders, deciding where new code belongs, reviewing imports that cross features, planning a folder restructure, or when the user asks about project structure, module boundaries, or scalable frontend architecture.
license: MIT
metadata:
  category: shared
  version: "1.0.0"
  frameworks: "react 18-19, angular 17+"
  last-reviewed: "2026-11-25"
---

# Frontend Architecture

## Purpose

Decide where code lives and which code may depend on which, based on what the repository already does. Good architecture here means: a feature can be added, changed, or deleted by touching one folder plus one registration point; shared code never knows about features; and nobody has to restructure the tree to ship a feature. The existing project's conventions win over this skill unless they cause a concrete defect.

## When to Use

- Adding a feature, page, or route and deciding where its files go.
- An import crosses from one feature into another, or from `shared` into a feature.
- Planning or reviewing a folder reorganization.
- Choosing between layered, feature-based, or domain-oriented organization.
- Setting up lint rules that enforce module boundaries.

Do not use when: the question is about one component's internals (see `react-components` or `angular-standalone-components`), state library choice (see `react-state-management` or `angular-signals`), or HTTP client details (see `frontend-api-integration`).

## Workflow

1. **Detect** — read before proposing anything:
   - `package.json`: framework and version, router, state library, monorepo tooling (Nx, Turborepo, pnpm workspaces).
   - `tsconfig*.json` `paths` aliases (`@app/*`, `@shared/*`, `@features/*`) — they reveal the intended layers.
   - Lint config: `no-restricted-imports`, `import/no-restricted-paths`, `eslint-plugin-boundaries`, or Nx `@nx/enforce-module-boundaries`. Existing rules are the source of truth.
   - Route registration (`app.routes.ts`, `createBrowserRouter`, route files) — routes are usually the real feature boundaries.
   - Two or three existing features end to end: where components, API calls, state, types, and tests live.
2. **Classify** the current structure (see the table below). Note mismatches between folder names and actual imports.
3. **Decide** placement with the decision rules in Best Practices. If the project is layered and working, add to the layers; do not convert it to feature folders as a side effect.
4. **Implement** the smallest change: new feature folder (or layer files), one registration point (route/nav), exports only through the project's public-API convention.
5. **Verify** — run the project's type-check, lint (boundary rules catch violations), tests, and build. Grep the diff for new imports that reach into another feature's internals.

### Classifying an existing project

| Signal in the repo | Structure | What to do |
| --- | --- | --- |
| Top-level `components/`, `services/`, `hooks/`, `models/` holding everything | Layered | Follow it for small changes; suggest feature folders only if files for one feature are spread across 4+ top-level folders and that causes real friction |
| `features/<name>/` or `pages/<name>/` with their own components/api/state | Feature-based | Add a sibling feature folder mirroring the most recent one |
| `libs/` or `packages/` with tags or project.json | Monorepo libraries | Create code in the library matching the scope/type tags; respect Nx/workspace boundary rules |
| `domain/`, `application/`, `infrastructure/` per area | Domain-oriented | Keep domain logic framework-free inside `domain/`; UI depends on it, not the reverse |
| Mixed, no clear rule | Unclear | Follow the pattern of the nearest related code; do not invent a new convention |

## Best Practices

### Dependency direction

- Allowed direction: `app` → `features` → `shared`. Composition (app shell, root routes, providers) may import features; features may import shared; shared imports only shared and third-party packages.
- `shared` must never import from `features` — it makes shared code unshareable and creates cycles. If shared code needs feature data, pass it in (props, inputs, function arguments, DI token).
- Features do not import each other's internals. Cross-feature use goes through the other feature's public entry point (e.g. `features/billing/index.ts`) if the project uses barrels, or through routing / app-level composition.
- When two features need the same thing, move only that thing to `shared` (or a dedicated `entities/`/`domain/` layer if the project has one). Do not move the whole feature.
- No import cycles. A cycle between features means one of them owns a concept that belongs lower down.

### Public APIs and barrels

- Use `index.ts` barrels as a feature's public API only where the project already does. Export the route/page entry and the few types or components other features legitimately consume — not every file.
- Avoid barrels inside `shared/` that re-export hundreds of modules; they slow type-checking and test startup and can defeat tree-shaking in some bundler setups [VERIFY].
- Never import a feature's barrel from inside the same feature (`import { X } from '../index'`); it invites cycles. Use relative paths internally.

### Component and module boundaries

- Split by responsibility and change reason, not line count: data fetching/orchestration (container, routed page, smart component) vs presentation (props/inputs in, events/outputs out).
- Keep a feature's API mapping, state, and UI together. API clients that are generic (base HTTP client, interceptors) live in `shared` or `core`; endpoint functions for one feature live in that feature.
- Angular: one routed entry per feature exposed via `loadComponent` or `loadChildren` with a `Routes` array. Standalone components are the default in new Angular 17+ CLI projects, and `standalone: true` is the decorator default since Angular 19; on 17–18 the flag must be set explicitly. Do not convert NgModule features to standalone as part of an unrelated change.
- Angular: app-wide singletons use `providedIn: 'root'`; feature-scoped services go in the route's `providers` array so they are created with the lazy route.
- React: expose a feature's route element or lazy route module; use `React.lazy` or the router's `lazy` route property for code splitting. Feature-local context providers wrap the feature's route element, not the whole app.

### Folder structure that scales

- Feature folder internals: `components/`, `api/`, `state/` (or `store/`/`hooks/`), `types.ts`, `routes` file, tests colocated (`*.test.ts(x)` / `*.spec.ts`). Create subfolders only when a feature has several files of that kind; three files can sit flat.
- Name feature folders after business capabilities (`invoices`, `user-admin`), not UI shapes (`tables`, `modals`).
- `shared/ui` holds design-system-level primitives without business knowledge. A component mentioning `Invoice` belongs in the invoices feature.
- `core/` (Angular convention) or `app/` holds app-wide singletons: auth, HTTP interceptors, error handler, layout shell.

### When domain folders make sense

Use DDD-style `domain/` (framework-free entities, value objects, validation rules) only when at least one holds:
- Business rules are nontrivial (pricing, eligibility, state machines) and must be unit-tested without the UI framework.
- The same domain concept is used across several features with the same invariants.
- Teams already speak in bounded contexts and the backend is organized that way.

For CRUD screens that map API data to forms and tables, domain layers add files without value. Skip them.

### Adding a feature without restructuring

1. Copy the shape of the most recently added comparable feature.
2. Create `features/<name>/` (or the layered equivalents) with only the files needed now.
3. Register it once: a lazy route entry and, if needed, a nav item.
4. Reuse `shared/ui` and the existing HTTP client; add endpoint functions inside the feature.
5. If you need something from another feature, import from its public entry; if that is not exported, propose the export or move the shared piece down — do not deep-import.
6. Leave unrelated structural cleanup for a separate change and mention it in your summary.

## Anti-patterns

- Restructuring the tree as part of a feature change — huge diff, impossible review, merge conflicts — ship the feature in current structure, propose the restructure separately.
- `import { useCart } from '@features/cart/hooks/useCart'` from the checkout feature — couples to cart internals — export it from `@features/cart` or move the shared concept down.
- `shared/` importing a feature type "just for the interface" — creates a cycle — define the type in shared or make the shared code generic.
- Moving feature-specific code to `shared` on first reuse — `shared` becomes a junk drawer — wait for a third use (rule of three) or a clearly generic shape.
- `utils.ts` / `helpers.ts` at the root with unrelated functions — no owner, everything depends on it — colocate with the consumer or split by topic.
- Introducing a global store, event bus, or DI container to let features talk — hidden coupling — use route params, explicit inputs, or a shared service with a narrow API.
- Domain/application/infrastructure layers for simple CRUD — ceremony without payoff — keep feature folders flat.
- Barrels re-exporting everything with `export *` — leaks internals and hides cycles — export named symbols intentionally.

## Implementation Examples

### Folder layout (example — adapt names to the project)

```text
src/
  app/                    # shell, root routes, app-wide providers
  core/                   # auth, http client + interceptors, error handler (singletons)
  shared/
    ui/                   # Button, DataTable, Modal — no business terms
    lib/                  # format-date.ts, invariant.ts
  features/
    invoices/
      api/invoices-api.ts # endpoint functions + DTO mapping
      components/
      state/
      invoices.routes.ts  # or routes.tsx
      index.ts            # public API, only if the project uses barrels
```

### Feature public API

```ts
// src/features/invoices/index.ts
export { InvoiceStatusBadge } from './components/InvoiceStatusBadge';
export type { InvoiceSummary } from './types';
// Intentionally NOT exported: invoices-api, internal state, form components.
```

### React: lazy feature route (React Router 6.4+ data routers)

```tsx
// src/app/router.tsx
import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { path: 'invoices', lazy: () => import('../features/invoices/routes') },
    ],
  },
]);
```

The lazy module exports route properties such as `Component` or `element`. On React Router v6 import from `react-router-dom`; v7 consolidates into `react-router`. Follow whichever the project uses.

### Angular: lazy feature routes with feature-scoped providers

```ts
// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'invoices',
    loadChildren: () => import('./features/invoices/invoices.routes').then(m => m.INVOICES_ROUTES),
  },
];
```

```ts
// src/app/features/invoices/invoices.routes.ts
import { Routes } from '@angular/router';
import { InvoiceListComponent } from './components/invoice-list.component';
import { InvoicesStore } from './state/invoices.store';

export const INVOICES_ROUTES: Routes = [
  {
    path: '',
    providers: [InvoicesStore], // created when the route activates, scoped to this subtree
    children: [{ path: '', component: InvoiceListComponent }],
  },
];
```

### Enforcing boundaries with ESLint (core rule, no plugin)

```js
// eslint.config.js (flat config) — add to the project's existing config
export default [
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/features/**', '@features/*'], message: 'shared must not depend on features.' }],
      }],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['@features/*/**'], message: 'Import other features via their public entry (@features/<name>).' }],
      }],
    },
  },
];
```

The patterns above only catch alias imports. Relative reach-through (`../../billing/api/...`) needs a path-aware rule such as `import/no-restricted-paths`; check what the project has installed before adding one.

If the project already uses `eslint-plugin-boundaries`, `import/no-restricted-paths`, or Nx `@nx/enforce-module-boundaries` with tags, extend that instead of adding a second mechanism.

### Shared code receiving feature data instead of importing it

```tsx
// src/shared/ui/StatusBadge.tsx — knows nothing about invoices
type Tone = 'neutral' | 'success' | 'danger';
export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`badge badge--${tone}`}>{label}</span>;
}

// src/features/invoices/components/InvoiceStatusBadge.tsx — maps domain to generic
import { StatusBadge } from '@shared/ui/StatusBadge';
import type { InvoiceStatus } from '../types';

const toneByStatus = { draft: 'neutral', paid: 'success', overdue: 'danger' } as const satisfies Record<InvoiceStatus, 'neutral' | 'success' | 'danger'>;

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <StatusBadge label={status} tone={toneByStatus[status]} />;
}
```

## Validation Checklist

- [ ] Read `package.json`, tsconfig `paths`, lint boundary rules, route registration, and at least two existing features before deciding placement.
- [ ] New code follows the existing structure (layered, feature, monorepo lib, or domain).
- [ ] No new import from `shared` into `features`, and no deep import into another feature's internals.
- [ ] Cross-feature use goes through a public entry point or app-level composition.
- [ ] New feature registered at exactly one route entry (plus nav if needed); lazy-loaded if sibling features are.
- [ ] Feature-scoped Angular services are provided on the route, not `providedIn: 'root'`, unless they are true singletons.
- [ ] No unrelated file moves or renames in the diff.
- [ ] Type-check, lint (including boundary rules), tests, and build pass.

## References

- Angular routing and lazy loading: https://angular.dev/guide/routing
- Angular dependency injection, route providers: https://angular.dev/guide/di
- React Router lazy routes: https://reactrouter.com/
- ESLint `no-restricted-imports`: https://eslint.org/docs/latest/rules/no-restricted-imports
