---
name: angular-reactive-forms
description: Build strictly typed Angular reactive forms with FormGroup<T>, NonNullableFormBuilder, FormArray rows, sync/cross-field/async validators, server error mapping, config-driven forms, ControlValueAccessor components and accessible error display. Use when creating or reviewing Angular forms, validators, form arrays, custom form controls, or deciding between reactive forms and Signal Forms.
license: MIT
metadata:
  category: angular
  version: "1.0.0"
  frameworks: "angular 17+"
  last-reviewed: "2026-11-25"
---

# Angular Reactive Forms

## Purpose

Produce forms whose TypeScript types match the data the API expects, whose validation runs at the right time, and whose errors every user can perceive. A good form here: no `any`, no `UntypedFormGroup` in new code, validators are pure functions, server errors land on the matching control, and disabled fields are handled deliberately in the submit payload.

## When to Use

- Building or changing a form that uses `FormGroup`, `FormControl`, `FormArray`, `FormBuilder`.
- Writing a custom validator, async validator, or cross-field rule.
- Mapping a 400/422 response onto form fields.
- Creating a reusable input component that must work with `formControlName`.
- Rendering a form from a JSON/config definition.

Do not use when: the project already uses template-driven forms for a screen and the change is small (follow that style), or the project has opted into Signal Forms (see "Signal Forms" below). For HTTP plumbing see the `angular-http` skill; for ng-zorro form layout see the `ng-zorro` skill.

## Workflow

1. **Detect versions and style.**
   - Read `package.json`: `@angular/core`, `@angular/forms`. Note the major.
   - Check bootstrap: `bootstrapApplication` + `app.config.ts` means standalone; `AppModule` means NgModule. Import `ReactiveFormsModule` wherever the project imports its other dependencies (component `imports` or module `imports`).
   - Check templates for `@if`/`@for` (Angular 17+) vs `*ngIf`/`*ngFor`. Match what the file already uses.
   - Check for `provideZonelessChangeDetection` (v20) or the absence of `provideZoneChangeDetection` on v21+ (zoneless is the v21+ default). Under zoneless, plain field mutation does not refresh the view; drive form-derived UI through signals (`toSignal(control.valueChanges)`) or template bindings to the control itself.
   - Search for existing helpers: `grep -r "ValidatorFn\|ControlValueAccessor\|setServerErrors" src/`. Reuse them.
2. **Version notes.**
   - Typed forms: Angular 14+. Every supported version here has them.
   - `fb.nonNullable` / `NonNullableFormBuilder`: Angular 14+.
   - `control.events` unified stream (`ValueChangeEvent`, `StatusChangeEvent`, `TouchedChangeEvent`, `PristineChangeEvent`, `FormSubmittedEvent`, `FormResetEvent`): Angular 18+ [VERIFY exact introduction release]; stable in v22 docs. On 17, use `valueChanges` / `statusChanges` and your own touched tracking.
   - Signal Forms (`@angular/forms/signals`): introduced in v21 as experimental [VERIFY]; the v22 API reference marks `form()` stable since v22.0. Use only if the project opts in.
   - On v22, components default to `OnPush`. Reactive form controls still update their own DOM, but custom UI computed from `form.value` in a getter will not refresh unless something marks the view; prefer signals.
3. **Model first.** Write the payload interface, then the controls type. Decide per field: nullable or not, disabled-but-submitted or not.
4. **Implement** with `NonNullableFormBuilder` (inject it) unless the project uses `new FormGroup(...)` style consistently.
5. **Wire errors and a11y** using the project's existing error component if one exists.
6. **Verify.** `npx tsc --noEmit -p tsconfig.app.json`, lint, and the test runner the project uses (see `angular-testing` skill). Test: invalid submit, async pending state, server error mapping, reset.

## Best Practices

- Inject `NonNullableFormBuilder` (or use `fb.nonNullable`) so `reset()` returns to the initial value instead of `null`, and value types drop `| null`.
- Let inference type the form; only declare a `FormGroup<{...}>` interface when the form is passed across component boundaries or built in a factory.
- Keep `ValidatorFn` pure and synchronous; return `null` for valid. Parameterize via a factory (`minAge(18)`).
- Put cross-field validators on the parent group via `{ validators: [...] }`. Read children with `group.get('x')`. Return the error on the group; display it near the second field.
- Async validators: return an `Observable` that completes. Debounce inside with `timer(300).pipe(switchMap(...))` (cancellation is automatic because Angular unsubscribes from the previous run). Add `updateOn: 'blur'` for expensive checks.
- Never let an async validator error out: `catchError(() => of(null))` and let the server reject on submit.
- Map server errors with `control.setErrors({ server: message })`; the next value change re-runs validators and clears it automatically.
- Use `getRawValue()` when disabled controls must be submitted (IDs, read-only fields). `value` omits disabled children. Pick one explicitly in `submit()`.
- `FormArray` rows: create via a factory method, track with a stable ID in `@for (...; track row.controls.id.value)` or `track $index` only if rows are never reordered.
- Mark all touched on invalid submit (`form.markAllAsTouched()`), then focus the first invalid control.
- Error display: `aria-invalid`, `aria-describedby` pointing at the error element, error text not color-only, `role="alert"` or a live region only for the submit summary (not every keystroke).
- Reusable controls implement `ControlValueAccessor` and register via `NG_VALUE_ACCESSOR` with `forwardRef`; implement `setDisabledState`.
- Config-driven forms: define a discriminated union config type; build controls in one function; keep validators referenced by name from a whitelist map, not eval'd.

## Anti-patterns

- `UntypedFormGroup` / `FormGroup<any>` in new code — loses all type safety; type it or let inference do it.
- `form.value as Payload` — hides disabled-field omissions; use `getRawValue()` or map explicitly.
- Calling HTTP inside a sync validator or `valueChanges.subscribe` without cancellation — race conditions; use an `AsyncValidatorFn` with `switchMap`.
- Subscribing to `valueChanges` without teardown in a component — leak; use `takeUntilDestroyed()` or `toSignal`.
- `setErrors(null)` to "clear server error" — wipes validator errors too; call `updateValueAndValidity()` instead.
- Disabling via `[disabled]` attribute binding on a reactive control — Angular warns; use `control.disable()`.
- Showing errors before interaction — gate on `touched || submitted`.
- A `ControlValueAccessor` that emits `onChange` inside `writeValue` — creates loops and dirties pristine forms.
- Migrating existing forms to Signal Forms as part of an unrelated change.

## Implementation Examples

### Typed form with FormArray, cross-field and async validators

```ts
// src/app/features/signup/signup.validators.ts
import { inject } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, catchError, map, of, switchMap, timer } from 'rxjs';
import { UsersApi } from '../../core/users-api';

export function minAge(years: number): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    if (!control.value) return null;
    const born = new Date(control.value);
    const limit = new Date();
    limit.setFullYear(limit.getFullYear() - years);
    return born <= limit ? null : { minAge: { required: years } };
  };
}

export const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const pw = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return pw && confirm && pw !== confirm ? { passwordMismatch: true } : null;
};

// Must be created inside an injection context (field initializer of a component/service).
export function uniqueEmail(): AsyncValidatorFn {
  const api = inject(UsersApi);
  return (control: AbstractControl<string>): Observable<ValidationErrors | null> =>
    timer(300).pipe(
      switchMap(() => api.emailExists(control.value)),
      map((exists) => (exists ? { emailTaken: true } : null)),
      catchError(() => of(null)), // server re-validates on submit
    );
}
```

```ts
// src/app/features/signup/signup-form.component.ts
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { minAge, passwordsMatch, uniqueEmail } from './signup.validators';
import { SignupApi, SignupPayload } from './signup-api';
import { applyServerErrors } from '../../shared/forms/server-errors';
import { FieldErrorComponent } from '../../shared/forms/field-error.component';

@Component({
  selector: 'app-signup-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './signup-form.component.html',
})
export class SignupFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(SignupApi);
  protected readonly submitted = signal(false);

  protected readonly form = this.fb.group({
    email: this.fb.control('', {
      validators: [Validators.required, Validators.email],
      asyncValidators: [uniqueEmail()],
      updateOn: 'blur',
    }),
    birthDate: ['', [Validators.required, minAge(18)]],
    passwords: this.fb.group(
      { password: ['', [Validators.required, Validators.minLength(12)]], confirm: [''] },
      { validators: [passwordsMatch] },
    ),
    phones: this.fb.array([this.phoneRow()]),
  });

  protected phoneRow() {
    return this.fb.group({ id: crypto.randomUUID(), number: ['', Validators.required] });
  }
  protected addPhone(): void { this.form.controls.phones.push(this.phoneRow()); }
  protected removePhone(i: number): void { this.form.controls.phones.removeAt(i); }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.form.pending) {
      this.form.markAllAsTouched();
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const raw = this.form.getRawValue(); // fully typed, includes disabled controls
    const payload: SignupPayload = {
      email: raw.email,
      birthDate: raw.birthDate,
      password: raw.passwords.password,
      phones: raw.phones.map((p) => p.number),
    };
    this.api.create(payload).subscribe({
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 422) applyServerErrors(this.form, err.error);
      },
    });
  }
}
```

```html
<!-- src/app/features/signup/signup-form.component.html -->
<form [formGroup]="form" (ngSubmit)="submit()" novalidate>
  <label for="email">Email</label>
  <input id="email" type="email" formControlName="email" autocomplete="email"
         [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched"
         aria-describedby="email-error" />
  @if (form.controls.email.pending) { <span aria-live="polite">Checking…</span> }
  <app-field-error id="email-error" [control]="form.controls.email" [submitted]="submitted()" />

  <fieldset formGroupName="passwords">
    <legend>Password</legend>
    <input type="password" formControlName="password" aria-label="Password" />
    <input type="password" formControlName="confirm" aria-label="Confirm password"
           aria-describedby="pw-error" />
    @if (form.controls.passwords.hasError('passwordMismatch') && form.controls.passwords.touched) {
      <p id="pw-error">Passwords do not match.</p>
    }
  </fieldset>

  <fieldset formArrayName="phones">
    <legend>Phones</legend>
    @for (row of form.controls.phones.controls; track row.controls.id.value; let i = $index) {
      <div [formGroupName]="i">
        <input formControlName="number" [attr.aria-label]="'Phone ' + (i + 1)" />
        <button type="button" (click)="removePhone(i)">Remove phone {{ i + 1 }}</button>
      </div>
    }
    <button type="button" (click)="addPhone()">Add phone</button>
  </fieldset>

  <button type="submit">Create account</button>
</form>
```

### Server error mapping

```ts
// src/app/shared/forms/server-errors.ts
import { AbstractControl, FormGroup } from '@angular/forms';

/** Expects `{ errors: { "passwords.password": ["Too weak"] } }` — adapt to the real API contract. */
export interface ServerValidationBody { errors?: Record<string, string[]> }

export function applyServerErrors(form: FormGroup, body: ServerValidationBody): string[] {
  const unmatched: string[] = [];
  for (const [path, messages] of Object.entries(body.errors ?? {})) {
    const control: AbstractControl | null = form.get(path);
    if (control) {
      control.setErrors({ ...control.errors, server: messages[0] });
      control.markAsTouched();
    } else {
      unmatched.push(...messages); // show in a form-level summary
    }
  }
  return unmatched;
}
```

### Unified control events (v18+)

```ts
// src/app/features/signup/signup-form.component.ts (excerpt)
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormSubmittedEvent, TouchedChangeEvent } from '@angular/forms';

constructor() {
  this.form.events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((e) => {
    if (e instanceof FormSubmittedEvent) this.submitted.set(true);
    if (e instanceof TouchedChangeEvent && e.touched) { /* e.g. analytics */ }
  });
}
```

`FormSubmittedEvent` fires only when the form is bound with `[formGroup]` and submitted through the DOM. A child's `ValueChangeEvent` arrives before the parent value updates; subscribe to the parent's `events` when the parent value is needed.

More examples — reusable `ControlValueAccessor`, error component, and config-driven forms — are in [references/cva-and-dynamic-forms.md](references/cva-and-dynamic-forms.md).

### Signal Forms (opt-in only)

Available from `@angular/forms/signals` on v21+ (experimental there [VERIFY]; `form()` marked stable since v22.0 in the API reference). Use only if the project already uses it or the team explicitly chooses it for new code:

```ts
// src/app/features/login/login.component.ts — Angular 22, project opted into Signal Forms
import { Component, signal } from '@angular/core';
import { FormField, email, form, required } from '@angular/forms/signals';

@Component({
  selector: 'app-login',
  imports: [FormField],
  template: `<input type="email" [formField]="loginForm.email" />`,
})
export class LoginComponent {
  private readonly model = signal({ email: '', password: '' });
  protected readonly loginForm = form(this.model, (p) => {
    required(p.email, { message: 'Email is required' });
    email(p.email);
  });
}
```

The directive name and binding differed in the v21 experimental release [VERIFY]; check installed typings. Do not mix Signal Forms and reactive forms inside the same form.

## Validation Checklist

- [ ] Detected Angular version, standalone/NgModule, zoneless, control-flow syntax before writing code.
- [ ] No `any`, `UntypedFormGroup`, or `as` casts on form values.
- [ ] Payload built from `getRawValue()` or `value` deliberately, with disabled fields considered.
- [ ] Sync validators pure; async validators debounce, complete, and swallow transport errors.
- [ ] Cross-field error rendered and announced next to the relevant field.
- [ ] Server 4xx field errors land on controls; unmatched ones shown in a summary.
- [ ] Every input has a label; errors linked via `aria-describedby`; `aria-invalid` set.
- [ ] Invalid submit marks all touched and moves focus to first invalid field.
- [ ] `FormArray` rows tracked by stable ID; add/remove buttons have accessible names.
- [ ] Subscriptions use `takeUntilDestroyed` or `toSignal`.
- [ ] Type-check and tests pass.

## References

- [ControlValueAccessor, error component, config-driven forms](references/cva-and-dynamic-forms.md)
- https://angular.dev/guide/forms/typed-forms
- https://angular.dev/guide/forms/reactive-forms
- https://angular.dev/guide/forms/form-validation
- https://angular.dev/guide/forms/signals/overview
