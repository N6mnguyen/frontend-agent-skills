# Controlled Inputs, Field Arrays, Async Validation

## antd inputs through Controller

antd `Select`, `DatePicker`, `InputNumber`, `Switch` are controlled: they call `onChange(value)` not `onChange(event)`. Wrap once, reuse everywhere.

```tsx
// src/components/form/rhf-select.tsx
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Select, type SelectProps } from 'antd';
import { useId } from 'react';

interface RhfSelectProps<T extends FieldValues> extends Omit<SelectProps, 'value' | 'onChange' | 'onBlur'> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
}

export function RhfSelect<T extends FieldValues>({ control, name, label, ...selectProps }: RhfSelectProps<T>) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div>
          <label htmlFor={id}>{label}</label>
          <Select
            {...selectProps}
            id={id}
            ref={field.ref}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={field.disabled ?? selectProps.disabled}
            status={fieldState.error ? 'error' : undefined}
            aria-invalid={fieldState.error ? true : undefined}
            aria-describedby={fieldState.error ? `${id}-error` : undefined}
          />
          {fieldState.error && <p id={`${id}-error`}>{fieldState.error.message}</p>}
        </div>
      )}
    />
  );
}
```

Notes:
- `Control<T>` with a form declared as `useForm<Input, unknown, Output>` is `Control<Input, unknown, Output>`. If TypeScript complains, add the extra generics to `RhfSelectProps` (exact `Control` generic arity on installed RHF 7.x [VERIFY]).
- `Select` forwards a ref exposing `focus()`, so RHF can focus it on error.
- antd `DatePicker` values are `Dayjs`. Keep `Dayjs | null` in the form and convert to ISO string in the schema: `z.custom<Dayjs>((v) => dayjs.isDayjs(v)).transform((d) => d.toISOString())`. Use `null`, not `undefined`, for empty.
- `Switch`/`Checkbox`: map `checked` ↔ `field.value`.
- In antd v6, `bordered` is deprecated in favour of `variant`; `dropdownRender` → `popupRender`.

## Field arrays

```tsx
// src/features/invoices/line-items.tsx
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { InvoiceInput } from './invoice-schema';

export function LineItems() {
  const { control, register, formState: { errors } } = useFormContext<InvoiceInput>();
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  return (
    <fieldset>
      <legend>Line items</legend>
      {errors.items?.root && <p role="alert">{errors.items.root.message}</p>}
      {fields.map((field, index) => (
        <div key={field.id}>
          <label htmlFor={`items.${index}.description`}>Description</label>
          <input id={`items.${index}.description`} {...register(`items.${index}.description` as const)} />
          <label htmlFor={`items.${index}.qty`}>Quantity</label>
          <input id={`items.${index}.qty`} type="number" {...register(`items.${index}.qty` as const)} />
          <button type="button" onClick={() => remove(index)} aria-label={`Remove item ${index + 1}`}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => append({ description: '', qty: 1 })}>Add item</button>
    </fieldset>
  );
}
```

```ts
// src/features/invoices/invoice-schema.ts
import { z } from 'zod';

export const invoiceSchema = z.object({
  items: z
    .array(z.object({ description: z.string().min(1, { error: 'Required' }), qty: z.coerce.number().int().min(1) }))
    .min(1, { error: 'Add at least one item' }),
});
export type InvoiceInput = z.input<typeof invoiceSchema>;
```

Rules: `key={field.id}`; `append` full objects; array-level Zod errors show at `errors.items.root` when the array is registered via `useFieldArray` (otherwise `errors.items.message`) [VERIFY]; do not call two array mutations in one handler; if records already have an `id`, use `keyName` (deprecated, removed in RHF v8) or rename the record field.

## Async validation (uniqueness)

Prefer server-side checks at submit (map to `setError`). If the UX needs it earlier, use Zod's async refine and `mode: 'onBlur'` so the request is not fired per keystroke:

```ts
// src/features/users/signup-schema.ts
import { z } from 'zod';
import { isUsernameTaken } from '@/api/users';

export const signupSchema = z.object({
  username: z
    .string()
    .min(3)
    .refine(async (u) => !(await isUsernameTaken(u)), { error: 'Username is taken' }),
});
```

Async refinements make `zodResolver` parse asynchronously (the resolver's default `mode` is `'async'`, i.e. `parseAsync` [VERIFY]). Debounce or cache `isUsernameTaken` if validation runs on change.

## Large forms

- Split sections into components using `useFormContext` under one `FormProvider`.
- Read watched values with `useWatch({ control, name })` in the leaf that needs them.
- `useFormState({ control, name })` in a sub-tree to subscribe to only those errors.
