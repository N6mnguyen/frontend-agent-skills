# API Client Patterns

Illustrative, typed implementations. Adapt names, base URLs, error-body shape, and auth storage to the project. Verify the backend contract (status codes, error JSON, refresh endpoint) before copying.

## Contents

1. Shared error type
2. React: typed fetch wrapper with single-flight refresh
3. React: Axios instance with single-flight refresh
4. Angular: functional interceptors (auth, refresh, error mapping)
5. DTO vs domain mapping
6. Query params for pagination/filter/sort
7. Retry with backoff (idempotent only)
8. Cancellation
9. File upload and download: see [file-transfer.md](file-transfer.md)

## 1. Shared error type

```ts
// src/core/api/app-error.ts
export type AppErrorKind = 'network' | 'timeout' | 'cancelled' | 'unauthorized' | 'forbidden' | 'not-found' | 'validation' | 'conflict' | 'rate-limited' | 'server' | 'unexpected';

export interface FieldErrors { [field: string]: string[] }

export class AppError extends Error {
  constructor(
    readonly kind: AppErrorKind,
    message: string,
    readonly status?: number,
    readonly fieldErrors?: FieldErrors,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}

export function kindFromStatus(status: number): AppErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 400 || status === 422) return 'validation';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate-limited';
  if (status === 408) return 'timeout';
  if (status >= 500) return 'server';
  return 'unexpected';
}

// Narrow an unknown error body. Adjust to the backend's format (e.g. RFC 9457 problem+json).
export function readFieldErrors(body: unknown): FieldErrors | undefined {
  if (typeof body !== 'object' || body === null || !('errors' in body)) return undefined;
  const errors = (body as { errors: unknown }).errors;
  if (typeof errors !== 'object' || errors === null) return undefined;
  const out: FieldErrors = {};
  for (const [k, v] of Object.entries(errors)) {
    if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string');
  }
  return out;
}
```

`Error` `cause` option needs `lib: ["es2022"]` or later in tsconfig.

## 2. React: typed fetch wrapper with single-flight refresh

```ts
// src/core/api/http.ts
import { AppError, kindFromStatus, readFieldErrors } from './app-error';

const API_BASE = '/api'; // same-origin; use an env value if the project does
let accessToken: string | null = null;
let refreshInFlight: Promise<string> | null = null;

export function setAccessToken(token: string | null) { accessToken = token; }

// Single-flight: every caller that sees a 401 awaits the same promise.
function refreshAccessToken(): Promise<string> {
  refreshInFlight ??= (async () => {
    // Refresh token travels as an HttpOnly cookie; the server returns a new access token.
    const res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new AppError('unauthorized', 'Session expired', res.status);
    const body: unknown = await res.json();
    if (typeof body !== 'object' || body === null || typeof (body as { accessToken?: unknown }).accessToken !== 'string') {
      throw new AppError('unexpected', 'Malformed refresh response');
    }
    const token = (body as { accessToken: string }).accessToken;
    setAccessToken(token);
    return token;
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;          // JSON-serialised unless FormData/Blob
  skipAuth?: boolean;
}

export async function http(path: string, opts: RequestOptions = {}, isRetry = false): Promise<unknown> {
  const { body, skipAuth, headers, ...init } = opts;
  const h = new Headers(headers);
  const isRaw = body instanceof FormData || body instanceof Blob;
  if (body !== undefined && !isRaw) h.set('Content-Type', 'application/json');
  if (!skipAuth && accessToken) h.set('Authorization', `Bearer ${accessToken}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: h,
      body: body === undefined ? undefined : isRaw ? (body as BodyInit) : JSON.stringify(body),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new AppError('cancelled', 'Request cancelled', undefined, undefined, { cause: e });
    if (e instanceof DOMException && e.name === 'TimeoutError') throw new AppError('timeout', 'Request timed out', undefined, undefined, { cause: e });
    throw new AppError('network', 'Network unavailable', undefined, undefined, { cause: e });
  }

  if (res.status === 401 && !skipAuth && !isRetry) {
    await refreshAccessToken();           // throws AppError('unauthorized') on failure
    return http(path, opts, true);        // replay once
  }

  if (!res.ok) {
    const errBody: unknown = await res.json().catch(() => undefined);
    throw new AppError(kindFromStatus(res.status), `HTTP ${res.status}`, res.status, readFieldErrors(errBody));
  }
  if (res.status === 204) return undefined;
  return res.json() as Promise<unknown>;  // caller validates/maps
}
```

Notes:
- `AbortSignal.timeout(ms)` gives a per-request timeout; combine with a caller signal via `AbortSignal.any([a, b])` (Baseline widely available since March 2024; check older browser targets).
- Replaying a request with a `ReadableStream` body is not possible; FormData/strings/Blobs are fine.
- If auth is cookie-only, drop the `Authorization` header logic and keep the 401 → refresh → replay flow.

## 3. React: Axios instance with single-flight refresh

```ts
// src/core/api/axios-client.ts — axios 1.x
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { AppError, kindFromStatus, readFieldErrors } from './app-error';

export const api = axios.create({ baseURL: '/api', timeout: 15_000 });

let accessToken: string | null = null;
let refreshInFlight: Promise<string> | null = null;
export const setAccessToken = (t: string | null) => { accessToken = t; };

function refresh(): Promise<string> {
  refreshInFlight ??= axios
    .post<{ accessToken: string }>('/api/auth/refresh', null, { withCredentials: true }) // bare axios: bypasses interceptors
    .then((r) => { setAccessToken(r.data.accessToken); return r.data.accessToken; })
    .finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (r) => r,
  async (error: unknown) => {
    if (axios.isCancel(error)) throw new AppError('cancelled', 'Request cancelled', undefined, undefined, { cause: error });
    if (!(error instanceof AxiosError)) throw new AppError('unexpected', 'Unexpected error', undefined, undefined, { cause: error });

    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && config && !config._retried) {
      config._retried = true;
      try {
        await refresh();
      } catch (e) {
        setAccessToken(null);
        throw new AppError('unauthorized', 'Session expired', 401, undefined, { cause: e });
      }
      return api(config); // request interceptor re-applies the new token
    }

    if (status === undefined) {
      const kind = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' ? 'timeout' : 'network';
      throw new AppError(kind, error.message, undefined, undefined, { cause: error });
    }
    throw new AppError(kindFromStatus(status), `HTTP ${status}`, status, readFieldErrors(error.response?.data), { cause: error });
  },
);
```

`response.data` from Axios is typed by the generic you pass but is not validated. Map or validate in endpoint functions.

## 4. Angular: functional interceptors

Angular 17+ standalone apps. Register once:

```ts
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/http/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Requests run left to right (error → auth → backend); responses return right to left,
    // so auth sees a 401 and refreshes before error mapping converts it to AppError.
    provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
  ],
};
```

Backend defaults differ by version: Angular 17–21 use `XMLHttpRequest` by default and `withFetch()` opts into fetch. Angular 22 makes fetch the default, deprecates `withFetch()`, and adds `withXhr()` for upload progress. Check `@angular/common` in `package.json`.

```ts
// src/app/core/http/auth.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // HttpClient built on HttpBackend skips all interceptors — prevents refresh recursion.
  private readonly rawHttp = new HttpClient(inject(HttpBackend));
  readonly accessToken = signal<string | null>(null);
  private refresh$: Observable<string> | null = null;

  refreshToken(): Observable<string> {
    this.refresh$ ??= this.rawHttp
      .post<{ accessToken: string }>('/api/auth/refresh', null, { withCredentials: true })
      .pipe(
        map((r) => r.accessToken),
        tap((t) => this.accessToken.set(t)),
        finalize(() => { this.refresh$ = null; }),
        shareReplay({ bufferSize: 1, refCount: false }), // single-flight: all 401s share one call
      );
    return this.refresh$;
  }

  clear(): void { this.accessToken.set(null); }
}
```

```ts
// src/app/core/http/auth.interceptor.ts
import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
const API_PREFIX = '/api/';

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH) || !req.url.startsWith(API_PREFIX)) return next(req); // trusted origin only
  const auth = inject(AuthService);

  return next(withToken(req, auth.accessToken())).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) return throwError(() => err);
      return auth.refreshToken().pipe(
        switchMap((token) => next(withToken(req, token))), // replay once; a second 401 propagates
        catchError((refreshErr: unknown) => { auth.clear(); return throwError(() => refreshErr); }),
      );
    }),
  );
};
```

```ts
// src/app/core/http/error.interceptor.ts
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AppError, kindFromStatus, readFieldErrors } from '../api/app-error';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof AppError) return throwError(() => err);
      if (err instanceof HttpErrorResponse) {
        const kind = err.status === 0 ? 'network' : kindFromStatus(err.status);
        return throwError(() => new AppError(kind, err.message, err.status || undefined, readFieldErrors(err.error), { cause: err }));
      }
      return throwError(() => new AppError('unexpected', 'Unexpected HTTP failure', undefined, undefined, { cause: err }));
    }),
  );
```

Angular cancels the request when the subscriber unsubscribes — there is no `AbortSignal` option on `HttpClient`. Unsubscribed requests do not error, so no `cancelled` mapping is needed. Angular 20+ has a `timeout` request option (milliseconds; failures surface as status 0); on 17–19 use the RxJS `timeout()` operator.

NgModule apps: keep class-based `HTTP_INTERCEPTORS` providers if that is the existing pattern, or bridge with `provideHttpClient(withInterceptorsFromDi())`.

## 5. DTO vs domain mapping

```ts
// src/features/invoices/api/invoice.dto.ts — matches wire JSON exactly
export interface InvoiceDto {
  id: string;
  customer_name: string;
  total_cents: number;
  issued_at: string;       // ISO 8601
  status: 'DRAFT' | 'SENT' | 'PAID';
}

// src/features/invoices/model.ts — what the UI uses
export interface Invoice {
  id: string;
  customerName: string;
  total: number;           // major units
  issuedAt: Date;
  status: 'draft' | 'sent' | 'paid';
}

// src/features/invoices/api/invoice.mapper.ts
import type { InvoiceDto } from './invoice.dto';
import type { Invoice } from '../model';

export function toInvoice(dto: InvoiceDto): Invoice {
  return {
    id: dto.id,
    customerName: dto.customer_name,
    total: dto.total_cents / 100,
    issuedAt: new Date(dto.issued_at),
    status: dto.status.toLowerCase() as Invoice['status'],
  };
}
```

If the project has Zod/Valibot installed, parse with a schema and derive the DTO type from it instead of a hand-written interface plus guard.

## 6. Query params

```ts
// src/core/api/query.ts
export interface ListQuery {
  page?: number;           // 1-based or 0-based: follow the API
  pageSize?: number;
  sort?: { field: string; dir: 'asc' | 'desc' };
  filters?: Record<string, string | number | boolean | readonly string[] | undefined>;
}

export function toSearchParams(q: ListQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.page !== undefined) p.set('page', String(q.page));       // keeps 0
  if (q.pageSize !== undefined) p.set('pageSize', String(q.pageSize));
  if (q.sort) p.set('sort', `${q.sort.dir === 'desc' ? '-' : ''}${q.sort.field}`); // adapt to API convention
  for (const [key, value] of Object.entries(q.filters ?? {})) {
    if (value === undefined || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => p.append(key, v)); // ?status=a&status=b
    else p.set(key, String(value));
  }
  p.sort(); // stable order for cache keys and URLs
  return p;
}
```

Angular: `new HttpParams({ fromObject: { page: 1, status: ['a', 'b'] } })` encodes arrays as repeated keys; it drops nothing automatically, so filter `undefined` first.

Paginated response shape to model explicitly:

```ts
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
export interface CursorPage<T> { items: T[]; nextCursor: string | null }
```

## 7. Retry with backoff (idempotent only)

```ts
// src/core/api/retry.ts
import { AppError } from './app-error';

const RETRYABLE = new Set(['network', 'timeout', 'rate-limited', 'server']);

export async function withRetry<T>(fn: () => Promise<T>, { retries = 3, baseMs = 300, signal }: { retries?: number; baseMs?: number; signal?: AbortSignal } = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const retryable = e instanceof AppError && RETRYABLE.has(e.kind) && e.status !== 501;
      if (!retryable || attempt >= retries || signal?.aborted) throw e;
      const delay = Math.min(baseMs * 2 ** attempt, 10_000) * (0.5 + Math.random() / 2); // backoff + jitter
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// Only wrap GET/HEAD or writes the API documents as idempotent (PUT, DELETE, POST with Idempotency-Key).
// const invoices = await withRetry(() => fetchInvoices(q, signal), { signal });
```

To honour `Retry-After`, carry the header value on `AppError` and use it instead of the computed delay. TanStack Query and RxJS `retry({ count, delay })` already implement retry; use them when present instead of this helper.

## 8. Cancellation

```ts
// React effect without a data library
useEffect(() => {
  const controller = new AbortController();
  http(`/search?${new URLSearchParams({ q: query })}`, { signal: controller.signal })
    .then((data) => setResults(parseResults(data)))
    .catch((e: unknown) => { if (!(e instanceof AppError && e.kind === 'cancelled')) setError(e); });
  return () => controller.abort();
}, [query]);
```

TanStack Query: `queryFn: ({ signal }) => http('/search', { signal })`. Angular: `switchMap` from a search input stream unsubscribes the previous request, which aborts it.