---
name: frontend-code-quality
description: Write and refactor React and Angular TypeScript code that stays readable and safe to change - single-responsibility components, hooks and services, dependency inversion via props and DI, rule-of-three abstraction, naming conventions, strict typing without any, and behaviour-preserving refactors. Use when writing new frontend code, refactoring a large component or service, removing duplication, fixing any or unsafe casts, naming things, or when the user asks to clean up, simplify, or improve maintainability of frontend code.
license: MIT
metadata:
  category: shared
  version: "1.0.0"
  frameworks: "react 18-19, angular 17+, typescript 5-7"
  last-reviewed: "2026-11-25"
---

# Frontend Code Quality

## Purpose

Keep frontend code easy to read, type-safe, and cheap to change. Good looks like: each component, hook, or service has one reason to change; types describe real data and the compiler catches mistakes; abstractions exist because duplication proved them, not because they might be needed; refactors change structure without changing behaviour, and tests prove it. Project lint rules and naming conventions override the defaults here.

## When to Use

- Writing new components, hooks, services, or utilities.
- Refactoring a component or service that grew too large or mixes concerns.
- Removing `any`, `as` casts, non-null assertions, or `@ts-ignore`.
- Deciding whether to extract a shared abstraction.
- Naming files, symbols, events, and boolean props.

Do not use when: reviewing someone else's diff (see `frontend-code-review`), deciding folder layout (see `frontend-architecture`), or tuning render performance (see `react-performance` / `angular-performance`).

## Workflow

1. **Detect** — read `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), ESLint config (`@typescript-eslint` presets, Angular ESLint), Prettier config, and two neighbouring files for naming and structure conventions. Note the TypeScript version: `satisfies` needs 4.9+. TypeScript 7 ships the native (Go-based) compiler as per-platform binaries behind the usual `tsc` command; tools that import the TypeScript JS API (some ESLint/Angular/bundler plugins) may lag, so confirm tooling compatibility before upgrading [VERIFY].
2. **Find the change reason** — for a refactor, list what the unit currently does. More than one independent reason to change (fetching + formatting + layout + validation) signals a split.
3. **Protect behaviour** — before refactoring, confirm tests cover the behaviour. If not, add a characterisation test against the current output first.
4. **Change in small steps** — rename, extract, move, then simplify. Run type-check and tests after each step. Do not mix refactors with behaviour changes in one commit.
5. **Verify** — type-check (`tsc --noEmit` or `ng build`), lint, tests. Confirm no new `any`, `@ts-ignore`, or unexplained `!`.

## Best Practices

### Single responsibility, frontend edition

- Component: renders one UI concern. Data loading, side effects, and business rules move out into a hook (React) or service/store (Angular) once they exceed a few lines or are reused.
- Hook (React): one concern per hook — `useInvoices` fetches, `useInvoiceFilters` manages filter state. A hook returning 10+ unrelated values is two hooks.
- Service (Angular): one domain or infrastructure concern. `InvoiceApi` does HTTP; `InvoiceStore` holds state; neither formats dates for the template.
- Pure logic (calculations, mapping, validation) goes in plain functions — easiest to test, framework-independent.

### Dependency inversion without ceremony

- React: depend on values passed in. Pass callbacks and data via props; inject cross-cutting services via context only when many distant components need them.
- Angular: depend on injected services (`inject()` or constructor injection — follow the project). Use an `InjectionToken` for config or when swapping implementations is a real need (tests, platforms), not for every class.
- Do not create an interface with one implementation "for testability". Angular `TestBed` providers and React props/mocks already allow substitution.

### DRY vs premature abstraction

- Rule of three: tolerate two copies; extract on the third, when the shared shape is visible.
- Duplicate code that changes for different reasons is not duplication. Two forms with similar fields for different domains should stay separate.
- A component with more than ~3 boolean props toggling layout modes is a sign of a wrong abstraction. Prefer composition (children / content projection) or separate components.
- When an abstraction needs flags to handle callers differently, inline it back and re-extract.

### Naming

- Components: PascalCase nouns (`InvoiceTable`). Angular: `invoice-table.component.ts` with class `InvoiceTableComponent` — unless the project follows the Angular 20+ style guide that drops the suffix (`invoice-table.ts`, class `InvoiceTable`). Match what exists.
- Hooks: `use` + noun/verb (`useDebouncedValue`). Must start with `use` for the Rules of Hooks lint to apply.
- Booleans: `is`/`has`/`can`/`should` prefix (`isLoading`, `canSubmit`).
- Event props/outputs: React `onSomething` props with `handleSomething` handlers; Angular outputs named for the event without `on` prefix (`selected`, `closed`) per the Angular style guide.
- Functions: verbs (`formatCurrency`, `toInvoiceModel`). Mapping functions: `toX` / `fromX`.
- No abbreviations beyond common ones (`id`, `url`, `dto`). No type info in names (`invoiceArray`, `strName`).
- Constants that never change: `UPPER_SNAKE_CASE` at module level only if the project does so.

### Type safety

- `strict: true` is the baseline. Recommend `noUncheckedIndexedAccess` for new projects; do not flip it in a large codebase as a side change.
- No `any`. Use `unknown` for untrusted data (API responses, `JSON.parse`, `catch` variables, `postMessage`) and narrow with type guards or a schema validator the project already uses (Zod, Valibot).
- Use `satisfies` to check a value against a type while keeping its narrow literal type (config maps, route tables, lookup objects).
- Model states with discriminated unions instead of several optional booleans: `{ status: 'loading' } | { status: 'error'; error: AppError } | { status: 'success'; data: T }`.
- Exhaustiveness: end `switch` on a union with a `never` check so new members fail compilation.
- Avoid `as` casts except at a validated boundary. Never `as unknown as T` to silence errors.
- Avoid non-null `!`. Narrow with an `if`, or assert with a function that throws a clear message.
- Prefer `readonly` arrays and properties for inputs/props that must not be mutated.
- Export types that callers need; keep internal types unexported.

### Refactoring safely

- One structural change per step: rename, extract function, extract component, move file. Use the IDE's rename/move refactors so imports update.
- Keep the public contract (props, inputs/outputs, exported function signatures) stable, or update all callers in the same change.
- Remove dead code instead of commenting it out — version control keeps history.
- When deleting, search for string-based usage too (route paths, i18n keys, `data-testid`, dynamic imports).

### Maintainability

- Functions under ~40 lines and components under ~200 lines are a guideline, not a rule; split by responsibility, not by count.
- Early returns over nested conditionals.
- Comments explain why (business rule, workaround link), not what.
- Avoid magic numbers and strings; name them or derive from the type.
- Keep side effects at the edges: effects, subscriptions, and HTTP calls in hooks/services; components and pure functions stay predictable.

## Anti-patterns

- `const data: any = await res.json()` — removes all checking downstream — type as `unknown` and validate/narrow, or map to a DTO type at the API layer.
- `user!.name` scattered through templates and components — crashes on the first null — narrow once at the top, or model the state as a union.
- `// @ts-ignore` to make a build pass — hides real bugs — fix the type; if unavoidable, `// @ts-expect-error <reason>` so it fails when no longer needed.
- `isLoading`, `isError`, `isEmpty`, `data?` as independent fields — impossible combinations become representable — discriminated union.
- `GenericTable` with 25 props and `mode` flags after two usages — premature abstraction — duplicate until the third use, then extract the stable part.
- `IUserService` interface + `UserServiceImpl` with one implementation — indirection without benefit — use the class; add an interface/token when a second implementation exists.
- God components (fetch + transform + validate + render + modals) — every change risks everything — extract hook/service, pure functions, and child components.
- Refactor and feature in one commit — review cannot tell intentional changes from accidents — separate commits or PRs.
- Enums for string unions in new code — extra runtime object and nominal quirks — prefer `type Status = 'draft' | 'paid'` or `as const` objects, unless the project standardises on enums.

## Implementation Examples

### `unknown` + type guard at a boundary

```ts
// src/shared/lib/storage.ts
export interface UserPrefs { theme: 'light' | 'dark'; pageSize: number }

function isUserPrefs(value: unknown): value is UserPrefs {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (v.theme === 'light' || v.theme === 'dark') && typeof v.pageSize === 'number';
}

export function readPrefs(raw: string | null): UserPrefs | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isUserPrefs(parsed) ? parsed : null;
  } catch {
    return null; // corrupted storage is expected input, not an error
  }
}
```

### `satisfies` and exhaustive switch

```ts
// src/features/invoices/status.ts
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export const STATUS_LABEL = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
} satisfies Record<InvoiceStatus, string>; // missing/extra keys fail; values stay literal

export function canEdit(status: InvoiceStatus): boolean {
  switch (status) {
    case 'draft':
      return true;
    case 'sent':
    case 'paid':
    case 'overdue':
      return false;
    default: {
      const unreachable: never = status;
      throw new Error(`Unhandled status: ${String(unreachable)}`);
    }
  }
}
```

### Discriminated union for async state

```ts
// src/shared/lib/remote-data.ts
export type RemoteData<T, E = Error> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: E }
  | { status: 'success'; data: T };
```

If the project uses TanStack Query or Angular `resource`/`httpResource`, use their status fields instead of hand-rolling this.

### SRP split — React

```tsx
// Before: InvoicePage fetched, filtered, formatted, and rendered.
// src/features/invoices/hooks/useInvoices.ts
import { useQuery } from '@tanstack/react-query';
import { fetchInvoices } from '../api/invoices-api';

export function useInvoices(status: string | undefined) {
  return useQuery({ queryKey: ['invoices', { status }], queryFn: ({ signal }) => fetchInvoices({ status }, signal) });
}

// src/features/invoices/components/InvoicePage.tsx
import { useState } from 'react';
import { useInvoices } from '../hooks/useInvoices';
import { InvoiceTable } from './InvoiceTable';

export function InvoicePage() {
  const [status, setStatus] = useState<string>();
  const invoices = useInvoices(status);
  if (invoices.isPending) return <p>Loading…</p>;
  if (invoices.isError) return <p role="alert">Could not load invoices.</p>;
  return <InvoiceTable rows={invoices.data} onStatusChange={setStatus} />;
}
```

Adapt to the project's data layer; the point is that the page orchestrates, the hook fetches, the table renders.

### SRP split — Angular

```ts
// src/app/features/invoices/invoice-page.component.ts
import { Component, inject } from '@angular/core';
import { InvoicesStore } from './state/invoices.store';
import { InvoiceTableComponent } from './components/invoice-table.component';

@Component({
  selector: 'app-invoice-page',
  imports: [InvoiceTableComponent], // Angular 19+: standalone by default; on 17-18 add standalone: true
  template: `
    @if (store.error()) {
      <p role="alert">Could not load invoices.</p>
    } @else {
      <app-invoice-table [rows]="store.invoices()" (statusChange)="store.setStatus($event)" />
    }
  `,
})
export class InvoicePageComponent {
  protected readonly store = inject(InvoicesStore);
}
```

`@if` control flow requires Angular 17+. If the project still uses `*ngIf`, follow it.

### Assertion function instead of `!`

```ts
// src/shared/lib/invariant.ts
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invariant failed: ${message}`);
}

// usage
const el = document.getElementById('root');
invariant(el, '#root element missing from index.html');
el.append(/* ... */); // el is HTMLElement here
```

## Validation Checklist

- [ ] Read tsconfig strictness flags, lint config, and neighbouring files before writing.
- [ ] No new `any`, `as unknown as`, `@ts-ignore`, or unexplained `!` in the diff.
- [ ] Untrusted data typed as `unknown` and narrowed or validated.
- [ ] Unions handled exhaustively (`never` check) where a new member must force updates.
- [ ] Each new component/hook/service has one reason to change.
- [ ] No new abstraction with a single caller or a single implementation, unless the project requires it.
- [ ] Names follow project conventions (file suffixes, `use` prefix, boolean prefixes, output naming).
- [ ] Refactor commits contain no behaviour change; tests passed before and after.
- [ ] Type-check, lint, and tests pass.

## References

- TypeScript `satisfies`: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html
- TypeScript narrowing: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- Angular style guide: https://angular.dev/style-guide
- React Rules of Hooks: https://react.dev/reference/rules/rules-of-hooks
