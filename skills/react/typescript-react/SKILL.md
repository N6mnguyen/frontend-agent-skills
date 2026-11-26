---
name: typescript-react
description: Types React components, hooks, events, refs and API data under strict TypeScript without any or unsafe assertions. Use when writing or reviewing .tsx files, typing props, children, generic or polymorphic components, discriminated union props, event handlers, refs, context, reducers, API DTOs or zod schemas, or when fixing TypeScript errors in a React 18 or 19 project.
license: MIT
metadata:
  category: react
  version: "1.0.0"
  frameworks: "react 18-19, typescript 5-7, zod 3-4"
  last-reviewed: "2026-11-25"
---

# TypeScript for React

## Purpose

Make the type system describe what a component actually accepts and what data actually looks like at runtime. Good React types let invalid prop combinations fail to compile, keep native element props intact on wrappers, and stop untrusted API data at a validated boundary instead of spreading `any` through the app.

## When to Use

- Writing or reviewing `.tsx` components and custom hooks.
- Typing props, `children`, events, refs, context, reducers or generic components.
- Wrapping a native element or UI-library component and forwarding its props.
- Typing API responses, mapping DTOs to domain types, or inferring types from zod schemas.
- Fixing type errors after upgrading React types (18 → 19) or TypeScript.

Do not use when: the question is component API design rather than its types (see `react-components`), or form validation flow (see `react-forms`).

## Workflow

1. **Detect.**
   - `tsconfig.json` (and any `extends` base): `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `jsx` (`react-jsx` expected), `paths`.
   - Versions: `typescript`, `@types/react`, `@types/react-dom` (React 19 types changed `useRef`, `ReactElement` props, the global `JSX` namespace), `zod` (3 vs 4 APIs differ).
   - Existing conventions: `type` vs `interface` for props, `React.FC` usage, `import type`, where API types live.
2. **Decide.** Match existing conventions unless they are unsafe. Never loosen `tsconfig` (turning off `strict`, adding `skipLibCheck` to hide app errors, `// @ts-ignore`) to make a change compile.
3. **Implement.** Type at the boundary (props, hook return, API function), let inference handle the inside. Prefer `satisfies` and narrowing to `as`.
4. **Verify.** Run the project's type-check (`tsc --noEmit`, `tsc -b`, `vue-tsc`-style wrappers, or `npm run typecheck`). Ensure no new `any`, `as unknown as`, `!` non-null assertions or `@ts-expect-error` without a comment.

## Best Practices

### Compiler settings

- `strict: true` is the baseline (TypeScript 6.0+ defaults to it; on 5.x it must be set explicitly, so always keep it in `tsconfig.json`). Recommend `noUncheckedIndexedAccess` for new projects; add it to existing ones only as a dedicated change because it surfaces many errors.
- `jsx: "react-jsx"` — no `import React` needed for JSX. Import types with `import type { ReactNode } from 'react'` (required when `verbatimModuleSyntax` is on).
- TypeScript 7 (native Go compiler) aims for the same type-checking semantics as 6.0 [VERIFY]; differences appear mostly in tooling/flags, so follow the project's pinned version.

### Props

- Declare props as a named `type` or `interface` (`ButtonProps`) next to the component; export it when consumers wrap the component. Follow the project's `type`/`interface` convention; use `type` when you need unions.
- Annotate the props parameter directly: `function Button(props: ButtonProps)`. `React.FC` is not required. Tradeoff: since `@types/react` 18 it no longer adds implicit `children`, so it is mostly harmless, but it cannot express generic components, and it returns a type broader than needed. Do not convert an existing `FC` codebase for style alone.
- Use default parameter values for optional props (`size = 'md'`). `defaultProps` on function components is removed in React 19.
- Use string literal unions for variants: `variant: 'primary' | 'secondary'`, not `string`.
- Callback props: name by event (`onSelect`, `onOpenChange`), type the payload, return `void`.

### Discriminated unions for mutually exclusive props

When props only make sense together, model each valid combination and discriminate on a literal field. Use `?: never` to forbid props from the other branch when there is no natural discriminant.

### Wrapping native elements

- `ComponentPropsWithoutRef<'button'>` — native props minus `ref`. Use for React 18 / `forwardRef` wrappers.
- `ComponentPropsWithRef<'button'>` — includes `ref`. Use on React 19 when `ref` is a regular prop.
- `ComponentProps<typeof Select>` — props of an existing component (third-party wrappers).
- `Omit` the native props you redefine (`size`, `type`, `onChange`) to avoid incompatible intersections.
- Spread the rest props onto the element so `aria-*`, `data-*`, `id` and event handlers keep working.

### Children and render types

- `ReactNode` — anything renderable (elements, strings, numbers, `null`, arrays). Default for `children` and slots.
- `ReactElement` — exactly one element; rarely needed. In React 19 types its props default to `unknown`, so parameterize it: `ReactElement<{ id: string }>`.
- Render prop: `(item: T) => ReactNode`.
- `PropsWithChildren<P>` is fine but explicit `children: ReactNode` documents whether children are required.
- Use `React.JSX.Element` (not the global `JSX.Element`, removed in React 19 types) when you must name an element type.

### Events

- Inline handlers infer types: `onChange={(e) => setName(e.target.value)}` needs no annotation.
- Standalone handlers: `ChangeEvent<HTMLInputElement>`, `FormEvent<HTMLFormElement>`, `MouseEvent<HTMLButtonElement>`, `KeyboardEvent<HTMLElement>` imported as types from `react` (not the DOM globals of the same name).
- Or type the handler itself: `const onChange: ChangeEventHandler<HTMLInputElement> = (e) => …`.
- Use `event.currentTarget` for the element the handler is attached to (typed), `event.target` for the actual origin (typed as `EventTarget`).

### Refs

- DOM refs: `useRef<HTMLInputElement>(null)` → `RefObject<HTMLInputElement | null>` in React 19 types; read with `ref.current?.focus()`.
- Mutable values: `useRef<number | undefined>(undefined)`. React 19 types require an argument to `useRef`.
- `MutableRefObject` is deprecated in React 19 types; use `RefObject`.
- Callback refs in React 19 may return a cleanup function; any other return value is a type error, so use a block body `ref={(el) => { node = el; }}`.
- Imperative handles: `useImperativeHandle(ref, () => ({ focus, reset }))` with an exported handle type.

### Hooks and context

- `useState` infers from the initial value; annotate when the initial value is narrower than the state: `useState<User | null>(null)`.
- `useReducer`: type the reducer's `state` and `action` parameters; let React infer the rest (React 19 types prefer inference over explicit generics).
- Context without a sensible default: `createContext<Value | null>(null)` plus a hook that throws when missing. Avoid `createContext({} as Value)`.
- Custom hooks returning tuples need `as const` or an explicit tuple return type, otherwise the result is a union array.

### Utility types and `satisfies`

- `Pick`, `Omit`, `Partial`, `Required`, `Readonly`, `Record<K, V>`, `NonNullable`, `ReturnType`, `Awaited`, `Parameters` cover most needs. Avoid deep custom type gymnastics in app code.
- `satisfies` checks a value against a type without widening it: `const routes = { home: '/' } satisfies Record<string, string>` keeps the literal keys.
- `as const` for literal tuples/config objects; derive unions from them: `type Status = (typeof STATUSES)[number]`.

### Data from the network

- Data from outside the app is `unknown` until validated. `res.json()` returns `any`; do not let it flow untyped.
- Separate **DTO** types (wire format: snake_case, ISO strings, nullable fields) from **domain** types (what the UI uses: camelCase, `Date`, non-null where guaranteed). Map once in the feature's `api/` layer.
- With zod, define the schema once and infer the type: `type OrderDto = z.infer<typeof OrderDtoSchema>`. With transforms, `z.input<typeof S>` is the wire type and `z.output<typeof S>` (= `z.infer`) the parsed type.
- If validation is too expensive for a hot endpoint, type the fetch function's return explicitly and add a `ponytail:`-style comment explaining the trust assumption. Never cast at the call site.
- Zod 4 notes: import `* as z from 'zod'`; string formats are top level (`z.email()`, `z.uuid()`, `z.iso.datetime()`); custom messages use `{ error: '…' }` (the `message` param still works but is deprecated). Zod 3 uses `z.string().email()` and `{ message }`; follow the installed major.

### Avoiding `any` and `as`

- Narrow instead of asserting: `typeof`, `in`, `Array.isArray`, discriminant checks, `instanceof`, user-defined type guards, or schema `safeParse`.
- `unknown` in `catch` (default under `strict`): narrow with `error instanceof Error`.
- Acceptable `as`: `as const`; DOM queries where the selector guarantees the type; test fixtures. Each other `as` deserves a comment.
- Non-null assertion `!` hides crashes; check and throw a descriptive error instead.

## Anti-patterns

- **`any` for props or API data** — disables checking for everything downstream — use `unknown` + validation or a precise type.
- **`as unknown as T`** — lies to the compiler — fix the type or validate.
- **Boolean flag soup** (`isLink`, `href?`, `onClick?` all optional) — allows invalid combinations — discriminated union.
- **Wrapper typed with a hand-written subset of native props** — drops `aria-*`, `name`, `form` etc. — extend `ComponentPropsWithoutRef<'input'>`.
- **`React.FC<Props>` for generic components** — loses the type parameter — use a plain generic function.
- **Global `JSX.Element` on React 19 types** — removed namespace — `React.JSX.Element` or `ReactNode`.
- **`createContext({} as Value)`** — runtime crash outside provider type-checks fine — `null` default plus guarded hook.
- **Reusing DTO types in components** — wire-format changes ripple through UI — map to domain types in `api/`.
- **`useRef<HTMLDivElement>()` with no argument** — type error in React 19 types — `useRef<HTMLDivElement>(null)`.
- **Loosening tsconfig to fix a build** — silently degrades the whole codebase — fix the code.

## Implementation Examples

### Discriminated union: button or link

```tsx
// src/shared/ui/Action.tsx
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type Common = { children: ReactNode; variant?: 'primary' | 'secondary' };

type ButtonVariant = Common & { as: 'button' } & Omit<ComponentPropsWithoutRef<'button'>, keyof Common>;
type LinkVariant = Common & { as: 'a'; href: string } & Omit<ComponentPropsWithoutRef<'a'>, keyof Common | 'href'>;

export type ActionProps = ButtonVariant | LinkVariant;

export function Action(props: ActionProps) {
  if (props.as === 'a') {
    const { as: _as, variant = 'primary', children, ...rest } = props;
    return <a {...rest} data-variant={variant}>{children}</a>;
  }
  const { as: _as, variant = 'primary', children, type = 'button', ...rest } = props;
  return <button {...rest} type={type} data-variant={variant}>{children}</button>;
}

// <Action as="a" href="/orders">Orders</Action>      ✅
// <Action as="button" onClick={save}>Save</Action>   ✅
// <Action as="button" href="/x">Bad</Action>         ❌ compile error
```

If the project's ESLint flags unused `_as`, configure `argsIgnorePattern`/`varsIgnorePattern: '^_'` or destructure differently; do not disable the rule globally.

### Generic list component

```tsx
// src/shared/ui/SelectList.tsx
import type { ReactNode } from 'react';

type SelectListProps<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  selectedKey: string | null;
  onSelect: (item: T) => void;
  emptyText?: string;
};

export function SelectList<T>({
  items,
  getKey,
  renderItem,
  selectedKey,
  onSelect,
  emptyText = 'No items',
}: SelectListProps<T>) {
  if (items.length === 0) return <p>{emptyText}</p>;
  return (
    <ul role="listbox" aria-label="Options">
      {items.map((item) => {
        const key = getKey(item);
        return (
          <li
            key={key}
            role="option"
            aria-selected={key === selectedKey}
            tabIndex={0}
            onClick={() => onSelect(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(item);
              }
            }}
          >
            {renderItem(item)}
          </li>
        );
      })}
    </ul>
  );
}
```

`T` is inferred from `items`; `onSelect` receives the full typed item. In a `.tsx` arrow function write `<T,>` to avoid JSX parsing ambiguity.

### zod schema, DTO and domain mapping (zod 4)

```ts
// src/features/orders/api/orders.api.ts
import * as z from 'zod';
import { http } from '@/shared/lib/http';

const OrderDtoSchema = z.object({
  id: z.uuid(),
  order_number: z.string(),
  status: z.enum(['open', 'shipped', 'cancelled']),
  created_at: z.iso.datetime({ offset: true }),
  total_cents: z.number().int(),
});
type OrderDto = z.infer<typeof OrderDtoSchema>;

export type Order = {
  id: string;
  number: string;
  status: OrderDto['status'];
  createdAt: Date;
  total: number; // in currency units
};

function toOrder(dto: OrderDto): Order {
  return {
    id: dto.id,
    number: dto.order_number,
    status: dto.status,
    createdAt: new Date(dto.created_at),
    total: dto.total_cents / 100,
  };
}

export async function getOrder(id: string, signal?: AbortSignal): Promise<Order> {
  const json: unknown = await http.get(`/orders/${encodeURIComponent(id)}`, { signal });
  return toOrder(OrderDtoSchema.parse(json)); // throws ZodError on contract drift
}
```

`http.get` is the project's existing client returning `unknown` (or `Promise<unknown>`). Zod 3 equivalents: `z.string().uuid()`, `z.string().datetime({ offset: true })`.

### Context with a guarded hook

```tsx
// src/features/auth/model/session-context.tsx
import { createContext, useContext, type ReactNode } from 'react';

export type Session = { userId: string; roles: readonly string[] };

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ session, children }: { session: Session; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>');
  return session;
}
```

### Event handler types and `satisfies`

```tsx
// src/features/search/components/SearchBox.tsx
import { useState, type ChangeEvent, type FormEvent } from 'react';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
] as const satisfies readonly { value: string; label: string }[];

type Sort = (typeof SORT_OPTIONS)[number]['value']; // 'relevance' | 'newest'

export function SearchBox({ onSearch }: { onSearch: (q: string, sort: Sort) => void }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('relevance');

  function handleSortChange(e: ChangeEvent<HTMLSelectElement>) {
    const next = SORT_OPTIONS.find((o) => o.value === e.currentTarget.value);
    if (next) setSort(next.value); // narrowing instead of `as Sort`
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSearch(query.trim(), sort);
  }

  return (
    <form role="search" onSubmit={handleSubmit}>
      <label htmlFor="q">Search</label>
      <input id="q" value={query} onChange={(e) => setQuery(e.target.value)} />
      <label htmlFor="sort">Sort</label>
      <select id="sort" value={sort} onChange={handleSortChange}>
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button type="submit">Search</button>
    </form>
  );
}
```

## Validation Checklist

- [ ] `strict` is on; no tsconfig loosening in the change.
- [ ] No new `any`, `as unknown as`, `!` assertions or uncommented `@ts-expect-error`.
- [ ] Invalid prop combinations fail to compile (discriminated unions where props are exclusive).
- [ ] Wrappers extend native/library props via `ComponentPropsWithoutRef`/`WithRef`/`ComponentProps` and spread the rest.
- [ ] `children`/slots typed as `ReactNode`; generic components are plain generic functions.
- [ ] Refs: `useRef(null)` with element type; no `MutableRefObject` in React 19 code.
- [ ] Network data enters as `unknown` and is validated or mapped in the feature `api/` layer; components use domain types.
- [ ] zod API calls match the installed major (3 vs 4).
- [ ] Project type-check passes.

## References

- https://react.dev/learn/typescript
- https://react.dev/blog/2024/04/25/react-19-upgrade-guide
- https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- https://zod.dev/api
