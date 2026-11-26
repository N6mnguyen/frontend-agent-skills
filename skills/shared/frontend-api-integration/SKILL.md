---
name: frontend-api-integration
description: Build typed, resilient REST integrations in React and Angular - DTOs vs domain models, an API client layer, auth header injection, single-flight token refresh, interceptors (fetch/axios wrapper, HttpInterceptorFn), typed AppError mapping, pagination/filter/sort params, file upload with progress and Blob download, AbortController cancellation, and retry with backoff for idempotent requests. Use when adding or changing HTTP calls, writing an API client or interceptor, handling 401s and token refresh, mapping API errors, building list endpoints with query params, uploading or downloading files, or cancelling and retrying requests.
license: MIT
metadata:
  category: shared
  version: "1.0.0"
  frameworks: "react 18-19, angular 17+, axios 1.x"
  last-reviewed: "2026-11-25"
---

# Frontend API Integration

## Purpose

Keep HTTP details at the edge of the app and hand features typed, predictable results. Good looks like: one configured client with auth and error mapping; endpoint functions per feature that turn untrusted JSON into typed models; every failure surfaces as a typed `AppError`; concurrent 401s trigger exactly one refresh; obsolete requests get cancelled; only safe requests get retried. Use the client the project already has; never add a second HTTP library for one call.

## When to Use

- Adding or changing a REST endpoint call, its request/response types, or DTO-to-model mapping.
- Writing or fixing an API client, fetch wrapper, axios instance, or Angular `HttpInterceptorFn`.
- Handling 401s, token refresh, or "multiple refresh calls" bugs.
- Mapping server errors to UI-friendly typed errors.
- Pagination, filtering, sorting query params; file upload with progress; file download.
- Cancelling stale requests or adding retry.

Do not use when: the question is cache/staleness policy in TanStack Query (see `tanstack-query`), Angular `HttpClient` specifics beyond this scope (see `angular-http`), or how errors are displayed (see `frontend-error-handling`).

## Workflow

1. **Detect**
   - `package.json`: `axios`, `@tanstack/react-query`, `@angular/common` version, `zod`/`valibot`, `openapi-typescript`/`orval`/OpenAPI generator.
   - Existing client: search for `axios.create`, `fetch(` wrappers, `HttpInterceptorFn`, `HTTP_INTERCEPTORS`, `provideHttpClient`.
   - Auth model: HttpOnly cookie session, bearer token in memory, or token in storage. Find the refresh endpoint.
   - Error body format: RFC 9457 `application/problem+json`, `{ errors: { field: [...] } }`, or custom. Read a real response or the OpenAPI spec.
   - Generated clients: if types/clients are generated from OpenAPI, regenerate rather than hand-editing.
2. **Decide**
   - Existing client present: extend it. No client: React — small typed fetch wrapper (add axios only if upload progress or existing team preference justifies it); Angular — `HttpClient` always.
   - Data library present (TanStack Query, NgRx, Angular `httpResource`): endpoint functions feed it; do not duplicate caching.
3. **Implement** in this order: DTO types → mapper → endpoint function → wire into client/interceptor if cross-cutting → tests.
4. **Verify** — type-check, lint, unit tests for mapper and error mapping, a test for concurrent 401s if refresh logic changed, and manual check in the network panel (one refresh, cancelled requests marked cancelled).

## Best Practices

### Layering and contracts

- Layers: `core/api` (base client, interceptors, `AppError`) → `features/<x>/api` (endpoint functions, DTOs, mappers) → hooks/services/stores → components. Components never call `fetch`/`HttpClient` directly.
- DTO types mirror the wire format exactly (snake_case, ISO date strings, cents). Domain models are what the UI wants. Map in one function per direction (`toInvoice`, `toInvoiceDto`). If wire and domain are identical, one type is fine — do not add a mapper for nothing.
- Response JSON is untrusted. A generic like `http.get<Invoice>()` is a cast, not validation. Validate with the installed schema library or a type guard where wrong data would cause harm (money, permissions, routing); at minimum, map explicitly.
- Endpoint functions accept typed params and an optional `AbortSignal`, and return domain models.

### Auth

- Attach `Authorization` only to requests for your API origin/prefix. Never send tokens to third-party URLs.
- Prefer HttpOnly, `Secure`, `SameSite` cookies for refresh tokens; keep access tokens in memory. Tokens in `localStorage` are readable by any XSS payload. Cookie auth needs CSRF protection (Angular's `HttpClient` has built-in XSRF cookie/header support for same-origin mutating requests).
- Single-flight refresh: store the in-flight refresh promise/observable; every 401 awaits the same one; clear it when it settles. Replay each original request once (flag it) so a second 401 does not loop.
- Make the refresh call bypass the auth/refresh interceptor (bare axios instance; Angular `HttpClient` built on `HttpBackend`; `HttpContextToken` flag).
- On refresh failure: clear auth state, reject all waiters, route to login once — not once per failed request.

### Interceptors by stack

- React + fetch: no interceptor API. Use one wrapper function that composes headers, checks `response.ok`, maps errors, and handles 401.
- React + axios 1.x: `instance.interceptors.request.use` / `response.use`. Use one shared instance; avoid `axios.defaults` mutations for user tokens.
- Angular 17+: functional `HttpInterceptorFn` with `provideHttpClient(withInterceptors([...]))`; `inject()` works inside. Interceptors run in array order for requests and reverse for responses. NgModule apps with class interceptors keep `HTTP_INTERCEPTORS` (bridge with `withInterceptorsFromDi()`); do not migrate as a side task.
- Angular backend defaults: 17–21 use XHR by default and `withFetch()` opts into fetch. Angular 22 makes fetch the default, deprecates `withFetch()`, adds `withXhr()`, and replaces `reportProgress` with `reportUploadProgress` / `reportDownloadProgress`. Fetch backend throws if upload progress is requested; use `withXhr()` for that (never in SSR).

### Errors

- Normalise to one `AppError` with a `kind` (`network`, `timeout`, `cancelled`, `unauthorized`, `forbidden`, `not-found`, `validation`, `conflict`, `rate-limited`, `server`, `unexpected`), optional `status`, optional `fieldErrors`, and the original error as `cause`.
- fetch resolves on 4xx/5xx — always check `response.ok`. Axios rejects on non-2xx by default (`validateStatus`). Angular emits `HttpErrorResponse`; `status === 0` means network/CORS/timeout failure.
- Keep server messages out of UI unless the API contract marks them user-safe. Map kind → message in the UI layer.

### Query params, pagination

- Build with `URLSearchParams` (React) or `HttpParams` (Angular). Never concatenate raw strings.
- Skip `undefined` filters deliberately, but keep `0` and `false`. Repeat keys for arrays unless the API wants CSV.
- Sort keys (`params.sort()`) so identical filters produce identical URLs and cache keys.
- Model page-based (`page`, `pageSize`, `total`) and cursor-based (`nextCursor`) responses as distinct types. Keep list state (page, sort, filters) in the URL where users expect shareable links.

### Files

- Upload with `FormData`. Do not set `Content-Type` manually — the browser adds the multipart boundary.
- Upload progress: fetch cannot report it. React: axios `onUploadProgress` or XHR. Angular: `observe: 'events'` with progress option (see version note above).
- Download: request as Blob (`res.blob()`, axios `responseType: 'blob'`, Angular `responseType: 'blob', observe: 'response'`). Parse `Content-Disposition` defensively (`filename*` first, then `filename`, then a fallback) and sanitise. Cross-origin APIs must expose the header via `Access-Control-Expose-Headers`. Revoke object URLs.
- Very large downloads: prefer a short-lived signed URL the browser navigates to, instead of buffering in memory.

### Cancellation and retry

- Pass `AbortSignal` to every endpoint function. React effects abort in cleanup; TanStack Query supplies `signal` to `queryFn`. Angular cancels on unsubscribe (`switchMap`, `takeUntilDestroyed`); `HttpClient` has no signal option.
- Classify `AbortError` as `cancelled` and never toast it.
- Timeouts: `AbortSignal.timeout(ms)` combined with a caller signal via `AbortSignal.any()` (fetch); axios `timeout`; Angular 20+ `timeout` request option, or RxJS `timeout()` on 17–19.
- Retry only idempotent requests (GET, HEAD, PUT/DELETE per contract, POST with an `Idempotency-Key` the server honours) and only for `network`, `timeout`, 429, 502/503/504. Exponential backoff with jitter, capped attempts (2–3), honour `Retry-After`. Never retry 4xx validation/auth errors or cancelled requests.
- If TanStack Query or RxJS `retry({ count, delay })` is present, configure them instead of hand-rolling.

## Anti-patterns

- `const data = (await res.json()) as Invoice` — compiles, validates nothing — type as `unknown`, then map/validate.
- `fetch(url).then(r => r.json())` without `r.ok` — a 500 HTML page becomes a JSON parse error or bogus data — check status first.
- Each 401 calls `/refresh` — refresh stampede; rotating refresh tokens invalidate each other and log the user out — single-flight.
- Refresh request passing through the same interceptor — infinite 401 loop — bypass the interceptor.
- Retrying POST `/orders` on timeout — duplicate orders — retry only with an idempotency key.
- `headers: { 'Content-Type': 'multipart/form-data' }` with FormData — missing boundary, server rejects — omit it.
- Toasting `AbortError` when the user navigates away — noise — classify as `cancelled`, ignore in UI.
- Tokens in `localStorage` chosen by default — XSS can exfiltrate them — HttpOnly cookie refresh + in-memory access token where backend allows.
- `http.get<any>()` and passing the raw DTO to templates — wire changes break UI silently — map to domain types.
- Hand-editing generated OpenAPI clients — overwritten on next generation — change the spec or a wrapper.

## Implementation Examples

Full versions (fetch wrapper, axios instance, Angular interceptors, retry, cancellation) are in [references/client-patterns.md](references/client-patterns.md). Upload with progress and download with filename are in [references/file-transfer.md](references/file-transfer.md).

### Endpoint function with mapping (React or framework-neutral)

```ts
// src/features/invoices/api/invoices-api.ts
import { http } from '@/core/api/http';
import { toSearchParams, type ListQuery } from '@/core/api/query';
import { toInvoice } from './invoice.mapper';
import { isInvoicePageDto } from './invoice.guards';
import { AppError } from '@/core/api/app-error';

export async function fetchInvoices(query: ListQuery, signal?: AbortSignal) {
  const raw = await http(`/invoices?${toSearchParams(query)}`, { signal });
  if (!isInvoicePageDto(raw)) throw new AppError('unexpected', 'Invoice list response did not match contract');
  return { ...raw, items: raw.items.map(toInvoice) };
}
```

### Single-flight refresh (core idea)

```ts
// src/core/api/refresh.ts
let inFlight: Promise<string> | null = null;

export function refreshOnce(doRefresh: () => Promise<string>): Promise<string> {
  inFlight ??= doRefresh().finally(() => { inFlight = null; });
  return inFlight; // all concurrent callers share this promise
}
```

### Angular functional auth interceptor (registration)

```ts
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/http/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptors([errorInterceptor, authInterceptor]))],
};
```

The interceptor bodies (token attach, 401 → shared refresh → replay once, `HttpErrorResponse` → `AppError`) are in the reference file.

### Angular endpoint service with typed params

```ts
// src/app/features/invoices/api/invoices.api.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs';
import type { InvoicePageDto } from './invoice.dto';
import { toInvoice } from './invoice.mapper';

@Injectable({ providedIn: 'root' })
export class InvoicesApi {
  private readonly http = inject(HttpClient);

  list(page: number, pageSize: number, status?: string) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (status) params = params.set('status', status);
    return this.http
      .get<InvoicePageDto>('/api/invoices', { params })
      .pipe(map((dto) => ({ ...dto, items: dto.items.map(toInvoice) })));
  }
}
```

### React: cancellation with TanStack Query

```ts
// src/features/invoices/hooks/useInvoices.ts
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchInvoices } from '../api/invoices-api';
import type { ListQuery } from '@/core/api/query';

export function useInvoices(query: ListQuery) {
  return useQuery({
    queryKey: ['invoices', query],
    queryFn: ({ signal }) => fetchInvoices(query, signal), // aborted when the key changes or the query is dropped
    placeholderData: keepPreviousData,
  });
}
```

## Validation Checklist

- [ ] Reused the existing client/interceptors; no second HTTP library added.
- [ ] Endpoint function lives in the feature; components do not call HTTP directly.
- [ ] Response typed as `unknown` or DTO and mapped/validated before use.
- [ ] fetch paths check `response.ok`; all failures become `AppError` with `cause`.
- [ ] Auth header only on own API origin; refresh is single-flight, bypasses interceptors, replays once.
- [ ] Refresh failure clears auth and redirects once.
- [ ] Query params built with `URLSearchParams`/`HttpParams`; `0`/`false` preserved; keys sorted if used for caching.
- [ ] FormData uploads do not set `Content-Type`; Angular upload progress uses the right option for the installed version.
- [ ] Downloads parse `Content-Disposition` defensively and revoke object URLs.
- [ ] Requests are cancellable; cancellation is not shown as an error.
- [ ] Retries only for idempotent requests and transient errors, bounded with backoff.
- [ ] Tests: mapper, error mapping, concurrent 401 → one refresh.

## References

- [Client patterns: fetch, axios, Angular interceptors, retry, cancellation](references/client-patterns.md)
- [File transfer: upload with progress, download with filename](references/file-transfer.md)
- Fetch API: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- AbortSignal: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
- Angular HTTP guide: https://angular.dev/guide/http
- Axios interceptors: https://axios-http.com/docs/interceptors
- RFC 9457 Problem Details: https://www.rfc-editor.org/rfc/rfc9457
- OWASP REST Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
