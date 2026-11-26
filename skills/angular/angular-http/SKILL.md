---
name: angular-http
description: Configure Angular HttpClient, interceptors, auth refresh, error mapping, retries, typed APIs, uploads/downloads, XSRF, route guards, and permission directives. Use when calling backend APIs, adding interceptors or auth headers, protecting routes, or handling file transfer in Angular.
license: MIT
metadata:
  category: angular
  version: "1.0.0"
  frameworks: "Angular 17+; RxJS 7"
  last-reviewed: "2026-11-25"
---

# Angular HTTP

## Purpose

Keep HTTP behavior typed, predictable, and centrally configured: one `provideHttpClient` call, functional interceptors in a deliberate order, typed API models at the edge, and auth/error handling that never leaks tokens or retries unsafe writes. Legacy class interceptors and `HttpClientModule` setups keep working; change them only when the task requires it.

## When to Use

- Adding or changing `provideHttpClient`, interceptors, auth headers, token refresh, error mapping, or retries.
- Writing typed API services, pagination, file upload/download, or XSRF configuration.
- Adding functional route guards with role checks or a permission structural directive.

Do not use when: the question is generic API-layer design shared with React (see `frontend-api-integration`), security policy beyond the HTTP client (see `frontend-security`), or stream operator choice (see `rxjs-patterns`).

## Workflow

1. **Detect** — read `@angular/core` and `@angular/common` versions in `package.json`. Find how HTTP is provided: `provideHttpClient(...)` in `app.config.ts` / `main.ts`, or `HttpClientModule` in an NgModule. List existing interceptors (`HttpInterceptorFn` vs classes registered with `HTTP_INTERCEPTORS`), guards (functions vs classes), and whether the app is standalone or NgModule, zoneless or zone.js, signals or Observables, `@if` or `*ngIf`, `inject()` or constructor DI, `application` or `browser` builder.
2. **Check the version table** before writing code:

   | Angular | HTTP and router notes |
   |---|---|
   | 17 | `provideHttpClient`, `withInterceptors`, `withFetch` available; XHR is the default backend. `HttpClientModule` not deprecated yet. |
   | 18 | `HttpClientModule`, `HttpClientXsrfModule`, and `HttpClientJsonpModule` deprecated; use `provideHttpClient` in new code. Guards may return `RedirectCommand`. |
   | 19 | `httpResource` introduced as experimental in 19.2. |
   | 20 | No backend default change; `httpResource` remains experimental. |
   | 21 | Same HTTP defaults as 20; `httpResource` remains experimental. |
   | 22 | Fetch is the default backend; `withFetch()` is deprecated and can be removed. Upload progress needs `withXhr()`. `reportProgress` deprecated in favour of `reportUploadProgress` / `reportDownloadProgress`. `httpResource` stable. `CanMatchFn` third arg `currentSnapshot` is part of the type. JSONP deprecated (22.2). |

3. **Decide**:
   - Standalone bootstrap: one `provideHttpClient(...)` with features. NgModule bootstrap: `provideHttpClient(...)` can go into `AppModule.providers`; keep `HttpClientModule` if replacing it is out of scope.
   - Existing class interceptors: keep them and add `withInterceptorsFromDi()`; write new interceptors as functions in `withInterceptors([...])`. Functional interceptors run in array order; DI interceptors run in registration order, which is harder to reason about.
   - Upload progress on 22+: add `withXhr()` (fetch cannot report upload progress). On 17–21 the default XHR backend reports it unless the app opted into `withFetch()`.
4. **Implement** the smallest change in the existing API layer (see Implementation Examples and [references/http-recipes.md](references/http-recipes.md)).
5. **Verify** — `ng build`, unit tests with `provideHttpClientTesting()` + `HttpTestingController`, and a manual check that 401 refresh, error mapping, and guards behave in the browser network tab.

## Best Practices

- One `provideHttpClient` per injector. A second call in a lazy route creates a separate client whose interceptors do not include root ones unless `withRequestsMadeViaParent()` is used.
- Order interceptors deliberately: request-id/logging, then auth, then error mapping. The first listed sees the request first and the response last.
- Interceptors call `inject()` at the top of the function body (it runs in an injection context); never inside `pipe` callbacks.
- Attach auth headers only to your own API origin. Check the URL against a configured base URL; never send bearer tokens to third-party hosts.
- Use `HttpContextToken` for per-request flags (skip auth, skip error toast, allow retry) instead of magic headers or URL patterns.
- Token refresh is single-flight: concurrent 401s share one refresh request; retry the original request once; on refresh failure, clear the session and route to login.
- Retry only idempotent methods (GET, HEAD, OPTIONS, PUT/DELETE when the API guarantees idempotency) and only for network errors / 502 / 503 / 504, with backoff via `retry({ count, delay })`. Never auto-retry POST.
- Map `HttpErrorResponse` to an app error type in one place; components handle domain errors, not status codes.
- Type responses at the call site: `http.get<OrderDto[]>(...)`. The generic is a compile-time assertion only; validate at runtime (for example with a schema) for untrusted or versioned APIs.
- Build query strings with `HttpParams` (immutable; each `.set` returns a new instance) or a `params` object; never concatenate user input into URLs.
- Downloads: `responseType: 'blob'` with `observe: 'response'` to read `Content-Disposition`; revoke object URLs after use.
- XSRF: built-in protection reads cookie `XSRF-TOKEN` and sends header `X-XSRF-TOKEN` on mutating requests to relative/same-origin URLs. Rename with `withXsrfConfiguration`; disable only with `withNoXsrfProtection()` when the backend uses another CSRF defence.
- Guards: use `CanActivateFn` / `CanMatchFn` functions with `inject()`; redirect by returning a `UrlTree` (or `RedirectCommand` on 18+), never by calling `router.navigate` and returning `false`. Prefer `canMatch` for role-gated lazy routes so unauthorized users don't download the chunk.
- Client-side guards and `*hasPermission` only shape UX. The server must enforce authorization on every endpoint.
- `httpResource` suits signal-driven reads in components; use `HttpClient` for writes and complex stream composition. Mark it experimental below v22.

## Anti-patterns

- Class interceptors in new code without `withInterceptorsFromDi()` — they are silently ignored. Write a functional interceptor instead.
- Refreshing the token in every concurrently failing request — parallel refresh calls race and may invalidate each other. Share one in-flight refresh.
- Retrying 401/403/4xx or non-idempotent requests — duplicate writes and lockouts. Restrict by method and status.
- Catching errors in the interceptor and returning `EMPTY` — callers never complete or learn about failure. Re-throw a mapped error.
- Storing access tokens in `localStorage` because it is convenient — XSS can read it. Prefer HttpOnly cookies or in-memory tokens per the `frontend-security` skill.
- `reportProgress: true` on Angular 22 — deprecated; use `reportUploadProgress` / `reportDownloadProgress`. Keep it on 17–21.
- Adding `withFetch()` to a new Angular 22 app — deprecated no-op; fetch is already the default.
- Hiding a button with `*hasPermission` and treating that as security.

## Implementation Examples

```ts
// src/app/app.config.ts (standalone, Angular 22)
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { APP_ROUTES } from './app.routes';
import { authInterceptor } from './core/http/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(APP_ROUTES),
    provideHttpClient(
      withInterceptors([errorInterceptor, authInterceptor]),
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
      // Angular 17–21: add withFetch() only if the project already chose fetch.
      // Angular 22+: add withXhr() only if upload progress is required.
    ),
  ],
};
```

```ts
// src/app/core/http/http-context.ts
import { HttpContextToken } from '@angular/common/http';

export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
export const RETRY_IDEMPOTENT = new HttpContextToken<boolean>(() => true);
```

```ts
// src/app/core/http/error.interceptor.ts
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, retry, throwError, timer } from 'rxjs';
import { RETRY_IDEMPOTENT } from './http-context';

export interface AppHttpError {
  readonly kind: 'network' | 'unauthorized' | 'forbidden' | 'not-found' | 'validation' | 'server';
  readonly status: number;
  readonly message: string;
  readonly details?: unknown;
}

const IDEMPOTENT = new Set(['GET', 'HEAD', 'OPTIONS']);
const TRANSIENT = new Set([0, 502, 503, 504]);

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const canRetry = IDEMPOTENT.has(req.method) && req.context.get(RETRY_IDEMPOTENT);
  return next(req).pipe(
    retry({
      count: canRetry ? 2 : 0,
      delay: (error: unknown, attempt) =>
        error instanceof HttpErrorResponse && TRANSIENT.has(error.status)
          ? timer(300 * 2 ** attempt)
          : throwError(() => error),
    }),
    catchError((error: unknown) => throwError(() => toAppError(error))),
  );
};

function toAppError(error: unknown): AppHttpError | unknown {
  if (!(error instanceof HttpErrorResponse)) return error;
  const kind: AppHttpError['kind'] =
    error.status === 0 ? 'network'
    : error.status === 401 ? 'unauthorized'
    : error.status === 403 ? 'forbidden'
    : error.status === 404 ? 'not-found'
    : error.status === 400 || error.status === 422 ? 'validation'
    : 'server';
  return { kind, status: error.status, message: error.message, details: error.error };
}
```

```ts
// src/app/orders/data/order-api.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/http/api-base-url';

export interface OrderDto { readonly id: string; readonly total: number; readonly status: 'open' | 'paid'; }
export interface Page<T> { readonly items: readonly T[]; readonly total: number; }
export interface OrderQuery { readonly page: number; readonly pageSize: number; readonly status?: OrderDto['status']; }

@Injectable({ providedIn: 'root' })
export class OrderApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(query: OrderQuery): Observable<Page<OrderDto>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.status) params = params.set('status', query.status);
    return this.http.get<Page<OrderDto>>(`${this.baseUrl}/orders`, { params });
  }
}
```

```ts
// src/app/core/http/api-base-url.ts
import { InjectionToken } from '@angular/core';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', { factory: () => '/api' });
```

```ts
// src/app/core/auth/role.guard.ts
import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

export function roleGuard(...roles: readonly string[]): CanMatchFn {
  return () => {
    const auth = inject(AuthStore);
    const router = inject(Router);
    if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
    return roles.some(role => auth.roles().includes(role)) || router.createUrlTree(['/forbidden']);
  };
}

// Usage in routes:
// { path: 'admin', canMatch: [roleGuard('admin')], loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES) }
```

More recipes — single-flight token refresh, file upload with progress per version, Blob download, `*hasPermission` directive, legacy class interceptor, `httpResource`, and tests: [references/http-recipes.md](references/http-recipes.md).

### Additional HTTP decisions

- Use `HttpContextToken` for typed opt-outs; context is mutable and persists across retries, so avoid using it as cross-request state.
- A skip-auth flag should apply only to exact login/refresh endpoints; never make a generic caller-controlled flag bypass origin validation.
- Define the API origin from trusted build/runtime config and compare parsed `URL.origin` plus API path prefix; raw `startsWith` can accept lookalike hosts.
- Interceptor bodies are assumed immutable by Angular; clone the request when changing headers, params, or context. Avoid mutating body objects because retries may reuse them.
- Interceptors should remain idempotent. A request may pass through again after retry or token refresh.
- `catchError` inside `switchMap` keeps a long-lived UI input stream alive; the outer stream should not complete after a single API error.
- Refresh token endpoints should use secure server-managed HttpOnly cookies where architecture supports them; never store refresh tokens in localStorage.
- Single-flight refresh must clear its in-flight reference after both success and failure, and all concurrent callers must observe the same result.
- Do not send the original 401 back into the refresh handler indefinitely; mark retry state or invoke the next handler outside the refresh catch boundary so the request retries once.
- Angular's XSRF mechanism is not a substitute for server-side validation; backend must issue and validate the token on state-changing requests.
- Same-origin checks on XSRF exclude cross-origin APIs by design; CORS and credential policy must be configured by the backend.
- `HttpParams` is immutable; capture each `.set()` result. For arrays, use `.append()` or the `HttpParamsOptions` encoder intentionally.
- Custom parameter encoders need tests for spaces, plus signs, Unicode, and reserved characters.
- Prefer typed query/filter interfaces; whitelist allowed sort keys rather than accepting arbitrary SQL-like order expressions.
- Pagination should follow server contract for page numbering, cursor handling, and total counts; don't infer whether the final page is short means no more pages.
- Avoid `observe: 'events'` unless progress or lifecycle events are used; event streams need filtering for `HttpEventType.Response` before returning a body.
- Progress totals may be absent; show indeterminate progress rather than dividing by zero or assuming `total` exists.
- FormData uploads let the browser create multipart boundaries; setting `Content-Type: multipart/form-data` manually breaks the boundary.
- Upload/download progress has performance cost and backend support constraints. Enable only when UI consumes it.
- Angular 22 fetch backend cannot report upload progress. `withXhr()` restores it in browser apps; server-side XHR is deprecated, so avoid enabling XHR globally for SSR without assessing platform behavior.
- `HttpClient` with `responseType: 'blob'` returns binary error bodies as Blob too; decode before JSON error mapping if the server sends JSON.
- `URL.createObjectURL()` must be paired with `URL.revokeObjectURL()` after the browser has consumed the link; avoid immediate revocation before click dispatch in browser-specific implementations.
- Filename from `Content-Disposition` is untrusted input. Sanitize path separators/control characters before using it as a download name.
- Route guard roles should come from trusted current auth state, not route data supplied by navigation. The server remains authoritative.
- `CanMatchFn` returning false lets the router try another matching route; use a redirect result when the user should land on login/forbidden.
- `CanActivateFn` checks activation after route match; `CanMatchFn` can keep role-gated lazy route code from loading.
- Standalone structural directives must be imported by consuming components on Angular 17–18; Angular 19+ standalone is default. NgModule apps must declare/export directives.
- A structural permission directive should clear stale embedded views when roles change, create at most one view, and support a stable template context only if the directive exposes one.
- Permission directive examples are UX helpers only; API authorization belongs on the server.
- For testing, `provideHttpClientTesting()` must follow `provideHttpClient(...)`; verify no unmatched or outstanding requests with `HttpTestingController.verify()`.
- Test retry counts, refresh races, skipped auth context, redirect behavior, and upload event handling rather than only happy-path body results.

### File-transfer, guard, and test details

- `reportUploadProgress` and `reportDownloadProgress` require `observe: 'events'`; filter `HttpEventType.UploadProgress`, `DownloadProgress`, and `Response` explicitly.
- Upload progress total may be undefined; render indeterminate progress in that case. Do not divide by zero.
- Angular 22's default fetch backend reports download progress but not upload progress; configure XHR for browser upload progress only when needed.
- Angular 22 deprecates the combined `reportProgress` option. Use distinct upload/download flags; retain old option for Angular 17–21.
- Do not manually set multipart `Content-Type` for `FormData`; browser supplies boundary.
- Uploads are generally non-idempotent. Avoid retrying an upload unless server supports an idempotency key and API semantics are verified.
- For resumable or large uploads, use a server-supported chunk protocol; a single multipart request does not become resumable by adding progress events.
- A Blob error response may contain JSON in Blob form; decode its text before parsing, and bound error-body size where hostile servers are possible.
- `URL.createObjectURL` allocates browser memory. Revoke after the download click is dispatched; SSR code must guard browser-only globals.
- Parse `Content-Disposition` filenames defensively; reject path separators, control characters, and invalid encoding before assigning to `download`.
- Pagination parameters should match backend contract; use cursor pagination for changing datasets when offset/page drift would skip or duplicate results.
- `HttpParams` string/number overloads vary by Angular typings; stringify values explicitly if a targeted version requires it.
- `HttpClient` response generic does not validate runtime JSON. Treat API payload as unknown and parse/validate when contract is untrusted or schema stability matters.
- Encode path segments with `encodeURIComponent`; do not encode the whole URL, which would escape separators.
- For typed mutation payloads, define request and response DTO separately when their shape differs; avoid reusing an entity model with server-only fields.
- Functional `CanActivateFn` and `CanMatchFn` may synchronously return a guard result or Promise/Observable thereof. Router uses the first async emission.
- `CanMatch` returning `false` tries another matching route; `CanActivate` returning false blocks activation. Return a `UrlTree` or `RedirectCommand` to navigate.
- Angular 22 requires the `currentSnapshot` argument in the `CanMatchFn` type; callbacks with fewer arguments remain structurally assignable, but typed implementations should use the current signature.
- Role checks in guards should consume current auth state and return a redirect; avoid loading role state through a hidden network side effect in every guard.
- A route guard must not be the only authorization layer; server validates every resource and operation.
- Structural directive should use `TemplateRef` and `ViewContainerRef`, create one embedded view, and clear it when permission becomes false.
- If the directive offers `else` or template context, type it with `ngTemplateContextGuard`; avoid adding this surface until a real consumer needs it.
- Import standalone directives in the component `imports`; declare/export them through NgModules in legacy apps.
- For unit tests, configure `provideHttpClient(...)` before `provideHttpClientTesting()` so the testing backend overrides production backend.
- Call `HttpTestingController.verify()` after each test; unmatched requests often reveal unexpected duplicate subscriptions.
- Test functional interceptors via `provideHttpClient(withInterceptors([...]))`; for class interceptors add `withInterceptorsFromDi()` and a multi `HTTP_INTERCEPTORS` provider.
- `HttpClientModule` is deprecated since Angular 18; do not add it to new standalone code. In legacy module apps, prefer a scoped migration to `provideHttpClient`.
- JSONP support is deprecated in Angular 22.2 because it can create XSS risk; prefer CORS-backed standard HTTP requests.
- `withXhr()` is stable for browser use, but XHR support on Angular's server platform is deprecated; avoid applying it indiscriminately in SSR bootstrap.
- Angular 22 deprecates webpack builders; this does not change HttpClient APIs. Avoid assuming a bundler migration is required for HTTP code.

## Validation Checklist

- [ ] Detected Angular version; no `withFetch()` added on 22+, no `withXhr()` / `reportUploadProgress` used below 22.
- [ ] Exactly one `provideHttpClient` per injector level, with interceptor order documented.
- [ ] Legacy class interceptors still registered via `withInterceptorsFromDi()` if present.
- [ ] Auth header only sent to own API origin; `SKIP_AUTH` used for login/refresh calls.
- [ ] Concurrent 401s trigger one refresh; refresh failure logs out once.
- [ ] Retries limited to idempotent methods and transient statuses.
- [ ] Errors re-thrown as a typed app error; no swallowed failures.
- [ ] Guards return `UrlTree`/`RedirectCommand`; lazy role-gated routes use `canMatch`.
- [ ] Server still enforces every permission the UI hides.
- [ ] Tests use `provideHttpClientTesting()` and `HttpTestingController.verify()`.

## References

- [HTTP recipes: refresh, upload, download, permission directive, tests](references/http-recipes.md)
