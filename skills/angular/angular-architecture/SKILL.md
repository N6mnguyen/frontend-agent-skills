---
name: angular-architecture
description: Design Angular application structure, feature boundaries, route loading, provider scope, environment configuration, and dependency direction. Use when adding features, routes, modules, providers, or reorganizing an Angular app.
license: MIT
metadata:
  category: angular
  version: "1.0.0"
  frameworks: "Angular 17+"
  last-reviewed: "2026-11-25"
---

# Angular Architecture

## Purpose

Structure Angular apps around cohesive features, explicit route boundaries, and deliberate dependency scope. Preserve a project's existing conventions, including legacy NgModules and CoreModule patterns.

## When to Use

- Adding an application feature, route tree, provider, or environment-specific configuration.
- Reviewing folder structure, dependency direction, lazy loading, or service lifetime.

Do not use when: the task is limited to a component's API (see `angular-standalone-components`) or HTTP implementation (see `angular-http`).

## Workflow

1. **Detect first** — inspect `package.json` and lockfile for the actual `@angular/core` version. Inspect bootstrapping (`main.ts`, `app.config.ts`, `AppModule`), `angular.json`, routes, providers, and representative features. Record standalone vs NgModule, zoneless vs `zone.js`, signal usage, `@if`/`@for` vs structural directives, `inject()` vs constructor DI, and `application`/esbuild vs `browser`/webpack. Do not migrate patterns incidentally.
2. **Version matrix** — API differences that matter to architecture:

   | Angular | Architecture considerations |
   |---|---|
   | 17 | Standalone is supported, not required; `@if`/`@for` available. Keep existing NgModule bootstrap if used. |
   | 18 | Standalone and NgModule bootstraps both supported; zoneless is opt-in. |
   | 19 | Components/directives/pipes standalone by default; NgModule declarations must explicitly set `standalone: false`. |
   | 20 | New CLI may prompt for zoneless; inspect `angular.json` rather than assuming mode. |
   | 21 | New apps zoneless by default. |
   | 22 | Webpack builders deprecated; new CLI uses `@angular/build`. Existing `browser` builder still supported during migration; do not convert without need. |

3. **Choose boundary** — follow existing naming and grouping. Prefer `feature/` areas with their routes, screens, data access, and feature-only UI together. Avoid global folders that mix unrelated feature internals.
4. **Load routes** — use `loadChildren` for a route configuration or legacy/larger feature module; use `loadComponent` for a standalone screen. Keep route definitions in a feature routes file and export a typed `Routes` value. Use eager loading only when startup behavior justifies it.
5. **Place providers** — use `app.config.ts` / `ApplicationConfig` for standalone root providers; `AppModule.providers` for module bootstrap. Route providers scope feature services to that route tree; component providers scope instances to component subtrees. Root `providedIn: 'root'` is for app-wide singleton lifetime.
6. **Preserve conventions** — retain `CoreModule`/`SharedModule` where the app already uses them; don't re-add singleton providers in shared modules. Keep environment configuration non-secret and avoid importing environment files across feature boundaries.
7. **Verify** — run the repository's build, lint, and tests. Verify lazy chunks, route guards, provider instance scope, and production configuration.

## Best Practices

- Feature code depends inward on shared primitives; shared code must not import feature implementations.
- Keep domain-specific components, routes, and data access next to the feature; promote code only after real reuse emerges.
- Use route-level providers for route-scoped state and expensive feature services; destroy with route injector lifetime.
- Keep presentational components focused on inputs, outputs, and rendering; put orchestration in a page/container or feature facade when complexity warrants it.
- Use `loadComponent` with standalone route screens and `loadChildren` with `Routes` files or modules; both support lazy route boundaries.
- Keep app-wide providers, interceptors, and error handlers at root; feature-only providers belong at route/component scope.
- Environment files contain public build-time configuration only; secrets belong on servers.
- In legacy NgModule apps, `CoreModule` may enforce singleton providers, `SharedModule` may export reusable declarations; honor local conventions.
- Prefer route-level feature configuration over a monolithic root route file once route ownership becomes a coordination problem.
- Keep dependency direction acyclic: UI → feature/application logic → domain/data contracts; shared utility code must not reach upward into screens.

## Anti-patterns

- Rewriting the app to standalone solely because it is newer — retain working module architecture.
- Loading every feature eagerly — lazy-load meaningful route boundaries.
- Providing a supposedly singleton service in multiple lazy modules or components — decide intended lifetime explicitly.
- Putting all code in `shared/` — use shared only for independently reusable behavior.
- Importing a feature service from another feature — extract a stable contract or compose at a higher application boundary.
- Storing secrets in environment files — client bundles are inspectable.
- Adding providers to a shared NgModule — can create surprising or duplicate instances.
- Mixing route declarations, data services, and unrelated UI in a root module — assign ownership by feature.

## Implementation Examples

```ts
// src/app/orders/orders.routes.ts
import { Routes } from '@angular/router';

export const ORDERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/order-list.page').then(m => m.OrderListPage),
  },
  {
    path: ':orderId',
    providers: [], // Feature-scoped providers go here when needed.
    loadComponent: () => import('./pages/order-detail.page').then(m => m.OrderDetailPage),
  },
];
```

```ts
// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  { path: 'orders', loadChildren: () => import('./orders/orders.routes').then(m => m.ORDERS_ROUTES) },
  { path: '', pathMatch: 'full', redirectTo: 'orders' },
];
```

For a module-bootstrapped project, use `RouterModule.forRoot(...)` and lazy `loadChildren` module routes according to its existing setup; do not mix bootstrap models as incidental cleanup.

### Route and provider decisions

- Split routes when a feature owns multiple screens, guards, resolvers, or providers; keep tiny route trees inline only when project convention favors it.
- `loadChildren` can import a `Routes` array (standalone routing) or an NgModule; do not confuse the symbol returned by dynamic import.
- Route-level providers are available to descendants and guards/resolvers on that route; avoid relying on teardown timing for application correctness.
- Component providers are appropriate for isolated per-instance editors, dialogs, and embedded widgets; `viewProviders` additionally hide providers from projected content.
- Keep a root `CoreModule` imported once in legacy apps. Do not import a provider-bearing CoreModule from lazy modules.
- Shared NgModules should export declarations needed by consumers; avoid importing `BrowserModule` outside the root module.
- A page component may coordinate feature state; presentational components should not inject global API clients unless the repository deliberately uses that pattern.
- Avoid cycles where feature A imports feature B and B imports A. Extract genuinely shared types or compose at route/application boundary.
- Group shared UI by actual ownership (`shared/ui`, `shared/data-access`) only when project scale makes the division useful.
- Do not create a global barrel that re-exports every feature; it can hide dependency direction and defeat lazy chunking.
- Environment replacement files are build-time constants, not runtime environment discovery. Use an API endpoint or server-injected runtime config when deployment values vary after build.
- Keep `main.ts` small: bootstrap the root module or application and import global polyfills/styles; application providers belong in app config or root module.
- Do not mix `bootstrapApplication` and `platformBrowserDynamic().bootstrapModule` in one entry path.
- New CLI builder defaults are not architecture requirements. Angular 22 deprecates webpack builders; migrate only as a separately scoped change after checking custom builders and plugins [VERIFY].

### Route ownership and application boundaries

- Use route `data` for static navigation metadata (title, breadcrumb labels); do not store mutable authorization state there.
- Put reusable URL parsing and route parameter validation in feature resolvers or page boundary logic, not scattered template expressions.
- Keep route guards fast and side-effect-light; a guard returning a redirect is clearer than imperatively navigating from inside it.
- Use `CanMatch` when a route should be considered unavailable and another route with the same path may match; use `CanActivate` when route matching is valid but activation is conditional.
- Keep resolvers focused on data required before rendering. For non-critical data, load after route activation to avoid blocking navigation.
- A route file may export `FEATURE_ROUTES` and be lazy-loaded by parent `loadChildren`; name exports consistently with project style.
- Lazy loading is a chunking decision, not a folder naming trick. Confirm the builder emits distinct chunks when bundle boundaries matter.
- Avoid importing eager root route files from feature routes; use one-way route ownership and lazy dynamic imports.
- Use a feature facade only if it reduces coordination in multiple consumers; don't create a facade that merely renames an API service.
- Separate domain types from presentation DTOs only when they have different validation or lifecycle; needless mapping increases drift.
- Keep API clients and caching behavior in data-access boundaries; components should not own URL construction or transport retry logic.
- A shared component should expose a small stable input/output contract; avoid importing feature models from a global shared UI library.
- Root providers are shared across route navigation; route providers can preserve state while navigating within that route tree, but verify router reuse behavior before depending on reset timing.
- A component provider makes the instance available to the component, descendants, and its view; `viewProviders` excludes projected content.
- Provider arrays are hierarchical: a nearer provider shadows the same token from ancestors; this is often intentional for editor/session state.
- Prefer `providedIn: 'root'` for tree-shakable root services over listing every singleton in a module provider array.
- In standalone bootstrap, provide `provideRouter(APP_ROUTES)` in root configuration. In NgModule bootstrap, configure `RouterModule.forRoot` exactly once; feature modules use `forChild`.
- In standalone mode, `importProvidersFrom()` is an interoperability bridge for NgModules, not a reason to recreate a module architecture.
- Environment-specific configurations should preserve the same shape across development, test, and production to avoid conditional import drift.
- Never place credentials or private service keys in `environment.ts`; shipped source maps and bundles can expose them.
- Runtime settings that must vary without rebuilding can be fetched once during app initialization or injected by the host; account for SSR transfer/hydration separately.
- Use aliases (`@app/*`) only when repository TypeScript paths and test/builder resolvers agree; relative imports are safer in small features.
- Avoid wildcard barrel exports at feature boundaries when they make cycles or route chunk inclusion hard to diagnose.
- Enforce dependency direction with lint rules when repo already has boundaries; do not add a bespoke architecture tool for one isolated feature.

### Module and standalone route patterns

- A standalone root uses `bootstrapApplication(AppComponent, appConfig)`; an NgModule root uses `platformBrowserDynamic().bootstrapModule(AppModule)`. Keep one boot path.
- `provideRouter(APP_ROUTES)` belongs in root application providers; `RouterModule.forRoot(APP_ROUTES)` belongs in the root NgModule and must appear once.
- Lazy standalone route files export `Routes`; a lazy NgModule exposes its module class. Do not return both shapes from one loader.
- `loadComponent` expects a component class; ensure the component is standalone in Angular 17–18 and explicitly standalone where needed.
- For route files, choose `orders.routes.ts` or existing route naming rather than inventing parallel aliases.
- Keep route paths relative to their parent; avoid repeating parent prefixes in child route declarations.
- Use a wildcard route last; lazy route order matters because router matching is ordered.
- Put route-specific `providers` on the parent feature route when multiple child pages share the instance.
- A root-level wildcard should not accidentally absorb server-side or static asset paths; follow deployment routing configuration.
- Keep `RouterOutlet` in the shell only where child views render; feature pages should not nest outlets without a nested route tree.
- Route titles, breadcrumbs, and navigation labels belong near route definitions when static; dynamic titles can use a `TitleStrategy`.
- Avoid putting arbitrary services or component instances in route `data`; use typed providers/resolvers for runtime dependencies.

### Environment and workspace checks

- Read `angular.json` builder names before suggesting a builder migration: `@angular-devkit/build-angular:browser`, `@angular-devkit/build-angular:application`, and `@angular/build:application` have different options.
- Angular 22 deprecates webpack builders; custom webpack plugins/loaders need an explicit migration plan, not a mechanical string replacement.
- The application builder uses esbuild; it does not imply every app has SSR or server routes.
- Check workspace root `tsconfig` path aliases and project references before moving files; feature moves can break test and build resolvers.
- Inspect `polyfills` and `zone.js` entries to identify scheduling mode; dependencies may still require ZoneJS even when Angular uses zoneless scheduling.
- Check `main.ts` imports for root providers wired outside `app.config.ts`; avoid configuring the same feature twice.
- If environment config differs by file replacement, verify every replacement defines the same keys and types.
- If using runtime config fetched at startup, model unavailable/error/loading behavior; don't block all rendering accidentally.
- Avoid exposing deployment secrets even in `environment.development.ts`; all environment files are client source.
- Use lint boundary rules already in the repo to enforce feature dependencies; architecture labels without enforcement are not contracts.

## Validation Checklist

- [ ] Confirmed installed Angular version and all detected project conventions.
- [ ] Route files own feature routing; meaningful features load lazily.
- [ ] Provider scope matches desired service lifetime.
- [ ] Shared code has no dependencies on feature internals.
- [ ] Legacy CoreModule/SharedModule conventions remain intact.
- [ ] Environment configuration contains no secrets; build and tests pass.
