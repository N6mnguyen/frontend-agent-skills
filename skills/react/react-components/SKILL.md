---
name: react-components
description: Designs reusable React components through composition, explicit prop contracts, controlled state and accessible interaction patterns, accounting for React 18 and React 19 APIs. Use when creating or refactoring a component, designing children/slot/compound APIs, deciding controlled versus uncontrolled behavior, fixing keys or prop drilling, implementing modals, drawers, forms, or loading/empty/error states, or adopting React 19 Actions and ref props.
license: MIT
metadata:
  category: react
  version: "1.0.0"
  frameworks: "react 18-19, typescript 5+"
  last-reviewed: "2026-11-25"
---

# React Components

## Purpose

Build components with small, explicit APIs that compose naturally, preserve semantic HTML and can be controlled by the parent when necessary. Prefer a well-shaped component over a generalized framework: expose only the decisions consumers need to make.

## When to Use

- Creating a reusable or feature-level React component.
- Choosing `children`, named slots, compound components or a flat prop API.
- Handling controlled and uncontrolled state, list keys or state ownership.
- Implementing modal/drawer behavior and accessible pending/error states.
- Updating components for React 19 (`ref` as prop, Actions, `useActionState`, `useOptimistic`, form actions).

Do not use when: the main task is hook semantics (see `react-hooks`), TypeScript type design (see `typescript-react`), or routing/layout architecture (see `react-architecture`).

## Workflow

1. **Detect.** Read React and `@types/react` versions; read adjacent components, design-system conventions and tests. Check whether React 19 is in use and whether the component is rendered in a Next.js Server Component tree.
2. **Decide ownership.** List state and who needs to read/change it. Keep ephemeral state local; expose `value`/`onChange` only if the caller must control or observe it. Lift shared state to the nearest common owner.
3. **Choose the smallest API.** Use `children` for nested content, named ReactNode props for genuine slots, compound components for coordinated multi-part UI, and ordinary props for simple variation.
4. **Implement semantic HTML and states.** Preserve native element behavior and types; define loading, empty, error and disabled behavior when relevant. For overlays, meet the modal/drawer checklist below.
5. **Verify.** Type-check and run focused tests. Test controlled behavior, keyboard interaction, empty/error/pending states and stable list identity. Use the project's existing test/render conventions.

## Best Practices

### Composition

- **`children`** represents natural nesting: `<Card><Card.Header>…</Card.Header><Card.Body>…</Card.Body></Card>`.
- **Named slots** (`header`, `footer`, `actions`) are useful when there are a few fixed locations. Type each as `ReactNode`; do not add slots a caller does not need.
- **Compound components** suit related pieces that share state or semantics (`Tabs`, `Tabs.List`, `Tabs.Trigger`, `Tabs.Panel`). Keep their context private and document required parent/child relationships.
- Use render props only when callers genuinely need a value to customize rendering. A normal callback prop is often clearer for events.
- Avoid boolean-prop explosion (`isCompact`, `isLarge`, `isBlue`, `isSpecial`). Prefer a constrained `variant`/`size` union or composition. Do not turn every option into a generic slot.

### Props and state ownership

- Define the controlled contract consistently: `value` + `onValueChange` (or `checked` + `onCheckedChange`). Never silently maintain a second competing value when `value` is supplied.
- For an uncontrolled mode, provide `defaultValue`; initialize local state once. Changing `defaultValue` later should not reset the component unless documented.
- Make controlled and uncontrolled APIs mutually exclusive with a discriminated union if misuse would be ambiguous. Avoid switching between controlled and uncontrolled modes over the component lifetime.
- Lift state only to the nearest common owner that needs it. Before global state, use component composition (pass a child element/slot) or context for a stable subtree.
- Keep state transitions next to the interaction that caused them. A child should call `onOpenChange(false)` when its close button or Escape key closes it.

### Lists and keys

- Use stable IDs from the data as keys: `items.map(item => <Row key={item.id} item={item} />)`.
- Keys identify component state across insertion, sorting and deletion. Array indexes are safe only for static lists that never reorder or change length.
- Never generate keys during render (`Math.random()`, `crypto.randomUUID()`); it remounts children on every render.
- A `key` is React metadata, not a component prop. Pass `itemId={item.id}` explicitly if the child needs it.

### Loading, empty and error states

- Make the state visible and specific: loading indicator with an accessible label; empty state with next action or explanation; error state with a retry path where retry is safe.
- Do not render both a spinner and stale data as if the data vanished; preserve prior content when that matches the product behavior, and announce updates appropriately.
- Use `aria-busy="true"` on a region during an operation when it helps assistive technology; do not disable unrelated navigation.
- For submit actions, prevent duplicate submission while pending. Keep error text near the affected control and connect it with `aria-describedby`.

### Modal and drawer patterns

- Prefer the platform `<dialog>` with `showModal()` for a true modal when supported by the project's browser targets; otherwise use the existing accessible dialog primitive (Radix, React Aria, etc.). A custom overlay needs focus trapping, initial focus, Escape handling, focus restoration, an accessible name, and background inertness.
- Use `role="dialog"` and `aria-modal="true"` only when implementing the full modal interaction contract. A side panel that does not block the rest of the app is a non-modal dialog/drawer, not `aria-modal="true"`.
- Close on Escape; do not close on backdrop click if it would discard user input without warning. For destructive/unsaved work, confirm or preserve a draft.
- Set `aria-labelledby` to a visible title (or `aria-label` when no visible title is appropriate). Put focus inside on open and restore it to the invoking control on close.
- Render overlays through the established portal/overlay primitive to avoid clipping and stacking-context bugs. Do not hand-roll a focus trap if the UI library already provides one.
- Native `<dialog>` has native focus and Escape behavior when opened modally with `showModal()`, but still provide a labelled title and test browser support/closing semantics.

### React 19 and React 18 differences

**React 19 additions (use only if `react` is 19+):**

- Function components can receive `ref` as a regular prop. `forwardRef` remains valid in React 19 but is no longer needed for new function components; React says it may be deprecated/removed in a future version. Keep `forwardRef` in code that must support React 18.
- `useActionState` is imported from `react`; it returns `[state, dispatchAction, isPending]`. The action receives `(previousState, payload)`. Dispatch must run in an Action/Transition; `<form action={dispatchAction}>` handles that.
- `useOptimistic` is imported from `react`; call its setter inside an Action or `startTransition`. Optimistic values revert to the supplied base state after the Action settles.
- `<form action={asyncFn}>`, and `formAction` on submit buttons/inputs, accept functions. Uncontrolled form fields reset after a successful action.
- `use()` can read a Promise or Context during render and can be called conditionally; do not create uncached Promises during Client Component render. Promise must come from a framework or Suspense-compatible cache.
- `<Context value={...}>` is supported as the provider; React 18 uses `<Context.Provider value={...}>`. Use `.Provider` when supporting both majors.

**React 18 equivalents:**

- Use `forwardRef` to expose a ref from function components.
- Use `useState`/`useReducer` plus an async submit handler and `useTransition` for pending state; the form's `action` prop expects a URL/string, not a function.
- Use the project's existing optimistic update approach (usually mutation state/cache); React 18 has no `useOptimistic`.

### Next.js boundary

- Server Components cannot use client event handlers, state or browser APIs. Keep interactive controls as small Client Components (`'use client'`) and pass serializable props; Server Functions may cross the boundary.
- Do not add `'use client'` merely to use `children`; Server Components can pass their rendered output as children to a client component.

## Anti-patterns

- **One component per DOM tag** — indirection without behavior — compose at the feature level and wrap a native element only to add a real design-system contract.
- **Every component controlled** — forces callers to own irrelevant state — support uncontrolled defaults when caller control is not needed.
- **Controlled and internal value both updating independently** — conflicting sources of truth — supplied `value` is authoritative; notify through callback.
- **Array index/random key for mutable lists** — wrong child state follows an item — use stable domain IDs.
- **Passing props through five layers only to reach one leaf** — noisy APIs — compose children/slots or use scoped context.
- **Context for every value** — broad subscriptions and hidden dependencies — keep local state local; context only for a shared subtree.
- **`<div onClick>` for a button** — missing keyboard and native semantics — use `<button type="button">`.
- **Custom modal with no focus management** — traps keyboard users outside the workflow or loses focus — use native dialog or an established accessible primitive.
- **Function-valued React 19 form action in React 18** — incompatible runtime — use the React 18 submit-handler path.
- **Creating `lazy()` components inside render** — component identity resets — declare once at module scope.

## Implementation Examples

### Controlled-or-uncontrolled disclosure

```tsx
// src/shared/ui/Disclosure.tsx
import { useState, type ReactNode } from 'react';

type Controlled = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultOpen?: never;
};
type Uncontrolled = {
  open?: undefined;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
};
type DisclosureProps = (Controlled | Uncontrolled) & {
  title: string;
  children: ReactNode;
};

export function Disclosure(props: DisclosureProps) {
  const [internalOpen, setInternalOpen] = useState(props.defaultOpen ?? false);
  const controlled = props.open !== undefined;
  const open = controlled ? props.open : internalOpen;

  function setOpen(next: boolean) {
    if (!controlled) setInternalOpen(next);
    props.onOpenChange?.(next);
  }

  return (
    <section>
      <h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {props.title}
        </button>
      </h2>
      {open && <div>{props.children}</div>}
    </section>
  );
}
```

### React 19 ref prop vs React 18-compatible forwardRef

```tsx
// src/shared/ui/TextInput.tsx — React 19+; for React 18 use the alternate below.
import type { ComponentPropsWithRef } from 'react';

type TextInputProps = Omit<ComponentPropsWithRef<'input'>, 'size'> & {
  size?: 'sm' | 'md' | 'lg';
};

export function TextInput({ size = 'md', ref, ...props }: TextInputProps) {
  return <input {...props} ref={ref} data-size={size} />;
}
```

```tsx
// src/shared/ui/TextInput.tsx — compatible with React 18 and 19.
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

type TextInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'size'> & {
  size?: 'sm' | 'md' | 'lg';
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ size = 'md', ...props }, ref) {
    return <input {...props} ref={ref} data-size={size} />;
  },
);
```

### React 19 form Action with pending/error state

```tsx
// src/features/profile/components/DisplayNameForm.tsx
import { useActionState } from 'react';

type State = { error: string | null };

async function updateName(_previous: State, formData: FormData): Promise<State> {
  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 2) return { error: 'Name must be at least 2 characters.' };
  const response = await fetch('/api/profile/name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) return { error: 'Could not save name. Try again.' };
  return { error: null };
}

export function DisplayNameForm() {
  const [state, formAction, pending] = useActionState(updateName, { error: null });
  return (
    <form action={formAction} aria-busy={pending}>
      <label htmlFor="display-name">Display name</label>
      <input id="display-name" name="name" required minLength={2} />
      {state.error && <p role="alert">{state.error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
```

React 18 version: use `onSubmit`, call `event.preventDefault()`, read `new FormData(event.currentTarget)`, set pending/error with local state, and clear pending in `finally`.

### Modal via native dialog

```tsx
// src/shared/ui/ConfirmDialog.tsx
import { useEffect, useId, useRef, type ReactNode } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({ open, title, children, onConfirm, onClose }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape key: let the parent decide (it may block close while saving).
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
      <button type="button" onClick={onClose}>Cancel</button>
      <button type="button" onClick={onConfirm}>Confirm</button>
    </dialog>
  );
}
```

The parent owns `open`; `onConfirm` must eventually set it to `false`. `showModal()` gives native focus containment, Escape handling and an inert background; focus returns to the previously focused element on close in current browsers [VERIFY]. Test the project's supported browsers.

### Compound components and optimistic updates

See [references/patterns.md](references/patterns.md) for a typed compound `Tabs` component (context + keyboard roving), a `useOptimistic` list example (React 19) and the React 18 submit-handler equivalent of a form Action.

## Validation Checklist

- [ ] Component has one clear responsibility and a small prop surface.
- [ ] State owner is explicit; controlled and uncontrolled behavior cannot conflict.
- [ ] Stable item keys used; no index keys for mutable/reorderable collections.
- [ ] Native elements and accessible names/labels used.
- [ ] Loading, empty, error and pending states are intentional where applicable.
- [ ] Modal/drawer includes keyboard, focus, name and close behavior; existing accessible primitive preferred.
- [ ] React 19-only APIs are not used in React 18 runtime; React 18 alternative supplied where needed.
- [ ] Types, tests and lint pass; interaction tests cover keyboard and state ownership.

## References

- https://react.dev/learn/passing-props-to-a-component
- https://react.dev/learn/you-might-not-need-an-effect
- https://react.dev/reference/react/useActionState
- https://react.dev/reference/react/useOptimistic
- https://react.dev/blog/2024/12/05/react-19
