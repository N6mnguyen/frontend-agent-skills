# Component Patterns: Longer Examples

Companion to the `react-components` skill. All examples compile under `strict: true`.

## Compound Tabs with private context

Follows the WAI-ARIA tabs pattern: `tablist` / `tab` / `tabpanel`, arrow keys move between tabs, only the selected tab is in the tab order.

```tsx
// src/shared/ui/Tabs.tsx
import {
  createContext,
  useContext,
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

type TabsContextValue = {
  baseId: string;
  selected: string;
  select: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${component}> must be rendered inside <Tabs>`);
  return ctx;
}

type TabsProps = {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
};

function TabsRoot({ defaultValue, value, onValueChange, children }: TabsProps) {
  const baseId = useId();
  const [internal, setInternal] = useState(defaultValue);
  const selected = value ?? internal;

  const select = (next: string) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };

  // React 18-compatible provider syntax; on React 19 `<TabsContext value={...}>` also works.
  return (
    <TabsContext.Provider value={{ baseId, selected, select }}>
      {children}
    </TabsContext.Provider>
  );
}

function TabList({ label, children }: { label: string; children: ReactNode }) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'),
    );
    const index = tabs.findIndex((tab) => tab === document.activeElement);
    if (index === -1) return;
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    next?.focus();
    next?.click(); // automatic activation; drop this line for manual activation
    event.preventDefault();
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

function Tab({ value, children, disabled }: { value: string; children: ReactNode; disabled?: boolean }) {
  const { baseId, selected, select } = useTabsContext('Tabs.Tab');
  const isSelected = selected === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={isSelected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      onClick={() => select(value)}
    >
      {children}
    </button>
  );
}

function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  const { baseId, selected } = useTabsContext('Tabs.Panel');
  if (selected !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

export const Tabs = Object.assign(TabsRoot, { List: TabList, Tab, Panel: TabPanel });
```

Usage:

```tsx
// src/features/orders/routes/OrderDetailRoute.tsx (excerpt)
import { Tabs } from '@/shared/ui/Tabs';

<Tabs defaultValue="items">
  <Tabs.List label="Order sections">
    <Tabs.Tab value="items">Items</Tabs.Tab>
    <Tabs.Tab value="history">History</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="items">{/* … */}</Tabs.Panel>
  <Tabs.Panel value="history">{/* … */}</Tabs.Panel>
</Tabs>;
```

Notes:

- If `value` is used as part of an `id`, keep values to simple tokens (no spaces).
- `Object.assign` keeps a single export with dot-access subcomponents. Separate named exports (`TabsList`, `TabsTab`) are equally valid and tree-shake identically; follow the project's existing convention. In Next.js, dot-access on a client component imported into a Server Component does not work across the `'use client'` boundary [VERIFY]; export subcomponents individually there.

## Optimistic list update with useOptimistic (React 19)

Use this when the component owns the mutation via Actions. If the project uses TanStack Query, prefer its optimistic patterns (see the `tanstack-query` skill) so the cache stays the single source of truth.

```tsx
// src/features/comments/components/CommentThread.tsx
import { useOptimistic } from 'react';

export type Comment = { id: string; body: string; pending?: boolean };

type Props = {
  comments: Comment[];
  addComment: (body: string) => Promise<void>; // persists, then parent refreshes `comments`
};

export function CommentThread({ comments, addComment }: Props) {
  const [optimisticComments, addOptimistic] = useOptimistic(
    comments,
    (current: Comment[], body: string): Comment[] => [
      ...current,
      { id: `optimistic-${current.length}`, body, pending: true },
    ],
  );

  async function submit(formData: FormData) {
    const body = String(formData.get('body') ?? '').trim();
    if (!body) return;
    addOptimistic(body); // allowed: we are inside a form Action
    await addComment(body); // on throw, optimistic item disappears; surface the error via an error boundary or state
  }

  return (
    <>
      <ul>
        {optimisticComments.map((c) => (
          <li key={c.id} aria-busy={c.pending ?? false}>
            {c.body}
            {c.pending && <span> (sending…)</span>}
          </li>
        ))}
      </ul>
      <form action={submit}>
        <label htmlFor="comment-body">Add comment</label>
        <textarea id="comment-body" name="body" required />
        <button type="submit">Post</button>
      </form>
    </>
  );
}
```

Caveats:

- The optimistic setter must be called inside an Action or `startTransition`; otherwise React logs an error.
- The optimistic state reverts to `comments` when the Action settles, so the parent must provide updated `comments` after success (router revalidation, query invalidation, or a state update wrapped in `startTransition`).
- Errors thrown from a form Action propagate to the nearest error boundary. Catch them inside `submit` and store a message if the form should show an inline error instead.

## React 18 equivalent of a form Action

```tsx
// src/features/profile/components/DisplayNameForm.react18.tsx
import { useState, type FormEvent } from 'react';

export function DisplayNameForm({ save }: { save: (name: string) => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name') ?? '').trim();
    if (name.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await save(name);
      form.reset();
    } catch {
      setError('Could not save name. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} aria-busy={pending} noValidate>
      <label htmlFor="display-name">Display name</label>
      <input
        id="display-name"
        name="name"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'display-name-error' : undefined}
      />
      {error && <p id="display-name-error" role="alert">{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
```

For forms with many fields or complex validation, use the project's form library (see the `react-forms` skill) rather than growing this pattern.
