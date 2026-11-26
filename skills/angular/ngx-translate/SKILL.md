---
name: ngx-translate
description: Set up and use @ngx-translate/core for runtime i18n in Angular, covering functional providers, HTTP loader with lazy files, pipe vs instant vs stream, key naming, interpolation, fallback language, persisted language switching, missing-translation handling, SSR-safe init and testing. Use when adding translations, switching languages at runtime, upgrading ngx-translate v16/v17 to v18, or choosing between ngx-translate and @angular/localize.
license: MIT
metadata:
  category: angular
  version: "1.0.0"
  frameworks: "angular 17+, @ngx-translate/core 17+"
  last-reviewed: "2026-11-25"
---

# ngx-translate

## Purpose

Deliver runtime-switchable translations without flicker, missing keys showing as raw identifiers, or stale text after a language change. A good setup: providers configured once inside `provideTranslateService`, the initial language loaded before first render, templates using the `translate` pipe, a fallback language, and a missing-key handler that reports gaps in development.

## When to Use

- Adding `@ngx-translate/core` to an app or a lazy feature.
- Translating templates, TypeScript strings, validation messages.
- Implementing a language switcher with persistence.
- Upgrading from v16/v17 to v18 (`currentLang` became a signal, `defaultLang` APIs removed).
- Writing tests for translated components.

Do not use when: the app ships a fixed set of locales, does not need runtime switching, and wants zero runtime cost — prefer `@angular/localize` (compile-time, one build per locale, built-in ICU plurals, extraction via `ng extract-i18n`). For ng-zorro or DevExtreme component locales, see the `ng-zorro` and `devextreme-angular` skills; those libraries have their own locale APIs that must be switched alongside.

## Workflow

1. **Detect.**
   - `package.json`: `@ngx-translate/core`, `@ngx-translate/http-loader`, `@angular/core`. v18 requires Angular 18+ (peer `>=18`); v17 supports Angular 16+ [VERIFY lower bound].
   - Setup style: `provideTranslateService(...)` in `app.config.ts` (v16+ functional) vs `TranslateModule.forRoot(...)` (removed in v18). NgModule apps on v18 still call `provideTranslateService` in the module's `providers`.
   - Find translation files: `public/i18n/*.json` (Angular 17+ CLI `public/` folder) or `src/assets/i18n/*.json`. Match `prefix` to where they are served.
   - SSR: `@angular/ssr` present? Then file loading must work on the server (absolute URL or server-side loader).
   - Zoneless/`OnPush`: the pipe is impure and handles updates; components reading `instant()` into fields will not refresh on language change.
2. **Version notes.**
   - v17: `fallbackLang`/`setFallbackLang` introduced; `defaultLang`, `setDefaultLang`, `useDefaultLang` deprecated. `currentLang` is a string getter.
   - v18: `currentLang` is `Signal<Language | null>` (read with `currentLang()`); new `fallbackLang()` and `isLoading` signals; `getCurrentLang()` may return `null`; `TranslateModule`, `defaultLang` APIs, `langs` getter removed (`getLangs()`); `setTranslation` merges only with the third argument `true`; HTTP loader 404 yields `{}` plus a warning unless `failOnError: true`; `get`/`instant`/`stream` accept an optional `lang` argument; `instant()` inside `computed()` tracks language changes.
   - Do not upgrade majors as a side effect; if you must, run the official migration guide and grep for `currentLang ===` (silently false in v18).
3. **Implement** providers once at root; for lazy features with their own files, use `provideChildTranslateService` on the route.
4. **Verify.** Build, then run with each language; check console for missing-key reports; run tests.

## Best Practices

- Keep loader, compiler, parser, and missing-translation handler **inside** `provideTranslateService({...})`; providers registered separately in the array are ignored.
- Use the `translate` pipe (or `TranslateDirective`) in templates: it reacts to language changes and to late-loaded files.
- Use `instant()` only when the language is already loaded (after the app initializer) and inside reactive contexts (`computed`) on v18; otherwise use `stream()` (emits on every language change, never completes) or `get()` (emits once, completes).
- Load the initial language in `provideAppInitializer` and return the observable so bootstrap waits: no flash of raw keys, and SSR renders translated HTML.
- Key naming: `feature.area.element[.state]`, e.g. `orders.table.empty`, `common.actions.save`. Lowercase, dot-separated, stable; never the English text as key. Keep a `common.*` namespace for shared words.
- Use nested JSON consistently or flat keys consistently; do not mix per file.
- Interpolation: `{{ 'orders.count' | translate: { count: n } }}` with `"orders.count": "{{count}} orders"`. Never build sentences by concatenating translated fragments.
- Plurals/gender need ICU: add `ngx-translate-messageformat-compiler` as `compiler` only if the project needs it.
- Set `fallbackLang` to the most complete language; still treat fallback hits as bugs (handler reports them).
- Persist the chosen language (localStorage in the browser, cookie when SSR must read it) and validate against `getLangs()` before `use()`.
- Update `document.documentElement.lang` (and `dir` for RTL) on `onLangChange`.
- Switch third-party locales (Angular `LOCALE_ID` pipes, ng-zorro `NzI18nService`, DevExtreme `locale()`) in the same handler.
- `useHttpBackend: true` bypasses interceptors if the auth interceptor should not touch static files.
- Cache-bust translation files per deploy (hashed filenames or `enforceLoading`) so users don't see stale keys.

## Anti-patterns

- `translate.instant('x')` in a constructor or field initializer — returns the key before the file loads and never updates; use the pipe or `stream()`.
- `translate.currentLang === 'de'` on v18 — compares a signal to a string, always false; call `currentLang()`.
- `TranslateModule.forRoot()` in new code — removed in v18; use `provideTranslateService`.
- `setDefaultLang('en')` — removed in v18; `setFallbackLang('en')`.
- Concatenating translations (`t('hello') + ' ' + name`) — breaks word order in other languages; use params.
- Putting HTML in translations and binding with `[innerHTML]` without sanitizing — XSS risk; keep markup in templates.
- Subscribing to `onLangChange` in every component without teardown — leaks; use `takeUntilDestroyed()` or signals.
- Returning `''` from a missing handler in development — hides gaps; log the key.

## Implementation Examples

### Root providers with initializer and persisted language

```ts
// src/app/app.config.ts — Angular 19+ (provideAppInitializer), ngx-translate 17/18
import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideMissingTranslationHandler, provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { LanguageService } from './core/i18n/language.service';
import { ReportingMissingHandler } from './core/i18n/reporting-missing-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
      fallbackLang: 'en',
      missingTranslationHandler: provideMissingTranslationHandler(ReportingMissingHandler),
    }),
    provideAppInitializer(() => inject(LanguageService).init()),
  ],
};
```

`provideAppInitializer` is Angular 19+. On 17-18 use `{ provide: APP_INITIALIZER, multi: true, useFactory: () => { const s = inject(LanguageService); return () => s.init(); } }`.

```ts
// src/app/core/i18n/language.service.ts
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, tap } from 'rxjs';

export const SUPPORTED = ['en', 'de', 'vi'] as const;
export type AppLang = (typeof SUPPORTED)[number];
const STORAGE_KEY = 'app.lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  init(): Observable<unknown> {
    this.translate.addLangs([...SUPPORTED]);
    return this.use(this.initial());
  }

  use(lang: AppLang): Observable<unknown> {
    return this.translate.use(lang).pipe(
      tap(() => {
        this.document.documentElement.lang = lang;
        if (this.isBrowser) {
          try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* storage blocked */ }
        }
      }),
    );
  }

  private initial(): AppLang {
    if (!this.isBrowser) return 'en'; // SSR: replace with cookie/Accept-Language via REQUEST token if needed
    let stored: string | null = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    const candidates = [stored, this.translate.getBrowserLang()];
    return (candidates.find((c): c is AppLang => SUPPORTED.includes(c as AppLang)) ?? 'en');
  }
}
```

On v18 a failing `use()` rolls back `currentLang`; the initializer error still aborts bootstrap, so add `catchError(() => this.translate.use('en'))` if a broken file must not blank the app.

### Missing translation handler

```ts
// src/app/core/i18n/reporting-missing-handler.ts
import { isDevMode } from '@angular/core';
import { MissingTranslationHandler, MissingTranslationHandlerParams } from '@ngx-translate/core';

export class ReportingMissingHandler implements MissingTranslationHandler {
  private readonly seen = new Set<string>();

  handle(params: MissingTranslationHandlerParams): string {
    if (isDevMode() && !this.seen.has(params.key)) {
      this.seen.add(params.key);
      console.warn(`[i18n] missing key "${params.key}" for ${params.translateService.getCurrentLang()}`);
    }
    return params.key; // visible in dev; replace with '' or a generic label only if product requires
  }
}
```

The handler runs only after `fallbackLang` also lacks the key.

### Template, TS usage and language switcher

```ts
// src/app/shared/language-switcher.component.ts
import { Component, computed, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AppLang, LanguageService, SUPPORTED } from '../core/i18n/language.service';

@Component({
  selector: 'app-language-switcher',
  imports: [TranslatePipe],
  template: `
    <label for="lang">{{ 'common.language' | translate }}</label>
    <select id="lang" [value]="current()" (change)="switch($event)">
      @for (l of langs; track l) { <option [value]="l">{{ 'common.languages.' + l | translate }}</option> }
    </select>
    <p>{{ 'orders.count' | translate: { count: 3 } }}</p>
  `,
})
export class LanguageSwitcherComponent {
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  protected readonly langs = SUPPORTED;
  // v18: currentLang is a signal. On v17 use toSignal(translate.onLangChange) instead.
  protected readonly current = computed(() => this.translate.currentLang() ?? 'en');

  protected switch(event: Event): void {
    const lang = (event.target as HTMLSelectElement).value as AppLang;
    this.language.use(lang).subscribe();
  }
}
```

```jsonc
// public/i18n/en.json
{
  "common": { "language": "Language", "languages": { "en": "English", "de": "Deutsch", "vi": "Tiếng Việt" } },
  "orders": { "count": "{{count}} orders", "table": { "empty": "No orders yet" } }
}
```

Lazy feature files, SSR loader notes, and tests: [references/lazy-ssr-testing.md](references/lazy-ssr-testing.md).

### ngx-translate vs @angular/localize

| Need | ngx-translate | @angular/localize |
| --- | --- | --- |
| Switch language without reload | Yes | No (one build per locale) |
| Translations editable after deploy | Yes (JSON fetched at runtime) | No |
| Runtime cost | Pipe evaluation + file fetch | None |
| ICU plurals/select | Via extra compiler package | Built in |
| Extraction tooling | Third-party | `ng extract-i18n` |

## Validation Checklist

- [ ] Detected Angular and ngx-translate majors; used APIs that exist in that major (no `currentLang ===` on v18, no `forRoot` on v18).
- [ ] Loader and handler configured inside `provideTranslateService`.
- [ ] Initial language loaded in an app initializer; no raw keys flash on first render.
- [ ] Templates use the pipe; `instant()` only after load or inside `computed()` on v18.
- [ ] Stored language validated against supported list before use.
- [ ] `<html lang>` updated; third-party locales switched together.
- [ ] Missing keys reported in development; fallback language set.
- [ ] No sentence concatenation; params used for dynamic values.
- [ ] SSR renders translated HTML (if SSR present).
- [ ] Tests pass with a fake/static loader.

## References

- [Lazy feature translations, SSR loading, testing](references/lazy-ssr-testing.md)
- https://ngx-translate.org/getting-started/installation/
- https://ngx-translate.org/getting-started/migration-guide/
- https://ngx-translate.org/reference/configuration/
- https://ngx-translate.org/reference/translate-service-api/
- https://angular.dev/guide/i18n
