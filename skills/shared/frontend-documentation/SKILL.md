---
name: frontend-documentation
description: Write and maintain the minimum useful documentation for frontend codebases — feature READMEs, Architecture Decision Records (ADRs), TSDoc for public APIs, Storybook stories, CHANGELOG entries, and PR descriptions that explain decisions. Use when adding a feature module, shared component library API, architectural change, breaking change, release, or when asked to document, explain, or write an ADR in React or Angular projects.
license: MIT
metadata:
  category: shared
  version: "1.0.0"
  frameworks: "react, angular, typescript"
  last-reviewed: "2026-11-25"
---

# Frontend Documentation

## Purpose

Capture what a future maintainer cannot recover from reading the code: why a decision was made, how to use a public API correctly, how to run or extend a feature, and what changed for consumers. Good documentation is short, lives next to the code it describes, and is updated in the same PR as the code. Anything the code, types, or tests already say clearly does not need prose.

## When to Use

- Creating a feature folder or shared library that other teams will consume.
- Making an architectural choice (state library, routing strategy, auth flow, monorepo layout, rendering mode) with real alternatives.
- Exporting a component, hook, service, directive, or utility from a public entry point (`index.ts`, `public-api.ts`).
- Shipping a breaking change, a deprecation, or a release.
- Opening a PR whose "why" is not obvious from the diff.

Do not use when: writing end-user product help, API reference for backend services, or code comments for local implementation details — prefer clearer names and tests there. For review conventions, see the `frontend-code-review` skill.

## Workflow

1. **Detect** — find existing docs conventions before writing anything:
   - Root `README.md`, `CONTRIBUTING.md`, `docs/`, `docs/adr/` or `docs/decisions/`, `CHANGELOG.md`, `.changeset/`, Storybook (`.storybook/`, `*.stories.ts(x)`), Compodoc (`.compodocrc`, `@compodoc/compodoc`), TypeDoc (`typedoc.json`), commit conventions (`commitlint`, Conventional Commits), PR templates (`.github/pull_request_template.md`).
   - Match the existing format, numbering, file naming, and tone. Do not introduce a second ADR folder or changelog tool.
2. **Decide what is worth documenting** — use the table in Best Practices. If none applies, write no docs; improve names/types instead.
3. **Write** — the smallest artifact that answers the reader's question; place it next to the code it describes.
4. **Verify** — links resolve, code samples compile or are copied from real code, commands run, and the docs are part of the same PR as the change.

## Best Practices

### What to document, and where

| Situation | Artifact | Location |
| --- | --- | --- |
| Feature with setup, flags, external dependencies, or non-obvious data flow | Feature `README.md` | `src/features/<feature>/README.md` (or `libs/<lib>/README.md`) |
| Decision with alternatives and long-lived consequences | ADR | `docs/adr/NNNN-short-title.md` (follow existing numbering) |
| Exported component, hook, service, function, or type used by other modules/teams | TSDoc on the export | The source file |
| Visual component states and props | Story | `<Component>.stories.tsx` / `.stories.ts` next to the component, if Storybook exists |
| Consumer-visible change, deprecation, breaking change | CHANGELOG entry / changeset | Per project tool (`CHANGELOG.md`, Changesets, release-please) |
| Why this change, trade-offs, how it was tested | PR description | The PR, linking the ADR/issue |
| Workaround for a browser bug, regulation, or external constraint | Short code comment with link | Above the workaround line |

### What not to document

- Restating code: `// increment counter` over `count++`, or TSDoc `@param id the id`.
- Private/internal helpers that are not exported from the module's public entry point.
- Types already expressed in TypeScript: do not repeat types in `@param {string}` tags.
- Change history in comments (`// changed by X on date`): that belongs to version control.
- Commented-out code: delete it; version control keeps it.
- Speculative docs for features not built yet.

### Feature README

- Answer, in this order: what the feature does (1–2 sentences), how to run/try it (route, flag, mock data), public entry points, key data flow (which API, which store/query keys), extension points, and known limitations.
- Keep it under a screen or two. Link to ADRs instead of re-arguing decisions.
- Write commands exactly as they run in this repo (`npm`, `pnpm`, `nx`, `ng` — whichever the project uses).

### ADRs

- One decision per ADR. Immutable once accepted: to change a decision, write a new ADR that supersedes the old one and update the old one's status line only.
- Record context, the options seriously considered, the decision, and consequences (including the negative ones). An ADR without rejected alternatives is an announcement, not a decision record.
- Status values: `Proposed`, `Accepted`, `Deprecated`, `Superseded by ADR-NNNN`.
- Write ADRs for choices that are costly to reverse: state management library, SSR vs. CSR, micro-frontends, design system, auth token strategy, monorepo tooling, testing strategy. Skip them for reversible, local choices.

### TSDoc for public APIs

- Document the contract: what it does, non-obvious parameter constraints, return semantics, thrown errors, side effects, and a short `@example` when usage is not obvious.
- Use `@deprecated` with the replacement and the planned removal version; IDEs strike through deprecated symbols.
- Use standard TSDoc tags (`@param`, `@returns`, `@throws`, `@example`, `@deprecated`, `@remarks`, `@see`, `@defaultValue`). Angular: Compodoc reads JSDoc/TSDoc from components, inputs, and services.
- For React components, document the props type (each prop's JSDoc shows in IDE hovers and Storybook autodocs) rather than the function body.
- For Angular components, document `input()`/`output()` declarations (or `@Input()`/`@Output()` on older code) and the selector's usage.

### Storybook (only if present)

- One story per meaningful state: default, loading, empty, error, disabled, long content, and RTL if supported.
- Use `tags: ['autodocs']` (Storybook 7+) to generate a docs page from the props/inputs and their TSDoc instead of writing MDX by hand.
- Reuse MSW handlers for stories that fetch data (the `msw-storybook-addon`) so stories and tests share mocks.
- Do not add Storybook just to document one component; a README example is enough.

### CHANGELOG

- Write for consumers: what changed for them and what they must do. Group by `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security` (Keep a Changelog convention) unless the project uses a generator.
- If the repo uses Changesets, Conventional Commits + release-please, or semantic-release, do not hand-edit generated `CHANGELOG.md`; add a changeset or write a correctly typed commit instead.
- Breaking changes must include a migration snippet (before/after).

### PR descriptions

- Explain why the change exists, what alternatives were rejected, risks, and how it was verified (tests added, manual steps, screenshots for UI). The diff already shows what changed line by line.
- Link the issue/ticket and any ADR. If the PR makes an architectural decision without an ADR, either write one or state in the PR why one is not needed.
- Call out follow-ups explicitly instead of leaving `TODO` comments without owners.

## Anti-patterns

- A `docs/` wiki that drifts from the code — nobody updates it — keep docs next to the code and update them in the same PR.
- TSDoc on every private function — noise that rots — document exported APIs only; make internals self-explanatory.
- ADRs written after the fact to justify a choice with no alternatives listed — no decision value — record real options and trade-offs at decision time.
- Editing an accepted ADR to reflect a new decision — loses history — supersede with a new ADR.
- Hand-editing a generated changelog — overwritten on next release — use the project's changeset/commit convention.
- README copied from a template with empty sections — signals nothing — delete sections that do not apply.
- PR description "fixes bug" — reviewers cannot evaluate the change — state cause, fix, and verification.
- Code samples in docs that were never run — wrong imports mislead readers — copy from real, compiled code or tests.

## Implementation Examples

### Feature README

```markdown
<!-- src/features/invoices/README.md -->
# Invoices

Lists, filters, and exports a customer's invoices. Read-only; payments live in `features/payments`.

## Try it
- Route: `/billing/invoices` (requires `billing:read`; enforced by the API, the route guard is UX only)
- Local data: `npm run dev` with `VITE_ENABLE_MOCKS=true` uses `src/mocks/invoices.handlers.ts`

## Public API (`index.ts`)
- `InvoicesPage` — routed page
- `useInvoices(filters)` — query hook; cache key `['invoices', filters]`

## Data flow
`InvoicesPage` → `useInvoices` → `GET /api/invoices?status=&from=&to=` → table (virtualized above 200 rows)

## Limitations
- CSV export is capped at 10,000 rows by the API; larger exports go through the reports service.

## Decisions
- ADR-0012: server-side pagination for invoices
```

### ADR template

```markdown
<!-- docs/adr/0012-server-side-pagination-for-invoices.md -->
# ADR-0012: Server-side pagination for invoices

- Status: Accepted
- Date: 2026-11-25
- Deciders: Web platform team

## Context
Large customers have 50k+ invoices. Loading all rows made the page take 9 s on mid-range phones (LCP 7.8 s p75) and exceeded the API's response size limit.

## Options considered
1. Client-side pagination of the full list — simple, but does not fix payload size.
2. Server-side pagination with cursor — smallest payloads; needs API change; no random page access.
3. Server-side pagination with offset — random page access; slower on deep pages.

## Decision
Option 2, cursor pagination, with filters sent to the API.

## Consequences
- Positive: constant payload size; LCP target reachable.
- Negative: "jump to page N" is not supported; export uses a separate endpoint.
- Follow-up: API team adds `cursor` param (tracked in BILL-431).
```

### TSDoc on a public React hook

```ts
// src/features/invoices/useInvoices.ts (exported from src/features/invoices/index.ts)
export interface InvoiceFilters {
  /** Inclusive ISO date (YYYY-MM-DD). Must be on or before `to`. */
  from?: string;
  /** Inclusive ISO date (YYYY-MM-DD). */
  to?: string;
  status?: 'open' | 'paid' | 'void';
}

/**
 * Loads one page of invoices for the signed-in customer.
 *
 * @remarks
 * Results are cached per filter object; pass a stable object (memoize or build from URL params)
 * to avoid refetching on every render.
 *
 * @throws {@link InvalidDateRangeError} synchronously if `from` is after `to`.
 *
 * @example
 * const { data, fetchNextPage } = useInvoices({ status: 'open' });
 */
export function useInvoices(filters: InvoiceFilters) {
  // ...
}
```

### TSDoc on an Angular component API

```ts
// libs/ui/src/lib/status-badge/status-badge.component.ts (Angular 17.1+ signal inputs)
import { Component, input, output } from '@angular/core';

/**
 * Compact, colour-and-text status indicator for table cells.
 *
 * @example
 * <ui-status-badge [status]="invoice.status" (badgeClick)="openFilter($event)" />
 */
@Component({
  selector: 'ui-status-badge', // add standalone: true on Angular 17/18
  template: `<button type="button" (click)="badgeClick.emit(status())">{{ status() }}</button>`,
})
export class StatusBadgeComponent {
  /** Status to display. Text is always shown, so colour is never the only cue. */
  readonly status = input.required<'open' | 'paid' | 'void'>();

  /** Emits the status when the badge is activated, e.g. to filter the table. */
  readonly badgeClick = output<'open' | 'paid' | 'void'>();

  /**
   * @deprecated Use `status` with `'void'` instead. Removed in v5.0.0.
   */
  readonly cancelled = input(false);
}
```

### Story covering states (React + Vite, Storybook 8+/10 CSF3)

```tsx
// src/features/invoices/InvoiceTable.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite'; // framework package; older setups: '@storybook/react'
import { InvoiceTable } from './InvoiceTable';

const meta = {
  component: InvoiceTable,
  tags: ['autodocs'],
} satisfies Meta<typeof InvoiceTable>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { rows: [{ id: 'INV-1', total: 120, status: 'open' }], state: 'ready' } };
export const Loading: Story = { args: { rows: [], state: 'loading' } };
export const Empty: Story = { args: { rows: [], state: 'ready' } };
export const Failed: Story = { args: { rows: [], state: 'error' } };
```

Current Storybook docs import `Meta`/`StoryObj` from the framework package (`@storybook/react-vite`, `@storybook/nextjs-vite`, `@storybook/angular`); follow whatever the project's existing stories import. Angular stories use the same CSF3 shape with `@storybook/angular`.

### CHANGELOG entry (Keep a Changelog)

```markdown
## [4.2.0] - 2026-11-25
### Added
- `useInvoices` supports `status` filter.
### Deprecated
- `StatusBadge` `cancelled` input; use `status="void"`. Removal planned for 5.0.0.
### Fixed
- Invoice totals no longer round half-cents down in the `de-DE` locale.
```

### PR description

```markdown
## Why
Invoices page timed out for customers with 50k+ invoices (BILL-420). See ADR-0012.

## What
- Switch `useInvoices` to cursor pagination; table loads more on scroll.
- Remove client-side sort (API sorts now).

## Alternatives rejected
Client-side pagination: did not reduce the 30 MB payload.

## Risk
Deep links with `?page=N` now land on page 1; redirect added.

## Verification
- Unit: `useInvoices` cursor handling; integration: table loads next page (MSW).
- Manual: 60k-invoice staging tenant, LCP 2.1 s (was 7.8 s) on throttled mobile profile.
```

## Validation Checklist

- [ ] Existing documentation conventions (ADR folder, changelog tool, Storybook, PR template) detected and followed.
- [ ] Every new doc answers a question the code cannot; no restating of code or types.
- [ ] Feature README (if added) covers purpose, how to run, public API, data flow, limitations — and nothing empty.
- [ ] Architectural decisions with real alternatives have an ADR with options, decision, and consequences.
- [ ] All exported/public APIs changed in the PR have accurate TSDoc; deprecated APIs say what to use and when removal happens.
- [ ] Storybook stories (if Storybook exists) cover loading, empty, error, and edge states.
- [ ] Consumer-visible changes have a changelog entry or changeset; breaking changes include migration steps.
- [ ] PR description states why, alternatives, risk, and verification.
- [ ] Docs, links, and code samples updated in the same PR as the code they describe.

## References

- [TSDoc](https://tsdoc.org/)
- [Architecture Decision Records](https://adr.github.io/)
- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- [Storybook: Autodocs](https://storybook.js.org/docs/writing-docs/autodocs)
- [Compodoc](https://compodoc.app/)
