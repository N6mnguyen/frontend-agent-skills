# ngx-translate: lazy files, SSR, tests

Version notes: v18 requires Angular 18+; use APIs matching the installed major. `TranslateModule` was removed in v18. `currentLang()` is a signal in v18; v17 uses a string property.

## Lazy feature translations

Prefer one root catalog unless feature teams own separate files. `provideChildTranslateService` accepts `loader`, `compiler`, `parser`, `missingTranslationHandler`, `retry` (not `lang`/`fallbackLang`, which come from the root). Lookup walks child then parent; child writes never reach the parent.

```ts
// src/app/app.routes.ts — ngx-translate v18
import { Routes } from '@angular/router';
import { provideChildTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

export const routes: Routes = [
  {
    path: 'billing',
    providers: [
      provideChildTranslateService({
        loader: provideTranslateHttpLoader({ prefix: '/i18n/billing/', suffix: '.json' }),
      }),
    ],
    loadComponent: () => import('./billing/billing.component').then((m) => m.BillingComponent),
  },
];
```

Passing `provideTranslateHttpLoader(...)` as a child `loader` mirrors the documented root usage; confirm in the installed typings [VERIFY]. Alternative with a single root loader and `resources`:

```ts
// app.config.ts; ngx-translate v18 multi-resource HTTP loader
provideTranslateService({
  loader: provideTranslateHttpLoader({
    resources: [
      { prefix: '/i18n/common/', suffix: '.json' },
      { prefix: '/i18n/billing/', suffix: '.json' },
    ],
  }),
  fallbackLang: 'en',
});
```

Multi-resource loader fetches all configured files for every language, so use only for small catalogs. If feature files are loaded on demand instead, use a child service or a feature-owned API that calls `setTranslation`; do not fetch every feature catalog on initial load.

## SSR and async initialization

- `provideAppInitializer` waits for a returned promise/observable, making it the simplest way to ensure the initial language is ready before Angular renders.
- For SSR, a browser-only loader path like `/i18n/en.json` may not resolve on the server. Provide an absolute base URL or a server-specific loader, and transfer/cookie language state so server and browser render the same language.
- Do not use localStorage on the server; read language from a request cookie/header through Angular's request token, with browser localStorage only as a client preference.
- If translations are fetched by both server and browser, use Angular HTTP transfer cache only if the loader uses `HttpClient` and response caching is configured safely.
- On language change, update `<html lang>` and, for RTL languages, `dir`; ensure the server emits matching attributes on the first render.

## Tests: static loader

ngx-translate itself ships no `TranslateTestingModule`; that name comes from the third-party `ngx-translate-testing` package [VERIFY compatibility with v18]. If the project already uses it, keep it. Otherwise use the real service with a static loader, which needs no extra dependency:

```ts
// src/app/shared/header.component.spec.ts — ngx-translate v17/v18
import { TestBed } from '@angular/core/testing';
import { TranslateLoader, TranslationObject, provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { HeaderComponent } from './header.component';

class StaticLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return of(lang === 'fr' ? { 'header.title': 'Accueil' } : { 'header.title': 'Home' });
  }
}

describe('HeaderComponent', () => {
  it('renders the loaded translation', async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideTranslateService({
          loader: provideTranslateLoader(StaticLoader),
          lang: 'en',
          fallbackLang: 'en',
        }),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Home');
  });
});
```

`TranslationObject` is the v18 return type of `getTranslation`; on older majors the type name may differ [VERIFY]. `fixture.whenStable()` works for async setup; in zoneless tests, prefer signals and `whenStable()` over forcing `detectChanges()`.

Test language switching by calling `TranslateService.use('fr')`, awaiting completion, then asserting translated DOM and `currentLang()` (v18). Test a missing key with a fake handler; test loader failure both with default HTTP behavior and `failOnError: true` if configured.

## Validation checklist

- [ ] Root bootstrap waits for initial language.
- [ ] Lazy feature-only keys are not duplicated in root file.
- [ ] SSR and browser choose the same initial locale.
- [ ] Static loader tests cover initial language, switch, fallback, missing key, and failed load.
- [ ] Tests assert translated DOM, not internal service implementation.
