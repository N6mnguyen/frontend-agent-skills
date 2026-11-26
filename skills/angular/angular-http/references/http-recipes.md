# Angular HTTP Recipes

Longer examples for the `angular-http` skill. Each block names its file path and the Angular versions it targets. Adjust import paths to the project's layout.

## Interceptor order used below

```ts
// src/app/app.config.ts (excerpt)
provideHttpClient(withInterceptors([errorInterceptor, authInterceptor]));
```

Functional interceptors run in array order on the way out and in reverse on the way back. `errorInterceptor` is listed first so it is the outermost layer: it sees the final outcome after `authInterceptor` has already tried a token refresh, and its retry re-runs the auth step (which re-reads the current token).

## Auth store with single-flight refresh

This example assumes the app keeps access tokens in memory and sends refresh credentials in a server-managed HttpOnly cookie. Align it to the established authentication model; never move credentials into browser storage merely to match the example.

```ts
// src/app/core/auth/auth.store.ts (Angular 17+)
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
import { SKIP_AUTH } from '../http/http-context';

interface TokenResponse {
  readonly accessToken: string;
  readonly roles: readonly string[];
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _roles = signal<readonly string[]>([]);
  private refreshInFlight$: Observable<string> | null = null;

  readonly accessToken = this._accessToken.asReadonly();
  readonly roles = this._roles.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null);

  /** All callers during one refresh share the same request. */
  refresh(): Observable<string> {
    this.refreshInFlight$ ??= this.http
      .post<TokenResponse>('/api/auth/refresh', null, {
        withCredentials: true, // refresh token lives in an HttpOnly cookie
        context: new HttpContext().set(SKIP_AUTH, true),
      })
      .pipe(
        tap({
          next: res => {
            this._accessToken.set(res.accessToken);
            this._roles.set(res.roles);
          },
          error: () => this.clear(),
        }),
        map(res => res.accessToken),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshInFlight$;
  }

  clear(): void {
    this._accessToken.set(null);
    this._roles.set([]);
  }
}
```

`refCount: false` is deliberate here: if the first caller unsubscribes (component destroyed), the refresh still completes for the other waiting requests. `finalize` resets the slot once the request settles, so the next 401 starts a new refresh.

On a pre-signals codebase, the same shape works with a `BehaviorSubject<string | null>` for the token.

## Auth interceptor

```ts
// src/app/core/http/auth.interceptor.ts (Angular 17+)
import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { API_BASE_URL } from './api-base-url';
import { SKIP_AUTH } from './http-context';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const baseUrl = inject(API_BASE_URL);

  // Resolve relative URLs and compare origin/path to avoid token leaks to lookalike hosts.
  const target = new URL(req.url, globalThis.location?.origin ?? 'http://localhost');
  const api = new URL(baseUrl, globalThis.location?.origin ?? 'http://localhost');
  const apiPath = api.pathname.endsWith('/') ? api.pathname : `${api.pathname}/`;
  if (req.context.get(SKIP_AUTH) || target.origin !== api.origin || !(target.pathname === api.pathname || target.pathname.startsWith(apiPath))) return next(req);

  const token = auth.accessToken();
  return next(token ? withBearer(req, token) : req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return auth.refresh().pipe(
        catchError(refreshError => {
          void router.navigateByUrl('/login');
          return throwError(() => refreshError);
        }),
        // Retry the original request exactly once with the new token.
        switchMap(fresh => next(withBearer(req, fresh))),
      );
    }),
  );
};

function withBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}
```

If the server answers the retried request with 401 again, that error passes through unchanged: there is no loop because the retry is not re-wrapped in `catchError`.

## File upload with progress

```ts
// src/app/files/data/file-upload.api.ts
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';

export interface UploadResult { readonly fileId: string; }
export type UploadState =
  | { readonly kind: 'progress'; readonly percent: number | null }
  | { readonly kind: 'done'; readonly result: UploadResult };

@Injectable({ providedIn: 'root' })
export class FileUploadApi {
  private readonly http = inject(HttpClient);

  upload(file: File): Observable<UploadState> {
    const body = new FormData();
    body.append('file', file, file.name);

    return this.http
      .post<UploadResult>('/api/files', body, {
        observe: 'events',
        // Angular 22+: reportUploadProgress, and provideHttpClient(withXhr()) is required
        // because the default fetch backend cannot report upload progress.
        // Angular 17–21: use `reportProgress: true` instead (XHR is the default backend).
        reportUploadProgress: true,
      })
      .pipe(
        map((event: HttpEvent<UploadResult>): UploadState | null => {
          if (event.type === HttpEventType.UploadProgress) {
            return { kind: 'progress', percent: event.total ? Math.round((100 * event.loaded) / event.total) : null };
          }
          if (event.type === HttpEventType.Response && event.body) {
            return { kind: 'done', result: event.body };
          }
          return null;
        }),
        filter((state): state is UploadState => state !== null),
      );
  }
}
```

Do not set `Content-Type` for `FormData`; the browser adds the multipart boundary. Uploads are not idempotent; the retry rules in `errorInterceptor` skip POST.

## Blob download

```ts
// src/app/reports/data/report-download.api.ts (Angular 17+)
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface DownloadedFile { readonly blob: Blob; readonly filename: string; }

@Injectable({ providedIn: 'root' })
export class ReportDownloadApi {
  private readonly http = inject(HttpClient);

  download(reportId: string): Observable<DownloadedFile> {
    return this.http
      .get(`/api/reports/${encodeURIComponent(reportId)}/export`, { responseType: 'blob', observe: 'response' })
      .pipe(
        map(res => ({
          blob: res.body ?? new Blob(),
          filename: filenameFrom(res.headers.get('Content-Disposition')) ?? `report-${reportId}.pdf`,
        })),
      );
  }
}

function filenameFrom(header: string | null): string | null {
  const match = header?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match ? decodeURIComponent(match[1]) : null;
}

export function saveFile({ blob, filename }: DownloadedFile): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
```

`saveFile` touches `document`; guard with `isPlatformBrowser` in SSR apps. With `responseType: 'blob'`, a JSON error body also arrives as a Blob — read it with `await error.error.text()` before mapping. Sanitize any server-provided filename before using it in the download attribute.

## Permission structural directive

```ts
// src/app/core/auth/has-permission.directive.ts (Angular 19+: signal inputs stable)
import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthStore } from './auth.store';

@Directive({ selector: '[hasPermission]' })
export class HasPermissionDirective {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private readonly auth = inject(AuthStore);

  readonly hasPermission = input.required<string | readonly string[]>();
  private rendered = false;

  constructor() {
    // effect is appropriate here: it drives an imperative API (ViewContainerRef).
    effect(() => {
      const required = this.hasPermission();
      const needed = typeof required === 'string' ? [required] : required;
      const allowed = needed.some(p => this.auth.roles().includes(p));
      if (allowed && !this.rendered) {
        this.container.createEmbeddedView(this.template);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.container.clear();
        this.rendered = false;
      }
    });
  }
}
```

```html
<!-- usage -->
<button *hasPermission="'orders:approve'" type="button" (click)="approve()">Approve</button>
```

On Angular 17–18, or where the project uses decorator inputs, replace the signal input with `@Input({ required: true }) set hasPermission(value: string | readonly string[])` and re-evaluate inside the setter plus a subscription to the auth state. On 19+, `standalone: true` is the default; on 17–18 add `standalone: true` or declare it in the owning NgModule.

## Legacy class interceptor (keep, don't rewrite)

```ts
// src/app/core/http/legacy-tenant.interceptor.ts
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable()
export class LegacyTenantInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req.clone({ setHeaders: { 'X-Tenant': 'default' } }));
  }
}
```

```ts
// src/app/app.config.ts (excerpt) — mixing both styles
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';

providers: [
  provideHttpClient(withInterceptors([errorInterceptor, authInterceptor]), withInterceptorsFromDi()),
  { provide: HTTP_INTERCEPTORS, useClass: LegacyTenantInterceptor, multi: true },
];
```

When mixing functional and DI-based interceptors, verify ordering for the installed version; convert the class to a function if exact order matters.

## httpResource for signal-driven reads

```ts
// src/app/orders/order-detail.ts (Angular 22: stable; 19.2–21: experimental)
import { Component, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import type { OrderDto } from './data/order-api';

@Component({
  selector: 'app-order-detail',
  template: `
    @if (order.hasValue()) {
      <h2>Order {{ order.value().id }}</h2>
    } @else if (order.error()) {
      <p role="alert">Could not load the order.</p>
    } @else if (order.isLoading()) {
      <p>Loading…</p>
    }
  `,
})
export class OrderDetail {
  readonly orderId = input.required<string>();
  // Refetches when orderId changes; a pending request is dropped.
  readonly order = httpResource<OrderDto>(() => `/api/orders/${encodeURIComponent(this.orderId())}`);
}
```

`httpResource` goes through `HttpClient`, so interceptors apply. Reading `value()` in the error state throws; check `hasValue()` first. Use `HttpClient` for POST/PUT/DELETE.

## Testing interceptors

```ts
// src/app/core/http/error.interceptor.spec.ts
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  it('maps 404 to a not-found AppHttpError without retrying', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpClient);
    const controller = TestBed.inject(HttpTestingController);

    let received: unknown;
    http.get('/api/missing').subscribe({ error: e => (received = e) });
    controller.expectOne('/api/missing').flush(null, { status: 404, statusText: 'Not Found' });

    expect(received).toEqual(jasmine.objectContaining({ kind: 'not-found', status: 404 }));
    controller.verify();
  });
});
```

`provideHttpClient(...)` must come before `provideHttpClientTesting()`. Replace `jasmine.objectContaining` with `expect.objectContaining` under Jest/Vitest. Transient-status retries use `timer`, so test them with the runner's fake timers or `fakeAsync` in zone-based setups.
