---
name: angular-standalone-components
description: Build and migrate Angular standalone components, templates, bindings, content projection, control flow, and deferred views. Use when authoring components, reviewing templates, or incrementally adopting standalone APIs.
license: MIT
metadata:
  category: angular
  version: "1.0.0"
  frameworks: "Angular 17+"
  last-reviewed: "2026-11-25"
---

# Angular Standalone Components

## Purpose

Build focused Angular components with explicit template dependencies, typed inputs/outputs, accessible templates, and project-consistent change detection. Keep existing NgModule declarations where appropriate; standalone adoption can be incremental.

## When to Use

- Creating, refactoring, or reviewing Angular components, templates, host bindings, or content projection.
- Migrating selected declarations from an NgModule to standalone.

Do not use when: the task is primarily state modeling with signals (see `angular-signals`) or application structure (see `angular-architecture`).

## Workflow

1. **Detect first** — check `package.json` for installed `@angular/core`; inspect representative components, NgModule declarations, `angular.json`, test setup, and templates. Explicitly identify standalone vs NgModule, zoneless vs `zone.js`, signal adoption, `@if`/`@for` vs `*ngIf`, `inject()` vs constructor DI, and `application`/esbuild vs `browser`/webpack. Follow existing style; do not force migration.
2. **Version matrix** —

   | Angular | Component API notes |
   |---|---|
   | 17 | `@if`/`@for` and `@defer` available; standalone must be specified (`standalone: true`). |
   | 18 | Standalone not yet default; signal inputs/outputs remain preview until v19. |
   | 19 | Components/directives/pipes standalone by default; explicitly set `standalone: false` for NgModule declarations. |
   | 20 | Preserve project CLI naming and standalone conventions. |
   | 21 | New apps zoneless by default; component standalone default remains. |
   | 22 | Undefined `changeDetection` now means OnPush by default; use `ChangeDetectionStrategy.Eager` only when eager behavior is intentional. |

   Signal `input()`/`output()`/`model()` availability and stability differ by release; verify the installed API version before using them [VERIFY].
3. **Design API** — choose required/optional inputs from actual data contract. Use input signal APIs if supported and already aligned with project; otherwise use decorators. Outputs represent events; use `model()` only for genuine two-way state.
4. **Implement** — keep component focused, import only template dependencies, use semantic HTML and accessible labels, and keep state derivation out of lifecycle hooks when `computed()` fits.
5. **Verify** — run component tests and project checks; test input boundaries, projected content, keyboard behavior, and deferred content triggers.

## Best Practices

- Standalone components list directives, pipes, and components in their `imports`; import only what the template uses.
- In Angular 19+, new components are standalone by default [VERIFY]. For older versions specify `standalone: true`; retain `standalone: false` where NgModule declarations require it.
- `input.required<T>()` expresses mandatory input; decorator alternative is `@Input({required: true})` where supported.
- Prefer signal inputs (`input`, `input.required`) and outputs (`output`) only when available in the installed version; do not translate existing decorator APIs without task value.
- Input transforms should be pure, typed, and normalize the boundary (for example, string-to-boolean); avoid hidden domain logic.
- Use `model()` for intentional two-way component state, not merely to avoid naming an output.
- `host` metadata is the preferred host binding surface; use `host: {'[attr.aria-expanded]': 'expanded()'}` or appropriate class/style bindings. Existing `@HostBinding`/`@HostListener` code need not be migrated without reason.
- Use `<ng-content>` for caller-owned content; provide named slots with `select` where roles differ. Projected content is not a template outlet for arbitrary conditional rendering.
- Use `@if`, `@for`, and `@switch` on Angular 17+; track repeated items by stable identity. Existing `*ngIf`/`*ngFor` remains valid.
- Use `@defer` for expensive, non-critical UI when trigger, placeholder, loading, and error behavior are deliberate; verify dependencies can be deferred and test the trigger.
- Use `ChangeDetectionStrategy.OnPush` explicitly for Angular 17–21 when desired; Angular 22 defaults unspecified components to OnPush. Mark unavoidable eager components explicitly with `ChangeDetectionStrategy.Eager` in 22 [VERIFY].
- Prefer direct `[class]`/`[style]` bindings for simple cases; ensure accessible names, visible focus, and error associations.
- Follow local component file suffix conventions. Angular 20 CLI naming changes may omit `.component` [VERIFY]; style-guide URL currently inaccessible, so preserve repository convention.

## Anti-patterns

- Adding `CommonModule` to standalone imports when only built-in control flow is needed; import the exact pipes/directives actually used.
- Adding component-local providers without a deliberate instance boundary.
- Using `model()` for every input/output pair — two-way binding obscures ownership.
- Using effects to copy an input into another signal — derive with `computed()` or use `linkedSignal()` when the value is intentionally writable.
- Overusing `@defer` for tiny or immediately required content — it adds chunk and loading-state complexity.
- Migrating an entire NgModule app just to add a standalone screen — migrate at the changed boundary.
- Omitting stable `track` identity in `@for` for mutable collections.
- Making component methods public solely for template access when `protected` suffices.

## Implementation Examples

```ts
// src/app/profile/profile-card.ts (Angular 19+ signal inputs)
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

interface Profile {
  id: string;
  displayName: string;
}

@Component({
  selector: 'app-profile-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article>
      <h2>{{ profile().displayName }}</h2>
      <button type="button" (click)="selected.emit(profile().id)">Select</button>
    </article>
  `,
  host: { '[attr.data-profile-id]': 'profile().id' },
})
export class ProfileCard {
  readonly profile = input.required<Profile>();
  readonly selected = output<string>();
}
```

```ts
// src/app/profile/profile-card.module-compatible.ts (Angular 17 decorator API)
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-profile-card',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<article><h2>{{ displayName }}</h2></article>',
})
export class ProfileCardModuleCompatible {
  @Input({ required: true }) displayName!: string;
}
```

```html
<!-- src/app/profile/profile-page.html -->
@if (profiles().length > 0) {
  @for (profile of profiles(); track profile.id) {
    <app-profile-card [profile]="profile" (selected)="openProfile($event)" />
  }
} @else {
  <p>No profiles found.</p>
}
```

### Template and projection details

- A standalone component's `imports` is its template compilation scope; tests must import that component or configure its dependencies explicitly.
- Import `AsyncPipe`, `DatePipe`, `NgClass`, or `NgIf` individually as used; built-in control-flow blocks do not require `CommonModule`.
- `@if` supports `as` aliases for one-time reads; use `@let` (stable from Angular 19) for reusable template expressions where supported.
- In `@for`, use a stable domain ID rather than `$index` when items can be inserted, removed, or reordered. Use `$index` only for immutable fixed lists.
- `@empty` belongs inside `@for` for empty collections. Keep a single obvious empty-state message.
- `@switch` can express discriminated state; handle all known cases and retain a deliberate fallback.
- `@defer` dependencies must be standalone and not referenced outside defer blocks in the same template; direct imports, not barrels, preserve chunk splitting.
- `@defer` triggers include `on idle`, `on viewport`, `on interaction`, `on hover`, `on immediate`, `on timer`, and `when`. `when` is one-shot, not a reversible condition.
- Include `@placeholder`, `@loading`, and `@error` when the deferred region can visibly wait or fail. Their dependencies load eagerly; keep these blocks light.
- `@defer` server rendering shows placeholder unless incremental hydration is configured; do not assume the deferred main content renders during SSR.
- `<ng-content select="...">` provides named slots. Add a fallback template only where no projected content is a useful state.
- Use `<ng-template>`/`NgTemplateOutlet` for repeatable template fragments or caller-provided templates; use `<ng-content>` for static projection.
- Content children are not owned by the receiving component; avoid moving or mutating projected DOM outside Angular APIs.
- Use semantic elements before adding ARIA roles. Icon-only controls need an accessible name; projected labels must remain associated with their controls.

### Inputs, outputs, host bindings

- `input.required<T>()` makes the read type `InputSignal<T>` without `undefined`; `input<T>()` is optional and should declare the real default/nullability.
- `input(initial, {alias})` renames only the template binding; property access keeps the TypeScript name.
- Input transforms run at the boundary and must be pure and statically analyzable. `booleanAttribute` treats the literal string `"false"` as false; `numberAttribute` can produce `NaN` for invalid input.
- `model()` creates a writable model input with a paired `Change` output; model inputs do not support transforms. Use only when parent/child intentionally share editable state.
- `output<T>()` emits typed events; outputs do not bubble through the DOM. Use explicit event payloads rather than passing the whole component.
- `input`, `output`, and `model` are initializer APIs; do not invoke them in methods or conditionals.
- Angular 20 CLI supports configurable file-name style guides; `.component.ts` omission is a generation style choice, not a runtime API rule. Preserve the repository's file naming.
- Prefer the `host` metadata object for new host listeners/bindings; `@HostBinding` and `@HostListener` remain for backwards compatibility.
- Host bindings should expose accessible state when appropriate (`aria-expanded`, `aria-selected`), not duplicate template state needlessly.
- Use `OnPush` explicitly below Angular 22. Angular 22 treats missing strategy as OnPush; migration may add `Eager` to preserve old behavior. Do not change an existing component's strategy casually.

```html
<!-- src/app/accordion/accordion-panel.html -->
<h2>
  <button
    type="button"
    [attr.aria-expanded]="expanded()"
    [attr.aria-controls]="panelId()"
    (click)="expanded.set(!expanded())">
    {{ title() }}
  </button>
</h2>
<div [id]="panelId()" [hidden]="!expanded()">
  <ng-content />
</div>
```

```html
<!-- src/app/dashboard/dashboard-page.html -->
@defer (on viewport; prefetch on idle) {
  <app-heavy-chart [series]="series()" />
} @placeholder {
  <p aria-busy="true">Chart will load when visible.</p>
} @loading (after 100ms; minimum 300ms) {
  <p aria-live="polite">Loading chart…</p>
} @error {
  <p role="alert">Chart could not be loaded.</p>
}
```

### Component API details

- Signal input initializers must be static field initializers; the compiler recognizes `input()` calls in component/directive members, not arbitrary helper functions.
- A signal input is read with `value()`; decorator inputs remain property reads. Avoid mixing access styles for one component API.
- `input.required<T>()` still needs the parent template to bind the input; strict template checking catches missing bindings at build time.
- Use `alias` when the public template name should differ from internal naming; avoid aliases that collide with native DOM properties.
- `booleanAttribute` follows HTML boolean-attribute semantics, including string values; use a custom pure transform if the contract is different.
- `numberAttribute` returns `NaN` for invalid strings; validate or use a safe transform if `NaN` is not a valid domain state.
- Model input writes emit the paired change output; avoid emitting redundant events when the value does not change.
- Outputs are event-like, not state stores; emit a fact (`saved`, `selected`) rather than a mutable object the parent can alter.
- Provide a default model value only if parent and child agree on the initial ownership; avoid a default that silently masks a missing binding.
- Keep host bindings static and narrow; do not dynamically construct arbitrary attribute names from untrusted values.
- Host listeners should delegate to a typed class method and avoid directly manipulating DOM.
- Components with encapsulated styles should not rely on global selector leaks for projected content; style via host/context or explicit classes.
- Do not add `CUSTOM_ELEMENTS_SCHEMA` to silence unknown Angular selectors; import or declare the actual component.
- For NgModule declarations, each component/directive/pipe belongs to exactly one module; exports are needed only for cross-module template use.
- `standalone: false` must be explicit in Angular 19+ when declaring in an NgModule; migration schematics handle this on upgrade.
- OnPush components still update from template events, signal dependencies, `async` pipe, `markForCheck`, and input changes; direct mutation of an object reference is not a reliable notification.
- In Angular 22 unspecified strategy is OnPush; use `ChangeDetectionStrategy.Eager` to preserve Default behavior only when necessary.
- `@defer` splitting fails when the dependency is referenced elsewhere in the same file or imported through a barrel; inspect generated bundles if size is the goal.
- `@defer` placeholder and loading sub-block dependencies are eager. Do not import the expensive component in a way that makes it eager elsewhere.
- For viewport/interaction/hover triggers, placeholder must have a single root element; retain dimensions to avoid layout shift.
- A deferred `when` condition triggers once and does not return to placeholder if it later becomes false.
- Keep `@loading` delayed briefly to prevent flicker and use a minimum only when a stable loading affordance is beneficial.
- Defer only non-critical content; don't defer an accessible name, primary heading, or immediate interaction affordance.
- Test `@defer` with `DeferBlockBehavior.Manual` or the project's supported fixture APIs; do not rely on real idle timing in unit tests.
- Prefer built-in control flow for new templates; Angular 20 deprecates `NgIf`, `NgFor`, and `NgSwitch`, but existing directives can be left untouched when migration is unrelated.
- `@let` is available from Angular 18 preview and stable in Angular 19 [VERIFY]; use version-safe template expressions for older apps.
- Accessibility: keep focus in a meaningful location when deferred content appears; ensure placeholder and error state are announced when needed.

## Validation Checklist

- [ ] Checked installed Angular version and standalone/module/template/change-detection conventions.
- [ ] Standalone imports include all and only template dependencies.
- [ ] Input/output types and requiredness reflect caller contract.
- [ ] `@for` has stable tracking; conditional and deferred states are covered.
- [ ] Host attributes and content projection remain accessible.
- [ ] Existing NgModule declarations and naming conventions remain compatible.
