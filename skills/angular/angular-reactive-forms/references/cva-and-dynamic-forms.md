# ControlValueAccessor, error display, and config-driven forms

Examples target Angular 17+ standalone. For NgModule projects, declare the component in the owning module and keep the same class body.

## Reusable ControlValueAccessor: quantity stepper

```ts
// src/app/shared/forms/quantity-input.component.ts
import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-quantity-input',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => QuantityInputComponent), multi: true }],
  template: `
    <div role="group" [attr.aria-labelledby]="labelId()">
      <button type="button" (click)="step(-1)" [disabled]="disabled() || value() <= min()"
              aria-label="Decrease">-</button>
      <input type="number" inputmode="numeric" [id]="inputId()"
             [value]="value()" [disabled]="disabled()"
             (input)="onInput($event)" (blur)="onTouched()" />
      <button type="button" (click)="step(1)" [disabled]="disabled() || value() >= max()"
              aria-label="Increase">+</button>
    </div>
  `,
})
export class QuantityInputComponent implements ControlValueAccessor {
  readonly min = input(0);
  readonly max = input(999);
  readonly inputId = input.required<string>();
  readonly labelId = input.required<string>();

  protected readonly value = signal(0);
  protected readonly disabled = signal(false);

  private onChange: (v: number) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: number | null): void {
    this.value.set(v ?? 0); // never call onChange here
  }
  registerOnChange(fn: (v: number) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }

  protected step(delta: number): void {
    this.update(this.value() + delta);
    this.onTouched();
  }
  protected onInput(event: Event): void {
    this.update(Number((event.target as HTMLInputElement).value));
  }
  private update(raw: number): void {
    const clamped = Math.min(this.max(), Math.max(this.min(), Number.isFinite(raw) ? raw : 0));
    this.value.set(clamped);
    this.onChange(clamped);
  }
}
```

Signals keep the view in sync under `OnPush` (v22 default) and zoneless. Usage:

```html
<span id="qty-label">Quantity</span>
<app-quantity-input formControlName="quantity" inputId="qty" labelId="qty-label" [max]="10" />
```

If the custom control needs to show its own validation state, inject `NgControl` with `{ self: true, optional: true }` and set `ngControl.valueAccessor = this` instead of providing `NG_VALUE_ACCESSOR` (providing both causes a circular dependency).

## Field error component

```ts
// src/app/shared/forms/field-error.component.ts
import { Component, DestroyRef, computed, inject, input, signal, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { merge } from 'rxjs';

const MESSAGES: Record<string, (arg: unknown) => string> = {
  required: () => 'This field is required.',
  email: () => 'Enter a valid email address.',
  minlength: (a) => `Use at least ${(a as { requiredLength: number }).requiredLength} characters.`,
  minAge: (a) => `You must be at least ${(a as { required: number }).required}.`,
  emailTaken: () => 'This email is already registered.',
  server: (a) => String(a),
};

@Component({
  selector: 'app-field-error',
  host: { '[attr.id]': 'id()' },
  template: `@if (message(); as m) { <p class="field-error">{{ m }}</p> }`,
})
export class FieldErrorComponent {
  readonly control = input.required<AbstractControl>();
  readonly submitted = input(false);
  readonly id = input.required<string>();

  private readonly tick = signal(0);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Re-evaluate when control status/touched changes; required under OnPush + zoneless.
    effect((onCleanup) => {
      const sub = this.control().events.subscribe(() => this.tick.update((n) => n + 1));
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected readonly message = computed(() => {
    this.tick();
    const c = this.control();
    if (!c.errors || !(c.touched || this.submitted())) return null;
    const [key, arg] = Object.entries(c.errors)[0];
    return (MESSAGES[key] ?? (() => 'Invalid value.'))(arg);
  });
}
```

`control.events` needs Angular 18+ [VERIFY]. On 17, replace the effect body with `merge(c.statusChanges, c.valueChanges)` and track touched via the submit/blur handlers. The `merge`, `DestroyRef`, and `takeUntilDestroyed` imports are only needed for that fallback; remove them on 18+ to satisfy lint.

Place this component directly after the input; the input's `aria-describedby` points at its `id`.

## Config-driven form

```ts
// src/app/features/survey/form-config.ts
import { ValidatorFn, Validators } from '@angular/forms';

export type FieldConfig =
  | { kind: 'text'; key: string; label: string; validators?: ValidatorName[] }
  | { kind: 'number'; key: string; label: string; min?: number; max?: number; validators?: ValidatorName[] }
  | { kind: 'select'; key: string; label: string; options: { value: string; label: string }[]; validators?: ValidatorName[] };

export type ValidatorName = 'required' | 'email';

// Whitelist: config can only reference known validators.
export const VALIDATORS: Record<ValidatorName, ValidatorFn> = {
  required: Validators.required,
  email: Validators.email,
};
```

```ts
// src/app/features/survey/dynamic-form.component.ts
import { Component, computed, inject, input } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FieldConfig, VALIDATORS } from './form-config';

@Component({
  selector: 'app-dynamic-form',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form()">
      @for (field of fields(); track field.key) {
        <label [for]="field.key">{{ field.label }}</label>
        @switch (field.kind) {
          @case ('select') {
            <select [id]="field.key" [formControlName]="field.key">
              @for (o of field.options; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
          }
          @case ('number') {
            <input type="number" [id]="field.key" [formControlName]="field.key" />
          }
          @default {
            <input type="text" [id]="field.key" [formControlName]="field.key" />
          }
        }
      }
    </form>
  `,
})
export class DynamicFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  readonly fields = input.required<FieldConfig[]>();

  // Rebuilt only when the config reference changes, not on every change detection.
  readonly form = computed(() => {
    const controls: Record<string, FormControl<string | number>> = {};
    for (const f of this.fields()) {
      const validators = (f.validators ?? []).map((v) => VALIDATORS[v]);
      if (f.kind === 'number') {
        if (f.min !== undefined) validators.push(Validators.min(f.min));
        if (f.max !== undefined) validators.push(Validators.max(f.max));
      }
      controls[f.key] = this.fb.control<string | number>(f.kind === 'number' ? 0 : '', validators);
    }
    return new FormGroup(controls);
  });
}
```

Dynamic forms trade compile-time field typing for flexibility: the value type is `Record<string, string | number>`. Validate the config shape at the trust boundary (e.g. with the project's schema library) if it comes from an API.
