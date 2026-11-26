---
name: frontend-security
description: Prevent common browser-application vulnerabilities including XSS, CSRF, unsafe token storage, open redirects, insecure postMessage use, exposed secrets, weak client-side authorization, and vulnerable dependencies. Use when implementing authentication, user-generated content, routing, API calls, CSP, or auditing React and Angular frontend code.
license: MIT
metadata:
  category: shared
  version: "1.0.0"
  frameworks: "react, angular"
  last-reviewed: "2026-11-25"
---

# Frontend Security

## Purpose

Reduce the browser application's attack surface without confusing client-side UX controls for security boundaries. Validate untrusted data at every boundary and enforce identity, authorization, and data integrity on the server.

## When to Use

- Rendering user-supplied or API-provided content, handling authentication, or protecting routes/actions.
- Configuring CSP, CSRF protections, tokens, postMessage, redirects, dependencies, or deployment variables.
- Reviewing a security-sensitive frontend change.

Do not use when: assessing a backend implementation or threat-modeling an entire system; use server-side security review practices too. Frontend checks cannot establish backend safety.

## Workflow

1. **Detect** — inspect framework/runtime versions, router, HTTP client, auth/session design, CSP headers, SSR/prerender paths, dependency lockfile, and existing sanitization conventions. Do not replace an established security library without evidence.
2. **Trace data** — mark untrusted sources (URL, forms, storage, API, postMessage, third-party scripts) and every sink (DOM, URL, navigation, script/style, HTML).
3. **Apply controls** — choose platform/framework-safe APIs first; preserve server authorization and validation as authoritative.
4. **Verify** — test hostile inputs, inspect production bundles/source maps, audit dependency advisories, and review the deployed response headers.

## Best Practices

### XSS and output handling

- Treat all input as untrusted, including content returned by your own API: stored data may be attacker-controlled.
- Prefer text interpolation and DOM APIs that assign text (`textContent`); never concatenate data into HTML, script, CSS, or executable URLs.
- React escapes text children by default. Do not pass untrusted strings to `dangerouslySetInnerHTML`. If rich HTML is a product requirement, sanitize with a maintained allowlist sanitizer (e.g. DOMPurify), do not hand-roll filtering, and constrain allowed elements/attributes.
- Angular template interpolation and property binding escape/sanitize contextually. Do not build templates from strings, compile user data, or call `DomSanitizer.bypassSecurityTrustHtml`, `bypassSecurityTrustScript`, `bypassSecurityTrustStyle`, `bypassSecurityTrustUrl`, or `bypassSecurityTrustResourceUrl` on untrusted data. A bypass method is an explicit trust assertion, not a sanitizer.
- Avoid `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, and string-valued event handlers for dynamic data.
- URLs are a separate context: allowlist protocols (`https:`, and only required relative URLs); reject `javascript:`, `data:` where not required, and protocol-relative values in redirect/navigation input.
- For SSR, escape output in the server renderer and never concatenate untrusted input into server-generated Angular templates or raw HTML.

### CSP and Trusted Types

- Set a restrictive Content-Security-Policy as an HTTP response header. Start with `default-src 'self'`; explicitly scope `script-src`, `style-src`, `img-src`, `connect-src`, `font-src`, `frame-ancestors`, and `object-src 'none'` to actual needs.
- Prefer nonces or hashes over `'unsafe-inline'`; generate a fresh unpredictable nonce per response and ensure the HTML and CSP header use the same value. Never use a static nonce.
- Roll out with `Content-Security-Policy-Report-Only`, inspect violations, then enforce. Do not weaken `script-src` to silence a report without understanding the source.
- Where supported, deploy Trusted Types (`require-trusted-types-for 'script'`) and an explicit policy allowlist. Angular uses internal policies: `angular`, `angular#bundler`, `angular#unsafe-bypass`, `angular#unsafe-jit`, `angular#unsafe-upgrade`; allow only those required by the app's features. Angular `security.autoCsp` (in `angular.json`) generates a hash-based policy for static builds but is incompatible with SSR; it was added in Angular CLI 19.0.0.

### CSRF and session handling

- CSRF matters when browsers attach credentials automatically (especially cookies). Use framework/server CSRF protections, validate `Origin`/`Referer` server-side where appropriate, and set cookies `Secure`, `HttpOnly`, and a suitable `SameSite` (`Lax` is often a useful default; `None` requires `Secure`). SameSite is defense-in-depth, not a universal CSRF replacement.
- Angular `HttpClient` XSRF support uses `XSRF-TOKEN` cookie and `X-XSRF-TOKEN` header by default for mutating same-origin/relative requests; configure with `withXsrfConfiguration` when names differ. Do not disable it via `withNoXsrfProtection` unless another verified defense replaces it. The server must issue/check the token.
- `HttpOnly` cookies prevent JavaScript reads but are automatically sent by the browser; use CSRF defenses. Do not claim a frontend-only token strategy prevents XSS.

### Token storage tradeoffs

| Storage | Benefit | Main risk / use |
| --- | --- | --- |
| `HttpOnly; Secure; SameSite` cookie | JavaScript cannot read token; persists across reloads | Browser attaches it; CSRF controls required. Prefer for session credentials when backend supports it. |
| In-memory variable | Not persisted or directly readable from other tabs; short exposure lifetime | Lost on reload; same-origin XSS can still use the active session. |
| `localStorage` / `sessionStorage` | Convenient persistence and tab behavior | Any successful same-origin script injection can read tokens; avoid for long-lived session/refresh tokens. |

- Choose based on threat model and backend support; rotate/revoke credentials server-side and use short-lived scoped access tokens where suitable.
- Never place credentials, private API keys, signing keys, or server secrets in frontend code, build arguments, source maps, or public environment variables. `VITE_*`, `NG_*`, and framework-exposed variables are public bundle inputs, not secret storage.

### Input validation

- Client-side validation (HTML constraints, Zod/Yup/Valibot schemas, Angular validators) exists for fast feedback. The server re-validates every field — type, length, range, format, ownership — because requests can be crafted without the UI.
- Share a schema between client and server only when both are TypeScript; the server copy is still the one that counts.
- Display server validation errors (`400`/`422` field errors) next to the field instead of assuming client validation caught everything.
- File uploads: check type and size client-side for UX; the server must verify content, not the extension or `Content-Type` header.

### Authorization, redirects, messaging

- Client-side route guards and hidden buttons improve UX only. Every API request and data access must be authorized by the server for the authenticated principal and resource.
- Protect routes to prevent accidental access and provide a good sign-in flow, but never trust the route guard as the enforcement point. Avoid leaking protected data in preloaded state or static assets.
- Open redirects: parse candidate URLs with `new URL(value, location.origin)`; allow only same-origin paths or a narrow host allowlist; reject credentials and unexpected schemes. Do not trust a `returnUrl` merely because it came from your own page.
- `postMessage`: send to an exact `targetOrigin`, never `'*'` for sensitive data. On receipt, validate `event.origin` against an exact allowlist, check `event.source` when relevant, validate the message shape and type, and reject unexpected data. Origin checks are necessary, not sufficient authorization.

### Dependencies and delivery

- Run the package manager's audit command against the lockfile in CI; review reachability, fixed version, and exploitability before updating. Prefer small, maintained dependencies; remove unused packages.
- Keep source maps private or upload them only to a controlled error-monitoring service; public maps disclose source and build context, not secrets that should have been present.
- Protect production builds with CSP, HTTPS, secure response headers, and reviewed third-party scripts. Pin third-party script origins and use Subresource Integrity for immutable external scripts where applicable.

## Anti-patterns

- `dangerouslySetInnerHTML={{ __html: userText }}` or Angular `bypassSecurityTrustHtml(userText)` — XSS sink — render text, or sanitize with a narrow allowlist.
- Regex-based HTML sanitization — parser/context edge cases bypass it — use a maintained sanitizer or avoid HTML.
- A route guard as authorization — callers can invoke the API directly — enforce access on every server operation.
- A private key in `.env` prefixed `VITE_` / `NG_` — build tooling injects it into public output — move secret operations server-side.
- A token in localStorage by default — persistent bearer credential accessible to injected scripts — prefer an HttpOnly cookie when supported; otherwise keep only short-lived tokens in memory and document the threat tradeoff.
- `postMessage(..., '*')` plus no receiver validation — data disclosure and spoofable messages — exact target origin and validated origin/source/schema.
- `window.location = searchParams.get('next')` — open redirect — validate parsed origin/path against an allowlist.
- Disabling Angular XSRF checks to fix a failing request without server-side replacement — silently removes a defense — configure the correct cookie/header pair.

## Implementation Examples

### Safe text rendering

```tsx
// src/Comment.tsx (React 18/19)
export function Comment({ body }: { body: string }) {
  return <p>{body}</p>; // React renders as text, not markup.
}
```

```ts
// src/app/comment.component.ts (Angular 17+)
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-comment', // add standalone: true on Angular 17/18
  template: '<p>{{ body() }}</p>',
})
export class CommentComponent {
  readonly body = input.required<string>();
}
```

If rich HTML must be rendered, sanitize at the rendering boundary using an approved allowlist and test malicious payloads. For Angular, return sanitized content through the normal `[innerHTML]` binding; never bypass the sanitizer for attacker-controlled input.

### Angular XSRF configuration

```ts
// src/app/app.config.ts (Angular 17+)
import { provideHttpClient, withXsrfConfiguration } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withXsrfConfiguration({
      cookieName: 'XSRF-TOKEN',
      headerName: 'X-XSRF-TOKEN',
    })),
  ],
};
```

The backend must set/read the cookie and validate the header. Angular does not attach it to cross-origin absolute URLs by default; the server still owns CSRF enforcement.

### Allowlisted redirect

```ts
// src/security/redirect.ts
export function safeReturnPath(candidate: string | null): string {
  if (!candidate) return '/';
  try {
    const url = new URL(candidate, location.origin);
    if (url.origin !== location.origin) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
```

Use only for same-origin path navigation; if a flow legitimately redirects to another host, validate against a fixed host allowlist and expected protocol.

### postMessage validation

```ts
// src/embedded-widget.ts
const TRUSTED_ORIGIN = 'https://widget.example.com';

type WidgetReady = { type: 'widget-ready'; requestId: string };

function isWidgetReady(data: unknown): data is WidgetReady {
  if (typeof data !== 'object' || data === null) return false;
  const m = data as Record<string, unknown>;
  return m['type'] === 'widget-ready' && typeof m['requestId'] === 'string';
}

export function connectWidget(iframe: HTMLIFrameElement, onReady: (id: string) => void): () => void {
  const listener = (event: MessageEvent<unknown>) => {
    if (event.origin !== TRUSTED_ORIGIN) return;           // exact match, no endsWith/includes
    if (event.source !== iframe.contentWindow) return;      // from this frame only
    if (!isWidgetReady(event.data)) return;                 // schema check
    onReady(event.data.requestId);
  };
  window.addEventListener('message', listener);
  iframe.contentWindow?.postMessage({ type: 'initialize' }, TRUSTED_ORIGIN); // never '*'
  return () => window.removeEventListener('message', listener);
}
```

Call the returned cleanup from React `useEffect` cleanup or Angular `DestroyRef.onDestroy`.

Replace the sample origin and message schema with the actual integration contract; do not treat a valid origin as proof of user authorization.

### Route protection (UX only — server still enforces)

```tsx
// src/auth/RequireRole.tsx (React 18/19 + React Router 6.4+/7)
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router'; // 'react-router-dom' on v6
import { useSession } from './session'; // project's existing auth hook

export function RequireRole({ role, children }: { role: string; children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (session.status === 'loading') return <p role="status">Checking access…</p>;
  if (session.status === 'anonymous') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (!session.user.roles.includes(role)) return <Navigate to="/forbidden" replace />;
  return <>{children}</>;
}
```

```ts
// src/app/auth/role.guard.ts (Angular 17+, functional guard)
import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { SessionService } from './session.service'; // project's existing auth service

export const requireRole = (role: string): CanMatchFn => () => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (!session.isAuthenticated()) return router.createUrlTree(['/login']);
  return session.hasRole(role) ? true : router.createUrlTree(['/forbidden']);
};
// routes: { path: 'admin', canMatch: [requireRole('admin')], loadChildren: ... }
```

`canMatch` also keeps the lazy chunk from downloading for unauthorized users, but the chunk is still public on the CDN: never put secrets or privileged data in it. Handle `401`/`403` from the API centrally (redirect to login / show forbidden) because the server is the real gate.

### Secrets and dependency audit

```bash
# Anything in the build output is public. Search it before release.
npx vite build && grep -rEi "(secret|private_key|sk_live|BEGIN [A-Z ]*PRIVATE KEY)" dist/ || echo "clean"

# Audit production dependencies (npm 7+; pnpm/yarn have equivalents)
npm audit --omit=dev --audit-level=high
```

Vite exposes only `VITE_*` variables to client code via `import.meta.env`; Angular has no runtime env by default — values in `environment.ts`, `define`, or `NG_APP_*` (community builders) are compiled into the bundle. Public identifiers (API base URL, OAuth client ID, analytics key meant for browsers) are fine; anything that grants access is not.

### CSP response header (deployment-owned)

```text
Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; script-src 'self' 'nonce-{PER_RESPONSE_NONCE}'; style-src 'self' 'nonce-{PER_RESPONSE_NONCE}'; img-src 'self' data: https:; connect-src 'self' https://api.example.com; font-src 'self'; upgrade-insecure-requests
```

This is a starting point, not a copy-paste policy. Generate the nonce per response in the server/edge layer, inject it into allowed scripts/styles, and test the actual production app; remove directives/origins not needed. For Angular nonce support use the root `ngCspNonce` attribute or `CSP_NONCE` injection token; do not embed a fixed nonce.

## Validation Checklist

- [ ] Untrusted strings render as text; all HTML sinks and bypass APIs reviewed.
- [ ] User-rich HTML is sanitized with a maintained allowlist sanitizer and hostile test cases.
- [ ] Production CSP is an HTTP header, report-only tested, then enforced; no static nonce or unjustified `unsafe-inline`.
- [ ] Trusted Types policy names match the exact Angular build/runtime needs, if enabled.
- [ ] Session credential design documents cookie CSRF behavior or script-readable-token exposure.
- [ ] Angular XSRF cookie/header configuration matches the backend and mutating requests are tested.
- [ ] Authorization is checked by the server for each protected request/resource.
- [ ] Return URLs reject untrusted origins and schemes; postMessage uses exact origins and schema validation.
- [ ] No secrets appear in built JS, source maps, public env variables, or CI logs.
- [ ] Dependency audit runs against the committed lockfile; findings are triaged and fixed.

## References

- [OWASP Cross Site Scripting Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
- [MDN: postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [React: dangerouslySetInnerHTML](https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html)
- [Angular: Security best practices](https://angular.dev/best-practices/security)
