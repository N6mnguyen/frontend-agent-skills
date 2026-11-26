---
name: frontend-code-review
description: Review a React or Angular TypeScript diff as an agent, prioritizing defects in correctness, types, security, accessibility, performance, tests, and project conventions. Use when reviewing a pull request, staged diff, commit, patch, or proposed frontend change, or when asked to find bugs or provide code-review comments.
license: MIT
metadata:
  category: shared
  version: "1.0.0"
  frameworks: "react 18-19, angular 17+, typescript"
  last-reviewed: "2026-11-25"
---

# Frontend Code Review

## Purpose

Find actionable defects introduced by the diff, not stylistic preferences. A useful review reports a concrete scenario, impact, and location for each finding; otherwise it reports no findings. Never infer correctness from a passing build alone: review runtime paths, browser behaviour, and the project conventions that the change touches.

## When to Use

- Reviewing a PR, commit, staged/unstaged diff, or generated patch.
- Asked to identify bugs, security issues, regressions, or missing tests in frontend changes.
- Evaluating whether a proposed fix is safe before merge.

Do not use when: implementing a feature without a review request; use the relevant implementation skill instead. Do not review files outside the requested diff unless needed to confirm a finding.

## Workflow

1. **Detect** — inspect status and diff base; read the full changed files plus directly called functions, types, routes, and tests. Identify React/Angular and versions from package manifests. Read lint/test commands and nearby patterns. Do not alter files unless asked to fix findings.
2. **Understand intent** — read issue/PR description and commit context. Summarize expected behaviour privately; distinguish intentional design from accidental change.
3. **Trace changed paths** — for each changed branch, follow inputs from user/API/storage to rendering and side effects. Check loading, empty, error, repeated action, navigation/unmount, and stale-data cases where relevant.
4. **Check in priority order** — correctness and data loss; security/privacy; types; accessibility; API/error behavior; performance; tests; project conventions. Use the checklist below; focus on changes, not unrelated debt.
5. **Validate** — run targeted tests/type-check/lint if practical and safe. Tests support findings but do not replace inspection. Do not run destructive scripts or tests that hit production services without permission.
6. **Report** — list findings highest severity first, one issue per item, with exact file/line and a reproducible scenario. If none, say “No findings.” Mention checks run and relevant coverage gaps separately, without inventing defects.

## Best Practices

### Severity

- **P0 — Blocker:** exploitable vulnerability, unrecoverable data loss, or application-wide outage. Stop release; rare.
- **P1 — High:** likely defect affecting a major user flow, unauthorized data/action, serious accessibility barrier, or broad regression. Fix before merge.
- **P2 — Medium:** concrete bug with limited scope, important edge-case failure, missing guard causing user-visible error. Fix in this change unless risk justifies follow-up.
- **P3 — Low:** minor defect or robustness issue with narrow impact. Fix when inexpensive; do not inflate speculative concerns.
- No severity for preferences. If impact or reproduction is unclear, investigate or omit rather than speculate.

### Correctness and lifecycle

- Trace React hooks for stale closures, missing dependencies, effect cleanup, state updates after obsolete async work, and list keys that are unstable or non-unique.
- Verify state transitions: pending → success/error, empty results, retries, rapid repeated submissions, optimistic update rollback, and navigation during work.
- Check Angular subscriptions for teardown (`AsyncPipe`, `takeUntilDestroyed`, or equivalent), `OnPush`/signal update assumptions, template nullability, and provider scope.
- Ensure forms prevent duplicate submits while pending and server validation errors map to the correct fields.
- Check that route guards, deep links, browser back/forward, and lazy-loading failures retain expected behavior.
- Review date/time, locale, numeric precision, and timezone changes for boundary errors.

### Types and contracts

- Check DTOs match actual API payloads, optionality/nulls, enum values, and error bodies. A TypeScript assertion does not validate JSON at runtime.
- Flag new `any`, unsafe casts, non-null assertions on external data, and `@ts-ignore` when they hide a real invalid state.
- Verify discriminated unions and exhaustive handling where new variants were added.
- Check exported types and component props stay compatible with callers. Confirm API changes update all callers.

### Security and privacy

- Untrusted content must not enter `innerHTML`, `dangerouslySetInnerHTML`, or bypass Angular sanitization without an explicit sanitization policy.
- Check authorization is enforced by the server; client-side route guards are not access control.
- Do not log tokens, credentials, sensitive personal data, or full request bodies. Check analytics and error reporting payloads too.
- Validate URL construction, `postMessage` origin checks, redirect targets, and user-controlled link protocols.
- Check file upload type/size handling for user feedback, while recognizing server-side validation is mandatory.

### Accessibility

- Interactive controls need accessible names, keyboard access, visible focus, and correct semantics.
- Images need appropriate alternative text; decorative images use empty alt. Do not require redundant alt on CSS decoration.
- Form errors should be associated with fields and exposed to assistive technology; status updates should not steal focus unnecessarily.
- Dialogs need focus management, escape/close behavior, and labeling; do not flag native `<button>` vs a styled button solely by preference if semantics are equivalent.
- Check contrast only when changed colors are provided and measurable; do not guess from source values without considering opacity/background.

### Performance and tests

- Flag a measurable regression: unbounded rerenders, repeated network requests, huge eager imports, or O(n²) work in a frequent path. Avoid hypothetical micro-optimizations.
- Verify cancellation or stale-result protection when search/filter requests can race.
- Tests should cover the changed behavior and regression edge case. Do not require a test for every trivial constant or mechanical rename.
- Prefer focused unit/component tests; integration tests where route/network composition is the defect. Review assertions, not just test presence.

### Project conventions

- Follow the repository's formatting, naming, architecture, design system, and state/data-fetching patterns.
- A different valid approach is not a defect unless it breaks a stated convention or causes a concrete cost.
- Check lockfile/package changes for accidental unrelated upgrades or unsupported peer versions.

### Actionable comments

Use a short finding format:

```text
[P1] Preserve the request identity before applying this response

When a user changes filters twice quickly, the slower first request can resolve last and overwrite the newer results. Keep the query keyed by filters or ignore responses for stale requests. (src/features/items/useItems.ts:42)
```

- Title states the defect and starts with severity.
- Body states trigger, impact, and a concrete fix direction. Avoid prescribing a full rewrite when one guard is enough.
- Anchor to the smallest changed line range that exposes the issue. Check the provider's expected line format if posting inline.
- One finding per independent issue. Avoid duplicating the same root cause across several call sites.
- If a suggestion is optional, label it as a question or omit it; do not disguise preference as a blocking finding.

## Anti-patterns

- Reporting a hypothetical without an execution path — investigate the caller and input first.
- Flagging pre-existing debt outside the diff — mention only if the change makes it worse or depends on it.
- “This could be cleaner” or “consider using X” — not actionable — explain a concrete defect or omit.
- Nitpicking quote style, semicolons, naming preference, or comment wording already covered by formatter/linter — let automation handle it.
- Requesting broad tests unrelated to changed behaviour — ask for the minimal regression case.
- Treating missing test as proof of a bug — distinguish risk/coverage gap from a demonstrated correctness finding.
- Listing every imagined edge case or counting low-value P3s — prioritize signal; report fewer, stronger findings.
- Calling a performance issue without frequency, cost, or user impact — measure or omit.
- Saying “looks good” while implying exhaustive verification — state exactly which checks were run and what static review covered.
- Rewriting code while asked only to review — report findings; change files only when explicitly asked.

## Implementation Examples

### Review trace: debounced search race (React)

```tsx
// src/features/search/useSearch.ts — review target
useEffect(() => {
  fetch(`/api/search?q=${encodeURIComponent(query)}`)
    .then((r) => r.json())
    .then(setResults);
}, [query]);
```

Review checks: does a prior request overwrite newer results? Is work cancelled on query change/unmount? Is response JSON treated as untrusted? Does non-2xx enter an error state? A targeted fix can use an `AbortController` cleanup and check `response.ok`; do not demand a new data library solely for this snippet.

### Review trace: Angular subscription lifecycle

```ts
// src/app/features/orders/orders.component.ts — review target
this.route.params.subscribe(params => this.store.load(params['id']));
```

Review checks: can the component be destroyed while the route observable remains active? Does this need a subscription at all, or can the template use `AsyncPipe`? For a side effect, use the repository's cleanup pattern such as `takeUntilDestroyed()` (Angular 16+) or existing `takeUntil` subject pattern on older projects. Verify route param typing and missing ID handling.

### Valid finding vs preference

```text
Bad: [P2] Use memoization here
This component recalculates the list on each render.

Better only if evidenced: [P2] Avoid filtering the full history on every keystroke
With 40,000 loaded rows, each keypress runs this O(n) filter on the main thread and blocks input for ~180 ms on the supported test device. Debounce or move filtering to the server; include the measurement/test setup.

Not a finding without evidence: The list might get large someday.
```

## Validation Checklist

- [ ] Findings only concern changed code or a directly introduced interaction.
- [ ] Every finding has severity, trigger, impact, location, and a minimal remediation direction.
- [ ] Checked correctness, types/contracts, security, accessibility, performance, tests, and conventions as relevant.
- [ ] Considered async races, loading/error/empty states, cleanup, and navigation where relevant.
- [ ] No style-only, speculative, or pre-existing issues presented as defects.
- [ ] Did not modify files unless explicitly asked.
- [ ] Reported validation commands and their actual results; “No findings” if none meet the bar.

## References

- OWASP Cross Site Scripting Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
- Angular accessibility: https://angular.dev/best-practices/a11y
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
