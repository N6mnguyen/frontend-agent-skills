---
name: ng-zorro
description: Build ng-zorro-antd UIs with Angular, including standalone imports, providers, Less and CSS-variable themes, server-paged nz-table, reactive nz-form, modal/drawer, remote nz-select, upload and tree-shaken icons. Use when adding or maintaining ng-zorro-antd components.
license: MIT
metadata:
  category: angular
  version: "1.0.0"
  frameworks: "angular 17+, ng-zorro-antd 17+"
  last-reviewed: "2026-11-25"
---

# ng-zorro-antd

## Purpose

Implement ng-zorro components with package-major alignment, explicit configuration, and behavior verified against the installed release. Standalone Angular projects can import component modules directly; ng-zorro's package offers `Nz*Module` imports, not a blanket assumption that every control exports a standalone `Nz*Component`.

## When to Use

- Building screens with `ng-zorro-antd` (`nz-table`, `nz-form`, `nz-select`, `nz-upload`, modal/drawer).
- Configuring NG-ZORRO locale, icon registration, global defaults, theme, or production bundle.
- Do not use when the codebase uses another UI kit; follow the established kit.

## Workflow

1. **Detect.** Read `package.json` for `@angular/core`, `ng-zorro-antd`, `@ant-design/icons-angular`, `@angular/cdk`. Check `angular.json` style preprocessor/theme config, bootstrap providers, standalone vs NgModule, zoneless, signals, built-in control flow, existing imports and locale.
2. **Align.** Use ng-zorro major aligned with Angular major; confirm actual lockfile. Run `ng add ng-zorro-antd` only for initial integration; do not rerun blindly on an established app. Angular 17+ standalone app: put `NzButtonModule` etc. in component `imports`; NgModule app: put them in the owning NgModule. The official setup docs show `NzButtonModule`, not `NzButtonComponent`.
3. **Configure.** Use the matching locale (`provideNzI18n`), explicit icons (`provideNzIcons`), and only needed global defaults (`provideNzConfig`). Confirm APIs available in installed release.
4. **Implement.** Reuse existing data API, error patterns, form styles, and theme tokens.
5. **Verify.** Run production build and tests; inspect table server calls, overlay lifecycle, keyboard use, theme, and generated bundle.

## Best Practices

- **Standalone imports:** `import { NzTableModule } from 'ng-zorro-antd/table'`; `imports: [NzTableModule]`. Module import works in standalone components; importing per-component module limits dependencies. Some component docs may expose newer standalone APIs; verify, don't assume.
- **Global locale:** `import { provideNzI18n, en_US } from 'ng-zorro-antd/i18n';` then `providers: [provideNzI18n(en_US)]`. `NzI18nService.setLocale(en_US)` changes locale at runtime. Register Angular locale data separately via `registerLocaleData` for Angular date/number pipes.
- **Global config:** `provideNzConfig(config)` from `ng-zorro-antd/core/config`; runtime config via injected `NzConfigService.set('button', {nzSize: 'large'})`. Priority: component input > config provider > library default.
- **Icons:** register only used icons with `provideNzIcons([...])` from `ng-zorro-antd/icon` and icon definitions from `@ant-design/icons-angular/icons`. `provideNzIconsPatch` can add icons at a route/component boundary. Do not import every icon; wildcard registration harms bundle size.
- **Theming, Less:** official docs support Less entry points (`ng-zorro-antd.less`, dark/compact variants) and variable overrides. Configure the Less builder before using Less variables; keep overrides in one theme file.
- **Theming, CSS variables:** variable theme file `ng-zorro-antd.variable.min.css` and `NzConfigService.set('theme', {primaryColor: '#1890ff'})` are documented as experimental. Requires CSS variable support; avoid mixing multiple Ant Design CSS bundles with shared `--ant` prefix.
- **Server table:** bind `[nzFrontPagination]="false"`, `[nzTotal]`, `[nzLoading]`; handle `(nzQueryParams)` which emits page index/size, sort `{key,value}` pairs, filters `{key,value}`. Enable `[nzSortFn]="true"` and server filters as documented. API response total must match filter set.
- **Reactive `nz-form`:** import `ReactiveFormsModule`, `NzFormModule`, control modules. Bind `[formGroup]`, `formControlName`, use `nzErrorTip` with text/template; `nzValidateStatus` can bind to a control. `nzHasFeedback` is mainly for inputs.
- **Modal/drawer:** inject `NzModalService` / `NzDrawerService`; pass typed `nzData`, inject `NZ_MODAL_DATA` / `NZ_DRAWER_DATA`, and use `afterClose` to receive result. Return false or unresolved promise from `nzOnOk` to prevent modal close when validation fails.
- **Message vs notification:** `NzMessageService` for short transient confirmation; `NzNotificationService` for longer/actionable notices. Avoid duplicating live-region announcement if service already announces.
- **Remote select:** set `nzServerSearch`, handle `(nzOnSearch)`, debounce and `switchMap`, bind `[nzLoading]`, and define empty/error states. Set `nzFilterOption` if custom local behavior is needed.
- **Upload:** `nzBeforeUpload` returns boolean/Observable; return false to prevent automatic request for manual mode. `nzAction`, `nzSize`, `nzFileType` are client hints, never security enforcement. Enforce content and permission server-side.
- **Accessibility:** labels, described hints, keyboard-operable overlays, focus return after modal/drawer, visible upload progress and error status.
- **Message/notification service providers:** standalone app configuration commonly provides `NzMessageService` and `NzNotificationService` through their modules; verify provider setup for installed major before placing either at root.
- **Drawer lifecycle:** call `ref.close(result)` for a successful save and subscribe to `ref.afterClose`; close on cancel without a result. Keep component state in `nzData`, not mutable global config.
- **Select option model:** `nzOptions` accepts `{label, value, key?, disabled?, hide?, groupLabel?}`; use either `nzOptions` or `<nz-option>`, not both for the same select.
- **Icon font alternative:** use `NzIconService.fetchFromIconfont()` only if the app already serves an iconfont script; prefer explicit SVG icon definitions for predictable bundle/security behavior.
- **LESS versions:** old Less imports may require tilde syntax; modern builder resolution can reject it. Copy the path form used in the project’s working build config and test production, not just dev server.
- **Locale side effects:** ng-zorro locale controls component labels; Angular `registerLocaleData` controls `DatePipe` / `DecimalPipe`. Set both where date or currency formatting must change.
- **Overlay cleanup:** service-created modal/drawer refs are self-managed after close, but any subscriptions to `afterClose` owned by long-lived services need teardown or `takeUntilDestroyed`.
- **Upload progress:** default upload emits `nzChange` status values `uploading`, `done`, `error`, `removed`; with `nzCustomRequest`, call its progress/success/error callbacks. Clean removed entries from bound file list.
- **Remote search:** clear options on a new term, debounce, cancel stale results with `switchMap`, and show no-results separately from failed search; avoid filtering only the already-loaded page.
- **Dynamic theme:** changing `NzConfigService` theme requires the variable CSS bundle; LESS themes are compiled and cannot be switched by changing the runtime config.
- **Tree-shaking check:** inspect production budget/build stats after registering icons or adding a component module; verify unused icons are absent instead of relying on tree-shaking assumptions.
- **NgModule compatibility:** older applications may require `NzModalModule`, `NzDrawerModule`, `NzMessageModule`, `NzNotificationModule`, `NzUploadModule`, or `NzSelectModule` imported in their owning module. Avoid `forRoot()` unless the installed docs explicitly require it.
- **Version alignment detail:** all `ng-zorro-antd` patch releases are not guaranteed to pair with every Angular patch; prefer the latest matching release listed by their compatibility matrix.
- **Runtime config scope:** `provideNzConfig` belongs at the application injector for global defaults; feature overrides belong at a narrower injector only if that API is supported for the component.
- **Testing:** test loading/empty/error and keyboard selection behavior; service mocks should exercise `nzOnSearch` and `nzQueryParams` rather than directly invoking private component methods.
- **Production styles:** include either global component CSS or selected component styles (base style first); do not import both the all-components stylesheet and every per-component stylesheet.
- **Build configuration:** `ng add` may alter styles, providers, and animations; review the diff before accepting schematics in an established repo.
- **Loading overlays:** avoid stacking `nzLoading`, a skeleton, and a modal spinner simultaneously; choose one primary feedback treatment per region.
- **Form auto tips:** `nzAutoTips` can centralize validation strings; disable or override it where localized error wording is already supplied by the app.
- **Safe notifications:** never put server stack traces or raw exception text into messages; map to a user-safe message and log details through the app's error service.
- **Standalone imports in route components:** import only the modules needed by that route; lazy route chunks then avoid loading controls on the initial screen.
- **Version audit:** before using APIs such as `provideNzIconsPatch`, check the package's installed `.d.ts`; older releases may expose a different icon registration API.
- **RTL:** set both Angular locale direction and component-level `nzDirection`/global direction config as supported; test keyboard navigation with RTL layouts.
- **Server errors:** when a query fails, retain the current page/filter inputs so retry does not reset user context; don't report an empty table as a successful result.
- **Theme tokens:** avoid hard-coding component internals; place deliberate overrides in the project's theme variables and document only the local customization.
- **Package source:** use imports from `ng-zorro-antd/<component>`; avoid deep imports into `fesm2022`, `lib`, or generated bundles.
- **Fallback:** if a component feature does not exist in the installed major, use the closest supported API and leave the project version unchanged.
- **Review discipline:** check one official component page and its version selector for uncertain input signatures; a similar prop in another Ant Design framework is not proof.
- **No mass cleanup:** do not upgrade dependencies, change Less to CSS variables, or convert `Nz*Module` to standalone APIs during a feature fix.
- **Runtime language persistence:** store the app locale in one place and update document `lang`/`dir` alongside `NzI18nService`.
- **Table sizing:** bind `nzPageSizeOptions` and `nzShowSizeChanger` only when user page-size changes are supported by the API.
- **Empty states:** table no-data text should explain the state and offer a reset-filter action where relevant.
- **Component-specific defaults:** keep global defaults conservative; local exceptions belong on the component input, not a global config affecting unrelated screens.
- **Validation:** client-side forms improve feedback but never replace server validation for authorization or business invariants.
- **Keyboard focus:** after upload selection or failed submit, keep focus predictable; avoid programmatically moving focus on every validation change.
- **Network:** avoid loading locale/icon assets from untrusted third-party origins; use same-origin assets or an approved CDN.
- **Error reporting:** avoid duplicate message + notification + inline alert for a single failure.
- **Upgrade:** when bumping the package major, run visual regression for overlay, table, and form screens because CSS behavior can change independently of TypeScript compatibility.
- **Component availability:** use the package version's docs and exports rather than assuming the latest site's code runs against an older lockfile.
- **Accessibility review:** test with keyboard and a screen reader for dialogs, table pagination, select search, and upload feedback.
- **Performance:** avoid rendering thousands of `<nz-option>` nodes; use server-side search or virtual scrolling where supported.
- **Data boundaries:** map UI events to app query DTOs in the feature API adapter, not directly in templates.
- **CSS specificity:** avoid `::ng-deep` for new styling; use supported global theme styles or component host styles.
- **Colors:** preserve contrast in custom themes and status colors in dark mode.
- **Version-specific provider names:** use the providers documented for this installed major; do not retain both provider and legacy token config unless compatibility requires it.
- **Accessibility label:** icon-only buttons require an accessible name, even when the icon tooltip is visible.
- **Security:** never bind untrusted HTML from translation strings or API data into `[innerHTML]`.
- **License:** ng-zorro-antd is MIT, but third-party icon assets may have separate license terms; review asset provenance.
- **Avoid duplication:** share one wrapper component only after repeated real use; do not create a generic wrapper for every ng-zorro control.
- **Output events:** unsubscribe from component outputs only when using imperative subscriptions; template event bindings are cleaned up automatically.
- **SSR:** verify overlay and browser-only APIs in SSR; guard direct `window`/`document` usage.
- **Hydration:** don't render locale-dependent text differently on server and client.
- **Imports:** standalone components support NgModule imports; importing modules is not itself a reason to migrate the library.
- **Labels:** `nz-form-label` `nzFor` should match the actual input `id`.
- **Error focus:** focus the first invalid input on submit, not the `nz-form-control` wrapper.
- **Pagination:** server API should clamp invalid page/pageSize and return consistent total count.
- **Filtering:** clear prior server filters when user clears a column filter.
- **Sorting:** specify a default sort in the API query when required; do not assume table emits initial sort.
- **Messages:** keep toast lifetime and notification close behavior consistent with app conventions.
- **Modal result:** model result as a discriminated union if cancel/save outcomes differ.
- **Drawer width:** check narrow screens and avoid fixed desktop width overflowing mobile.
- **Upload retry:** retain failed files only when retry is supported; otherwise remove/reset with clear feedback.
- **Remote select:** preserve selected option label when it is not in the current search result list.
- **Icons:** avoid iconfont loading if explicit definitions already serve the same need.
- **Theme:** CSS-variable theme experimental status means production use should be an explicit project choice.
- **Testing:** keep tests independent of localized literal strings where locale switching is a product feature; assert roles and behavior.
- **Check output:** inspect accessible name and focus order after visual theme changes.
- **Do less:** the simplest supported component input beats a wrapper or custom directive.
- **Final pass:** ensure all new imports resolve against lockfile versions and production build.

## Anti-patterns

- Importing all ng-zorro modules at root — hides ownership and increases bundle surface.
- Registering every icon — bloats initial chunks; use explicit icons / patch registration.
- `nzFrontPagination=true` on server-paged results — table paginates current page as if it were all records.
- Passing raw sort/filter expressions directly to SQL — whitelist keys and operations in API layer.
- Using CSS-variable theme as if stable — docs mark dynamic variable theme experimental.
- Depending on a control's private DOM class or global style override — use inputs, config, and supported theme customization.
- Trusting `nzAccept`, `nzSize`, `nzFileType` as file validation — backend must validate.

## Implementation Examples

### Standalone provider setup (Angular 17+, ng-zorro-antd aligned major)

```ts
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideNzI18n, en_US } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { AccountBookFill, SearchOutline } from '@ant-design/icons-angular/icons';
import { provideNzConfig, NzConfig } from 'ng-zorro-antd/core/config';

const config: NzConfig = {
  message: { nzTop: 96 },
  notification: { nzTop: 120 },
};

export const appConfig: ApplicationConfig = {
  providers: [provideNzI18n(en_US), provideNzIcons([AccountBookFill, SearchOutline]), provideNzConfig(config)],
};
```

### Server-side table

```ts
// src/app/orders/orders.component.ts
import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { OrdersApi, Order } from './orders.api';

@Component({
  selector: 'app-orders',
  imports: [NzTableModule],
  template: `
    <nz-table [nzData]="rows()" [nzFrontPagination]="false" [nzTotal]="total()"
      [nzPageIndex]="page()" [nzPageSize]="pageSize()" [nzLoading]="loading()"
      (nzQueryParams)="query($event)">
      <thead><tr><th nzColumnKey="name" [nzSortFn]="true">Name</th></tr></thead>
      <tbody>@for (row of rows(); track row.id) { <tr><td>{{ row.name }}</td></tr> }</tbody>
    </nz-table>
  `,
})
export class OrdersComponent {
  private readonly api = inject(OrdersApi);
  protected readonly rows = signal<Order[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly loading = signal(false);

  protected query(p: NzTableQueryParams): void {
    this.page.set(p.pageIndex);
    this.pageSize.set(p.pageSize);
    this.loading.set(true);
    this.api.list({page: p.pageIndex, pageSize: p.pageSize, sort: p.sort, filters: p.filter})
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => { this.rows.set(result.items); this.total.set(result.total); },
        error: () => { this.rows.set([]); this.total.set(0); },
      });
  }
}
```

The API should whitelist sort/filter keys and return `{ items, total }`. If query params change rapidly, route them through a `Subject` + `switchMap` to drop stale responses. Modal, remote select, and upload examples: [references/overlays-select-upload.md](references/overlays-select-upload.md).

### Reactive form with `nzErrorTip`

```html
<!-- src/app/profile/profile.component.html -->
<form nz-form [formGroup]="form">
  <nz-form-item>
    <nz-form-label nzFor="email" nzRequired>Email</nz-form-label>
    <nz-form-control nzHasFeedback [nzErrorTip]="emailError">
      <input nz-input id="email" formControlName="email" autocomplete="email" />
      <ng-template #emailError let-control>
        @if (control.hasError('required')) { Email is required. }
        @else if (control.hasError('email')) { Enter a valid email. }
      </ng-template>
    </nz-form-control>
  </nz-form-item>
</form>
```

## Validation Checklist

- [ ] Detected package versions, standalone/NgModule, zoneless, signals, and control flow.
- [ ] `ng-zorro-antd` major aligned with Angular; imports confirmed from installed package.
- [ ] Locale, icons, global config registered only as required.
- [ ] Theme method matches configured builder; experimental CSS variables not assumed stable.
- [ ] Server table has front pagination disabled and total count contract tested.
- [ ] Filters/sorts whitelisted; errors/loading handled.
- [ ] Form errors accessible and tied to reactive control state.
- [ ] Modal/drawer returns focus and communicates close result.
- [ ] Upload validations duplicated server-side; progress/failure accessible.
- [ ] Production build reviewed for icon and theme bundle cost.

## References

- [Modal, remote select, upload examples](references/overlays-select-upload.md)
- https://ng.ant.design/docs/getting-started/en
- https://ng.ant.design/docs/i18n/en
- https://ng.ant.design/docs/global-config/en
- https://ng.ant.design/docs/customize-theme/en
- https://ng.ant.design/docs/customize-theme-variable/en
- https://ng.ant.design/components/table/en
- https://ng.ant.design/components/form/en
- https://ng.ant.design/components/modal/en
- https://ng.ant.design/components/drawer/en
- https://ng.ant.design/components/select/en
- https://ng.ant.design/components/upload/en
- https://ng.ant.design/components/icon/en
