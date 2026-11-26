---
name: react-forms
description: Typed React forms with React Hook Form 7, Zod 4 and @hookform/resolvers - schema-driven validation, z.input vs z.output types, Controller for antd and other controlled inputs, field arrays, server errors via setError, reusable field components, submit and dirty state, reset with server data, accessible error messages, and React 19 form actions for simple cases. Use when building or refactoring a form, adding validation, mapping API validation errors to fields, wiring antd/MUI inputs to react-hook-form, or choosing between RHF and useActionState.
license: MIT
metadata:
  category: react
  version: "1.0.0"
  frameworks: "react-hook-form 7, zod 4, @hookform/resolvers 5-7, react 19"
  last-reviewed: "2026-11-25"
---

# React Forms

## Purpose

Forms where one Zod schema is the single source of validation and types, React Hook Form owns field state, server errors land on the right field, and every error is announced to assistive tech. The result should type-check under `strict`, submit only parsed output, and never lose user input on a failed request.

## When to Use

- New form or adding fields/validation to an existing one.
- Edit forms that load server data.
- Mapping 400/422 API responses to fields.
- Wrapping antd, MUI, date pickers or other controlled components.
- Dynamic lists (line items, contacts).

Do not use when: the project standardises on antd `Form` (see `ant-design-react` skill) or Formik — follow the project. Data fetching/mutation caching is in `tanstack-query`.

## Workflow

1. **Detect.** Check `package.json` for `react-hook-form`, `zod`, `@hookform/resolvers`, `antd`, `formik`, `react` versions. Search for an existing `FormField`/`TextField` wrapper and an API error shape helper. Reuse them.
2. **Decide.**
   - Project uses antd `Form` everywhere → stay with antd `Form`. Do not mix in one screen.
   - Zod 4 requires `@hookform/resolvers` >= 5.1.0. On Zod 3 keep the project's pattern; Zod 4 is also importable as `zod/v4` from `zod@3.25+` during migration.
   - One or two fields, no client validation, server-rendered or progressive enhancement (React 19, framework actions) → `<form action>` + `useActionState` is enough.
   - Anything with dynamic fields, cross-field rules, dirty tracking or controlled widgets → RHF.
3. **Implement.** Schema file next to the form (or in a `schemas/` folder if that exists). Infer types from the schema; never hand-write a parallel interface.
4. **Verify.** `tsc --noEmit`, lint, tests with Testing Library (`react-testing` skill): submit empty → errors shown and focused; valid submit → payload equals parsed output; server 422 → message on the field.

## Best Practices

- **Schema first.** `const schema = z.object({...})`; types via `z.input<typeof schema>` (what the inputs hold) and `z.output<typeof schema>` (what `onSubmit` receives). They differ whenever you use `.default()`, `.transform()`, `z.coerce`, or `.pipe()`.
- **Let the resolver infer generics** (`useForm({ resolver: zodResolver(schema) })`). When you must annotate, use all three: `useForm<FormInput, unknown, FormOutput>`. A single generic breaks with transforms/defaults.
- **Zod 4 syntax:** top-level formats `z.email()`, `z.url()`, `z.uuid()`; custom messages via `{ error: '...' }` (`message` still works but is legacy); `.flatten()`/`.format()` are deprecated in favour of `z.treeifyError()` / `z.flattenError()`; `z.prettifyError()` for logs.
- **Always set `defaultValues`** for every field, using `''` not `undefined` for text inputs, to avoid uncontrolled→controlled warnings and to make `isDirty` meaningful.
- **Numbers from native inputs:** `register('age', { valueAsNumber: true })` with `z.number()`, or `z.coerce.number()` (input type becomes `unknown`).
- **Controller for controlled components** (antd `Select`, `DatePicker`, `InputNumber`, `Switch`, `Upload`). Pass `field.ref` where the component forwards it so focus-on-error works. Never `register` and `Controller` the same field.
- **Map server errors with `setError`.** Field errors → `setError('email', { type: 'server', message })`; non-field errors → `setError('root.server', { message })`. `root.*` clears on next submit.
- **Submit state from RHF:** `formState.isSubmitting` when `onSubmit` returns a promise; disable the button, but keep fields editable unless the domain requires otherwise.
- **Dirty tracking:** read `isDirty` / `dirtyFields` from `formState` (subscription is lazy — destructure them during render). Send only dirty fields for PATCH when the API supports it.
- **Server data:** prefer `useForm({ values: data })` (updates when `data` changes) or `reset(data)` after load. Use `resetOptions: { keepDirtyValues: true }` when a background refetch must not overwrite edits. Reset after success in an effect on `isSubmitSuccessful`, not inside `onSubmit`.
- **Field arrays:** `key={field.id}`; `append` full objects; array-level errors at `errors.items?.root`; entries must be objects, not primitives.
- **Accessibility:** visible `<label htmlFor>`; `aria-invalid` on invalid inputs; error text in an element referenced by `aria-describedby`; a `role="alert"` summary for `root` errors. RHF focuses the first invalid field by default (`shouldFocusError: true`) — keep it.
- **Validation mode:** default `onSubmit` then `reValidateMode: 'onChange'` is the least noisy. Use `mode: 'onTouched'` for long forms. Avoid `onChange` from first keystroke.

## Anti-patterns

- Writing `interface UserForm` by hand next to a schema — types drift. Infer.
- `useForm<z.infer<typeof schema>>` with transforms — `onSubmit` receives the wrong type. Use input/output generics or none.
- `useState` per field plus RHF — two sources of truth.
- `useEffect(() => reset(data), [data])` with a fresh object each render — infinite resets. Use `values` or depend on a stable query result.
- Calling `reset()` inside `onSubmit` — submission state is updated after your handler and fights the reset.
- `key={index}` in field arrays — inputs swap values on remove.
- Showing errors only by red border — invisible to screen readers and colour-blind users.
- Swallowing API 422 into a toast — user cannot tell which field is wrong.
- Using `watch()` at the top of a large form — re-renders the whole form on every keystroke. Use `useWatch({ name })` in the child that needs it.

## Implementation Examples

### Schema + typed form

```ts
// src/features/users/user-schema.ts
import { z } from 'zod';

export const userSchema = z.object({
  name: z.string().trim().min(1, { error: 'Name is required' }),
  email: z.email({ error: 'Enter a valid email' }),
  age: z.coerce.number().int().min(18, { error: 'Must be 18 or older' }),
  role: z.enum(['admin', 'editor', 'viewer']),
  newsletter: z.boolean().default(false),
});

export type UserFormInput = z.input<typeof userSchema>;
export type UserFormOutput = z.output<typeof userSchema>;
```

```tsx
// src/features/users/user-form.tsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userSchema, type UserFormInput, type UserFormOutput } from './user-schema';
import { TextField } from '@/components/form/text-field';
import { applyServerErrors } from '@/lib/apply-server-errors';

interface Props {
  initial?: UserFormOutput;
  onSave: (values: UserFormOutput) => Promise<void>;
}

const empty: UserFormInput = { name: '', email: '', age: '', role: 'viewer', newsletter: false };

export function UserForm({ initial, onSave }: Props) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    getValues,
    formState: { errors, isSubmitting, isDirty, isSubmitSuccessful },
  } = useForm<UserFormInput, unknown, UserFormOutput>({
    resolver: zodResolver(userSchema),
    defaultValues: empty,
    values: initial, // re-syncs when the loaded record changes
    resetOptions: { keepDirtyValues: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onSave(values);
    } catch (err) {
      applyServerErrors(err, setError);
    }
  });

  useEffect(() => {
    // Saved values become the new clean baseline, so isDirty is false again.
    if (isSubmitSuccessful) reset(getValues());
  }, [isSubmitSuccessful, reset, getValues]);

  return (
    <form onSubmit={onSubmit} noValidate>
      {errors.root?.server && <p role="alert">{errors.root.server.message}</p>}
      <TextField label="Name" error={errors.name?.message} {...register('name')} />
      <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
      <TextField label="Age" type="number" inputMode="numeric" error={errors.age?.message} {...register('age')} />
      <button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
```

`age` input type is `unknown` because of `z.coerce`; the output is `number`. `isSubmitSuccessful` is false when the handler throws or leaves errors set (the `setError` calls in the catch block), so the reset only runs after a real save (errors set inside the handler marking the submit unsuccessful [VERIFY] on the installed RHF 7.x; if not, rethrow after `setError`).

### Reusable accessible field

```tsx
// src/components/form/text-field.tsx
import { forwardRef, useId, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, ...inputProps },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div>
      <label htmlFor={inputId}>{label}</label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...inputProps}
      />
      {hint && <p id={hintId}>{hint}</p>}
      {error && <p id={errorId}>{error}</p>}
    </div>
  );
});
```

React 19 passes `ref` as a regular prop, so `forwardRef` is optional there; keep it if the project supports React 18.

### Server errors → fields

```ts
// src/lib/apply-server-errors.ts
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

interface ApiValidationError {
  status: 400 | 422;
  errors: Array<{ field?: string; message: string }>;
}

function isApiValidationError(e: unknown): e is ApiValidationError {
  return typeof e === 'object' && e !== null && 'errors' in e && Array.isArray((e as ApiValidationError).errors);
}

export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>) {
  if (!isApiValidationError(err)) {
    setError('root.server', { type: 'server', message: 'Could not save. Try again.' });
    return;
  }
  let focused = false;
  for (const { field, message } of err.errors) {
    if (field) {
      setError(field as Path<T>, { type: 'server', message }, { shouldFocus: !focused });
      focused = true;
    } else {
      setError('root.server', { type: 'server', message });
    }
  }
}
```

Adapt `ApiValidationError` to the backend's real shape (RFC 9457 problem details, ASP.NET `ValidationProblemDetails`, etc.). Unknown field names from the server must map to existing form paths.

### Controller with antd, field arrays, async validation

See [references/controlled-and-arrays.md](references/controlled-and-arrays.md).

### React 19 action form (simple case)

```tsx
// src/features/newsletter/subscribe-form.tsx
import { useActionState } from 'react';
import { z } from 'zod';

const schema = z.object({ email: z.email({ error: 'Enter a valid email' }) });
type State = { ok: boolean; error?: string };

async function subscribe(_prev: State, formData: FormData): Promise<State> {
  const parsed = schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const res = await fetch('/api/subscribe', { method: 'POST', body: JSON.stringify(parsed.data), headers: { 'Content-Type': 'application/json' } });
  return res.ok ? { ok: true } : { ok: false, error: 'Subscription failed' };
}

export function SubscribeForm() {
  const [state, formAction, isPending] = useActionState(subscribe, { ok: false });
  return (
    <form action={formAction}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'email-error' : undefined} />
      {state.error && <p id="email-error" role="alert">{state.error}</p>}
      <button type="submit" disabled={isPending}>Subscribe</button>
      {state.ok && <p role="status">Subscribed.</p>}
    </form>
  );
}
```

React 19 resets uncontrolled fields after a successful action; for forms that must keep values on error, return them in state or use RHF.

## Validation Checklist

- [ ] One schema per form; types inferred via `z.input` / `z.output`.
- [ ] `@hookform/resolvers` >= 5.1 when using Zod 4.
- [ ] `defaultValues` covers every field with non-`undefined` values.
- [ ] Controlled widgets use `Controller` with `field.ref` forwarded where possible.
- [ ] API validation errors map to fields via `setError`; generic failures to `root.server`.
- [ ] Submit button reflects `isSubmitting`; double submit impossible.
- [ ] Edit forms load via `values` or `reset`, and unsaved edits survive refetch.
- [ ] Field arrays keyed by `field.id`.
- [ ] Every input has a label; errors linked by `aria-describedby`; `aria-invalid` set; root errors use `role="alert"`.
- [ ] Tests cover empty submit, valid submit payload, and server error mapping.

## References

- [references/controlled-and-arrays.md](references/controlled-and-arrays.md) — antd Controller wrappers, `useFieldArray`, async uniqueness checks, `FormProvider`.
- https://react-hook-form.com/docs/useform
- https://github.com/react-hook-form/resolvers
- https://zod.dev/v4/changelog
- https://react.dev/reference/react/useActionState
