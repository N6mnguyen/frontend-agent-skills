# Angular testing: runners, harnesses, Playwright

## Runner detection and commands

| Runner | Signs | Run | Mocks |
|---|---|---|---|
| Angular CLI + Vitest | `@angular/build:unit-test` builder (default in current CLI), `vitest`, `jsdom` | `ng test` | `vi.fn()`, `vi.useFakeTimers()` |
| Karma/Jasmine | `@angular/build:unit-test` + `runner: 'karma'`, or legacy `@angular-devkit/build-angular:karma` | `ng test --watch=false` | `jasmine.createSpy()` |
| Jest | `jest.config.*`, `jest-preset-angular` | `npx jest` / repo script | `jest.fn()`, `jest.useFakeTimers()` |

Karma is still supported in current Angular docs; it is not marked deprecated there. New Angular CLI projects currently use Vitest, but the exact version that changed the default is not specified in the migration guide [VERIFY]. Do not change the runner just to follow the newest default.

### Vitest builder

```jsonc
// angular.json target
"test": {
  "builder": "@angular/build:unit-test",
  "options": {
    "tsConfig": "tsconfig.spec.json",
    "runnerConfig": "vitest.config.ts"
  }
}
```

`ng test` starts watch mode. For one-shot CI, use `ng test --watch=false`. Browser mode requires a provider such as `@vitest/browser-playwright` and a `browsers` target option. Existing projects migrating from Karma can run the experimental schematic; review its output because it does not edit all config/dependencies:

```bash
ng g @schematics/angular:refactor-jasmine-vitest --project my-app
```

### Jest preset setup

```ts
// setup-jest.ts (CommonJS)
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
setupZoneTestEnv();
```

```ts
// jest.config.ts
import type { Config } from 'jest';
import { createCjsPreset } from 'jest-preset-angular/presets';

const config: Config = {
  ...createCjsPreset(),
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
};
export default config;
```

ESM setup path is `jest-preset-angular/setup-env/zone/index.mjs`. The preset page documents `setupZoneTestEnv`; zoneless setup `setupZonelessTestEnv` and peer-version constraints must be verified against installed preset declarations [VERIFY]. Never add Jest to a Vitest project solely for one test.

## Angular Testing Library

```ts
// src/app/search/search.component.spec.ts — @testing-library/angular 19, Angular 21/22
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SearchComponent } from './search.component';

test('submits the search term', async () => {
  const onSearch = vi.fn(); // use jest.fn() or jasmine.createSpy() for that runner
  const user = userEvent.setup();
  await render(SearchComponent, { inputs: { query: '' }, on: { search: onSearch } });
  await user.type(screen.getByRole('searchbox', { name: /search/i }), 'invoices');
  await user.click(screen.getByRole('button', { name: /submit/i }));
  expect(onSearch).toHaveBeenCalledWith('invoices');
});
```

API options: `inputs` sets `@Input` or `input()`; `on` subscribes to outputs/observables; `bindings` uses Angular input/output/two-way bindings; `providers`, `componentProviders`, `imports`, `routes`. `componentInputs`, `componentOutputs`, `componentProperties` are deprecated; use the newer names. `rerender({inputs})` clears omitted inputs unless `partialUpdate: true`.

Compatibility published by Testing Library: `@testing-library/angular` 19.x → Angular 21/22; 17.x → Angular 17-20; Angular 20 also supports 18.x. Check the table before upgrading.

## Harnesses

```ts
// src/app/dialog/dialog.component.spec.ts
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatButtonHarness } from '@angular/material/button/testing';
import { TestBed } from '@angular/core/testing';

it('closes when the confirmation button is clicked', async () => {
  const fixture = TestBed.createComponent(ConfirmDialogComponent);
  const loader = TestbedHarnessEnvironment.loader(fixture);
  const button = await loader.getHarness(MatButtonHarness.with({ text: 'Confirm' }));
  await button.click();
  expect(fixture.componentInstance.closed).toBe(true);
});
```

Material harness import pattern should match the installed Material version. For a menu/dialog rendered in the document overlay, use `TestbedHarnessEnvironment.documentRootLoader(fixture)` instead of `loader(fixture)`. Harness APIs expose user-level actions while insulating tests from private DOM classes.

## Zone-based async vs zoneless

- `fakeAsync`, `tick`, `flushMicrotasks`, `waitForAsync` are Zone.js-specific utilities; docs do not mark them deprecated. They require `zone.js/testing` (verify in current runner setup).
- Angular CLI Vitest docs: `fakeAsync` can work with the patch `zone.js/plugins/vitest-patch` in the test target polyfills, but native `async` + Vitest fake timers are recommended.
- For zoneless tests, use `await fixture.whenStable()` after events or HTTP completion. `autoDetectChanges()` can be enabled if the suite expects application-like view sync.
- Avoid combining `fakeAsync` and `async` in one test.

## Playwright e2e

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:4200', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run start -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4200',
    reuseExistingServer: !process.env.CI,
  },
});
```

```ts
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

test('customer places an order', async ({ page }) => {
  await page.goto('/checkout');
  await page.getByLabel('Email').fill('buyer@example.test');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
});
```

Use `page.route()` to stub external services in UI-only tests. For integration tests, prefer a disposable backend/DB over mocks. Use `storageState` for login rather than logging in in every test. Trace viewer and screenshots should be retained on CI failure, not all passes.

## Runnable self-check

```ts
// scripts/assert-angular-test-target.mjs — run: node scripts/assert-angular-test-target.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const angular = JSON.parse(readFileSync('angular.json', 'utf8'));
const project = angular.defaultProject ?? Object.keys(angular.projects)[0];
const target = angular.projects[project].architect?.test ?? angular.projects[project].targets?.test;
assert.ok(target, 'Angular project needs a test target');
assert.match(target.builder, /unit-test|karma|jest/, `Unexpected test builder: ${target.builder}`);
console.log(`Test builder detected: ${target.builder}`);
```

Use this only when authoring reusable repo automation; a one-off test does not need a new script.
