---
name: frontend-error-handling
description: Classify, surface, and report errors in React and Angular apps - error taxonomy (network, HTTP 4xx/5xx, validation, unexpected), React error boundaries and root error callbacks, Angular ErrorHandler and global listeners, user-facing messages vs logs, toast vs inline vs page-level display, monitoring hooks, and never swallowing errors. Use when adding error handling to a feature, setting up a global error handler or error boundary, deciding how to show an error to users, wiring Sentry or another monitoring tool, fixing silent failures or empty catch blocks, or when the user asks how errors should be handled.
license: MIT
metadata:
  category: shared
  version: "1.0.0"
  frameworks: "react 18-19, angular 17+, react-error-boundary 6"
  last-reviewed: "2026-11-25"
---

# Frontend Error Handling

## Purpose

Make every failure either handled where it can be recovered, or reported where it cannot — never both missing. Good looks like: errors are classified into a small typed taxonomy; users see a short, actionable message in the right place (field, section, toast, or full page); developers get the full error with context in monitoring; a render crash in one widget does not blank the whole app; and no `catch` block silently drops an error.

## When to Use

- Adding error states to a feature, form, or data view.
- Setting up or changing React error boundaries, React 19 root error callbacks, or Angular `ErrorHandler`.
- Wiring a monitoring tool (Sentry, Datadog, Application Insights, OpenTelemetry).
- Deciding between toast, inline, banner, or full-page error.
- Finding and fixing empty `catch`, swallowed promise rejections, or `console.log`-only handling.

Do not use when: building the HTTP client and mapping HTTP responses to `AppError` (see `frontend-api-integration`), or form field validation rules (see `react-forms` / `angular-reactive-forms`).

## Workflow

1. **Detect**
   - Framework versions: React 19 adds `createRoot` options `onCaughtError` and `onUncaughtError` (`onRecoverableError` exists since 18); Angular 20 adds `provideBrowserGlobalErrorListeners()`.
   - Existing pieces: `ErrorBoundary` components or `react-error-boundary`; custom `ErrorHandler` provider; monitoring SDK init (`Sentry.init`, etc.); toast/notification service; an `AppError` type in the API layer.
   - Data layer: TanStack Query `throwOnError` / global `QueryCache({ onError })`; Angular `resource`/`httpResource` `error()` signals; NgRx effects error actions.
2. **Classify** each failure path with the taxonomy below and pick its display location from the decision table.
3. **Implement** at the right layer: map at the API edge, decide display in the feature, catch render crashes with boundaries, report uncaught errors in the global handler. Reuse the existing toast and monitoring services.
4. **Verify** — force each error type (offline mode in devtools, mock 403/404/422/500, throw in a component) and confirm: correct UI, one report in monitoring (not duplicated), no sensitive data in the report, app remains usable.

## Best Practices

### Taxonomy

| Kind | Typical source | Recoverable? | Default display | Report to monitoring? |
| --- | --- | --- | --- | --- |
| `network` / `timeout` | offline, DNS, CORS, status 0 | yes, retry | banner or inline with Retry | no (or sampled) |
| `cancelled` | AbortController, navigation | n/a | nothing | no |
| `unauthorized` (401) | session expired | yes, re-login | redirect to login once | no |
| `forbidden` (403) | missing permission | no | inline "no access" or page | yes, low severity |
| `not-found` (404) | deleted/wrong ID | no | page-level not found | no, unless an internal link caused it |
| `validation` (400/422) | bad input | yes, fix input | inline next to fields | no |
| `conflict` (409) | stale edit | yes, reload/merge | inline with reload action | no |
| `rate-limited` (429) | throttling | yes, wait | toast | sampled |
| `server` (5xx) | backend failure | maybe, retry | inline section error or toast | yes |
| `unexpected` | bugs, bad data, render crashes | no | error boundary fallback | yes, high severity |

The API layer produces these as an `AppError` with `kind`, `status`, and `cause`. UI code switches on `kind`, never on raw status codes or library error classes.

### Where to show it

- **Inline (field)**: validation errors tied to inputs. Associate with the field (`aria-describedby`, `aria-invalid="true"`) and move focus to the first invalid field or an error summary on submit.
- **Inline (section)**: a widget/list failed to load. Show message + Retry in place of the content; the rest of the page keeps working.
- **Toast**: result of a user action that has no natural location (background save failed, rate limited). Toasts must not be the only record of something the user needs to fix, and must be announced (`role="status"` for info, `role="alert"` for errors) and not auto-dismiss too fast for reading.
- **Page-level**: route data required for the page is missing (404, 403) or the route component crashed.
- **Nothing**: cancellations and errors already handled by a retry that then succeeded.

### User messages vs logs

- User message: what happened in plain language, and what to do next. No stack traces, status codes, SQL, internal IDs, or backend exception text unless the API marks it user-safe.
- Include a correlation/request ID in the UI for `server`/`unexpected` errors if the backend provides one, so support can find logs.
- Log/report: the original error (`cause`), stack, component stack (React) or component type (Angular), route, release version, user action. Scrub tokens, passwords, emails, and PII before sending; configure the monitoring SDK's scrubbing (`beforeSend` or equivalent).
- Do not report expected outcomes (validation, 401, cancellation) as errors — they drown real ones and cost quota.

### React

- Error boundaries catch errors during rendering, in lifecycle methods, and in constructors of the tree below them. They do not catch errors in event handlers, async code (`setTimeout`, promises), SSR, or in the boundary itself.
- Error boundaries are still class components (no hook equivalent in React 19). Use `react-error-boundary` if installed, or a small class with `getDerivedStateFromError` + `componentDidCatch`.
- Place boundaries at: app root (last resort), each route (so navigation recovers), and around independent widgets (dashboard cards, third-party embeds).
- Reset boundaries when the cause may be gone: `resetKeys={[location.pathname]}` or a Retry button that also refetches.
- Route async and event-handler errors into a boundary with `useErrorBoundary().showBoundary(error)` (react-error-boundary) only when the error should replace the UI; otherwise set local error state.
- React 19: `createRoot(el, { onCaughtError, onUncaughtError, onRecoverableError })` is the single place to report to monitoring. Then `componentDidCatch`/`onError` in boundaries does not also need to report (avoid duplicates). React 18: report from the boundary's `componentDidCatch`.
- In development React re-throws/logs caught errors to the console; this is expected, not a missing handler.
- TanStack Query: errors are returned in `error`/`isError`; set `throwOnError` to let a boundary handle them. Use `QueryCache({ onError })` / `MutationCache({ onError })` for global toasts on background failures instead of per-hook duplication.

### Angular

- `ErrorHandler` receives errors thrown from framework-invoked code (constructors, lifecycle hooks, template event listeners, change detection) and errors that reach `AsyncPipe`. It does not see errors you catch yourself, nor errors in subscriptions you create manually unless you rethrow them.
- Angular 20+: `provideBrowserGlobalErrorListeners()` forwards `window` `error` and `unhandledrejection` events to `ErrorHandler`; new CLI apps include it. On 17–19, add those listeners yourself or rely on the monitoring SDK's global handlers.
- Replace the default handler with `{ provide: ErrorHandler, useClass: AppErrorHandler }`. Keep it small: report, then optionally notify. It must never throw.
- The handler runs outside normal flow; to show UI, call a lightweight service that updates a signal. Keep its dependencies minimal — `ErrorHandler` is created early and is used while other providers may still be failing to construct.
- Handle expected errors locally: `catchError` in the service/store that owns the state, set an error signal, return a fallback. `resource`/`httpResource` expose `error()` and `status()` — render them; those errors do not reach `ErrorHandler`.
- Angular 22.2 typings add a developer-preview hook for view errors caught by an error boundary (`ErrorHandler.onViewError(error, details)`, with `details.boundary.reset()`). Preview APIs can change; read the angular.dev docs for the installed version before adopting, and keep component-level error states on stable APIs.

### Never swallow

- Every `catch` does one of: recover (fallback value with a reason in a comment), convert (wrap in `AppError` with `cause` and rethrow), or report and surface. Empty `catch {}` is allowed only for documented expected failures (e.g. corrupt `localStorage`).
- Every promise is awaited, returned, or explicitly handled (`void promise.catch(report)`). Enable `@typescript-eslint/no-floating-promises` if the project lint config allows.
- RxJS: `catchError(() => EMPTY)` silences failure — only use after reporting or setting error state.
- Do not replace errors with `console.log`; console output is invisible in production.

## Anti-patterns

- `catch (e) {}` or `.catch(() => {})` — failure vanishes, user sees a stuck spinner — set error state and/or report.
- One root error boundary only — any widget crash blanks the whole app — add route and widget boundaries.
- `toast(error.message)` with raw server text — leaks internals and confuses users — map `kind` to a message.
- Toast for validation errors — user cannot see which field is wrong after it fades — inline field errors.
- Reporting 401/422/cancelled to monitoring — alert noise hides real defects — filter expected kinds.
- Reporting the same error in `componentDidCatch`, `onCaughtError`, the HTTP interceptor, and the global handler — 4 events per failure — choose one reporting point per path.
- `ErrorHandler.handleError` that navigates to an error page for every error — a background analytics failure kills the session — only navigate for fatal, route-level failures.
- Error boundary fallback without a way out — user is stuck — provide Retry and a link home.
- `throw 'Something failed'` (string) — no stack, `instanceof Error` checks fail — throw `Error`/`AppError` instances.
- Sending full request bodies or user objects to monitoring — PII leak — scrub and allowlist fields.

## Implementation Examples

### React: reusable boundary with react-error-boundary 6

```tsx
// src/core/errors/SectionBoundary.tsx
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import type { ReactNode } from 'react';
import { userMessage } from './user-message';

function SectionFallback({ error, resetErrorBoundary }: FallbackProps) {
  // v6 types `error` as unknown — do not assume Error
  return (
    <div role="alert" className="section-error">
      <p>{userMessage(error)}</p>
      <button type="button" onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

export function SectionBoundary({ children, resetKeys }: { children: ReactNode; resetKeys?: unknown[] }) {
  return (
    <ErrorBoundary FallbackComponent={SectionFallback} resetKeys={resetKeys}>
      {children}
    </ErrorBoundary>
  );
}
```

```ts
// src/core/errors/user-message.ts
import { AppError } from '@/core/api/app-error';

export function userMessage(error: unknown): string {
  if (!(error instanceof AppError)) return 'Something went wrong. Please try again.';
  switch (error.kind) {
    case 'network': case 'timeout': return 'You appear to be offline. Check your connection and retry.';
    case 'forbidden': return 'You do not have access to this content.';
    case 'not-found': return 'This item no longer exists.';
    case 'conflict': return 'Someone else changed this. Reload to see the latest version.';
    case 'rate-limited': return 'Too many requests. Please wait a moment.';
    default: return 'Something went wrong. Please try again.';
  }
}
```

No library installed? A minimal class boundary:

```tsx
// src/core/errors/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { fallback: (reset: () => void) => ReactNode; children: ReactNode; onError?: (error: unknown, info: ErrorInfo) => void }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State { return { hasError: true }; }
  componentDidCatch(error: unknown, info: ErrorInfo) { this.props.onError?.(error, info); }
  reset = () => this.setState({ hasError: false });
  render() { return this.state.hasError ? this.props.fallback(this.reset) : this.props.children; }
}
```

### React 19: single reporting point at the root

```tsx
// src/main.tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { report } from './core/errors/report';

const container = document.getElementById('root');
if (!container) throw new Error('#root element missing from index.html');

createRoot(container, {
  onCaughtError: (error, info) => report(error, { componentStack: info.componentStack, handled: true }),
  onUncaughtError: (error, info) => report(error, { componentStack: info.componentStack, handled: false }),
  onRecoverableError: (error) => report(error, { level: 'warning' }),
}).render(<App />);
```

React 18 has `onRecoverableError` only; `onCaughtError`/`onUncaughtError` arrived in React 19. On 18, report from boundaries' `componentDidCatch` plus `window` `error`/`unhandledrejection` listeners (or the monitoring SDK's global handlers).

### Reporting adapter (framework-neutral)

```ts
// src/core/errors/report.ts
import { AppError } from '@/core/api/app-error';

const EXPECTED = new Set(['cancelled', 'unauthorized', 'validation', 'not-found', 'network', 'timeout']);

export function report(error: unknown, context: Record<string, unknown> = {}): void {
  if (error instanceof AppError && EXPECTED.has(error.kind)) return;
  // Replace with the project's SDK call, e.g. Sentry.captureException(error, { extra: context }).
  // Keep SDK imports here so features never depend on the vendor directly.
  console.error('[report]', error, context);
}
```

### Angular: custom ErrorHandler

```ts
// src/app/core/errors/app-error-handler.ts
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { NotificationService } from '../notifications/notification.service';
import { report } from './report';

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly notifications = inject(NotificationService);

  handleError(error: unknown): void {
    try {
      report(error, { source: 'angular' });
      this.notifications.error('Something went wrong. Please try again.');
    } catch {
      // The handler must never throw; fall back to the console as last resort.
      console.error(error);
    }
  }
}
```

```ts
// src/app/app.config.ts
import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { AppErrorHandler } from './core/errors/app-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(), // Angular 20+; on 17-19 register window listeners manually
    { provide: ErrorHandler, useClass: AppErrorHandler },
  ],
};
```

### Angular: local, expected error state with signals

```ts
// src/app/features/orders/orders.store.ts
import { Injectable, inject, signal } from '@angular/core';
import { catchError, EMPTY, finalize } from 'rxjs';
import { OrdersApi } from './orders.api';
import type { Order } from './order.model';
import { AppError } from '../../core/api/app-error';

@Injectable()
export class OrdersStore {
  private readonly api = inject(OrdersApi);
  readonly orders = signal<Order[]>([]);
  readonly error = signal<AppError | null>(null);
  readonly loading = signal(false);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().pipe(
      catchError((e: unknown) => {
        // Expected failure: surface it in state instead of letting it reach ErrorHandler.
        this.error.set(e instanceof AppError ? e : new AppError('unexpected', 'Load failed', undefined, undefined, { cause: e }));
        return EMPTY;
      }),
      finalize(() => this.loading.set(false)),
    ).subscribe((orders) => this.orders.set(orders));
  }
}
```

Template: `@if (store.error(); as err) { <p role="alert">…</p><button (click)="store.load()">Retry</button> }`.

## Validation Checklist

- [ ] Every new failure path is classified (`kind`) and has a defined display: field, section, toast, page, or none.
- [ ] No empty `catch`, `.catch(() => {})`, or `catchError(() => EMPTY)` without reporting or state update.
- [ ] React: boundaries at root, per route, and around independent widgets; fallbacks offer retry; reset on navigation.
- [ ] React 19 uses root error callbacks for reporting; React 18 reports from boundaries — not both.
- [ ] Angular: custom `ErrorHandler` reports and never throws; global listeners enabled (20+) or added manually.
- [ ] User messages are plain, actionable, and contain no server internals.
- [ ] Monitoring excludes expected kinds and scrubs tokens/PII; each failure reported once.
- [ ] Error UI is accessible: `role="alert"` or field association, focus moved on submit failure.
- [ ] Manually exercised offline, 403, 404, 422, 500, and a thrown render error.

## References

- React error boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
- React `createRoot` options: https://react.dev/reference/react-dom/client/createRoot
- react-error-boundary: https://github.com/bvaughn/react-error-boundary
- Angular error handling: https://angular.dev/best-practices/error-handling
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
